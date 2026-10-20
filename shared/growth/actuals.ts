/**
 * Learning from a play's real results (spec §28): the owner logs reach and
 * how many passed each funnel step; code compares them with the plan and
 * updates each rate (the planned rate is a prior worth a few observations, so
 * early noise doesn't swing the plan).
 */
import type { PlayModel } from "../agents/economics";
import { betaPosterior, binomialCdf, poissonCdf, probBelow } from "../analysis/bayes";

/*
 * Decision books (2026-10-20):
 * - Time zero (Hernán & Robins Ch 22): weeks before the play started aren't its results.
 * - Missing weeks are unknown, not zero (Ch 8 selection; Ch 19 loss to follow-up): no "ahead" while the log has gaps.
 * - Noise (Downey Ch 7, Kochenderfer §4.2): "behind" needs the count to be unlikely under the plan
 *   (Poisson, P ≤ 5% averaged over the plan's range) or a leading step that is clearly short; 2 customers against 4 expected is normal noise.
 */
const WEEK = 7 * 86_400_000;

export interface ResultEntry {
  /** Monday of the week the counts cover (ms). */
  weekStart: number;
  reach: number;
  /** People passing each model step, in order (last = new customers). */
  steps: number[];
  spendUsd: number;
  ownerHours: number;
}

export interface StepActual {
  name: string;
  planned: number;
  /** Observed share, or null until something reached the step. */
  observed: number | null;
  trials: number;
  successes: number;
  /** Planned rate updated with what happened (Beta posterior mean). */
  updated: number;
}

export interface PlayActuals {
  weeks: number;
  reach: number;
  customers: number;
  spendUsd: number;
  ownerHours: number;
  /** Customers the plan expected by now (P10/P50/P90 scaled to the weeks logged). */
  expectedByNow: { p10: number; p50: number; p90: number };
  status: "ahead" | "on_track" | "behind" | "too_early";
  steps: StepActual[];
  /** Weekly reach actually achieved vs planned. */
  reachVsPlan: number | null;
  /** Weeks from the first week to the latest logged one; more than `weeks` means some weeks weren't logged. */
  weeksSinceStart: number;
  /** Logged weeks before the play's start (ignored). */
  ignoredBeforeStart: number;
}

/** How many observations the planned rate is worth. */
export const PRIOR_WEIGHT = 20;

export function playActuals(model: PlayModel, all: ResultEntry[], forecast: { p10: number; p50: number; p90: number }, horizonWeeks = 13, opts: { startWeek?: number } = {}): PlayActuals {
  const entries = opts.startWeek !== undefined ? all.filter((e) => e.weekStart >= opts.startWeek!) : all;
  const starts = [...new Set(entries.map((e) => e.weekStart))].sort((a, b) => a - b);
  const weeks = starts.length;
  const first = opts.startWeek ?? starts[0];
  const weeksSinceStart = weeks ? Math.round((starts[weeks - 1] - first) / WEEK) + 1 : 0;
  const reach = entries.reduce((s, e) => s + Math.max(0, e.reach), 0);
  const stepSums = model.steps.map((_, i) => entries.reduce((s, e) => s + Math.max(0, e.steps[i] ?? 0), 0));
  const steps: StepActual[] = model.steps.map((st, i) => {
    const trials = i === 0 ? reach : stepSums[i - 1];
    const successes = Math.min(stepSums[i], trials);
    const planned = st.rate;
    return { name: st.name, planned, observed: trials > 0 ? successes / trials : null, trials, successes, updated: (planned * PRIOR_WEIGHT + successes) / (PRIOR_WEIGHT + trials) };
  });
  const customers = stepSums[stepSums.length - 1] ?? 0;
  const f = Math.min(1, weeks / Math.max(1, horizonWeeks));
  const expectedByNow = { p10: forecast.p10 * f, p50: forecast.p50 * f, p90: forecast.p90 * f };
  // Behind only when the count is unlikely under the plan (not just below P10), and the leading step agrees.
  // The plan's own rate is uncertain too (Kochenderfer Ex 4.1): average the Poisson tail over its P10/P50/P90.
  const lams = [expectedByNow.p10, expectedByNow.p50, expectedByNow.p90].filter((l) => l > 0);
  const avg = (fn: (l: number) => number) => (lams.length ? lams.reduce((s, l) => s + fn(l), 0) / lams.length : 1);
  const surprisinglyLow = lams.length > 0 && avg((l) => poissonCdf(customers, l)) <= 0.05;
  const surprisinglyHigh = lams.length ? avg((l) => 1 - poissonCdf(customers - 1, l)) <= 0.05 : customers > 0;
  const gaps = weeksSinceStart > weeks;
  const status: PlayActuals["status"] =
    weeks < 2 ? "too_early" : customers > expectedByNow.p90 && surprisinglyHigh && !gaps ? "ahead" : customers < expectedByNow.p10 && (leading(steps) === "short" || (surprisinglyLow && leading(steps) === "thin")) ? "behind" : "on_track";
  return {
    weeks,
    reach,
    customers,
    spendUsd: entries.reduce((s, e) => s + Math.max(0, e.spendUsd), 0),
    ownerHours: entries.reduce((s, e) => s + Math.max(0, e.ownerHours), 0),
    expectedByNow,
    status,
    steps,
    reachVsPlan: weeks > 0 && model.weeklyReach > 0 ? reach / weeks / model.weeklyReach : null,
    weeksSinceStart,
    ignoredBeforeStart: all.length - entries.length,
  };
}

