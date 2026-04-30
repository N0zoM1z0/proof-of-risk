import type { GambleRuleset } from "../engine/stateMachine";
import { DeterministicRng } from "../engine/rng";
import { ballotRpsRuleset } from "../gambles/ballotRps/ruleset";
import type { BallotRpsAction, BallotRpsState } from "../gambles/ballotRps/types";
import { greaterGoodRuleset } from "../gambles/greaterGood/ruleset";
import type { GreaterGoodAction, GreaterGoodState } from "../gambles/greaterGood/types";
import { zeroNimRuleset } from "../gambles/zeroNim/ruleset";
import type { ZeroNimAction, ZeroNimState } from "../gambles/zeroNim/types";
import { createReplayArtifact, type ReplayArtifact } from "./artifacts";
import { verifyReplayArtifact, type VerificationReport, type VerificationIssue } from "./verifier";

export type GenesisReplayReport = VerificationReport & {
  rulesetId: string;
  replayedActionCount: number;
};

type FormalRuleset =
  | GambleRuleset<BallotRpsState, BallotRpsAction>
  | GambleRuleset<ZeroNimState, ZeroNimAction>
  | GambleRuleset<GreaterGoodState, GreaterGoodAction>;

export function verifyGenesisReplay(artifact: ReplayArtifact): GenesisReplayReport {
  const ruleset = selectRuleset(artifact.rulesetId);
  if (!ruleset) {
    return {
      ok: false,
      rulesetId: artifact.rulesetId,
      replayedActionCount: 0,
      replayHash: "",
      issues: [
        {
          severity: "error",
          code: "UNSUPPORTED_RULESET",
          message: `No genesis replay adapter exists for ${artifact.rulesetId}`
        }
      ]
    };
  }

  const rng = new DeterministicRng(artifact.seed);
  let state = ruleset.init(artifact.genesisConfig, rng) as BallotRpsState | ZeroNimState | GreaterGoodState;
  const issues: VerificationIssue[] = [];

  for (const record of artifact.actionLog) {
    const resolution = applyRecord(ruleset, state, record, rng);
    if (!resolution.accepted) {
      issues.push({
        severity: "error",
        code: "GENESIS_REPLAY_ACTION_REJECTED",
        message: `Action ${record.index} ${record.type} was rejected: ${resolution.errors.join("; ")}`
      });
      break;
    }
    state = resolution.state;
  }

  if (issues.length > 0) {
    return {
      ok: false,
      rulesetId: artifact.rulesetId,
      replayedActionCount: state.actionLog.length,
      replayHash: "",
      issues
    };
  }

  const replayed = createReplayArtifact({
    gameId: state.gameId,
    rulesetId: state.rulesetId,
    seed: artifact.seed,
    genesisConfig: artifact.genesisConfig,
    actionLog: state.actionLog,
    randomLog: state.randomLog,
    commitments: state.commitments,
    settlementHash: state.publicState.result ? JSON.stringify(state.publicState.result) : undefined
  });
  const artifactReport = verifyReplayArtifact(artifact);
  const replayedReport = verifyReplayArtifact(replayed);
  issues.push(...artifactReport.issues, ...replayedReport.issues);

  if (replayed.expectedReplayHash !== artifact.expectedReplayHash) {
    issues.push({
      severity: "error",
      code: "GENESIS_REPLAY_HASH_MISMATCH",
      message: "Genesis replay produced a different replay hash"
    });
  }
  if (replayed.settlementHash !== artifact.settlementHash) {
    issues.push({
      severity: "error",
      code: "GENESIS_SETTLEMENT_MISMATCH",
      message: "Genesis replay produced a different settlement artifact"
    });
  }

  return {
    ok: issues.every((issue) => issue.severity !== "error"),
    rulesetId: artifact.rulesetId,
    replayedActionCount: state.actionLog.length,
    replayHash: replayed.expectedReplayHash,
    issues
  };
}

function selectRuleset(rulesetId: string): FormalRuleset | undefined {
  if (rulesetId === ballotRpsRuleset.id) {
    return ballotRpsRuleset;
  }
  if (rulesetId === zeroNimRuleset.id) {
    return zeroNimRuleset;
  }
  if (rulesetId === greaterGoodRuleset.id) {
    return greaterGoodRuleset;
  }
  return undefined;
}

function applyRecord(
  ruleset: FormalRuleset,
  state: BallotRpsState | ZeroNimState | GreaterGoodState,
  record: ReplayArtifact["actionLog"][number],
  rng: DeterministicRng
) {
  const action = {
    type: record.type,
    playerId: record.playerId,
    payload: record.payload
  };
  return (ruleset as GambleRuleset<typeof state, typeof action>).applyAction(state, action, rng);
}
