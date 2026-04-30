import type { AntiSybilSignal, PlayerProfile } from "./types";

export function evaluateAntiSybilSignals(
  profile: PlayerProfile,
  peers: readonly PlayerProfile[],
  nowIso: string
): AntiSybilSignal[] {
  const signals: AntiSybilSignal[] = [];
  const comparablePeers = peers.filter((peer) => peer.playerId !== profile.playerId);

  if (profile.sybilHints?.deviceHash && comparablePeers.some((peer) => peer.sybilHints?.deviceHash === profile.sybilHints?.deviceHash)) {
    signals.push({
      playerId: profile.playerId,
      severity: "medium",
      signal: "shared-device-hash-placeholder",
      explanation: "Multiple local profiles report the same device hash. This is a placeholder risk signal, not enforcement.",
      placeholder: true
    });
  }

  if (profile.sybilHints?.ipHash && comparablePeers.some((peer) => peer.sybilHints?.ipHash === profile.sybilHints?.ipHash)) {
    signals.push({
      playerId: profile.playerId,
      severity: "low",
      signal: "shared-ip-hash-placeholder",
      explanation: "Multiple local profiles report the same IP hash. Shared networks are common, so this is advisory only.",
      placeholder: true
    });
  }

  const createdAt = Date.parse(profile.createdAt);
  const now = Date.parse(nowIso);
  if (Number.isFinite(createdAt) && Number.isFinite(now) && now - createdAt < 60_000) {
    signals.push({
      playerId: profile.playerId,
      severity: "low",
      signal: "fresh-account-placeholder",
      explanation: "The profile was created less than one minute before evaluation. This supports rate-limit design only.",
      placeholder: true
    });
  }

  return signals;
}
