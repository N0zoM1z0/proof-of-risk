import { describe, expect, it } from "vitest";
import { DeterministicRng } from "../src/engine/rng";
import { runBallotRpsDemo } from "../src/gambles/ballotRps/demo";
import { ballotRpsRuleset, makeBallotRpsCommitment } from "../src/gambles/ballotRps/ruleset";
import type { BallotRpsAction } from "../src/gambles/ballotRps/types";

describe("ballot RPS ruleset", () => {
  it("plays a complete deterministic match with verified audit output", () => {
    const first = runBallotRpsDemo("seed-a", "paper");
    const second = runBallotRpsDemo("seed-a", "paper");

    expect(first.state.phase).toBe("settled");
    expect(first.state.publicState.audit?.fairness).toEqual({
      randomVerified: true,
      commitmentsVerified: true,
      settlementVerified: true
    });
    expect(first.state.publicState.audit?.replayHash).toBe(second.state.publicState.audit?.replayHash);
    expect(first.state.randomLog.length).toBeGreaterThan(0);
  });

  it("changes replay hash when seed changes", () => {
    const first = runBallotRpsDemo("seed-a", "paper");
    const second = runBallotRpsDemo("seed-b", "paper");

    expect(first.state.publicState.audit?.replayHash).not.toBe(second.state.publicState.audit?.replayHash);
  });

  it("rejects play reveals outside the player's hand", () => {
    const rng = new DeterministicRng("illegal-reveal");
    const voters = ["v1", "v2", "v3", "v4", "v5", "v6"];
    let state = ballotRpsRuleset.init(
      {
        gameId: "illegal-game",
        seed: "illegal-reveal",
        players: ["p1", "p2"],
        voters
      },
      rng
    );

    voters.forEach((voterId, index) => {
      const choice = index % 2 === 0 ? "rock" : "paper";
      const salt = `salt-${index}`;
      state = applyAccepted(state, rng, {
        type: "COMMIT_VOTE",
        playerId: voterId,
        payload: {
          voterId,
          commitment: makeBallotRpsCommitment(state.gameId, 0, voterId, choice, salt)
        }
      });
      state = applyAccepted(state, rng, {
        type: "REVEAL_VOTE",
        playerId: voterId,
        payload: { voterId, choice, salt }
      });
    });

    const hand = state.privateStateByPlayer.p1?.hand ?? [];
    const illegal = (["rock", "paper", "scissors"] as const).find((move) => !hand.includes(move)) ?? "scissors";
    state = applyAccepted(state, rng, {
      type: "COMMIT_PLAY",
      playerId: "p1",
      payload: {
        commitment: makeBallotRpsCommitment(state.gameId, 1, "p1", illegal, "bad-salt")
      }
    });
    state = applyAccepted(state, rng, {
      type: "COMMIT_PLAY",
      playerId: "p2",
      payload: {
        commitment: makeBallotRpsCommitment(state.gameId, 1, "p2", state.privateStateByPlayer.p2?.hand[0] ?? "rock", "ok-salt")
      }
    });

    const rejected = ballotRpsRuleset.applyAction(
      state,
      {
        type: "REVEAL_PLAY",
        playerId: "p1",
        payload: { choice: illegal, salt: "bad-salt" }
      },
      rng
    );

    expect(rejected.accepted).toBe(false);
    expect(rejected.errors).toContain("Player cannot reveal a card outside their hand");
  });

  it("rejects reveal data that does not match a commitment", () => {
    const rng = new DeterministicRng("vote-mismatch");
    let state = ballotRpsRuleset.init(
      {
        gameId: "vote-mismatch",
        seed: "vote-mismatch",
        players: ["p1", "p2"],
        voters: ["v1", "v2", "v3", "v4", "v5", "v6"]
      },
      rng
    );
    state = applyAccepted(state, rng, {
      type: "COMMIT_VOTE",
      playerId: "v1",
      payload: {
        voterId: "v1",
        commitment: makeBallotRpsCommitment(state.gameId, 0, "v1", "rock", "salt")
      }
    });

    const rejected = ballotRpsRuleset.applyAction(
      state,
      {
        type: "REVEAL_VOTE",
        playerId: "v1",
        payload: { voterId: "v1", choice: "paper", salt: "salt" }
      },
      rng
    );

    expect(rejected.accepted).toBe(false);
    expect(rejected.errors).toContain("Vote reveal does not match commitment");
  });

  it("rejects duplicate vote commitments", () => {
    const rng = new DeterministicRng("duplicate-vote");
    let state = ballotRpsRuleset.init(
      {
        gameId: "duplicate-vote",
        seed: "duplicate-vote",
        players: ["p1", "p2"],
        voters: ["v1", "v2", "v3", "v4", "v5", "v6"]
      },
      rng
    );
    state = applyAccepted(state, rng, {
      type: "COMMIT_VOTE",
      playerId: "v1",
      payload: {
        voterId: "v1",
        commitment: makeBallotRpsCommitment(state.gameId, 0, "v1", "rock", "salt")
      }
    });
    const duplicate = ballotRpsRuleset.applyAction(
      state,
      {
        type: "COMMIT_VOTE",
        playerId: "v1",
        payload: {
          voterId: "v1",
          commitment: makeBallotRpsCommitment(state.gameId, 0, "v1", "paper", "salt-2")
        }
      },
      rng
    );

    expect(duplicate.accepted).toBe(false);
    expect(duplicate.errors).toContain("Voter already committed");
  });

  it("only exposes the viewer hand in public view", () => {
    const demo = runBallotRpsDemo("public-view", "paper");
    const publicView = ballotRpsRuleset.getPublicView(demo.state, "player:auditor") as {
      viewerHand: string[];
      publicState: { players: string[] };
    };

    expect(publicView.viewerHand).toEqual(demo.humanHand);
    expect(publicView.publicState.players).toEqual(["player:auditor", "npc:calculator"]);
  });
});

function applyAccepted(
  state: Parameters<typeof ballotRpsRuleset.applyAction>[0],
  rng: DeterministicRng,
  action: BallotRpsAction
) {
  const resolution = ballotRpsRuleset.applyAction(state, action, rng);
  expect(resolution.accepted).toBe(true);
  return resolution.state;
}
