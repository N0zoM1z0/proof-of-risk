import { appendAction } from "../../engine/actionLog";
import { createAuditReport } from "../../engine/audit";
import type { DeterministicRng } from "../../engine/rng";
import { computeReplayHash, createReplayEnvelope } from "../../engine/replay";
import type { GambleRuleset, PlayerId, Resolution, RulesetConfig, Settlement } from "../../engine/stateMachine";
import type {
  DiceRound,
  DieId,
  NontransitiveDiceAction,
  NontransitiveDiceConfig,
  NontransitiveDicePrivateState,
  NontransitiveDiceState
} from "./types";

const rulesetId = "nontransitive-dice.v1";
const defaultRoundCount = 5;

export const dice: Record<DieId, number[]> = {
  ember: [4, 4, 4, 4, 0, 0],
  granite: [3, 3, 3, 3, 3, 3],
  tide: [6, 6, 2, 2, 2, 2]
};

export const counterPick: Record<DieId, DieId> = {
  ember: "tide",
  granite: "ember",
  tide: "granite"
};

export const nontransitiveDiceRuleset: GambleRuleset<NontransitiveDiceState, NontransitiveDiceAction> = {
  id: rulesetId,

  init(config: RulesetConfig, rng: DeterministicRng): NontransitiveDiceState {
    const parsed = parseConfig(config);
    return {
      gameId: parsed.gameId,
      rulesetId,
      phase: "playerPick",
      turn: 0,
      publicState: {
        players: parsed.players,
        roundCount: parsed.roundCount,
        rounds: [],
        playerWins: 0,
        dealerWins: 0
      },
      privateStateByPlayer: Object.fromEntries(
        parsed.players.map((playerId) => [playerId, {} satisfies NontransitiveDicePrivateState])
      ),
      commitments: [],
      actionLog: [],
      randomLog: [...rng.randomLog],
      auditFlags: []
    };
  },

  getPublicView(state: NontransitiveDiceState, viewer: PlayerId) {
    return {
      gameId: state.gameId,
      rulesetId: state.rulesetId,
      phase: state.phase,
      turn: state.turn,
      publicState: state.publicState,
      viewerPrivate: state.privateStateByPlayer[viewer] ?? {}
    };
  },

  legalActions(state: NontransitiveDiceState, player: PlayerId): NontransitiveDiceAction[] {
    const [playerId, dealerId] = state.publicState.players;
    if (state.phase === "playerPick" && player === playerId) {
      return Object.keys(dice).map((die) => ({
        type: "PICK_DIE",
        playerId: player,
        payload: { die: die as DieId }
      }));
    }
    if (state.phase === "dealerPick" && player === dealerId && state.publicState.playerDie) {
      return [
        {
          type: "COUNTER_PICK_DIE",
          playerId: player,
          payload: { die: counterPick[state.publicState.playerDie] }
        }
      ];
    }
    if (state.phase === "rolling" && player === dealerId) {
      return [
        {
          type: "ROLL_PAIR",
          playerId: player,
          payload: { round: state.publicState.rounds.length + 1 }
        }
      ];
    }
    return [];
  },

  applyAction(
    state: NontransitiveDiceState,
    action: NontransitiveDiceAction,
    rng: DeterministicRng
  ): Resolution<NontransitiveDiceState> {
    switch (action.type) {
      case "PICK_DIE":
        return pickDie(state, action, rng);
      case "COUNTER_PICK_DIE":
        return counterPickDie(state, action, rng);
      case "ROLL_PAIR":
        return rollPair(state, action, rng);
      default:
        return reject(state, rng, "Unsupported action");
    }
  },

  isTerminal(state: NontransitiveDiceState): boolean {
    return state.phase === "settled";
  },

  settle(state: NontransitiveDiceState): Settlement {
    return (
      state.publicState.result ?? {
        terminal: false,
        winnerIds: [],
        balanceDeltas: {},
        reason: "Dice duel is not settled"
      }
    );
  },

  audit(state: NontransitiveDiceState) {
    return buildAudit(state);
  }
};

function pickDie(
  state: NontransitiveDiceState,
  action: Extract<NontransitiveDiceAction, { type: "PICK_DIE" }>,
  rng: DeterministicRng
): Resolution<NontransitiveDiceState> {
  const [playerId] = state.publicState.players;
  if (state.phase !== "playerPick") {
    return reject(state, rng, "Player die can only be picked in playerPick");
  }
  if (action.playerId !== playerId) {
    return reject(state, rng, "Only the player can pick first");
  }
  if (!isDie(action.payload.die)) {
    return reject(state, rng, "Unknown die");
  }
  return accept(
    {
      ...state,
      phase: "dealerPick",
      publicState: {
        ...state.publicState,
        playerDie: action.payload.die
      }
    },
    action,
    rng
  );
}

function counterPickDie(
  state: NontransitiveDiceState,
  action: Extract<NontransitiveDiceAction, { type: "COUNTER_PICK_DIE" }>,
  rng: DeterministicRng
): Resolution<NontransitiveDiceState> {
  const [, dealerId] = state.publicState.players;
  if (state.phase !== "dealerPick") {
    return reject(state, rng, "Dealer die can only be picked in dealerPick");
  }
  if (action.playerId !== dealerId) {
    return reject(state, rng, "Only the dealer can counter-pick");
  }
  const playerDie = state.publicState.playerDie;
  if (!playerDie) {
    return reject(state, rng, "Player die is missing");
  }
  if (action.payload.die !== counterPick[playerDie]) {
    return reject(state, rng, "Dealer must reveal the deterministic counter-pick");
  }
  return accept(
    {
      ...state,
      phase: "rolling",
      publicState: {
        ...state.publicState,
        dealerDie: action.payload.die
      }
    },
    action,
    rng
  );
}

