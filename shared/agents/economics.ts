import type { LintIssue } from "./types";
import { CHECK_STAMP, economicsSources, forecastBasis, type EconomicsSources, type Provenance, type SourceTag, type TagCheck } from "./provenance";
import { createRng } from "../forecasting/prng";
import { goalGap, goalLines, type GoalGap, type GoalTarget } from "./goal";
import { allowableCac, breakevenPerReach, cacFull, churnFromLifetime, contributionMonth, contributionOver, funnelCustomers, paybackWithChurn, portfolioCustomers } from "../growth/calc";

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
  /** Where the rate came from (newer plans); `check` is set by code, never by the writer. */
  source?: Provenance;
  ref?: string;
  quote?: string;
  check?: TagCheck;
  checkedBy?: string;
  access?: SourceTag["access"];
  receipt?: SourceTag["receipt"];
}
export interface PlayModel {
  weeklyReach: number;
  weeklyReachLow?: number;
  weeklyReachHigh?: number;
  steps: PlayStep[];
  monthlySpendUsd: number;
  ownerHoursPerWeek: number;
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
  /** Value of an owner hour; $50 when unknown. */
  ownerHourUsd?: number;
}

/** Numbers the owner confirmed (businesses.unitEconomics); they always beat the model's assumptions. */
export interface OwnerEconomics {
  revenuePerCustomerMonthUsd?: number;
  grossMargin?: number;
  monthlyChurn?: number;
  ownerHourUsd?: number;
  /** Hours a week the owner can give growth work (a constraint, not a price). */
  ownerHoursPerWeek?: number;
  /** When the owner last confirmed these numbers. */
  updatedAt?: number;
}
export interface PlayLike {
  name: string;
  kind: string;
  unit: string;
  horizonDays: number;
  model: PlayModel;
}

export const OWNER_HOUR_USD = 50;
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
  costUsd: number;
  cacUsd: number | null;
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
}

/** A share in 0–1, or NaN. Ratios above 1 are rejected, never silently read as percents (REQ-MATH-03). */
const rateOf = (r: number | undefined | null): number => (typeof r === "number" && Number.isFinite(r) && r >= 0 && r <= 1 ? r : NaN);
const DAYS_PER_MONTH = 365.25 / 12;

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
  const reach = Math.max(0, m.weeklyReach);
  // Invalid rates give no forecast (lint reports them); nothing is reinterpreted.
  if (m.steps.some((s) => Number.isNaN(rateOf(s.rate)))) return { p10: 0, p50: 0, p90: 0 };
  const point = (funnelCustomers(reach, m.steps.map((s) => s.rate)) ?? 0) * weeks;
  const ranged = m.weeklyReachLow !== undefined || m.steps.some((s) => s.low !== undefined || s.high !== undefined);
  if (!ranged) return { p10: point, p50: point, p90: point };
  const rng = createRng(seedOf(seed));
  const rL = Math.max(0, Math.min(m.weeklyReachLow ?? reach, reach));
  const rH = Math.max(reach, m.weeklyReachHigh ?? reach);
  const out: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    let c = tri(rng.next(), rL, reach, rH) * weeks;
    for (const s of m.steps) {
      const mode = s.rate;
      const low = Number.isNaN(rateOf(s.low)) ? mode : (s.low as number);
      const high = Number.isNaN(rateOf(s.high)) ? mode : (s.high as number);
      c *= tri(rng.next(), Math.min(low, mode), mode, Math.max(high, mode));
    }
    out.push(c);
  }
  out.sort((a, b) => a - b);
  return { p10: quantile(out, 0.1), p50: quantile(out, 0.5), p90: quantile(out, 0.9) };
}

export function playMaths(p: PlayLike, e: Economics): PlayMaths {
  if (!p.model?.steps) p = { ...p, model: { weeklyReach: 0, steps: [], monthlySpendUsd: 0, ownerHoursPerWeek: 0 } };
  // The actual horizon: 3 days is 3/7 of a week of reach, not a full week (REQ-MATH-04).
  const days = p.horizonDays > 0 ? p.horizonDays : 90;
  const weeks = days / 7;
  const invalidInputs = [...p.model.steps.filter((s) => Number.isNaN(rateOf(s.rate))).map((s) => s.name), ...(Number.isNaN(rateOf(e.grossMargin)) ? ["margin"] : [])];
  const rates = p.model.steps.map((s) => rateOf(s.rate));
  const customers = invalidInputs.some((n) => n !== "margin") ? 0 : (funnelCustomers(Math.max(0, p.model.weeklyReach), rates) ?? 0) * weeks;
  const range = simulateCustomers(p.model, weeks, `${p.name}|${p.kind}`);
  const spend = Math.max(0, p.model.monthlySpendUsd) * (days / DAYS_PER_MONTH);
  const hours = Math.max(0, p.model.ownerHoursPerWeek) * weeks;
  const hourUsd = e.ownerHourUsd && e.ownerHourUsd > 0 ? e.ownerHourUsd : OWNER_HOUR_USD;
  const costUsd = spend + hours * hourUsd;
  const cacUsd = cacFull(spend, hours, hourUsd, 0, customers);
  const cm = monthlyContribution(e);
  const churn = churnOf(e);
  // Unknown churn stays unknown: no value, payback or verdict is invented from it.
  const valueUsd = contributionOver(cm, churn, PAYBACK_HORIZON_MONTHS);
  return {
    name: p.name,
    kind: p.kind,
    customers,
    range,
    costUsd,
    cacUsd,
    valueUsd,
    paybackMonths: cacUsd === null ? null : paybackWithChurn(cacUsd, cm, churn),
    breakevenPerReachUsd: breakevenPerReach(valueUsd, rates),
    profitable: cacUsd === null || valueUsd === null ? null : cacUsd <= valueUsd,
    invalidInputs,
  };
}

