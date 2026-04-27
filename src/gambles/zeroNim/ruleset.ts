import { appendAction } from "../../engine/actionLog";
import { createAuditReport } from "../../engine/audit";
import { createCommitment, revealCommitment, type CommitmentRecord } from "../../engine/commitments";
import type { DeterministicRng } from "../../engine/rng";
import { computeReplayHash, createReplayEnvelope } from "../../engine/replay";
import type { GambleRuleset, PlayerId, Resolution, RulesetConfig, Settlement } from "../../engine/stateMachine";
import { detectZeroNimAnomalies } from "./audit";
import {
  isNimCard,
  type NimCard,
  type ZeroNimAction,
  type ZeroNimConfig,
  type ZeroNimPrivateState,
  type ZeroNimState
} from "./types";

const rulesetId = "zero-nim.v1";
const defaultThreshold = 9;
const defaultHandSize = 4;

export const zeroNimRuleset: GambleRuleset<ZeroNimState, ZeroNimAction> = {
  id: rulesetId,
  init(config: RulesetConfig, rng: DeterministicRng): ZeroNimState {
    const parsed = parseConfig(config);
    const deck = rng.shuffle(buildDeck(parsed.handSize), "zeroNim.deal");
    const privateStateByPlayer = Object.fromEntries(
      parsed.players.map((playerId, index) => [
        playerId,
        {
          hand: deck.slice(index * parsed.handSize, (index + 1) * parsed.handSize)
        } satisfies ZeroNimPrivateState
      ])
    );

    return {
      gameId: parsed.gameId,
      rulesetId,
      phase: "betting",
      turn: 0,
      publicState: {
        players: parsed.players,
        activePlayer: parsed.players[0],
        nextToAct: parsed.players[0],
        total: 0,
        threshold: parsed.threshold,
        round: 1,
        pot: 0,
        currentBet: 0,
        contributions: {
          [parsed.players[0]]: 0,
          [parsed.players[1]]: 0
        },
        actedThisBetting: []
      },
      privateStateByPlayer,
      commitments: [],
      actionLog: [],
      randomLog: [...rng.randomLog],
      auditFlags: []
    };
  },

  getPublicView(state: ZeroNimState, viewer: PlayerId) {
    return {
      gameId: state.gameId,
      rulesetId: state.rulesetId,
      phase: state.phase,
      turn: state.turn,
      publicState: state.publicState,
      viewerHand: state.privateStateByPlayer[viewer]?.hand ?? []
    };
  },

  legalActions(state: ZeroNimState, player: PlayerId): ZeroNimAction[] {
    if (state.phase === "betting" && state.publicState.nextToAct === player) {
      return [
        { type: "BET", playerId: player, payload: { kind: "check" } },
        { type: "BET", playerId: player, payload: { kind: "call" } },
        { type: "BET", playerId: player, payload: { kind: "raise", raiseTo: state.publicState.currentBet + 1 } },
        { type: "BET", playerId: player, payload: { kind: "fold" } }
      ];
    }
    if (state.phase === "cardCommit" && state.publicState.activePlayer === player) {
      return [{ type: "COMMIT_CARD", playerId: player, payload: { commitment: "<commitment>" } }];
    }
    if (state.phase === "cardReveal" && state.publicState.activePlayer === player) {
      return [{ type: "REVEAL_CARD", playerId: player, payload: { card: 0, salt: "<salt>" } }];
    }
    return [];
  },

  applyAction(state: ZeroNimState, action: ZeroNimAction, rng: DeterministicRng): Resolution<ZeroNimState> {
    switch (action.type) {
      case "BET":
        return bet(state, action, rng);
      case "COMMIT_CARD":
        return commitCard(state, action, rng);
      case "REVEAL_CARD":
        return revealCard(state, action, rng);
      default:
        return reject(state, rng, "Unsupported action");
    }
  },

  isTerminal(state: ZeroNimState): boolean {
    return state.phase === "settled";
  },

  settle(state: ZeroNimState): Settlement {
    return (
      state.publicState.result ?? {
        terminal: false,
        winnerIds: [],
        balanceDeltas: {},
        reason: "Game is not settled"
      }
    );
  },

  audit(state: ZeroNimState) {
    return buildAudit(state);
  }
};

