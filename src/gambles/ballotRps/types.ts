import type { AuditReport } from "../../engine/audit";
import type { GameState, PlayerId, Settlement } from "../../engine/stateMachine";

export type RpsMove = "rock" | "paper" | "scissors";

export type BallotRpsPhase = "voting" | "playCommit" | "playReveal" | "settled";

export type VoteCounts = Record<RpsMove, number>;

export type BallotRpsPublicState = {
  players: [PlayerId, PlayerId];
  voters: PlayerId[];
  voteCounts: VoteCounts;
  poolSize: number;
  revealedVotes: number;
  committedPlays: PlayerId[];
  revealedPlays: Partial<Record<PlayerId, RpsMove>>;
  result?: Settlement;
  audit?: AuditReport;
};

export type BallotRpsPrivateState = {
  hand: RpsMove[];
};

export type BallotRpsState = GameState<BallotRpsPublicState, BallotRpsPrivateState> & {
  phase: BallotRpsPhase;
};

export type BallotRpsAction =
  | {
      type: "COMMIT_VOTE";
      playerId: PlayerId;
      payload: {
        voterId: PlayerId;
        commitment: string;
      };
    }
  | {
      type: "REVEAL_VOTE";
      playerId: PlayerId;
      payload: {
        voterId: PlayerId;
        choice: RpsMove;
        salt: string;
      };
    }
  | {
      type: "COMMIT_PLAY";
      playerId: PlayerId;
      payload: {
        commitment: string;
      };
    }
  | {
      type: "REVEAL_PLAY";
      playerId: PlayerId;
      payload: {
        choice: RpsMove;
        salt: string;
      };
    };

export type BallotRpsConfig = {
  gameId: string;
  seed: string;
  players: [PlayerId, PlayerId];
  voters: PlayerId[];
  handSize?: number;
};

export const rpsMoves = ["rock", "paper", "scissors"] as const;

export function isRpsMove(input: unknown): input is RpsMove {
  return typeof input === "string" && (rpsMoves as readonly string[]).includes(input);
}

export function emptyVoteCounts(): VoteCounts {
  return { rock: 0, paper: 0, scissors: 0 };
}
