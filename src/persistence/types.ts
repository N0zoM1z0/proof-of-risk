import type { Settlement } from "../engine/stateMachine";
import type { ReplayArtifact } from "../verify/artifacts";

export type PlayerProfile = {
  playerId: string;
  displayName: string;
  createdAt: string;
  virtualOnly: true;
  sybilHints?: {
    deviceHash?: string;
    ipHash?: string;
    inviteCode?: string;
  };
};

export type StoredMatch = {
  matchId: string;
  gameId: string;
  rulesetId: string;
  playerIds: string[];
  completedAt: string;
  settlement: Settlement;
  replayHash?: string;
  artifactId?: string;
};

export type StoredArtifact = {
  artifactId: string;
  matchId: string;
  replayHash: string;
  artifact: ReplayArtifact;
  storedAt: string;
};

export type RankingEntry = {
  playerId: string;
  displayName: string;
  matches: number;
  wins: number;
  score: number;
};

export type AntiSybilSignal = {
  playerId: string;
  severity: "low" | "medium" | "high";
  signal: string;
  explanation: string;
  placeholder: true;
};

export type ProofStorageSnapshot = {
  players: PlayerProfile[];
  matches: StoredMatch[];
  artifacts: StoredArtifact[];
};

export interface ProofStorage {
  upsertPlayer(profile: PlayerProfile): void;
  getPlayer(playerId: string): PlayerProfile | undefined;
  listPlayers(): PlayerProfile[];
  saveMatch(match: StoredMatch): void;
  getMatch(matchId: string): StoredMatch | undefined;
  listMatches(): StoredMatch[];
  saveArtifact(artifact: StoredArtifact): void;
  getArtifact(artifactId: string): StoredArtifact | undefined;
  listArtifacts(): StoredArtifact[];
  snapshot(): ProofStorageSnapshot;
}
