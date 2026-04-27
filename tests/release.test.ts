import { describe, expect, it } from "vitest";
import manifest from "../fixtures/replays/manifest.json";
import { buildReleaseReport } from "../src/release/report";
import { exportDemoArtifacts } from "../src/verify/artifacts";
import { verifyReplayArtifact } from "../src/verify/verifier";

describe("release hardening", () => {
  it("keeps regression replay fixtures stable", () => {
    const artifacts = exportDemoArtifacts(manifest.seed);
    const reports = artifacts.map(verifyReplayArtifact);

    expect(
      manifest.artifacts.map((fixture) => ({
        gameId: fixture.gameId,
        rulesetId: fixture.rulesetId,
        replayHash: fixture.replayHash
      }))
    ).toEqual(
      reports.map((report, index) => ({
        gameId: artifacts[index]?.gameId,
        rulesetId: artifacts[index]?.rulesetId,
        replayHash: report.replayHash
      }))
    );
    expect(reports.every((report) => report.ok)).toBe(true);
  });

  it("builds a passing release report", () => {
    const report = buildReleaseReport();

    expect(report.replayFixtures.passed).toBe(true);
    expect(report.balance.iterations).toBe(10);
    expect(report.checks).toContain("virtual-currency-only");
  });
});
