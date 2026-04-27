import { appendAction } from "../../engine/actionLog";
import { createAuditReport } from "../../engine/audit";
import { createCommitment, revealCommitment, type CommitmentRecord } from "../../engine/commitments";
import type { DeterministicRng } from "../../engine/rng";
import { computeReplayHash, createReplayEnvelope } from "../../engine/replay";
import type { GambleRuleset, PlayerId, Resolution, RulesetConfig, Settlement } from "../../engine/stateMachine";
import type {
  ContributionReveal,
  GreaterGoodAction,
  GreaterGoodArchetype,
  GreaterGoodConfig,
  GreaterGoodPrivateState,
  GreaterGoodState
} from "./types";

const rulesetId = "greater-good.v1";
const defaultCoinsPerRound = 5;
const defaultMaxRounds = 2;
const defaultArchetypes: GreaterGoodArchetype[] = [
  "cooperator",
  "defector",
  "dominator",
  "auditor",
  "chaos"
];

export const greaterGoodRuleset: GambleRuleset<GreaterGoodState, GreaterGoodAction> = {
  id: rulesetId,
  init(config: RulesetConfig, rng: DeterministicRng): GreaterGoodState {
    const parsed = parseConfig(config);
    const balances = Object.fromEntries(parsed.players.map((playerId) => [playerId, 0]));
    const archetypes = Object.fromEntries(
      parsed.players.map((playerId, index) => [
        playerId,
        parsed.archetypes?.[playerId] ?? defaultArchetypes[index % defaultArchetypes.length] ?? "cooperator"
      ])
    ) as Record<PlayerId, GreaterGoodArchetype>;
    return {
      gameId: parsed.gameId,
      rulesetId,
      phase: "contributionCommit",
      turn: 0,
      publicState: {
        players: parsed.players,
        alivePlayers: parsed.players,
        round: 1,
        maxRounds: parsed.maxRounds,
        coinsPerRound: parsed.coinsPerRound,
        balances,
        archetypes,
        contributionCommits: [],
        revealedContributions: {},
        roundTaxTotal: 0,
        roundPublicReturn: 0,
        voteCommits: [],
        revealedVotes: {},
        eliminatedPlayers: []
      },
      privateStateByPlayer: Object.fromEntries(
        parsed.players.map((playerId) => [playerId, {} satisfies GreaterGoodPrivateState])
      ),
      commitments: [],
      actionLog: [],
      randomLog: [...rng.randomLog],
      auditFlags: []
    };
  },

  getPublicView(state: GreaterGoodState, viewer: PlayerId) {
    return {
      gameId: state.gameId,
      rulesetId: state.rulesetId,
      phase: state.phase,
      turn: state.turn,
      publicState: state.publicState,
      viewerPrivate: state.privateStateByPlayer[viewer] ?? {}
    };
  },

  legalActions(state: GreaterGoodState, player: PlayerId): GreaterGoodAction[] {
    if (!state.publicState.alivePlayers.includes(player)) {
      return [];
    }
    if (state.phase === "contributionCommit") {
      return [{ type: "COMMIT_CONTRIBUTION", playerId: player, payload: { commitment: "<commitment>" } }];
    }
    if (state.phase === "contributionReveal") {
      return [{ type: "REVEAL_CONTRIBUTION", playerId: player, payload: { tax: 0, personal: 5, salt: "<salt>" } }];
    }
    if (state.phase === "voteCommit") {
      return [{ type: "COMMIT_VOTE", playerId: player, payload: { commitment: "<commitment>" } }];
    }
    if (state.phase === "voteReveal") {
      return [{ type: "REVEAL_VOTE", playerId: player, payload: { targetId: player, salt: "<salt>" } }];
    }
    return [];
  },

  applyAction(
    state: GreaterGoodState,
    action: GreaterGoodAction,
    rng: DeterministicRng
  ): Resolution<GreaterGoodState> {
    switch (action.type) {
      case "COMMIT_CONTRIBUTION":
        return commitContribution(state, action, rng);
      case "REVEAL_CONTRIBUTION":
        return revealContribution(state, action, rng);
      case "COMMIT_VOTE":
        return commitVote(state, action, rng);
      case "REVEAL_VOTE":
        return revealVote(state, action, rng);
      default:
        return reject(state, rng, "Unsupported action");
    }
  },

  isTerminal(state: GreaterGoodState): boolean {
    return state.phase === "settled";
  },

  settle(state: GreaterGoodState): Settlement {
    return (
      state.publicState.result ?? {
        terminal: false,
        winnerIds: [],
        balanceDeltas: {},
        reason: "Game is not settled"
      }
    );
  },

  audit(state: GreaterGoodState) {
    return buildAudit(state);
  }
};

