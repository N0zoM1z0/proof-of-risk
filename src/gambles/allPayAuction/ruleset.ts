import { appendAction } from "../../engine/actionLog";
import { createAuditReport } from "../../engine/audit";
import { createCommitment, revealCommitment, type CommitmentRecord } from "../../engine/commitments";
import type { DeterministicRng } from "../../engine/rng";
import { computeReplayHash, createReplayEnvelope } from "../../engine/replay";
import type { GambleRuleset, PlayerId, Resolution, RulesetConfig, Settlement } from "../../engine/stateMachine";
import type {
  AllPayAuctionAction,
  AllPayAuctionConfig,
  AllPayAuctionPrivateState,
  AllPayAuctionState,
  AuctionBid
} from "./types";

const rulesetId = "all-pay-auction.v1";
const defaultBudget = 10;
const defaultVotesAwarded = 100;

export const allPayAuctionRuleset: GambleRuleset<AllPayAuctionState, AllPayAuctionAction> = {
  id: rulesetId,

  init(config: RulesetConfig, rng: DeterministicRng): AllPayAuctionState {
    const parsed = parseConfig(config);
    return {
      gameId: parsed.gameId,
      rulesetId,
      phase: "bidCommit",
      turn: 0,
      publicState: {
        players: parsed.players,
        budgets: parsed.budgets,
        votesAwarded: parsed.votesAwarded,
        committedBidders: [],
        revealedBids: {}
      },
      privateStateByPlayer: Object.fromEntries(
        parsed.players.map((playerId) => [playerId, {} satisfies AllPayAuctionPrivateState])
      ),
      commitments: [],
      actionLog: [],
      randomLog: [...rng.randomLog],
      auditFlags: []
    };
  },

  getPublicView(state: AllPayAuctionState, viewer: PlayerId) {
    return {
      gameId: state.gameId,
      rulesetId: state.rulesetId,
      phase: state.phase,
      turn: state.turn,
      publicState: state.publicState,
      viewerPrivate: state.privateStateByPlayer[viewer] ?? {}
    };
  },

  legalActions(state: AllPayAuctionState, player: PlayerId): AllPayAuctionAction[] {
    if (!state.publicState.players.includes(player)) {
      return [];
    }
    if (state.phase === "bidCommit" && !state.publicState.committedBidders.includes(player)) {
      return [{ type: "COMMIT_BID", playerId: player, payload: { commitment: "<commitment>" } }];
    }
    if (state.phase === "bidReveal" && state.publicState.revealedBids[player] === undefined) {
      return [{ type: "REVEAL_BID", playerId: player, payload: { bid: 0, salt: "<salt>" } }];
    }
    return [];
  },

  applyAction(
    state: AllPayAuctionState,
    action: AllPayAuctionAction,
    rng: DeterministicRng
  ): Resolution<AllPayAuctionState> {
    switch (action.type) {
      case "COMMIT_BID":
        return commitBid(state, action, rng);
      case "REVEAL_BID":
        return revealBid(state, action, rng);
      default:
        return reject(state, rng, "Unsupported action");
    }
  },

  isTerminal(state: AllPayAuctionState): boolean {
    return state.phase === "settled";
  },

  settle(state: AllPayAuctionState): Settlement {
    return (
      state.publicState.result ?? {
        terminal: false,
        winnerIds: [],
        balanceDeltas: {},
        reason: "Auction is not settled"
      }
    );
  },

  audit(state: AllPayAuctionState) {
    return buildAudit(state);
  }
};

export function makeAllPayAuctionCommitment(
  gameId: string,
  round: number,
  playerId: PlayerId,
  bid: AuctionBid,
  salt: string
): string {
  return createCommitment(bid, salt, { gameId, round, playerId });
}

function commitBid(
  state: AllPayAuctionState,
  action: Extract<AllPayAuctionAction, { type: "COMMIT_BID" }>,
  rng: DeterministicRng
): Resolution<AllPayAuctionState> {
  if (state.phase !== "bidCommit") {
    return reject(state, rng, "Bids can only be committed during bidCommit");
  }
  if (!state.publicState.players.includes(action.playerId)) {
    return reject(state, rng, "Unknown bidder");
  }
  if (findCommitment(state, action.playerId)) {
    return reject(state, rng, "Bidder already committed");
  }

  const commitment: CommitmentRecord<AuctionBid> = {
    id: action.payload.commitment,
    gameId: state.gameId,
    round: 1,
    playerId: action.playerId,
    commitment: action.payload.commitment,
    scheme: "sha256-canonical-v1",
    status: "committed",
    createdAtTurn: state.turn
  };
  const committedBidders = [...state.publicState.committedBidders, action.playerId];
  return accept(
    {
      ...state,
      phase: committedBidders.length === state.publicState.players.length ? "bidReveal" : state.phase,
      commitments: [...state.commitments, commitment],
      publicState: {
        ...state.publicState,
        committedBidders
      }
    },
    action,
    rng
  );
}