/** A step is clearly short: well under plan (under half) AND at least 95% likely to be below plan on its counts. */
export function stepClearlyShort(s: Pick<StepActual, "planned" | "successes" | "trials">): boolean {
  if (!(s.trials > 0) || !(s.planned > 0)) return false;
  return s.successes / s.trials < s.planned * 0.5 && probBelow(betaPosterior(s.successes, s.trials), s.planned) >= 0.95;
}

/** The counts can't yet rule out a big shortfall or confirm one (posterior too wide). */
export function stepTooThin(s: Pick<StepActual, "planned" | "successes" | "trials">): boolean {
  if (!(s.trials > 0)) return true;
  return !stepClearlyShort(s) && probBelow(betaPosterior(s.successes, s.trials), s.planned * 0.5) >= 0.1;
}

/** The first step that can be judged: clearly short, fine, or none judgeable yet ("thin": then the customer count decides). */
function leading(steps: StepActual[]): "short" | "ok" | "thin" {
  const s = steps.find((x) => !stepTooThin(x));
  if (!s) return "thin";
  return stepClearlyShort(s) ? "short" : "ok";
}

/**
 * Forecast calibration (Hubbard Ch 5; Kochenderfer Ch 14): of the plays that ran their full horizon with every
 * week logged, how many landed inside their P10–P90 range? That band is an 80% range, so about 80% should.
 * A low count means ranges were too narrow (overconfident); the next plan should say so. Predictions were saved
 * with the plan before results, so this compares honestly.
 */
export function forecastCalibration(rows: { customers: number; p10: number; p90: number }[]): { matured: number; inside: number; expected: number; pTooFew: number; verdict: "too_few_plays" | "overconfident" | "consistent" } {
  const n = rows.length;
  const inside = rows.filter((r) => r.customers >= r.p10 && r.customers <= r.p90).length;
  const pTooFew = n ? binomialCdf(inside, n, 0.8) : 1;
  return { matured: n, inside, expected: Math.round(n * 0.8 * 10) / 10, pTooFew: Math.round(pTooFew * 1000) / 1000, verdict: n < 3 ? "too_few_plays" : pTooFew <= 0.05 ? "overconfident" : "consistent" };
}

/** One line per play for the next plan's brief: observed counts are first-party facts (grade A). */
export function resultsLine(name: string, a: PlayActuals): string {
  const rates = a.steps
    .filter((s) => s.trials > 0)
    .map((s) => `${s.name} ${s.successes}/${s.trials} (${Math.round((s.successes / s.trials) * 1000) / 10}%, planned ${Math.round(s.planned * 1000) / 10}%)`)
    .join("; ");
  return `${name}: ${a.weeks} week${a.weeks === 1 ? "" : "s"}, reached ${a.reach}, ${a.customers} new customers, spent $${Math.round(a.spendUsd)}, ${Math.round(a.ownerHours)} owner hours. ${rates}.`;
}
