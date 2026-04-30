import { stableHash } from "../engine/canonical";
import { computeReplayHash } from "../engine/replay";
import type { ReplayArtifact } from "./artifacts";

export type VerificationIssue = {
  severity: "error" | "warning";
  code: string;
  message: string;
};

export type VerificationReport = {
  ok: boolean;
  replayHash: string;
  issues: VerificationIssue[];
};

export function verifyReplayArtifact(artifact: ReplayArtifact): VerificationReport {
  const issues: VerificationIssue[] = [];
  const { expectedReplayHash, genesisConfig: _genesisConfig, ...envelope } = artifact;
  const replayHash = computeReplayHash(envelope);

  if (replayHash !== expectedReplayHash) {
    issues.push({
      severity: "error",
      code: "REPLAY_HASH_MISMATCH",
      message: "Replay hash does not match the artifact's expected hash"
    });
  }

  artifact.randomLog.forEach((record, index) => {
    if (record.index !== index) {
      issues.push({
        severity: "error",
        code: "RANDOM_LOG_INDEX",
        message: `Random record ${index} has index ${record.index}`
      });
    }
    if (record.seed !== artifact.seed) {
      issues.push({
        severity: "error",
        code: "RANDOM_LOG_SEED",
        message: `Random record ${index} uses seed ${record.seed}`
      });
    }
  });

  artifact.actionLog.forEach((record, index) => {
    const prevHash = index === 0 ? "GENESIS" : artifact.actionLog[index - 1]?.hash;
    if (record.index !== index) {
      issues.push({
        severity: "error",
        code: "ACTION_LOG_INDEX",
        message: `Action record ${index} has index ${record.index}`
      });
    }
    if (record.prevHash !== prevHash) {
      issues.push({
        severity: "error",
        code: "ACTION_LOG_PREV_HASH",
        message: `Action record ${index} has invalid prevHash`
      });
    }
    const expectedHash = stableHash({
      gameId: record.gameId,
      playerId: record.playerId,
      type: record.type,
      payload: record.payload,
      turn: record.turn,
      index: record.index,
      prevHash: record.prevHash
    });
    if (record.hash !== expectedHash) {
      issues.push({
        severity: "error",
        code: "ACTION_LOG_HASH",
        message: `Action record ${index} hash is invalid`
      });
    }
  });

  artifact.commitments.forEach((record) => {
    if (record.status === "rejected") {
      issues.push({
        severity: "error",
        code: "COMMITMENT_REJECTED",
        message: `${record.playerId} has a rejected commitment`
      });
    }
  });

  if (!artifact.settlementHash) {
    issues.push({
      severity: "warning",
      code: "SETTLEMENT_HASH_MISSING",
      message: "Artifact does not include a settlement hash"
    });
  }

  return {
    ok: issues.every((issue) => issue.severity !== "error"),
    replayHash,
    issues
  };
}
