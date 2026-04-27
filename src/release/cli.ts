import { buildReleaseReport } from "./report.ts";

const report = buildReleaseReport();
console.log(JSON.stringify(report, null, 2));

if (!report.replayFixtures.passed) {
  process.exitCode = 1;
}
