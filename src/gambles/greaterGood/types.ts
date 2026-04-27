import type { AuditReport } from "../../engine/audit";
import type { GameState, PlayerId, Settlement } from "../../engine/stateMachine";

export type GreaterGoodPhase =
  | "contributionCommit"
  | "contributionReveal"
  | "voteCommit"
  | "voteReveal"
  | "settled";

export type GreaterGoodArchetype = "cooperator" | "defector" | "dominator" | "auditor" | "chaos";

export type ContributionReveal = {
  tax: number;
  personal: number;
};

export type GreaterGoodPublicState = {
  players: PlayerId[];
  alivePlayers: PlayerId[];
  round: number;
  maxRounds: number;
  coinsPerRound: number;
  balances: Record<PlayerId, number>;
  archetypes: Record<PlayerId, GreaterGoodArchetype>;
  contributionCommits: PlayerId[];
  revealedContributions: Record<PlayerId, ContributionReveal>;
  roundTaxTotal: number;
  roundPublicReturn: number;
  voteCommits: PlayerId[];
  revealedVotes: Record<PlayerId, PlayerId>;
  eliminatedPlayers: PlayerId[];
  result?: Settlement;
  audit?: AuditReport;
};

export type GreaterGoodPrivateState = {
  lastContribution?: ContributionReveal;
  lastVote?: PlayerId;
};

export type GreaterGoodState = GameState<GreaterGoodPublicState, GreaterGoodPrivateState> & {
  phase: GreaterGoodPhase;
};

export type GreaterGoodAction =
  | {
      type: "COMMIT_CONTRIBUTION";
      playerId: PlayerId;
      payload: { commitment: string };
    }
  | {
      type: "REVEAL_CONTRIBUTION";
      playerId: PlayerId;
      payload: ContributionReveal & { salt: string };
    }
  | {
      type: "COMMIT_VOTE";
      playerId: PlayerId;
      payload: { commitment: string };
    }
  | {
      type: "REVEAL_VOTE";
      playerId: PlayerId;
      payload: { targetId: PlayerId; salt: string };
    };

export type GreaterGoodConfig = {
  gameId: string;
  seed: string;
  players: PlayerId[];
  maxRounds?: number;
  coinsPerRound?: number;
  archetypes?: Record<PlayerId, GreaterGoodArchetype>;
};
