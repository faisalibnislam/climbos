/**
 * Structured experiment outcomes (Book 14 §14, Book 13 §9). The owner records
 * who was eligible, who was exposed, what converted and how it was measured;
 * code classifies the reported design; source/assignment are not independently verified:
 * - "observed": counts with no comparison group (or before/after). Not proof of cause.
 * - "attributed": the member reports platform attribution; not a verified platform read.
 * - "incremental": legacy label for a reported random comparison with nonempty groups.
 *   A holdout picked by a rule or by the owner isn't exchangeable with the treated group
 *   (Hernán & Robins Ch 2–3; Kohavi Ch 11), so it stays "observed" with its comparison shown.
 * - "not_run": the test wasn't carried out, so it says nothing about the channel.
 */
import { compareRates, sampleRatio } from "../analysis/decisions";
import { formatMinorMoney, isKnownCurrency } from "../economics/currency";
import { currencyExponent, decimalToMinor } from "../integrations/currency";

/** Member-reported aggregate; monetary values use exact integer minor units. */
export interface OutcomeMeasurement {
  type: "count" | "continuous" | "monetary";
  value: number | null;
  comparisonValue: number | null;
  unit: string;
  currency?: string;
  /** Population, aggregation and cost boundary where applicable. */
  basis: string;
  comparisonBasis: string;
}

export function measurementProblems(m: OutcomeMeasurement): string[] {
  const out: string[] = [];
  if (!m.unit.trim() || m.unit.length > 80 || !m.basis.trim() || m.basis.length > 400) out.push("Name the measurement unit and what the value covers (up to 400 characters).");
  if (m.comparisonBasis.length > 400 || (m.comparisonValue !== null && !m.comparisonBasis.trim())) out.push("Explain what the comparison value covers; leave it unknown if it was not recorded.");
  if (m.type === "monetary" ? !m.currency || !isKnownCurrency(m.currency) || m.currency !== m.currency.trim().toUpperCase() : m.currency !== undefined) out.push("Money needs a supported currency; other measurements must not carry a currency.");
  for (const value of [m.value, m.comparisonValue]) {
    if (value === null) continue;
    if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER || (m.type !== "continuous" && !Number.isSafeInteger(value)) || (m.type === "count" && value < 0)) out.push("Values must be finite; counts are nonnegative whole numbers and money uses whole minor units.");
  }
  return out;
}

/** No conversion to counts, no effect estimate, and no automatic verdict. */
export function measurementText(m: OutcomeMeasurement): string {
  if (measurementProblems(m).length) return "Recorded measurement is invalid; correct its values, units and scope before use.";
  const value = (n: number | null) => n === null ? "Unknown" : m.type === "monetary" ? `${formatMinorMoney(n, m.currency)} ${m.currency}` : `${n} ${m.unit}`;
  return `Recorded value: ${value(m.value)}${m.type === "monetary" ? ` (${m.unit})` : ""}. Scope: ${m.basis}. Comparison value: ${value(m.comparisonValue)}. Comparison basis: ${m.comparisonBasis || "Unknown"}. These are reported observations, not proof of cause; comparability and completeness are unverified.`;
}

/** Exact money input round trips; blanks remain unknown, including a blank comparison. */
export function measurementInputValue(value: number | null | undefined, type: OutcomeMeasurement["type"], currency?: string): string {
  if (value == null) return "";
  if (type !== "monetary") return String(value);
  if (!currency || !isKnownCurrency(currency) || !Number.isSafeInteger(value)) return "";
  const digits = currencyExponent(currency), scale = 10n ** BigInt(digits), amount = BigInt(value), abs = amount < 0n ? -amount : amount;
  return `${amount < 0n ? "-" : ""}${abs / scale}${digits ? `.${String(abs % scale).padStart(digits, "0")}` : ""}`;
}

export function parseMeasurementValue(raw: string, type: OutcomeMeasurement["type"], currency?: string): number | null {
  if (!raw.trim()) return null;
  if (type === "monetary") {
    if (!currency || !isKnownCurrency(currency)) throw new Error("Choose the currency used in these records.");
    const parsed = decimalToMinor(raw, currency);
    if (!parsed.ok) throw new Error(parsed.error);
    return parsed.minor;
  }
  if (!/^-?\d+(?:\.\d+)?$/.test(raw.trim())) throw new Error("Enter a plain number, or leave it blank if unknown.");
  const value = Number(raw);
  if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER || (type === "count" && (!Number.isSafeInteger(value) || value < 0))) throw new Error("Enter a finite value; counts must be nonnegative whole numbers.");
  return value;
}

