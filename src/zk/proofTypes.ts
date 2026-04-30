export type ZkProofTarget = "greater-good-contribution" | "all-pay-auction-highest-bid";

export type ZkPocStatus = {
  target: ZkProofTarget;
  optional: true;
  toolchain: "circom-snarkjs" | "noir" | "unselected";
  publicInputs: string[];
  privateWitness: string[];
  constraints: string[];
};

export const greaterGoodContributionPoc: ZkPocStatus = {
  target: "greater-good-contribution",
  optional: true,
  toolchain: "circom-snarkjs",
  publicInputs: ["coinsPerRound", "sumTax", "alivePlayerCount", "publicReturn", "returnRemainder", "commitment"],
  privateWitness: ["tax_i", "personal_i", "salt_i"],
  constraints: [
    "0 <= tax_i <= 5",
    "0 <= personal_i <= 5",
    "tax_i + personal_i = 5",
    "commit_i = phase16_demo_commit(tax_i, personal_i, salt_i)",
    "publicReturn * alivePlayerCount = sumTax * 2 + returnRemainder",
    "0 <= returnRemainder < alivePlayerCount"
  ]
};
