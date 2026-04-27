import { DeterministicRng } from "../../engine/rng";
import { chooseGreaterGoodContribution, chooseGreaterGoodVote } from "./ai";
import {
  greaterGoodRuleset,
  makeGreaterGoodContributionCommitment,
  makeGreaterGoodVoteCommitment
} from "./ruleset";
import type { GreaterGoodAction, GreaterGoodState } from "./types";

const players = ["player:auditor", "npc:defector", "npc:dominator", "npc:cooperator", "npc:chaos"];

export function runGreaterGoodDemo(seed: string) {
  const rng = new DeterministicRng(seed);
  let state = greaterGoodRuleset.init(
    {
      gameId: "greater-good-demo",
      seed,
      players,
      maxRounds: 2,
      coinsPerRound: 5
    },
    rng
  );
  const plannedContributions = new Map<string, ReturnType<typeof chooseGreaterGoodContribution>>();

  while (!greaterGoodRuleset.isTerminal(state)) {
    if (state.phase === "contributionCommit") {
      plannedContributions.clear();
      for (const playerId of state.publicState.alivePlayers) {
        const contribution = chooseGreaterGoodContribution(
          state.publicState.archetypes[playerId] ?? "cooperator",
          state.publicState.round,
          state.publicState.coinsPerRound,
          rng
        );
        plannedContributions.set(playerId, contribution);
        const salt = contributionSalt(seed, state.publicState.round, playerId);
        state = applyOrThrow(
          state,
          {
            type: "COMMIT_CONTRIBUTION",
            playerId,
            payload: {
              commitment: makeGreaterGoodContributionCommitment(
                state.gameId,
                state.publicState.round,
                playerId,
                contribution,
                salt
              )
            }
          },
          rng
        );
      }
      continue;
    }
    if (state.phase === "contributionReveal") {
      for (const playerId of state.publicState.alivePlayers) {
        const contribution = plannedContributions.get(playerId);
        if (!contribution) {
          throw new Error(`Missing planned contribution for ${playerId}`);
        }
        state = applyOrThrow(
          state,
          {
            type: "REVEAL_CONTRIBUTION",
            playerId,
            payload: {
              ...contribution,
              salt: contributionSalt(seed, state.publicState.round, playerId)
            }
          },
          rng
        );
      }
      continue;
    }
    if (state.phase === "voteCommit") {
      const targets = new Map<string, string>();
      for (const playerId of state.publicState.alivePlayers) {
        const targetId = chooseGreaterGoodVote(state, playerId);
        targets.set(playerId, targetId);
        const salt = voteSalt(seed, state.publicState.round, playerId);
        state = applyOrThrow(
          state,
          {
            type: "COMMIT_VOTE",
            playerId,
            payload: {
              commitment: makeGreaterGoodVoteCommitment(
                state.gameId,
                state.publicState.round,
                playerId,
                targetId,
                salt
              )
            }
          },
          rng
        );
      }
      for (const [playerId, targetId] of targets) {
        state = applyOrThrow(
          state,
          {
            type: "REVEAL_VOTE",
            playerId,
            payload: {
              targetId,
              salt: voteSalt(seed, state.publicState.round, playerId)
            }
          },
          rng
        );
      }
    }
  }

  return {
    state,
    publicView: greaterGoodRuleset.getPublicView(state, players[0] ?? "player:auditor")
  };
}

function applyOrThrow(
  state: GreaterGoodState,
  action: GreaterGoodAction,
  rng: DeterministicRng
): GreaterGoodState {
  const resolution = greaterGoodRuleset.applyAction(state, action, rng);
  if (!resolution.accepted) {
    throw new Error(resolution.errors.join("; "));
  }
  return resolution.state;
}

function contributionSalt(seed: string, round: number, playerId: string): string {
  return `greater-good:contribution:${seed}:${round}:${playerId}`;
}

function voteSalt(seed: string, round: number, playerId: string): string {
  return `greater-good:vote:${seed}:${round}:${playerId}`;
}
