import { formatMoney, fractionDigits, thresholdIn } from "../economics/currency";
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
  /** Owner-confirmed monthly cash available for growth work (media plus other cash costs; excludes owner time). */
  monthlyGrowthCashUsd?: number;
  /** Owner-reported aggregate segment economics in the business currency; not connected billing identity. */
  segmentEconomics?: {
    segment: string;
    currency: string;
    periodDays: number;
    customers: number;
    netRevenue: number;
    variableCosts: number;
    costBoundary: string;
    unknownCosts?: string[];
    strategicValueNote?: string;
  }[];
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
  /** Horizon-aligned view of cash spend and owner time that compose the fully loaded total. */
  costBreakdown: { cashMediaUsd: number; cashOtherUsd: number; ownerTimeUsd: number; fullyLoadedUsd: number };
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
  /** Explicitly separates play-attributed outcomes from the modeled counterfactual delta. */
  outcomeAccounting: {
    attributionBasis: "modeled_play_funnel";
    attributedCustomers: { p10: number; p50: number; p90: number };
    attributedRevenue12m: { p10: number; p50: number; p90: number } | null;
    incrementalityBasis: "modeled_baseline_delta" | "not_estimated";
    modeledIncrementalCustomers: { p10: number; p50: number; p90: number } | null;
    modeledIncrementalRevenue12m: { p10: number; p50: number; p90: number } | null;
    currency: string;
    revenueHorizonMonths: 12;
  };
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

