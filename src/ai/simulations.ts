import { runBallotRpsDemo } from "../gambles/ballotRps/demo";
import { runGreaterGoodDemo } from "../gambles/greaterGood/demo";
import { runZeroNimDemo } from "../gambles/zeroNim/demo";
import { npcArchetypes, type NpcArchetypeId } from "./archetypes";
import { resolveNpcPolicy, type Difficulty } from "./difficulty";

export type SimulationSummary = {
  iterations: number;
  difficulty: Difficulty;
  archetypeId: NpcArchetypeId;
  ballotRpsPlayerWinRate: number;
  zeroNimBustRate: number;
  greaterGoodAverageEliminations: number;
  greaterGoodAverageWinnerBalance: number;
  auditFlagRate: number;
};

export function runDeterministicSimulations(input: {
  seedPrefix: string;
  iterations: number;
  difficulty: Difficulty;
  archetypeId: NpcArchetypeId;
}): SimulationSummary {
  const policy = resolveNpcPolicy(npcArchetypes[input.archetypeId], input.difficulty);
  let ballotRpsPlayerWins = 0;
  let zeroNimBusts = 0;
  let greaterGoodEliminations = 0;
  let greaterGoodWinnerBalance = 0;
  let auditFlags = 0;

  for (let index = 0; index < input.iterations; index += 1) {
    const seed = `${input.seedPrefix}:${input.difficulty}:${input.archetypeId}:${index}`;
    const preferredRps = policy.risk > 0.65 ? "scissors" : "paper";
    const preferredNim = policy.risk > 0.65 ? 3 : 1;
    const rps = runBallotRpsDemo(seed, preferredRps);
    const nim = runZeroNimDemo(seed, preferredNim);
    const good = runGreaterGoodDemo(seed);

    if (rps.state.publicState.result?.winnerIds.includes("player:auditor")) {
      ballotRpsPlayerWins += 1;
    }
    if (nim.state.publicState.result?.reason.includes("busted")) {
      zeroNimBusts += 1;
    }
    greaterGoodEliminations += good.state.publicState.eliminatedPlayers.length;
    const winnerBalance = Math.max(
      ...good.state.publicState.alivePlayers.map(
        (playerId) => good.state.publicState.balances[playerId] ?? 0
      )
    );
    greaterGoodWinnerBalance += winnerBalance;
    auditFlags +=
      (rps.state.publicState.audit?.anomalies.length ?? 0) +
      (nim.state.publicState.audit?.anomalies.length ?? 0) +
      (good.state.publicState.audit?.anomalies.length ?? 0);
  }

  return {
    iterations: input.iterations,
    difficulty: input.difficulty,
    archetypeId: input.archetypeId,
    ballotRpsPlayerWinRate: ratio(ballotRpsPlayerWins, input.iterations),
    zeroNimBustRate: ratio(zeroNimBusts, input.iterations),
    greaterGoodAverageEliminations: round(greaterGoodEliminations / input.iterations),
    greaterGoodAverageWinnerBalance: round(greaterGoodWinnerBalance / input.iterations),
    auditFlagRate: ratio(auditFlags, input.iterations)
  };
}

function ratio(numerator: number, denominator: number): number {
  return round(numerator / denominator);
}

function round(value: number): number {
  return Number(value.toFixed(4));
}