function rollPair(
  state: NontransitiveDiceState,
  action: Extract<NontransitiveDiceAction, { type: "ROLL_PAIR" }>,
  rng: DeterministicRng
): Resolution<NontransitiveDiceState> {
  const [, dealerId] = state.publicState.players;
  if (state.phase !== "rolling") {
    return reject(state, rng, "Dice can only be rolled in rolling");
  }
  if (action.playerId !== dealerId) {
    return reject(state, rng, "Only the dealer can advance deterministic rolls");
  }
  const playerDie = state.publicState.playerDie;
  const dealerDie = state.publicState.dealerDie;
  if (!playerDie || !dealerDie) {
    return reject(state, rng, "Dice selections are incomplete");
  }
  const expectedRound = state.publicState.rounds.length + 1;
  if (action.payload.round !== expectedRound) {
    return reject(state, rng, "Roll round is out of sequence");
  }

  const playerRoll = rollDie(dice[playerDie], rng, `dice.player:${expectedRound - 1}`);
  const dealerRoll = rollDie(dice[dealerDie], rng, `dice.dealer:${expectedRound - 1}`);
  const winner = playerRoll === dealerRoll ? "tie" : playerRoll > dealerRoll ? "player" : "dealer";
  const computed: DiceRound = { round: expectedRound, playerRoll, dealerRoll, winner };
  if (!payloadMatchesComputed(action.payload, computed)) {
    return reject(state, rng, "Roll payload does not match deterministic dice result");
  }

  const rounds = [...state.publicState.rounds, computed];
  const accepted = accept(
    {
      ...state,
      publicState: {
        ...state.publicState,
        rounds,
        playerWins: rounds.filter((round) => round.winner === "player").length,
        dealerWins: rounds.filter((round) => round.winner === "dealer").length
      }
    },
    {
      ...action,
      payload: computed
    },
    rng
  ).state;

  if (rounds.length === state.publicState.roundCount) {
    return { state: finalize(accepted), accepted: true, errors: [] };
  }
  return { state: accepted, accepted: true, errors: [] };
}

function finalize(state: NontransitiveDiceState): NontransitiveDiceState {
  const [playerId, dealerId] = state.publicState.players;
  const playerWins = state.publicState.playerWins;
  const dealerWins = state.publicState.dealerWins;
  const winnerIds = playerWins === dealerWins ? [] : [playerWins > dealerWins ? playerId : dealerId];
  const playerDelta = playerWins === dealerWins ? 0 : playerWins > dealerWins ? 1 : -1;
  const result: Settlement = {
    terminal: true,
    winnerIds,
    balanceDeltas: {
      [playerId]: playerDelta,
      [dealerId]: -playerDelta
    },
    reason:
      playerWins === dealerWins
        ? "Dice duel ends tied"
        : `${winnerIds[0]} wins the non-transitive dice duel ${playerWins}-${dealerWins}`
  };
  const settled: NontransitiveDiceState = {
    ...state,
    phase: "settled",
    publicState: {
      ...state.publicState,
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

function buildAudit(state: NontransitiveDiceState) {
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
      commitmentsVerified: true,
      settlementVerified: state.phase === "settled"
    },
    anomalies: [],
    replayHash
  });
}

function accept(
  state: NontransitiveDiceState,
  action: NontransitiveDiceAction,
  rng: DeterministicRng
): Resolution<NontransitiveDiceState> {
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

function reject(
  state: NontransitiveDiceState,
  rng: DeterministicRng,
  error: string
): Resolution<NontransitiveDiceState> {
  return {
    state: {
      ...state,
      randomLog: [...rng.randomLog]
    },
    accepted: false,
    errors: [error]
  };
}

function rollDie(sides: readonly number[], rng: DeterministicRng, label: string): number {
  return sides[rng.nextInt(sides.length, label)] ?? 0;
}

function payloadMatchesComputed(
  payload: Extract<NontransitiveDiceAction, { type: "ROLL_PAIR" }>["payload"],
  computed: DiceRound
): boolean {
  return (
    (payload.playerRoll === undefined || payload.playerRoll === computed.playerRoll) &&
    (payload.dealerRoll === undefined || payload.dealerRoll === computed.dealerRoll) &&
    (payload.winner === undefined || payload.winner === computed.winner)
  );
}

function isDie(value: unknown): value is DieId {
  return value === "ember" || value === "granite" || value === "tide";
}

function parseConfig(config: RulesetConfig): Required<NontransitiveDiceConfig> {
  if (config.players.length !== 2) {
    throw new Error("Non-transitive dice requires exactly two players");
  }
  const roundCount = typeof config.roundCount === "number" ? config.roundCount : defaultRoundCount;
  if (!Number.isInteger(roundCount) || roundCount < 1 || roundCount > 99) {
    throw new Error("Non-transitive dice roundCount must be between 1 and 99");
  }
  return {
    gameId: config.gameId,
    seed: config.seed,
    players: [config.players[0] as PlayerId, config.players[1] as PlayerId],
    roundCount
  };
}
