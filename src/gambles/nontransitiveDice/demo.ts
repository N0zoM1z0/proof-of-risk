import { appendAction, type ActionRecord } from "../../engine/actionLog";
import { DeterministicRng, type RandomRecord } from "../../engine/rng";

export type DieId = "ember" | "granite" | "tide";

export type DiceDuelResult = {
  gameId: string;
  rulesetId: "nontransitive-dice.v1";
  seed: string;
  playerDie: DieId;
  dealerDie: DieId;
  rounds: Array<{ round: number; playerRoll: number; dealerRoll: number; winner: "player" | "dealer" | "tie" }>;
  playerWins: number;
  dealerWins: number;
  lesson: string;
  actionLog: ActionRecord[];
  randomLog: RandomRecord[];
};

const dice: Record<DieId, number[]> = {
  ember: [4, 4, 4, 4, 0, 0],
  granite: [3, 3, 3, 3, 3, 3],
  tide: [6, 6, 2, 2, 2, 2]
};

const counterPick: Record<DieId, DieId> = {
  ember: "tide",
  granite: "ember",
  tide: "granite"
};

export function runNontransitiveDiceDemo(seed: string, playerDie: DieId = "ember"): DiceDuelResult {
  const rng = new DeterministicRng(seed);
  const gameId = "nontransitive-dice-demo";
  const dealerDie = counterPick[playerDie];
  let actionLog: ActionRecord[] = [];
  actionLog = [
    appendAction(actionLog, {
      gameId,
      playerId: "player:auditor",
      type: "PICK_DIE",
      payload: { die: playerDie },
      turn: 0
    })
  ];
  actionLog = [
    ...actionLog,
    appendAction(actionLog, {
      gameId,
      playerId: "dealer:probability",
      type: "COUNTER_PICK_DIE",
      payload: { die: dealerDie },
      turn: 1
    })
  ];
  const rounds = Array.from({ length: 5 }, (_, index) => {
    const playerRoll = rollDie(dice[playerDie], rng, `dice.player:${index}`);
    const dealerRoll = rollDie(dice[dealerDie], rng, `dice.dealer:${index}`);
    const winner: "player" | "dealer" | "tie" =
      playerRoll === dealerRoll ? "tie" : playerRoll > dealerRoll ? "player" : "dealer";
    actionLog = [
      ...actionLog,
      appendAction(actionLog, {
        gameId,
        playerId: "dealer:probability",
        type: "ROLL_PAIR",
        payload: { round: index + 1, playerRoll, dealerRoll, winner },
        turn: actionLog.length
      })
    ];
    return { round: index + 1, playerRoll, dealerRoll, winner };
  });
  const playerWins = rounds.filter((round) => round.winner === "player").length;
  const dealerWins = rounds.filter((round) => round.winner === "dealer").length;

  return {
    gameId,
    rulesetId: "nontransitive-dice.v1",
    seed,
    playerDie,
    dealerDie,
    rounds,
    playerWins,
    dealerWins,
    lesson: `${dealerDie} is the counter-pick to ${playerDie}; dominance cycles make second pick valuable.`,
    actionLog,
    randomLog: [...rng.randomLog]
  };
}

function rollDie(sides: readonly number[], rng: DeterministicRng, label: string): number {
  return sides[rng.nextInt(sides.length, label)] ?? 0;
}
