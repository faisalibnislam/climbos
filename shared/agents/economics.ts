import type { LintIssue } from "./types";

/**
 * Growth maths in code, not prose: each play's numbers become 90-day
 * customers, cost per customer (CAC) and payback against 12-month gross
 * profit. Plays that lose money or whose forecast doesn't follow from their
 * own numbers are sent back; the plan receives these totals as locked numbers.
 */

export interface PlayModel {
  weeklyReach: number;
  steps: { name: string; rate: number }[];
  monthlySpendUsd: number;
  ownerHoursPerWeek: number;
}
export interface Economics {
  revenuePerCustomerMonthUsd: number;
  grossMargin: number;
  monthsRetained: number;
  basis: string;
}
interface PlayLike {
  name: string;
  kind: string;
  p50: number;
  unit: string;
  horizonDays: number;
  model: PlayModel;
}

export const OWNER_HOUR_USD = 50;

export interface PlayMaths {
  name: string;
  kind: string;
  customers: number;
  costUsd: number;
  cacUsd: number | null;
  /** 12-month gross profit per customer. */
  valueUsd: number;
  /** Months to earn back the cost per customer. */
  paybackMonths: number | null;
  profitable: boolean;
}

export function customerValue(e: Economics): number {
  const margin = e.grossMargin > 1 ? e.grossMargin / 100 : e.grossMargin;
  return Math.max(0, e.revenuePerCustomerMonthUsd) * Math.min(Math.max(margin, 0), 1) * Math.min(Math.max(e.monthsRetained, 0), 12);
}

export function playMaths(p: PlayLike, e: Economics): PlayMaths {
  const weeks = Math.max(1, Math.round((p.horizonDays || 90) / 7));
  const conv = p.model.steps.reduce((acc, s) => acc * Math.min(Math.max(s.rate > 1 ? s.rate / 100 : s.rate, 0), 1), 1);
  const customers = Math.max(0, p.model.weeklyReach) * weeks * conv;
  const costUsd = Math.max(0, p.model.monthlySpendUsd) * (weeks / 4.33) + Math.max(0, p.model.ownerHoursPerWeek) * weeks * OWNER_HOUR_USD;
  const cacUsd = customers > 0 ? costUsd / customers : null;
  const valueUsd = customerValue(e);
  const monthlyGp = valueUsd / Math.max(1, Math.min(12, e.monthsRetained || 12));
  return { name: p.name, kind: p.kind, customers, costUsd, cacUsd, valueUsd, paybackMonths: cacUsd !== null && monthlyGp > 0 ? cacUsd / monthlyGp : null, profitable: cacUsd !== null && cacUsd <= valueUsd };
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const usd = (n: number | null) => (n === null ? "n/a" : `$${Math.round(n).toLocaleString("en-US")}`);

export function lintEconomics(out: { economics: Economics; plays: PlayLike[] }): LintIssue[] {
  const issues: LintIssue[] = [];
  const e = out.economics;
  if (!(e.revenuePerCustomerMonthUsd > 0) || !(e.monthsRetained > 0)) issues.push({ severity: "error", rule: "economics", message: "Give what one customer is worth: revenue per month, gross margin and months retained (facts first, else labelled assumptions).", path: "economics" });
  out.plays.forEach((p, i) => {
    const path = `plays[${i}]`;
    if (!p.model?.steps?.length || !(p.model.weeklyReach > 0)) {
      issues.push({ severity: "error", rule: "economics", message: "Give the play's model: weekly reach and each funnel step's most-likely rate.", path: `${path}.model` });
      return;
    }
    if (p.model.steps.some((s) => !(s.rate > 0) || s.rate > 1)) issues.push({ severity: "error", rule: "economics", message: "Step rates are shares between 0 and 1 (e.g. 0.03 for 3%).", path: `${path}.model.steps` });
    const m = playMaths(p, e);
    if (m.customers > 0 && (p.p50 > m.customers * 2 || p.p50 < m.customers / 2)) issues.push({ severity: "error", rule: "economics", message: `Your P50 is ${p.p50}, but your own numbers give ${r1(m.customers)} customers in ${p.horizonDays || 90} days. Make them agree.`, path: `${path}.p50` });
    if (!m.profitable && p.kind !== "moonshot") issues.push({ severity: "error", rule: "economics", message: `Loses money: cost per customer ${usd(m.cacUsd)} vs ${usd(m.valueUsd)} 12-month gross profit. Raise volume or conversion, cut cost, target higher-value customers, or drop it.`, path });
  });
  return issues;
}

/** The numbers the plan must use, computed here so it can't contradict them. */
export function lockedNumbers(out: { economics: Economics; plays: PlayLike[] }): string {
  const rows = out.plays.map((p) => playMaths(p, out.economics));
  const total = rows.reduce((s, r) => s + r.customers, 0);
  const cost = rows.reduce((s, r) => s + r.costUsd, 0);
  const spend = out.plays.reduce((s, p) => s + Math.max(0, p.model?.monthlySpendUsd ?? 0), 0);
  return [
    "LOCKED NUMBERS (computed by ClimbOS from the plays; use exactly these, never restate them differently):",
    `- One customer is worth ${usd(customerValue(out.economics))} gross profit over 12 months (${out.economics.basis}).`,
    ...rows.map((r) => `- ${r.name} (${r.kind}): ≈${r1(r.customers)} customers in 90 days, cost ${usd(r.costUsd)}, cost per customer ${usd(r.cacUsd)}, payback ${r.paybackMonths === null ? "n/a" : `${r1(r.paybackMonths)} months`}.`),
    `- TOTAL: ≈${r1(total)} customers in 90 days for ${usd(cost)} (cash spend ${usd(spend)}/month); blended cost per customer ${usd(total > 0 ? cost / total : null)}.`,
    `- North Star target = ≈${Math.round(total)} customers by day 90 (an estimate from these plays).`,
  ].join("\n");
}
