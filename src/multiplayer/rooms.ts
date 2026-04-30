import { DeterministicRng } from "../engine/rng";
import type { CommitmentRecord } from "../engine/commitments";
import type { GambleRuleset, PlayerId, RulesetConfig } from "../engine/stateMachine";
import { ballotRpsRuleset } from "../gambles/ballotRps/ruleset";
import type { BallotRpsAction, BallotRpsState } from "../gambles/ballotRps/types";
import { greaterGoodRuleset } from "../gambles/greaterGood/ruleset";
import type { GreaterGoodAction, GreaterGoodState } from "../gambles/greaterGood/types";

export type RoomRulesetId = typeof ballotRpsRuleset.id | typeof greaterGoodRuleset.id;
export type RoomAction = BallotRpsAction | GreaterGoodAction;
export type RoomState = BallotRpsState | GreaterGoodState;
export type RoomStatus = "open" | "active" | "settled";

export type RoomConfig = RulesetConfig & {
  rulesetId: RoomRulesetId;
};

export type PendingCommitment = {
  id: string;
  playerId: PlayerId;
  round: number;
  createdAtTurn: number;
};

export type RoomSnapshot = {
  roomId: string;
  rulesetId: RoomRulesetId;
  seed: string;
  status: RoomStatus;
  members: PlayerId[];
  expectedPlayers: PlayerId[];
  phase: string;
  turn: number;
  publicView: unknown;
  pendingCommitments: PendingCommitment[];
};

export type RoomCommandResult =
  | {
      accepted: true;
      snapshot: RoomSnapshot;
    }
  | {
      accepted: false;
      errors: string[];
      snapshot?: RoomSnapshot;
    };

type RoomRecord = {
  roomId: string;
  config: RoomConfig;
  ruleset: FormalRoomRuleset;
  rng: DeterministicRng;
  state: RoomState;
  members: Set<PlayerId>;
  allowedActors: Set<PlayerId>;
};

type FormalRoomRuleset = GambleRuleset<RoomState, RoomAction>;

export class InMemoryRoomServer {
  private readonly rooms = new Map<string, RoomRecord>();

  createRoom(input: { roomId: string; config: RoomConfig; hostPlayerId: PlayerId }): RoomCommandResult {
    if (this.rooms.has(input.roomId)) {
      return { accepted: false, errors: [`Room ${input.roomId} already exists`] };
    }
    if (!input.config.players.includes(input.hostPlayerId)) {
      return { accepted: false, errors: ["Host must be one of the configured players"] };
    }
    const ruleset = selectRuleset(input.config.rulesetId);
    if (!ruleset) {
      return { accepted: false, errors: [`Unsupported room ruleset ${input.config.rulesetId}`] };
    }
    const rng = new DeterministicRng(input.config.seed);
    const state = ruleset.init(input.config, rng);
    const allowedActors = new Set<PlayerId>(input.config.players);
    const voters = input.config.voters;
    if (Array.isArray(voters)) {
      voters.filter((voter): voter is PlayerId => typeof voter === "string").forEach((voter) => allowedActors.add(voter));
    }
    const room: RoomRecord = {
      roomId: input.roomId,
      config: input.config,
      ruleset,
      rng,
      state,
      members: new Set([input.hostPlayerId]),
      allowedActors
    };
    this.rooms.set(input.roomId, room);
    return { accepted: true, snapshot: snapshotRoom(room, input.hostPlayerId) };
  }

