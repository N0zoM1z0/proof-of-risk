import type { RoomAction, RoomConfig, RoomSnapshot } from "../multiplayer/rooms";
import type { RankingEntry } from "../persistence";

export type ApiSuccess<T> = {
  ok: true;
  data: T;
};

export type ApiFailure = {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export type HealthResponse = {
  service: "proof-of-risk-server";
  status: "ok";
  version: string;
};

export type CreateSessionRequest = {
  playerId: string;
  displayName?: string;
};

export type SessionResponse = {
  playerId: string;
  displayName: string;
  token: string;
};

export type CreateRoomRequest = {
  roomId: string;
  hostPlayerId: string;
  config: RoomConfig;
};

export type JoinRoomRequest = {
  playerId: string;
};

export type SubmitActionRequest = {
  action: RoomAction;
};

export type RoomResponse = {
  snapshot: RoomSnapshot;
};

export type RankingsResponse = {
  rankings: RankingEntry[];
};
