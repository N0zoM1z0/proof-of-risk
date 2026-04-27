import type { DeterministicRng } from "../../engine/rng";
import type { RpsMove, VoteCounts } from "./types";

const beats: Record<RpsMove, RpsMove> = {
  rock: "scissors",
  paper: "rock",
  scissors: "paper"
};

const counters: Record<RpsMove, RpsMove> = {
  rock: "paper",
  paper: "scissors",
  scissors: "rock"
};

export function compareRps(left: RpsMove, right: RpsMove): 1 | 0 | -1 {
  if (left === right) {
    return 0;
  }
  return beats[left] === right ? 1 : -1;
}

export function chooseBallotRpsNpcMove(
  hand: readonly RpsMove[],
  voteCounts: VoteCounts,
  rng: DeterministicRng
): RpsMove {
  const likelyOpponent = mostCommonMove(voteCounts);
  const preferred = counters[likelyOpponent];
  if (hand.includes(preferred)) {
    return preferred;
  }
  return rng.pick(hand, "ballotRps.npcFallback");
}

function mostCommonMove(voteCounts: VoteCounts): RpsMove {
  return (Object.entries(voteCounts) as Array<[RpsMove, number]>).sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }
    return left[0].localeCompare(right[0]);
  })[0]?.[0] ?? "rock";
}
