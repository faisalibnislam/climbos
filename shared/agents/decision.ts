import { z } from "zod";
import type { LintIssue } from "./types";
import { capsHint, type WordCaps } from "./wordCaps";

/**
 * S5 (REQ-STRAT-01/02/04), behind the `decision_contract` flag: the decision
 * the plays rest on, as structured fields instead of one prose diagnosis.
 * The plays agent fills it in the same call that chooses the plays (no extra
 * model call); code checks it is complete and consistent with the plays.
 */

/** What limits growth most right now. Lack of traffic is one answer among several. */
export const CONSTRAINTS = ["demand", "activation", "conversion", "offer", "positioning", "retention", "delivery", "economics"] as const;
export type BindingConstraint = (typeof CONSTRAINTS)[number];
export const CONSTRAINT_LABEL: Record<BindingConstraint, string> = {
  demand: "Not enough of the right people see it",
  activation: "People sign up but don't get going",
  conversion: "Interested people don't buy",
  offer: "The offer doesn't pull",
  positioning: "Buyers can't tell why it's different",
  retention: "Customers don't stay",
  delivery: "Can't serve more customers well",
  economics: "Customers cost more than they're worth",
};

export const OPTION_KINDS = ["acquisition", "conversion", "offer", "retention", "capacity", "defer"] as const;

export const DecisionSchema = z.object({
  /** What was seen, each with where it came from. */
  observations: z.array(z.object({ observation: z.string(), source: z.enum(["owner", "site", "research", "results", "inference"]) })),
  constraint: z.enum(CONSTRAINTS),
  /** Competing explanations for the constraint, with what supports and undercuts each. */
  explanations: z.array(z.object({ explanation: z.string(), evidenceFor: z.string(), evidenceAgainst: z.string() })),
  /** What the evidence can't tell yet. */
  limits: z.string(),
  /** Options considered: exactly one chosen; every other one says why it lost. `plays` names the plays the option uses. */
  options: z.array(z.object({ name: z.string(), kind: z.enum(OPTION_KINDS), plays: z.array(z.string()), chosen: z.boolean(), whyNot: z.string() })),
  /** One sentence: the approach every play serves. */
  guidingPolicy: z.string(),
  /** The strategic shape, separate from the explanation of why it should work. */
  focus: z.object({ primaryPlay: z.string(), supportingMove: z.string(), maintenanceWork: z.string() }),
  /** The observation, with a number and a date, that would show this diagnosis is wrong. */
  falsifier: z.string(),
});
export type Decision = z.infer<typeof DecisionSchema>;

/** Owners skim: the decision stays short (checked with the plays' word caps). */
export const DECISION_CAPS: WordCaps = {
  "decision.observations[].observation": 20,
  "decision.explanations[].explanation": 15,
  "decision.explanations[].evidenceFor": 20,
  "decision.explanations[].evidenceAgainst": 20,
  "decision.limits": 25,
  "decision.options[].name": 8,
  "decision.options[].whyNot": 20,
  "decision.guidingPolicy": 20,
  "decision.focus.primaryPlay": 8,
  "decision.focus.supportingMove": 16,
  "decision.focus.maintenanceWork": 12,
  "decision.falsifier": 25,
};

/** The plays task's extra instruction when the flag is on. */
export const DECISION_FIELDS =
  `${capsHint(DECISION_CAPS)} Fill decision: observations (what you saw, each with its source; results means the owner's measured results), the binding constraint, 2 or 3 competing explanations with the evidence for and against each, what the evidence can't tell yet (limits), the options you considered (2 to 4 when the choice is real, just one when it's obvious; include fixing the offer, conversion, retention or capacity when that could be the constraint), exactly one chosen with the play names it uses, and for every other option why it lost (whyNot). Compare mapped options against the locked customer, cost, margin, budget, time and delivery numbers; if the numbers favor another option, state the evidence-based factor that changes the choice. Then set the strategic focus: name the exact primary play, one supporting move, and the recurring maintenance work that keeps the plan healthy. Finish with the guiding policy in one sentence and the falsifier: the observation with a number and a date that would show this diagnosis is wrong.`;

const DATED = /\b(day|days|week|weeks|month|months|by|within|after)\b|\d{4}-\d{2}-\d{2}/i;
const norm = (s: string) => s.trim().toLowerCase();

/** Deterministic checks: complete, one chosen option, losers explained, plays referenced exist, falsifier testable. */
export function lintDecision(d: Decision | undefined, plays: { name: string }[]): LintIssue[] {
  const issues: LintIssue[] = [];
  const err = (message: string, path = "decision") => issues.push({ severity: "error", rule: "decision", message, path });
  const warn = (message: string, path = "decision") => issues.push({ severity: "warn", rule: "decision", message, path });
  if (!d) return [{ severity: "error", rule: "decision", message: "Fill decision: observations, the binding constraint, explanations, options and the falsifier.", path: "decision" }];
  if (!d.observations.some((o) => o.observation.trim())) err("Name at least one observation and its source.", "decision.observations");
  if (d.observations.length && d.observations.every((o) => o.source === "inference")) warn("Every observation is an inference; add one the owner, site, research or results show.", "decision.observations");
  if (d.explanations.filter((e) => e.explanation.trim()).length < 2) err("Give at least 2 competing explanations for the constraint, with evidence for and against each.", "decision.explanations");
  d.explanations.forEach((e, i) => {
    if (e.explanation.trim() && !e.evidenceFor.trim() && !e.evidenceAgainst.trim()) err("Say what supports or undercuts this explanation.", `decision.explanations[${i}]`);
  });
  if (!d.options.length) err("List the options you considered.", "decision.options");
  if (d.options.length > 4) err(`${d.options.length} options; compare 2 to 4.`, "decision.options");
  const chosen = d.options.filter((o) => o.chosen);
  if (d.options.length && chosen.length !== 1) err(`${chosen.length} options chosen; choose exactly one.`, "decision.options");
  d.options.forEach((o, i) => {
    if (!o.chosen && !o.whyNot.trim()) err(`Say why "${o.name}" lost.`, `decision.options[${i}].whyNot`);
  });
  const names = new Set(plays.map((p) => norm(p.name)));
  if (chosen.length === 1) {
    const unknown = chosen[0].plays.filter((n) => !names.has(norm(n)));
    if (unknown.length) err(`The chosen option names plays that aren't in the plan: ${unknown.join(", ")}. Use the exact play names.`, "decision.options");
    const used = new Set(chosen[0].plays.map(norm));
    const loose = plays.filter((p) => !used.has(norm(p.name)));
    if (loose.length) warn(`Plays outside the chosen option: ${loose.map((p) => p.name).join(", ")}. Every play should serve the guiding policy.`, "decision.options");
  }
  if (!d.guidingPolicy.trim()) err("State the guiding policy in one sentence.", "decision.guidingPolicy");
  const primaryPlay = plays.find((p) => norm(p.name) === norm(d.focus.primaryPlay));
  if (!d.focus.primaryPlay.trim() || !primaryPlay) err("Name one exact play from the plan as the primary play.", "decision.focus.primaryPlay");
  if (!d.focus.supportingMove.trim()) err("Name one concrete supporting move for the primary play.", "decision.focus.supportingMove");
  if (!d.focus.maintenanceWork.trim()) err("Name the recurring maintenance work that keeps this strategy healthy.", "decision.focus.maintenanceWork");
  if (!/\d/.test(d.falsifier) || !DATED.test(d.falsifier)) err("The falsifier needs a number and a date, e.g. \"fewer than 3 booked calls from 200 sends by day 21\".", "decision.falsifier");
  return issues;
}
