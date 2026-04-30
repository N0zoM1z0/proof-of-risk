import { DeterministicRng } from "../../engine/rng";
import type { PlayerId } from "../../engine/stateMachine";
import { counterPick, nontransitiveDiceRuleset } from "./ruleset";
import type { DiceRound, DieId, NontransitiveDiceAction, NontransitiveDiceState } from "./types";

export type { DieId };

export type DiceDuelResult = {
  gameId: string;
  rulesetId: "nontransitive-dice.v1";
  seed: string;
  playerDie: DieId;
  dealerDie: DieId;
  players: [PlayerId, PlayerId];
  roundCount: number;
  rounds: DiceRound[];
  playerWins: number;
  dealerWins: number;
  lesson: string;
  actionLog: NontransitiveDiceState["actionLog"];
  randomLog: NontransitiveDiceState["randomLog"];
  state: NontransitiveDiceState;
};

const players: [PlayerId, PlayerId] = ["player:auditor", "dealer:probability"];

export function runNontransitiveDiceDemo(seed: string, playerDie: DieId = "ember"): DiceDuelResult {
  const rng = new DeterministicRng(seed);
  const gameId = "nontransitive-dice-demo";
  let state = nontransitiveDiceRuleset.init(
    {
      gameId,
      seed,
      players,
      roundCount: 5
    },
    rng
  );
  state = applyOrThrow(state, {
    type: "PICK_DIE",
    playerId: players[0],
    payload: { die: playerDie }
  });
  state = applyOrThrow(state, {
    type: "COUNTER_PICK_DIE",
    playerId: players[1],
    payload: { die: counterPick[playerDie] }
  });

  for (let round = 1; round <= state.publicState.roundCount; round += 1) {
    state = applyOrThrow(state, {
      type: "ROLL_PAIR",
      playerId: players[1],
      payload: { round }
    });
  }

  if (!state.publicState.dealerDie || !state.publicState.result) {
    throw new Error("Non-transitive dice demo did not settle");
  }

  return {
    gameId,
    rulesetId: "nontransitive-dice.v1",
    seed,
    playerDie,
    dealerDie: state.publicState.dealerDie,
    players,
    roundCount: state.publicState.roundCount,
    rounds: state.publicState.rounds,
    playerWins: state.publicState.playerWins,
    dealerWins: state.publicState.dealerWins,
    lesson: `${state.publicState.dealerDie} is the counter-pick to ${playerDie}; dominance cycles make second pick valuable.`,
    actionLog: state.actionLog,
    randomLog: state.randomLog,
    state
  };

  function applyOrThrow(stateBefore: NontransitiveDiceState, action: NontransitiveDiceAction) {
    const result = nontransitiveDiceRuleset.applyAction(stateBefore, action, rng);
    if (!result.accepted) {
      throw new Error(result.errors.join("; "));
    }
    return result.state;
  }
}
