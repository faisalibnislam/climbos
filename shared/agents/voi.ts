/**
 * What would change the decision, and what knowing it is worth (Hubbard, How to
 * Measure Anything, 3rd ed., Ch 6–7 and 14; Kochenderfer et al. Ch 6).
 *
 * - Switch value: the value of one input at which a play stops paying back,
 *   others held at their most-likely values. No probabilities needed, so it is
 *   computed for every input and shown as "pays back only if X ≥ s".
 * - Expected value of perfect information (EVPI) for one input: the expected
 *   loss of today's go/no-go call over that input's range. Computed only when
 *   the range carries a source (owner, research or benchmark), never on
 *   assumption ranges, and labelled "if the range is right" (the owner prompt
 *   forbids invented probabilities). The range is read as triangular
 *   (low, most-likely, high), the same shape the forecasts already simulate.
 * - Stop rule: after a pilot of n at the deciding step, stop when the
 *   successes are so few that the posterior mean (uniform prior) is below the
 *   switch value. Deterministic; no prior beyond the labelled uniform one.
 */
import { customerValue, playMaths, type Economics, type PlayLike } from "./economics";

export type InputKey = "reach" | `step:${number}` | "revenue" | "margin" | "churn" | "ownerHour";

export interface SwitchPoint {
  key: InputKey;
  /** Owner-facing name, e.g. "reply rate" or "monthly churn". */
  label: string;
  assumed: number;
  /** Value where the play breaks even; null when no value in the searched range flips it. */
  switchValue: number | null;
  /** Paying back needs the input at least (ge) or at most (le) the switch value. */
  direction: "ge" | "le";
  /** |switch − assumed| / assumed: how close the decision is to flipping on this input. */
  margin: number | null;
  /** Where the assumed value came from. */
  source: string;
  /** Expected loss of today's call over the sourced range; absent without a sourced range. */
  evpiUsd?: number;
  unit: "share" | "count_week" | "money_month";
}

const SOURCED = new Set(["owner", "research", "benchmark"]);

function net(p: PlayLike, e: Economics): number | null {
  const m = playMaths(p, e, { pointOnly: true });
  const value = customerValue(e);
  return value === null ? null : m.customers * value - m.costUsd;
}

/** A play with one input replaced. */
function withInput(p: PlayLike, e: Economics, key: InputKey, v: number): { p: PlayLike; e: Economics } {
  if (key === "reach") return { p: { ...p, model: { ...p.model, weeklyReach: v } }, e };
  if (key.startsWith("step:")) {
    const i = Number(key.slice(5));
    return { p: { ...p, model: { ...p.model, steps: p.model.steps.map((s, j) => (j === i ? { ...s, rate: v } : s)) } }, e };
  }
  if (key === "revenue") return { p, e: { ...e, revenuePerCustomerMonthUsd: v } };
  if (key === "margin") return { p, e: { ...e, grossMargin: v } };
  if (key === "churn") return { p, e: { ...e, monthlyChurn: v, monthsRetained: undefined } };
  return { p, e: { ...e, ownerHourUsd: v } };
}

/** Bisection for the break-even value on [lo, hi]; null when net doesn't change sign there. */
function solve(f: (v: number) => number | null, lo: number, hi: number): number | null {
  const a = f(lo);
  const b = f(hi);
  if (a === null || b === null || Math.sign(a) === Math.sign(b) || a === 0 || b === 0) return a === 0 ? lo : b === 0 ? hi : null;
  let l = lo;
  let h = hi;
  for (let i = 0; i < 60; i++) {
    const mid = (l + h) / 2;
    const fm = f(mid)!;
    if (Math.sign(fm) === Math.sign(a)) l = mid;
    else h = mid;
  }
  return (l + h) / 2;
}

/** Expected max(0, ±net) over a triangular range (401-point midpoint grid; deterministic). */
function expectedLoss(f: (v: number) => number | null, lo: number, mode: number, hi: number, go: boolean): number | null {
  if (!(hi > lo)) return 0;
  const m = Math.min(Math.max(mode, lo), hi);
  const N = 401;
  let sum = 0;
  let w = 0;
  for (let i = 0; i < N; i++) {
    const x = lo + ((i + 0.5) / N) * (hi - lo);
    const d = x < m ? (2 * (x - lo)) / ((hi - lo) * (m - lo || 1e-12)) : (2 * (hi - x)) / ((hi - lo) * (hi - m || 1e-12));
    const v = f(x);
    if (v === null) return null;
    sum += d * (go ? Math.max(0, -v) : Math.max(0, v));
    w += d;
  }
  return w > 0 ? sum / w : 0;
}

