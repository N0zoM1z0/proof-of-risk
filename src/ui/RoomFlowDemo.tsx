import { useState } from "react";
import { makeBallotRpsCommitment } from "../gambles/ballotRps/ruleset";
import type { RpsMove } from "../gambles/ballotRps/types";
import { InMemoryRoomServer, type RoomSnapshot } from "../multiplayer/rooms";

const roomId = "ui-ballot-room";
const gameId = "ui-ballot-game";
const seed = "ui-room-flow";
const players = ["player:auditor", "npc:calculator"] as const;
const voters = Array.from({ length: 9 }, (_, index) => `voter:${index + 1}`);
const voterChoices: RpsMove[] = ["rock", "paper", "paper", "scissors", "rock", "paper", "scissors", "paper", "rock"];

type FlowStep = "new" | "created" | "joined" | "voted" | "committed" | "settled";

export function RoomFlowDemo() {
  const [server, setServer] = useState(() => new InMemoryRoomServer());
  const [snapshot, setSnapshot] = useState<RoomSnapshot | undefined>();
  const [step, setStep] = useState<FlowStep>("new");
  const [events, setEvents] = useState<string[]>([]);
  const [error, setError] = useState<string | undefined>();

  const appendEvent = (event: string) => setEvents((current) => [...current, event]);

  const reset = () => {
    setServer(new InMemoryRoomServer());
    setSnapshot(undefined);
    setStep("new");
    setEvents([]);
    setError(undefined);
  };

  const createRoom = () => {
    const result = server.createRoom({
      roomId,
      hostPlayerId: players[0],
      config: {
        gameId,
        seed,
        rulesetId: "ballot-rps.v1",
        players: [...players],
        voters
      }
    });
    commitResult("Room created", result, "created");
  };

  const joinRoom = () => {
    commitResult("NPC joined", server.joinRoom(roomId, players[1]), "joined");
  };

  const runVoting = () => {
    const errors: string[] = [];
    voterChoices.forEach((choice, index) => {
      const voterId = voters[index] as string;
      const salt = voteSalt(index);
      const commit = server.submitAction(roomId, {
        type: "COMMIT_VOTE",
        playerId: voterId,
        payload: { voterId, commitment: makeBallotRpsCommitment(gameId, 0, voterId, choice, salt) }
      });
      if (!commit.accepted) {
        errors.push(...commit.errors);
        return;
      }
      const reveal = server.submitAction(roomId, {
        type: "REVEAL_VOTE",
        playerId: voterId,
        payload: { voterId, choice, salt }
      });
      if (!reveal.accepted) {
        errors.push(...reveal.errors);
      }
    });
    if (errors.length > 0) {
      setError(errors.join("; "));
      return;
    }
    setSnapshot(server.snapshot(roomId, players[0]));
    setStep("voted");
    setError(undefined);
    appendEvent("All voter commitments revealed; hands dealt");
  };

  const commitPlays = () => {
    const current = server.snapshot(roomId, players[0]);
    const humanMove = viewerHand(current)[0] ?? "rock";
    const npcMove = viewerHand(server.snapshot(roomId, players[1]))[0] ?? "paper";
    const humanCommit = server.submitAction(roomId, {
      type: "COMMIT_PLAY",
      playerId: players[0],
      payload: { commitment: makeBallotRpsCommitment(gameId, 1, players[0], humanMove, playSalt(players[0])) }
    });
    if (!humanCommit.accepted) {
      commitResult("Human play rejected", humanCommit, step);
      return;
    }
    const npcCommit = server.submitAction(roomId, {
      type: "COMMIT_PLAY",
      playerId: players[1],
      payload: { commitment: makeBallotRpsCommitment(gameId, 1, players[1], npcMove, playSalt(players[1])) }
    });
    commitResult("Both duelists committed hidden plays", npcCommit, "committed");
  };

  const revealPlays = () => {
    const humanMove = viewerHand(server.snapshot(roomId, players[0]))[0] ?? "rock";
    const npcMove = viewerHand(server.snapshot(roomId, players[1]))[0] ?? "paper";
    const humanReveal = server.submitAction(roomId, {
      type: "REVEAL_PLAY",
      playerId: players[0],
      payload: { choice: humanMove, salt: playSalt(players[0]) }
    });
    if (!humanReveal.accepted) {
      commitResult("Human reveal rejected", humanReveal, step);
      return;
    }
    const npcReveal = server.submitAction(roomId, {
      type: "REVEAL_PLAY",
      playerId: players[1],
      payload: { choice: npcMove, salt: playSalt(players[1]) }
    });
    commitResult("Both plays revealed; match settled", npcReveal, "settled");
  };

  const invalidAction = () => {
    const result = server.submitAction(roomId, {
      type: "COMMIT_PLAY",
      playerId: "attacker",
      payload: { commitment: "fake" }
    });
    if (!result.accepted) {
      setError(result.errors.join("; "));
      appendEvent("Rejected invalid actor");
    }
  };

  const commitResult = (
    event: string,
    result: ReturnType<InMemoryRoomServer["createRoom"]>,
    nextStep: FlowStep
  ) => {
    if (!result.accepted) {
      setError(result.errors.join("; "));
      return;
    }
    setSnapshot(result.snapshot);
    setStep(nextStep);
    setError(undefined);
    appendEvent(event);
  };

  const result = readSettlement(snapshot);

  return (
    <section className="roomFlow" aria-labelledby="room-flow-heading">
      <div className="labHeader">
        <div>
          <p className="eyebrow">Productionization skeleton</p>
          <h2 id="room-flow-heading">Room Flow Console</h2>
          <p>
            A browser-driven room lifecycle: create, join, execute committed votes,
            commit hidden plays, reveal them, and inspect the terminal settlement.
          </p>
        </div>
        <div className="metricCard" data-testid="room-flow-status">
          <strong>{snapshot?.status ?? "idle"}</strong>
          <span>{snapshot?.phase ?? "not created"}</span>
        </div>
      </div>

      <div className="flowControls" aria-label="Room flow controls">
        <button type="button" onClick={createRoom} disabled={step !== "new"}>
          Create room
        </button>
        <button type="button" onClick={joinRoom} disabled={step !== "created"}>
          Join NPC
        </button>
        <button type="button" onClick={runVoting} disabled={step !== "joined"}>
          Run voter commit/reveal
        </button>
        <button type="button" onClick={commitPlays} disabled={step !== "voted"}>
          Commit plays
        </button>
        <button type="button" onClick={revealPlays} disabled={step !== "committed"}>
          Reveal plays
        </button>
        <button type="button" onClick={invalidAction} disabled={step === "new"}>
          Try invalid actor
        </button>
        <button type="button" onClick={reset}>
          Reset flow
        </button>
      </div>

      {error ? (
        <p className="errorText" role="alert" data-testid="room-flow-error">
          {error}
        </p>
      ) : null}

      <div className="flowGrid">
        <article className="panel">
          <h3>Snapshot</h3>
          <dl className="facts">
            <div>
              <dt>Room</dt>
              <dd>{snapshot?.roomId ?? roomId}</dd>
            </div>
            <div>
              <dt>Members</dt>
              <dd>{snapshot?.members.join(", ") ?? "none"}</dd>
            </div>
            <div>
              <dt>Pending commits</dt>
              <dd data-testid="room-flow-pending">{snapshot?.pendingCommitments.length ?? 0}</dd>
            </div>
          </dl>
        </article>
        <article className="panel">
          <h3>Settlement</h3>
          <p data-testid="room-flow-settlement">{result?.reason ?? "Not settled"}</p>
          <p>Winners: {result?.winnerIds.join(", ") || "none"}</p>
        </article>
        <article className="panel wide">
          <h3>Event trail</h3>
          <ol className="eventTrail">
            {events.map((event, index) => (
              <li key={`${event}-${index}`}>{event}</li>
            ))}
          </ol>
        </article>
      </div>
    </section>
  );
}

function voteSalt(index: number): string {
  return `ui-vote-salt:${seed}:${index}`;
}

function playSalt(playerId: string): string {
  return `ui-play-salt:${seed}:${playerId}`;
}

function viewerHand(snapshot: RoomSnapshot): RpsMove[] {
  const publicView = snapshot.publicView;
  if (typeof publicView !== "object" || publicView === null || !("viewerHand" in publicView)) {
    return [];
  }
  const hand = (publicView as { viewerHand?: unknown }).viewerHand;
  return Array.isArray(hand) ? hand.filter((card): card is RpsMove => isRpsMove(card)) : [];
}

function readSettlement(snapshot: RoomSnapshot | undefined) {
  const publicView = snapshot?.publicView;
  if (typeof publicView !== "object" || publicView === null || !("publicState" in publicView)) {
    return undefined;
  }
  const publicState = (publicView as { publicState?: { result?: unknown } }).publicState;
  const result = publicState?.result;
  if (typeof result !== "object" || result === null || !("reason" in result)) {
    return undefined;
  }
  return result as { reason: string; winnerIds: string[] };
}

function isRpsMove(value: unknown): value is RpsMove {
  return value === "rock" || value === "paper" || value === "scissors";
}
