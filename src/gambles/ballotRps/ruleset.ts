import { appendAction } from "../../engine/actionLog";
import { createAuditReport } from "../../engine/audit";
import {
  createCommitment,
  revealCommitment,
  type CommitmentRecord
} from "../../engine/commitments";
import type { DeterministicRng } from "../../engine/rng";
import { createReplayEnvelope, computeReplayHash } from "../../engine/replay";
import type { GambleRuleset, PlayerId, Resolution, RulesetConfig, Settlement } from "../../engine/stateMachine";
import { compareRps } from "./ai";
import {
  emptyVoteCounts,
  isRpsMove,
  type BallotRpsAction,
  type BallotRpsConfig,
  type BallotRpsPrivateState,
  type BallotRpsState,
  type RpsMove
} from "./types";

const rulesetId = "ballot-rps.v1";
const defaultHandSize = 3;

export const ballotRpsRuleset: GambleRuleset<BallotRpsState, BallotRpsAction> = {
  id: rulesetId,
  init(config: RulesetConfig, rng: DeterministicRng): BallotRpsState {
    const parsed = parseConfig(config);
    const privateStateByPlayer = Object.fromEntries(
      parsed.players.map((playerId) => [playerId, { hand: [] } satisfies BallotRpsPrivateState])
    );
    return {
      gameId: parsed.gameId,
      rulesetId,
      phase: "voting",
      turn: 0,
      publicState: {
        players: parsed.players,
        voters: parsed.voters,
        voteCounts: emptyVoteCounts(),
        poolSize: 0,
        revealedVotes: 0,
        committedPlays: [],
        revealedPlays: {}
      },
      privateStateByPlayer,
      commitments: [],
      actionLog: [],
      randomLog: [...rng.randomLog],
      auditFlags: []
    };
  },

  getPublicView(state: BallotRpsState, viewer: PlayerId) {
    return {
      gameId: state.gameId,
      rulesetId: state.rulesetId,
      phase: state.phase,
      turn: state.turn,
      publicState: state.publicState,
      viewerHand: state.privateStateByPlayer[viewer]?.hand ?? []
    };
  },

  legalActions(state: BallotRpsState, player: PlayerId): BallotRpsAction[] {
    if (state.phase === "playCommit" && state.publicState.players.includes(player)) {
      return [{ type: "COMMIT_PLAY", playerId: player, payload: { commitment: "<commitment>" } }];
    }
    if (state.phase === "playReveal" && state.publicState.players.includes(player)) {
      return [{ type: "REVEAL_PLAY", playerId: player, payload: { choice: "rock", salt: "<salt>" } }];
    }
    return [];
  },

  applyAction(
    state: BallotRpsState,
    action: BallotRpsAction,
    rng: DeterministicRng
  ): Resolution<BallotRpsState> {
    switch (action.type) {
      case "COMMIT_VOTE":
        return commitVote(state, action, rng);
      case "REVEAL_VOTE":
        return revealVote(state, action, rng);
      case "COMMIT_PLAY":
        return commitPlay(state, action, rng);
      case "REVEAL_PLAY":
        return revealPlay(state, action, rng);
      default:
        return reject(state, rng, "Unsupported action");
    }
  },

  isTerminal(state: BallotRpsState): boolean {
    return state.phase === "settled";
  },

  settle(state: BallotRpsState): Settlement {
    const existing = state.publicState.result;
    if (existing) {
      return existing;
    }
    return {
      terminal: false,
      winnerIds: [],
      balanceDeltas: {},
      reason: "Game is not settled"
    };
  },

  audit(state: BallotRpsState) {
    return buildAudit(state);
  }
};

export function makeBallotRpsCommitment(
  gameId: string,
  round: number,
  playerId: PlayerId,
  choice: RpsMove,
  salt: string
): string {
  return createCommitment(choice, salt, { gameId, round, playerId });
}

function commitVote(
  state: BallotRpsState,
  action: Extract<BallotRpsAction, { type: "COMMIT_VOTE" }>,
  rng: DeterministicRng
): Resolution<BallotRpsState> {
  if (state.phase !== "voting") {
    return reject(state, rng, "Votes can only be committed during voting");
  }
  if (!state.publicState.voters.includes(action.payload.voterId)) {
    return reject(state, rng, "Unknown voter");
  }
  if (findCommitment(state, action.payload.voterId, 0)) {
    return reject(state, rng, "Voter already committed");
  }

  const commitment: CommitmentRecord<RpsMove> = {
    id: action.payload.commitment,
    gameId: state.gameId,
    round: 0,
    playerId: action.payload.voterId,
    commitment: action.payload.commitment,
    scheme: "sha256-canonical-v1",
    status: "committed",
    createdAtTurn: state.turn
  };

  return accept(
    {
      ...state,
      commitments: [...state.commitments, commitment]
    },
    action,
    rng
  );
}

