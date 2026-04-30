import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { PlayerProfile, ProofStorageSnapshot, StoredArtifact, StoredMatch } from "./types";
import { MemoryProofStorage } from "./memoryStorage";

export class JsonFileProofStorage extends MemoryProofStorage {
  constructor(private readonly filePath: string) {
    super();
    this.load();
  }

  override upsertPlayer(profile: PlayerProfile): void {
    super.upsertPlayer(profile);
    this.flush();
  }

  override saveMatch(match: StoredMatch): void {
    super.saveMatch(match);
    this.flush();
  }

  override saveArtifact(artifact: StoredArtifact): void {
    super.saveArtifact(artifact);
    this.flush();
  }

  private load(): void {
    if (!existsSync(this.filePath)) {
      return;
    }
    const parsed = JSON.parse(readFileSync(this.filePath, "utf8")) as Partial<ProofStorageSnapshot>;
    parsed.players?.forEach((profile) => this.players.set(profile.playerId, profile));
    parsed.matches?.forEach((match) => this.matches.set(match.matchId, match));
    parsed.artifacts?.forEach((artifact) => this.artifacts.set(artifact.artifactId, artifact));
  }

  private flush(): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, `${JSON.stringify(this.snapshot(), null, 2)}\n`, "utf8");
  }
}
