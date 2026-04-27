import { describe, expect, it } from "vitest";
import { npcArchetypes } from "../src/ai/archetypes";
import { resolveNpcPolicy } from "../src/ai/difficulty";
import { runDeterministicSimulations } from "../src/ai/simulations";

describe("shared NPC AI", () => {
  it("applies difficulty modifiers to measurable policy parameters", () => {
    const easy = resolveNpcPolicy(npcArchetypes.analyst, "easy");
    const nightmare = resolveNpcPolicy(npcArchetypes.analyst, "nightmare");

    expect(nightmare.memory).toBeGreaterThan(easy.memory);
    expect(nightmare.auditAwareness).toBeGreaterThan(easy.auditAwareness);
    expect(nightmare.mistakeRate).toBeLessThan(easy.mistakeRate);
  });

  it("produces stable deterministic simulation summaries", () => {
    const first = runDeterministicSimulations({
      seedPrefix: "stable",
      iterations: 4,
      difficulty: "hard",
      archetypeId: "analyst"
    });
    const second = runDeterministicSimulations({
      seedPrefix: "stable",
      iterations: 4,
      difficulty: "hard",
      archetypeId: "analyst"
    });

    expect(first).toEqual(second);
    expect(first.iterations).toBe(4);
    expect(first.greaterGoodAverageEliminations).toBeGreaterThan(0);
  });
});