function revealVote(
  state: BallotRpsState,
  action: Extract<BallotRpsAction, { type: "REVEAL_VOTE" }>,
  rng: DeterministicRng
): Resolution<BallotRpsState> {
  if (state.phase !== "voting") {
    return reject(state, rng, "Votes can only be revealed during voting");
  }
  if (!isRpsMove(action.payload.choice)) {
    return reject(state, rng, "Invalid vote choice");
  }

  const commitment = findCommitment(state, action.payload.voterId, 0);
  if (!commitment) {
    return reject(state, rng, "Vote commitment not found");
  }
  if (commitment.status !== "committed") {
    return reject(state, rng, "Vote already revealed");
  }

  const revealed = revealCommitment(commitment, action.payload.choice, action.payload.salt, state.turn);
  if (revealed.status !== "revealed") {
    return reject(
      {
        ...state,
        commitments: replaceCommitment(state.commitments, revealed)
      },
      rng,
      "Vote reveal does not match commitment"
    );
  }

  const voteCounts = {
    ...state.publicState.voteCounts,
    [action.payload.choice]: state.publicState.voteCounts[action.payload.choice] + 1
  };
  const nextState = {
    ...state,
    commitments: replaceCommitment(state.commitments, revealed),
    publicState: {
      ...state.publicState,
      voteCounts,
      poolSize: state.publicState.poolSize + 1,
      revealedVotes: state.publicState.revealedVotes + 1
    }
  };
  const accepted = accept(nextState, action, rng).state;

  if (accepted.publicState.revealedVotes === accepted.publicState.voters.length) {
    return { state: dealHands(accepted, rng), accepted: true, errors: [] };
  }

  return { state: accepted, accepted: true, errors: [] };
}

function commitPlay(
  state: BallotRpsState,
  action: Extract<BallotRpsAction, { type: "COMMIT_PLAY" }>,
  rng: DeterministicRng
): Resolution<BallotRpsState> {
  if (state.phase !== "playCommit") {
    return reject(state, rng, "Plays can only be committed after dealing");
  }
  if (!state.publicState.players.includes(action.playerId)) {
    return reject(state, rng, "Only duelists can commit plays");
  }
  if (findCommitment(state, action.playerId, 1)) {
    return reject(state, rng, "Player already committed a play");
  }

  const commitment: CommitmentRecord<RpsMove> = {
    id: action.payload.commitment,
    gameId: state.gameId,
    round: 1,
    playerId: action.playerId,
    commitment: action.payload.commitment,
    scheme: "sha256-canonical-v1",
    status: "committed",
    createdAtTurn: state.turn
  };

  const nextCommitted = [...state.publicState.committedPlays, action.playerId];
  const phase = nextCommitted.length === state.publicState.players.length ? "playReveal" : state.phase;

  return accept(
    {
      ...state,
      phase,
      commitments: [...state.commitments, commitment],
      publicState: {
        ...state.publicState,
        committedPlays: nextCommitted
      }
    },
    action,
    rng
  );
}

function revealPlay(
  state: BallotRpsState,
  action: Extract<BallotRpsAction, { type: "REVEAL_PLAY" }>,
  rng: DeterministicRng
): Resolution<BallotRpsState> {
  if (state.phase !== "playReveal") {
    return reject(state, rng, "Plays can only be revealed after all commitments");
  }
  if (!isRpsMove(action.payload.choice)) {
    return reject(state, rng, "Invalid play choice");
  }
  if (!state.privateStateByPlayer[action.playerId]?.hand.includes(action.payload.choice)) {
    return reject(state, rng, "Player cannot reveal a card outside their hand");
  }

  const commitment = findCommitment(state, action.playerId, 1);
  if (!commitment) {
    return reject(state, rng, "Play commitment not found");
  }
  if (commitment.status !== "committed") {
    return reject(state, rng, "Play already revealed");
  }

  const revealed = revealCommitment(commitment, action.payload.choice, action.payload.salt, state.turn);
  if (revealed.status !== "revealed") {
    return reject(
      {
        ...state,
        commitments: replaceCommitment(state.commitments, revealed)
      },
      rng,
      "Play reveal does not match commitment"
    );
  }

  const revealedPlays = {
    ...state.publicState.revealedPlays,
    [action.playerId]: action.payload.choice
  };
  const nextState = accept(
    {
      ...state,
      commitments: replaceCommitment(state.commitments, revealed),
      publicState: {
        ...state.publicState,
        revealedPlays
      }
    },
    action,
    rng
  ).state;

  if (Object.keys(revealedPlays).length === state.publicState.players.length) {
    return { state: finalize(nextState), accepted: true, errors: [] };
  }

  return { state: nextState, accepted: true, errors: [] };
}

