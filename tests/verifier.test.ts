import { describe, expect, it } from "vitest";
import { exportDemoArtifacts } from "../src/verify/artifacts";
import { verifyGenesisReplay } from "../src/verify/genesisReplay";
import { verifyReplayArtifact } from "../src/verify/verifier";

describe("standalone replay verifier", () => {
  it("verifies exported demo artifacts", () => {
    const reports = exportDemoArtifacts("verify-seed").map(verifyReplayArtifact);

    expect(reports).toHaveLength(3);
    expect(reports.every((report) => report.ok)).toBe(true);
  });

  it("replays formal MVP rulesets from genesis", () => {
    const reports = exportDemoArtifacts("genesis-seed").map(verifyGenesisReplay);

    expect(reports).toHaveLength(3);
    expect(reports.every((report) => report.ok)).toBe(true);
    expect(reports.every((report) => report.replayedActionCount > 0)).toBe(true);
  });

  it("rejects tampered action log payloads", () => {
    const artifact = exportDemoArtifacts("tamper-seed")[0];
    if (!artifact) {
      throw new Error("missing artifact");
    }
    const tampered = {
      ...artifact,
      actionLog: artifact.actionLog.map((record, index) =>
        index === 0 ? { ...record, payload: { tampered: true } } : record
      )
    };
    const report = verifyReplayArtifact(tampered);

    expect(report.ok).toBe(false);
    expect(report.issues.map((issue) => issue.code)).toContain("REPLAY_HASH_MISMATCH");
    expect(report.issues.map((issue) => issue.code)).toContain("ACTION_LOG_HASH");
  });

  it("rejects tampered random log seeds", () => {
    const artifact = exportDemoArtifacts("random-tamper-seed")[0];
    if (!artifact) {
      throw new Error("missing artifact");
    }
    const tampered = {
      ...artifact,
      randomLog: artifact.randomLog.map((record, index) =>
        index === 0 ? { ...record, seed: "attacker-seed" } : record
      )
    };
    const report = verifyReplayArtifact(tampered);

    expect(report.ok).toBe(false);
    expect(report.issues.map((issue) => issue.code)).toContain("REPLAY_HASH_MISMATCH");
    expect(report.issues.map((issue) => issue.code)).toContain("RANDOM_LOG_SEED");
  });

  it("rejects deleted, reordered, or wrong-player genesis action streams", () => {
    const artifact = exportDemoArtifacts("genesis-tamper-seed")[0];
    if (!artifact) {
      throw new Error("missing artifact");
    }

    const deleted = verifyGenesisReplay({
      ...artifact,
      actionLog: artifact.actionLog.slice(1)
    });
    const reordered = verifyGenesisReplay({
      ...artifact,
      actionLog: [artifact.actionLog[1], artifact.actionLog[0], ...artifact.actionLog.slice(2)].filter(
        (record): record is (typeof artifact.actionLog)[number] => Boolean(record)
      )
    });
    const wrongPlayer = verifyGenesisReplay({
      ...artifact,
      actionLog: artifact.actionLog.map((record, index) =>
        index === 0 ? { ...record, playerId: "attacker" } : record
      )
    });

    expect(deleted.ok).toBe(false);
    expect(reordered.ok).toBe(false);
    expect(wrongPlayer.ok).toBe(false);
  });
});