export function makeZeroNimCommitment(
  gameId: string,
  round: number,
  playerId: PlayerId,
  card: NimCard,
  salt: string
): string {
  return createCommitment(card, salt, { gameId, round, playerId });
}

function bet(
  state: ZeroNimState,
  action: Extract<ZeroNimAction, { type: "BET" }>,
  rng: DeterministicRng
): Resolution<ZeroNimState> {
  if (state.phase !== "betting") {
    return reject(state, rng, "Bets can only be made during betting");
  }
  if (state.publicState.nextToAct !== action.playerId) {
    return reject(state, rng, "It is not this player's betting turn");
  }
  if (action.payload.kind === "fold") {
    const winner = otherPlayer(state, action.playerId);
    return { state: finalize(state, winner, `${action.playerId} folded`, rng, action), accepted: true, errors: [] };
  }

  const currentContribution = state.publicState.contributions[action.playerId] ?? 0;
  let currentBet = state.publicState.currentBet;
  let contribution = currentContribution;

  if (action.payload.kind === "raise") {
    const raiseTo = action.payload.raiseTo;
    if (typeof raiseTo !== "number" || !Number.isInteger(raiseTo) || raiseTo <= currentBet) {
      return reject(state, rng, "Raise must increase the current bet");
    }
    currentBet = raiseTo;
    contribution = raiseTo;
  } else if (action.payload.kind === "call") {
    if (currentBet === 0) {
      return reject(state, rng, "Cannot call when there is no open bet");
    }
    contribution = currentBet;
  } else if (action.payload.kind === "check") {
    if (currentBet > currentContribution) {
      return reject(state, rng, "Cannot check against an open bet");
    }
  }

  const nextActed = [...new Set([...state.publicState.actedThisBetting, action.playerId])];
  const contributions = {
    ...state.publicState.contributions,
    [action.playerId]: contribution
  };
  const pot = Object.values(contributions).reduce((sum, value) => sum + value, 0);
  const bothActed = state.publicState.players.every((playerId) => nextActed.includes(playerId));
  const matched = state.publicState.players.every((playerId) => contributions[playerId] === currentBet);
  const nextState = accept(
    {
      ...state,
      phase: bothActed && matched ? "cardCommit" : "betting",
      publicState: {
        ...state.publicState,
        currentBet,
        contributions,
        pot,
        actedThisBetting: nextActed,
        nextToAct: bothActed && matched ? state.publicState.activePlayer : otherPlayer(state, action.playerId)
      }
    },
    action,
    rng
  ).state;
  return { state: nextState, accepted: true, errors: [] };
}

function commitCard(
  state: ZeroNimState,
  action: Extract<ZeroNimAction, { type: "COMMIT_CARD" }>,
  rng: DeterministicRng
): Resolution<ZeroNimState> {
  if (state.phase !== "cardCommit") {
    return reject(state, rng, "Card can only be committed after betting closes");
  }
  if (action.playerId !== state.publicState.activePlayer) {
    return reject(state, rng, "Only the active player commits a card");
  }
  if (findCommitment(state, action.playerId, state.publicState.round)) {
    return reject(state, rng, "Active player already committed this round");
  }

  const commitment: CommitmentRecord<NimCard> = {
    id: action.payload.commitment,
    gameId: state.gameId,
    round: state.publicState.round,
    playerId: action.playerId,
    commitment: action.payload.commitment,
    scheme: "sha256-canonical-v1",
    status: "committed",
    createdAtTurn: state.turn
  };

  return accept(
    {
      ...state,
      phase: "cardReveal",
      commitments: [...state.commitments, commitment],
      publicState: {
        ...state.publicState,
        committedCardPlayer: action.playerId
      }
    },
    action,
    rng
  );
}

