/**
 * The persisted expert plan has a separate schema version from the generation
 * engine version. Existing rows predate this field and are treated as legacy
 * version 0; their payload is preserved so older plans remain readable.
 */
export const EXPERT_PLAN_SCHEMA_VERSION = 7;

export type SavedExpertPlan = Record<string, unknown> & { version: number };

export function readExpertPlan<T extends Record<string, unknown>>(expert: T): T & { version: number } {
  const version = expert.version;
  return {
    ...expert,
    version: typeof version === "number" && Number.isSafeInteger(version) && version >= 0 ? version : 0,
  };
}
