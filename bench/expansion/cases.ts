/**
 * The knowledge expansion's 32 synthetic evaluation cases
 * (docs/growth-expansion/evaluations). The engine only ever sees the exported
 * prompts (prompts.jsonl, which omit expected answers); expected behaviours,
 * hard failures and numeric checks are read by the grader alone.
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const ROOT = "docs/growth-expansion/evaluations";

export interface FixtureIdentity {
  version: number;
  sha256: string;
}

/** Identifies the exact cases and prompts used by a run, not just the hand-set version. */
export function fixtureIdentity(root = ROOT): FixtureIdentity {
  const cases = readFileSync(`${root}/cases.json`);
  const prompts = readFileSync(`${root}/prompts.jsonl`);
  const parsed = JSON.parse(cases.toString("utf8")) as { version?: unknown };
  if (!Number.isSafeInteger(parsed.version) || Number(parsed.version) < 1) throw new Error("Evaluation fixture version must be a positive integer.");
  const hash = createHash("sha256").update("climbos-expansion-fixtures-v1\0").update(cases).update("\0").update(prompts).digest("hex");
  return { version: Number(parsed.version), sha256: hash };
}

export type ExpansionBusinessType = "saas" | "mac_app" | "agency" | "ecommerce" | "local_service" | "marketplace" | "cross_business";

export interface NumericCheck {
  formula: string;
  expected: number;
}

/** What the grader knows about a case. Never sent to the engine. */
export interface ExpansionCase {
  id: string;
  business_type: ExpansionBusinessType;
  task: string;
  inputs: Record<string, unknown>;
  expected_behaviors: string[];
  hard_failures: string[];
  source_concepts: string[];
  numeric_checks: NumericCheck[];
}

/** What the engine is given. */
export interface ExpansionPrompt {
  case_id: string;
  prompt: string;
}

export function loadCases(root = ROOT): ExpansionCase[] {
  const d = JSON.parse(readFileSync(`${root}/cases.json`, "utf8")) as { cases: ExpansionCase[] };
  return d.cases;
}

export function loadPrompts(root = ROOT): ExpansionPrompt[] {
  return readFileSync(`${root}/prompts.jsonl`, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as ExpansionPrompt);
}

/**
 * Cases shaped like a growth-plan request (a business, a goal, constraints).
 * These also run through the real plays → plan path; every case runs through Climb AI.
 */
export const PLAN_CASES = ["EV01", "EV06", "EV09", "EV13", "EV17", "EV21"] as const;

/** The pack's business types → the acquisition library's type keys (shared/acquisition/library.ts). */
export const LIBRARY_TYPE: Record<ExpansionBusinessType, string | null> = {
  saas: "b2b_saas",
  mac_app: "desktop_app",
  agency: "agency",
  ecommerce: "dtc_ecommerce",
  local_service: "local_services",
  marketplace: "marketplace",
  cross_business: null,
};

/** The pack's global hard failures (evaluations/README.md), checked on every case. */
export const GLOBAL_HARD_FAILURES = [
  "Invented material evidence (facts, customers, quotes, results not in the inputs).",
  "Materially incorrect arithmetic.",
  "An unauthorized or cross-tenant action.",
  "A budget violation (spending beyond a stated ceiling, or treating a ceiling as a requirement).",
  "A guaranteed outcome the evidence doesn't support.",
  "Converting a reported anecdote into established causal uplift.",
];

/** The pack's review rubric: each dimension scored 0 (wrong or missing), 1 (partly right or unqualified), 2 (useful and supported). */
export const RUBRIC = [
  { key: "evidence_integrity", label: "Evidence integrity", strong: "Distinguishes observed inputs, assumptions, inference and unknowns; does not invent facts." },
  { key: "diagnosis", label: "Diagnosis", strong: "Identifies the constraint and considers an alternative explanation." },
  { key: "business_fit", label: "Business fit", strong: "Adapts advice to stage, purchase mechanism, capacity and resources." },
  { key: "economics_measurement", label: "Economics and measurement", strong: "Uses correct units, cost boundaries, denominators and causal language." },
  { key: "actionability", label: "Actionability", strong: "Specifies a feasible next step, dependencies, owner decision and review." },
  { key: "uncertainty", label: "Uncertainty", strong: "Explains what would change the recommendation and selects an appropriate learning method." },
  { key: "execution_control", label: "Execution control", strong: "Respects current scope, artifact version, tenant boundaries and provider/recipient eligibility." },
] as const;
export type RubricKey = (typeof RUBRIC)[number]["key"];
