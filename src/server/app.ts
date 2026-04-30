import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";
import { InMemoryRoomServer } from "../multiplayer/rooms";
import { deriveRankings, MemoryAppDatabase, type PlayerProfile } from "../persistence";
import type {
  ApiFailure,
  ApiResponse,
  CreateRoomRequest,
  CreateSessionRequest,
  HealthResponse,
  JoinRoomRequest,
  RankingsResponse,
  RoomResponse,
  SessionResponse,
  SubmitActionRequest
} from "./types";

export type ProofServerContext = {
  rooms: InMemoryRoomServer;
  storage: MemoryAppDatabase;
  now: () => Date;
  issueToken: () => string;
  sessionTtlMs: number;
};

export type ProofServerOptions = {
  rooms?: InMemoryRoomServer;
  storage?: MemoryAppDatabase;
  now?: () => Date;
  issueToken?: () => string;
  sessionTtlMs?: number;
};

export function createProofServerContext(options: ProofServerOptions = {}): ProofServerContext {
  return {
    rooms: options.rooms ?? new InMemoryRoomServer(),
    storage: options.storage ?? new MemoryAppDatabase(),
    now: options.now ?? (() => new Date()),
    issueToken: options.issueToken ?? (() => randomUUID()),
    sessionTtlMs: options.sessionTtlMs ?? 24 * 60 * 60 * 1000
  };
}

export function createProofServer(options: ProofServerOptions = {}) {
  return createProofHttpServer(createProofServerContext(options));
}

export function createProofHttpServer(context: ProofServerContext) {
  return createServer((request, response) => {
    handleProofRequest(context, request, response).catch((error: unknown) => {
      sendJson(response, 500, failure("internal_error", error instanceof Error ? error.message : "Unexpected error"));
    });
  });
}