function dealHands(state: BallotRpsState, rng: DeterministicRng): BallotRpsState {
  const pool = state.commitments
    .filter((record) => record.round === 0 && record.status === "revealed")
    .map((record) => record.revealedChoice)
    .filter(isRpsMove);
  const needed = state.publicState.players.length * defaultHandSize;
  if (pool.length < needed) {
    throw new Error(`Ballot RPS needs at least ${needed} revealed votes`);
  }

  const deck = rng.shuffle(pool, "ballotRps.votePoolShuffle");
  const privateStateByPlayer = { ...state.privateStateByPlayer };
  state.publicState.players.forEach((playerId, playerIndex) => {
    privateStateByPlayer[playerId] = {
      hand: deck.slice(playerIndex * defaultHandSize, (playerIndex + 1) * defaultHandSize)
    };
  });

  return {
    ...state,
    phase: "playCommit",
    privateStateByPlayer,
    randomLog: [...rng.randomLog]
  };
}

function finalize(state: BallotRpsState): BallotRpsState {
  const [leftPlayer, rightPlayer] = state.publicState.players;
  const leftMove = state.publicState.revealedPlays[leftPlayer];
  const rightMove = state.publicState.revealedPlays[rightPlayer];
  if (!leftMove || !rightMove) {
    return state;
  }
  const comparison = compareRps(leftMove, rightMove);
  const result =
    comparison === 0
      ? tieSettlement(state)
      : winnerSettlement(state, comparison === 1 ? leftPlayer : rightPlayer);
  const withResult: BallotRpsState = {
    ...state,
    phase: "settled",
    publicState: {
      ...state.publicState,
      result
    }
  };
  const audit = buildAudit(withResult);
  return {
    ...withResult,
    publicState: {
      ...withResult.publicState,
      audit
    }
  };
}

function winnerSettlement(state: BallotRpsState, winnerId: PlayerId): Settlement {
  const [leftPlayer, rightPlayer] = state.publicState.players;
  return {
    terminal: true,
    winnerIds: [winnerId],
    balanceDeltas: {
      [leftPlayer]: winnerId === leftPlayer ? 1 : -1,
      [rightPlayer]: winnerId === rightPlayer ? 1 : -1
    },
    reason: `${winnerId} wins by revealed RPS comparison`
  };
}

function tieSettlement(state: BallotRpsState): Settlement {
  const [leftPlayer, rightPlayer] = state.publicState.players;
  return {
    terminal: true,
    winnerIds: [],
    balanceDeltas: {
      [leftPlayer]: 0,
      [rightPlayer]: 0
    },
    reason: "Tie reveal"
  };
}

function buildAudit(state: BallotRpsState) {
  const replayHash = computeReplayHash(
    createReplayEnvelope({
      gameId: state.gameId,
      rulesetId,
      seed: state.randomLog[0]?.seed ?? "unknown",
      actionLog: state.actionLog,
      randomLog: state.randomLog,
      commitments: state.commitments,
      settlementHash: state.publicState.result ? state.publicState.result.reason : undefined
    })
  );
  const commitmentFailures = state.commitments.filter((record) => record.status === "rejected");
  return createAuditReport({
    fairness: {
      randomVerified: state.randomLog.every((record, index) => record.index === index),
      commitmentsVerified: commitmentFailures.length === 0,
      settlementVerified: state.phase === "settled"
    },
    anomalies: commitmentFailures.map((record) => ({
      severity: "high",
      signal: "commitment-rejected",
      explanation: `${record.playerId} failed to reveal a matching commitment`
    })),
    replayHash
  });
}

function accept(
  state: BallotRpsState,
  action: BallotRpsAction,
  rng: DeterministicRng
): Resolution<BallotRpsState> {
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
  state: BallotRpsState,
  rng: DeterministicRng,
  error: string
): Resolution<BallotRpsState> {
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
  state: BallotRpsState,
  playerId: PlayerId,
  round: number
): CommitmentRecord<RpsMove> | undefined {
  return state.commitments.find(
    (record): record is CommitmentRecord<RpsMove> =>
      record.playerId === playerId && record.round === round
  );
}

function replaceCommitment(
  commitments: readonly CommitmentRecord[],
  replacement: CommitmentRecord
): CommitmentRecord[] {
  return commitments.map((record) => (record.id === replacement.id ? replacement : record));
}

function parseConfig(config: RulesetConfig): BallotRpsConfig {
  if (config.players.length !== 2) {
    throw new Error("Ballot RPS requires exactly two duelists");
  }
  const voters = config.voters;
  if (!Array.isArray(voters) || voters.length < 6 || voters.some((voter) => typeof voter !== "string")) {
    throw new Error("Ballot RPS requires at least six voter ids");
  }
  return {
    gameId: config.gameId,
    seed: config.seed,
    players: [config.players[0] as PlayerId, config.players[1] as PlayerId],
    voters: voters as PlayerId[]
  };
}
