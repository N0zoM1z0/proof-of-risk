export type RoadmapPhase =
  | "phase-2"
  | "phase-3"
  | "phase-4"
  | "phase-7"
  | "phase-8"
  | "future";

export type ZkPriority = "none" | "low" | "medium" | "high" | "highest";
export type Readiness = "core-mvp" | "prototype" | "expansion" | "research";

export type GambleCatalogEntry = {
  id: string;
  title: string;
  summary: string;
  mechanism: string;
  players: string;
  hiddenInfo: string[];
  aiHooks: string[];
  fairnessHooks: string[];
  phase: RoadmapPhase;
  complexity: 1 | 2 | 3 | 4 | 5;
  zkPriority: ZkPriority;
  readiness: Readiness;
};

export type CatalogFilters = {
  phase?: RoadmapPhase | "all";
  zkPriority?: ZkPriority | "all";
  readiness?: Readiness | "all";
  maxComplexity?: number;
};

const blockedRuntimeTerms = [
  "kakegurui",
  "hyakkaou",
  "jabami",
  "yumeko",
  "mary saotome",
  "kirari"
];

export class CatalogValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Invalid gamble catalog: ${issues.join("; ")}`);
    this.name = "CatalogValidationError";
    this.issues = issues;
  }
}

export function validateGambleCatalog(input: unknown): GambleCatalogEntry[] {
  if (!Array.isArray(input)) {
    throw new CatalogValidationError(["catalog must be an array"]);
  }

  const issues: string[] = [];
  const ids = new Set<string>();

  input.forEach((entry, index) => {
    if (!isRecord(entry)) {
      issues.push(`[${index}] entry must be an object`);
      return;
    }

    const id = validateString(entry.id, `[${index}].id`, issues);
    if (id) {
      if (!/^[a-z0-9-]+$/.test(id)) {
        issues.push(`[${index}].id must be lowercase kebab-case`);
      }
      if (ids.has(id)) {
        issues.push(`[${index}].id duplicates ${id}`);
      }
      ids.add(id);
    }

    validateString(entry.title, `[${index}].title`, issues);
    validateString(entry.summary, `[${index}].summary`, issues);
    validateString(entry.mechanism, `[${index}].mechanism`, issues);
    validateString(entry.players, `[${index}].players`, issues);
    validateStringArray(entry.hiddenInfo, `[${index}].hiddenInfo`, issues);
    validateStringArray(entry.aiHooks, `[${index}].aiHooks`, issues);
    validateStringArray(entry.fairnessHooks, `[${index}].fairnessHooks`, issues);
    validateEnum(entry.phase, ["phase-2", "phase-3", "phase-4", "phase-7", "phase-8", "future"], `[${index}].phase`, issues);
    validateNumberRange(entry.complexity, 1, 5, `[${index}].complexity`, issues);
    validateEnum(entry.zkPriority, ["none", "low", "medium", "high", "highest"], `[${index}].zkPriority`, issues);
    validateEnum(entry.readiness, ["core-mvp", "prototype", "expansion", "research"], `[${index}].readiness`, issues);

    const searchable = JSON.stringify(entry).toLowerCase();
    for (const term of blockedRuntimeTerms) {
      if (searchable.includes(term)) {
        issues.push(`[${index}] contains blocked runtime IP term: ${term}`);
      }
    }
  });

  if (issues.length > 0) {
    throw new CatalogValidationError(issues);
  }

  return input as GambleCatalogEntry[];
}

export function filterCatalog(
  catalog: readonly GambleCatalogEntry[],
  filters: CatalogFilters
): GambleCatalogEntry[] {
  return catalog.filter((entry) => {
    if (filters.phase && filters.phase !== "all" && entry.phase !== filters.phase) {
      return false;
    }
    if (
      filters.zkPriority &&
      filters.zkPriority !== "all" &&
      entry.zkPriority !== filters.zkPriority
    ) {
      return false;
    }
    if (filters.readiness && filters.readiness !== "all" && entry.readiness !== filters.readiness) {
      return false;
    }
    if (filters.maxComplexity !== undefined && entry.complexity > filters.maxComplexity) {
      return false;
    }
    return true;
  });
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

function validateString(input: unknown, label: string, issues: string[]): string | undefined {
  if (typeof input !== "string" || input.trim().length === 0) {
    issues.push(`${label} must be a non-empty string`);
    return undefined;
  }
  return input;
}

function validateStringArray(input: unknown, label: string, issues: string[]): void {
  if (!Array.isArray(input) || input.length === 0 || input.some((item) => typeof item !== "string")) {
    issues.push(`${label} must be a non-empty string array`);
  }
}

function validateEnum<T extends string>(
  input: unknown,
  values: readonly T[],
  label: string,
  issues: string[]
): void {
  if (typeof input !== "string" || !values.includes(input as T)) {
    issues.push(`${label} must be one of ${values.join(", ")}`);
  }
}

function validateNumberRange(
  input: unknown,
  min: number,
  max: number,
  label: string,
  issues: string[]
): void {
  if (!Number.isInteger(input) || Number(input) < min || Number(input) > max) {
    issues.push(`${label} must be an integer from ${min} to ${max}`);
  }
}
