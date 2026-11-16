/**
 * Learning from a play's real results (spec §28): the owner logs reach and
 * how many passed each funnel step; code compares them with the plan and
 * updates each rate (the planned rate is a prior worth a few observations, so
 * early noise doesn't swing the plan).
 */
import type { PlayModel } from "../agents/economics";
import { betaPosterior, binomialCdf, probBelow } from "../analysis/bayes";
import { formatMinorMoney, isKnownCurrency, majorToMinor, minorToMajor } from "../economics/currency";
import { decimalToMinor } from "../integrations/currency";

/*
 * Decision books (2026-10-20):
 * - Time zero (Hernán & Robins Ch 22): weeks before the play started aren't its results.
 * - Missing weeks are unknown, not zero (Ch 8 selection; Ch 19 loss to follow-up): no "ahead" while the log has gaps.
 * - Scenario bounds are descriptive; a low count alone does not prove a failed intervention.
 *   Review observation quality and individual funnel steps before recommending a response.
 */
const WEEK = 7 * 86_400_000;

export interface ResultEntry {
  /** Monday of the week the counts cover (ms). */
  weekStart: number;
  reach: number;
  /** People passing each model step, in order (last = new customers). */
  steps: number[];
  spendUsd: number;
  /** Historical field name is not an assertion of USD; absent on ambiguous legacy reports. */
  spendCurrency?: string;
  ownerHours: number;
  /** Existing customers who repeated or renewed during this week; a customer may appear in multiple weeks. */
  repeatCustomers?: number;
  /** Owner-reported net repeat-customer receipts for the week, in the workspace currency's minor unit. */
  retainedRevenueMinor?: number;
  /** Owner-reported retained contribution after variable delivery costs, in the workspace currency's minor unit. */
  retainedContributionMinor?: number;
  retentionCurrency?: string;
}

export interface RetentionActuals {
  /** Weeks with at least one retention field reported. */
  weeksReported: number;
  /** Weeks with an explicit repeat-customer count; distinct from weeks reporting money. */
  repeatCustomerWeeksReported: number;
  /** Customer-weeks, not unique retained customers over the whole period. */
  repeatCustomerWeeks: number;
  revenueByCurrency: { currency: string; netRevenueMinor: number; weeksReported: number }[];
  contributionByCurrency: { currency: string; contributionMinor: number; weeksReported: number }[];
  limitations: string[];
}

