import { appendAction, type ActionRecord } from "../../engine/actionLog";
import { createCommitment, revealCommitment, type CommitmentRecord } from "../../engine/commitments";
import { DeterministicRng, type RandomRecord } from "../../engine/rng";
import type { PlayerId, Settlement } from "../../engine/stateMachine";

export type AuctionBid = {
  bid: number;
};

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
  commitments: CommitmentRecord<AuctionBid>[];
  actionLog: ActionRecord[];
  randomLog: RandomRecord[];
};

const players = ["bidder:analyst", "bidder:dominator", "bidder:auditor"];
const budgets: Record<PlayerId, number> = {
  "bidder:analyst": 10,
  "bidder:dominator": 10,
  "bidder:auditor": 10
};

export function runAllPayAuctionDemo(seed: string): AllPayAuctionResult {
  const rng = new DeterministicRng(seed);
  const gameId = "all-pay-auction-demo";
  const bidPlan = Object.fromEntries(
    players.map((playerId, index) => [
      playerId,
      {
        bid: Math.min(budgets[playerId] ?? 0, 2 + rng.nextInt(6, `auction.bidPlan:${index}`))
      }
    ])
  ) as Record<PlayerId, AuctionBid>;
  let actionLog: ActionRecord[] = [];
  const commitments: CommitmentRecord<AuctionBid>[] = [];

  for (const playerId of players) {
    const salt = saltFor(seed, playerId);
    const commitment = createCommitment(bidPlan[playerId], salt, { gameId, round: 1, playerId });
    commitments.push({
      id: commitment,
      gameId,
      round: 1,
      playerId,
      commitment,
      scheme: "sha256-canonical-v1",
      status: "committed",
      createdAtTurn: actionLog.length
    });
    actionLog = [
      ...actionLog,
      appendAction(actionLog, {
        gameId,
        playerId,
        type: "COMMIT_BID",
        payload: { commitment },
        turn: actionLog.length
      })
    ];
  }

  const revealedBids: Record<PlayerId, number> = {};
  const revealedCommitments = commitments.map((record) => {
    const bid = bidPlan[record.playerId];
    if (!bid) {
      throw new Error(`Missing bid for ${record.playerId}`);
    }
    const revealed = revealCommitment(record, bid, saltFor(seed, record.playerId), actionLog.length);
    if (revealed.status !== "revealed") {
      throw new Error(`Bid reveal failed for ${record.playerId}`);
    }
    revealedBids[record.playerId] = bid.bid;
    actionLog = [
      ...actionLog,
      appendAction(actionLog, {
        gameId,
        playerId: record.playerId,
        type: "REVEAL_BID",
        payload: bid,
        turn: actionLog.length
      })
    ];
    return revealed;
  });

  const winnerId = [...players].sort((left, right) => {
    const bidDelta = (revealedBids[right] ?? 0) - (revealedBids[left] ?? 0);
    return bidDelta !== 0 ? bidDelta : left.localeCompare(right);
  })[0] as PlayerId;
  const settlement: Settlement = {
    terminal: true,
    winnerIds: [winnerId],
    balanceDeltas: Object.fromEntries(players.map((playerId) => [playerId, -(revealedBids[playerId] ?? 0)])),
    reason: `${winnerId} wins 100 votes; every bidder pays their sealed bid`
  };

  return {
    gameId,
    rulesetId: "all-pay-auction.v1",
    seed,
    players,
    budgets,
    revealedBids,
    winnerId,
    votesAwarded: 100,
    settlement,
    commitments: revealedCommitments,
    actionLog,
    randomLog: [...rng.randomLog]
  };
}

function saltFor(seed: string, playerId: PlayerId): string {
  return `all-pay:${seed}:${playerId}`;
}
