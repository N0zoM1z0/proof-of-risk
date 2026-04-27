import { describe, expect, it } from "vitest";
import { CatalogValidationError, filterCatalog, validateGambleCatalog } from "../src/gambles/catalog";
import { gambleCatalog } from "../src/gambles/catalogData";

describe("gamble catalog", () => {
  it("loads all normalized runtime entries", () => {
    expect(gambleCatalog).toHaveLength(23);
    expect(gambleCatalog.map((entry) => entry.id)).toContain("ballot-rps");
    expect(gambleCatalog.map((entry) => entry.id)).toContain("greater-good");
    expect(gambleCatalog.map((entry) => entry.id)).toContain("all-pay-vote-auction");
  });

  it("filters by phase, readiness, complexity, and ZK priority", () => {
    const coreMvp = filterCatalog(gambleCatalog, {
      readiness: "core-mvp",
      maxComplexity: 3,
      zkPriority: "highest"
    });

    expect(coreMvp.map((entry) => entry.id)).toEqual(["greater-good"]);
  });

  it("rejects malformed catalog entries", () => {
    expect(() =>
      validateGambleCatalog([
        {
          id: "Bad Id",
          title: "",
          summary: "bad",
          mechanism: "bad",
          players: "2",
          hiddenInfo: [],
          aiHooks: ["x"],
          fairnessHooks: ["x"],
          phase: "phase-99",
          complexity: 6,
          zkPriority: "urgent",
          readiness: "done"
        }
      ])
    ).toThrow(CatalogValidationError);
  });

  it("rejects blocked IP terms in runtime data", () => {
    expect(() =>
      validateGambleCatalog([
        {
          ...gambleCatalog[0],
          title: "Kakegurui Table"
        }
      ])
    ).toThrow(/blocked runtime IP term/);
  });
});
