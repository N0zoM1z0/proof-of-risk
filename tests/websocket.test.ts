import { AddressInfo } from "node:net";
import WebSocket from "ws";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeBallotRpsCommitment } from "../src/gambles/ballotRps/ruleset";
import { createProofHttpServer, createProofServerContext } from "../src/server/app";
import { attachRoomWebSocketProtocol, type ServerRoomMessage } from "../src/server/ws";

type TestServer = ReturnType<typeof createProofHttpServer>;
type TestWss = ReturnType<typeof attachRoomWebSocketProtocol>;

let context: ReturnType<typeof createProofServerContext>;
let server: TestServer;
let webSocketServer: TestWss;
let baseWsUrl = "";

beforeEach(async () => {
  context = createProofServerContext({
    issueToken: () => "fixed-token",
    now: () => new Date("2026-04-30T00:00:00.000Z")
  });
  server = createProofHttpServer(context);
  webSocketServer = attachRoomWebSocketProtocol(server, context);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  baseWsUrl = `ws://127.0.0.1:${address.port}/ws`;
});

afterEach(async () => {
  for (const client of webSocketServer.clients) {
    client.close();
  }
  await new Promise<void>((resolve) => webSocketServer.close(() => resolve()));
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

describe("WebSocket room protocol", () => {
  it("syncs room snapshots across two subscribed clients", async () => {
    const seed = "ws-ballot";
    const gameId = "ws-ballot-game";
    const voters = Array.from({ length: 9 }, (_, index) => `voter:${index + 1}`);
    expect(
      context.rooms.createRoom({
        roomId: "ws-room",
        hostPlayerId: "player:auditor",
        config: {
          gameId,
          seed,
          rulesetId: "ballot-rps.v1",
          players: ["player:auditor", "npc:calculator"],
          voters
        }
      }).accepted
    ).toBe(true);
    expect(context.rooms.joinRoom("ws-room", "npc:calculator").accepted).toBe(true);

    const clientA = await openClient();
    const clientB = await openClient();
    const subscribedA = expectMessage(clientA, (message) => message.type === "subscribed" && message.requestId === "sub-a");
    const subscribedB = expectMessage(clientB, (message) => message.type === "subscribed" && message.requestId === "sub-b");
    clientA.send(JSON.stringify({ type: "subscribe", roomId: "ws-room", viewer: "player:auditor", requestId: "sub-a" }));
    clientB.send(JSON.stringify({ type: "subscribe", roomId: "ws-room", viewer: "npc:calculator", requestId: "sub-b" }));

    await subscribedA;
    await subscribedB;

    const voterId = voters[0] as string;
    const choice = "rock";
    const salt = "ws-vote-salt";
    const ackA = expectMessage(
      clientA,
      (message) => message.type === "ack" && message.accepted && message.requestId === "vote-1"
    );
    const snapshotA = expectMessage(
      clientA,
      (message) => message.type === "snapshot" && message.snapshot.pendingCommitments.length === 1
    );
    const snapshotB = expectMessage(
      clientB,
      (message) => message.type === "snapshot" && message.snapshot.pendingCommitments.length === 1
    );
    clientA.send(
      JSON.stringify({
        type: "action",
        roomId: "ws-room",
        requestId: "vote-1",
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

    await ackA;
    await snapshotA;
    await snapshotB;

    clientA.close();
    clientB.close();
  });

  it("returns structured protocol errors without closing the socket", async () => {
    const client = await openClient();
    client.send("{bad-json");
    await expectMessage(client, (message) => message.type === "error" && message.code === "invalid_json");

    client.send(JSON.stringify({ type: "ping", requestId: "still-open" }));
    await expectMessage(client, (message) => message.type === "pong" && message.requestId === "still-open");
    client.close();
  });
});

async function openClient(): Promise<WebSocket> {
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
      reject(new Error("Timed out waiting for WebSocket message"));
    }, 1000);
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
