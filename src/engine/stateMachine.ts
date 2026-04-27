import type { AuditReport } from "./audit";
import type { ActionRecord } from "./actionLog";
import type { CommitmentRecord } from "./commitments";
import type { RandomRecord, DeterministicRng } from "./rng";

export type PlayerId = string;
export type Visibility = "public" | "ownerOnly" | "hiddenUntilReveal" | "auditOnly";

export type GameState<TPublic = unknown, TPrivate = unknown> = {
  gameId: string;
  rulesetId: string;
  phase: string;
  turn: number;
  publicState: TPublic;
  privateStateByPlayer: Record<PlayerId, TPrivate>;
  commitments: CommitmentRecord[];
  actionLog: ActionRecord[];
  randomLog: RandomRecord[];
  auditFlags: AuditReport["anomalies"];
};

export type RulesetConfig = {
  gameId: string;
  seed: string;
  players: PlayerId[];
  [key: string]: unknown;
};

export type Resolution<TState> = {
  state: TState;
  accepted: boolean;
  errors: string[];
};

export type Settlement = {
  terminal: boolean;
  winnerIds: PlayerId[];
  balanceDeltas: Record<PlayerId, number>;
  reason: string;
};

export interface GambleRuleset<TState, TAction> {
  id: string;
  init(config: RulesetConfig, rng: DeterministicRng): TState;
  getPublicView(state: TState, viewer: PlayerId): unknown;
  legalActions(state: TState, player: PlayerId): TAction[];
  applyAction(state: TState, action: TAction, rng: DeterministicRng): Resolution<TState>;
  isTerminal(state: TState): boolean;
  settle(state: TState): Settlement;
  audit(state: TState): AuditReport;
}
