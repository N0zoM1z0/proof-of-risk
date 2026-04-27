import type { AuditAnomaly } from "../../engine/audit";
import type { ZeroNimState } from "./types";

export function detectZeroNimAnomalies(state: ZeroNimState): AuditAnomaly[] {
  const raiseBeforeZero = state.actionLog.filter((record, index, log) => {
    if (record.type !== "BET") {
      return false;
    }
    const payload = record.payload as { kind?: string };
    if (payload.kind !== "raise") {
      return false;
    }
    const nextReveal = log.slice(index + 1).find((next) => next.type === "REVEAL_CARD");
    return (nextReveal?.payload as { card?: number } | undefined)?.card === 0;
  });

  if (raiseBeforeZero.length >= 2) {
    return [
      {
        severity: "medium",
        signal: "raise-before-zero-pattern",
        explanation:
          "Multiple raises were immediately followed by zero-card reveals. This is not proof of cheating, but it is useful collusion telemetry."
      }
    ];
  }

  return [];
}
