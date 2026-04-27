import { stableHash } from "./canonical";
import type { PlayerId } from "./stateMachine";

export type ActionRecord<TPayload = unknown> = {
  index: number;
  gameId: string;
  playerId: PlayerId;
  type: string;
  payload: TPayload;
  turn: number;
  prevHash: string;
  hash: string;
};

export function appendAction<TPayload>(
  log: readonly ActionRecord[],
  entry: Omit<ActionRecord<TPayload>, "index" | "prevHash" | "hash">
): ActionRecord<TPayload> {
  const prevHash = log.at(-1)?.hash ?? "GENESIS";
  const index = log.length;
  const hash = stableHash({ ...entry, index, prevHash });
  return { ...entry, index, prevHash, hash };
}
