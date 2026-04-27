import type { AuditReport } from "../../engine/audit";
import type { GameState, PlayerId, Settlement } from "../../engine/stateMachine";

export type NimCard = 0 | 1 | 2 | 3;
export type ZeroNimPhase = "betting" | "cardCommit" | "cardReveal" | "settled";
export type BetKind = "check" | "call" | "raise" | "fold";

export type ZeroNimPublicState = {
  players: [PlayerId, PlayerId];
  activePlayer: PlayerId;
  nextToAct: PlayerId;
  total: number;
  threshold: number;
  round: number;
  pot: number;
  currentBet: number;
  contributions: Record<PlayerId, number>;
  actedThisBetting: PlayerId[];
  committedCardPlayer?: PlayerId;
  lastRevealed?: { playerId: PlayerId; card: NimCard };
  result?: Settlement;
  audit?: AuditReport;
};

export type ZeroNimPrivateState = {
  hand: NimCard[];
};

export type ZeroNimState = GameState<ZeroNimPublicState, ZeroNimPrivateState> & {
  phase: ZeroNimPhase;
};

export type ZeroNimAction =
  | {
      type: "BET";
      playerId: PlayerId;
      payload: {
        kind: BetKind;
        raiseTo?: number;
      };
    }
  | {
      type: "COMMIT_CARD";
      playerId: PlayerId;
      payload: {
        commitment: string;
      };
    }
  | {
      type: "REVEAL_CARD";
      playerId: PlayerId;
      payload: {
        card: NimCard;
        salt: string;
      };
    };

export type ZeroNimConfig = {
  gameId: string;
  seed: string;
  players: [PlayerId, PlayerId];
  threshold?: number;
  handSize?: number;
};

export function isNimCard(input: unknown): input is NimCard {
  return input === 0 || input === 1 || input === 2 || input === 3;
}
