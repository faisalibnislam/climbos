/**
 * Plan quality (REQ-ENG-02), kept separate from the workflow's operational
 * status: a run can complete while its plan is provisional or failed. Code
 * decides the state from the agents' assessments and lint, never the model.
 *
 * - failed: a hard check failed (economics that don't add up or lose money,
 *   budget or capacity breached, a fabricated or unverifiable citation, a number
 *   with no source or label, a customer count that contradicts the plays).
 *   Saved for inspection; it can't start work.
 * - needs_input: what a customer is worth is missing, so money decisions wait.
 * - provisional: usable, but the review didn't pass or research came back thin.
 * - passed: every gate, lint check and rubric bar cleared.
 */
import type { Assessment, LintIssue } from "./types";

export type QualityState = "passed" | "provisional" | "needs_input" | "failed";

/** Lint rules whose failure means the plan must not drive work (REQ-EVAL hard failures). */
export const HARD_RULES = new Set(["economics", "budget", "capacity", "citation", "provenance", "consistency", "no_plays", "invented_fact"]);

/** One hard finding the owner can act on: what failed and where. */
export interface QualityFix {
  rule: string;
  /** Plan field it sits in (e.g. "summary", "phases[1].focus"). */
  path?: string;
  message: string;
}

export interface AgentQuality {
  agentId: string;
  /** The review loop ended with a version that met the ship rule. */
  shipped: boolean;
  gatesPassed: boolean;
  average: number | null;
  rounds: number;
  /** Lint errors on the kept version, by rule. */
  errors: Record<string, number>;
  /** Research pages the agent's research phase returned (null when it had no research phase). */
  researchSources: number | null;
  /** Hard lint errors on the kept version, with their messages (capped). */
  fixes?: QualityFix[];
}

export interface PlanQuality {
  version: 1;
  state: QualityState;
  /** Owner-facing reasons, most important first. */
  reasons: string[];
  /** Hard findings (rule: message), kept for audit. */
  hard: string[];
  /** Hard findings with where they are, so the owner can supply a source or ask for a change. */
  fixes?: QualityFix[];
  /** Inputs the plan had to work without (Book 14 §4: unknown is a state, not a default). Doesn't change the state. */
  unknowns?: string[];
  agents: AgentQuality[];
}

const MAX_FIXES = 12;

export function agentQuality(agentId: string, assessment: Assessment | null, rounds: number, researchSources: number | null): AgentQuality {
  const errors: Record<string, number> = {};
  const fixes: QualityFix[] = [];
  for (const l of assessment?.lint ?? []) {
    if (l.severity !== "error") continue;
    errors[l.rule] = (errors[l.rule] ?? 0) + 1;
    if (HARD_RULES.has(l.rule) && fixes.length < MAX_FIXES) fixes.push({ rule: l.rule, ...(l.path ? { path: l.path } : {}), message: l.message.slice(0, 300) });
  }
  return { agentId, shipped: Boolean(assessment?.ship), gatesPassed: Boolean(assessment?.gatesPassed), average: assessment?.average ?? null, rounds, errors, researchSources, ...(fixes.length ? { fixes } : {}) };
}

/** The same agent result with its hard findings removed (when those checks are re-run on a later version). */
export function withoutHard(a: AgentQuality): AgentQuality {
  const { fixes: _fixes, ...rest } = a;
  return { ...rest, errors: Object.fromEntries(Object.entries(a.errors).filter(([r]) => !HARD_RULES.has(r))) };
}

const LABEL: Record<string, string> = {
  economics: "the numbers behind a play don't add up or it loses money",
  budget: "the plan spends more than your ad budget",
  capacity: "the plan needs more of your time than you have",
  citation: "a play cites a source the research didn't read",
  provenance: "a number is credited to a source without naming or quoting it",
  consistency: "a customer number doesn't match what the plays add up to",
  invented_fact: "a number has no source and isn't labelled as an estimate or target",
  no_plays: "the plan has no plays to run",
};