/** Every input's switch value for one play, nearest flip first; EVPI where a sourced range exists. */
export function switchPoints(p: PlayLike, e: Economics): SwitchPoint[] {
  if (!p.model?.steps?.length || customerValue(e) === null) return [];
  const base = net(p, e);
  if (base === null) return [];
  const go = base >= 0;
  const out: SwitchPoint[] = [];
  const add = (key: InputKey, label: string, assumed: number, lo: number, hi: number, unit: SwitchPoint["unit"], source: string, range?: { low?: number; high?: number }) => {
    const f = (v: number) => {
      const w = withInput(p, e, key, v);
      return net(w.p, w.e);
    };
    const s = solve(f, lo, hi);
    const up = f(Math.min(hi, assumed * 1.01 + 1e-9));
    const direction: "ge" | "le" = up !== null && up >= base ? "ge" : "le";
    const sp: SwitchPoint = { key, label, assumed, switchValue: s, direction, margin: s === null || !(assumed > 0) ? null : Math.abs(s - assumed) / assumed, source, unit };
    if (range && SOURCED.has(source) && range.low !== undefined && range.high !== undefined && range.high > range.low) {
      const l = expectedLoss(f, range.low, assumed, range.high, go);
      if (l !== null) sp.evpiUsd = Math.round(l * 100) / 100;
    }
    out.push(sp);
  };
  const m = p.model;
  add("reach", "weekly reach", m.weeklyReach, 0, Math.max(1, m.weeklyReach) * 50, "count_week", m.reachSource?.source ?? "unlabelled", { low: m.weeklyReachLow, high: m.weeklyReachHigh });
  m.steps.forEach((s, i) => add(`step:${i}`, `${s.name} rate`, s.rate, 0, 1, "share", s.source ?? "unlabelled", { low: s.low, high: s.high }));
  const src = e.sources ?? {};
  // Owner ranges (their own 90% range) are the only economics ranges value of information uses.
  add("revenue", "revenue per customer a month", e.revenuePerCustomerMonthUsd, 0, Math.max(1, e.revenuePerCustomerMonthUsd) * 50, "money_month", src.revenue?.source ?? "unlabelled", e.ranges?.revenue);
  add("margin", "contribution margin", e.grossMargin, 0, 1, "share", src.margin?.source ?? "unlabelled", e.ranges?.margin);
  if (typeof e.monthlyChurn === "number" || e.monthsRetained) add("churn", "monthly churn", e.monthlyChurn ?? 1 / (e.monthsRetained as number), 0, 0.99, "share", src.churn?.source ?? "unlabelled", e.ranges?.churn);
  if (m.ownerHoursPerWeek > 0) add("ownerHour", "value of an owner hour", e.ownerHourUsd ?? 50, 0, Math.max(50, e.ownerHourUsd ?? 50) * 50, "money_month", e.ownerHourUsd ? "owner" : "assumption");
  return out.sort((a, b) => (b.evpiUsd ?? -1) - (a.evpiUsd ?? -1) || (a.margin ?? Infinity) - (b.margin ?? Infinity));
}

/**
 * The stop rule for a pilot at one step: after `trials` reach the step, stop when successes ≤ k,
 * where k is the largest count whose posterior mean (k+1)/(trials+2) is below the switch rate.
 * null when even zero successes can't show the play fails at this size (the pilot is too small to decide).
 */
export function stopRule(trials: number, switchRate: number): { trials: number; stopAtOrBelow: number } | null {
  if (!(trials >= 1) || !(switchRate > 0 && switchRate < 1)) return null;
  const n = Math.floor(trials);
  const k = Math.ceil(switchRate * (n + 2) - 1) - 1;
  return k >= 0 ? { trials: n, stopAtOrBelow: k } : null;
}

const pc = (x: number) => `${Math.round(x * 1000) / 10}%`;
export function fmtInput(s: Pick<SwitchPoint, "unit">, v: number, money: (n: number) => string): string {
  return s.unit === "share" ? pc(v) : s.unit === "money_month" ? money(v) : `${Math.round(v)}`;
}

/** One locked line per play: what decides it, what knowing it is worth, and the computed stop rule. */
export function decidesLine(p: PlayLike, e: Economics, money: (n: number) => string): string | null {
  const sps = switchPoints(p, e).filter((s) => s.switchValue !== null && s.margin !== null);
  const top = sps[0];
  if (!top || top.switchValue === null) return null;
  const cmp = top.direction === "ge" ? "at least" : "at most";
  const worth = top.evpiUsd !== undefined && top.evpiUsd > 0 ? `; knowing it first is worth up to ${money(top.evpiUsd)} if its stated range is right` : "";
  let stop = "";
  if (top.key.startsWith("step:") && top.direction === "ge") {
    const i = Number(top.key.slice(5));
    const reachAtStep = p.model.weeklyReach * 2 * p.model.steps.slice(0, i).reduce((a, s) => a * s.rate, 1);
    const r = stopRule(reachAtStep, top.switchValue);
    stop = r ? `. Computed stop rule: after about ${r.trials} reach "${p.model.steps[i].name}" (2 weeks), stop if ${r.stopAtOrBelow} or fewer pass` : ". Two weeks is too small to show it fails at this step; judge it at the planned end";
  }
  return `  Decides it: pays back only if ${top.label} is ${cmp} ${fmtInput(top, top.switchValue, money)} (assumed ${fmtInput(top, top.assumed, money)}, ${top.source})${worth}${stop}.`;
}
