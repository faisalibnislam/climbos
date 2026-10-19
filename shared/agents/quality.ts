/**
 * Plan quality (REQ-ENG-02), kept separate from the workflow's operational
 * status: a run can complete while its plan is provisional or failed. Code
 * decides the state from the agents' assessments and lint, never the model.
 *
 * - failed: a hard check failed (economics that don't add up or lose money,
 *   budget or capacity breached, a fabricated or unverifiable citation, a North
 *   Star that contradicts the plays). Saved for inspection; it can't start work.
 * - needs_input: what a customer is worth is missing, so money decisions wait.
 * - provisional: usable, but the review didn't pass or research came back thin.
 * - passed: every gate, lint check and rubric bar cleared.
 */
import type { Assessment, LintIssue } from "./types";

export type QualityState = "passed" | "provisional" | "needs_input" | "failed";

/** Lint rules whose failure means the plan must not drive work (REQ-EVAL hard failures). */
export const HARD_RULES = new Set(["economics", "budget", "capacity", "citation", "provenance", "consistency", "no_plays"]);

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
}

export interface PlanQuality {
  version: 1;
  state: QualityState;
  /** Owner-facing reasons, most important first. */
  reasons: string[];
  /** Hard findings (rule: message), kept for audit. */
  hard: string[];
  agents: AgentQuality[];
}

export function agentQuality(agentId: string, assessment: Assessment | null, rounds: number, researchSources: number | null): AgentQuality {
  const errors: Record<string, number> = {};
  for (const l of assessment?.lint ?? []) if (l.severity === "error") errors[l.rule] = (errors[l.rule] ?? 0) + 1;
  return { agentId, shipped: Boolean(assessment?.ship), gatesPassed: Boolean(assessment?.gatesPassed), average: assessment?.average ?? null, rounds, errors, researchSources };
}

const LABEL: Record<string, string> = {
  economics: "the numbers behind a play don't add up or it loses money",
  budget: "the plan spends more than your ad budget",
  capacity: "the plan needs more of your time than you have",
  citation: "a play cites a source the research didn't read",
  provenance: "a number is credited to a source without naming or quoting it",
  consistency: "the headline target doesn't match what the plays add up to",
  no_plays: "the plan has no plays to run",
};

/** Combine the plays and plan agents' results (plus any extra hard lint on the final plan) into one quality state. */
export function planQuality(agents: AgentQuality[], finalLint: LintIssue[] = [], opts: { economicsMissing?: boolean } = {}): PlanQuality {
  const hard: string[] = [];
  const hardRules = new Set<string>();
  for (const a of agents) for (const [rule, n] of Object.entries(a.errors)) if (HARD_RULES.has(rule) && n > 0) {
    hardRules.add(rule);
    hard.push(`${a.agentId}: ${rule} ×${n}`);
  }
  for (const l of finalLint) if (l.severity === "error" && HARD_RULES.has(l.rule)) {
    hardRules.add(l.rule);
    hard.push(`final: ${l.rule}${l.path ? ` @ ${l.path}` : ""}`);
  }
  const reasons: string[] = [...hardRules].map((r) => `Checks failed: ${LABEL[r] ?? r}.`);
  if (hardRules.size) return { version: 1, state: "failed", reasons, hard, agents };
  if (opts.economicsMissing) return { version: 1, state: "needs_input", reasons: ["What one customer is worth (price, margin or churn) is missing, so spending decisions wait for your numbers."], hard, agents };
  const soft: string[] = [];
  if (agents.some((a) => !a.gatesPassed)) soft.push("The review didn't sign off on every required point.");
  else if (agents.some((a) => !a.shipped)) soft.push("The review scored some parts below the bar after the allowed revisions.");
  if (agents.some((a) => a.researchSources === 0)) soft.push("Research returned no sources, so the plan leans on assumptions.");
  const softErrors = agents.reduce((n, a) => n + Object.entries(a.errors).filter(([r]) => !HARD_RULES.has(r)).reduce((s, [, k]) => s + k, 0), 0);
  if (softErrors) soft.push(`${softErrors} smaller check${softErrors === 1 ? "" : "s"} still flagged (wording, focus or untraced numbers).`);
  return { version: 1, state: soft.length ? "provisional" : "passed", reasons: soft, hard, agents };
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
