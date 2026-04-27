import { stableHash } from "./canonical";
import type { PlayerId } from "./stateMachine";

export type CommitmentStatus = "committed" | "revealed" | "rejected";

export type CommitmentContext = {
  gameId: string;
  round: number;
  playerId: PlayerId;
};

export type CommitmentRecord<TChoice = unknown> = CommitmentContext & {
  id: string;
  commitment: string;
  scheme: "sha256-canonical-v1";
  status: CommitmentStatus;
  createdAtTurn: number;
  revealedAtTurn?: number;
  revealedChoice?: TChoice;
};

export function createCommitment<TChoice>(
  choice: TChoice,
  salt: string,
  context: CommitmentContext
): string {
  return stableHash({
    scheme: "sha256-canonical-v1",
    context,
    choice,
    salt
  });
}

export function createCommitmentRecord<TChoice>(
  input: CommitmentContext & { choice: TChoice; salt: string; createdAtTurn: number }
): CommitmentRecord<TChoice> {
  const context: CommitmentContext = {
    gameId: input.gameId,
    round: input.round,
    playerId: input.playerId
  };
  const commitment = createCommitment(input.choice, input.salt, context);
  return {
    gameId: input.gameId,
    round: input.round,
    playerId: input.playerId,
    id: stableHash({ commitment, createdAtTurn: input.createdAtTurn }),
    commitment,
    scheme: "sha256-canonical-v1",
    status: "committed",
    createdAtTurn: input.createdAtTurn
  };
}

export function verifyReveal<TChoice>(
  record: CommitmentRecord<TChoice>,
  choice: TChoice,
  salt: string
): boolean {
  return createCommitment(choice, salt, commitmentContext(record)) === record.commitment;
}

export function revealCommitment<TChoice>(
  record: CommitmentRecord<TChoice>,
  choice: TChoice,
  salt: string,
  revealedAtTurn: number
): CommitmentRecord<TChoice> {
  if (!verifyReveal(record, choice, salt)) {
    return { ...record, status: "rejected", revealedAtTurn };
  }

  return {
    ...record,
    status: "revealed",
    revealedAtTurn,
    revealedChoice: choice
  };
}

function commitmentContext(record: CommitmentContext): CommitmentContext {
  return {
    gameId: record.gameId,
    round: record.round,
    playerId: record.playerId
  };
}