function revealCard(
  state: ZeroNimState,
  action: Extract<ZeroNimAction, { type: "REVEAL_CARD" }>,
  rng: DeterministicRng
): Resolution<ZeroNimState> {
  if (state.phase !== "cardReveal") {
    return reject(state, rng, "Card can only be revealed after commitment");
  }
  if (action.playerId !== state.publicState.activePlayer) {
    return reject(state, rng, "Only the active player reveals a card");
  }
  if (!isNimCard(action.payload.card)) {
    return reject(state, rng, "Invalid Nim card");
  }
  const hand = state.privateStateByPlayer[action.playerId]?.hand ?? [];
  if (!hand.includes(action.payload.card)) {
    return reject(state, rng, "Cannot reveal a card outside the active hand");
  }
  const commitment = findCommitment(state, action.playerId, state.publicState.round);
  if (!commitment) {
    return reject(state, rng, "Card commitment not found");
  }
  const revealed = revealCommitment(commitment, action.payload.card, action.payload.salt, state.turn);
  if (revealed.status !== "revealed") {
    return reject(
      {
        ...state,
        commitments: replaceCommitment(state.commitments, revealed)
      },
      rng,
      "Card reveal does not match commitment"
    );
  }

  const newTotal = state.publicState.total + action.payload.card;
  const nextHand = removeOne(hand, action.payload.card);
  const privateStateByPlayer = {
    ...state.privateStateByPlayer,
    [action.playerId]: { hand: nextHand }
  };
  const accepted = accept(
    {
      ...state,
      commitments: replaceCommitment(state.commitments, revealed),
      privateStateByPlayer,
      publicState: {
        ...state.publicState,
        total: newTotal,
        lastRevealed: { playerId: action.playerId, card: action.payload.card }
      }
    },
    action,
    rng
  ).state;

  if (newTotal > state.publicState.threshold) {
    return {
      state: finalize(accepted, otherPlayer(state, action.playerId), `${action.playerId} busted above ${state.publicState.threshold}`, rng),
      accepted: true,
      errors: []
    };
  }

  const allHandsEmpty = state.publicState.players.every(
    (playerId) => (accepted.privateStateByPlayer[playerId]?.hand.length ?? 0) === 0
  );
  if (allHandsEmpty) {
    return {
      state: finalize(accepted, state.publicState.activePlayer, "No bust; last active player keeps tempo advantage", rng),
      accepted: true,
      errors: []
    };
  }

  const nextActive = otherPlayer(state, state.publicState.activePlayer);
  return {
    state: {
      ...accepted,
      phase: "betting",
      publicState: {
        ...accepted.publicState,
        activePlayer: nextActive,
        nextToAct: nextActive,
        round: accepted.publicState.round + 1,
        currentBet: 0,
        contributions: {
          [accepted.publicState.players[0]]: 0,
          [accepted.publicState.players[1]]: 0
        },
        actedThisBetting: [],
        committedCardPlayer: undefined
      }
    },
    accepted: true,
    errors: []
  };
}

function finalize(
  state: ZeroNimState,
  winnerId: PlayerId,
  reason: string,
  rng: DeterministicRng,
  foldAction?: ZeroNimAction
): ZeroNimState {
  const withFold = foldAction ? accept(state, foldAction, rng).state : state;
  const [leftPlayer, rightPlayer] = withFold.publicState.players;
  const result: Settlement = {
    terminal: true,
    winnerIds: [winnerId],
    balanceDeltas: {
      [leftPlayer]: winnerId === leftPlayer ? withFold.publicState.pot : -(withFold.publicState.contributions[leftPlayer] ?? 0),
      [rightPlayer]: winnerId === rightPlayer ? withFold.publicState.pot : -(withFold.publicState.contributions[rightPlayer] ?? 0)
    },
    reason
  };
  const settled: ZeroNimState = {
    ...withFold,
    phase: "settled",
    publicState: {
      ...withFold.publicState,
      result
    }
  };
  const audit = buildAudit(settled);
  return {
    ...settled,
    auditFlags: audit.anomalies,
    publicState: {
      ...settled.publicState,
      audit
    }
  };
}

