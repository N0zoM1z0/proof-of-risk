import type { PlayerProfile, RankingEntry, StoredMatch } from "./types";

export function deriveRankings(players: readonly PlayerProfile[], matches: readonly StoredMatch[]): RankingEntry[] {
  const byPlayer = new Map<string, RankingEntry>();
  for (const player of players) {
    byPlayer.set(player.playerId, {
      playerId: player.playerId,
      displayName: player.displayName,
      matches: 0,
      wins: 0,
      score: 0
    });
  }

  for (const match of matches) {
    for (const playerId of match.playerIds) {
      const entry = ensureEntry(byPlayer, playerId);
      entry.matches += 1;
      entry.score += match.settlement.balanceDeltas[playerId] ?? 0;
      if (match.settlement.winnerIds.includes(playerId)) {
        entry.wins += 1;
        entry.score += 10;
      }
    }
  }

  return [...byPlayer.values()].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    if (right.wins !== left.wins) {
      return right.wins - left.wins;
    }
    if (right.matches !== left.matches) {
      return right.matches - left.matches;
    }
    return left.playerId.localeCompare(right.playerId);
  });
}

function ensureEntry(entries: Map<string, RankingEntry>, playerId: string): RankingEntry {
  const existing = entries.get(playerId);
  if (existing) {
    return existing;
  }
  const created = {
    playerId,
    displayName: playerId,
    matches: 0,
    wins: 0,
    score: 0
  };
  entries.set(playerId, created);
  return created;
}
