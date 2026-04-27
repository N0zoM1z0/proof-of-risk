import { runBallotRpsDemo } from "../gambles/ballotRps/demo";
import { runGreaterGoodDemo } from "../gambles/greaterGood/demo";
import { runZeroNimDemo } from "../gambles/zeroNim/demo";
import { createReplayEnvelope, computeReplayHash, type ReplayEnvelope } from "../engine/replay";
import type { ActionRecord } from "../engine/actionLog";
import type { CommitmentRecord } from "../engine/commitments";
import type { RandomRecord } from "../engine/rng";

export type ReplayArtifact = ReplayEnvelope & {
  expectedReplayHash: string;
};

export function createReplayArtifact(input: {
  gameId: string;
  rulesetId: string;
  seed: string;
  actionLog: readonly ActionRecord[];
  randomLog: readonly RandomRecord[];
  commitments: readonly CommitmentRecord[];
  settlementHash?: string;
}): ReplayArtifact {
  const envelope = createReplayEnvelope(input);
  return {
    ...envelope,
    expectedReplayHash: computeReplayHash(envelope)
  };
}

export function exportDemoArtifacts(seed: string): ReplayArtifact[] {
  const ballot = runBallotRpsDemo(seed, "paper").state;
  const nim = runZeroNimDemo(seed, 3).state;
  const good = runGreaterGoodDemo(seed).state;
  return [
    createReplayArtifact({
      gameId: ballot.gameId,
      rulesetId: ballot.rulesetId,
      seed,
      actionLog: ballot.actionLog,
      randomLog: ballot.randomLog,
      commitments: ballot.commitments,
      settlementHash: ballot.publicState.result ? JSON.stringify(ballot.publicState.result) : undefined
    }),
    createReplayArtifact({
      gameId: nim.gameId,
      rulesetId: nim.rulesetId,
      seed,
      actionLog: nim.actionLog,
      randomLog: nim.randomLog,
      commitments: nim.commitments,
      settlementHash: nim.publicState.result ? JSON.stringify(nim.publicState.result) : undefined
    }),
    createReplayArtifact({
      gameId: good.gameId,
      rulesetId: good.rulesetId,
      seed,
      actionLog: good.actionLog,
      randomLog: good.randomLog,
      commitments: good.commitments,
      settlementHash: good.publicState.result ? JSON.stringify(good.publicState.result) : undefined
    })
  ];
}
