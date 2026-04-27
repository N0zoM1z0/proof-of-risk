import { DeterministicRng } from "../../engine/rng";
import { chooseBallotRpsNpcMove } from "./ai";
import { ballotRpsRuleset, makeBallotRpsCommitment } from "./ruleset";
import type { BallotRpsState, RpsMove } from "./types";

const players = ["player:auditor", "npc:calculator"] as const;
const voterChoices: RpsMove[] = [
  "rock",
  "paper",
  "paper",
  "scissors",
  "rock",
  "paper",
  "scissors",
  "paper",
  "rock"
];

export function runBallotRpsDemo(seed: string, requestedHumanMove: RpsMove) {
  const rng = new DeterministicRng(seed);
  const voters = voterChoices.map((_, index) => `voter:${index + 1}`);
  let state = ballotRpsRuleset.init(
    {
      gameId: "ballot-rps-demo",
      seed,
      players: [...players],
      voters
    },
    rng
  );

  voterChoices.forEach((choice, index) => {
    const voterId = voters[index] as string;
    const salt = `vote-salt:${seed}:${index}`;
    state = applyOrThrow(
      state,
      {
        type: "COMMIT_VOTE",
        playerId: voterId,
        payload: {
          voterId,
          commitment: makeBallotRpsCommitment(state.gameId, 0, voterId, choice, salt)
        }
      },
      rng
    );
    state = applyOrThrow(
      state,
      {
        type: "REVEAL_VOTE",
        playerId: voterId,
        payload: {
          voterId,
          choice,
          salt
        }
      },
      rng
    );
  });

  const humanHand = state.privateStateByPlayer[players[0]]?.hand ?? [];
  const npcHand = state.privateStateByPlayer[players[1]]?.hand ?? [];
  const humanMove = humanHand.includes(requestedHumanMove) ? requestedHumanMove : humanHand[0] ?? "rock";
  const npcMove = chooseBallotRpsNpcMove(npcHand, state.publicState.voteCounts, rng);
  const humanSalt = `play-salt:${seed}:human`;
  const npcSalt = `play-salt:${seed}:npc`;

  state = applyOrThrow(
    state,
    {
      type: "COMMIT_PLAY",
      playerId: players[0],
      payload: {
        commitment: makeBallotRpsCommitment(state.gameId, 1, players[0], humanMove, humanSalt)
      }
    },
    rng
  );
  state = applyOrThrow(
    state,
    {
      type: "COMMIT_PLAY",
      playerId: players[1],
      payload: {
        commitment: makeBallotRpsCommitment(state.gameId, 1, players[1], npcMove, npcSalt)
      }
    },
    rng
  );
  state = applyOrThrow(
    state,
    {
      type: "REVEAL_PLAY",
      playerId: players[0],
      payload: {
        choice: humanMove,
        salt: humanSalt
      }
    },
    rng
  );
  state = applyOrThrow(
    state,
    {
      type: "REVEAL_PLAY",
      playerId: players[1],
      payload: {
        choice: npcMove,
        salt: npcSalt
      }
    },
    rng
  );

  return {
    state,
    humanMove,
    npcMove,
    humanHand,
    npcHand,
    publicView: ballotRpsRuleset.getPublicView(state, players[0])
  };
}

function applyOrThrow(
  state: BallotRpsState,
  action: Parameters<typeof ballotRpsRuleset.applyAction>[1],
  rng: DeterministicRng
): BallotRpsState {
  const resolution = ballotRpsRuleset.applyAction(state, action, rng);
  if (!resolution.accepted) {
    throw new Error(resolution.errors.join("; "));
  }
  return resolution.state;
}
