import { parseCurrentExpertGrowthPayload } from "./growthPlanPersistence";

/**
 * The persisted expert plan has a separate schema version from the generation
 * engine version. Existing rows predate this field and are treated as legacy
 * version 0; their payload is preserved so older plans remain readable.
 */
export const EXPERT_PLAN_SCHEMA_VERSION = 9;
/** Last schema whose growth fields were stored only in the legacy untyped slots. */
export const LEGACY_EXPERT_PLAN_SCHEMA_VERSION = 7;
export const EXPERT_PLAN_JSON_ENVELOPE_VERSION = 8;

export type SavedExpertPlan = Record<string, unknown> & { version: number };

export function readExpertPlan<T extends Record<string, unknown>>(expert: T): T & { version: number } {
  const version = expert.version;
  const safeVersion = typeof version === "number" && Number.isSafeInteger(version) && version >= 0 ? version : 0;
  const base = {
    ...expert,
    version: safeVersion,
  };
  if (safeVersion === EXPERT_PLAN_SCHEMA_VERSION || safeVersion === EXPERT_PLAN_JSON_ENVELOPE_VERSION) {
    const current = parseCurrentExpertGrowthPayload(safeVersion === EXPERT_PLAN_SCHEMA_VERSION ? expert.growthPlanV9 : expert.growthPlanV8);
    if (current) return { ...base, plays: current.plays, economics: current.economics };
    const invalid = { ...base, growthPlanInvalid: true } as Record<string, unknown> & { version: number };
    delete invalid.plays;
    delete invalid.economics;
    return invalid as T & { version: number };
  }
  return base;
}

export function expertPlaysOf(expert: unknown): unknown[] {
  if (!expert || typeof expert !== "object" || Array.isArray(expert)) return [];
  const readable = readExpertPlan(expert as Record<string, unknown>);
  return Array.isArray(readable.plays) ? readable.plays : [];
}

export function expertEconomicsOf(expert: unknown): unknown | null {
  if (!expert || typeof expert !== "object" || Array.isArray(expert)) return null;
  return readExpertPlan(expert as Record<string, unknown>).economics ?? null;
}
