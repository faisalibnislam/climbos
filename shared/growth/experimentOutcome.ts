/**
 * Structured experiment outcomes (Book 14 §14, Book 13 §9). The owner records
 * who was eligible, who was exposed, what converted and how it was measured;
 * code decides what the result can claim:
 * - "observed": counts with no comparison group (or before/after). Not proof of cause.
 * - "attributed": the platform's own report. Its attribution, not a comparison.
 * - "incremental": randomized or holdout design with both groups measured.
 * - "not_run": the test wasn't carried out, so it says nothing about the channel.
 */

export const OUTCOME_SOURCES = ["owner_report", "integration", "platform_report"] as const;
export const OUTCOME_DESIGNS = ["none", "before_after", "holdout", "randomized"] as const;
export const OUTCOME_RESULTS = ["met", "missed", "unclear"] as const;

export type OutcomeSource = (typeof OUTCOME_SOURCES)[number];
export type OutcomeDesign = (typeof OUTCOME_DESIGNS)[number];
export type OutcomeResult = (typeof OUTCOME_RESULTS)[number];
export type Inference = "observed" | "attributed" | "incremental" | "not_run";

export interface OutcomeInput {
  /** Whether the plan was actually carried out. */
  executed: boolean;
  source: OutcomeSource;
  design: OutcomeDesign;
  /** Everyone who could have been in the test. */
  eligible?: number;
  /** People who got the change. */
  exposed?: number;
  /** Conversions among the exposed (on the analysis metric). */
  conversions?: number;
  /** Comparison group size (holdout / control arm). */
  controlSize?: number;
  /** Conversions in the comparison group. */
  controlConversions?: number;
  /** Observation window, ISO dates. */
  windowStart?: string;
  windowEnd?: string;
  /** Metric and success rule this analysis judges by (default: the experiment's originals). */
  metric: string;
  successRule: string;
  result: OutcomeResult;
  /** The original stopping rule was hit. */
  stopRuleHit: boolean;
  note?: string;
}

