import { runAllPayAuctionDemo } from "../gambles/allPayAuction/demo";
import { runBallotRpsDemo } from "../gambles/ballotRps/demo";
import { runGreaterGoodDemo } from "../gambles/greaterGood/demo";
import { runNontransitiveDiceDemo } from "../gambles/nontransitiveDice/demo";
import { runZeroNimDemo } from "../gambles/zeroNim/demo";
import { createReplayEnvelope, computeReplayHash, type ReplayEnvelope } from "../engine/replay";
import type { ActionRecord } from "../engine/actionLog";
import type { CommitmentRecord } from "../engine/commitments";
import type { RandomRecord } from "../engine/rng";
import type { RulesetConfig } from "../engine/stateMachine";

export type ReplayArtifact = ReplayEnvelope & {
  expectedReplayHash: string;
  genesisConfig: RulesetConfig;
};

export function createReplayArtifact(input: {
  gameId: string;
  rulesetId: string;
  seed: string;
  genesisConfig: RulesetConfig;
  actionLog: readonly ActionRecord[];
  randomLog: readonly RandomRecord[];
  commitments: readonly CommitmentRecord[];
  settlementHash?: string;
}): ReplayArtifact {
  const { genesisConfig, ...replayInput } = input;
  const envelope = createReplayEnvelope(replayInput);
  return {
    ...envelope,
    genesisConfig,
    expectedReplayHash: computeReplayHash(envelope)
  };
}

export function exportDemoArtifacts(seed: string): ReplayArtifact[] {
  const ballot = runBallotRpsDemo(seed, "paper").state;
  const nim = runZeroNimDemo(seed, 3).state;
  const good = runGreaterGoodDemo(seed).state;
  const auction = runAllPayAuctionDemo(seed).state;
  const dice = runNontransitiveDiceDemo(seed, "ember").state;
  return [
    createReplayArtifact({
      gameId: ballot.gameId,
      rulesetId: ballot.rulesetId,
      seed,
      genesisConfig: {
        gameId: ballot.gameId,
        seed,
        players: ballot.publicState.players,
        voters: ballot.publicState.voters
      },
      actionLog: ballot.actionLog,
      randomLog: ballot.randomLog,
      commitments: ballot.commitments,
      settlementHash: ballot.publicState.result ? JSON.stringify(ballot.publicState.result) : undefined
    }),
    createReplayArtifact({
      gameId: nim.gameId,
      rulesetId: nim.rulesetId,
      seed,
      genesisConfig: {
        gameId: nim.gameId,
        seed,
        players: nim.publicState.players,
        threshold: nim.publicState.threshold,
        handSize: 4
      },
      actionLog: nim.actionLog,
      randomLog: nim.randomLog,
      commitments: nim.commitments,
      settlementHash: nim.publicState.result ? JSON.stringify(nim.publicState.result) : undefined
    }),
    createReplayArtifact({
      gameId: good.gameId,
      rulesetId: good.rulesetId,
      seed,
      genesisConfig: {
        gameId: good.gameId,
        seed,
        players: good.publicState.players,
        maxRounds: good.publicState.maxRounds,
        coinsPerRound: good.publicState.coinsPerRound,
        archetypes: good.publicState.archetypes
      },
      actionLog: good.actionLog,
      randomLog: good.randomLog,
      commitments: good.commitments,
      settlementHash: good.publicState.result ? JSON.stringify(good.publicState.result) : undefined
    }),
    createReplayArtifact({
      gameId: auction.gameId,
      rulesetId: auction.rulesetId,
      seed,
      genesisConfig: {
        gameId: auction.gameId,
        seed,
        players: auction.publicState.players,
        budgets: auction.publicState.budgets,
        votesAwarded: auction.publicState.votesAwarded
      },
      actionLog: auction.actionLog,
      randomLog: auction.randomLog,
      commitments: auction.commitments,
      settlementHash: auction.publicState.result ? JSON.stringify(auction.publicState.result) : undefined
    }),
    createReplayArtifact({
      gameId: dice.gameId,
      rulesetId: dice.rulesetId,
      seed,
      genesisConfig: {
        gameId: dice.gameId,
        seed,
        players: dice.publicState.players,
        roundCount: dice.publicState.roundCount
      },
      actionLog: dice.actionLog,
      randomLog: dice.randomLog,
      commitments: dice.commitments,
      settlementHash: dice.publicState.result ? JSON.stringify(dice.publicState.result) : undefined
    })
  ];
}
