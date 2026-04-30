import type { AuditReport } from "../../engine/audit";
import type { GameState, PlayerId, Settlement } from "../../engine/stateMachine";

export type DieId = "ember" | "granite" | "tide";
export type DicePhase = "playerPick" | "dealerPick" | "rolling" | "settled";
export type RoundWinner = "player" | "dealer" | "tie";

export type DiceRound = {
  round: number;
  playerRoll: number;
  dealerRoll: number;
  winner: RoundWinner;
};

export type NontransitiveDicePublicState = {
  players: [PlayerId, PlayerId];
  roundCount: number;
  playerDie?: DieId;
  dealerDie?: DieId;
  rounds: DiceRound[];
  playerWins: number;
  dealerWins: number;
  result?: Settlement;
  audit?: AuditReport;
};

export type NontransitiveDicePrivateState = Record<string, never>;

export type NontransitiveDiceState = GameState<NontransitiveDicePublicState, NontransitiveDicePrivateState> & {
  phase: DicePhase;
};

export type NontransitiveDiceAction =
  | {
      type: "PICK_DIE";
      playerId: PlayerId;
      payload: { die: DieId };
    }
  | {
      type: "COUNTER_PICK_DIE";
      playerId: PlayerId;
      payload: { die: DieId };
    }
  | {
      type: "ROLL_PAIR";
      playerId: PlayerId;
      payload: { round: number; playerRoll?: number; dealerRoll?: number; winner?: RoundWinner };
    };

export type NontransitiveDiceConfig = {
  gameId: string;
  seed: string;
  players: [PlayerId, PlayerId];
  roundCount?: number;
};
