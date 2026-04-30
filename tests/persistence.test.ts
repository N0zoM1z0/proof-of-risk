import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { exportDemoArtifacts } from "../src/verify/artifacts";
import {
  deriveRankings,
  evaluateAntiSybilSignals,
  JsonFileProofStorage,
  MemoryProofStorage,
  type PlayerProfile,
  type StoredMatch
} from "../src/persistence";

describe("persistence, ranking, and anti-Sybil primitives", () => {
  it("stores and reads players, matches, and replay artifacts in memory", () => {
    const storage = new MemoryProofStorage();
    const players = samplePlayers();
    players.forEach((player) => storage.upsertPlayer(player));
    const artifact = exportDemoArtifacts("persistence-memory")[0];
    if (!artifact) {
      throw new Error("missing replay artifact");
    }
    const match: StoredMatch = {
      matchId: "match:1",
      gameId: artifact.gameId,
      rulesetId: artifact.rulesetId,
      playerIds: ["player:a", "player:b"],
      completedAt: "2026-04-30T00:00:00.000Z",
      settlement: {
        terminal: true,
        winnerIds: ["player:a"],
        balanceDeltas: {
          "player:a": 1,
          "player:b": -1
        },
        reason: "test settlement"
      },
      replayHash: artifact.expectedReplayHash,
      artifactId: "artifact:1"
    };

    storage.saveMatch(match);
    storage.saveArtifact({
      artifactId: "artifact:1",
      matchId: match.matchId,
      replayHash: artifact.expectedReplayHash,
      artifact,
      storedAt: "2026-04-30T00:00:01.000Z"
    });

    expect(storage.getPlayer("player:a")?.displayName).toBe("Analyst");
    expect(storage.getMatch("match:1")?.settlement.winnerIds).toEqual(["player:a"]);
    expect(storage.getArtifact("artifact:1")?.replayHash).toBe(artifact.expectedReplayHash);
    expect(storage.snapshot().artifacts).toHaveLength(1);
  });

  it("persists JSON storage across instances", () => {
    const dir = join(process.cwd(), ".tmp", "persistence-tests");
    const filePath = join(dir, "proof-storage.json");
    rmSync(dir, { force: true, recursive: true });
    mkdirSync(dir, { recursive: true });

    const storage = new JsonFileProofStorage(filePath);
    storage.upsertPlayer(samplePlayers()[0] as PlayerProfile);
    storage.saveMatch({
      matchId: "match:json",
      gameId: "json-game",
      rulesetId: "ballot-rps.v1",
      playerIds: ["player:a", "player:b"],
      completedAt: "2026-04-30T00:00:00.000Z",
      settlement: {
        terminal: true,
        winnerIds: ["player:b"],
        balanceDeltas: {
          "player:a": -2,
          "player:b": 2
        },
        reason: "json persistence test"
      }
    });

    const reloaded = new JsonFileProofStorage(filePath);
    expect(reloaded.getPlayer("player:a")?.displayName).toBe("Analyst");
    expect(reloaded.getMatch("match:json")?.settlement.winnerIds).toEqual(["player:b"]);
  });

  it("derives deterministic rankings from stored virtual settlements", () => {
    const rankings = deriveRankings(samplePlayers(), [
      {
        matchId: "match:1",
        gameId: "game:1",
        rulesetId: "ballot-rps.v1",
        playerIds: ["player:a", "player:b"],
        completedAt: "2026-04-30T00:00:00.000Z",
        settlement: {
          terminal: true,
          winnerIds: ["player:b"],
          balanceDeltas: { "player:a": -1, "player:b": 1 },
          reason: "b wins"
        }
      },
      {
        matchId: "match:2",
        gameId: "game:2",
        rulesetId: "greater-good.v1",
        playerIds: ["player:a", "player:b", "player:c"],
        completedAt: "2026-04-30T00:01:00.000Z",
        settlement: {
          terminal: true,
          winnerIds: ["player:a"],
          balanceDeltas: { "player:a": 5, "player:b": 3, "player:c": 0 },
          reason: "a wins"
        }
      }
    ]);

    expect(rankings.map((entry) => entry.playerId)).toEqual(["player:a", "player:b", "player:c"]);
    expect(rankings[0]).toMatchObject({ wins: 1, matches: 2, score: 14 });
    expect(rankings[1]).toMatchObject({ wins: 1, matches: 2, score: 14 });
  });

  it("emits explicit placeholder anti-Sybil signals without enforcement claims", () => {
    const [first, second] = samplePlayers();
    if (!first || !second) {
      throw new Error("missing sample profiles");
    }
    const signals = evaluateAntiSybilSignals(first, [second], "2026-04-30T00:00:30.000Z");

    expect(signals.every((signal) => signal.placeholder)).toBe(true);
    expect(signals.map((signal) => signal.signal)).toEqual([
      "shared-device-hash-placeholder",
      "shared-ip-hash-placeholder",
      "fresh-account-placeholder"
    ]);
  });
});

function samplePlayers(): PlayerProfile[] {
  return [
    {
      playerId: "player:a",
      displayName: "Analyst",
      createdAt: "2026-04-30T00:00:00.000Z",
      virtualOnly: true,
      sybilHints: {
        deviceHash: "device:shared",
        ipHash: "ip:shared",
        inviteCode: "invite:a"
      }
    },
    {
      playerId: "player:b",
      displayName: "Dominator",
      createdAt: "2026-04-29T00:00:00.000Z",
      virtualOnly: true,
      sybilHints: {
        deviceHash: "device:shared",
        ipHash: "ip:shared",
        inviteCode: "invite:b"
      }
    },
    {
      playerId: "player:c",
      displayName: "Auditor",
      createdAt: "2026-04-28T00:00:00.000Z",
      virtualOnly: true
    }
  ];
}
