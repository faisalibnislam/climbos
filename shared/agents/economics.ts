import { formatMoney, thresholdIn } from "../economics/currency";
import type { LintIssue } from "./types";
import { CHECK_STAMP, economicsSources, financialEvidence, forecastBasis, type EconomicsSources, type FinancialEvidence, type Provenance, type SourceTag, type TagCheck } from "./provenance";
import { createRng } from "../forecasting/prng";
import { goalGap, goalLines, type GoalGap, type GoalTarget } from "./goal";
import { allowableCac, breakevenPerReach, cacFull, churnFromLifetime, contributionMonth, contributionOver, funnelCustomers, paybackWithChurn, portfolioCustomers } from "../growth/calc";
import { playStage } from "./diagnosis";
import { decidesLine, switchPoints } from "./voi";

/**
 * Growth maths in code, not prose (spec §15–17): each play's inputs (reach,
 * step rates with low/high, spend, owner hours) become 90-day customers with
 * a P10–P90 range from a seeded simulation over those ranges, a fully loaded
 * cost per customer, payback with churn and the allowable cost per customer
 * over 12 months. The model never writes these numbers; the plan receives
 * them as locked numbers.
 */

export interface PlayStep {
  name: string;
  /** Most-likely share passing this step (0–1). */
  rate: number;
  low?: number;
  high?: number;
  /**
   * The rate at this step today, without the play (plays that change an existing step: onboarding,
   * checkout, follow-up). When any step has one, only the extra customers count: reach × (Π rate − Π baseline).
   * People who'd have converted anyway aren't the play's customers (decision books: Hernán & Robins Ch 1).
   */
  baselineRate?: number;
  /** Where the rate came from (newer plans); `check` is set by code, never by the writer. */
  source?: Provenance;
  ref?: string;
  quote?: string;
  population?: string;
  denominator?: string;
  period?: string;
  check?: TagCheck;
  checkedBy?: string;
  access?: SourceTag["access"];
  receipt?: SourceTag["receipt"];
}
export interface PlayModel {
  weeklyReach: number;
  weeklyReachLow?: number;
  weeklyReachHigh?: number;
  /** Weeks to reach the stated weekly reach; omitted means immediate full volume. */
  rampWeeks?: number;
  /** Delay from reaching a prospect to a paying customer; omitted means no modeled lag. */
  salesLagDays?: number;
  steps: PlayStep[];
  monthlySpendUsd: number;
  ownerHoursPerWeek: number;
  /** Monthly non-media costs (tools, freelancers, creative); part of cost per customer (blog research BRP-17, Skok's fully loaded CAC). */
  otherMonthlyUsd?: number;
  /** Where the monthly non-media cost came from. */
  otherSource?: SourceTag;
  /** Where reach, spend and owner hours came from (newer plans). */
  reachSource?: SourceTag;
  spendSource?: SourceTag;
  hoursSource?: SourceTag;
}
export interface Economics {
  revenuePerCustomerMonthUsd: number;
  /** Contribution margin before acquisition (0–1). */
  grossMargin: number;
  /** Share of customers lost each month (0–1). Older plans give monthsRetained instead. */
  monthlyChurn?: number;
  monthsRetained?: number;
  basis: string;
  /** Which of revenue / margin / churn are assumptions rather than facts (derived from `sources` on newer plans). */
  assumed?: string[];
  /** Where each economics input came from (owner, research, benchmark, assumption). */
  sources?: EconomicsSources;
  /** Value of an owner hour; $50 (scaled to the currency) when unknown. */
  ownerHourUsd?: number;
  /** Workspace currency (ISO code), set by code. Every "Usd" amount here is in this currency; absent means USD. */
  currency?: string;
  /** Ranges the owner gave instead of one number (Hubbard Ch 5): value of information is computed over these only. */
  ranges?: OwnerRanges;
}

/** Owner-stated low–high ranges (their 90% range, labelled judgement); the point value is the midpoint. */
export type OwnerRanges = Partial<Record<"revenue" | "margin" | "churn", { low: number; high: number }>>;

/** Numbers the owner confirmed (businesses.unitEconomics); they always beat the model's assumptions. */
export interface OwnerEconomics {
  revenuePerCustomerMonthUsd?: number;
  grossMargin?: number;
  monthlyChurn?: number;
  ownerHourUsd?: number;
  /** Hours a week the owner can give growth work (a constraint, not a price). */
  ownerHoursPerWeek?: number;
  /** Additional new customers (clients, bookings, projects) the owner can accept each month with current capacity. */
  newCustomersPerMonth?: number;
  /** When the owner last confirmed these numbers. */
  updatedAt?: number;
  ranges?: OwnerRanges;
}
export interface PlayLike {
  name: string;
  kind: string;
  unit: string;
  horizonDays: number;
  model: PlayModel;
}

export const OWNER_HOUR_USD = 50;

/** The owner's hour value: their number, else the $50 default scaled to the workspace currency. */
export function ownerHourOf(e: Pick<Economics, "ownerHourUsd" | "currency">): number {
  return e.ownerHourUsd && e.ownerHourUsd > 0 ? e.ownerHourUsd : thresholdIn(OWNER_HOUR_USD, e.currency);
}
/** Months a customer has to earn back their cost (owner's default payback horizon). */
export const PAYBACK_HORIZON_MONTHS = 12;
/** Stated share of customers two or more plays would both reach. */
export const PLAY_OVERLAP = 0.2;
const RUNS = 2000;

export interface PlayMaths {
  name: string;
  kind: string;
  /** Most-likely customers (every input at its most-likely value). */
  customers: number;
  /** Simulated range from the input ranges; equals `customers` when no ranges are given. */
  range: { p10: number; p50: number; p90: number };
  /**
   * What the plan headlines (REQ-MATH-06): customers at the most-likely rates, the same basis as
   * cost per customer, so anyone redoing the arithmetic from the inputs gets the same number.
   * The simulation gives its range, widened to include it.
   */
  headline: { p10: number; p50: number; p90: number };
  costUsd: number;
  cacUsd: number | null;
  /** P10–P90 cost per customer from the same input-range draws as `range`; null when that draw has no customers. */
  cacRange: { p10: number | null; p50: number | null; p90: number | null };
  /** Contribution one customer earns within the payback horizon (the allowable cost per customer); null when price, margin or churn is unknown. */
  valueUsd: number | null;
  /** Months to earn back the cost per customer, with churn; null if it never pays back. */
  paybackMonths: number | null;
  /** Most you can pay per right-fit person reached and still break even. */
  breakevenPerReachUsd: number | null;
  /** Pays back within the horizon; null when it can't be known (unknown economics or no customers). */
  profitable: boolean | null;
  /** A rate or margin outside 0–1 (rejected, never reinterpreted as a percent). */
  invalidInputs: string[];
  /** Counted only the extra customers over each step's baseline rate. */
  incremental: boolean;
  /**
   * Does the verdict survive the low end of its own range? robust: pays back even at P10;
   * fragile: pays back at the most-likely rates only; loses: doesn't at the most-likely rates;
   * unknown: economics unknown (Kochenderfer Ch 14 robustness).
   */
  robustness: "robust" | "fragile" | "loses" | "unknown";
  /** Customers needed in the horizon for cost per customer to equal value: the decision switch point. */
  breakevenCustomers: number | null;
  /** Share of the seeded draws where the play doesn't pay back (only when it has ranges and value is known); "if the ranges are right". */
  lossChance: number | null;
  /** One-input-at-a-time outcome ranges. `atLow`/`atHigh` refer to the input, not best/worst outcome. */
  sensitivity: PlaySensitivity[];
  /** Evidence quality of the inputs behind the money comparison, separate from scenario arithmetic. */
  financialEvidence: FinancialEvidence;
}

