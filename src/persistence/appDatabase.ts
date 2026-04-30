import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { MemoryProofStorage } from "./memoryStorage";
import type { PlayerProfile, ProofStorageSnapshot, StoredArtifact, StoredMatch } from "./types";

export const appSchemaVersion = 1;

export type AccountRecord = {
  accountId: string;
  playerId: string;
  displayName: string;
  createdAt: string;
  virtualOnly: true;
};

export type SessionRecord = {
  sessionId: string;
  accountId: string;
  playerId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string;
};

export type AppDatabaseSnapshot = ProofStorageSnapshot & {
  schemaVersion: typeof appSchemaVersion;
  accounts: AccountRecord[];
  sessions: SessionRecord[];
};

export type CreateSessionInput = {
  sessionId: string;
  accountId: string;
  playerId: string;
  rawToken: string;
  createdAt: string;
  expiresAt: string;
};

export class MemoryAppDatabase extends MemoryProofStorage {
  protected readonly accounts = new Map<string, AccountRecord>();
  protected readonly sessions = new Map<string, SessionRecord>();

  upsertAccount(account: AccountRecord): void {
    this.accounts.set(account.accountId, clone(account));
  }

  getAccount(accountId: string): AccountRecord | undefined {
    return cloneOptional(this.accounts.get(accountId));
  }

  getAccountByPlayerId(playerId: string): AccountRecord | undefined {
    return this.listAccounts().find((account) => account.playerId === playerId);
  }

  listAccounts(): AccountRecord[] {
    return [...this.accounts.values()].map(clone).sort((left, right) => left.accountId.localeCompare(right.accountId));
  }

  createSession(input: CreateSessionInput): SessionRecord {
    const session: SessionRecord = {
      sessionId: input.sessionId,
      accountId: input.accountId,
      playerId: input.playerId,
      tokenHash: hashSessionToken(input.rawToken),
      createdAt: input.createdAt,
      expiresAt: input.expiresAt
    };
    this.sessions.set(session.sessionId, clone(session));
    return clone(session);
  }

  getSession(sessionId: string): SessionRecord | undefined {
    return cloneOptional(this.sessions.get(sessionId));
  }

  findValidSessionByToken(rawToken: string, nowIso: string): SessionRecord | undefined {
    const tokenHash = hashSessionToken(rawToken);
    const nowMs = Date.parse(nowIso);
    return this.listSessions().find((session) => {
      if (session.tokenHash !== tokenHash || session.revokedAt) {
        return false;
      }
      return Date.parse(session.expiresAt) > nowMs;
    });
  }

  listSessions(): SessionRecord[] {
    return [...this.sessions.values()].map(clone).sort((left, right) => left.sessionId.localeCompare(right.sessionId));
  }

  override snapshot(): AppDatabaseSnapshot {
    return {
      schemaVersion: appSchemaVersion,
      players: this.listPlayers(),
      matches: this.listMatches(),
      artifacts: this.listArtifacts(),
      accounts: this.listAccounts(),
      sessions: this.listSessions()
    };
  }
}

export class JsonFileAppDatabase extends MemoryAppDatabase {
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

  override upsertAccount(account: AccountRecord): void {
    super.upsertAccount(account);
    this.flush();
  }

  override createSession(input: CreateSessionInput): SessionRecord {
    const session = super.createSession(input);
    this.flush();
    return session;
  }

  private load(): void {
    if (!existsSync(this.filePath)) {
      return;
    }
    const parsed = JSON.parse(readFileSync(this.filePath, "utf8")) as Partial<AppDatabaseSnapshot>;
    parsed.players?.forEach((profile) => this.players.set(profile.playerId, profile));
    parsed.matches?.forEach((match) => this.matches.set(match.matchId, match));
    parsed.artifacts?.forEach((artifact) => this.artifacts.set(artifact.artifactId, artifact));
    parsed.accounts?.forEach((account) => this.accounts.set(account.accountId, account));
    parsed.sessions?.forEach((session) => this.sessions.set(session.sessionId, session));
  }

  private flush(): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, `${JSON.stringify(this.snapshot(), null, 2)}\n`, "utf8");
  }
}

export function hashSessionToken(rawToken: string): string {
  return createHash("sha256").update(`proof-of-risk-session:${rawToken}`).digest("hex");
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function cloneOptional<T>(value: T | undefined): T | undefined {
  return value === undefined ? undefined : clone(value);
}
