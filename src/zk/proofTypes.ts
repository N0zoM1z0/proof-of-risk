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
  toolchain: "unselected",
  publicInputs: ["gameId", "round", "commitmentRoot", "sumTax", "publicReturn", "alivePlayerCount"],
  privateWitness: ["tax_i", "personal_i", "salt_i"],
  constraints: [
    "0 <= tax_i <= 5",
    "0 <= personal_i <= 5",
    "tax_i + personal_i = 5",
    "commit_i = hash(tax_i, personal_i, salt_i)",
    "publicReturn = ceil(sumTax * 2 / alivePlayerCount)"
  ]
};