export interface PlaySensitivity {
  driver: string;
  metric: "customers" | "net_contribution_12m";
  atLow: number;
  atMode: number;
  atHigh: number;
}

export interface ForecastUncertainty {
  rangeMethod: "input_scenario" | "single_scenario";
  variedDrivers: string[];
  /** No statistical interval is estimated by the seeded range simulation. */
  statisticalInterval: "not_estimated";
  calibratedToBusiness: false;
  timing: { reachRamp: "modeled" | "immediate_assumed"; paidConversionLag: "modeled" | "none_assumed" };
  omittedFactors: ["seasonality", "execution_variation", "model_error"];
}

/** A share in 0–1, or NaN. Ratios above 1 are rejected, never silently read as percents (REQ-MATH-03). */
const rateOf = (r: number | undefined | null): number => (typeof r === "number" && Number.isFinite(r) && r >= 0 && r <= 1 ? r : NaN);
const DAYS_PER_MONTH = 365.25 / 12;

/** Explain what the seeded P10–P90 does and does not represent. */
export function forecastUncertainty(m: PlayModel): ForecastUncertainty {
  const variedDrivers: string[] = [];
  const reachLow = m.weeklyReachLow ?? m.weeklyReach;
  const reachHigh = m.weeklyReachHigh ?? m.weeklyReach;
  if (reachLow !== m.weeklyReach || reachHigh !== m.weeklyReach) variedDrivers.push("weekly reach");
  for (const step of m.steps) {
    if ((step.low ?? step.rate) !== step.rate || (step.high ?? step.rate) !== step.rate) variedDrivers.push(`${step.name} rate`);
  }
  return {
    rangeMethod: variedDrivers.length ? "input_scenario" : "single_scenario",
    variedDrivers,
    statisticalInterval: "not_estimated",
    calibratedToBusiness: false,
    timing: { reachRamp: m.rampWeeks ? "modeled" : "immediate_assumed", paidConversionLag: m.salesLagDays ? "modeled" : "none_assumed" },
    omittedFactors: ["seasonality", "execution_variation", "model_error"],
  };
}

/** Equivalent full-volume weeks that can produce paid customers before the horizon closes. */
export function effectiveCustomerWeeks(m: Pick<PlayModel, "rampWeeks" | "salesLagDays">, horizonWeeks: number): number {
  const weeks = Math.max(0, horizonWeeks);
  const lag = Math.max(0, m.salesLagDays ?? 0) / 7;
  const eligibleWeeks = Math.max(0, weeks - lag);
  const ramp = Math.max(0, m.rampWeeks ?? 0);
  if (eligibleWeeks === 0) return 0;
  if (ramp === 0) return eligibleWeeks;
  // Integrate a linear reach ramp from zero to steady weekly volume.
  return eligibleWeeks <= ramp
    ? (eligibleWeeks * eligibleWeeks) / (2 * ramp)
    : ramp / 2 + eligibleWeeks - ramp;
}

/** Monthly churn: a known value (zero included), else from months retained, else unknown (null), never zero by default (REQ-MATH-02). */
export function churnOf(e: Economics): number | null {
  if (typeof e.monthlyChurn === "number") return Number.isNaN(rateOf(e.monthlyChurn)) ? null : e.monthlyChurn;
  return churnFromLifetime(e.monthsRetained ?? null);
}

/** Contribution per customer per month; null when price or margin is unknown or invalid. */
export function monthlyContribution(e: Economics): number | null {
  const margin = rateOf(e.grossMargin);
  if (!(e.revenuePerCustomerMonthUsd >= 0) || Number.isNaN(margin)) return null;
  return contributionMonth(e.revenuePerCustomerMonthUsd, margin);
}

/** Contribution one customer earns within the payback horizon; null when any input is unknown. */
export function customerValue(e: Economics): number | null {
  return allowableCac(monthlyContribution(e), churnOf(e), PAYBACK_HORIZON_MONTHS);
}

function seedOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Triangular(low, mode, high) from one uniform draw. */
function tri(u: number, low: number, mode: number, high: number): number {
  if (!(high > low)) return mode;
  const m = Math.min(Math.max(mode, low), high);
  const f = (m - low) / (high - low);
  return u < f ? low + Math.sqrt(u * (high - low) * (m - low)) : high - Math.sqrt((1 - u) * (high - low) * (high - m));
}

function quantile(sorted: number[], q: number): number {
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  return sorted[lo] + (sorted[Math.min(lo + 1, sorted.length - 1)] - sorted[lo]) * (i - lo);
}

/** Customers over the horizon: P10/P50/P90 from triangular input ranges (seeded, reproducible). */
export function simulateCustomers(m: PlayModel, weeks: number, seed: string): { p10: number; p50: number; p90: number } {
  const xs = simulateSamples(m, weeks, seed);
  if (typeof xs === "number") return { p10: xs, p50: xs, p90: xs };
  return { p10: quantile(xs, 0.1), p50: quantile(xs, 0.5), p90: quantile(xs, 0.9) };
}

/** The baseline customers a play's reach would bring without it (0 when no step gives a baseline). */
function baselineCustomers(m: PlayModel, weeks: number): number {
  if (!m.steps.some((s) => s.baselineRate !== undefined)) return 0;
  const rates = m.steps.map((s) => rateOf(s.baselineRate ?? s.rate));
  return rates.some(Number.isNaN) ? 0 : (funnelCustomers(Math.max(0, m.weeklyReach), rates) ?? 0) * effectiveCustomerWeeks(m, weeks);
}

/** Most-likely customers only (no draws). */
function customersPoint(m: PlayModel, weeks: number): number {
  if (m.steps.some((s) => Number.isNaN(rateOf(s.rate)))) return 0;
  return Math.max(0, (funnelCustomers(Math.max(0, m.weeklyReach), m.steps.map((s) => s.rate)) ?? 0) * effectiveCustomerWeeks(m, weeks) - baselineCustomers(m, weeks));
}