/** Summarize owner-reported repeat-customer activity without mixing currencies or inferring causality. */
export function retentionActuals(entries: Pick<ResultEntry, "repeatCustomers" | "retainedRevenueMinor" | "retainedContributionMinor" | "retentionCurrency">[]): RetentionActuals {
  const weeks = entries.filter((entry) => entry.repeatCustomers !== undefined || entry.retainedRevenueMinor !== undefined || entry.retainedContributionMinor !== undefined);
  const revenue = new Map<string, { amount: number; weeks: number }>();
  const contribution = new Map<string, { amount: number; weeks: number }>();
  for (const entry of weeks) {
    const currency = entry.retentionCurrency?.toUpperCase();
    if (!currency) continue;
    if (entry.retainedRevenueMinor !== undefined) {
      const current = revenue.get(currency) ?? { amount: 0, weeks: 0 };
      current.amount += entry.retainedRevenueMinor;
      current.weeks++;
      revenue.set(currency, current);
    }
    if (entry.retainedContributionMinor !== undefined) {
      const current = contribution.get(currency) ?? { amount: 0, weeks: 0 };
      current.amount += entry.retainedContributionMinor;
      current.weeks++;
      contribution.set(currency, current);
    }
  }
  return {
    weeksReported: weeks.length,
    repeatCustomerWeeksReported: weeks.filter((entry) => entry.repeatCustomers !== undefined).length,
    repeatCustomerWeeks: weeks.reduce((sum, entry) => sum + (entry.repeatCustomers ?? 0), 0),
    revenueByCurrency: [...revenue].sort(([a], [b]) => a.localeCompare(b)).map(([currency, row]) => ({ currency, netRevenueMinor: row.amount, weeksReported: row.weeks })),
    contributionByCurrency: [...contribution].sort(([a], [b]) => a.localeCompare(b)).map(([currency, row]) => ({ currency, contributionMinor: row.amount, weeksReported: row.weeks })),
    limitations: ["Owner-reported play association is not proof of attribution or incremental impact.", "Repeat customer totals are customer-weeks; a person can be counted again in a later week.", "Only weeks with reported amounts are included; missing weeks are unknown."],
  };
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
  /** Whole units of spendCurrency, not an FX conversion. Unknown/incompatible money stays null. */
  spendUsd: number | null;
  spendCurrency: string | null;
  spendIssue: string | null;
  ownerHours: number;
  /** Customers the plan expected by now (P10/P50/P90 scaled to the weeks logged). */
  expectedByNow: { p10: number; p50: number; p90: number } | null;
  /** Scenario position is descriptive, not a statistical success/failure verdict. */
  comparisonNote?: string;
  horizonComplete?: boolean;
  status: "above_scenario" | "within_scenario" | "below_scenario" | "too_early" | "incomplete_log" | "forecast_unknown" | "partial_week";
  steps: StepActual[];
  /** Weekly reach actually achieved vs planned. */
  reachVsPlan: number | null;
  /** Weeks from the first week to the latest logged one; more than `weeks` means some weeks weren't logged. */
  weeksSinceStart: number;
  /** Elapsed plan weeks without a logged result; missing weeks are unknown, not zero. */
  unloggedWeeks: number;
  /** Logged weeks before the play's start (ignored). */
  ignoredBeforeStart: number;
  /** Last UTC reporting week included in the observation window. */
  throughWeek?: number;
  currentWeekIncluded?: boolean;
  comparisonIssue?: string | null;
}

export type CostCheckStatus = "within" | "above" | "no_spend" | "no_customers" | "value_unknown" | "spend_unknown";
export interface CostCheck {
  /** Logged cash spend ÷ logged new customers (owner time excluded); null with no customers or no spend. */
  cashCostPerCustomerUsd: number | null;
  /** What one customer contributes within the payback horizon (economics customerValue); null when unknown. */
  affordableUsd: number | null;
  status: CostCheckStatus;
}

/** Logged cash cost per customer against the affordable cost per customer; unknown stays unknown, never assumed. */
export function costCheck(a: Pick<PlayActuals, "spendUsd" | "customers">, affordableUsd: number | null | undefined): CostCheck {
  const affordable = typeof affordableUsd === "number" && Number.isFinite(affordableUsd) ? affordableUsd : null;
  if (a.spendUsd === null || !Number.isFinite(a.spendUsd) || a.spendUsd < 0) return { cashCostPerCustomerUsd: null, affordableUsd: affordable, status: "spend_unknown" };
  if (!(a.spendUsd > 0)) return { cashCostPerCustomerUsd: null, affordableUsd: affordable, status: "no_spend" };
  if (!(a.customers > 0)) return { cashCostPerCustomerUsd: null, affordableUsd: affordable, status: "no_customers" };
  const cost = a.spendUsd / a.customers;
  if (affordable === null) return { cashCostPerCustomerUsd: cost, affordableUsd: null, status: "value_unknown" };
  return { cashCostPerCustomerUsd: cost, affordableUsd: affordable, status: cost <= affordable + 1e-9 ? "within" : "above" };
}

/** How many observations the planned rate is worth. */
export const PRIOR_WEIGHT = 20;