/** Combine the plays and plan agents' results (plus any extra hard lint on the final plan) into one quality state. */
export function planQuality(agents: AgentQuality[], finalLint: LintIssue[] = [], opts: { economicsMissing?: boolean; unknowns?: string[] } = {}): PlanQuality {
  const u = opts.unknowns?.length ? { unknowns: opts.unknowns } : {};
  const hard: string[] = [];
  const hardRules = new Set<string>();
  const fixes: QualityFix[] = [];
  const seen = new Set<string>();
  const addFix = (f: QualityFix) => {
    const k = `${f.rule}|${f.path ?? ""}|${f.message}`;
    if (!seen.has(k) && fixes.length < MAX_FIXES) fixes.push(f);
    seen.add(k);
  };
  for (const a of agents) {
    for (const [rule, n] of Object.entries(a.errors)) if (HARD_RULES.has(rule) && n > 0) {
      hardRules.add(rule);
      hard.push(`${a.agentId}: ${rule} ×${n}`);
    }
    for (const f of a.fixes ?? []) addFix(f);
  }
  for (const l of finalLint) if (l.severity === "error" && HARD_RULES.has(l.rule)) {
    hardRules.add(l.rule);
    hard.push(`final: ${l.rule}${l.path ? ` @ ${l.path}` : ""}`);
    addFix({ rule: l.rule, ...(l.path ? { path: l.path } : {}), message: l.message.slice(0, 300) });
  }
  const reasons: string[] = [...hardRules].map((r) => `Checks failed: ${LABEL[r] ?? r}.`);
  if (hardRules.size) return { version: 1, state: "failed", reasons, hard, ...(fixes.length ? { fixes } : {}), ...u, agents };
  if (opts.economicsMissing) return { version: 1, state: "needs_input", reasons: ["What one customer is worth (price, margin or churn) is missing, so spending decisions wait for your numbers."], hard, ...u, agents };
  const soft: string[] = [];
  if (agents.some((a) => !a.gatesPassed)) soft.push("The review didn't sign off on every required point.");
  else if (agents.some((a) => !a.shipped)) soft.push("The review scored some parts below the bar after the allowed revisions.");
  if (agents.some((a) => a.researchSources === 0)) soft.push("Research returned no sources, so the plan leans on assumptions.");
  const softErrors = agents.reduce((n, a) => n + Object.entries(a.errors).filter(([r]) => !HARD_RULES.has(r)).reduce((s, [, k]) => s + k, 0), 0);
  if (softErrors) soft.push(`${softErrors} smaller check${softErrors === 1 ? "" : "s"} still flagged (wording, focus or untraced numbers).`);
  return { version: 1, state: soft.length ? "provisional" : "passed", reasons: soft, hard, ...u, agents };
}

/** Plans in this state may be approved to start work (owner approval is still required). */
export function canDriveWork(q: Pick<PlanQuality, "state"> | null | undefined): boolean {
  // Older plans have no quality record: keep their behaviour.
  return !q || q.state !== "failed";
}

export const QUALITY_LABEL: Record<QualityState, string> = {
  passed: "Passed ClimbOS checks",
  provisional: "Provisional: review the flagged points",
  needs_input: "Needs your numbers",
  failed: "Didn't pass ClimbOS checks",
};

const FIELD: Record<string, string> = {
  summary: "Summary",
  positioning: "Positioning",
  diagnosis: "Diagnosis",
  affordableCac: "Affordable cost per customer",
  measurementPlan: "Measurement",
  northStar: "North Star",
  phases: "Phases",
  weekOneChecklist: "This week",
  risks: "Risks",
  channels: "Channels",
  audiences: "Audiences",
  plays: "Plays",
  economics: "Economics",
  experiments: "Experiments",
};

/** Owner-facing name of the plan part a finding sits in ("phases[1].focus" → "Phases 2"). */
export function fixWhere(path: string | undefined): string {
  if (!path) return "Plan";
  const m = path.match(/^([A-Za-z]+)(?:\[(\d+)\])?/);
  if (!m) return "Plan";
  const name = FIELD[m[1]] ?? m[1];
  return m[2] !== undefined ? `${name} ${Number(m[2]) + 1}` : name;
}