export async function handleProofRequest(
  context: ProofServerContext,
  request: IncomingMessage,
  response: ServerResponse
) {
  const method = request.method ?? "GET";
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  if (method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }
  if (method === "GET" && url.pathname === "/health") {
    sendJson<HealthResponse>(response, 200, {
      service: "proof-of-risk-server",
      status: "ok",
      version: "0.1.0"
    });
    return;
  }
  if (method === "POST" && url.pathname === "/sessions") {
    const body = await readJson<CreateSessionRequest>(request);
    const playerId = asNonEmptyString(body.playerId);
    if (!playerId) {
      sendJson(response, 400, failure("invalid_request", "playerId is required"));
      return;
    }
    const displayName = asNonEmptyString(body.displayName) ?? playerId;
    const profile: PlayerProfile = {
      playerId,
      displayName,
      createdAt: context.now().toISOString(),
      virtualOnly: true
    };
    const accountId = `account:${playerId}`;
    const now = context.now();
    const expiresAt = new Date(now.getTime() + context.sessionTtlMs).toISOString();
    const token = `por_${context.issueToken()}`;
    context.storage.upsertPlayer(profile);
    context.storage.upsertAccount({
      accountId,
      playerId,
      displayName,
      createdAt: now.toISOString(),
      virtualOnly: true
    });
    context.storage.createSession({
      sessionId: `session:${context.issueToken()}`,
      accountId,
      playerId,
      rawToken: token,
      createdAt: now.toISOString(),
      expiresAt
    });
    sendJson<SessionResponse>(response, 201, {
      accountId,
      playerId,
      displayName,
      token,
      expiresAt
    });
    return;
  }
  if (method === "POST" && url.pathname === "/rooms") {
    const authFailure = requireSession(context, request);
    if (authFailure) {
      sendJson(response, 401, authFailure);
      return;
    }
    const body = await readJson<CreateRoomRequest>(request);
    if (!body.roomId || !body.hostPlayerId || !body.config) {
      sendJson(response, 400, failure("invalid_request", "roomId, hostPlayerId, and config are required"));
      return;
    }
    const result = context.rooms.createRoom(body);
    if (!result.accepted) {
      sendJson(response, 400, failure("room_rejected", result.errors.join("; "), result.errors));
      return;
    }
    sendJson<RoomResponse>(response, 201, { snapshot: result.snapshot });
    return;
  }

  const roomJoin = url.pathname.match(/^\/rooms\/([^/]+)\/join$/);
  if (method === "POST" && roomJoin) {
    const authFailure = requireSession(context, request);
    if (authFailure) {
      sendJson(response, 401, authFailure);
      return;
    }
    const body = await readJson<JoinRoomRequest>(request);
    const playerId = asNonEmptyString(body.playerId);
    if (!playerId) {
      sendJson(response, 400, failure("invalid_request", "playerId is required"));
      return;
    }
    const result = context.rooms.joinRoom(decodeURIComponent(roomJoin[1] ?? ""), playerId);
    if (!result.accepted) {
      sendJson(response, 400, failure("room_rejected", result.errors.join("; "), result.errors));
      return;
    }
    sendJson<RoomResponse>(response, 200, { snapshot: result.snapshot });
    return;
  }

  const roomAction = url.pathname.match(/^\/rooms\/([^/]+)\/actions$/);
  if (method === "POST" && roomAction) {
    const authFailure = requireSession(context, request);
    if (authFailure) {
      sendJson(response, 401, authFailure);
      return;
    }
    const body = await readJson<SubmitActionRequest>(request);
    if (!body.action) {
      sendJson(response, 400, failure("invalid_request", "action is required"));
      return;
    }
    const result = context.rooms.submitAction(decodeURIComponent(roomAction[1] ?? ""), body.action);
    if (!result.accepted) {
      sendJson(response, 400, failure("room_rejected", result.errors.join("; "), result.errors));
      return;
    }
    sendJson<RoomResponse>(response, 200, { snapshot: result.snapshot });
    return;
  }

  const roomSnapshot = url.pathname.match(/^\/rooms\/([^/]+)$/);
  if (method === "GET" && roomSnapshot) {
    try {
      const snapshot = context.rooms.snapshot(
        decodeURIComponent(roomSnapshot[1] ?? ""),
        url.searchParams.get("viewer") ?? undefined
      );
      sendJson<RoomResponse>(response, 200, { snapshot });
    } catch (error: unknown) {
      sendJson(response, 404, failure("not_found", error instanceof Error ? error.message : "Room not found"));
    }
    return;
  }

  if (method === "GET" && url.pathname === "/rankings") {
    sendJson<RankingsResponse>(response, 200, {
      rankings: deriveRankings(context.storage.listPlayers(), context.storage.listMatches())
    });
    return;
  }

  sendJson(response, 404, failure("not_found", `No route for ${method} ${url.pathname}`));
}

async function readJson<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) {
    return {} as T;
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
}

function sendJson<T>(response: ServerResponse, statusCode: number, payload: T): void {
  response.writeHead(statusCode, {
    "access-control-allow-headers": "content-type, authorization",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-origin": "*",
    "content-type": "application/json; charset=utf-8"
  });
  if (statusCode === 204) {
    response.end();
    return;
  }
  response.end(JSON.stringify(statusCode >= 400 ? payload : success(payload)));
}

function success<T>(data: T): ApiResponse<T> {
  return { ok: true, data };
}

function failure(code: string, message: string, details?: unknown): ApiFailure {
  return { ok: false, error: { code, message, details } };
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

export function authenticateRequest(context: ProofServerContext, request: IncomingMessage): string | undefined {
  const authorization = request.headers.authorization;
  const token = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : undefined;
  if (!token) {
    return undefined;
  }
  return context.storage.findValidSessionByToken(token, context.now().toISOString())?.playerId;
}

export function authenticateToken(context: ProofServerContext, token: string | undefined): string | undefined {
  if (!token) {
    return undefined;
  }
  return context.storage.findValidSessionByToken(token, context.now().toISOString())?.playerId;
}

function requireSession(context: ProofServerContext, request: IncomingMessage): ApiFailure | undefined {
  return authenticateRequest(context, request)
    ? undefined
    : failure("unauthorized", "A valid Bearer session token is required");
}
