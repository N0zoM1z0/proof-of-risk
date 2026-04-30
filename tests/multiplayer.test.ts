import { describe, expect, it } from "vitest";
import { InMemoryRoomServer } from "../src/multiplayer/rooms";
import { makeBallotRpsCommitment } from "../src/gambles/ballotRps/ruleset";
import type { RpsMove } from "../src/gambles/ballotRps/types";
import {
  makeGreaterGoodContributionCommitment,
  makeGreaterGoodVoteCommitment
} from "../src/gambles/greaterGood/ruleset";
import type { ContributionReveal } from "../src/gambles/greaterGood/types";

describe("local multiplayer room protocol", () => {
  it("routes a two-player Ballot RPS flow through a room", () => {
    const seed = "room-ballot";
    const gameId = "room-ballot-game";
    const players = ["player:auditor", "npc:calculator"] as const;
    const voters = Array.from({ length: 9 }, (_, index) => `voter:${index + 1}`);
    const voterChoices: RpsMove[] = [
      "rock",
      "paper",
      "paper",
      "scissors",
      "rock",
      "paper",
      "scissors",
      "paper",
      "rock"
    ];
    const server = new InMemoryRoomServer();

    expect(
      server.createRoom({
        roomId: "ballot-room",
        hostPlayerId: players[0],
        config: {
          gameId,
          seed,
          rulesetId: "ballot-rps.v1",
          players: [...players],
          voters
        }
      }).accepted
    ).toBe(true);
    expect(server.joinRoom("ballot-room", players[1]).accepted).toBe(true);
    expect(server.snapshot("ballot-room", players[0]).status).toBe("active");

    voterChoices.forEach((choice, index) => {
      const voterId = voters[index] as string;
      const salt = `vote-salt:${seed}:${index}`;
      const commitment = makeBallotRpsCommitment(gameId, 0, voterId, choice, salt);
      const commit = server.submitAction("ballot-room", {
        type: "COMMIT_VOTE",
        playerId: voterId,
        payload: { voterId, commitment }
      });
      expect(commit.accepted).toBe(true);
      expect(server.snapshot("ballot-room", players[0]).pendingCommitments.length).toBeGreaterThan(0);
      expect(
        server.submitAction("ballot-room", {
          type: "REVEAL_VOTE",
          playerId: voterId,
          payload: { voterId, choice, salt }
        }).accepted
      ).toBe(true);
    });

    const humanHand = viewerHand(server.snapshot("ballot-room", players[0]).publicView);
    const npcHand = viewerHand(server.snapshot("ballot-room", players[1]).publicView);
    const humanMove = humanHand[0] ?? "rock";
    const npcMove = npcHand[0] ?? "paper";
    const humanSalt = `play-salt:${seed}:human`;
    const npcSalt = `play-salt:${seed}:npc`;

    expect(
      server.submitAction("ballot-room", {
        type: "COMMIT_PLAY",
        playerId: players[0],
        payload: {
          commitment: makeBallotRpsCommitment(gameId, 1, players[0], humanMove, humanSalt)
        }
      }).accepted
    ).toBe(true);
    expect(
      server.submitAction("ballot-room", {
        type: "COMMIT_PLAY",
        playerId: players[1],
        payload: {
          commitment: makeBallotRpsCommitment(gameId, 1, players[1], npcMove, npcSalt)
        }
      }).accepted
    ).toBe(true);
    expect(server.snapshot("ballot-room", players[0]).pendingCommitments).toHaveLength(2);
    expect(
      server.submitAction("ballot-room", {
        type: "REVEAL_PLAY",
        playerId: players[0],
        payload: { choice: humanMove, salt: humanSalt }
      }).accepted
    ).toBe(true);
    expect(
      server.submitAction("ballot-room", {
        type: "REVEAL_PLAY",
        playerId: players[1],
        payload: { choice: npcMove, salt: npcSalt }
      }).accepted
    ).toBe(true);

    const settled = server.snapshot("ballot-room", players[0]);
    expect(settled.status).toBe("settled");
    expect(settled.pendingCommitments).toHaveLength(0);
  });

  it("routes a five-player Greater Good flow through a room", () => {
    const seed = "room-good";
    const gameId = "room-good-game";
    const players = ["player:auditor", "npc:defector", "npc:dominator", "npc:cooperator", "npc:chaos"];
    const server = new InMemoryRoomServer();

    const created = server.createRoom({
      roomId: "good-room",
      hostPlayerId: players[0] as string,
      config: {
        gameId,
        seed,
        rulesetId: "greater-good.v1",
        players,
        maxRounds: 1,
        coinsPerRound: 5
      }
    });
    expect(created.accepted).toBe(true);
    players.slice(1).forEach((playerId) => {
      expect(server.joinRoom("good-room", playerId).accepted).toBe(true);
    });

    const contribution: ContributionReveal = { tax: 3, personal: 2 };
    players.forEach((playerId) => {
      const salt = contributionSalt(seed, 1, playerId);
      expect(
        server.submitAction("good-room", {
          type: "COMMIT_CONTRIBUTION",
          playerId,
          payload: {
            commitment: makeGreaterGoodContributionCommitment(gameId, 1, playerId, contribution, salt)
          }
        }).accepted
      ).toBe(true);
    });
    expect(server.snapshot("good-room", players[0]).pendingCommitments).toHaveLength(5);
    players.forEach((playerId) => {
      expect(
        server.submitAction("good-room", {
          type: "REVEAL_CONTRIBUTION",
          playerId,
          payload: { ...contribution, salt: contributionSalt(seed, 1, playerId) }
        }).accepted
      ).toBe(true);
    });

    players.forEach((playerId, index) => {
      const targetId = players[(index + 1) % players.length] as string;
      const salt = voteSalt(seed, 1, playerId);
      expect(
        server.submitAction("good-room", {
          type: "COMMIT_VOTE",
          playerId,
          payload: {
            commitment: makeGreaterGoodVoteCommitment(gameId, 1, playerId, targetId, salt)
          }
        }).accepted
      ).toBe(true);
    });
    players.forEach((playerId, index) => {
      const targetId = players[(index + 1) % players.length] as string;
      expect(
        server.submitAction("good-room", {
          type: "REVEAL_VOTE",
          playerId,
          payload: { targetId, salt: voteSalt(seed, 1, playerId) }
        }).accepted
      ).toBe(true);
    });

    const settled = server.snapshot("good-room", players[0]);
    expect(settled.status).toBe("settled");
    expect(settled.phase).toBe("settled");
  });

  it("rejects invalid room boundary actions", () => {
    const server = new InMemoryRoomServer();
    const create = server.createRoom({
      roomId: "invalid-room",
      hostPlayerId: "player:auditor",
      config: {
        gameId: "invalid-room-game",
        seed: "invalid-room",
        rulesetId: "ballot-rps.v1",
        players: ["player:auditor", "npc:calculator"],
        voters: Array.from({ length: 9 }, (_, index) => `voter:${index + 1}`)
      }
    });
    expect(create.accepted).toBe(true);
    expect(server.leaveRoom("invalid-room", "player:auditor").accepted).toBe(true);

    const attacker = server.submitAction("invalid-room", {
      type: "COMMIT_PLAY",
      playerId: "attacker",
      payload: { commitment: "fake" }
    });
    expect(attacker.accepted).toBe(false);
    if (attacker.accepted) {
      throw new Error("attacker action unexpectedly accepted");
    }
    expect(attacker.errors).toContain("Actor is not allowed in this room");

    expect(server.joinRoom("invalid-room", "npc:calculator").accepted).toBe(true);
    expect(server.joinRoom("invalid-room", "player:auditor").accepted).toBe(true);
    const mismatchedVoter = server.submitAction("invalid-room", {
      type: "COMMIT_VOTE",
      playerId: "voter:1",
      payload: { voterId: "voter:2", commitment: "fake" }
    });
    expect(mismatchedVoter.accepted).toBe(false);
    if (mismatchedVoter.accepted) {
      throw new Error("mismatched voter action unexpectedly accepted");
    }
    expect(mismatchedVoter.errors).toContain("Vote actor must match payload voterId");
  });
});

function viewerHand(publicView: unknown): RpsMove[] {
  if (typeof publicView !== "object" || publicView === null || !("viewerHand" in publicView)) {
    return [];
  }
  const hand = (publicView as { viewerHand?: unknown }).viewerHand;
  return Array.isArray(hand) ? hand.filter((card): card is RpsMove => isRpsMove(card)) : [];
}

function isRpsMove(value: unknown): value is RpsMove {
  return value === "rock" || value === "paper" || value === "scissors";
}

function contributionSalt(seed: string, round: number, playerId: string): string {
  return `greater-good:contribution:${seed}:${round}:${playerId}`;
}

function voteSalt(seed: string, round: number, playerId: string): string {
  return `greater-good:vote:${seed}:${round}:${playerId}`;
}
