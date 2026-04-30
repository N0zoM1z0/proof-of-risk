import type { Server as HttpServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import type { RoomAction, RoomSnapshot } from "../multiplayer/rooms";
import { authenticateToken, type ProofServerContext } from "./app";

export type ClientRoomMessage =
  | {
      type: "subscribe";
      roomId: string;
      viewer?: string;
      requestId?: string;
    }
  | {
      type: "action";
      roomId: string;
      action: RoomAction;
      sessionToken?: string;
      requestId?: string;
    }
  | {
      type: "ping";
      requestId?: string;
    };

export type ServerRoomMessage =
  | {
      type: "subscribed";
      roomId: string;
      snapshot: RoomSnapshot;
      requestId?: string;
    }
  | {
      type: "snapshot";
      roomId: string;
      snapshot: RoomSnapshot;
    }
  | {
      type: "ack";
      accepted: true;
      roomId: string;
      snapshot: RoomSnapshot;
      requestId?: string;
    }
  | {
      type: "ack";
      accepted: false;
      roomId?: string;
      errors: string[];
      requestId?: string;
    }
  | {
      type: "pong";
      requestId?: string;
    }
  | {
      type: "error";
      code: string;
      message: string;
      requestId?: string;
    };

type ClientSubscription = {
  roomId: string;
  viewer?: string;
};

export function attachRoomWebSocketProtocol(server: HttpServer, context: ProofServerContext) {
  const webSocketServer = new WebSocketServer({ server, path: "/ws" });
  const subscriptions = new Map<WebSocket, ClientSubscription>();

  webSocketServer.on("connection", (socket) => {
    socket.on("message", (raw) => {
      const parsed = parseClientMessage(raw.toString("utf8"));
      if (!parsed.ok) {
        send(socket, { type: "error", code: "invalid_json", message: parsed.error });
        return;
      }
      const message = parsed.message;
      if (message.type === "ping") {
        send(socket, { type: "pong", requestId: message.requestId });
        return;
      }
      if (message.type === "subscribe") {
        handleSubscribe(socket, context, subscriptions, message);
        return;
      }
      if (message.type === "action") {
        handleAction(socket, context, subscriptions, message);
        return;
      }
      send(socket, {
        type: "error",
        code: "unsupported_message",
        message: "Unsupported WebSocket message",
        requestId: (message as { requestId?: string }).requestId
      });
    });
    socket.on("close", () => {
      subscriptions.delete(socket);
    });
  });

  return webSocketServer;
}

function handleSubscribe(
  socket: WebSocket,
  context: ProofServerContext,
  subscriptions: Map<WebSocket, ClientSubscription>,
  message: Extract<ClientRoomMessage, { type: "subscribe" }>
) {
  try {
    const snapshot = context.rooms.snapshot(message.roomId, message.viewer);
    subscriptions.set(socket, { roomId: message.roomId, viewer: message.viewer });
    send(socket, {
      type: "subscribed",
      roomId: message.roomId,
      snapshot,
      requestId: message.requestId
    });
  } catch (error: unknown) {
    send(socket, {
      type: "error",
      code: "room_not_found",
      message: error instanceof Error ? error.message : "Room not found",
      requestId: message.requestId
    });
  }
}

function handleAction(
  socket: WebSocket,
  context: ProofServerContext,
  subscriptions: Map<WebSocket, ClientSubscription>,
  message: Extract<ClientRoomMessage, { type: "action" }>
) {
  if (!authenticateToken(context, message.sessionToken)) {
    send(socket, {
      type: "ack",
      accepted: false,
      roomId: message.roomId,
      errors: ["A valid sessionToken is required"],
      requestId: message.requestId
    });
    return;
  }
  const result = context.rooms.submitAction(message.roomId, message.action);
  if (!result.accepted) {
    send(socket, {
      type: "ack",
      accepted: false,
      roomId: message.roomId,
      errors: result.errors,
      requestId: message.requestId
    });
    return;
  }
  send(socket, {
    type: "ack",
    accepted: true,
    roomId: message.roomId,
    snapshot: result.snapshot,
    requestId: message.requestId
  });
  broadcastRoomSnapshot(context, subscriptions, message.roomId);
}

function broadcastRoomSnapshot(
  context: ProofServerContext,
  subscriptions: Map<WebSocket, ClientSubscription>,
  roomId: string
) {
  for (const [socket, subscription] of subscriptions) {
    if (socket.readyState !== socket.OPEN || subscription.roomId !== roomId) {
      continue;
    }
    send(socket, {
      type: "snapshot",
      roomId,
      snapshot: context.rooms.snapshot(roomId, subscription.viewer)
    });
  }
}

function parseClientMessage(raw: string): { ok: true; message: ClientRoomMessage } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(raw) as ClientRoomMessage;
    if (!parsed || typeof parsed !== "object" || typeof parsed.type !== "string") {
      return { ok: false, error: "Message must be a JSON object with a type" };
    }
    return { ok: true, message: parsed };
  } catch (error: unknown) {
    return { ok: false, error: error instanceof Error ? error.message : "Invalid JSON" };
  }
}

function send(socket: WebSocket, message: ServerRoomMessage): void {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}
