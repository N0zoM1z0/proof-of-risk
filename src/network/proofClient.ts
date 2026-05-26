import type {
  ApiResponse,
  CreateRoomRequest,
  CreateSessionRequest,
  HealthResponse,
  JoinRoomRequest,
  RoomResponse,
  SessionResponse
} from "../server/types";
import type { RoomAction, RoomSnapshot } from "../multiplayer/rooms";
import type { ServerRoomMessage } from "../server/ws";

export type ProofClientConfig = {
  apiUrl: string;
  wsUrl: string;
};

export type ProofClient = ReturnType<typeof createProofClient>;

export function defaultProofClientConfig(locationLike: Pick<Location, "protocol" | "hostname">): ProofClientConfig {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  const apiFromEnv = env.VITE_PROOF_API_URL;
  const wsFromEnv = env.VITE_PROOF_WS_URL;
  const protocol = locationLike.protocol === "https:" ? "https:" : "http:";
  const wsProtocol = protocol === "https:" ? "wss:" : "ws:";
  return {
    apiUrl: trimTrailingSlash(apiFromEnv ?? `${protocol}//${locationLike.hostname}:8787`),
    wsUrl: trimTrailingSlash(wsFromEnv ?? `${wsProtocol}//${locationLike.hostname}:8787/ws`)
  };
}

export function createProofClient(config: ProofClientConfig) {
  const apiUrl = trimTrailingSlash(config.apiUrl);
  const wsUrl = trimTrailingSlash(config.wsUrl);
  return {
    apiUrl,
    wsUrl,
    health: () => request<HealthResponse>(apiUrl, "/health"),
    createSession: (body: CreateSessionRequest) =>
      request<SessionResponse>(apiUrl, "/sessions", { method: "POST", body }),
    createRoom: (body: CreateRoomRequest, token: string) =>
      request<RoomResponse>(apiUrl, "/rooms", { method: "POST", body, token }),
    joinRoom: (roomId: string, body: JoinRoomRequest, token: string) =>
      request<RoomResponse>(apiUrl, `/rooms/${encodeURIComponent(roomId)}/join`, { method: "POST", body, token }),
    getRoom: (roomId: string, viewer?: string) => {
      const query = viewer ? `?viewer=${encodeURIComponent(viewer)}` : "";
      return request<RoomResponse>(apiUrl, `/rooms/${encodeURIComponent(roomId)}${query}`);
    },
    openRoomSocket: () => new RoomSocket(wsUrl)
  };
}

export class RoomSocket {
  private socket?: WebSocket;
  private readonly listeners = new Set<(message: ServerRoomMessage) => void>();

  constructor(private readonly wsUrl: string) {}

  async connect(): Promise<void> {
    if (this.socket?.readyState === WebSocket.OPEN) {
      return;
    }
    const socket = new WebSocket(this.wsUrl);
    this.socket = socket;
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as ServerRoomMessage;
      this.listeners.forEach((listener) => listener(message));
    });
    await new Promise<void>((resolve, reject) => {
      socket.addEventListener("open", () => resolve(), { once: true });
      socket.addEventListener("error", () => reject(new Error(`Unable to connect WebSocket ${this.wsUrl}`)), {
        once: true
      });
    });
  }

  subscribe(listener: (message: ServerRoomMessage) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  send(message: unknown): void {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket is not connected");
    }
    this.socket.send(JSON.stringify(message));
  }

  subscribeRoom(roomId: string, viewer: string): void {
    this.send({ type: "subscribe", roomId, viewer, requestId: `sub:${Date.now()}` });
  }

  submitAction(roomId: string, action: RoomAction, sessionToken: string, requestId = `action:${Date.now()}`): void {
    this.send({ type: "action", roomId, action, sessionToken, requestId });
  }

  close(): void {
    this.socket?.close();
    this.socket = undefined;
    this.listeners.clear();
  }
}

async function request<T>(
  apiUrl: string,
  path: string,
  options: { method?: string; body?: unknown; token?: string } = {}
): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      ...(options.body === undefined ? {} : { "content-type": "application/json" }),
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {})
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const payload = (await response.json()) as ApiResponse<T>;
  if (!payload.ok) {
    throw new Error(payload.error.message);
  }
  return payload.data;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function readBallotViewerHand(snapshot: RoomSnapshot | undefined): string[] {
  const publicView = snapshot?.publicView;
  if (!publicView || typeof publicView !== "object" || !("viewerHand" in publicView)) {
    return [];
  }
  const hand = (publicView as { viewerHand?: unknown }).viewerHand;
  return Array.isArray(hand) ? hand.filter((value): value is string => typeof value === "string") : [];
}

export function readBallotSettlement(snapshot: RoomSnapshot | undefined) {
  const publicView = snapshot?.publicView;
  if (!publicView || typeof publicView !== "object" || !("publicState" in publicView)) {
    return undefined;
  }
  const publicState = (publicView as { publicState?: { result?: unknown } }).publicState;
  const result = publicState?.result;
  if (!result || typeof result !== "object" || !("reason" in result)) {
    return undefined;
  }
  return result as { reason: string; winnerIds: string[] };
}