export function makeGreaterGoodContributionCommitment(
  gameId: string,
  round: number,
  playerId: PlayerId,
  contribution: ContributionReveal,
  salt: string
): string {
  return createCommitment(contribution, salt, { gameId, round, playerId });
}

export function makeGreaterGoodVoteCommitment(
  gameId: string,
  round: number,
  playerId: PlayerId,
  targetId: PlayerId,
  salt: string
): string {
  return createCommitment(targetId, salt, { gameId, round: voteRound(round), playerId });
}

function commitContribution(
  state: GreaterGoodState,
  action: Extract<GreaterGoodAction, { type: "COMMIT_CONTRIBUTION" }>,
  rng: DeterministicRng
) {
  if (state.phase !== "contributionCommit") {
    return reject(state, rng, "Contribution can only be committed in contributionCommit");
  }
  if (!state.publicState.alivePlayers.includes(action.playerId)) {
    return reject(state, rng, "Only alive players can contribute");
  }
  if (findCommitment(state, action.playerId, state.publicState.round)) {
    return reject(state, rng, "Contribution already committed this round");
  }
  const commitment: CommitmentRecord<ContributionReveal> = {
    id: action.payload.commitment,
    gameId: state.gameId,
    round: state.publicState.round,
    playerId: action.playerId,
    commitment: action.payload.commitment,
    scheme: "sha256-canonical-v1",
    status: "committed",
    createdAtTurn: state.turn
  };
  const commits = [...state.publicState.contributionCommits, action.playerId];
  return accept(
    {
      ...state,
      phase: commits.length === state.publicState.alivePlayers.length ? "contributionReveal" : state.phase,
      commitments: [...state.commitments, commitment],
      publicState: {
        ...state.publicState,
        contributionCommits: commits
      }
    },
    action,
    rng
  );
}

function revealContribution(
  state: GreaterGoodState,
  action: Extract<GreaterGoodAction, { type: "REVEAL_CONTRIBUTION" }>,
  rng: DeterministicRng
) {
  if (state.phase !== "contributionReveal") {
    return reject(state, rng, "Contribution can only be revealed after all commits");
  }
  if (!isValidContribution(action.payload, state.publicState.coinsPerRound)) {
    return reject(state, rng, "Contribution must satisfy tax + personal = coins per round");
  }
  const commitment = findCommitment(state, action.playerId, state.publicState.round);
  if (!commitment) {
    return reject(state, rng, "Contribution commitment not found");
  }
  const contribution = { tax: action.payload.tax, personal: action.payload.personal };
  const revealed = revealCommitment(commitment, contribution, action.payload.salt, state.turn);
  if (revealed.status !== "revealed") {
    return reject(
      {
        ...state,
        commitments: replaceCommitment(state.commitments, revealed)
      },
      rng,
      "Contribution reveal does not match commitment"
    );
  }
  const revealedContributions = {
    ...state.publicState.revealedContributions,
    [action.playerId]: contribution
  };
  const privateStateByPlayer = {
    ...state.privateStateByPlayer,
    [action.playerId]: {
      ...state.privateStateByPlayer[action.playerId],
      lastContribution: contribution
    }
  };
  const accepted = accept(
    {
      ...state,
      commitments: replaceCommitment(state.commitments, revealed),
      privateStateByPlayer,
      publicState: {
        ...state.publicState,
        revealedContributions
      }
    },
    action,
    rng
  ).state;
  if (Object.keys(revealedContributions).length === state.publicState.alivePlayers.length) {
    return { state: distributeRound(accepted), accepted: true, errors: [] };
  }
  return { state: accepted, accepted: true, errors: [] };
}

