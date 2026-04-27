import { describe, expect, it } from "vitest";
import { DeterministicRng } from "../src/engine/rng";
import { runZeroNimDemo } from "../src/gambles/zeroNim/demo";
import { detectZeroNimAnomalies } from "../src/gambles/zeroNim/audit";
import { makeZeroNimCommitment, zeroNimRuleset } from "../src/gambles/zeroNim/ruleset";
import type { ZeroNimAction, ZeroNimState } from "../src/gambles/zeroNim/types";

describe("zero Nim ruleset", () => {
  it("plays a deterministic game to terminal settlement", () => {
    const first = runZeroNimDemo("nim-seed", 3);
    const second = runZeroNimDemo("nim-seed", 3);

    expect(first.state.phase).toBe("settled");
    expect(first.state.publicState.audit?.fairness).toEqual({
      randomVerified: true,
      commitmentsVerified: true,
      settlementVerified: true
    });
    expect(first.state.publicState.audit?.replayHash).toBe(second.state.publicState.audit?.replayHash);
  });

  it("changes replay hash when seed changes", () => {
    const first = runZeroNimDemo("nim-seed-a", 3);
    const second = runZeroNimDemo("nim-seed-b", 3);

    expect(first.state.publicState.audit?.replayHash).not.toBe(second.state.publicState.audit?.replayHash);
  });

  it("rejects invalid betting turns", () => {
    const rng = new DeterministicRng("turn-test");
    const state = zeroNimRuleset.init(
      {
        gameId: "turn-test",
        seed: "turn-test",
        players: ["p1", "p2"]
      },
      rng
    );

    const rejected = zeroNimRuleset.applyAction(
      state,
      { type: "BET", playerId: "p2", payload: { kind: "check" } },
      rng
    );

    expect(rejected.accepted).toBe(false);
    expect(rejected.errors).toContain("It is not this player's betting turn");
  });

  it("rejects call when there is no open bet", () => {
    const rng = new DeterministicRng("call-test");
    const state = zeroNimRuleset.init(
      {
        gameId: "call-test",
        seed: "call-test",
        players: ["p1", "p2"]
      },
      rng
    );

    const rejected = zeroNimRuleset.applyAction(
      state,
      { type: "BET", playerId: "p1", payload: { kind: "call" } },
      rng
    );

    expect(rejected.accepted).toBe(false);
    expect(rejected.errors).toContain("Cannot call when there is no open bet");
  });

  it("settles immediately when a player folds", () => {
    const rng = new DeterministicRng("fold-test");
    const state = zeroNimRuleset.init(
      {
        gameId: "fold-test",
        seed: "fold-test",
        players: ["p1", "p2"]
      },
      rng
    );

    const folded = zeroNimRuleset.applyAction(
      state,
      { type: "BET", playerId: "p1", payload: { kind: "fold" } },
      rng
    );

    expect(folded.accepted).toBe(true);
    expect(folded.state.phase).toBe("settled");
    expect(folded.state.publicState.result?.winnerIds).toEqual(["p2"]);
  });

  it("rejects card reveals outside the active hand", () => {
    const rng = new DeterministicRng("card-test");
    let state = zeroNimRuleset.init(
      {
        gameId: "card-test",
        seed: "card-test",
        players: ["p1", "p2"]
      },
      rng
    );
    state = applyAccepted(state, rng, { type: "BET", playerId: "p1", payload: { kind: "check" } });
    state = applyAccepted(state, rng, { type: "BET", playerId: "p2", payload: { kind: "check" } });

    const hand = state.privateStateByPlayer.p1?.hand ?? [];
    const illegal = ([0, 1, 2, 3] as const).find((card) => !hand.includes(card)) ?? 3;
    state = applyAccepted(state, rng, {
      type: "COMMIT_CARD",
      playerId: "p1",
      payload: {
        commitment: makeZeroNimCommitment(state.gameId, state.publicState.round, "p1", illegal, "salt")
      }
    });
    const rejected = zeroNimRuleset.applyAction(
      state,
      { type: "REVEAL_CARD", playerId: "p1", payload: { card: illegal, salt: "salt" } },
      rng
    );

    expect(rejected.accepted).toBe(false);
    expect(rejected.errors).toContain("Cannot reveal a card outside the active hand");
  });

  it("reports audit-only raise-before-zero anomaly telemetry", () => {
    const anomalies = detectZeroNimAnomalies({
      actionLog: [
        { type: "BET", payload: { kind: "raise" } },
        { type: "REVEAL_CARD", payload: { card: 0 } },
        { type: "BET", payload: { kind: "raise" } },
        { type: "REVEAL_CARD", payload: { card: 0 } }
      ]
    } as ZeroNimState);

    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]?.signal).toBe("raise-before-zero-pattern");
  });
});

function applyAccepted(state: ZeroNimState, rng: DeterministicRng, action: ZeroNimAction): ZeroNimState {
  const resolution = zeroNimRuleset.applyAction(state, action, rng);
  expect(resolution.accepted).toBe(true);
  return resolution.state;
}