/** Exact minor-unit sum; legacy names, today's settings and FX guesses cannot establish old units. */
function reportedSpend(entries: ResultEntry[], expectedCurrency?: string | null): Pick<PlayActuals, "spendUsd" | "spendCurrency" | "spendIssue"> {
  const unavailable = (spendIssue: string) => ({ spendUsd: null, spendCurrency: null, spendIssue });
  let totalMinor = 0;
  const currencies = new Set<string>();
  for (const entry of entries) {
    if (!Number.isFinite(entry.spendUsd) || entry.spendUsd < 0) return unavailable("Recorded spend is invalid; check the original weekly amounts.");
    if (entry.spendUsd === 0) continue;
    const currency = entry.spendCurrency?.trim().toUpperCase();
    if (!currency || !isKnownCurrency(currency)) return unavailable("Some recorded spending has no confirmed currency. Review the original amounts before comparing costs.");
    currencies.add(currency);
    if (currencies.size > 1) return unavailable("Recorded spending uses different currencies. No combined spend or cost comparison is available.");
    const parsed = decimalToMinor(String(entry.spendUsd), currency);
    if (!parsed.ok || !Number.isSafeInteger(totalMinor + parsed.minor)) return unavailable("Recorded spending has unsupported precision or an unsafe total; check the original amounts.");
    totalMinor += parsed.minor;
  }
  const currency = [...currencies][0] ?? (expectedCurrency && isKnownCurrency(expectedCurrency) ? expectedCurrency : null);
  if (totalMinor && expectedCurrency !== undefined && (!expectedCurrency || currency !== expectedCurrency)) return unavailable(`Recorded spending is in ${currency}; it cannot be compared with ${expectedCurrency || "an unknown workspace currency"}.`);
  return { spendUsd: totalMinor && currency ? minorToMajor(totalMinor, currency) : 0, spendCurrency: currency, spendIssue: null };
}

type SavedForecast = { p10?: number | null; p50?: number | null; p90?: number | null };
export function knownPlayForecast(f: SavedForecast): f is { p10: number; p50: number; p90: number } {
  return [f.p10, f.p50, f.p90].every(n => typeof n === "number" && Number.isFinite(n) && n >= 0)
    && f.p10! <= f.p50! && f.p50! <= f.p90!;
}

