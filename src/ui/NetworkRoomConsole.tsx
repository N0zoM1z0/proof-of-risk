import { useEffect, useRef, useState } from "react";
import { makeBallotRpsCommitment } from "../gambles/ballotRps/ruleset";
import type { RpsMove } from "../gambles/ballotRps/types";
import type { RoomSnapshot } from "../multiplayer/rooms";
import {
  createProofClient,
  defaultProofClientConfig,
  readBallotSettlement,
  readBallotViewerHand,
  type ProofClientConfig,
  type RoomSocket
} from "../network/proofClient";

const hostPlayerId = "player:lan-auditor";
const npcPlayerId = "npc:lan-calculator";
const voters = Array.from({ length: 9 }, (_, index) => `voter:${index + 1}`);
const voterChoices: RpsMove[] = ["rock", "paper", "paper", "scissors", "rock", "paper", "scissors", "paper", "rock"];

type NetworkStep = "idle" | "session" | "created" | "joined" | "subscribed" | "voted" | "committed" | "settled";

export function NetworkRoomConsole() {
  const [config, setConfig] = useState<ProofClientConfig>(() =>
    defaultProofClientConfig(
      typeof window === "undefined" ? { protocol: "http:", hostname: "127.0.0.1" } : window.location
    )
  );
  const [playerId, setPlayerId] = useState(hostPlayerId);
  const [displayName, setDisplayName] = useState("LAN Auditor");
  const [seed, setSeed] = useState("lan-network-room");
  const [roomId, setRoomId] = useState(() => `lan-room-${Date.now().toString(36)}`);
  const [token, setToken] = useState("");
  const [step, setStep] = useState<NetworkStep>("idle");
  const [snapshot, setSnapshot] = useState<RoomSnapshot | undefined>();
  const [events, setEvents] = useState<string[]>([]);
  const [error, setError] = useState<string | undefined>();
  const socketRef = useRef<RoomSocket | undefined>(undefined);

  useEffect(() => {
    return () => socketRef.current?.close();
  }, []);

  const client = createProofClient(config);
  const appendEvent = (event: string) => setEvents((current) => [...current, event]);

  const run = async (event: string, action: () => Promise<void>) => {
    try {
      setError(undefined);
      await action();
      appendEvent(event);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const createSession = () =>
    run("Session issued by LAN server", async () => {
      const session = await client.createSession({ playerId, displayName });
      setToken(session.token);
      setStep("session");
    });

  const createRoom = () =>
    run("Room created through HTTP API", async () => {
      const response = await client.createRoom(
        {
          roomId,
          hostPlayerId: playerId,
          config: {
            gameId: `${roomId}:game`,
            seed,
            rulesetId: "ballot-rps.v1",
            players: [playerId, npcPlayerId],
            voters
          }
        },
        token
      );
      setSnapshot(response.snapshot);
      setStep("created");
    });

  const joinNpc = () =>
    run("NPC joined through HTTP API", async () => {
      const response = await client.joinRoom(roomId, { playerId: npcPlayerId }, token);
      setSnapshot(response.snapshot);
      setStep("joined");
    });

  const connectSocket = () =>
    run("WebSocket subscribed to room snapshots", async () => {
      socketRef.current?.close();
      const socket = client.openRoomSocket();
      await socket.connect();
      socket.subscribe((message) => {
        if ("snapshot" in message && message.snapshot) {
          setSnapshot(message.snapshot);
        }
        if (message.type === "ack" && !message.accepted) {
          setError(message.errors.join("; "));
        }
      });
      socket.subscribeRoom(roomId, playerId);
      socketRef.current = socket;
      const response = await client.getRoom(roomId, playerId);
      setSnapshot(response.snapshot);
      setStep("subscribed");
    });

  const runVoting = () =>
    run("Votes committed and revealed through WebSocket actions", async () => {
      const socket = requireSocket(socketRef.current);
      for (const [index, choice] of voterChoices.entries()) {
        const voterId = voters[index] as string;
        const salt = voteSalt(index);
        await sendActionAndWait(socket, {
          type: "COMMIT_VOTE",
          playerId: voterId,
          payload: { voterId, commitment: makeBallotRpsCommitment(`${roomId}:game`, 0, voterId, choice, salt) }
        });
        await sendActionAndWait(socket, {
          type: "REVEAL_VOTE",
          playerId: voterId,
          payload: { voterId, choice, salt }
        });
      }
      const response = await client.getRoom(roomId, playerId);
      setSnapshot(response.snapshot);
      setStep("voted");
    });

  const commitPlays = () =>
    run("Duelist plays committed through WebSocket actions", async () => {
      const socket = requireSocket(socketRef.current);
      const humanMove = readBallotViewerHand(snapshot)[0] as RpsMove | undefined;
      const npcSnapshot = await client.getRoom(roomId, npcPlayerId);
      const npcMove = readBallotViewerHand(npcSnapshot.snapshot)[0] as RpsMove | undefined;
      if (!humanMove || !npcMove) {
        throw new Error("Cannot commit plays until both hands are visible");
      }
      await sendActionAndWait(socket, {
        type: "COMMIT_PLAY",
        playerId,
        payload: { commitment: makeBallotRpsCommitment(`${roomId}:game`, 1, playerId, humanMove, playSalt(playerId)) }
      });
      await sendActionAndWait(socket, {
        type: "COMMIT_PLAY",
        playerId: npcPlayerId,
        payload: { commitment: makeBallotRpsCommitment(`${roomId}:game`, 1, npcPlayerId, npcMove, playSalt(npcPlayerId)) }
      });
      const response = await client.getRoom(roomId, playerId);
      setSnapshot(response.snapshot);
      setStep("committed");
    });

  const revealPlays = () =>
    run("Duelist plays revealed and settled through WebSocket actions", async () => {
      const socket = requireSocket(socketRef.current);
      const humanMove = readBallotViewerHand(snapshot)[0] as RpsMove | undefined;
      const npcSnapshot = await client.getRoom(roomId, npcPlayerId);
      const npcMove = readBallotViewerHand(npcSnapshot.snapshot)[0] as RpsMove | undefined;
      if (!humanMove || !npcMove) {
        throw new Error("Cannot reveal plays until both committed hands are known");
      }
      await sendActionAndWait(socket, {
        type: "REVEAL_PLAY",
        playerId,
        payload: { choice: humanMove, salt: playSalt(playerId) }
      });
      await sendActionAndWait(socket, {
        type: "REVEAL_PLAY",
        playerId: npcPlayerId,
        payload: { choice: npcMove, salt: playSalt(npcPlayerId) }
      });
      const response = await client.getRoom(roomId, playerId);
      setSnapshot(response.snapshot);
      setStep("settled");
    });

  const reset = () => {
    socketRef.current?.close();
    socketRef.current = undefined;
    setRoomId(`lan-room-${Date.now().toString(36)}`);
    setToken("");
    setSnapshot(undefined);
    setEvents([]);
    setError(undefined);
    setStep("idle");
  };

  const settlement = readBallotSettlement(snapshot);

  return (
    <section className="networkRoom" aria-labelledby="network-room-heading">
      <div className="labHeader">
        <div>
          <p className="eyebrow">LAN Multiplayer</p>
          <h2 id="network-room-heading">Network Room Console</h2>
          <p>
            This console drives the real HTTP and WebSocket server: session, create, join,
            subscribe, play, snapshot sync, and settlement.
          </p>
        </div>
        <div className="metricCard" data-testid="network-room-status">
          <strong>{snapshot?.status ?? step}</strong>
          <span>{snapshot?.phase ?? "not connected"}</span>
        </div>
      </div>

      <div className="networkConfig">
        <label>
          API URL
          <input value={config.apiUrl} onChange={(event) => setConfig({ ...config, apiUrl: event.target.value })} />
        </label>
        <label>
          WS URL
          <input value={config.wsUrl} onChange={(event) => setConfig({ ...config, wsUrl: event.target.value })} />
        </label>
        <label>
          Player ID
          <input value={playerId} onChange={(event) => setPlayerId(event.target.value)} />
        </label>
        <label>
          Display name
          <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
        </label>
        <label>
          Room ID
          <input value={roomId} onChange={(event) => setRoomId(event.target.value)} />
        </label>
        <label>
          Seed
          <input value={seed} onChange={(event) => setSeed(event.target.value)} />
        </label>
      </div>

      <div className="flowControls" aria-label="Network room controls">
        <button type="button" onClick={createSession} disabled={step !== "idle"}>
          Create session
        </button>
        <button type="button" onClick={createRoom} disabled={step !== "session"}>
          Create room
        </button>
        <button type="button" onClick={joinNpc} disabled={step !== "created"}>
          Join NPC
        </button>
        <button type="button" onClick={connectSocket} disabled={step !== "joined"}>
          Subscribe WS
        </button>
        <button type="button" onClick={runVoting} disabled={step !== "subscribed"}>
          Play votes
        </button>
        <button type="button" onClick={commitPlays} disabled={step !== "voted"}>
          Commit plays
        </button>
        <button type="button" onClick={revealPlays} disabled={step !== "committed"}>
          Reveal plays
        </button>
        <button type="button" onClick={reset}>
          Reset network flow
        </button>
      </div>

      {error ? (
        <p className="errorText" role="alert" data-testid="network-room-error">
          {error}
        </p>
      ) : null}

      <div className="flowGrid">
        <article className="panel">
          <h3>Server snapshot</h3>
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
              <dd data-testid="network-room-pending">{snapshot?.pendingCommitments.length ?? 0}</dd>
            </div>
          </dl>
        </article>
        <article className="panel">
          <h3>Settlement</h3>
          <p data-testid="network-room-settlement">{settlement?.reason ?? "Not settled"}</p>
          <p>Winners: {settlement?.winnerIds.join(", ") || "none"}</p>
        </article>
        <article className="panel wide">
          <h3>Network event trail</h3>
          <ol className="eventTrail">
            {events.map((event, index) => (
              <li key={`${event}-${index}`}>{event}</li>
            ))}
          </ol>
        </article>
      </div>
    </section>
  );

  function sendActionAndWait(socket: RoomSocket, action: Parameters<RoomSocket["submitAction"]>[1]) {
    const requestId = `network:${Date.now()}:${Math.random().toString(16).slice(2)}`;
    return new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        unsubscribe();
        reject(new Error(`Timed out waiting for ${action.type}`));
      }, 5000);
      const unsubscribe = socket.subscribe((message) => {
        if (message.type !== "ack" || message.requestId !== requestId) {
          return;
        }
        unsubscribe();
        window.clearTimeout(timeout);
        if (message.accepted) {
          setSnapshot(message.snapshot);
          resolve();
          return;
        }
        reject(new Error(message.errors.join("; ")));
      });
      socket.submitAction(roomId, action, token, requestId);
    });
  }

  function voteSalt(index: number): string {
    return `network-vote-salt:${roomId}:${seed}:${index}`;
  }

  function playSalt(id: string): string {
    return `network-play-salt:${roomId}:${seed}:${id}`;
  }
}

function requireSocket(socket: RoomSocket | undefined): RoomSocket {
  if (!socket) {
    throw new Error("WebSocket is not connected");
  }
  return socket;
}