/** Rounded for display: whole numbers from 10 up, one decimal below. */
export function roundCount(n: number): number {
  return n >= 10 ? Math.round(n) : Math.round(n * 10) / 10;
}

/** Adds the computed forecast (P10/P50/P90 customers) to each play; the model never writes it. */
export function withForecasts<O extends { economics: Economics; plays: PlayLike[] }>(out: O): Omit<O, "plays"> & { plays: (O["plays"][number] & { p10: number; p50: number; p90: number })[] } {
  return {
    ...out,
    plays: out.plays.map((p) => {
      // Older plays without a model keep the forecast they were saved with.
      if (!p.model?.steps?.length) return p as O["plays"][number] & { p10: number; p50: number; p90: number };
      const m = playMaths(p, out.economics);
      return { ...p, p10: roundCount(m.range.p10), p50: roundCount(m.range.p50), p90: roundCount(m.range.p90) };
    }),
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const usd = (n: number | null) => (n === null ? "n/a" : n < 10 ? `$${n.toFixed(2)}` : `$${Math.round(n).toLocaleString("en-US")}`);

export function lintEconomics(out: { economics: Economics; plays: PlayLike[] }): LintIssue[] {
  const issues: LintIssue[] = [];
  const e = out.economics;
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
    const m = playMaths(p, e);
    if (m.profitable === false && p.kind !== "moonshot")
      issues.push({ severity: "error", rule: "economics", message: `Loses money: cost per customer ${usd(m.cacUsd)} (spend + owner time at $${e.ownerHourUsd || OWNER_HOUR_USD}/h) vs ${usd(m.valueUsd)} a customer earns in ${PAYBACK_HORIZON_MONTHS} months. Don't raise reach or rates to make it pass. Verify an input (owner number or a cited page), cut spend or hours, target higher-value customers, make it a capped test with a stop rule, or drop it.`, path });
  });
  return issues;
}

