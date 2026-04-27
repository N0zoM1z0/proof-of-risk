import { describe, expect, it } from "vitest";
import { runAllPayAuctionDemo } from "../src/gambles/allPayAuction/demo";
import { runNontransitiveDiceDemo } from "../src/gambles/nontransitiveDice/demo";

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
});
