import type { DeterministicRng } from "../../engine/rng";
import type { BetKind, NimCard } from "./types";

export function chooseZeroNimCard(
  hand: readonly NimCard[],
  total: number,
  threshold: number,
  rng: DeterministicRng
): NimCard {
  const safeCards = hand.filter((card) => total + card <= threshold);
  if (safeCards.length === 0) {
    return [...hand].sort((left: NimCard, right: NimCard) => left - right)[0] ?? 0;
  }
  const pressureCards = [...safeCards].sort((left: NimCard, right: NimCard) => right - left);
  if (threshold - total <= 2 && safeCards.includes(0)) {
    return 0;
  }
  return pressureCards[0] ?? rng.pick(hand, "zeroNim.cardFallback");
}

export function chooseZeroNimBet(
  hand: readonly NimCard[],
  total: number,
  threshold: number,
  currentBet: number
): { kind: BetKind; raiseTo?: number } {
  const hasZero = hand.includes(0);
  const pressure = threshold - total;
  if (pressure <= 2 && hasZero && currentBet < 2) {
    return { kind: "raise", raiseTo: 2 };
  }
  if (currentBet > 0) {
    return { kind: "call" };
  }
  return { kind: "check" };
}