/** Local, one-variable-at-a-time sensitivity; never presents a joint forecast. */
function playSensitivity(p: PlayLike, e: Economics, weeks: number, cost: number): PlaySensitivity[] {
  const valueKnown = customerValue(e) !== null;
  const metric: PlaySensitivity["metric"] = valueKnown ? "net_contribution_12m" : "customers";
  const outcome = (model: PlayModel, economics: Economics) => {
    const customers = customersPoint(model, weeks);
    if (metric === "customers") return customers;
    return customers * (customerValue(economics) ?? 0) - cost;
  };
  const baseModel = p.model;
  const baseOutcome = outcome(baseModel, e);
  const results: PlaySensitivity[] = [];
  const add = (driver: string, lowModel = baseModel, highModel = baseModel, lowEconomics = e, highEconomics = e) => {
    const atLow = outcome(lowModel, lowEconomics);
    const atHigh = outcome(highModel, highEconomics);
    if (atLow !== baseOutcome || atHigh !== baseOutcome) results.push({ driver, metric, atLow, atMode: baseOutcome, atHigh });
  };

  if (baseModel.weeklyReachLow !== undefined || baseModel.weeklyReachHigh !== undefined) {
    add("Weekly reach", { ...baseModel, weeklyReach: baseModel.weeklyReachLow ?? baseModel.weeklyReach }, { ...baseModel, weeklyReach: baseModel.weeklyReachHigh ?? baseModel.weeklyReach });
  }
  baseModel.steps.forEach((step, index) => {
    if (step.low === undefined && step.high === undefined) return;
    const withRate = (rate: number) => ({ ...baseModel, steps: baseModel.steps.map((s, i) => i === index ? { ...s, rate } : s) });
    add(`${step.name} rate`, withRate(step.low ?? step.rate), withRate(step.high ?? step.rate));
  });
  if (valueKnown) {
    const ranges = e.ranges;
    if (ranges?.revenue) add("Revenue per customer/month", baseModel, baseModel, { ...e, revenuePerCustomerMonthUsd: ranges.revenue.low }, { ...e, revenuePerCustomerMonthUsd: ranges.revenue.high });
    if (ranges?.margin) add("Gross margin", baseModel, baseModel, { ...e, grossMargin: ranges.margin.low }, { ...e, grossMargin: ranges.margin.high });
    if (ranges?.churn && e.monthlyChurn !== undefined) add("Monthly churn", baseModel, baseModel, { ...e, monthlyChurn: ranges.churn.low }, { ...e, monthlyChurn: ranges.churn.high });
  }
  return results
    .sort((a, b) => Math.max(Math.abs(b.atLow - b.atMode), Math.abs(b.atHigh - b.atMode)) - Math.max(Math.abs(a.atLow - a.atMode), Math.abs(a.atHigh - a.atMode)))
    .slice(0, 6);
}

/** Seeded draws of a play's customers (sorted), or the point value when it has no ranges. Extra customers only when baselines are given. */
export function simulateSamples(m: PlayModel, weeks: number, seed: string): number[] | number {
  const reach = Math.max(0, m.weeklyReach);
  const customerWeeks = effectiveCustomerWeeks(m, weeks);
  // Invalid rates give no forecast (lint reports them); nothing is reinterpreted.
  if (m.steps.some((s) => Number.isNaN(rateOf(s.rate)))) return 0;
  const base = baselineCustomers(m, weeks);
  const point = Math.max(0, (funnelCustomers(reach, m.steps.map((s) => s.rate)) ?? 0) * customerWeeks - base);
  const ranged = m.weeklyReachLow !== undefined || m.steps.some((s) => s.low !== undefined || s.high !== undefined);
  if (!ranged) return point;
  const rng = createRng(seedOf(seed));
  const rL = Math.max(0, Math.min(m.weeklyReachLow ?? reach, reach));
  const rH = Math.max(reach, m.weeklyReachHigh ?? reach);
  const out: number[] = [];
  // Baseline people per reached person (Π baseline rates): scales with each draw's reach.
  const basePer = reach > 0 && customerWeeks > 0 ? base / (reach * customerWeeks) : 0;
  for (let i = 0; i < RUNS; i++) {
    const people = tri(rng.next(), rL, reach, rH) * customerWeeks;
    let c = people;
    for (const s of m.steps) {
      const mode = s.rate;
      const low = Number.isNaN(rateOf(s.low)) ? mode : (s.low as number);
      const high = Number.isNaN(rateOf(s.high)) ? mode : (s.high as number);
      c *= tri(rng.next(), Math.min(low, mode), mode, Math.max(high, mode));
    }
    // Extra customers only: the same people would have converted at the baseline rates without the play.
    out.push(Math.max(0, c - people * basePer));
  }
  out.sort((a, b) => a - b);
  return out;
}

/** `pointOnly` skips the simulation (range = the point): for searches that only need the most-likely arithmetic (voi.ts). */
export function playMaths(p: PlayLike, e: Economics, opts: { pointOnly?: boolean } = {}): PlayMaths {
  if (!p.model?.steps) p = { ...p, model: { weeklyReach: 0, steps: [], monthlySpendUsd: 0, ownerHoursPerWeek: 0 } };
  // The actual horizon: 3 days is 3/7 of a week of reach, not a full week (REQ-MATH-04).
  const days = p.horizonDays > 0 ? p.horizonDays : 90;
  const weeks = days / 7;
  const invalidInputs = [...p.model.steps.filter((s) => Number.isNaN(rateOf(s.rate))).map((s) => s.name), ...(Number.isNaN(rateOf(e.grossMargin)) ? ["margin"] : [])];
  const rates = p.model.steps.map((s) => rateOf(s.rate));
  const incremental = p.model.steps.some((s) => s.baselineRate !== undefined);
  const customerWeeks = effectiveCustomerWeeks(p.model, weeks);
  const customers = invalidInputs.some((n) => n !== "margin") ? 0 : Math.max(0, (funnelCustomers(Math.max(0, p.model.weeklyReach), rates) ?? 0) * customerWeeks - baselineCustomers(p.model, weeks));
  const draws = opts.pointOnly ? customersPoint(p.model, weeks) : simulateSamples(p.model, weeks, `${p.name}|${p.kind}`);
  const range = typeof draws === "number" ? { p10: draws, p50: draws, p90: draws } : { p10: quantile(draws, 0.1), p50: quantile(draws, 0.5), p90: quantile(draws, 0.9) };
  const spend = Math.max(0, p.model.monthlySpendUsd) * (days / DAYS_PER_MONTH);
  const hours = Math.max(0, p.model.ownerHoursPerWeek) * weeks;
  const hourUsd = ownerHourOf(e);
  // Fully loaded: media, owner time and other costs over the same period (Skok; blog research BRP-17).
  const other = Math.max(0, p.model.otherMonthlyUsd ?? 0) * (days / DAYS_PER_MONTH);
  const costUsd = spend + hours * hourUsd + other;
  const cacUsd = cacFull(spend, hours, hourUsd, other, customers);
  const cacAt = (count: number) => (count > 0 ? costUsd / count : null);
  const cacRange = {
    // CAC moves inversely to customer count: the low CAC bound uses the high-customer draw.
    p10: cacAt(range.p90),
    p50: cacAt(range.p50),
    p90: cacAt(range.p10),
  };
  const cm = monthlyContribution(e);
  const churn = churnOf(e);
  // Unknown churn stays unknown: no value, payback or verdict is invented from it.
  const valueUsd = contributionOver(cm, churn, PAYBACK_HORIZON_MONTHS);
  const headline = { p10: Math.min(range.p10, customers), p50: customers, p90: Math.max(range.p90, customers) };
  const profitable = cacUsd === null || valueUsd === null ? null : cacUsd <= valueUsd;
  const atLow = valueUsd === null ? null : headline.p10 > 0 ? costUsd / headline.p10 <= valueUsd : costUsd === 0;
  const robustness: PlayMaths["robustness"] = profitable === null ? "unknown" : !profitable ? "loses" : atLow ? "robust" : "fragile";
  return {
    name: p.name,
    kind: p.kind,
    customers,
    range,
    headline,
    costUsd,
    cacUsd,
    cacRange,
    valueUsd,
    paybackMonths: cacUsd === null ? null : paybackWithChurn(cacUsd, cm, churn),
    breakevenPerReachUsd: breakevenPerReach(valueUsd, rates),
    profitable,
    invalidInputs,
    incremental,
    robustness,
    breakevenCustomers: valueUsd !== null && valueUsd > 0 ? costUsd / valueUsd : null,
    lossChance: valueUsd === null || typeof draws === "number" ? null : Math.round((draws.filter((c) => c * valueUsd < costUsd).length / draws.length) * 1000) / 1000,
    sensitivity: playSensitivity(p, e, weeks, costUsd),
    financialEvidence: financialEvidence(p, e),
  };
}

