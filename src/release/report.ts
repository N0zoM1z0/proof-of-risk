import manifest from "../../fixtures/replays/manifest.json";
import { runDeterministicSimulations } from "../ai/simulations";
import { exportDemoArtifacts } from "../verify/artifacts";
import { verifyReplayArtifact } from "../verify/verifier";

export type ReleaseReport = {
  replayFixtures: {
    seed: string;
    passed: boolean;
    expected: number;
    matched: number;
  };
  balance: ReturnType<typeof runDeterministicSimulations>;
  checks: string[];
};

export function buildReleaseReport(): ReleaseReport {
  const artifacts = exportDemoArtifacts(manifest.seed);
  const reports = artifacts.map(verifyReplayArtifact);
  const matched = manifest.artifacts.filter((fixture) =>
    reports.some(
      (report, index) =>
        artifacts[index]?.gameId === fixture.gameId &&
        artifacts[index]?.rulesetId === fixture.rulesetId &&
        report.replayHash === fixture.replayHash &&
        report.ok
    )
  ).length;

  return {
    replayFixtures: {
      seed: manifest.seed,
      passed: matched === manifest.artifacts.length,
      expected: manifest.artifacts.length,
      matched
    },
    balance: runDeterministicSimulations({
      seedPrefix: "release",
      iterations: 10,
      difficulty: "hard",
      archetypeId: "analyst"
    }),
    checks: [
      "virtual-currency-only",
      "original-ip-runtime",
      "deterministic-replay-fixtures",
      "zk-tooling-optional"
    ]
  };
}