export function playActuals(model: PlayModel, all: ResultEntry[], forecast: SavedForecast, horizonWeeks = 13, opts: { startWeek?: number; currency?: string | null; throughWeek?: number; currentWeekIncluded?: boolean } = {}): PlayActuals {
  const entries = opts.startWeek !== undefined ? all.filter((e) => e.weekStart >= opts.startWeek!) : all;
  const starts = [...new Set(entries.map((e) => e.weekStart))].sort((a, b) => a - b);
  const weeks = starts.length;
  const first = opts.startWeek ?? starts[0];
  const last = Math.max(opts.throughWeek ?? -Infinity, starts[weeks - 1] ?? -Infinity);
  const weeksSinceStart = Number.isFinite(first) && Number.isFinite(last) ? Math.max(0, Math.round((last - first) / WEEK) + 1) : 0;
  const unloggedWeeks = Math.max(0, weeksSinceStart - weeks);
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
  const comparisonIssue = !knownPlayForecast(forecast) || !Number.isFinite(horizonWeeks) || horizonWeeks <= 0 ? "Original forecast unavailable; do not classify performance against an invented zero forecast."
    : unloggedWeeks > 0 ? "Forecast comparison unavailable while reporting weeks are missing."
    : opts.currentWeekIncluded ? "The current UTC week is still open; its report is provisional and cannot support a full-week forecast comparison."
    : weeksSinceStart > horizonWeeks ? "The reported window extends beyond the original forecast horizon; do not compare these totals with that shorter forecast."
    : null;
  const expectedByNow = !comparisonIssue && knownPlayForecast(forecast) ? { p10: forecast.p10 * f, p50: forecast.p50 * f, p90: forecast.p90 * f } : null;
  // Input scenarios are not probability intervals. Diagnosis of the shortfall is separate.
  const status: PlayActuals["status"] =
    unloggedWeeks > 0 ? "incomplete_log" : opts.currentWeekIncluded && knownPlayForecast(forecast) ? "partial_week" : !expectedByNow ? "forecast_unknown" : weeks < 2 ? "too_early" : customers > expectedByNow.p90 ? "above_scenario" : customers < expectedByNow.p10 ? "below_scenario" : "within_scenario";
  const comparisonNote = expectedByNow ? weeks < horizonWeeks
    ? "This is a proportional reference for the reported weeks, assuming even delivery. It does not model ramp-up or conversion delays and is not a validated probability range."
    : "This compares reported counts with the saved low, central and high scenarios. It does not establish statistical confidence, causal lift or success against an owner-approved test rule."
    : undefined;
  return {
    weeks,
    reach,
    customers,
    ...reportedSpend(entries, opts.currency),
    ownerHours: entries.reduce((s, e) => s + Math.max(0, e.ownerHours), 0),
    expectedByNow,
    ...(comparisonNote ? { comparisonNote } : {}),
    ...(Number.isFinite(horizonWeeks) && horizonWeeks > 0 ? { horizonComplete: weeksSinceStart >= horizonWeeks } : {}),
    status,
    steps,
    reachVsPlan: weeks > 0 && model.weeklyReach > 0 ? reach / weeks / model.weeklyReach : null,
    weeksSinceStart,
    unloggedWeeks,
    ignoredBeforeStart: all.length - entries.length,
    ...(Number.isFinite(last) && last >= first ? { throughWeek: last } : {}),
    currentWeekIncluded: opts.currentWeekIncluded ?? false,
    comparisonIssue,
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

/**
 * Coverage diagnostic for genuine 80% prediction intervals, not input scenarios.
 * Callers must establish compatible complete windows and the sampling assumptions;
 * P10/P90 field names alone do not establish them. Weekly growth scenarios do not
 * use this function. The binomial result does not establish causal business impact.
 */
export function forecastCalibration(rows: { customers: number; p10: number; p90: number }[]): { matured: number; inside: number; expected: number; pTooFew: number; verdict: "too_few_plays" | "overconfident" | "consistent" } {
  const n = rows.length;
  const inside = rows.filter((r) => r.customers >= r.p10 && r.customers <= r.p90).length;
  const pTooFew = n ? binomialCdf(inside, n, 0.8) : 1;
  return { matured: n, inside, expected: Math.round(n * 0.8 * 10) / 10, pTooFew: Math.round(pTooFew * 1000) / 1000, verdict: n < 3 ? "too_few_plays" : pTooFew <= 0.05 ? "overconfident" : "consistent" };
}

/** One line per play for the next plan: counts remain owner reports, not independently verified facts. */
export function resultsLine(name: string, a: PlayActuals): string {
  const rates = a.steps
    .filter((s) => s.trials > 0)
    .map((s) => `${s.name} ${s.successes}/${s.trials} (${Math.round((s.successes / s.trials) * 1000) / 10}%, planned ${Math.round(s.planned * 1000) / 10}%)`)
    .join("; ");
  const coverage = a.unloggedWeeks > 0 ? ` ${a.unloggedWeeks} elapsed week${a.unloggedWeeks === 1 ? " is" : "s are"} unlogged; missing weeks are unknown, not zero, so do not read this as a complete-period result.` : "";
  if (!a.weeks) return `${name}: no weekly results reported; customer counts, spending and hours are unknown.${coverage}`;
  const spend = a.spendUsd === null ? `spend unavailable (${a.spendIssue})` : a.spendUsd === 0 ? "explicitly reported no spend" : `spent ${formatMinorMoney(majorToMinor(a.spendUsd, a.spendCurrency), a.spendCurrency)} ${a.spendCurrency}`;
  return `${name}: ${a.weeks} week${a.weeks === 1 ? "" : "s"}, reached ${a.reach}, ${a.customers} new customers, ${spend}, ${Math.round(a.ownerHours)} owner hours.${coverage}${a.comparisonIssue ? ` ${a.comparisonIssue}` : ""} ${rates}.${a.expectedByNow ? ` Reported customers compared with the low/central/high scenario reference: ${a.customers} versus ${a.expectedByNow.p10}/${a.expectedByNow.p50}/${a.expectedByNow.p90}. ${a.comparisonNote ?? "Descriptive comparison only; not a calibrated probability interval."}` : ""}`;
}