export const OUTCOME_SOURCES = ["owner_report", "integration", "platform_report"] as const;
export const OUTCOME_DESIGNS = ["none", "before_after", "holdout", "randomized"] as const;
export const OUTCOME_RESULTS = ["met", "missed", "unclear"] as const;
/** How the comparison group was chosen: only random assignment supports a causal reading. */
export const OUTCOME_ASSIGNMENTS = ["random", "rule", "owner_choice"] as const;
export type OutcomeAssignment = (typeof OUTCOME_ASSIGNMENTS)[number];

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
  /** Everyone assigned to get the change, whether or not they used it (count by person, not visit). */
  exposed?: number;
  /** How either comparison group was chosen (missing on older records = unknown). */
  assignment?: OutcomeAssignment;
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
  measurement?: OutcomeMeasurement;
}

/** Legacy storage classification of the reported design, not proof of causal impact. */
export function inferenceOf(o: Pick<OutcomeInput, "executed" | "source" | "design" | "exposed" | "controlSize" | "assignment" | "measurement">): Inference {
  if (!o.executed) return "not_run";
  if (o.source === "platform_report") return "attributed";
  if (o.measurement) return "observed"; // Aggregate amounts cannot support the binary-rate calculator.
  const comparative = (o.design === "randomized" || o.design === "holdout") && o.assignment === "random";
  if (comparative && (o.exposed ?? 0) > 0 && (o.controlSize ?? 0) > 0) return "incremental";
  return "observed";
}

/**
 * Assess reported comparison counts using the existing deterministic calculator.
 * Unknown or suspect allocation prevents a reliable comparison reading; even a
 * significant rate difference does not independently verify a causal design.
 */
export type Reading =
  | { kind: "no_counts" }
  | { kind: "invalid_counts" }
  | { kind: "split_unknown" }
  | { kind: "split_mismatch"; splitP: number }
  | { kind: "split_warning"; splitP: number; pValue: number }
  | { kind: "no_difference"; pValue: number; interval?: [number, number] }
  | { kind: "difference"; pValue: number; extra: number; interval?: [number, number] };

export function readingOf(o: Pick<OutcomeInput, "exposed" | "conversions" | "controlSize" | "controlConversions" | "plannedSharePct">): Reading {
  if ([o.exposed, o.controlSize, o.conversions, o.controlConversions].some(n => n !== undefined && (!Number.isSafeInteger(n) || n < 0 || n > 100_000_000)) || (o.exposed !== undefined && o.conversions !== undefined && o.conversions > o.exposed) || (o.controlSize !== undefined && o.controlConversions !== undefined && o.controlConversions > o.controlSize)) return { kind: "invalid_counts" };
  if (!o.exposed || !o.controlSize || o.conversions === undefined || o.controlConversions === undefined) return { kind: "no_counts" };
  if (o.plannedSharePct === undefined || !Number.isFinite(o.plannedSharePct) || !(o.plannedSharePct > 0 && o.plannedSharePct < 100)) return { kind: "split_unknown" };
  let splitWarn: number | null = null;
  if (o.plannedSharePct !== undefined && o.plannedSharePct > 0 && o.plannedSharePct < 100) {
    const srm = sampleRatio({ planned: [o.plannedSharePct, 100 - o.plannedSharePct], observed: [o.exposed, o.controlSize] });
    if (srm.mismatch) return { kind: "split_mismatch", splitP: srm.pValue };
    if (srm.warning) splitWarn = srm.pValue;
  }
  const r = compareRates({ control: { visitors: o.controlSize, conversions: o.controlConversions }, treatment: { visitors: o.exposed, conversions: o.conversions } });
  if (splitWarn !== null) return { kind: "split_warning", splitP: splitWarn, pValue: r.pValue };
  if (r.verdict !== "difference_detected") return { kind: "no_difference", pValue: r.pValue, interval: r.differenceInterval };
  return { kind: "difference", pValue: r.pValue, extra: lift(o)?.extra ?? 0, interval: r.differenceInterval };
}

const fmtP = (p: number) => (p < 0.001 ? "p < 0.001" : `p = ${Math.round(p * 1000) / 1000}`);
const ptsRange = ([lo, hi]: [number, number]) => `${Math.round(lo * 1000) / 10} to ${Math.round(hi * 1000) / 10} points`;