/** Portfolio customers (P50, after overlap): the number the plan's North Star must use. */
/** The portfolio's new customers over one shared horizon (each play re-run at that horizon, so periods aren't mixed). */
export function portfolioRange(out: { economics: Economics; plays: PlayLike[] }, horizonDays?: number): { p10: number; p50: number; p90: number } {
  const ms = out.plays.filter((p) => p.model?.steps?.length).map((p) => playMaths(horizonDays ? { ...p, horizonDays } : p, out.economics).range);
  const sum = (k: "p10" | "p50" | "p90") => portfolioCustomers(ms.map((m) => m[k]), PLAY_OVERLAP) ?? 0;
  return { p10: sum("p10"), p50: sum("p50"), p90: sum("p90") };
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
export function lockedNumbers(out: { economics: Economics; plays: PlayLike[] }, goal?: { statement?: string; target?: GoalTarget | null; horizonDays?: number } | null): string {
  const rows = out.plays.map((p) => ({ p, m: playMaths(p, out.economics) }));
  // The total uses the goal's horizon for every play, so it never mixes periods.
  const own = [...new Set(out.plays.map((p) => p.horizonDays).filter((d) => d > 0))];
  const h = goal?.horizonDays || (own.length === 1 ? own[0] : 90);
  const atH = out.plays.map((p) => playMaths({ ...p, horizonDays: h }, out.economics));
  const { p50: total, p10: low, p90: high } = portfolioRange(out, h);
  const cost = atH.reduce((s, m) => s + m.costUsd, 0);
  const spend = out.plays.reduce((s, p) => s + Math.max(0, p.model?.monthlySpendUsd ?? 0), 0);
  const e = out.economics;
  const churn = churnOf(e);
  return [
    "LOCKED NUMBERS (computed by ClimbOS from the plays; use exactly these, never restate them differently):",
    `- One customer: ${usd(monthlyContribution(e))}/month contribution, ${churn === null ? "churn unknown" : `${r1(churn * 100)}% monthly churn`}; earns ${usd(customerValue(e))} in ${PAYBACK_HORIZON_MONTHS} months = the most a customer may cost (${e.basis}; sources: ${sourcesLine(e)}).`,
    ...rows.map(({ p, m }) => `- ${m.name} (${m.kind}): ≈${roundCount(m.range.p50)} customers in ${p.horizonDays || 90} days (range ${roundCount(m.range.p10)}–${roundCount(m.range.p90)}), cost ${usd(m.costUsd)}, cost per customer ${usd(m.cacUsd)}, payback ${m.paybackMonths === null ? "never within lifetime" : `${r1(m.paybackMonths)} months`}${p.model.monthlySpendUsd > 0 && m.breakevenPerReachUsd !== null ? `, break-even ${usd(m.breakevenPerReachUsd)} per person reached` : ""}. ${basisNote(p, e)}`),
    "- None of these forecasts is calibrated to this business's own results yet. Call assumption-based ones scenarios, never predictions.",
    `- TOTAL: ≈${roundCount(total)} new customers in ${h} days (range ${roundCount(low)}–${roundCount(high)}; assumes ${PLAY_OVERLAP * 100}% overlap between plays) for ${usd(cost)} (cash spend ${usd(spend)}/month); blended cost per customer ${usd(total > 0 ? cost / total : null)}.`,
    `- North Star target = ≈${Math.round(total)} new customers by day ${h}: what these plays support (a scenario), not the owner's goal.`,
    ...(goal ? goalLines(goal.statement, playsGoalGap(out, goal)) : []),
  ].join("\n");
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
  if (b.kind === "assumption_scenario") return `Forecast basis: assumption-based scenario (assumed: ${b.assumed.join(", ")}).${unchecked}`;
  if (b.kind === "sourced_estimate") return `Forecast basis: estimate from cited sources, not yet from this business's results.${unchecked}`;
  return "Forecast basis: scenario from the play's own inputs (sources not labelled).";
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
  if (confirmed.length) out.basis = `Owner confirmed ${confirmed.join(", ")}.${e.basis ? ` ${e.basis}` : ""}`.slice(0, 400);
  return out;
}

export type QuestionKey = "revenuePerCustomerMonthUsd" | "grossMargin" | "monthlyChurn" | "ownerHourUsd" | "ownerHoursPerWeek";
export interface OwnerQuestion {
  key: QuestionKey;
  question: string;
  /** The value the plan assumed, for the input's placeholder. */
  assumed: number;
  unit: "usd_month" | "share" | "share_month" | "usd_hour" | "hours_week";
  /** Why it matters: which plays' verdicts flip across a plausible range. */
  why: string;
}

const QUESTION: Record<QuestionKey, { q: string; unit: OwnerQuestion["unit"] }> = {
  revenuePerCustomerMonthUsd: { q: "What does an average customer pay you per month?", unit: "usd_month" },
  grossMargin: { q: "What share of that do you keep after delivery costs?", unit: "share" },
  monthlyChurn: { q: "What share of customers leave each month?", unit: "share_month" },
  ownerHourUsd: { q: "What is an hour of your time worth?", unit: "usd_hour" },
  ownerHoursPerWeek: { q: "How many hours a week can you give growth work?", unit: "hours_week" },
};

/**
 * Up to three questions whose answers would change the plan (spec §10): each assumed
 * input is moved across a plausible range; it is asked only if some play's
 * pays-back verdict flips or the main play's payback moves by half or more.
 */
export function decisionQuestions(out: { economics: Economics; plays: PlayLike[] }, owner?: OwnerEconomics | null, max = 3): OwnerQuestion[] {
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
  if (!(owner?.ownerHourUsd && owner.ownerHourUsd > 0) && plays.some((p) => p.model.ownerHoursPerWeek > 0)) candidates.push({ key: "ownerHourUsd", value: OWNER_HOUR_USD, low: 20, high: 150 });
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
  return [
    ...capacity,
    ...scored
    .filter((x) => x.flips > 0 || x.paybackSwing >= 0.5)
    .sort((a, b) => b.flips - a.flips || b.paybackSwing - a.paybackSwing)
    .slice(0, max)
    .map(({ c, flips }) => ({
      key: c.key,
      question: QUESTION[c.key].q,
      assumed: Math.round(c.value * 1000) / 1000,
      unit: QUESTION[c.key].unit,
      why: flips > 0 ? `Decides whether ${flips === 1 ? "a play pays back" : `${flips} plays pay back`}.` : "Changes how fast your main play pays back.",
    })),
  ].slice(0, max);
}
