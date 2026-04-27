import { stableHash } from "./canonical";

export type RandomRecord = {
  index: number;
  label: string;
  algorithm: "mulberry32";
  seed: string;
  stateBefore: number;
  stateAfter: number;
  value: number;
};

export class DeterministicRng {
  readonly seed: string;
  private state: number;
  private readonly records: RandomRecord[] = [];

  constructor(seed: string) {
    this.seed = seed;
    this.state = seedToUint32(seed);
  }

  get randomLog(): readonly RandomRecord[] {
    return this.records;
  }

  nextFloat(label = "nextFloat"): number {
    const stateBefore = this.state;
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let mixed = this.state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    const value = ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
    this.records.push({
      index: this.records.length,
      label,
      algorithm: "mulberry32",
      seed: this.seed,
      stateBefore,
      stateAfter: this.state,
      value
    });
    return value;
  }

  nextInt(maxExclusive: number, label = "nextInt"): number {
    if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0) {
      throw new Error("maxExclusive must be a positive safe integer");
    }
    return Math.floor(this.nextFloat(label) * maxExclusive);
  }

  pick<T>(items: readonly T[], label = "pick"): T {
    if (items.length === 0) {
      throw new Error("Cannot pick from an empty list");
    }
    const selected = items[this.nextInt(items.length, label)];
    if (selected === undefined) {
      throw new Error("Selected item is unexpectedly undefined");
    }
    return selected;
  }

  shuffle<T>(items: readonly T[], label = "shuffle"): T[] {
    const output = [...items];
    for (let index = output.length - 1; index > 0; index -= 1) {
      const swapIndex = this.nextInt(index + 1, `${label}:${index}`);
      [output[index], output[swapIndex]] = [output[swapIndex] as T, output[index] as T];
    }
    return output;
  }
}

function seedToUint32(seed: string): number {
  return Number.parseInt(stableHash({ seed }).slice(0, 8), 16) >>> 0;
}
