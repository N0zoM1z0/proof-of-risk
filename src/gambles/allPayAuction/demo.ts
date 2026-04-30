import { DeterministicRng } from "../../engine/rng";
import type { PlayerId, Settlement } from "../../engine/stateMachine";
import { allPayAuctionRuleset, makeAllPayAuctionCommitment } from "./ruleset";
import type { AllPayAuctionState, AuctionBid } from "./types";

export type AllPayAuctionResult = {
  gameId: string;
  rulesetId: "all-pay-auction.v1";
  seed: string;
  players: PlayerId[];
  budgets: Record<PlayerId, number>;
  revealedBids: Record<PlayerId, number>;
  winnerId: PlayerId;
  votesAwarded: number;
  settlement: Settlement;
  commitments: AllPayAuctionState["commitments"];
  actionLog: AllPayAuctionState["actionLog"];
  randomLog: AllPayAuctionState["randomLog"];
  state: AllPayAuctionState;
};

const players = ["bidder:analyst", "bidder:dominator", "bidder:auditor"];
const budgets: Record<PlayerId, number> = {
  "bidder:analyst": 10,
  "bidder:dominator": 10,
  "bidder:auditor": 10
};

export function runAllPayAuctionDemo(seed: string): AllPayAuctionResult {
  const gameId = "all-pay-auction-demo";
  const rng = new DeterministicRng(seed);
  const aiRng = new DeterministicRng(`${seed}:ai`);
  const bidPlan = Object.fromEntries(
    players.map((playerId, index) => [
      playerId,
      {
        bid: Math.min(budgets[playerId] ?? 0, 2 + aiRng.nextInt(6, `auction.bidPlan:${index}`))
      }
    ])
  ) as Record<PlayerId, AuctionBid>;
  const salts = Object.fromEntries(players.map((playerId) => [playerId, saltFor(seed, playerId)]));
  let state = allPayAuctionRuleset.init(
    {
      gameId,
      seed,
      players,
      budgets,
      votesAwarded: 100
    },
    rng
  );

  for (const playerId of players) {
    const bid = bidPlan[playerId];
    const salt = salts[playerId];
    if (!bid || !salt) {
      throw new Error(`Missing sealed bid for ${playerId}`);
    }
    const commitment = makeAllPayAuctionCommitment(gameId, 1, playerId, bid, salt);
    state = applyOrThrow(state, {
      type: "COMMIT_BID",
      playerId,
      payload: { commitment }
    });
  }

  for (const playerId of players) {
    const bid = bidPlan[playerId];
    const salt = salts[playerId];
    if (!bid || !salt) {
      throw new Error(`Missing sealed bid reveal for ${playerId}`);
    }
    state = applyOrThrow(state, {
      type: "REVEAL_BID",
      playerId,
      payload: { ...bid, salt }
    });
  }

  if (!state.publicState.winnerId || !state.publicState.result) {
    throw new Error("All-pay auction demo did not settle");
  }

  return {
    gameId,
    rulesetId: "all-pay-auction.v1",
    seed,
    players,
    budgets,
    revealedBids: state.publicState.revealedBids,
    winnerId: state.publicState.winnerId,
    votesAwarded: state.publicState.votesAwarded,
    settlement: state.publicState.result,
    commitments: state.commitments,
    actionLog: state.actionLog,
    randomLog: state.randomLog,
    state
  };

  function applyOrThrow(stateBefore: AllPayAuctionState, action: Parameters<typeof allPayAuctionRuleset.applyAction>[1]) {
    const result = allPayAuctionRuleset.applyAction(stateBefore, action, rng);
    if (!result.accepted) {
      throw new Error(result.errors.join("; "));
    }
    return result.state;
  }
}

function saltFor(seed: string, playerId: PlayerId): string {
  return `all-pay:${seed}:${playerId}`;
}