  joinRoom(roomId: string, playerId: PlayerId): RoomCommandResult {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { accepted: false, errors: [`Room ${roomId} not found`] };
    }
    if (!room.config.players.includes(playerId)) {
      return { accepted: false, errors: ["Only configured players can join room seats"], snapshot: snapshotRoom(room) };
    }
    if (room.members.has(playerId)) {
      return { accepted: false, errors: ["Player already joined"], snapshot: snapshotRoom(room, playerId) };
    }
    room.members.add(playerId);
    return { accepted: true, snapshot: snapshotRoom(room, playerId) };
  }

  leaveRoom(roomId: string, playerId: PlayerId): RoomCommandResult {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { accepted: false, errors: [`Room ${roomId} not found`] };
    }
    if (!room.members.has(playerId)) {
      return { accepted: false, errors: ["Player is not in the room"], snapshot: snapshotRoom(room) };
    }
    if (room.state.turn > 0) {
      return { accepted: false, errors: ["Players cannot leave after actions have started"], snapshot: snapshotRoom(room, playerId) };
    }
    room.members.delete(playerId);
    return { accepted: true, snapshot: snapshotRoom(room, playerId) };
  }

  submitAction(roomId: string, action: RoomAction): RoomCommandResult {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { accepted: false, errors: [`Room ${roomId} not found`] };
    }
    const boundaryError = validateRoomBoundary(room, action);
    if (boundaryError) {
      return { accepted: false, errors: [boundaryError], snapshot: snapshotRoom(room, action.playerId) };
    }
    if (room.ruleset.isTerminal(room.state)) {
      return { accepted: false, errors: ["Room is already settled"], snapshot: snapshotRoom(room, action.playerId) };
    }
    const resolution = applyRoomAction(room.ruleset, room.state, action, room.rng);
    if (!resolution.accepted) {
      return { accepted: false, errors: resolution.errors, snapshot: snapshotRoom(room, action.playerId) };
    }
    room.state = resolution.state;
    return { accepted: true, snapshot: snapshotRoom(room, action.playerId) };
  }

  snapshot(roomId: string, viewer?: PlayerId): RoomSnapshot {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`Room ${roomId} not found`);
    }
    return snapshotRoom(room, viewer);
  }
}

function validateRoomBoundary(room: RoomRecord, action: RoomAction): string | undefined {
  if (!room.allowedActors.has(action.playerId)) {
    return "Actor is not allowed in this room";
  }
  if (room.config.players.includes(action.playerId) && !room.members.has(action.playerId)) {
    return "Player must join the room before submitting actions";
  }
  if ("voterId" in action.payload && action.payload.voterId !== action.playerId) {
    return "Vote actor must match payload voterId";
  }
  const expectedPlayersJoined = room.config.players.every((playerId) => room.members.has(playerId));
  if (!expectedPlayersJoined && room.config.players.includes(action.playerId)) {
    return "All configured players must join before player actions start";
  }
  return undefined;
}

function snapshotRoom(room: RoomRecord, viewer?: PlayerId): RoomSnapshot {
  const fallbackViewer = viewer ?? room.config.players[0] ?? "observer";
  return {
    roomId: room.roomId,
    rulesetId: room.config.rulesetId,
    seed: room.config.seed,
    status: room.ruleset.isTerminal(room.state)
      ? "settled"
      : room.config.players.every((playerId) => room.members.has(playerId))
        ? "active"
        : "open",
    members: [...room.members],
    expectedPlayers: [...room.config.players],
    phase: room.state.phase,
    turn: room.state.turn,
    publicView: getPublicView(room.ruleset, room.state, fallbackViewer),
    pendingCommitments: room.state.commitments.filter(isPendingCommitment).map((record) => ({
      id: record.id,
      playerId: record.playerId,
      round: record.round,
      createdAtTurn: record.createdAtTurn
    }))
  };
}

function selectRuleset(rulesetId: RoomRulesetId): FormalRoomRuleset | undefined {
  if (rulesetId === ballotRpsRuleset.id) {
    return ballotRpsRuleset as unknown as FormalRoomRuleset;
  }
  if (rulesetId === greaterGoodRuleset.id) {
    return greaterGoodRuleset as unknown as FormalRoomRuleset;
  }
  return undefined;
}

function applyRoomAction(
  ruleset: FormalRoomRuleset,
  state: RoomState,
  action: RoomAction,
  rng: DeterministicRng
) {
  return ruleset.applyAction(state, action, rng);
}

function getPublicView(ruleset: FormalRoomRuleset, state: RoomState, viewer: PlayerId): unknown {
  return ruleset.getPublicView(state, viewer);
}

function isPendingCommitment(record: CommitmentRecord): boolean {
  return record.status === "committed";
}