function commitVote(
  state: GreaterGoodState,
  action: Extract<GreaterGoodAction, { type: "COMMIT_VOTE" }>,
  rng: DeterministicRng
) {
  if (state.phase !== "voteCommit") {
    return reject(state, rng, "Vote can only be committed in voteCommit");
  }
  if (!state.publicState.alivePlayers.includes(action.playerId)) {
    return reject(state, rng, "Only alive players can vote");
  }
  if (findCommitment(state, action.playerId, voteRound(state.publicState.round))) {
    return reject(state, rng, "Vote already committed this round");
  }
  const commitment: CommitmentRecord<PlayerId> = {
    id: action.payload.commitment,
    gameId: state.gameId,
    round: voteRound(state.publicState.round),
    playerId: action.playerId,
    commitment: action.payload.commitment,
    scheme: "sha256-canonical-v1",
    status: "committed",
    createdAtTurn: state.turn
  };
  const commits = [...state.publicState.voteCommits, action.playerId];
  return accept(
    {
      ...state,
      phase: commits.length === state.publicState.alivePlayers.length ? "voteReveal" : state.phase,
      commitments: [...state.commitments, commitment],
      publicState: {
        ...state.publicState,
        voteCommits: commits
      }
    },
    action,
    rng
  );
}

function revealVote(
  state: GreaterGoodState,
  action: Extract<GreaterGoodAction, { type: "REVEAL_VOTE" }>,
  rng: DeterministicRng
) {
  if (state.phase !== "voteReveal") {
    return reject(state, rng, "Vote can only be revealed after all vote commits");
  }
  if (!state.publicState.alivePlayers.includes(action.payload.targetId)) {
    return reject(state, rng, "Vote target must be alive");
  }
  if (action.payload.targetId === action.playerId) {
    return reject(state, rng, "Players cannot vote for themselves");
  }
  const commitment = findCommitment(state, action.playerId, voteRound(state.publicState.round));
  if (!commitment) {
    return reject(state, rng, "Vote commitment not found");
  }
  const revealed = revealCommitment(commitment, action.payload.targetId, action.payload.salt, state.turn);
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
  const revealedVotes = {
    ...state.publicState.revealedVotes,
    [action.playerId]: action.payload.targetId
  };
  const accepted = accept(
    {
      ...state,
      commitments: replaceCommitment(state.commitments, revealed),
      privateStateByPlayer: {
        ...state.privateStateByPlayer,
        [action.playerId]: {
          ...state.privateStateByPlayer[action.playerId],
          lastVote: action.payload.targetId
        }
      },
      publicState: {
        ...state.publicState,
        revealedVotes
      }
    },
    action,
    rng
  ).state;
  if (Object.keys(revealedVotes).length === state.publicState.alivePlayers.length) {
    return { state: resolveVote(accepted), accepted: true, errors: [] };
  }
  return { state: accepted, accepted: true, errors: [] };
}

function distributeRound(state: GreaterGoodState): GreaterGoodState {
  const taxTotal = Object.values(state.publicState.revealedContributions).reduce(
    (sum, contribution) => sum + contribution.tax,
    0
  );
  const publicReturn = Math.ceil((taxTotal * 2) / state.publicState.alivePlayers.length);
  const balances = { ...state.publicState.balances };
  for (const playerId of state.publicState.alivePlayers) {
    const contribution = state.publicState.revealedContributions[playerId];
    balances[playerId] = (balances[playerId] ?? 0) + (contribution?.personal ?? 0) + publicReturn;
  }
  return {
    ...state,
    phase: "voteCommit",
    publicState: {
      ...state.publicState,
      balances,
      roundTaxTotal: taxTotal,
      roundPublicReturn: publicReturn
    }
  };
}

