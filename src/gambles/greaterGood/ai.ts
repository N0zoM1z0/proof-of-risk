import type { DeterministicRng } from "../../engine/rng";
import type { PlayerId } from "../../engine/stateMachine";
import type { ContributionReveal, GreaterGoodArchetype, GreaterGoodState } from "./types";

export function chooseGreaterGoodContribution(
  archetype: GreaterGoodArchetype,
  round: number,
  coinsPerRound: number,
  rng: DeterministicRng
): ContributionReveal {
  const tax = clampTax(
    {
      cooperator: round === 1 ? 4 : 3,
      defector: round === 1 ? 3 : 0,
      dominator: 2,
      auditor: 4,
      chaos: rng.nextInt(coinsPerRound + 1, "greaterGood.chaosContribution")
    }[archetype],
    coinsPerRound
  );
  return { tax, personal: coinsPerRound - tax };
}

export function chooseGreaterGoodVote(state: GreaterGoodState, voterId: PlayerId): PlayerId {
  const voterArchetype = state.publicState.archetypes[voterId];
  const candidates = state.publicState.alivePlayers.filter((playerId) => playerId !== voterId);
  const byTaxAscending = [...candidates].sort((left, right) => {
    const leftTax = state.publicState.revealedContributions[left]?.tax ?? 0;
    const rightTax = state.publicState.revealedContributions[right]?.tax ?? 0;
    if (leftTax !== rightTax) {
      return leftTax - rightTax;
    }
    return left.localeCompare(right);
  });
  const byBalanceDescending = [...candidates].sort((left, right) => {
    const leftBalance = state.publicState.balances[left] ?? 0;
    const rightBalance = state.publicState.balances[right] ?? 0;
    if (rightBalance !== leftBalance) {
      return rightBalance - leftBalance;
    }
    return left.localeCompare(right);
  });

  if (voterArchetype === "dominator") {
    return byBalanceDescending[0] ?? candidates[0] ?? voterId;
  }
  return byTaxAscending[0] ?? candidates[0] ?? voterId;
}

function clampTax(value: number, coinsPerRound: number): number {
  return Math.max(0, Math.min(coinsPerRound, value));
}
