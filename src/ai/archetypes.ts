export type NpcArchetypeId =
  | "analyst"
  | "zealot"
  | "dominator"
  | "performer"
  | "insider"
  | "auditor";

export type NpcArchetype = {
  id: NpcArchetypeId;
  label: string;
  risk: number;
  trust: number;
  cheatPressure: number;
  bluffRate: number;
  memory: number;
  auditAwareness: number;
  strengths: string[];
};

export const npcArchetypes: Record<NpcArchetypeId, NpcArchetype> = {
  analyst: {
    id: "analyst",
    label: "Expected Value Analyst",
    risk: 0.35,
    trust: 0.35,
    cheatPressure: 0.1,
    bluffRate: 0.2,
    memory: 0.82,
    auditAwareness: 0.68,
    strengths: ["zero-nim", "nontransitive-dice", "all-pay-vote-auction"]
  },
  zealot: {
    id: "zealot",
    label: "Volatility Zealot",
    risk: 0.9,
    trust: 0.15,
    cheatPressure: 0.2,
    bluffRate: 0.72,
    memory: 0.42,
    auditAwareness: 0.28,
    strengths: ["choice-draw-poker", "pressure-shear", "symbol-sequence"]
  },
  dominator: {
    id: "dominator",
    label: "Alliance Dominator",
    risk: 0.55,
    trust: 0.1,
    cheatPressure: 0.65,
    bluffRate: 0.68,
    memory: 0.7,
    auditAwareness: 0.52,
    strengths: ["ballot-rps", "greater-good", "all-pay-vote-auction"]
  },
  performer: {
    id: "performer",
    label: "Stage Performer",
    risk: 0.5,
    trust: 0.5,
    cheatPressure: 0.25,
    bluffRate: 0.58,
    memory: 0.5,
    auditAwareness: 0.44,
    strengths: ["stage-grid", "stage-63", "pairing-party"]
  },
  insider: {
    id: "insider",
    label: "Signal Insider",
    risk: 0.45,
    trust: 0.05,
    cheatPressure: 0.8,
    bluffRate: 0.74,
    memory: 0.64,
    auditAwareness: 0.3,
    strengths: ["forehead-poker", "zero-nim", "pairing-party"]
  },
  auditor: {
    id: "auditor",
    label: "Evidence Auditor",
    risk: 0.4,
    trust: 0.45,
    cheatPressure: 0.02,
    bluffRate: 0.12,
    memory: 0.76,
    auditAwareness: 0.95,
    strengths: ["mirror-memory", "greater-good", "all-pay-vote-auction"]
  }
};

export function listNpcArchetypes(): NpcArchetype[] {
  return Object.values(npcArchetypes);
}
