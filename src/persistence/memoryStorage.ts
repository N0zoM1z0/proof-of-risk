import type { PlayerProfile, ProofStorage, ProofStorageSnapshot, StoredArtifact, StoredMatch } from "./types";

export class MemoryProofStorage implements ProofStorage {
  protected readonly players = new Map<string, PlayerProfile>();
  protected readonly matches = new Map<string, StoredMatch>();
  protected readonly artifacts = new Map<string, StoredArtifact>();

  upsertPlayer(profile: PlayerProfile): void {
    this.players.set(profile.playerId, clone(profile));
  }

  getPlayer(playerId: string): PlayerProfile | undefined {
    return cloneOptional(this.players.get(playerId));
  }

  listPlayers(): PlayerProfile[] {
    return [...this.players.values()].map(clone).sort((left, right) => left.playerId.localeCompare(right.playerId));
  }

  saveMatch(match: StoredMatch): void {
    this.matches.set(match.matchId, clone(match));
  }

  getMatch(matchId: string): StoredMatch | undefined {
    return cloneOptional(this.matches.get(matchId));
  }

  listMatches(): StoredMatch[] {
    return [...this.matches.values()].map(clone).sort((left, right) => left.matchId.localeCompare(right.matchId));
  }

  saveArtifact(artifact: StoredArtifact): void {
    this.artifacts.set(artifact.artifactId, clone(artifact));
  }

  getArtifact(artifactId: string): StoredArtifact | undefined {
    return cloneOptional(this.artifacts.get(artifactId));
  }

  listArtifacts(): StoredArtifact[] {
    return [...this.artifacts.values()].map(clone).sort((left, right) => left.artifactId.localeCompare(right.artifactId));
  }

  snapshot(): ProofStorageSnapshot {
    return {
      players: this.listPlayers(),
      matches: this.listMatches(),
      artifacts: this.listArtifacts()
    };
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function cloneOptional<T>(value: T | undefined): T | undefined {
  return value === undefined ? undefined : clone(value);
}
