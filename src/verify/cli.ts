import { exportDemoArtifacts } from "./artifacts.ts";
import { verifyGenesisReplay } from "./genesisReplay.ts";
import { verifyReplayArtifact } from "./verifier.ts";

const seed = process.argv[2] ?? "verify-demo";
const reports = exportDemoArtifacts(seed).map((artifact) => ({
  gameId: artifact.gameId,
  rulesetId: artifact.rulesetId,
  artifact: verifyReplayArtifact(artifact),
  genesis: verifyGenesisReplay(artifact)
}));

console.log(JSON.stringify({ seed, reports }, null, 2));

if (reports.some((report) => !report.artifact.ok || !report.genesis.ok)) {
  process.exitCode = 1;
}