/** One owner-facing phrase for a reading. */
export function readingText(r: Reading): string {
  switch (r.kind) {
    case "no_counts":
      return "Counts missing for one arm: nothing can be read yet.";
    case "invalid_counts":
      return "The recorded counts conflict or are invalid. Correct them before interpreting the comparison.";
    case "split_unknown":
      return "The planned split is unknown. Record the original allocation before checking the comparison; do not infer it from the observed counts.";
    case "split_mismatch":
      return `The split doesn't match the plan (${fmtP(r.splitP)}): find the cause before reading the result.`;
    case "split_warning":
      return `The split looks off (${fmtP(r.splitP)}): check it before calling a winner.`;
    case "no_difference":
      return `No reliable difference (${fmtP(r.pValue)}${r.interval ? `; likely ${ptsRange(r.interval)}` : ""}): not proof it worked, or that it didn't.`;
    case "difference":
      return `A calculated rate difference (${fmtP(r.pValue)}${r.interval ? `; likely ${ptsRange(r.interval)}` : ""}).`;
  }
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
export function validOutcomeDay(value: string | undefined): boolean {
  return Boolean(value && ISO.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value);
}

/** Problems with an outcome, in plain words; empty when it can be saved. */
export function outcomeProblems(o: OutcomeInput, today: string): string[] {
  const out: string[] = [];
  if (o.measurement) {
    out.push(...measurementProblems(o.measurement));
    if (!o.executed) out.push("A test that did not run cannot include measured values.");
    if (o.conversions !== undefined || o.controlConversions !== undefined) out.push("Record the metric value separately; it cannot also be a conversion count.");
    if (o.design === "none" && o.measurement.comparisonValue !== null) out.push("Select a reported comparison design before recording a comparison value.");
  }
  const counts = [o.eligible, o.exposed, o.conversions, o.controlSize, o.controlConversions];
  if (counts.some((n) => n !== undefined && (!Number.isInteger(n) || n < 0 || n > 100_000_000))) out.push("Counts must be whole numbers, zero or more.");
  if (o.eligible !== undefined && (o.exposed ?? 0) + (o.controlSize ?? 0) > o.eligible) out.push("Exposed plus comparison can't be more than eligible.");
  if (o.plannedSharePct !== undefined && !(o.plannedSharePct > 0 && o.plannedSharePct < 100)) out.push("The planned share must be greater than 0 and less than 100%.");
  if (o.exposed !== undefined && o.conversions !== undefined && o.conversions > o.exposed) out.push("Conversions can't be more than exposed.");
  if (o.controlSize !== undefined && o.controlConversions !== undefined && o.controlConversions > o.controlSize) out.push("Comparison conversions can't be more than the group.");
  if ((o.design === "holdout" || o.design === "randomized") && o.executed && !o.measurement && o.source !== "platform_report" && o.controlSize === undefined) out.push("Give the comparison group size.");
  for (const d of [o.windowStart, o.windowEnd]) if (d !== undefined && !validOutcomeDay(d)) out.push("Dates must be YYYY-MM-DD.");
  if (o.windowStart && o.windowEnd && o.windowStart > o.windowEnd) out.push("The window ends before it starts.");
  if (o.windowStart && o.windowStart > today) out.push("The window cannot start in the future.");
  if (o.windowEnd && o.windowEnd > today) out.push("The window can't end in the future.");
  if (!o.metric.trim() || !o.successRule.trim()) out.push("Name the metric and the success rule.");
  if (o.metric.length > 200 || o.successRule.length > 300 || (o.note?.length ?? 0) > 500) out.push("Keep text short.");
  return out;
}

/** The analysis judges by a different metric or rule than the experiment set before results. */
type OutcomeDefinition = Pick<OutcomeInput, "metric" | "successRule" | "measurement">;
const measurementDefinition = (m?: OutcomeMeasurement) => m ? JSON.stringify([m.type, m.unit.trim(), m.currency ?? null, m.basis.trim(), m.comparisonBasis.trim()]) : "";
export function isRedefined(o: OutcomeDefinition, original: { primaryMetric: string; stoppingRule: string; primaryMetricType?: string }, firstReport?: OutcomeDefinition): boolean {
  return o.metric.trim() !== original.primaryMetric.trim() || o.successRule.trim() !== original.stoppingRule.trim()
    || Boolean(o.measurement && original.primaryMetricType && o.measurement.type !== original.primaryMetricType)
    || Boolean(firstReport && measurementDefinition(o.measurement) !== measurementDefinition(firstReport.measurement));
}

/** Same definition as an earlier analysis: a correction to that one, not a new analysis. */
export function sameDefinition(a: OutcomeDefinition, b: OutcomeDefinition): boolean {
  return a.metric.trim() === b.metric.trim() && a.successRule.trim() === b.successRule.trim() && measurementDefinition(a.measurement) === measurementDefinition(b.measurement);
}

const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;

/** Descriptive rates and rate difference scaled to the treatment group; not causal verification. */
export function lift(o: Pick<OutcomeInput, "exposed" | "conversions" | "controlSize" | "controlConversions">): { exposedRate: number; controlRate: number; extra: number } | null {
  if (!o.exposed || !o.controlSize || o.conversions === undefined || o.controlConversions === undefined) return null;
  if ([o.exposed, o.controlSize, o.conversions, o.controlConversions].some(n => !Number.isSafeInteger(n) || n < 0 || n > 100_000_000) || o.conversions > o.exposed || o.controlConversions > o.controlSize) return null;
  const exposedRate = o.conversions / o.exposed;
  const controlRate = o.controlConversions / o.controlSize;
  return { exposedRate, controlRate, extra: Math.round((exposedRate - controlRate) * o.exposed) };
}

const RESULT_WORD: Record<OutcomeResult, string> = { met: "met its success rule", missed: "missed its success rule", unclear: "unclear against its success rule" };
export const OUTCOME_SOURCE_LABEL: Record<OutcomeSource, string> = { owner_report: "Member-entered report", integration: "Member-entered; reported source: connected tool", platform_report: "Member-entered; reported source: platform report" };
export const OUTCOME_REPORT_LIMIT = "Source, assignment, tracking and outcome maturity have not been independently verified. A reported success rule or calculated difference is not proof of causal impact.";

/**
 * One line for the next plan: calculated comparisons of member-entered reports
 * must not be promoted to independently verified causal effects.
 */
export function outcomeLine(name: string, o: OutcomeInput & { inference: Inference; redefined: boolean }, original?: OutcomeResult, originalMetricType?: string): string {
  const inference = inferenceOf(o); // Reassess legacy labels from the saved reported inputs.
  if (inference === "not_run") return `${name}: NOT RUN. No evidence about the channel either way.`;
  const window = validOutcomeDay(o.windowStart) && validOutcomeDay(o.windowEnd) && o.windowStart! <= o.windowEnd! ? `, ${o.windowStart} to ${o.windowEnd}` : ", observation window incomplete or invalid";
  const head = `${name} (${OUTCOME_SOURCE_LABEL[o.source]}${window}): reported result: ${RESULT_WORD[o.result]} on "${o.metric}"${o.stopRuleHit ? "; stop rule hit" : ""}`;
  const redefined = o.redefined ? ` Judged on a definition changed after results: exploratory only.${original ? ` On the original definition it ${RESULT_WORD[original]}.` : ""}` : "";
  if (o.measurement) return `${head}. ${measurementText(o.measurement)} ${OUTCOME_REPORT_LIMIT}${redefined}`;
  if (originalMetricType && originalMetricType !== "binary_rate" && (o.conversions !== undefined || o.controlConversions !== undefined)) return `${head}. Primary metric value unknown: this older report contains conversion-style counts for a non-conversion metric. Review the original report before interpreting it. ${OUTCOME_REPORT_LIMIT}${redefined}`;
  const of = o.eligible !== undefined ? ` of ${o.eligible} eligible` : "";
  if (inference === "incremental") {
    const l = lift(o);
    const r = readingOf(o);
    const counts = l ? `${o.conversions}/${o.exposed} exposed (${pct(l.exposedRate)}) vs ${o.controlConversions}/${o.controlSize} in the comparison group (${pct(l.controlRate)})` : `comparison group of ${o.controlSize}`;
    // Preserve signed intervals: a harmful difference must not be clipped to zero.
    const range = r.kind === "difference" && r.interval && o.exposed ? `, 95% interval ${Math.round(r.interval[0] * o.exposed)} to ${Math.round(r.interval[1] * o.exposed)}` : "";
    const claim = r.kind === "difference" ? `calculated difference of ${r.extra} conversions at the reported treatment-group size${range} (${fmtP(r.pValue)})` : readingText(r);
    return `${head}. REPORTED RANDOMIZED COMPARISON (${o.design}): ${counts}: ${claim.replace(/\.$/, "")}. ${OUTCOME_REPORT_LIMIT}${redefined}`;
  }
  const counts = o.exposed !== undefined ? `${o.conversions ?? "?"} conversions from ${o.exposed} exposed${of}` : o.conversions !== undefined ? `${o.conversions} conversions` : "no counts";
  if (inference === "attributed") return `${head}. ATTRIBUTED by the platform: ${counts}. The platform's attribution, not a measured lift.${redefined}`;
  if ((o.design === "holdout" || o.design === "randomized") && o.controlSize) {
    const l = lift(o);
    const how = o.assignment === "rule" ? "chosen by a rule" : o.assignment === "owner_choice" ? "chosen by hand" : "chosen in an unrecorded way";
    return `${head}. COMPARED, RANDOMIZATION UNVERIFIED (${o.design} ${how}): ${l ? `${pct(l.exposedRate)} vs ${pct(l.controlRate)}` : counts}. The groups may differ in other ways, so this isn't proof of cause.${redefined}`;
  }
  return `${head}. OBSERVED: ${counts}; no validated comparison, so not proof of cause.${redefined}`;
}