/** Rounded for display: whole numbers from 10 up, one decimal below. */
export function roundCount(n: number): number {
  return n >= 10 ? Math.round(n) : Math.round(n * 10) / 10;
}

/** Adds the computed forecast (P10/P50/P90 customers) to each play; the model never writes it. */
export function withForecasts<O extends { economics: Economics; plays: PlayLike[] }>(out: O): Omit<O, "plays"> & { plays: (O["plays"][number] & { p10: number; p50: number; p90: number; sensitivity: PlaySensitivity[]; cacRange: PlayMaths["cacRange"] | null; forecastUncertainty: ForecastUncertainty | null; financialEvidence: FinancialEvidence | null })[] } {
  return {
    ...out,
    plays: out.plays.map((p) => {
      // Older plays without a model keep the forecast they were saved with.
      if (!p.model?.steps?.length) return { ...p, sensitivity: [], cacRange: null, forecastUncertainty: null, financialEvidence: null } as unknown as O["plays"][number] & { p10: number; p50: number; p90: number; sensitivity: PlaySensitivity[]; cacRange: PlayMaths["cacRange"] | null; forecastUncertainty: ForecastUncertainty | null; financialEvidence: FinancialEvidence | null };
      const m = playMaths(p, out.economics);
      return { ...p, p10: roundCount(m.headline.p10), p50: roundCount(m.headline.p50), p90: roundCount(m.headline.p90), sensitivity: m.sensitivity, cacRange: m.cacRange, forecastUncertainty: forecastUncertainty(p.model), financialEvidence: m.financialEvidence };
    }),
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export function lintEconomics(out: { economics: Economics; plays: PlayLike[] }): LintIssue[] {
  const issues: LintIssue[] = [];
  const e = out.economics;
  const usd = (n: number | null) => formatMoney(n, e.currency);
  if (!(e.revenuePerCustomerMonthUsd > 0) || churnOf(e) === null) issues.push({ severity: "error", rule: "economics", message: "Give what one customer is worth: revenue per month, contribution margin and monthly churn (facts first, else tagged as assumptions).", path: "economics" });
  if (!(e.grossMargin > 0 && e.grossMargin <= 1)) issues.push({ severity: "error", rule: "economics", message: "grossMargin is a share between 0 and 1 (e.g. 0.8).", path: "economics.grossMargin" });
  out.plays.forEach((p, i) => {
    const path = `plays[${i}]`;
    if (!p.model?.steps?.length || !(p.model.weeklyReach > 0)) {
      issues.push({ severity: "error", rule: "economics", message: "Give the play's model: weekly reach and each funnel step's most-likely rate.", path: `${path}.model` });
      return;
    }
    if (p.model.steps.some((s) => !(s.rate > 0) || s.rate > 1)) issues.push({ severity: "error", rule: "economics", message: "Step rates are shares between 0 and 1 (e.g. 0.03 for 3%).", path: `${path}.model.steps` });
    if (p.model.steps.some((s) => s.low !== undefined && s.high !== undefined && !(s.low <= s.rate && s.rate <= s.high))) issues.push({ severity: "error", rule: "economics", message: "Each step needs low ≤ rate ≤ high.", path: `${path}.model.steps` });
    if (p.model.weeklyReachLow !== undefined && p.model.weeklyReachHigh !== undefined && !(p.model.weeklyReachLow <= p.model.weeklyReach && p.model.weeklyReach <= p.model.weeklyReachHigh)) issues.push({ severity: "error", rule: "economics", message: "Weekly reach needs low ≤ reach ≤ high.", path: `${path}.model` });
    // A play that changes an existing step must say today's rate there, or it counts customers who'd have come anyway (decision books).
    if (SAME_STEP.has(stageOfPlay(p)) && !p.model.steps.some((s) => s.baselineRate !== undefined))
      issues.push({ severity: "warn", rule: "economics", message: `"${p.name}" changes an existing step but gives no baselineRate, so its forecast counts every customer through that step, including those who'd have come anyway. Give today's rate at the step it changes.`, path: `${path}.model.steps` });
    if (p.model.steps.some((s) => s.baselineRate !== undefined && !(s.baselineRate >= 0 && s.baselineRate <= 1))) issues.push({ severity: "error", rule: "economics", message: "baselineRate is a share between 0 and 1.", path: `${path}.model.steps` });
    const m = playMaths(p, e);
    if (m.profitable === false && p.kind !== "moonshot") {
      const conditional = m.financialEvidence.status !== "checked_inputs";
      const basis = conditional ? ` This is conditional on the current inputs (${m.financialEvidence.status.replaceAll("_", " ")}; assumed: ${m.financialEvidence.assumed.join(", ") || "none"}; unchecked: ${m.financialEvidence.unchecked.join(", ") || "none"}; planned: ${m.financialEvidence.planned.join(", ") || "none"}).` : "";
      issues.push({ severity: conditional ? "warn" : "error", rule: "economics", message: `${conditional ? "Does not pay back under the current scenario" : "Loses money"}: cost per customer ${usd(m.cacUsd)} (spend + owner time at ${usd(ownerHourOf(e))}/h) vs ${usd(m.valueUsd)} a customer earns in ${PAYBACK_HORIZON_MONTHS} months.${basis} Don't raise reach or rates to make it pass. Verify an input (owner number or a cited page), cut spend or hours, target higher-value customers, make it a capped test with a stop rule, or drop it.`, path });
    }
  });
  return issues;
}

/** Stages where plays change the same existing step: their customers don't add (the same people move once). */
const SAME_STEP = new Set(["activation", "conversion", "retention", "offer"]);
const stageOfPlay = (p: PlayLike) => playStage(`${p.name} ${p.unit ?? ""} ${(p as { oneLiner?: string }).oneLiner ?? ""} ${(p as { mechanic?: string }).mechanic ?? ""}`);

/**
 * Combine per-play customers into a portfolio total: plays changing the same
 * existing step count as the largest of them (their effects aren't additive
 * without evidence; Hernán & Robins Ch 5 interaction, Kochenderfer Ch 27);
 * then the largest group counts in full and the rest lose the stated overlap.
 */
export function combinePlays(values: number[], stages: string[]): number {
  const groups = new Map<string, number>();
  const free: number[] = [];
  values.forEach((v, i) => {
    if (SAME_STEP.has(stages[i])) groups.set(stages[i], Math.max(groups.get(stages[i]) ?? 0, v));
    else free.push(v);
  });
  return portfolioCustomers([...free, ...groups.values()], PLAY_OVERLAP) ?? 0;
}

/** Each play's seeded draws, shuffled with its own seed so plays pair at random (independent); null when no play has ranges. */
function pairedDraws(ps: PlayLike[]): number[][] | null {
  const draws = ps.map((p) => simulateSamples(p.model, (p.horizonDays > 0 ? p.horizonDays : 90) / 7, `${p.name}|${p.kind}`));
  if (draws.every((d) => typeof d === "number")) return null;
  return draws.map((d, j) => {
    if (typeof d === "number") return new Array<number>(RUNS).fill(d);
    const rng = createRng(seedOf(`pair|${ps[j].name}|${j}`));
    const a = d.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const k = Math.floor(rng.next() * (i + 1));
      [a[i], a[k]] = [a[k], a[i]];
    }
    return a;
  });
}

/**
 * The portfolio's new customers over one shared horizon (each play re-run at that horizon, so periods aren't mixed).
 * P50 combines the most-likely counts (the same basis as cost per customer). P10/P90 come from joint seeded draws,
 * assuming plays vary independently, rather than adding every play's P10 (or P90) as if all fail (or win) together.
 */
export function portfolioRange(out: { economics: Economics; plays: PlayLike[] }, horizonDays?: number): { p10: number; p50: number; p90: number } {
  const ps = out.plays.filter((p) => p.model?.steps?.length).map((p) => (horizonDays ? { ...p, horizonDays } : p));
  if (!ps.length) return { p10: 0, p50: 0, p90: 0 };
  const stages = ps.map(stageOfPlay);
  const heads = ps.map((p) => playMaths(p, out.economics).headline);
  const p50 = combinePlays(heads.map((h) => h.p50), stages);
  const cols = pairedDraws(ps);
  if (!cols) return { p10: Math.min(p50, combinePlays(heads.map((h) => h.p10), stages)), p50, p90: Math.max(p50, combinePlays(heads.map((h) => h.p90), stages)) };
  const totals = Array.from({ length: RUNS }, (_, i) => combinePlays(cols.map((c) => c[i]), stages)).sort((a, b) => a - b);
  return { p10: Math.min(p50, quantile(totals, 0.1)), p50, p90: Math.max(p50, quantile(totals, 0.9)) };
}

/** Mean combined customers over the same seeded joint draws used for portfolio ranking. */
export function portfolioExpectedCustomers(out: { economics: Economics; plays: PlayLike[] }, horizonDays?: number): number {
  const ps = out.plays.filter((p) => p.model?.steps?.length).map((p) => (horizonDays ? { ...p, horizonDays } : p));
  if (!ps.length) return 0;
  const stages = ps.map(stageOfPlay);
  const cols = pairedDraws(ps);
  if (!cols) return combinePlays(ps.map((p) => playMaths(p, out.economics).headline.p50), stages);
  return expectedCombinedDraws(cols, ps.map((_, i) => i), stages);
}

const MEAN_STRIDE = 4;

function expectedCombinedDraws(cols: number[][], indexes: number[], stages: string[]): number {
  let total = 0;
  let samples = 0;
  for (let draw = 0; draw < RUNS; draw += MEAN_STRIDE) {
    total += combinePlays(indexes.map((i) => cols[i][draw]), indexes.map((i) => stages[i]));
    samples++;
  }
  return samples ? total / samples : 0;
}

export interface PortfolioChoice {
  /** Play names in the best feasible set. */
  selected: string[];
  customers: number;
  spendUsdMonth: number;
  ownerHoursWeek: number;
  /** Mean customers over the joint draws (ranking basis); `customers` is the most-likely total shown in the plan. */
  expectedCustomers: number;
  /** Expected contribution in the horizon minus cost (null when what a customer is worth is unknown; then expected customers decide). */
  netUsd: number | null;
  /** Every drafted play fits together. */
  allFit: boolean;
  /** Plays left out and why (over budget, over hours, over capacity, loses money). */
  left: { name: string; why: string }[];
  /** The best feasible alternative that differs from the selected set, for the owner-facing trade-off. */
  runnerUp: { selected: string[]; customers: number; netUsd: number | null } | null;
  basis: string;
}

/**
 * The best feasible set of drafted plays under the owner's joint limits (Kochenderfer App. C/E:
 * small sets are enumerated exactly; no solver needed up to 10 plays). Plays that lose money at
 * their most-likely rates never enter, at any budget. A bigger budget only adds feasible sets,
 * so a set that fit before still fits.
 */
export function selectPortfolio(out: { economics: Economics; plays: PlayLike[] }, limits: { monthlyBudgetUsd?: number; ownerHoursPerWeek?: number; newCustomersPerMonth?: number; horizonDays?: number }): PortfolioChoice | null {
  const h = limits.horizonDays || 90;
  const ps = out.plays.filter((p) => p.model?.steps?.length).slice(0, 10);
  if (!ps.length) return null;
  const ms = ps.map((p) => playMaths({ ...p, horizonDays: h }, out.economics));
  const stages = ps.map(stageOfPlay);
  const value = customerValue(out.economics);
  const capLimit = limits.newCustomersPerMonth !== undefined ? limits.newCustomersPerMonth * (h / 30) : undefined;
  const losers = new Set(ms.flatMap((m, i) => (m.profitable === false && ps[i].kind !== "moonshot" ? [i] : [])));
  // Sets are ranked on expected (mean) customers over the joint draws, not the most-likely point: skewed ranges matter (Kochenderfer Ex 4.1, 6.5–6.7).
  const hp = ps.map((p) => ({ ...p, horizonDays: h }));
  const cols = pairedDraws(hp);
  const expected = (idx: number[]) => {
    if (!cols) return combinePlays(idx.map((i) => ms[i].headline.p50), idx.map((i) => stages[i]));
    return expectedCombinedDraws(cols, idx, stages);
  };
  type Opt = { idx: number[]; customers: number; expectedCustomers: number; spend: number; hours: number; net: number | null; cost: number };
  const opts: Opt[] = [];
  for (let mask = 1; mask < 1 << ps.length; mask++) {
    const idx = ps.map((_, i) => i).filter((i) => mask & (1 << i));
    if (idx.some((i) => losers.has(i))) continue;
    const spend = idx.reduce((s, i) => s + Math.max(0, ps[i].model.monthlySpendUsd), 0);
    const hours = idx.reduce((s, i) => s + Math.max(0, ps[i].model.ownerHoursPerWeek), 0);
    const customers = combinePlays(idx.map((i) => ms[i].headline.p50), idx.map((i) => stages[i]));
    const cost = idx.reduce((s, i) => s + ms[i].costUsd, 0);
    if (limits.monthlyBudgetUsd !== undefined && spend > limits.monthlyBudgetUsd * 1.001) continue;
    if (limits.ownerHoursPerWeek !== undefined && hours > limits.ownerHoursPerWeek + 0.01) continue;
    if (capLimit !== undefined && customers > capLimit * 1.001) continue;
    const expectedCustomers = expected(idx);
    opts.push({ idx, customers, expectedCustomers, spend, hours, cost, net: value === null ? null : expectedCustomers * value - cost });
  }
  const score = (o: Opt) => (o.net ?? o.expectedCustomers);
  opts.sort((a, b) => score(b) - score(a) || a.cost - b.cost || a.idx.length - b.idx.length);
  // Doing nothing new is always an option: a set whose expected contribution is below its cost loses to it (Hubbard Ch 14; Kochenderfer Ch 6).
  const best = opts[0] && (opts[0].net === null || opts[0].net >= 0) ? opts[0] : undefined;
  const leftWhy = (i: number) => (losers.has(i) ? ms[i].financialEvidence.status === "checked_inputs" ? "loses money at its most-likely rates" : "does not pay back under its current scenario inputs" : "doesn't fit with the others under the budget, hours or capacity");
  const all = ps.map((_, i) => i);
  if (!best)
    return {
      selected: [],
      customers: 0,
      spendUsdMonth: 0,
      expectedCustomers: 0,
      ownerHoursWeek: 0,
      netUsd: null,
      allFit: false,
      left: all.map((i) => ({ name: ps[i].name, why: opts.length ? "every set's expected contribution is below its cost" : leftWhy(i) })),
      runnerUp: opts[0] ? { selected: opts[0].idx.map((i) => ps[i].name), customers: opts[0].customers, netUsd: opts[0].net } : null,
      basis: opts.length ? `Doing nothing new beats every set at expected values under the current inputs: run only capped tests that measure the deciding input first. ${portfolioEvidenceNote(ps, out.economics)}` : "No play fits the limits on its own.",
    };
  const key = (o: Opt) => o.idx.join(",");
  // The strongest alternative must beat the choice on something (more customers, less cash or fewer hours); a set worse on every count isn't a trade-off (Kochenderfer Ex 14.5).
  const runner = opts.find((o) => key(o) !== key(best) && (o.expectedCustomers > best.expectedCustomers + 1e-9 || o.spend < best.spend - 1e-9 || o.hours < best.hours - 1e-9)) ?? null;
  return {
    selected: best.idx.map((i) => ps[i].name),
    customers: best.customers,
    spendUsdMonth: best.spend,
    ownerHoursWeek: best.hours,
    netUsd: best.net,
    allFit: best.idx.length === ps.length,
    left: all.filter((i) => !best.idx.includes(i)).map((i) => ({ name: ps[i].name, why: leftWhy(i) })),
    runnerUp: runner ? { selected: runner.idx.map((i) => ps[i].name), customers: runner.customers, netUsd: runner.net } : null,
    expectedCustomers: best.expectedCustomers,
    basis: `${value === null ? "Ranked by expected customers over the input ranges (what a customer is worth is unknown)." : "Ranked by expected contribution in the horizon minus cost, over the input ranges."} ${portfolioEvidenceNote(best.idx.map((i) => ps[i]), out.economics)}`,
  };
}

/** Every customer count the calculations produce: portfolio and each play's P10/P50/P90, at the goal's horizon and each play's own. */
export function forecastCustomers(out: { economics: Economics; plays: PlayLike[] }, horizonDays?: number): number[] {
  const nums: number[] = [];
  const add = (r: { p10: number; p50: number; p90: number } | null | undefined) => r && nums.push(r.p10, r.p50, r.p90);
  add(portfolioRange(out, horizonDays));
  for (const p of out.plays.filter((x) => x.model?.steps?.length)) {
    add(playMaths(p, out.economics).headline);
    if (horizonDays) add(playMaths({ ...p, horizonDays }, out.economics).headline);
  }
  return [...new Set(nums.filter((n) => Number.isFinite(n) && n > 0).flatMap((n) => [Math.round(n), roundCount(n)]))];
}

export function portfolioP50(out: { economics: Economics; plays: PlayLike[] }, horizonDays?: number): number {
  return portfolioRange(out, horizonDays).p50;
}

/** The goal gap for a plays output (null-safe: unknown target or economics give an unknown gap). */
export function playsGoalGap(out: { economics: Economics; plays: PlayLike[] }, goal: { target?: GoalTarget | null; horizonDays?: number } | null | undefined): GoalGap {
  const h = goal?.horizonDays || 90;
  const rev = out.economics.revenuePerCustomerMonthUsd;
  return goalGap(goal?.target, h, out.plays.some((p) => p.model?.steps?.length) ? portfolioRange(out, h) : null, { churn: churnOf(out.economics), revenuePerCustomerMonth: rev >= 0 ? rev : null });
}

/** The numbers the plan must use, computed here so it can't contradict them. */
export function lockedNumbers(out: { economics: Economics; plays: PlayLike[] }, goal?: { statement?: string; target?: GoalTarget | null; horizonDays?: number } | null, limits?: { monthlyBudgetUsd?: number; ownerHoursPerWeek?: number; newCustomersPerMonth?: number }): string {
  const rows = out.plays.map((p) => ({ p, m: playMaths(p, out.economics) }));
  // The total uses the goal's horizon for every play, so it never mixes periods.
  const own = [...new Set(out.plays.map((p) => p.horizonDays).filter((d) => d > 0))];
  const h = goal?.horizonDays || (own.length === 1 ? own[0] : 90);
  const atH = out.plays.map((p) => playMaths({ ...p, horizonDays: h }, out.economics));
  const { p50: total, p10: low, p90: high } = portfolioRange(out, h);
  const cost = atH.reduce((s, m) => s + m.costUsd, 0);
  const spend = out.plays.reduce((s, p) => s + Math.max(0, p.model?.monthlySpendUsd ?? 0), 0);
  const e = out.economics;
  const usd = (n: number | null) => formatMoney(n, e.currency);
  const churn = churnOf(e);
  // Two payback definitions give different months for the same play: name both (Skok's per-surviving-customer vs ClimbOS's churn-weighted; blog research BRP-17).
  const cmOf = monthlyContribution(e) ?? 0;
  return [
    "LOCKED NUMBERS (computed by ClimbOS from the plays; use exactly these, never restate them differently):",
    `- One customer: ${usd(monthlyContribution(e))}/month contribution, ${churn === null ? "churn unknown" : `${r1(churn * 100)}% monthly churn`}; earns ${usd(customerValue(e))} in ${PAYBACK_HORIZON_MONTHS} months = the most a customer may cost (${e.basis}; sources: ${sourcesLine(e)}).`,
      ...rows.map(({ p, m }) => `- ${m.name} (${m.kind}): ≈${roundCount(m.headline.p50)} customers in ${p.horizonDays || 90} days at the most-likely rates (simulated range ${roundCount(m.headline.p10)}–${roundCount(m.headline.p90)}), cost ${usd(m.costUsd)}, cost per customer ${usd(m.cacUsd)} (same basis; simulated CAC P10–P90 ${usd(m.cacRange.p10)}–${usd(m.cacRange.p90)}${m.cacRange.p90 === null ? ", unbounded when a draw has no customers" : ""}), payback ${m.paybackMonths === null ? "never within lifetime" : `${r1(m.paybackMonths)} months with churn`}${m.cacUsd !== null && cmOf > 0 ? ` (${r1(m.cacUsd / cmOf)} months per surviving customer)` : ""}${p.model.monthlySpendUsd > 0 && m.breakevenPerReachUsd !== null ? `, break-even ${usd(m.breakevenPerReachUsd)} per person reached` : ""}${m.breakevenCustomers !== null && m.costUsd > 0 ? `; needs ${roundCount(m.breakevenCustomers)} customers to break even (${ROBUST_WORD[m.robustness]})` : ""}${m.incremental ? "; extra customers over today's rate only" : ""}${p.model.rampWeeks ? `; reach ramps to full volume over ${p.model.rampWeeks} weeks` : ""}${p.model.salesLagDays ? `; allows ${p.model.salesLagDays} days for paid conversion` : ""}${m.lossChance !== null && m.costUsd > 0 ? `; ${Math.round(m.lossChance * 100)}% chance it doesn't pay back if its ranges are right` : ""}. ${basisNote(p, e)}${decidesLine(p, e, usd) ? `\n${decidesLine(p, e, usd)}` : ""}`),
    ...rows.flatMap(({ m }) => m.sensitivity.slice(0, 3).map((s) => `- SENSITIVITY · ${m.name} · ${s.driver} (one input at a time, not a joint forecast): ${s.metric === "net_contribution_12m" ? "12-month net contribution" : "customers"} is ${s.metric === "net_contribution_12m" ? usd(s.atLow) : roundCount(s.atLow)} at low, ${s.metric === "net_contribution_12m" ? usd(s.atMode) : roundCount(s.atMode)} at most-likely, ${s.metric === "net_contribution_12m" ? usd(s.atHigh) : roundCount(s.atHigh)} at high.`)),
    "- None of these forecasts is calibrated to this business's own results yet. Call assumption-based ones scenarios, never predictions.",
    "- Timing assumptions: specified ramp and sales lag are applied to customer forecasts; costs still cover the full planned period. Missing ramp or lag means immediate full volume or immediate paid conversion.",
    `- TOTAL: ≈${roundCount(total)} new customers in ${h} days (range ${roundCount(low)}–${roundCount(high)}, plays assumed to vary independently; ${PLAY_OVERLAP * 100}% overlap between plays; plays on the same step count once) for ${usd(cost)} (cash spend ${usd(spend)}/month); blended cost per customer ${usd(total > 0 ? cost / total : null)}.`,
    ...portfolioLine(out, { ...(limits ?? {}), horizonDays: h }, usd),
    `- North Star target = ≈${Math.round(total)} new customers by day ${h}: what these plays support (a scenario), not the owner's goal.`,
    ...(goal ? goalLines(goal.statement, playsGoalGap(out, goal)) : []),
  ].join("\n");
}

const ROBUST_WORD: Record<PlayMaths["robustness"], string> = { robust: "pays back even at the low end", fragile: "pays back only at the most-likely rates", loses: "doesn't pay back at the most-likely rates", unknown: "payback unknown" };

/** The feasible-set check as one locked line: what fits together, and the strongest alternative. */
function portfolioLine(out: { economics: Economics; plays: PlayLike[] }, limits: Parameters<typeof selectPortfolio>[1], usd: (n: number | null) => string): string[] {
  const c = selectPortfolio(out, limits);
  if (!c || (c.allFit && !c.left.length)) return [];
  const alt = c.runnerUp ? ` Strongest alternative: ${c.runnerUp.selected.join(" + ")} (≈${roundCount(c.runnerUp.customers)} customers${c.runnerUp.netUsd !== null ? `, net ${usd(c.runnerUp.netUsd)}` : ""}).` : "";
  return [`- PORTFOLIO CHECK (computed): the best set that fits the limits is ${c.selected.join(" + ") || "none"} (≈${roundCount(c.customers)} customers, ${usd(c.spendUsdMonth)}/month, ${Math.round(c.ownerHoursWeek * 10) / 10} h/week${c.netUsd !== null ? `, net ${usd(c.netUsd)}` : ""}). Left out: ${c.left.map((l) => `${l.name} (${l.why})`).join("; ")}.${alt} ${c.basis}`];
}

/** "revenue: research (formkit.app/pricing), margin: assumption, …" for the locked numbers. */
function sourcesLine(e: Economics): string {
  const s = economicsSources(e);
  return (["revenue", "margin", "churn"] as const).map((k) => `${k} ${s[k].source === "unlabelled" ? "not labelled" : s[k].source}${s[k].ref ? ` (${s[k].ref})` : ""}`).join(", ");
}

/** How a play's forecast should be described in the plan. */
function basisNote(p: PlayLike, e: Economics): string {
  const b = forecastBasis(p, e).customers;
  const unchecked = b.unchecked.length ? ` Unchecked sources: ${b.unchecked.join(", ")}.` : "";
  const f = financialEvidence(p, e);
  const finance = ` Financial comparison: ${f.status.replaceAll("_", " ")}; ${f.assumed.length ? `assumed ${f.assumed.join(", ")}` : "no assumed inputs"}${f.unchecked.length ? `; unchecked ${f.unchecked.join(", ")}` : ""}${f.planned.length ? `; planned ${f.planned.join(", ")}` : ""}.`;
  if (b.kind === "assumption_scenario") return `Forecast basis: assumption-based scenario (assumed: ${b.assumed.join(", ")}).${unchecked}${finance}`;
  if (b.kind === "sourced_estimate") return `Forecast basis: estimate from cited sources, not yet from this business's results.${unchecked}${finance}`;
  return `Forecast basis: scenario from the play's own inputs (sources not labelled).${finance}`;
}

function portfolioEvidenceNote(plays: PlayLike[], e: Economics): string {
  const statuses = plays.map((p) => financialEvidence(p, e).status);
  if (statuses.every((s) => s === "checked_inputs")) return "The selected comparison uses inputs checked by owner confirmation or source review; results still are not calibrated to observed outcomes.";
  if (statuses.includes("unlabelled_scenario")) return "At least one input is unlabeled, so this is a scenario comparison and not a firm money decision.";
  return "At least one input is assumed, planned, or unchecked, so this is a conditional scenario comparison and not a firm money decision.";
}

const KEY_OF = { revenuePerCustomerMonthUsd: "revenue", grossMargin: "margin", monthlyChurn: "churn" } as const;

/** A value the owner confirmed in their unit economics: the only stamped "owner" source. */
function ownerTag(owner: OwnerEconomics): SourceTag {
  return { source: "owner", ref: "Confirmed by you", check: "owner_input", checkedBy: CHECK_STAMP, ...(owner.updatedAt ? { confirmedAt: owner.updatedAt } : {}) };
}

/** The owner's confirmed numbers replace the model's; they stop being assumptions. */
export function applyOwnerEconomics(e: Economics, owner: OwnerEconomics | null | undefined): Economics {
  if (!owner) return e;
  const out: Economics = { ...e, assumed: [...(e.assumed ?? [])], sources: { ...(e.sources ?? {}) } };
  const confirmed: string[] = [];
  for (const k of ["revenuePerCustomerMonthUsd", "grossMargin", "monthlyChurn"] as const) {
    const v = owner[k];
    if (typeof v === "number" && (v > 0 || (k === "monthlyChurn" && v === 0))) {
      const prior = e.sources?.[KEY_OF[k]];
      const was = e[k];
      out[k] = v;
      out.assumed = out.assumed!.filter((a) => a !== KEY_OF[k]);
      out.sources![KEY_OF[k]] = { ...ownerTag(owner), ...(typeof was === "number" && was !== v ? { replaced: { value: was, source: prior?.source ?? "unlabelled" } } : {}) };
      confirmed.push(KEY_OF[k]);
    }
  }
  if (typeof owner.ownerHourUsd === "number" && owner.ownerHourUsd > 0) {
    out.ownerHourUsd = owner.ownerHourUsd;
    out.sources!.ownerHour = ownerTag(owner);
    confirmed.push("owner hour");
  }
  const rk = { revenuePerCustomerMonthUsd: "revenue", grossMargin: "margin", monthlyChurn: "churn" } as const;
  for (const [k, r] of Object.entries(rk)) if (owner.ranges?.[r] && confirmed.includes(r) && typeof owner[k as keyof typeof rk] === "number") out.ranges = { ...(out.ranges ?? {}), [r]: owner.ranges[r] };
  if (confirmed.length) out.basis = `Owner confirmed ${confirmed.join(", ")}.${e.basis ? ` ${e.basis}` : ""}`.slice(0, 400);
  return out;
}

export type QuestionKey = "revenuePerCustomerMonthUsd" | "grossMargin" | "monthlyChurn" | "ownerHourUsd" | "ownerHoursPerWeek" | "newCustomersPerMonth";
export interface OwnerQuestion {
  key: QuestionKey;
  question: string;
  /** The value the plan assumed, for the input's placeholder. */
  assumed: number;
  unit: "usd_month" | "share" | "share_month" | "usd_hour" | "hours_week" | "count_month";
  /** Why it matters: which plays' verdicts flip across a plausible range, with the value where they flip. */
  why: string;
  /** The value where the most sensitive play flips (Hubbard's threshold): the owner only needs to know which side they're on. */
  switchValue?: number;
  /** ge: plays pay back only at or above the switch value; le: at or below. */
  switchDirection?: "ge" | "le";
}

const QUESTION: Record<QuestionKey, { q: string; unit: OwnerQuestion["unit"] }> = {
  revenuePerCustomerMonthUsd: { q: "What does an average customer pay you per month?", unit: "usd_month" },
  grossMargin: { q: "What share of that do you keep after the costs to deliver and keep a customer?", unit: "share" },
  monthlyChurn: { q: "What share of customers leave each month?", unit: "share_month" },
  ownerHourUsd: { q: "What is an hour of your time worth?", unit: "usd_hour" },
  ownerHoursPerWeek: { q: "How many hours a week can you give growth work?", unit: "hours_week" },
  newCustomersPerMonth: { q: "With your current staffing, workload, inventory and support, how many additional new customers could you accept each month?", unit: "count_month" },
};

/**
 * Up to three questions whose answers would change the plan (spec §10): each assumed
 * input is moved across a plausible range; it is asked only if some play's
 * pays-back verdict flips or the main play's payback moves by half or more.
 */
export function decisionQuestions(out: { economics: Economics; plays: PlayLike[] }, owner?: OwnerEconomics | null, max = 3, opts: { serviceBusiness?: boolean; horizonDays?: number } = {}): OwnerQuestion[] {
  const e = applyOwnerEconomics(out.economics, owner);
  const plays = out.plays.filter((p) => p.model?.steps?.length);
  if (!plays.length) return [];
  const verdicts = (x: Economics) => plays.map((p) => playMaths(p, x));
  const base = verdicts(e);
  const main = Math.max(0, plays.findIndex((p) => p.kind === "bankable"));
  const assumed = new Set(e.assumed ?? ["revenue", "margin", "churn"]);
  const candidates: { key: QuestionKey; value: number; low: number; high: number }[] = [];
  if (assumed.has("revenue")) candidates.push({ key: "revenuePerCustomerMonthUsd", value: e.revenuePerCustomerMonthUsd, low: e.revenuePerCustomerMonthUsd * 0.5, high: e.revenuePerCustomerMonthUsd * 1.5 });
  if (assumed.has("margin")) candidates.push({ key: "grossMargin", value: e.grossMargin, low: Math.max(0.05, e.grossMargin * 0.6), high: Math.min(1, e.grossMargin * 1.25) });
  const churn = churnOf(e) ?? 0.05;
  if (assumed.has("churn")) candidates.push({ key: "monthlyChurn", value: churn, low: churn * 0.5, high: Math.min(0.9, churn * 2) });
  if (!(owner?.ownerHourUsd && owner.ownerHourUsd > 0) && plays.some((p) => p.model.ownerHoursPerWeek > 0)) candidates.push({ key: "ownerHourUsd", value: ownerHourOf(e), low: thresholdIn(20, e.currency), high: thresholdIn(150, e.currency) });
  // Switch values (Hubbard Ch 7): the value where each play flips; shown to the owner instead of a bare question.
  const switchOf = (key: QuestionKey) => {
    const k = key === "revenuePerCustomerMonthUsd" ? "revenue" : key === "grossMargin" ? "margin" : key === "monthlyChurn" ? "churn" : "ownerHour";
    const sps = plays.map((p) => switchPoints(p, e).find((s) => s.key === k)).filter((s): s is NonNullable<typeof s> => Boolean(s && s.switchValue !== null));
    return sps.sort((a, b) => (a.margin ?? Infinity) - (b.margin ?? Infinity))[0];
  };
  const scored = candidates.map((c) => {
    let flips = 0;
    let paybackSwing = 0;
    for (const v of [c.low, c.high]) {
      const alt = verdicts({ ...e, [c.key]: v, ...(c.key === "monthlyChurn" ? { monthsRetained: undefined } : {}) });
      flips += alt.filter((m, i) => m.profitable !== base[i].profitable && plays[i].kind !== "moonshot").length;
      const a = alt[main].paybackMonths;
      const b = base[main].paybackMonths;
      if (a === null || b === null) paybackSwing = Math.max(paybackSwing, a === b ? 0 : 1);
      else if (b > 0) paybackSwing = Math.max(paybackSwing, Math.abs(a - b) / b);
    }
    return { c, flips, paybackSwing };
  });
  // Feasibility: plays that need real owner time are only a plan if the owner has that time.
  const hours = plays.reduce((t, p) => t + Math.max(0, p.model.ownerHoursPerWeek), 0);
  const capacity: OwnerQuestion[] =
    owner?.ownerHoursPerWeek === undefined && hours > 3 ? [{ key: "ownerHoursPerWeek", question: QUESTION.ownerHoursPerWeek.q, assumed: Math.round(hours * 10) / 10, unit: "hours_week", why: `The plays need about ${Math.round(hours)} hours a week from you.` }] : [];
  // Delivery: a service business can only take so many new clients; ask when the plays forecast any.
  const months = (opts.horizonDays || 90) / DAYS_PER_MONTH;
  const perMonth = portfolioP50(out, opts.horizonDays || 90) / months;
  const delivery: OwnerQuestion[] =
    opts.serviceBusiness && owner?.newCustomersPerMonth === undefined && perMonth >= 1 ? [{ key: "newCustomersPerMonth", question: QUESTION.newCustomersPerMonth.q, assumed: Math.round(perMonth), unit: "count_month", why: `The plays forecast about ${Math.round(perMonth)} additional customers a month; compare that with what you can accept after current workload.` }] : [];
  return [
    ...delivery,
    ...capacity,
    ...scored
    .filter((x) => x.flips > 0 || x.paybackSwing >= 0.5)
    .sort((a, b) => b.flips - a.flips || b.paybackSwing - a.paybackSwing)
    .slice(0, max)
    .map(({ c, flips }) => {
      const sw = switchOf(c.key);
      const at = sw?.switchValue != null ? ` A play pays back only if it's ${sw.direction === "ge" ? "at least" : "at most"} ${c.key === "grossMargin" || c.key === "monthlyChurn" ? `${Math.round(sw.switchValue * 1000) / 10}%` : formatMoney(sw.switchValue, e.currency)}.` : "";
      return {
        key: c.key,
        question: QUESTION[c.key].q,
        assumed: Math.round(c.value * 1000) / 1000,
        unit: QUESTION[c.key].unit,
        why: `${flips > 0 ? `Decides whether ${flips === 1 ? "a play pays back" : `${flips} plays pay back`}.` : "Changes how fast your main play pays back."}${at}`,
        ...(sw?.switchValue != null ? { switchValue: Math.round(sw.switchValue * 10000) / 10000, switchDirection: sw.direction } : {}),
      };
    }),
  ].slice(0, max);
}
