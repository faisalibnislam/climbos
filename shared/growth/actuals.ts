/**
 * Learning from a play's real results (spec §28): the owner logs reach and
 * how many passed each funnel step; code compares them with the plan and
 * updates each rate (the planned rate is a prior worth a few observations, so
 * early noise doesn't swing the plan).
 */
import type { PlayModel } from "../agents/economics";

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
}

/** How many observations the planned rate is worth. */
export const PRIOR_WEIGHT = 20;

export function playActuals(model: PlayModel, entries: ResultEntry[], forecast: { p10: number; p50: number; p90: number }, horizonWeeks = 13): PlayActuals {
  const weeks = new Set(entries.map((e) => e.weekStart)).size;
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
  // Judge on the leading step when customers are too few to say anything.
  const status: PlayActuals["status"] = weeks < 2 ? "too_early" : customers > expectedByNow.p90 ? "ahead" : customers < expectedByNow.p10 && leadingBehind(steps) ? "behind" : "on_track";
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
  };
}

/** The first step with enough data is clearly below its planned low (or half the plan when no low was given). */
function leadingBehind(steps: StepActual[]): boolean {
  const s = steps.find((x) => x.trials >= 30);
  if (!s || s.observed === null) return true;
  return s.observed < s.planned * 0.5;
}

/** One line per play for the next plan's brief: observed counts are first-party facts (grade A). */
export function resultsLine(name: string, a: PlayActuals): string {
  const rates = a.steps
    .filter((s) => s.trials > 0)
    .map((s) => `${s.name} ${s.successes}/${s.trials} (${Math.round((s.successes / s.trials) * 1000) / 10}%, planned ${Math.round(s.planned * 1000) / 10}%)`)
    .join("; ");
  return `${name}: ${a.weeks} week${a.weeks === 1 ? "" : "s"}, reached ${a.reach}, ${a.customers} new customers, spent $${Math.round(a.spendUsd)}, ${Math.round(a.ownerHours)} owner hours. ${rates}.`;
}
