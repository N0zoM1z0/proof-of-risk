export type GreaterGoodContributionWitness = {
  tax: number;
  personal: number;
  salt: number;
  coinsPerRound: number;
  sumTax: number;
  alivePlayerCount: number;
  publicReturn: number;
  returnRemainder: number;
  commitment: number;
};

export type ZkWitnessCheck = {
  ok: boolean;
  errors: string[];
};

export function verifyGreaterGoodContributionWitness(input: GreaterGoodContributionWitness): ZkWitnessCheck {
  const errors: string[] = [];
  if (!isIntegerInRange(input.tax, 0, 5)) {
    errors.push("tax must be an integer in [0, 5]");
  }
  if (!isIntegerInRange(input.personal, 0, 5)) {
    errors.push("personal must be an integer in [0, 5]");
  }
  if (input.coinsPerRound !== 5) {
    errors.push("coinsPerRound must be 5 for the Phase 16 POC circuit");
  }
  if (input.tax + input.personal !== input.coinsPerRound) {
    errors.push("tax + personal must equal coinsPerRound");
  }
  if (input.alivePlayerCount !== 5) {
    errors.push("alivePlayerCount must be 5 for the Phase 16 POC circuit");
  }
  if (!isIntegerInRange(input.returnRemainder, 0, 4)) {
    errors.push("returnRemainder must be an integer in [0, 4]");
  }
  if (input.publicReturn * input.alivePlayerCount !== input.sumTax * 2 + input.returnRemainder) {
    errors.push("publicReturn must encode ceil(sumTax * 2 / alivePlayerCount)");
  }
  if (input.commitment !== demoContributionCommitment(input.tax, input.personal, input.salt)) {
    errors.push("commitment does not match the Phase 16 demo algebraic commitment");
  }
  return {
    ok: errors.length === 0,
    errors
  };
}

export function demoContributionCommitment(tax: number, personal: number, salt: number): number {
  return tax + personal * 10 + salt * 100;
}

function isIntegerInRange(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}
