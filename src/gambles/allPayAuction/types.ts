import type { AuditReport } from "../../engine/audit";
import type { GameState, PlayerId, Settlement } from "../../engine/stateMachine";

export type AllPayAuctionPhase = "bidCommit" | "bidReveal" | "settled";

export type AuctionBid = {
  bid: number;
};

export type AllPayAuctionPublicState = {
  players: PlayerId[];
  budgets: Record<PlayerId, number>;
  votesAwarded: number;
  committedBidders: PlayerId[];
  revealedBids: Record<PlayerId, number>;
  winnerId?: PlayerId;
  result?: Settlement;
  audit?: AuditReport;
};

export type AllPayAuctionPrivateState = Record<string, never>;

export type AllPayAuctionState = GameState<AllPayAuctionPublicState, AllPayAuctionPrivateState> & {
  phase: AllPayAuctionPhase;
};

export type AllPayAuctionAction =
  | {
      type: "COMMIT_BID";
      playerId: PlayerId;
      payload: { commitment: string };
    }
  | {
      type: "REVEAL_BID";
      playerId: PlayerId;
      payload: AuctionBid & { salt: string };
    };

export type AllPayAuctionConfig = {
  gameId: string;
  seed: string;
  players: PlayerId[];
  budgets?: Record<PlayerId, number>;
  votesAwarded?: number;
};