/** What the result can claim, from the design and source alone (never from the model). */
export function inferenceOf(o: Pick<OutcomeInput, "executed" | "source" | "design" | "exposed" | "controlSize">): Inference {
  if (!o.executed) return "not_run";
  if (o.source === "platform_report") return "attributed";
  const comparative = o.design === "randomized" || o.design === "holdout";
  if (comparative && (o.exposed ?? 0) > 0 && (o.controlSize ?? 0) > 0) return "incremental";
  return "observed";
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Problems with an outcome, in plain words; empty when it can be saved. */
export function outcomeProblems(o: OutcomeInput, today: string): string[] {
  const out: string[] = [];
  const counts = [o.eligible, o.exposed, o.conversions, o.controlSize, o.controlConversions];
  if (counts.some((n) => n !== undefined && (!Number.isInteger(n) || n < 0 || n > 100_000_000))) out.push("Counts must be whole numbers, zero or more.");
  if (o.eligible !== undefined && (o.exposed ?? 0) + (o.controlSize ?? 0) > o.eligible) out.push("Exposed plus comparison can't be more than eligible.");
  if (o.exposed !== undefined && o.conversions !== undefined && o.conversions > o.exposed) out.push("Conversions can't be more than exposed.");
  if (o.controlSize !== undefined && o.controlConversions !== undefined && o.controlConversions > o.controlSize) out.push("Comparison conversions can't be more than the group.");
  if ((o.design === "holdout" || o.design === "randomized") && o.executed && o.source !== "platform_report" && o.controlSize === undefined) out.push("Give the comparison group size.");
  for (const d of [o.windowStart, o.windowEnd]) if (d !== undefined && (!ISO.test(d) || Number.isNaN(Date.parse(d)))) out.push("Dates must be YYYY-MM-DD.");
  if (o.windowStart && o.windowEnd && o.windowStart > o.windowEnd) out.push("The window ends before it starts.");
  if (o.windowEnd && o.windowEnd > today) out.push("The window can't end in the future.");
  if (!o.metric.trim() || !o.successRule.trim()) out.push("Name the metric and the success rule.");
  if (o.metric.length > 200 || o.successRule.length > 300 || (o.note?.length ?? 0) > 500) out.push("Keep text short.");
  return out;
}

/** The analysis judges by a different metric or rule than the experiment set before results. */
export function isRedefined(o: Pick<OutcomeInput, "metric" | "successRule">, original: { primaryMetric: string; stoppingRule: string }): boolean {
  return o.metric.trim() !== original.primaryMetric.trim() || o.successRule.trim() !== original.stoppingRule.trim();
}

/** Same definition as an earlier analysis: a correction to that one, not a new analysis. */
export function sameDefinition(a: Pick<OutcomeInput, "metric" | "successRule">, b: Pick<OutcomeInput, "metric" | "successRule">): boolean {
  return a.metric.trim() === b.metric.trim() && a.successRule.trim() === b.successRule.trim();
}

const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;

/** Exposed vs comparison rates and the difference in conversions; only meaningful when incremental. */
export function lift(o: Pick<OutcomeInput, "exposed" | "conversions" | "controlSize" | "controlConversions">): { exposedRate: number; controlRate: number; extra: number } | null {
  if (!o.exposed || !o.controlSize || o.conversions === undefined || o.controlConversions === undefined) return null;
  const exposedRate = o.conversions / o.exposed;
  const controlRate = o.controlConversions / o.controlSize;
  return { exposedRate, controlRate, extra: Math.round((exposedRate - controlRate) * o.exposed) };
}

const RESULT_WORD: Record<OutcomeResult, string> = { met: "met its success rule", missed: "missed its success rule", unclear: "unclear against its success rule" };
const SOURCE_WORD: Record<OutcomeSource, string> = { owner_report: "owner report", integration: "integration", platform_report: "platform report" };

/**
 * One line for the next plan's brief. Wording follows the inference: only an
 * incremental result may speak of extra conversions caused by the change.
 */
export function outcomeLine(name: string, o: OutcomeInput & { inference: Inference; redefined: boolean }, original?: OutcomeResult): string {
  if (o.inference === "not_run") return `${name}: NOT RUN. No evidence about the channel either way.`;
  const window = o.windowStart && o.windowEnd ? `, ${o.windowStart} to ${o.windowEnd}` : "";
  const head = `${name} (${SOURCE_WORD[o.source]}${window}): ${RESULT_WORD[o.result]} on "${o.metric}"${o.stopRuleHit ? "; stop rule hit" : ""}`;
  const redefined = o.redefined ? ` Judged on a definition changed after results: exploratory only.${original ? ` On the original definition it ${RESULT_WORD[original]}.` : ""}` : "";
  const of = o.eligible !== undefined ? ` of ${o.eligible} eligible` : "";
  if (o.inference === "incremental") {
    const l = lift(o);
    const nums = l
      ? `${o.conversions}/${o.exposed} exposed (${pct(l.exposedRate)}) vs ${o.controlConversions}/${o.controlSize} in the comparison group (${pct(l.controlRate)}): about ${l.extra} incremental conversions`
      : `comparison group of ${o.controlSize}`;
    return `${head}. INCREMENTAL (${o.design}): ${nums}.${redefined}`;
  }
  const counts = o.exposed !== undefined ? `${o.conversions ?? "?"} conversions from ${o.exposed} exposed${of}` : o.conversions !== undefined ? `${o.conversions} conversions` : "no counts";
  if (o.inference === "attributed") return `${head}. ATTRIBUTED by the platform: ${counts}. The platform's attribution, not a measured lift.${redefined}`;
  return `${head}. OBSERVED: ${counts}; no comparison group, so not proof of cause.${redefined}`;
}
