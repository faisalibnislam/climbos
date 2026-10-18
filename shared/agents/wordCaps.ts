import type { LintIssue } from "./types";

/**
 * Brevity, enforced: maximum words per field. A path like "plays[].hook"
 * applies to every item; "weekOneChecklist[]" to every string in the list.
 */
export type WordCaps = Record<string, number>;

export const PLAN_CAPS: WordCaps = {
  summary: 45,
  positioning: 30,
  diagnosis: 40,
  affordableCac: 30,
  measurementPlan: 40,
  "northStar.metric": 10,
  "northStar.baseline": 12,
  "northStar.target": 12,
  "leadingIndicators[].metric": 6,
  "leadingIndicators[].weeklyTarget": 8,
  "leadingIndicators[].source": 6,
  "audiences[].hypothesis": 25,
  "audiences[].evidence": 25,
  "channels[].why": 25,
  "channels[].measurement": 15,
  "channels[].deliverables[]": 12,
  "experiments[].hypothesis": 25,
  "experiments[].stoppingRule": 15,
  "phases[].focus": 20,
  "weekOneChecklist[]": 15,
  "risks[].risk": 12,
  "risks[].mitigation": 15,
  "notDoing[].why": 15,
  "constraints[]": 15,
};

export const PLAYS_CAPS: WordCaps = {
  portfolioNote: 40,
  "plays[].oneLiner": 20,
  "plays[].audience": 20,
  "plays[].trigger": 15,
  "plays[].hook": 20,
  "plays[].mechanic": 15,
  "plays[].assetUsed": 12,
  "plays[].funnel[]": 20,
  "plays[].biggestUnknown": 15,
  "plays[].test": 15,
  "plays[].killIf": 15,
  "plays[].scaleIf": 15,
  "plays[].firstActionToday": 15,
  "plays[].climbosCanDo": 20,
};

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/** Every value under a cap path, with its concrete path (e.g. plays[2].hook). */
function valuesAt(obj: unknown, parts: string[], prefix: string): { path: string; value: unknown }[] {
  if (!parts.length) return [{ path: prefix, value: obj }];
  const [head, ...rest] = parts;
  const list = head.endsWith("[]");
  const key = list ? head.slice(0, -2) : head;
  const v = key ? (obj as Record<string, unknown> | null)?.[key] : obj;
  const at = key ? (prefix ? `${prefix}.${key}` : key) : prefix;
  if (!list) return valuesAt(v, rest, at);
  return Array.isArray(v) ? v.flatMap((item, i) => valuesAt(item, rest, `${at}[${i}]`)) : [];
}

export function lintWordCaps(out: unknown, caps: WordCaps): LintIssue[] {
  const issues: LintIssue[] = [];
  for (const [path, max] of Object.entries(caps)) {
    const parts = path.split(/\.(?![^[]*\])/).flatMap((p) => p.split(/(?<=\[\])\./));
    for (const { path: at, value } of valuesAt(out, parts, "")) {
      if (typeof value !== "string") continue;
      const n = words(value);
      if (n > max) issues.push({ severity: "error", rule: "brevity", message: `${n} words; max ${max}. Cut it down: owners skim.`, path: at });
    }
  }
  return issues;
}

/** One line for the writer's task, so drafts start short. */
export function capsHint(caps: WordCaps): string {
  return `WORD LIMITS (hard; the draft is rejected over them): ${Object.entries(caps).map(([k, n]) => `${k.replace(/\[\]/g, "")} ≤ ${n}`).join(", ")}.`;
}
