import type { NpcArchetype } from "./archetypes";

export type Difficulty = "easy" | "normal" | "hard" | "nightmare";

export type NpcPolicy = NpcArchetype & {
  difficulty: Difficulty;
  mistakeRate: number;
};

const difficultyModifiers: Record<
  Difficulty,
  {
    risk: number;
    bluffRate: number;
    memory: number;
    auditAwareness: number;
    mistakeRate: number;
  }
> = {
  easy: { risk: -0.12, bluffRate: -0.18, memory: -0.22, auditAwareness: -0.2, mistakeRate: 0.18 },
  normal: { risk: 0, bluffRate: 0, memory: 0, auditAwareness: 0, mistakeRate: 0.08 },
  hard: { risk: 0.08, bluffRate: 0.12, memory: 0.12, auditAwareness: 0.1, mistakeRate: 0.03 },
  nightmare: { risk: 0.14, bluffRate: 0.2, memory: 0.18, auditAwareness: 0.18, mistakeRate: 0.01 }
};

export function resolveNpcPolicy(archetype: NpcArchetype, difficulty: Difficulty): NpcPolicy {
  const modifier = difficultyModifiers[difficulty];
  return {
    ...archetype,
    difficulty,
    risk: clamp01(archetype.risk + modifier.risk),
    bluffRate: clamp01(archetype.bluffRate + modifier.bluffRate),
    memory: clamp01(archetype.memory + modifier.memory),
    auditAwareness: clamp01(archetype.auditAwareness + modifier.auditAwareness),
    mistakeRate: modifier.mistakeRate
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(4))));
}