function revealBid(
  state: AllPayAuctionState,
  action: Extract<AllPayAuctionAction, { type: "REVEAL_BID" }>,
  rng: DeterministicRng
): Resolution<AllPayAuctionState> {
  if (state.phase !== "bidReveal") {
    return reject(state, rng, "Bids can only be revealed after all commitments");
  }
  if (!state.publicState.players.includes(action.playerId)) {
    return reject(state, rng, "Unknown bidder");
  }
  if (!isValidBid(action.payload.bid, state.publicState.budgets[action.playerId])) {
    return reject(state, rng, "Bid must be an integer within the bidder budget");
  }
  if (state.publicState.revealedBids[action.playerId] !== undefined) {
    return reject(state, rng, "Bidder already revealed");
  }
  const commitment = findCommitment(state, action.playerId);
  if (!commitment) {
    return reject(state, rng, "Bid commitment not found");
  }
  if (commitment.status !== "committed") {
    return reject(state, rng, "Bid commitment already revealed");
  }

  const bid = { bid: action.payload.bid };
  const revealed = revealCommitment(commitment, bid, action.payload.salt, state.turn);
  if (revealed.status !== "revealed") {
    return reject(
      {
        ...state,
        commitments: replaceCommitment(state.commitments, revealed)
      },
      rng,
      "Bid reveal does not match commitment"
    );
  }

  const revealedBids = {
    ...state.publicState.revealedBids,
    [action.playerId]: action.payload.bid
  };
  const accepted = accept(
    {
      ...state,
      commitments: replaceCommitment(state.commitments, revealed),
      publicState: {
        ...state.publicState,
        revealedBids
      }
    },
    action,
    rng
  ).state;

  if (Object.keys(revealedBids).length === state.publicState.players.length) {
    return { state: finalize(accepted), accepted: true, errors: [] };
  }
  return { state: accepted, accepted: true, errors: [] };
}

function finalize(state: AllPayAuctionState): AllPayAuctionState {
  const winnerId = [...state.publicState.players].sort((left, right) => {
    const bidDelta = (state.publicState.revealedBids[right] ?? 0) - (state.publicState.revealedBids[left] ?? 0);
    return bidDelta !== 0 ? bidDelta : left.localeCompare(right);
  })[0];
  if (!winnerId) {
    return state;
  }
  const result: Settlement = {
    terminal: true,
    winnerIds: [winnerId],
    balanceDeltas: Object.fromEntries(
      state.publicState.players.map((playerId) => [playerId, -(state.publicState.revealedBids[playerId] ?? 0)])
    ),
    reason: `${winnerId} wins ${state.publicState.votesAwarded} votes; every bidder pays their sealed bid`
  };
  const settled: AllPayAuctionState = {
    ...state,
    phase: "settled",
    publicState: {
      ...state.publicState,
      winnerId,
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

function buildAudit(state: AllPayAuctionState) {
  const anomalies = state.commitments
    .filter((record) => record.status === "rejected")
    .map((record) => ({
      severity: "high" as const,
      signal: "commitment-rejected",
      explanation: `${record.playerId} failed to reveal a matching all-pay bid`
    }));
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
  state: AllPayAuctionState,
  action: AllPayAuctionAction,
  rng: DeterministicRng
): Resolution<AllPayAuctionState> {
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

function reject(state: AllPayAuctionState, rng: DeterministicRng, error: string): Resolution<AllPayAuctionState> {
  return {
    state: {
      ...state,
      randomLog: [...rng.randomLog]
    },
    accepted: false,
    errors: [error]
  };
}

function findCommitment(state: AllPayAuctionState, playerId: PlayerId): CommitmentRecord<AuctionBid> | undefined {
  return state.commitments.find(
    (record): record is CommitmentRecord<AuctionBid> => record.playerId === playerId && record.round === 1
  );
}

function replaceCommitment(
  commitments: readonly CommitmentRecord[],
  replacement: CommitmentRecord
): CommitmentRecord[] {
  return commitments.map((record) => (record.id === replacement.id ? replacement : record));
}

function isValidBid(bid: number, budget: number | undefined): boolean {
  return Number.isInteger(bid) && bid >= 0 && budget !== undefined && bid <= budget;
}

function parseConfig(config: RulesetConfig): Required<AllPayAuctionConfig> {
  if (config.players.length < 2 || config.players.length > 8) {
    throw new Error("All-pay auction requires between two and eight bidders");
  }
  const budgetsInput = isBudgetMap(config.budgets) ? config.budgets : {};
  const budgets = Object.fromEntries(
    config.players.map((playerId) => {
      const budget = budgetsInput[playerId] ?? defaultBudget;
      if (!Number.isInteger(budget) || budget < 0 || budget > 1000) {
        throw new Error("All-pay auction budgets must be integers between 0 and 1000");
      }
      return [playerId, budget];
    })
  );
  const votesAwarded = typeof config.votesAwarded === "number" ? config.votesAwarded : defaultVotesAwarded;
  if (!Number.isInteger(votesAwarded) || votesAwarded <= 0) {
    throw new Error("All-pay auction votesAwarded must be a positive integer");
  }
  return {
    gameId: config.gameId,
    seed: config.seed,
    players: config.players,
    budgets,
    votesAwarded
  };
}

function isBudgetMap(value: unknown): value is Record<PlayerId, number> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
