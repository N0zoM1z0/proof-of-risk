import { describe, expect, it } from "vitest";
import { runAllPayAuctionDemo } from "../src/gambles/allPayAuction/demo";
import { allPayAuctionRuleset } from "../src/gambles/allPayAuction/ruleset";
import { runNontransitiveDiceDemo } from "../src/gambles/nontransitiveDice/demo";
import { nontransitiveDiceRuleset } from "../src/gambles/nontransitiveDice/ruleset";
import { DeterministicRng } from "../src/engine/rng";
import { verifyGenesisReplay } from "../src/verify/genesisReplay";
import { exportDemoArtifacts } from "../src/verify/artifacts";

describe("phase 8 expansion rulesets", () => {
  it("runs a sealed all-pay auction deterministically", () => {
    const first = runAllPayAuctionDemo("auction-seed");
    const second = runAllPayAuctionDemo("auction-seed");

    expect(first).toEqual(second);
    expect(first.commitments.every((commitment) => commitment.status === "revealed")).toBe(true);
    expect(Object.values(first.revealedBids).reduce((sum, bid) => sum + bid, 0)).toBeGreaterThan(0);
    expect(first.settlement.winnerIds).toEqual([first.winnerId]);
    for (const [playerId, bid] of Object.entries(first.revealedBids)) {
      expect(bid).toBeLessThanOrEqual(first.budgets[playerId] ?? 0);
      expect(first.settlement.balanceDeltas[playerId]).toBe(-bid);
    }
  });

  it("runs non-transitive dice counter-pick tutorial deterministically", () => {
    const first = runNontransitiveDiceDemo("dice-seed", "ember");
    const second = runNontransitiveDiceDemo("dice-seed", "ember");

    expect(first).toEqual(second);
    expect(first.dealerDie).toBe("tide");
    expect(first.rounds).toHaveLength(5);
    expect(first.randomLog).toHaveLength(10);
  });

  it("counter-picks every non-transitive die", () => {
    expect(runNontransitiveDiceDemo("dice-counters", "ember").dealerDie).toBe("tide");
    expect(runNontransitiveDiceDemo("dice-counters", "tide").dealerDie).toBe("granite");
    expect(runNontransitiveDiceDemo("dice-counters", "granite").dealerDie).toBe("ember");
  });

  it("exposes formal all-pay auction legality and settlement", () => {
    const demo = runAllPayAuctionDemo("auction-formal");
    const replay = verifyGenesisReplay(
      exportDemoArtifacts("auction-formal").find((artifact) => artifact.rulesetId === allPayAuctionRuleset.id) ??
        (() => {
          throw new Error("missing auction artifact");
        })()
    );

    expect(demo.state.phase).toBe("settled");
    expect(demo.state.publicState.result?.terminal).toBe(true);
    expect(replay.ok).toBe(true);

    const rejected = allPayAuctionRuleset.applyAction(
      demo.state,
      {
        type: "REVEAL_BID",
        playerId: "bidder:analyst",
        payload: { bid: 999, salt: "late" }
      },
      new DeterministicRng("auction-formal")
    );
    expect(rejected.accepted).toBe(false);
  });

  it("exposes formal non-transitive dice deterministic roll validation", () => {
    const demo = runNontransitiveDiceDemo("dice-formal", "ember");
    const replay = verifyGenesisReplay(
      exportDemoArtifacts("dice-formal").find((artifact) => artifact.rulesetId === nontransitiveDiceRuleset.id) ??
        (() => {
          throw new Error("missing dice artifact");
        })()
    );

    expect(demo.state.phase).toBe("settled");
    expect(demo.state.publicState.rounds).toHaveLength(5);
    expect(replay.ok).toBe(true);

    let state = nontransitiveDiceRuleset.init(
      {
        gameId: "dice-reject",
        seed: "dice-reject",
        players: ["player:auditor", "dealer:probability"],
        roundCount: 1
      },
      new DeterministicRng("dice-reject")
    );
    const rng = new DeterministicRng("dice-reject");
    state = nontransitiveDiceRuleset.applyAction(
      state,
      { type: "PICK_DIE", playerId: "player:auditor", payload: { die: "ember" } },
      rng
    ).state;
    state = nontransitiveDiceRuleset.applyAction(
      state,
      { type: "COUNTER_PICK_DIE", playerId: "dealer:probability", payload: { die: "tide" } },
      rng
    ).state;
    const rejected = nontransitiveDiceRuleset.applyAction(
      state,
      {
        type: "ROLL_PAIR",
        playerId: "dealer:probability",
        payload: { round: 1, playerRoll: 999, dealerRoll: 0, winner: "player" }
      },
      rng
    );

    expect(rejected.accepted).toBe(false);
    expect(rejected.errors).toContain("Roll payload does not match deterministic dice result");
  });
});