function resolveVote(state: GreaterGoodState): GreaterGoodState {
  const tally = new Map<PlayerId, number>();
  Object.values(state.publicState.revealedVotes).forEach((targetId) => {
    tally.set(targetId, (tally.get(targetId) ?? 0) + 1);
  });
  const eliminated = [...tally.entries()].sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }
    return left[0].localeCompare(right[0]);
  })[0]?.[0];
  const alivePlayers = eliminated
    ? state.publicState.alivePlayers.filter((playerId) => playerId !== eliminated)
    : state.publicState.alivePlayers;
  const eliminatedPlayers = eliminated
    ? [...state.publicState.eliminatedPlayers, eliminated]
    : state.publicState.eliminatedPlayers;
  if (state.publicState.round >= state.publicState.maxRounds || alivePlayers.length <= 2) {
    return finalize({
      ...state,
      publicState: {
        ...state.publicState,
        alivePlayers,
        eliminatedPlayers
      }
    });
  }
  return {
    ...state,
    phase: "contributionCommit",
    publicState: {
      ...state.publicState,
      alivePlayers,
      eliminatedPlayers,
      round: state.publicState.round + 1,
      contributionCommits: [],
      revealedContributions: {},
      roundTaxTotal: 0,
      roundPublicReturn: 0,
      voteCommits: [],
      revealedVotes: {}
    }
  };
}

function finalize(state: GreaterGoodState): GreaterGoodState {
  const highScore = Math.max(...state.publicState.alivePlayers.map((playerId) => state.publicState.balances[playerId] ?? 0));
  const winnerIds = state.publicState.alivePlayers.filter(
    (playerId) => (state.publicState.balances[playerId] ?? 0) === highScore
  );
  const result: Settlement = {
    terminal: true,
    winnerIds,
    balanceDeltas: state.publicState.balances,
    reason: `Highest surviving balance after ${state.publicState.round} rounds`
  };
  const settled: GreaterGoodState = {
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

function buildAudit(state: GreaterGoodState) {
  const rejected = state.commitments.filter((record) => record.status === "rejected");
  const replayHash = computeReplayHash(
    createReplayEnvelope({
      gameId: state.gameId,
      rulesetId,
      seed: state.randomLog[0]?.seed ?? "no-random",
      actionLog: state.actionLog,
      randomLog: state.randomLog,
      commitments: state.commitments,
      settlementHash: state.publicState.result ? JSON.stringify(state.publicState.result) : undefined
    })
  );
  return createAuditReport({
    fairness: {
      randomVerified: state.randomLog.every((record, index) => record.index === index),
      commitmentsVerified: rejected.length === 0,
      settlementVerified: state.phase === "settled"
    },
    anomalies: rejected.map((record) => ({
      severity: "high",
      signal: "commitment-rejected",
      explanation: `${record.playerId} failed to reveal a matching contribution or vote`
    })),
    replayHash
  });
}

function accept(
  state: GreaterGoodState,
  action: GreaterGoodAction,
  rng: DeterministicRng
): Resolution<GreaterGoodState> {
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
  state: GreaterGoodState,
  rng: DeterministicRng,
  error: string
): Resolution<GreaterGoodState> {
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
  state: GreaterGoodState,
  playerId: PlayerId,
  round: number
): CommitmentRecord | undefined {
  return state.commitments.find((record) => record.playerId === playerId && record.round === round);
}

function replaceCommitment(
  commitments: readonly CommitmentRecord[],
  replacement: CommitmentRecord
): CommitmentRecord[] {
  return commitments.map((record) => (record.id === replacement.id ? replacement : record));
}

function voteRound(round: number): number {
  return 10_000 + round;
}

function isValidContribution(input: ContributionReveal, coinsPerRound: number): boolean {
  return (
    Number.isInteger(input.tax) &&
    Number.isInteger(input.personal) &&
    input.tax >= 0 &&
    input.personal >= 0 &&
    input.tax + input.personal === coinsPerRound
  );
}

function parseConfig(config: RulesetConfig): GreaterGoodConfig & {
  players: PlayerId[];
  maxRounds: number;
  coinsPerRound: number;
} {
  if (config.players.length !== 5) {
    throw new Error("Greater Good MVP requires exactly five players");
  }
  return {
    gameId: config.gameId,
    seed: config.seed,
    players: config.players,
    maxRounds: typeof config.maxRounds === "number" ? config.maxRounds : defaultMaxRounds,
    coinsPerRound:
      typeof config.coinsPerRound === "number" ? config.coinsPerRound : defaultCoinsPerRound,
    archetypes: isArchetypeMap(config.archetypes) ? config.archetypes : undefined
  };
}

function isArchetypeMap(input: unknown): input is Record<PlayerId, GreaterGoodArchetype> {
  return typeof input === "object" && input !== null;
}
