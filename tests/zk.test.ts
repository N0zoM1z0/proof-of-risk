import { describe, expect, it } from "vitest";
import {
  demoContributionCommitment,
  verifyGreaterGoodContributionWitness
} from "../src/zk/greaterGoodContribution";
import { greaterGoodContributionPoc } from "../src/zk/proofTypes";

describe("optional ZK POC metadata and fallback constraints", () => {
  it("describes the Circom/snarkjs Greater Good contribution target", () => {
    expect(greaterGoodContributionPoc.toolchain).toBe("circom-snarkjs");
    expect(greaterGoodContributionPoc.publicInputs).toContain("publicReturn");
    expect(greaterGoodContributionPoc.constraints).toContain("tax_i + personal_i = 5");
  });

  it("validates the Phase 16 fallback witness constraints", () => {
    const valid = verifyGreaterGoodContributionWitness({
      tax: 3,
      personal: 2,
      salt: 12345,
      coinsPerRound: 5,
      sumTax: 15,
      alivePlayerCount: 5,
      publicReturn: 6,
      returnRemainder: 0,
      commitment: demoContributionCommitment(3, 2, 12345)
    });
    const invalid = verifyGreaterGoodContributionWitness({
      tax: 6,
      personal: 0,
      salt: 12345,
      coinsPerRound: 5,
      sumTax: 15,
      alivePlayerCount: 5,
      publicReturn: 6,
      returnRemainder: 0,
      commitment: demoContributionCommitment(3, 2, 12345)
    });

    expect(valid.ok).toBe(true);
    expect(invalid.ok).toBe(false);
    expect(invalid.errors).toContain("tax must be an integer in [0, 5]");
  });
});
