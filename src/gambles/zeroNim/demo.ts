import { DeterministicRng } from "../../engine/rng";
import { chooseZeroNimBet, chooseZeroNimCard } from "./ai";
import { makeZeroNimCommitment, zeroNimRuleset } from "./ruleset";
import type { NimCard, ZeroNimAction, ZeroNimState } from "./types";

const players = ["player:auditor", "npc:risk"] as const;

export function runZeroNimDemo(seed: string, preferredCard: NimCard) {
  const rng = new DeterministicRng(seed);
  let state = zeroNimRuleset.init(
    {
      gameId: "zero-nim-demo",
      seed,
      players: [...players],
      threshold: 9,
      handSize: 4
    },
    rng
  );

  while (!zeroNimRuleset.isTerminal(state)) {
    if (state.phase === "betting") {
      const playerId = state.publicState.nextToAct;
      const hand = state.privateStateByPlayer[playerId]?.hand ?? [];
      const bet = playerId === players[0] && state.publicState.currentBet === 0
        ? { kind: "check" as const }
        : chooseZeroNimBet(hand, state.publicState.total, state.publicState.threshold, state.publicState.currentBet);
      state = applyOrThrow(state, { type: "BET", playerId, payload: bet }, rng);
      continue;
    }

    if (state.phase === "cardCommit") {
      const playerId = state.publicState.activePlayer;
      const hand = state.privateStateByPlayer[playerId]?.hand ?? [];
      const card =
        playerId === players[0] && hand.includes(preferredCard)
          ? preferredCard
          : chooseZeroNimCard(hand, state.publicState.total, state.publicState.threshold, rng);
      const salt = `zero-nim:${seed}:${state.publicState.round}:${playerId}`;
      state = applyOrThrow(
        state,
        {
          type: "COMMIT_CARD",
          playerId,
          payload: {
            commitment: makeZeroNimCommitment(state.gameId, state.publicState.round, playerId, card, salt)
          }
        },
        rng
      );
      state = applyOrThrow(
        state,
        {
          type: "REVEAL_CARD",
          playerId,
          payload: { card, salt }
        },
        rng
      );
    }
  }

  return {
    state,
    publicView: zeroNimRuleset.getPublicView(state, players[0])
  };
}

function applyOrThrow(state: ZeroNimState, action: ZeroNimAction, rng: DeterministicRng): ZeroNimState {
  const resolution = zeroNimRuleset.applyAction(state, action, rng);
  if (!resolution.accepted) {
    throw new Error(resolution.errors.join("; "));
  }
  return resolution.state;
}
