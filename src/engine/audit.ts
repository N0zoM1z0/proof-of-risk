export type AuditSeverity = "low" | "medium" | "high";

export type AuditAnomaly = {
  severity: AuditSeverity;
  signal: string;
  explanation: string;
};

export type FairnessSummary = {
  randomVerified: boolean;
  commitmentsVerified: boolean;
  settlementVerified: boolean;
};

export type AuditReport = {
  fairness: FairnessSummary;
  anomalies: AuditAnomaly[];
  replayHash: string;
  proofArtifacts?: string[];
};

export function createAuditReport(input: AuditReport): AuditReport {
  return {
    fairness: { ...input.fairness },
    anomalies: [...input.anomalies],
    replayHash: input.replayHash,
    proofArtifacts: input.proofArtifacts ? [...input.proofArtifacts] : undefined
  };
}
