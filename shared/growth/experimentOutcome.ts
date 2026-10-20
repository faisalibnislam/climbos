/**
 * Structured experiment outcomes (Book 14 §14, Book 13 §9). The owner records
 * who was eligible, who was exposed, what converted and how it was measured;
 * code decides what the result can claim:
 * - "observed": counts with no comparison group (or before/after). Not proof of cause.
 * - "attributed": the platform's own report. Its attribution, not a comparison.
 * - "incremental": randomized or holdout design with both groups measured.
 * - "not_run": the test wasn't carried out, so it says nothing about the channel.
 */
import { compareRates, sampleRatio } from "../analysis/decisions";

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
  /** Planned share (%) of people in the changed version, e.g. 50; lets the split be checked. */
  plannedSharePct?: number;
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

/**
 * What an incremental design's numbers can actually claim (blog research BRP-21:
 * Microsoft ExP, Kohavi): a split that doesn't match its plan can't be read,
 * and only a significant difference may be called extra conversions.
 */
export type Reading =
  | { kind: "no_counts" }
  | { kind: "split_mismatch"; splitP: number }
  | { kind: "split_warning"; splitP: number; pValue: number }
  | { kind: "no_difference"; pValue: number }
  | { kind: "difference"; pValue: number; extra: number };

export function readingOf(o: Pick<OutcomeInput, "exposed" | "conversions" | "controlSize" | "controlConversions" | "plannedSharePct">): Reading {
  if (!o.exposed || !o.controlSize || o.conversions === undefined || o.controlConversions === undefined) return { kind: "no_counts" };
  let splitWarn: number | null = null;
  if (o.plannedSharePct !== undefined && o.plannedSharePct > 0 && o.plannedSharePct < 100) {
    const srm = sampleRatio({ planned: [o.plannedSharePct, 100 - o.plannedSharePct], observed: [o.exposed, o.controlSize] });
    if (srm.mismatch) return { kind: "split_mismatch", splitP: srm.pValue };
    if (srm.warning) splitWarn = srm.pValue;
  }
  const r = compareRates({ control: { visitors: o.controlSize, conversions: o.controlConversions }, treatment: { visitors: o.exposed, conversions: o.conversions } });
  if (splitWarn !== null) return { kind: "split_warning", splitP: splitWarn, pValue: r.pValue };
  if (r.verdict !== "difference_detected") return { kind: "no_difference", pValue: r.pValue };
  return { kind: "difference", pValue: r.pValue, extra: lift(o)?.extra ?? 0 };
}

const fmtP = (p: number) => (p < 0.001 ? "p < 0.001" : `p = ${Math.round(p * 1000) / 1000}`);

/** One owner-facing phrase for a reading. */
export function readingText(r: Reading): string {
  switch (r.kind) {
    case "no_counts":
      return "Counts missing for one arm: nothing can be read yet.";
    case "split_mismatch":
      return `The split doesn't match the plan (${fmtP(r.splitP)}): find the cause before reading the result.`;
    case "split_warning":
      return `The split looks off (${fmtP(r.splitP)}): check it before calling a winner.`;
    case "no_difference":
      return `No reliable difference (${fmtP(r.pValue)}): not proof it worked, or that it didn't.`;
    case "difference":
      return `A difference the data can tell apart (${fmtP(r.pValue)}).`;
  }
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Problems with an outcome, in plain words; empty when it can be saved. */
export function outcomeProblems(o: OutcomeInput, today: string): string[] {
  const out: string[] = [];
  const counts = [o.eligible, o.exposed, o.conversions, o.controlSize, o.controlConversions];
  if (counts.some((n) => n !== undefined && (!Number.isInteger(n) || n < 0 || n > 100_000_000))) out.push("Counts must be whole numbers, zero or more.");
  if (o.eligible !== undefined && (o.exposed ?? 0) + (o.controlSize ?? 0) > o.eligible) out.push("Exposed plus comparison can't be more than eligible.");
  if (o.plannedSharePct !== undefined && !(o.plannedSharePct > 0 && o.plannedSharePct < 100)) out.push("The planned share must be between 1 and 99%.");
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
    const r = readingOf(o);
    const counts = l ? `${o.conversions}/${o.exposed} exposed (${pct(l.exposedRate)}) vs ${o.controlConversions}/${o.controlSize} in the comparison group (${pct(l.controlRate)})` : `comparison group of ${o.controlSize}`;
    // Only a valid split with a significant difference may speak of extra conversions.
    const claim = r.kind === "difference" ? `about ${r.extra} incremental conversions (${fmtP(r.pValue)})` : readingText(r);
    return `${head}. ${r.kind === "difference" ? "INCREMENTAL" : "COMPARED"} (${o.design}): ${counts}: ${claim}${redefined}`;
  }
  const counts = o.exposed !== undefined ? `${o.conversions ?? "?"} conversions from ${o.exposed} exposed${of}` : o.conversions !== undefined ? `${o.conversions} conversions` : "no counts";
  if (o.inference === "attributed") return `${head}. ATTRIBUTED by the platform: ${counts}. The platform's attribution, not a measured lift.${redefined}`;
  return `${head}. OBSERVED: ${counts}; no comparison group, so not proof of cause.${redefined}`;
}
