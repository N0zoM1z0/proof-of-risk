import { AddressInfo } from "node:net";
import WebSocket from "ws";
import { makeBallotRpsCommitment } from "../gambles/ballotRps/ruleset";
import type { RpsMove } from "../gambles/ballotRps/types";
import { createProofHttpServer, createProofServerContext } from "./app";
import { attachRoomWebSocketProtocol, type ServerRoomMessage } from "./ws";

type Metrics = {
  sessions: number;
  rooms: number;
  joins: number;
  snapshots: number;
  websocketSubscribes: number;
  websocketAcceptedActions: number;
  websocketRejectedActions: number;
  failures: string[];
};

const roomCount = Number.parseInt(process.env.LOAD_ROOMS ?? "6", 10);

async function main() {
  const context = createProofServerContext();
  const server = createProofHttpServer(context);
  const webSocketServer = attachRoomWebSocketProtocol(server, context);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  const baseHttpUrl = `http://127.0.0.1:${port}`;
  const baseWsUrl = `ws://127.0.0.1:${port}/ws`;
  const metrics: Metrics = {
    sessions: 0,
    rooms: 0,
    joins: 0,
    snapshots: 0,
    websocketSubscribes: 0,
    websocketAcceptedActions: 0,
    websocketRejectedActions: 0,
    failures: []
  };

  try {
    await Promise.all(
      Array.from({ length: roomCount }, async (_, index) => {
        try {
          await exerciseRoom(baseHttpUrl, baseWsUrl, index, metrics);
        } catch (error: unknown) {
          metrics.failures.push(error instanceof Error ? error.message : String(error));
        }
      })
    );
  } finally {
    for (const client of webSocketServer.clients) {
      client.close();
    }
    await new Promise<void>((resolve) => webSocketServer.close(() => resolve()));
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }

  const report = {
    roomsRequested: roomCount,
    passed: metrics.failures.length === 0,
    metrics
  };
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) {
    process.exitCode = 1;
  }
}

async function exerciseRoom(baseHttpUrl: string, baseWsUrl: string, index: number, metrics: Metrics) {
  const hostPlayerId = `player:load:${index}`;
  const npcPlayerId = `npc:load:${index}`;
  const roomId = `load-room-${index}`;
  const gameId = `load-game-${index}`;
  const seed = `load-seed-${index}`;
  const voters = Array.from({ length: 9 }, (_, voterIndex) => `voter:${index}:${voterIndex + 1}`);
  const token = await createSession(baseHttpUrl, hostPlayerId, metrics);

  await postJson(
    baseHttpUrl,
    "/rooms",
    {
      roomId,
      hostPlayerId,
      config: {
        gameId,
        seed,
        rulesetId: "ballot-rps.v1",
        players: [hostPlayerId, npcPlayerId],
        voters
      }
    },
    token
  );
  metrics.rooms += 1;

  await postJson(baseHttpUrl, `/rooms/${encodeURIComponent(roomId)}/join`, { playerId: npcPlayerId }, token);
  metrics.joins += 1;

  await getJson(baseHttpUrl, `/rooms/${encodeURIComponent(roomId)}?viewer=${encodeURIComponent(hostPlayerId)}`);
  metrics.snapshots += 1;

  const client = await openClient(baseWsUrl);
  try {
    client.send(JSON.stringify({ type: "subscribe", roomId, viewer: hostPlayerId, requestId: `sub:${index}` }));
    await expectMessage(client, (message) => message.type === "subscribed" && message.requestId === `sub:${index}`);
    metrics.websocketSubscribes += 1;

    client.send(
      JSON.stringify({
        type: "action",
        roomId,
        requestId: `reject:${index}`,
        action: {
          type: "COMMIT_PLAY",
          playerId: "attacker",
          payload: { commitment: "fake" }
        }
      })
    );
    await expectMessage(client, (message) => message.type === "ack" && !message.accepted && message.requestId === `reject:${index}`);
    metrics.websocketRejectedActions += 1;

    const voterId = voters[0] as string;
    const choice: RpsMove = "rock";
    const salt = `load-vote-salt:${index}`;
    client.send(
      JSON.stringify({
        type: "action",
        roomId,
        requestId: `accept:${index}`,
        sessionToken: token,
        action: {
          type: "COMMIT_VOTE",
          playerId: voterId,
          payload: {
            voterId,
            commitment: makeBallotRpsCommitment(gameId, 0, voterId, choice, salt)
          }
        }
      })
    );
    await expectMessage(client, (message) => message.type === "ack" && message.accepted && message.requestId === `accept:${index}`);
    metrics.websocketAcceptedActions += 1;
  } finally {
    client.close();
  }
}

async function createSession(baseHttpUrl: string, playerId: string, metrics: Metrics): Promise<string> {
  const body = await postJson(baseHttpUrl, "/sessions", { playerId, displayName: playerId });
  metrics.sessions += 1;
  const token = body.data?.token;
  if (typeof token !== "string") {
    throw new Error(`Session token missing for ${playerId}`);
  }
  return token;
}

async function postJson(baseHttpUrl: string, path: string, body: unknown, token?: string) {
  const response = await fetch(`${baseHttpUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
  const json = await response.json();
  if (!response.ok || !json.ok) {
    throw new Error(`POST ${path} failed: ${JSON.stringify(json)}`);
  }
  return json;
}

async function getJson(baseHttpUrl: string, path: string) {
  const response = await fetch(`${baseHttpUrl}${path}`);
  const json = await response.json();
  if (!response.ok || !json.ok) {
    throw new Error(`GET ${path} failed: ${JSON.stringify(json)}`);
  }
  return json;
}

async function openClient(baseWsUrl: string): Promise<WebSocket> {
  const client = new WebSocket(baseWsUrl);
  await new Promise<void>((resolve, reject) => {
    client.once("open", () => resolve());
    client.once("error", reject);
  });
  return client;
}

async function expectMessage(client: WebSocket, predicate: (message: ServerRoomMessage) => boolean): Promise<ServerRoomMessage> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      client.off("message", onMessage);
      reject(new Error("Timed out waiting for WebSocket load-test message"));
    }, 1500);
    const onMessage = (raw: WebSocket.RawData) => {
      const message = JSON.parse(raw.toString()) as ServerRoomMessage;
      if (!predicate(message)) {
        return;
      }
      clearTimeout(timeout);
      client.off("message", onMessage);
      resolve(message);
    };
    client.on("message", onMessage);
  });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
