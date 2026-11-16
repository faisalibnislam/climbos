import { outcomeProblems, readingOf, readingText, validOutcomeDay, type OutcomeInput } from "./experimentOutcome";

export const DESIGN_LEARNING_POLICY = "PAST PAGE-CHANGE REPORTS (same workspace, member-recorded; not independently verified): preserve each exact page version, objective, audience, source, window and calculated evidence assessment. Only observed or compared records can support an outcome-based inference; all records may help frame a reversible test. Needs-evidence, inconclusive and not-run records identify evidence gaps or test improvements, not winners or losers. Uncertainty must not suppress original or bold ideation. Neither a reported result nor a calculated comparison establishes a reusable winning design, causal proof, a universal brand rule or execution permission.";

export type DesignLearningState = "no_outcome" | "not_run" | "needs_evidence" | "inconclusive" | "observed" | "compared";
export type DesignLearningAssessment = { state: DesignLearningState; summary: string; limits: string[] };

/** Evidence checks for reuse, not a quality score or permission to change a page. */
export function assessDesignLearning(input: {
  outcome?: OutcomeInput & { redefined: boolean };
  publicationConfirmed: boolean;
  publicationApprovedAt?: number;
  measurementBound: boolean;
  baselineRecorded: boolean;
  method: string;
  metricType?: string;
  preregisteredAt?: number;
  deviations: number;
  now: number;
}): DesignLearningAssessment {
  const o = input.outcome;
  if (!o) return { state: "no_outcome", summary: "No result recorded yet.", limits: [] };
  if (!o.executed) return { state: "not_run", summary: "Not run. This says nothing about whether the design works.", limits: [] };
  const limits = ["Results were entered by a workspace member; the stated data source and version exposure have not been independently verified."];
  const missing: string[] = [];
  if (!input.publicationConfirmed) missing.push("Publication approval for this exact page version is unverified.");
  if (!input.measurementBound) missing.push("The saved measurement definition for this exact version is unavailable or does not match the original test.");
  const validDay = validOutcomeDay;
  if (!validDay(o.windowStart) || !validDay(o.windowEnd)) missing.push("Record a valid observation start and end date.");
  missing.push(...outcomeProblems(o, new Date(input.now).toISOString().slice(0, 10)));
  if (validDay(o.windowEnd) && input.publicationApprovedAt !== undefined && Date.parse(o.windowEnd!) + 86_400_000 <= input.publicationApprovedAt) missing.push("The observation window ends before the recorded publication approval.");
  if (missing.length) return { state: "needs_evidence", summary: "Keep this as a result report; more evidence is needed before using it as a design lesson.", limits: [...missing, ...limits] };
  if (input.publicationApprovedAt === undefined) limits.push("The historical publication time is unrecorded; exposure timing remains unknown.");
  if (o.redefined) limits.push("The outcome was judged using a changed metric or success rule; it is exploratory.");
  if (input.deviations) limits.push("The owner recorded changes to the test while it ran; review those changes before interpreting it.");
  if (o.stopRuleHit) limits.push("A stop rule was hit; do not treat this as a reusable winning design.");
  if (o.result === "unclear") limits.push("The owner marked the result unclear.");
  if (o.redefined || input.deviations || o.stopRuleHit || o.result === "unclear") return { state: "inconclusive", summary: "Inconclusive for choosing a future design; use it to improve the next test.", limits };
  if (o.design === "before_after" && !input.baselineRecorded) return { state: "inconclusive", summary: "The baseline is unknown; the result cannot establish an improvement over the original design.", limits };
  if (o.exposed === undefined || o.exposed <= 0 || o.conversions === undefined) return { state: "inconclusive", summary: "Exposure or outcome counts are missing; no design winner is established.", limits };
  const comparative = o.design === "randomized" || o.design === "holdout";
  if (comparative) {
    const methodMatches = (input.method === "ab_split" && o.design === "randomized" && o.assignment === "random") || (input.method === "holdout" && o.design === "holdout" && o.assignment === "random");
    if (!methodMatches || input.metricType !== "binary_rate" || input.preregisteredAt === undefined || input.preregisteredAt > Date.parse(o.windowStart!) || o.plannedSharePct === undefined) {
      return { state: "inconclusive", summary: "The comparison needs a matching, pre-registered rate test and planned split before it can guide a design choice.", limits };
    }
    const reading = readingOf(o);
    return { state: reading.kind === "difference" ? "compared" : "inconclusive", summary: readingText(reading), limits: [...limits, "A calculated comparison does not verify assignment, tracking, confounding or that this design will work elsewhere."] };
  }
  return { state: "observed", summary: "Use this as an observed result to inform another test, not proof the design caused it.", limits: [...limits, o.design === "before_after" ? "Traffic, timing, audience mix and other changes may explain a before/after difference." : "No comparison group establishes what would have happened without the change."] };
}
