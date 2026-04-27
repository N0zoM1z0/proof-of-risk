import { stableHash } from "./canonical";
import type { ActionRecord } from "./actionLog";
import type { CommitmentRecord } from "./commitments";
import type { RandomRecord } from "./rng";

export type ReplayEnvelope = {
  version: 1;
  gameId: string;
  rulesetId: string;
  seed: string;
  initialStateHash?: string;
  actionLog: readonly ActionRecord[];
  randomLog: readonly RandomRecord[];
  commitments: readonly CommitmentRecord[];
  settlementHash?: string;
};

export function computeReplayHash(envelope: ReplayEnvelope): string {
  return stableHash(envelope);
}

export function createReplayEnvelope(input: Omit<ReplayEnvelope, "version">): ReplayEnvelope {
  return { version: 1, ...input };
}
