import { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createProofServer } from "../src/server/app";
import { makeBallotRpsCommitment } from "../src/gambles/ballotRps/ruleset";
import type { RpsMove } from "../src/gambles/ballotRps/types";

type TestServer = ReturnType<typeof createProofServer>;

let server: TestServer;
let baseUrl = "";

beforeEach(async () => {
  server = createProofServer({
    issueToken: () => "fixed-token",
    now: () => new Date("2026-04-30T00:00:00.000Z")
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

describe("HTTP proof server", () => {
  it("serves health, sessions, room lifecycle, actions, snapshots, and rankings", async () => {
    let token = "";
    await expectJson("GET", "/health", undefined, 200, (body) => {
      expect(body.data.status).toBe("ok");
    });

    await expectJson("POST", "/sessions", { playerId: "player:auditor", displayName: "Auditor" }, 201, (body) => {
      expect(body.data.accountId).toBe("account:player:auditor");
      expect(body.data.playerId).toBe("player:auditor");
      expect(body.data.token).toMatch(/^por_/);
      expect(body.data.expiresAt).toBe("2026-05-01T00:00:00.000Z");
      token = body.data.token;
    });

    const seed = "server-ballot";
    const gameId = "server-ballot-game";
    const players = ["player:auditor", "npc:calculator"];
    const voters = Array.from({ length: 9 }, (_, index) => `voter:${index + 1}`);
    await expectJson(
      "POST",
      "/rooms",
      {
        roomId: "server-room",
        hostPlayerId: players[0],
        config: {
          gameId,
          seed,
          rulesetId: "ballot-rps.v1",
          players,
          voters
        }
      },
      201,
      (body) => {
        expect(body.data.snapshot.status).toBe("open");
      },
      token
    );

    await expectJson("POST", "/rooms/server-room/join", { playerId: players[1] }, 200, (body) => {
      expect(body.data.snapshot.status).toBe("active");
    }, token);

    const choices: RpsMove[] = ["rock", "paper", "paper", "scissors", "rock", "paper", "scissors", "paper", "rock"];
    for (const [index, choice] of choices.entries()) {
      const voterId = voters[index] as string;
      const salt = `vote-salt:${seed}:${index}`;
      await expectJson(
        "POST",
        "/rooms/server-room/actions",
        {
          action: {
            type: "COMMIT_VOTE",
            playerId: voterId,
            payload: { voterId, commitment: makeBallotRpsCommitment(gameId, 0, voterId, choice, salt) }
          }
        },
        200,
        undefined,
        token
      );
      await expectJson(
        "POST",
        "/rooms/server-room/actions",
        {
          action: {
            type: "REVEAL_VOTE",
            playerId: voterId,
            payload: { voterId, choice, salt }
          }
        },
        200,
        undefined,
        token
      );
    }

    await expectJson("GET", "/rooms/server-room?viewer=player%3Aauditor", undefined, 200, (body) => {
      expect(body.data.snapshot.phase).toBe("playCommit");
      expect(body.data.snapshot.publicView.viewerHand.length).toBeGreaterThan(0);
    });
    await expectJson("GET", "/rankings", undefined, 200, (body) => {
      expect(body.data.rankings).toEqual([
        {
          displayName: "Auditor",
          matches: 0,
          playerId: "player:auditor",
          score: 0,
          wins: 0
        }
      ]);
    });
  });

  it("returns stable JSON errors for invalid requests", async () => {
    await expectJson("POST", "/rooms/missing/actions", { action: { type: "NOPE", playerId: "p", payload: {} } }, 401, (body) => {
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe("unauthorized");
    });
    await expectJson("GET", "/missing", undefined, 404, (body) => {
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe("not_found");
    });
  });
});

async function expectJson(
  method: string,
  path: string,
  body: unknown,
  expectedStatus: number,
  assertBody?: (body: any) => void,
  token?: string
) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  expect(response.status).toBe(expectedStatus);
  const json = await response.json();
  assertBody?.(json);
  return json;
}