/** Revenue from a newly acquired customer over the same 12-month survival horizon as contribution payback. */
function customerRevenue12m(e: Economics): number | null {
  const churn = churnOf(e);
  const monthlyRevenue = e.revenuePerCustomerMonthUsd;
  if (churn === null || !Number.isFinite(monthlyRevenue) || monthlyRevenue < 0) return null;
  return churn === 0 ? monthlyRevenue * PAYBACK_HORIZON_MONTHS : monthlyRevenue * (1 - (1 - churn) ** PAYBACK_HORIZON_MONTHS) / churn;
}

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
  const attributedModel: PlayModel = { ...p.model, steps: p.model.steps.map(({ baselineRate: _baselineRate, ...step }) => step) };
  const attributedPoint = invalidInputs.some((n) => n !== "margin") ? 0 : Math.max(0, (funnelCustomers(Math.max(0, p.model.weeklyReach), rates) ?? 0) * customerWeeks);
  const attributedDraws = opts.pointOnly ? customersPoint({ ...attributedModel }, weeks) : simulateSamples(attributedModel, weeks, `${p.name}|${p.kind}`);
  const attributedRange = typeof attributedDraws === "number" ? { p10: attributedDraws, p50: attributedDraws, p90: attributedDraws } : { p10: quantile(attributedDraws, 0.1), p50: quantile(attributedDraws, 0.5), p90: quantile(attributedDraws, 0.9) };
  const twelveMonthRevenue = customerRevenue12m(e);
  const toRevenueRange = (customerRange: { p10: number; p50: number; p90: number } | null) =>
    customerRange && twelveMonthRevenue !== null
      ? { p10: customerRange.p10 * twelveMonthRevenue, p50: customerRange.p50 * twelveMonthRevenue, p90: customerRange.p90 * twelveMonthRevenue }
      : null;
  const attributedHeadline = {
    p10: Math.min(attributedRange.p10, attributedPoint),
    p50: attributedPoint,
    p90: Math.max(attributedRange.p90, attributedPoint),
  };
  const incrementalityRange = incremental ? { p10: Math.min(range.p10, customers), p50: customers, p90: Math.max(range.p90, customers) } : null;
  const spend = Math.max(0, p.model.monthlySpendUsd) * (days / DAYS_PER_MONTH);
  const hours = Math.max(0, p.model.ownerHoursPerWeek) * weeks;
  const hourUsd = ownerHourOf(e);
  // Fully loaded: media, owner time and other costs over the same period (Skok; blog research BRP-17).
  const other = Math.max(0, p.model.otherMonthlyUsd ?? 0) * (days / DAYS_PER_MONTH);
  const ownerTimeUsd = hours * hourUsd;
  const costUsd = spend + ownerTimeUsd + other;
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
    costBreakdown: { cashMediaUsd: spend, cashOtherUsd: other, ownerTimeUsd, fullyLoadedUsd: costUsd },
    cacUsd,
    cacRange,
    valueUsd,
    paybackMonths: cacUsd === null ? null : paybackWithChurn(cacUsd, cm, churn),
    breakevenPerReachUsd: breakevenPerReach(valueUsd, rates),
    profitable,
    invalidInputs,
    incremental,
    outcomeAccounting: {
      attributionBasis: "modeled_play_funnel",
      attributedCustomers: attributedHeadline,
      attributedRevenue12m: toRevenueRange(attributedHeadline),
      incrementalityBasis: incremental ? "modeled_baseline_delta" : "not_estimated",
      modeledIncrementalCustomers: incrementalityRange,
      modeledIncrementalRevenue12m: toRevenueRange(incrementalityRange),
      currency: e.currency ?? "USD",
      revenueHorizonMonths: PAYBACK_HORIZON_MONTHS,
    },
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
export function withForecasts<O extends { economics: Economics; plays: PlayLike[] }>(out: O): Omit<O, "plays"> & { plays: (O["plays"][number] & { p10: number; p50: number; p90: number; sensitivity: PlaySensitivity[]; cacRange: PlayMaths["cacRange"] | null; forecastUncertainty: ForecastUncertainty | null; financialEvidence: FinancialEvidence | null; outcomeAccounting: PlayMaths["outcomeAccounting"] | null })[] } {
  return {
    ...out,
    plays: out.plays.map((p) => {
      // Older plays without a model keep the forecast they were saved with.
      if (!p.model?.steps?.length) return { ...p, sensitivity: [], cacRange: null, forecastUncertainty: null, financialEvidence: null, outcomeAccounting: null } as unknown as O["plays"][number] & { p10: number; p50: number; p90: number; sensitivity: PlaySensitivity[]; cacRange: PlayMaths["cacRange"] | null; forecastUncertainty: ForecastUncertainty | null; financialEvidence: FinancialEvidence | null; outcomeAccounting: PlayMaths["outcomeAccounting"] | null };
      const m = playMaths(p, out.economics);
      return { ...p, p10: roundCount(m.headline.p10), p50: roundCount(m.headline.p50), p90: roundCount(m.headline.p90), sensitivity: m.sensitivity, cacRange: m.cacRange, forecastUncertainty: forecastUncertainty(p.model), financialEvidence: m.financialEvidence, outcomeAccounting: m.outcomeAccounting };
    }),
  } as Omit<O, "plays"> & { plays: (O["plays"][number] & { p10: number; p50: number; p90: number; sensitivity: PlaySensitivity[]; cacRange: PlayMaths["cacRange"] | null; forecastUncertainty: ForecastUncertainty | null; financialEvidence: FinancialEvidence | null; outcomeAccounting: PlayMaths["outcomeAccounting"] | null })[] };
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

export type PortfolioOutcomeBasis = "attributed_only" | "modeled_baseline_delta" | "mixed";

function portfolioOutcomeBasis(plays: PlayLike[]): PortfolioOutcomeBasis {
  const modeled = plays.filter((p) => p.model?.steps?.length);
  const withBaseline = modeled.filter((p) => p.model.steps.some((step) => step.baselineRate !== undefined)).length;
  if (withBaseline === 0) return "attributed_only";
  if (withBaseline === modeled.length) return "modeled_baseline_delta";
  return "mixed";
}

export interface PortfolioRange {
  p10: number;
  p50: number;
  p90: number;
  outcomeBasis: PortfolioOutcomeBasis;
}

function portfolioOutcomeNote(basis: PortfolioOutcomeBasis): string {
  if (basis === "modeled_baseline_delta") return "All counts are modeled deltas against supplied baselines, not experimentally measured causal lift";
  if (basis === "mixed") return "Counts mix play-attributed forecasts with modeled baseline deltas, so the combined total is not a causal lift estimate";
  return "Counts are play-attributed forecasts; causal incremental lift is not estimated";
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
export function portfolioRange(out: { economics: Economics; plays: PlayLike[] }, horizonDays?: number): PortfolioRange {
  const ps = out.plays.filter((p) => p.model?.steps?.length).map((p) => (horizonDays ? { ...p, horizonDays } : p));
  const outcomeBasis = portfolioOutcomeBasis(ps);
  if (!ps.length) return { p10: 0, p50: 0, p90: 0, outcomeBasis };
  const stages = ps.map(stageOfPlay);
  const heads = ps.map((p) => playMaths(p, out.economics).headline);
  const p50 = combinePlays(heads.map((h) => h.p50), stages);
  const cols = pairedDraws(ps);
  if (!cols) return { p10: Math.min(p50, combinePlays(heads.map((h) => h.p10), stages)), p50, p90: Math.max(p50, combinePlays(heads.map((h) => h.p90), stages)), outcomeBasis };
  const totals = Array.from({ length: RUNS }, (_, i) => combinePlays(cols.map((c) => c[i]), stages)).sort((a, b) => a - b);
  return { p10: Math.min(p50, quantile(totals, 0.1)), p50, p90: Math.max(p50, quantile(totals, 0.9)), outcomeBasis };
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
  /** Which customer outcome definition this feasible set optimizes. */
  objective: PortfolioObjective;
  /** Play names in the best feasible set. */
  selected: string[];
  /** Whether its modeled customers are attributed conversions, baseline deltas, or a mix. */
  outcomeBasis: PortfolioOutcomeBasis;
  customers: number;
  spendUsdMonth: number;
  /** Estimated recurring cash outlay; excludes the value of owner time. */
  cashSpendUsdMonth: number;
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

export type PortfolioObjective = "combined_current" | "play_attributed" | "modeled_incremental";

/**
 * The best feasible set of drafted plays under the owner's joint limits (Kochenderfer App. C/E:
 * small sets are enumerated exactly; no solver needed up to 10 plays). Plays that lose money at
 * their most-likely rates never enter, at any budget. A bigger budget only adds feasible sets,
 * so a set that fit before still fits.
 */
export function selectPortfolio(out: { economics: Economics; plays: PlayLike[] }, limits: { monthlyBudgetUsd?: number; monthlyGrowthCashUsd?: number; ownerHoursPerWeek?: number; newCustomersPerMonth?: number; horizonDays?: number; objective?: PortfolioObjective }): PortfolioChoice | null {
  const h = limits.horizonDays || 90;
  const objective = limits.objective ?? "combined_current";
  let ps = out.plays.filter((p) => p.model?.steps?.length);
  if (objective === "modeled_incremental") ps = ps.filter((p) => p.model.steps.some((step) => step.baselineRate !== undefined));
  if (objective === "play_attributed") ps = ps.map((p) => ({
    ...p,
    model: { ...p.model, steps: p.model.steps.map(({ baselineRate: _baselineRate, ...step }) => step) },
  }));
  ps = ps.slice(0, 10);
  if (!ps.length) return null;
  const ms = ps.map((p) => playMaths({ ...p, horizonDays: h }, out.economics));
  const stages = ps.map(stageOfPlay);
  const outcomeBasis = objective === "play_attributed" ? "attributed_only" : objective === "modeled_incremental" ? "modeled_baseline_delta" : portfolioOutcomeBasis(ps);
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
  const capacityP90 = (idx: number[]) => {
    if (!cols) return combinePlays(idx.map((i) => ms[i].headline.p90), idx.map((i) => stages[i]));
    const totals = Array.from({ length: RUNS }, (_, draw) => combinePlays(idx.map((i) => cols[i][draw]), idx.map((i) => stages[i]))).sort((a, b) => a - b);
    return Math.max(combinePlays(idx.map((i) => ms[i].headline.p50), idx.map((i) => stages[i])), quantile(totals, 0.9));
  };
  type Opt = { idx: number[]; customers: number; expectedCustomers: number; spend: number; cashSpend: number; hours: number; net: number | null; cost: number };
  const opts: Opt[] = [];
  for (let mask = 1; mask < 1 << ps.length; mask++) {
    const idx = ps.map((_, i) => i).filter((i) => mask & (1 << i));
    if (idx.some((i) => losers.has(i))) continue;
    const spend = idx.reduce((s, i) => s + Math.max(0, ps[i].model.monthlySpendUsd), 0);
    const cashSpend = idx.reduce((s, i) => s + Math.max(0, ps[i].model.monthlySpendUsd) + Math.max(0, ps[i].model.otherMonthlyUsd ?? 0), 0);
    const hours = idx.reduce((s, i) => s + Math.max(0, ps[i].model.ownerHoursPerWeek), 0);
    const customers = combinePlays(idx.map((i) => ms[i].headline.p50), idx.map((i) => stages[i]));
    const capacityCustomers = capacityP90(idx);
    const cost = idx.reduce((s, i) => s + ms[i].costUsd, 0);
    if (limits.monthlyBudgetUsd !== undefined && spend > limits.monthlyBudgetUsd * 1.001) continue;
    if (limits.monthlyGrowthCashUsd !== undefined && cashSpend > limits.monthlyGrowthCashUsd * 1.001) continue;
    if (limits.ownerHoursPerWeek !== undefined && hours > limits.ownerHoursPerWeek + 0.01) continue;
    if (capLimit !== undefined && capacityCustomers > capLimit * 1.001) continue;
    const expectedCustomers = expected(idx);
    opts.push({ idx, customers, expectedCustomers, spend, cashSpend, hours, cost, net: value === null ? null : expectedCustomers * value - cost });
  }
  const score = (o: Opt) => (o.net ?? o.expectedCustomers);
  opts.sort((a, b) => score(b) - score(a) || a.cost - b.cost || a.idx.length - b.idx.length);
  // Doing nothing new is always an option: a set whose expected contribution is below its cost loses to it (Hubbard Ch 14; Kochenderfer Ch 6).
  const best = opts[0] && (opts[0].net === null || opts[0].net >= 0) ? opts[0] : undefined;
  const leftWhy = (i: number) => (losers.has(i) ? ms[i].financialEvidence.status === "checked_inputs" ? "loses money at its most-likely rates" : "does not pay back under its current scenario inputs" : capLimit !== undefined && capacityP90([i]) > capLimit * 1.001 ? "exceeds the owner's delivery limit in the P90 customer scenario" : limits.monthlyGrowthCashUsd !== undefined && Math.max(0, ps[i].model.monthlySpendUsd) + Math.max(0, ps[i].model.otherMonthlyUsd ?? 0) > limits.monthlyGrowthCashUsd * 1.001 ? "exceeds the owner's monthly growth-cash limit" : "doesn't fit with the others under one or more cash, ad budget, owner time or service capacity limits");
  const all = ps.map((_, i) => i);
  if (!best)
    return {
      objective,
      selected: [],
      outcomeBasis,
      customers: 0,
      spendUsdMonth: 0,
      cashSpendUsdMonth: 0,
      expectedCustomers: 0,
      ownerHoursWeek: 0,
      netUsd: null,
      allFit: false,
      left: all.map((i) => ({ name: ps[i].name, why: opts.length ? "every set's expected contribution is below its cost" : leftWhy(i) })),
      runnerUp: opts[0] ? { selected: opts[0].idx.map((i) => ps[i].name), customers: opts[0].customers, netUsd: opts[0].net } : null,
      basis: opts.length ? `Doing nothing new beats every set at expected values under the current inputs: run only capped tests that measure the deciding input first. ${portfolioOutcomeNote(outcomeBasis)}. ${portfolioEvidenceNote(ps, out.economics)}` : `No play fits the limits on its own. ${portfolioOutcomeNote(outcomeBasis)}.`,
    };
  const key = (o: Opt) => o.idx.join(",");
  // The strongest alternative must beat the choice on something (more customers, less cash or fewer hours); a set worse on every count isn't a trade-off (Kochenderfer Ex 14.5).
  const runner = opts.find((o) => key(o) !== key(best) && (o.expectedCustomers > best.expectedCustomers + 1e-9 || o.spend < best.spend - 1e-9 || o.hours < best.hours - 1e-9)) ?? null;
  return {
    objective,
    selected: best.idx.map((i) => ps[i].name),
    outcomeBasis: portfolioOutcomeBasis(best.idx.map((i) => ps[i])),
    customers: best.customers,
    spendUsdMonth: best.spend,
    cashSpendUsdMonth: best.cashSpend,
    ownerHoursWeek: best.hours,
    netUsd: best.net,
    allFit: best.idx.length === ps.length,
    left: all.filter((i) => !best.idx.includes(i)).map((i) => ({ name: ps[i].name, why: leftWhy(i) })),
    runnerUp: runner ? { selected: runner.idx.map((i) => ps[i].name), customers: runner.customers, netUsd: runner.net } : null,
    expectedCustomers: best.expectedCustomers,
    basis: `${value === null ? "Ranked by expected customers over the input ranges (what a customer is worth is unknown)." : "Ranked by expected contribution in the horizon minus cost, over the input ranges."} ${portfolioOutcomeNote(portfolioOutcomeBasis(best.idx.map((i) => ps[i])))}. ${portfolioEvidenceNote(best.idx.map((i) => ps[i]), out.economics)}`,
  };
}

/** Owner-reported cash-timing inputs, in the business currency. Neither is a bank balance or a payment-terms record. */
export interface GrowthCashInputs {
  /** Cash set aside to carry growth costs until new customers' payments arrive. */
  reserveUsd?: number;
  /** Typical days from winning a new customer to receiving their first payment (0 = paid up front). */
  paymentLagDays?: number;
}

export interface GrowthCashScenario {
  /** Modeled new customers in the period under this scenario. */
  customers: number;
  /** Lowest running balance of growth cash out minus customer contribution in (≤ 0). */
  lowestBalanceUsd: number;
  /** Week the lowest balance is reached; 0 when the running balance never drops below zero. */
  lowestWeek: number;
  /** Running balance at the end of the period. */
  endBalanceUsd: number;
  /** First week after the low point when the running balance is back to zero or above; null when not within the period. */
  recoveredWeek: number | null;
  /** Whether the owner's reserve covers the lowest balance; null when the reserve is unknown. */
  reserveCovers: boolean | null;
  /** How much more the lowest balance needs than the reserve; null when the reserve is unknown or covers it. */
  shortfallUsd: number | null;
}

export interface GrowthCashTiming {
  horizonWeeks: number;
  /** Recurring media and other cash costs of the selected plays, per week (excludes owner time). */
  weeklyCashOutUsd: number;
  cashOutOverPeriodUsd: number;
  reserveUsd: number | null;
  paymentLagDays: number | null;
  /** At the most-likely rates; null when customer cash in can't be timed (see `missing`). */
  mostLikely: GrowthCashScenario | null;
  /** At the low end of the modeled customer range (P10); null like `mostLikely`. */
  lowCase: GrowthCashScenario | null;
  /** Inputs that are unknown and keep part of this view from being calculated. */
  missing: ("payment_lag" | "customer_value" | "churn" | "reserve")[];
  /** Revenue, margin or churn inputs that the owner hasn't confirmed. */
  unconfirmedEconomics: ("revenue" | "margin" | "churn")[];
}

const WEEKS_PER_MONTH = 52 / 12;

/**
 * Week-by-week growth cash for the selected plays (REQ-MATH: deterministic, no invented inputs).
 * Cash out is each play's recurring media and other cash cost, spread evenly from the first week.
 * Cash in is each new customer's monthly contribution (revenue × margin), spread evenly over weeks,
 * starting the owner's payment lag after the customer is won and shrinking with churn. Customers
 * arrive on each play's modeled ramp and sales lag, scaled by the same play-overlap rule as the
 * portfolio. An unknown lag, price, margin or churn leaves cash in untimed rather than assumed.
 */
export function growthCashTiming(out: { economics: Economics; plays: PlayLike[] }, selected: string[], opts: { horizonDays?: number } & GrowthCashInputs): GrowthCashTiming | null {
  const h = opts.horizonDays || 90;
  const ps = out.plays.filter((p) => p.model?.steps?.length && selected.includes(p.name)).slice(0, 10).map((p) => ({ ...p, horizonDays: h }));
  if (!ps.length) return null;
  const hw = h / 7;
  const W = Math.ceil(hw);
  const weight = (w: number) => Math.min(1, hw - (w - 1));
  const monthlyCash = ps.reduce((s, p) => s + Math.max(0, p.model.monthlySpendUsd) + Math.max(0, p.model.otherMonthlyUsd ?? 0), 0);
  const weeklyCashOut = monthlyCash / WEEKS_PER_MONTH;
  const reserve = opts.reserveUsd !== undefined && Number.isFinite(opts.reserveUsd) && opts.reserveUsd >= 0 ? opts.reserveUsd : null;
  const lag = opts.paymentLagDays !== undefined && Number.isFinite(opts.paymentLagDays) && opts.paymentLagDays >= 0 ? opts.paymentLagDays : null;
  const contribution = monthlyContribution(out.economics);
  const churn = churnOf(out.economics);
  const src = economicsSources(out.economics);
  const unconfirmedEconomics = (["revenue", "margin", "churn"] as const).filter((k) => src[k].source !== "owner");
  const missing: GrowthCashTiming["missing"] = [
    ...(lag === null ? ["payment_lag" as const] : []),
    ...(contribution === null ? ["customer_value" as const] : []),
    ...(churn === null ? ["churn" as const] : []),
    ...(reserve === null ? ["reserve" as const] : []),
  ];
  const base = {
    horizonWeeks: W,
    weeklyCashOutUsd: weeklyCashOut,
    cashOutOverPeriodUsd: weeklyCashOut * hw,
    reserveUsd: reserve,
    paymentLagDays: lag,
    missing,
    unconfirmedEconomics,
  };
  if (lag === null || contribution === null || churn === null) return { ...base, mostLikely: null, lowCase: null };
  const ms = ps.map((p) => playMaths(p, out.economics));
  const stages = ps.map(stageOfPlay);
  const weeklyContribution = contribution / WEEKS_PER_MONTH;
  const survival = Math.pow(1 - churn, 1 / WEEKS_PER_MONTH);
  const firstPayWeek = Math.ceil(lag / 7);
  const scenario = (perPlay: number[]): GrowthCashScenario => {
    const sum = perPlay.reduce((s, n) => s + n, 0);
    const total = sum > 0 ? combinePlays(perPlay, stages) : 0;
    const overlap = sum > 0 ? total / sum : 0;
    // Customers won in each week: each play's total, shaped by its ramp and sales lag (effectiveCustomerWeeks).
    const won = Array.from({ length: W + 1 }, () => 0);
    ps.forEach((p, i) => {
      const full = effectiveCustomerWeeks(p.model, hw);
      if (!(full > 0) || !(perPlay[i] > 0)) return;
      for (let w = 1; w <= W; w++) won[w] += (perPlay[i] * overlap * (effectiveCustomerWeeks(p.model, Math.min(w, hw)) - effectiveCustomerWeeks(p.model, w - 1))) / full;
    });
    let balance = 0;
    let lowest = 0;
    let lowestWeek = 0;
    let recoveredWeek: number | null = null;
    for (let w = 1; w <= W; w++) {
      let paying = 0;
      for (let a = 1; a + firstPayWeek <= w; a++) paying += won[a] * Math.pow(survival, w - a);
      balance += (paying * weeklyContribution - weeklyCashOut) * weight(w);
      if (balance < lowest - 1e-9) {
        lowest = balance;
        lowestWeek = w;
        recoveredWeek = null;
      } else if (lowest < 0 && recoveredWeek === null && balance >= 0) recoveredWeek = w;
    }
    const need = -lowest;
    return {
      customers: total,
      lowestBalanceUsd: lowest,
      lowestWeek,
      endBalanceUsd: balance,
      recoveredWeek,
      reserveCovers: reserve === null ? null : reserve + 1e-6 >= need,
      shortfallUsd: reserve === null || reserve + 1e-6 >= need ? null : need - reserve,
    };
  };
  return {
    ...base,
    mostLikely: scenario(ms.map((m) => m.headline.p50)),
    lowCase: scenario(ms.map((m) => m.headline.p10)),
  };
}

/** The decision values of a saved owner cash-timing record (who/when excluded, so re-saving the same values is not a change). */
export function growthCashTimingInput(saved: { reserveMinor?: number; currency: string; paymentLagDays?: number } | null | undefined): { reserveMinor: number | null; currency: string; paymentLagDays: number | null } | null {
  if (!saved || (saved.reserveMinor === undefined && saved.paymentLagDays === undefined)) return null;
  return { reserveMinor: saved.reserveMinor ?? null, currency: saved.currency, paymentLagDays: saved.paymentLagDays ?? null };
}

/** Owner cash-timing inputs usable in `currency`: a reserve saved in another currency is withheld, not converted. */
export function growthCashInputsIn(saved: ReturnType<typeof growthCashTimingInput>, currency: string): GrowthCashInputs & { reserveCurrencyMismatch: boolean } {
  const mismatch = saved?.reserveMinor !== null && saved?.reserveMinor !== undefined && saved.currency !== currency;
  return {
    ...(saved?.reserveMinor !== null && saved?.reserveMinor !== undefined && !mismatch ? { reserveUsd: saved.reserveMinor / 10 ** fractionDigits(saved.currency) } : {}),
    ...(saved?.paymentLagDays !== null && saved?.paymentLagDays !== undefined ? { paymentLagDays: saved.paymentLagDays } : {}),
    reserveCurrencyMismatch: mismatch,
  };
}

/** Owner-reported growth cash timing for planning; unknown values are named, never filled in. */
export function growthCashTimingContext(saved: ReturnType<typeof growthCashTimingInput>, currency: string): string {
  if (!saved) return "";
  const inputs = growthCashInputsIn(saved, currency);
  const reserve = inputs.reserveUsd !== undefined ? formatMoney(inputs.reserveUsd, currency) : inputs.reserveCurrencyMismatch ? `unknown (saved in ${saved.currency}; not converted)` : "unknown";
  const lag = inputs.paymentLagDays !== undefined ? `${inputs.paymentLagDays} days` : "unknown";
  return `GROWTH CASH TIMING (owner-reported; not a bank balance or verified payment terms): cash set aside to carry growth costs until customer payments arrive ${reserve}; a new customer typically pays ${lag} after being won. Prefer plays and sequencing whose growth costs before customer payments arrive stay within the reserve. Don't assume an unknown value, and don't write your own cash forecast: ClimbOS computes the timing for the selected plays.`;
}

/** The plan check's reserve constraint: only when both a reserve (usable in `currency`) and a payment delay are reported. */
export function growthCashReserveConstraint(saved: ReturnType<typeof growthCashTimingInput>, owner: Pick<OwnerEconomics, "revenuePerCustomerMonthUsd" | "grossMargin" | "monthlyChurn"> | null | undefined, currency: string, horizonDays: number): { reserveUsd: number; paymentLagDays: number; horizonDays: number; ownerEconomics?: Pick<OwnerEconomics, "revenuePerCustomerMonthUsd" | "grossMargin" | "monthlyChurn"> } | null {
  const inputs = growthCashInputsIn(saved, currency);
  if (inputs.reserveUsd === undefined || inputs.paymentLagDays === undefined) return null;
  const ownerEconomics = {
    ...(owner?.revenuePerCustomerMonthUsd !== undefined ? { revenuePerCustomerMonthUsd: owner.revenuePerCustomerMonthUsd } : {}),
    ...(owner?.grossMargin !== undefined ? { grossMargin: owner.grossMargin } : {}),
    ...(owner?.monthlyChurn !== undefined ? { monthlyChurn: owner.monthlyChurn } : {}),
  };
  return { reserveUsd: inputs.reserveUsd, paymentLagDays: inputs.paymentLagDays, horizonDays, ...(Object.keys(ownerEconomics).length ? { ownerEconomics } : {}) };
}

/** The computed cash timing as a locked line for the plan writer; empty when there is nothing to report. */
export function growthCashTimingLine(t: GrowthCashTiming | null, currency?: string): string {
  if (!t) return "";
  const m = (n: number) => formatMoney(Math.round(n * 100) / 100, currency);
  const inputs = `owner-reported reserve ${t.reserveUsd === null ? "unknown" : m(t.reserveUsd)}, payment delay ${t.paymentLagDays === null ? "unknown" : `${t.paymentLagDays} days`}`;
  const scen = (label: string, s: GrowthCashScenario) => `${label}: ${s.lowestWeek === 0 ? "never below zero" : `lowest ${m(s.lowestBalanceUsd)} in week ${s.lowestWeek}, ${s.recoveredWeek === null ? "not back to zero in the period" : `back to zero by week ${s.recoveredWeek}`}`}${s.reserveCovers === false ? `, reserve short by ${m(s.shortfallUsd ?? 0)}` : s.reserveCovers ? ", within the reserve" : ""}`;
  const body = t.mostLikely && t.lowCase
    ? `${scen("most-likely", t.mostLikely)}; ${scen("low-end P10 customers", t.lowCase)}`
    : `customer payments not timed (missing ${t.missing.filter((x) => x !== "reserve").join(", ")}); growth costs total ${m(t.cashOutOverPeriodUsd)} before any customer pays`;
  return `- GROWTH CASH TIMING · selected set (${inputs}; ${m(t.weeklyCashOutUsd)}/week growth cash out): ${body}. Computed by ClimbOS from play costs, ramps and economics; quote it, don't recompute it. Not a bank-balance or cash-flow forecast. If the reserve is short, sequence or cap cash-heavy plays and say so; if inputs are unknown, don't assume them.`;
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
export function lockedNumbers(out: { economics: Economics; plays: PlayLike[] }, goal?: { statement?: string; target?: GoalTarget | null; horizonDays?: number } | null, limits?: { monthlyBudgetUsd?: number; monthlyGrowthCashUsd?: number; ownerHoursPerWeek?: number; newCustomersPerMonth?: number }): string {
  const rows = out.plays.map((p) => ({ p, m: playMaths(p, out.economics) }));
  // The total uses the goal's horizon for every play, so it never mixes periods.
  const own = [...new Set(out.plays.map((p) => p.horizonDays).filter((d) => d > 0))];
  const h = goal?.horizonDays || (own.length === 1 ? own[0] : 90);
  const atH = out.plays.map((p) => playMaths({ ...p, horizonDays: h }, out.economics));
  const { p50: total, p10: low, p90: high } = portfolioRange(out, h);
  const outcomeBasis = portfolioOutcomeBasis(out.plays);
  const cost = atH.reduce((s, m) => s + m.costUsd, 0);
  const spend = out.plays.reduce((s, p) => s + Math.max(0, p.model?.monthlySpendUsd ?? 0), 0);
  const e = out.economics;
  const usd = (n: number | null) => formatMoney(n, e.currency);
  const churn = churnOf(e);
  // Two payback definitions give different months for the same play: name both (Skok's per-surviving-customer vs ClimbOS's churn-weighted; blog research BRP-17).
  const cmOf = monthlyContribution(e) ?? 0;
  const rangeLine = (r: { p10: number; p50: number; p90: number } | null, money = false) =>
    r ? `${money ? usd(r.p10) : roundCount(r.p10)}–${money ? usd(r.p90) : roundCount(r.p90)} (central ${money ? usd(r.p50) : roundCount(r.p50)})` : "not estimated";
  return [
    "LOCKED NUMBERS (computed by ClimbOS from the plays; use exactly these, never restate them differently):",
    `- One customer: ${usd(monthlyContribution(e))}/month contribution, ${churn === null ? "churn unknown" : `${r1(churn * 100)}% monthly churn`}; earns ${usd(customerValue(e))} in ${PAYBACK_HORIZON_MONTHS} months = the most a customer may cost (${e.basis}; sources: ${sourcesLine(e)}).`,
      ...rows.map(({ p, m }) => `- ${m.name} (${m.kind}): ≈${roundCount(m.headline.p50)} customers in ${p.horizonDays || 90} days at the most-likely rates (simulated range ${roundCount(m.headline.p10)}–${roundCount(m.headline.p90)}), cost ${usd(m.costUsd)}, cost per customer ${usd(m.cacUsd)} (same basis; simulated CAC P10–P90 ${usd(m.cacRange.p10)}–${usd(m.cacRange.p90)}${m.cacRange.p90 === null ? ", unbounded when a draw has no customers" : ""}), payback ${m.paybackMonths === null ? "never within lifetime" : `${r1(m.paybackMonths)} months with churn`}${m.cacUsd !== null && cmOf > 0 ? ` (${r1(m.cacUsd / cmOf)} months per surviving customer)` : ""}${p.model.monthlySpendUsd > 0 && m.breakevenPerReachUsd !== null ? `, break-even ${usd(m.breakevenPerReachUsd)} per person reached` : ""}${m.breakevenCustomers !== null && m.costUsd > 0 ? `; needs ${roundCount(m.breakevenCustomers)} customers to break even (${ROBUST_WORD[m.robustness]})` : ""}${m.incremental ? "; extra customers over today's rate only" : ""}${p.model.rampWeeks ? `; reach ramps to full volume over ${p.model.rampWeeks} weeks` : ""}${p.model.salesLagDays ? `; allows ${p.model.salesLagDays} days for paid conversion` : ""}${m.lossChance !== null && m.costUsd > 0 ? `; ${Math.round(m.lossChance * 100)}% chance it doesn't pay back if its ranges are right` : ""}. ${basisNote(p, e)}\n  OUTCOME ACCOUNTING · attributed customers: ${rangeLine(m.outcomeAccounting.attributedCustomers)}; modeled 12-month attributed revenue: ${rangeLine(m.outcomeAccounting.attributedRevenue12m, true)}; modeled incremental customers: ${rangeLine(m.outcomeAccounting.modeledIncrementalCustomers)}; modeled incremental 12-month revenue: ${rangeLine(m.outcomeAccounting.modeledIncrementalRevenue12m, true)} (${m.outcomeAccounting.incrementalityBasis === "modeled_baseline_delta" ? "modeled against supplied baseline rates, not experimentally measured" : "not estimated because no baseline was supplied"}).${decidesLine(p, e, usd) ? `\n${decidesLine(p, e, usd)}` : ""}`),
    ...rows.flatMap(({ m }) => m.sensitivity.slice(0, 3).map((s) => `- SENSITIVITY · ${m.name} · ${s.driver} (one input at a time, not a joint forecast): ${s.metric === "net_contribution_12m" ? "12-month net contribution" : "customers"} is ${s.metric === "net_contribution_12m" ? usd(s.atLow) : roundCount(s.atLow)} at low, ${s.metric === "net_contribution_12m" ? usd(s.atMode) : roundCount(s.atMode)} at most-likely, ${s.metric === "net_contribution_12m" ? usd(s.atHigh) : roundCount(s.atHigh)} at high.`)),
    "- None of these forecasts is calibrated to this business's own results yet. Call assumption-based ones scenarios, never predictions.",
    "- Timing assumptions: specified ramp and sales lag are applied to customer forecasts; costs still cover the full planned period. Missing ramp or lag means immediate full volume or immediate paid conversion.",
    `- TOTAL: ≈${roundCount(total)} modeled customer outcomes in ${h} days (range ${roundCount(low)}–${roundCount(high)}, plays assumed to vary independently; ${PLAY_OVERLAP * 100}% overlap between plays; plays on the same step count once) for ${usd(cost)} (cash spend ${usd(spend)}/month); blended cost per modeled outcome ${usd(total > 0 ? cost / total : null)}. ${portfolioOutcomeNote(outcomeBasis)}.`,
    ...portfolioLine(out, { ...(limits ?? {}), horizonDays: h }, usd),
    `- Modeled portfolio outcome = ≈${Math.round(total)} customer outcomes by day ${h}: ${portfolioOutcomeNote(outcomeBasis)}; it is a scenario, not the owner's goal.`,
    ...(goal ? goalLines(goal.statement, playsGoalGap(out, goal)) : []),
  ].join("\n");
}

const ROBUST_WORD: Record<PlayMaths["robustness"], string> = { robust: "pays back even at the low end", fragile: "pays back only at the most-likely rates", loses: "doesn't pay back at the most-likely rates", unknown: "payback unknown" };

/** The feasible-set check as one locked line: what fits together, and the strongest alternative. */
function portfolioLine(out: { economics: Economics; plays: PlayLike[] }, limits: Parameters<typeof selectPortfolio>[1], usd: (n: number | null) => string): string[] {
  const choices = [
    { objective: "play_attributed" as const, label: "PLAY-ATTRIBUTED OUTCOMES" },
    { objective: "modeled_incremental" as const, label: "MODELED BASELINE DELTA" },
  ];
  return choices.map(({ objective, label }) => {
    const c = selectPortfolio(out, { ...limits, objective });
    if (!c) return objective === "modeled_incremental" ? "- PORTFOLIO CHECK · MODELED BASELINE DELTA: not estimated; none of the plays includes a baseline rate." : "";
    if (c.allFit && !c.left.length) return `- PORTFOLIO CHECK · ${label}: all eligible plays fit the stated limits (≈${roundCount(c.customers)} outcomes, ${usd(c.spendUsdMonth)}/month media, ${usd(c.cashSpendUsdMonth)}/month cash costs, ${Math.round(c.ownerHoursWeek * 10) / 10} h/week${c.netUsd !== null ? `, net ${usd(c.netUsd)}` : ""}). ${c.basis}`;
    const alt = c.runnerUp ? ` Strongest alternative: ${c.runnerUp.selected.join(" + ")} (≈${roundCount(c.runnerUp.customers)} outcomes${c.runnerUp.netUsd !== null ? `, net ${usd(c.runnerUp.netUsd)}` : ""}).` : "";
    return `- PORTFOLIO CHECK · ${label}: best feasible set is ${c.selected.join(" + ") || "none"} (≈${roundCount(c.customers)} outcomes, ${usd(c.spendUsdMonth)}/month media, ${usd(c.cashSpendUsdMonth)}/month cash costs, ${Math.round(c.ownerHoursWeek * 10) / 10} h/week${c.netUsd !== null ? `, net ${usd(c.netUsd)}` : ""}). Left out: ${c.left.map((l) => `${l.name} (${l.why})`).join("; ")}.${alt} ${c.basis}`;
  }).filter(Boolean);
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
  if (b.kind === "sourced_estimate") return `Forecast basis: estimate from cited sources, not yet from this business's results; source fit to this business is not verified.${unchecked}${finance}`;
  return `Forecast basis: scenario from the play's own inputs (sources not labelled).${finance}`;
}

function portfolioEvidenceNote(plays: PlayLike[], e: Economics): string {
  const statuses = plays.map((p) => financialEvidence(p, e).status);
  if (statuses.every((s) => s === "checked_inputs")) return "The selected comparison uses owner-confirmed inputs; results still are not calibrated to observed outcomes.";
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

export type QuestionKey = "revenuePerCustomerMonthUsd" | "grossMargin" | "monthlyChurn" | "ownerHourUsd" | "ownerHoursPerWeek" | "newCustomersPerMonth" | "monthlyGrowthCashUsd";
export interface OwnerQuestion {
  key: QuestionKey;
  question: string;
  ownerReported?: boolean;
  /** The value the plan assumed, for the input's placeholder. */
  assumed?: number;
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
  monthlyGrowthCashUsd: { q: "How much cash can you safely commit to growth work each month, including ads and other paid costs?", unit: "usd_month" },
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
  const churn = churnOf(e);
  if (assumed.has("churn") && churn !== null) candidates.push({ key: "monthlyChurn", value: churn, low: churn * 0.5, high: Math.min(0.9, churn * 2) });
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
  // Missing churn is not a sensitivity midpoint. Keep it unknown and ask for the
  // missing owner input so customer value and payback are not framed around a
  // fabricated 5% baseline.
  const unknownChurn: OwnerQuestion[] = churn === null
    ? [{ key: "monthlyChurn", question: QUESTION.monthlyChurn.q, unit: "share_month", why: "Customer value and payback stay unknown until ClimbOS knows how many customers stop buying each month." }]
    : [];
  // Delivery: a service business can only take so many new clients; ask when the plays forecast any.
  const months = (opts.horizonDays || 90) / DAYS_PER_MONTH;
  const perMonth = portfolioP50(out, opts.horizonDays || 90) / months;
  const delivery: OwnerQuestion[] =
    opts.serviceBusiness && owner?.newCustomersPerMonth === undefined && perMonth >= 1 ? [{ key: "newCustomersPerMonth", question: QUESTION.newCustomersPerMonth.q, assumed: Math.round(perMonth), unit: "count_month", why: `The plays forecast about ${Math.round(perMonth)} additional customers a month; compare that with what you can accept after current workload.` }] : [];
  const unconstrainedPortfolio = selectPortfolio(out, { horizonDays: opts.horizonDays || 90 });
  const cashQuestion: OwnerQuestion[] = (unconstrainedPortfolio?.cashSpendUsdMonth ?? 0) > 0
    ? [{ key: "monthlyGrowthCashUsd", question: QUESTION.monthlyGrowthCashUsd.q, ...(owner?.monthlyGrowthCashUsd !== undefined ? { assumed: owner.monthlyGrowthCashUsd, ownerReported: true } : {}), unit: "usd_month", why: `${owner?.monthlyGrowthCashUsd !== undefined ? `Your saved owner-reported limit is ${formatMoney(owner.monthlyGrowthCashUsd, e.currency)} a month. ` : ""}The current best modeled set needs about ${formatMoney(unconstrainedPortfolio!.cashSpendUsdMonth, e.currency)} a month for media and other cash costs. This limit excludes the value of your time.` }]
    : [];
  return [
    ...unknownChurn,
    ...cashQuestion,
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
