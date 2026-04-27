import { describe, expect, it } from "vitest";
import { appendAction } from "../src/engine/actionLog";
import { createCommitmentRecord, revealCommitment, verifyReveal } from "../src/engine/commitments";
import { DeterministicRng } from "../src/engine/rng";
import { computeReplayHash, createReplayEnvelope } from "../src/engine/replay";

describe("deterministic RNG", () => {
  it("reproduces draws and random logs for the same seed", () => {
    const first = new DeterministicRng("same-seed");
    const second = new DeterministicRng("same-seed");

    expect(first.shuffle([0, 1, 2, 3], "deck")).toEqual(second.shuffle([0, 1, 2, 3], "deck"));
    expect(first.randomLog).toEqual(second.randomLog);
  });

  it("changes draws for different seeds", () => {
    const first = new DeterministicRng("seed-a");
    const second = new DeterministicRng("seed-b");

    expect(first.shuffle([0, 1, 2, 3, 4, 5], "deck")).not.toEqual(
      second.shuffle([0, 1, 2, 3, 4, 5], "deck")
    );
  });
});

describe("commitment verification", () => {
  it("accepts matching reveal data", () => {
    const record = createCommitmentRecord({
      gameId: "game-1",
      round: 1,
      playerId: "player-1",
      choice: { play: "risk" },
      salt: "salt-1",
      createdAtTurn: 0
    });

    expect(verifyReveal(record, { play: "risk" }, "salt-1")).toBe(true);
    expect(revealCommitment(record, { play: "risk" }, "salt-1", 2).status).toBe("revealed");
  });

  it("rejects invalid reveal data deterministically", () => {
    const record = createCommitmentRecord({
      gameId: "game-1",
      round: 1,
      playerId: "player-1",
      choice: { play: "risk" },
      salt: "salt-1",
      createdAtTurn: 0
    });

    const rejected = revealCommitment(record, { play: "proof" }, "salt-1", 2);

    expect(verifyReveal(record, { play: "proof" }, "salt-1")).toBe(false);
    expect(rejected.status).toBe("rejected");
  });
});

describe("replay hashing", () => {
  function buildReplay(seed: string, actionOrder: readonly string[]) {
    const rng = new DeterministicRng(seed);
    rng.nextInt(10, "opening.roll");
    const actionLog = actionOrder.reduce(
      (log, type, turn) => [
        ...log,
        appendAction(log, {
          gameId: "game-1",
          playerId: "player-1",
          type,
          payload: { turn },
          turn
        })
      ],
      [] as ReturnType<typeof appendAction>[]
    );
    return computeReplayHash(
      createReplayEnvelope({
        gameId: "game-1",
        rulesetId: "foundation.v0",
        seed,
        actionLog,
        randomLog: rng.randomLog,
        commitments: []
      })
    );
  }

  it("is stable for identical seed and actions", () => {
    expect(buildReplay("seed", ["A", "B"])).toBe(buildReplay("seed", ["A", "B"]));
  });

  it("changes when action order or seed changes", () => {
    const baseline = buildReplay("seed", ["A", "B"]);

    expect(buildReplay("seed", ["B", "A"])).not.toBe(baseline);
    expect(buildReplay("other-seed", ["A", "B"])).not.toBe(baseline);
  });
});