function buildAudit(state: ZeroNimState) {
  const anomalies = [
    ...state.commitments
      .filter((record) => record.status === "rejected")
      .map((record) => ({
        severity: "high" as const,
        signal: "commitment-rejected",
        explanation: `${record.playerId} failed to reveal a matching Nim card commitment`
      })),
    ...detectZeroNimAnomalies(state)
  ];
  const replayHash = computeReplayHash(
    createReplayEnvelope({
      gameId: state.gameId,
      rulesetId,
      seed: state.randomLog[0]?.seed ?? "unknown",
      actionLog: state.actionLog,
      randomLog: state.randomLog,
      commitments: state.commitments,
      settlementHash: state.publicState.result ? JSON.stringify(state.publicState.result) : undefined
    })
  );
  return createAuditReport({
    fairness: {
      randomVerified: state.randomLog.every((record, index) => record.index === index),
      commitmentsVerified: state.commitments.every((record) => record.status !== "rejected"),
      settlementVerified: state.phase === "settled"
    },
    anomalies,
    replayHash
  });
}

function accept(
  state: ZeroNimState,
  action: ZeroNimAction,
  rng: DeterministicRng
): Resolution<ZeroNimState> {
  const actionRecord = appendAction(state.actionLog, {
    gameId: state.gameId,
    playerId: action.playerId,
    type: action.type,
    payload: action.payload,
    turn: state.turn
  });
  return {
    state: {
      ...state,
      turn: state.turn + 1,
      actionLog: [...state.actionLog, actionRecord],
      randomLog: [...rng.randomLog]
    },
    accepted: true,
    errors: []
  };
}

function reject(state: ZeroNimState, rng: DeterministicRng, error: string): Resolution<ZeroNimState> {
  return {
    state: {
      ...state,
      randomLog: [...rng.randomLog]
    },
    accepted: false,
    errors: [error]
  };
}

function findCommitment(
  state: ZeroNimState,
  playerId: PlayerId,
  round: number
): CommitmentRecord<NimCard> | undefined {
  return state.commitments.find(
    (record): record is CommitmentRecord<NimCard> =>
      record.playerId === playerId && record.round === round
  );
}

function replaceCommitment(
  commitments: readonly CommitmentRecord[],
  replacement: CommitmentRecord
): CommitmentRecord[] {
  return commitments.map((record) => (record.id === replacement.id ? replacement : record));
}

function otherPlayer(state: ZeroNimState, playerId: PlayerId): PlayerId {
  const other = state.publicState.players.find((candidate) => candidate !== playerId);
  if (!other) {
    throw new Error(`No opponent for ${playerId}`);
  }
  return other;
}

function removeOne(hand: readonly NimCard[], card: NimCard): NimCard[] {
  const copy = [...hand];
  const index = copy.indexOf(card);
  if (index >= 0) {
    copy.splice(index, 1);
  }
  return copy;
}

function buildDeck(handSize: number): NimCard[] {
  const values: NimCard[] = [0, 1, 2, 3];
  const deck: NimCard[] = [];
  while (deck.length < handSize * 2) {
    deck.push(...values);
  }
  return deck.slice(0, handSize * 2);
}

function parseConfig(config: RulesetConfig): ZeroNimConfig & { threshold: number; handSize: number } {
  if (config.players.length !== 2) {
    throw new Error("Zero Nim MVP requires exactly two players");
  }
  const threshold = typeof config.threshold === "number" ? config.threshold : defaultThreshold;
  const handSize = typeof config.handSize === "number" ? config.handSize : defaultHandSize;
  if (threshold < 4 || threshold > 30) {
    throw new Error("Zero Nim threshold must be between 4 and 30");
  }
  if (handSize < 2 || handSize > 8) {
    throw new Error("Zero Nim hand size must be between 2 and 8");
  }
  return {
    gameId: config.gameId,
    seed: config.seed,
    players: [config.players[0] as PlayerId, config.players[1] as PlayerId],
    threshold,
    handSize
  };
}
