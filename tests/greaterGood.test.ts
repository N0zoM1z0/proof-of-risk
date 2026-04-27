import { describe, expect, it } from "vitest";
import { DeterministicRng } from "../src/engine/rng";
import { runGreaterGoodDemo } from "../src/gambles/greaterGood/demo";
import {
  greaterGoodRuleset,
  makeGreaterGoodContributionCommitment,
  makeGreaterGoodVoteCommitment
} from "../src/gambles/greaterGood/ruleset";
import type { GreaterGoodAction, GreaterGoodState } from "../src/gambles/greaterGood/types";

describe("greater Good ruleset", () => {
  it("plays a deterministic five-player game to settlement", () => {
    const first = runGreaterGoodDemo("good-seed");
    const second = runGreaterGoodDemo("good-seed");

    expect(first.state.phase).toBe("settled");
    expect(first.state.publicState.audit?.fairness).toEqual({
      randomVerified: true,
      commitmentsVerified: true,
      settlementVerified: true
    });
    expect(first.state.publicState.audit?.replayHash).toBe(second.state.publicState.audit?.replayHash);
    expect(first.state.publicState.eliminatedPlayers.length).toBeGreaterThan(0);
  });

  it("changes replay hash when seed changes", () => {
    const first = runGreaterGoodDemo("good-seed-a");
    const second = runGreaterGoodDemo("good-seed-b");

    expect(first.state.publicState.audit?.replayHash).not.toBe(second.state.publicState.audit?.replayHash);
  });

  it("rejects invalid contribution ranges", () => {
    const rng = new DeterministicRng("invalid-contribution");
    let state = greaterGoodRuleset.init(
      {
        gameId: "invalid-contribution",
        seed: "invalid-contribution",
        players: ["p1", "p2", "p3", "p4", "p5"]
      },
      rng
    );
    for (const playerId of state.publicState.alivePlayers) {
      state = applyAccepted(state, rng, {
        type: "COMMIT_CONTRIBUTION",
        playerId,
        payload: {
          commitment: makeGreaterGoodContributionCommitment(
            state.gameId,
            state.publicState.round,
            playerId,
            { tax: 3, personal: 2 },
            `salt-${playerId}`
          )
        }
      });
    }

    const rejected = greaterGoodRuleset.applyAction(
      state,
      {
        type: "REVEAL_CONTRIBUTION",
        playerId: "p1",
        payload: { tax: 6, personal: 0, salt: "salt-p1" }
      },
      rng
    );

    expect(rejected.accepted).toBe(false);
    expect(rejected.errors).toContain("Contribution must satisfy tax + personal = coins per round");
  });

  it("tracks elimination in the demo flow", () => {
    const demo = runGreaterGoodDemo("vote-baseline");
    expect(demo.state.publicState.eliminatedPlayers).not.toContain("player:auditor");
  });

  it("rejects self elimination votes", () => {
    const rng = new DeterministicRng("self-vote");
    let state = advanceToVoteCommit(rng, "self-vote");
    for (const playerId of state.publicState.alivePlayers) {
      const targetId = "p1";
      state = applyAccepted(state, rng, {
        type: "COMMIT_VOTE",
        playerId,
        payload: {
          commitment: makeGreaterGoodVoteCommitment(
            state.gameId,
            state.publicState.round,
            playerId,
            targetId,
            `vote-${playerId}`
          )
        }
      });
    }

    const rejected = greaterGoodRuleset.applyAction(
      state,
      {
        type: "REVEAL_VOTE",
        playerId: "p1",
        payload: { targetId: "p1", salt: "vote-p1" }
      },
      rng
    );

    expect(rejected.accepted).toBe(false);
    expect(rejected.errors).toContain("Players cannot vote for themselves");
  });
});

function advanceToVoteCommit(rng: DeterministicRng, seed: string): GreaterGoodState {
  let state = greaterGoodRuleset.init(
    {
      gameId: seed,
      seed,
      players: ["p1", "p2", "p3", "p4", "p5"],
      maxRounds: 1
    },
    rng
  );
  for (const playerId of state.publicState.alivePlayers) {
    state = applyAccepted(state, rng, {
      type: "COMMIT_CONTRIBUTION",
      playerId,
      payload: {
        commitment: makeGreaterGoodContributionCommitment(
          state.gameId,
          state.publicState.round,
          playerId,
          { tax: 3, personal: 2 },
          `contribution-${playerId}`
        )
      }
    });
  }
  for (const playerId of state.publicState.alivePlayers) {
    state = applyAccepted(state, rng, {
      type: "REVEAL_CONTRIBUTION",
      playerId,
      payload: { tax: 3, personal: 2, salt: `contribution-${playerId}` }
    });
  }
  expect(state.phase).toBe("voteCommit");
  return state;
}

function applyAccepted(
  state: GreaterGoodState,
  rng: DeterministicRng,
  action: GreaterGoodAction
): GreaterGoodState {
  const resolution = greaterGoodRuleset.applyAction(state, action, rng);
  expect(resolution.accepted).toBe(true);
  return resolution.state;
}
