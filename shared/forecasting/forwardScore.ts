import { addDays, sortSeries, validateSeries } from "./series";

/**
 * Score a saved forecast against the actual values recorded since it was made (forward, out-of-sample).
 * Only dates with both a forecast point and an observed value count; missing actuals stay missing, never zero.
 */

export interface ForwardScore {
  /** Forecast days that now have an observed value. */
  scoredDays: number;
  unavailableReason: string | null;
  horizonDays: number;
  /** "not_started" before any forecast day is observed; "partial" until the whole horizon is observed. */
  state: "not_started" | "partial" | "complete";
  actualTotal: number | null;
  forecastTotal: number | null;
  /** (actual − forecast) / absolute forecast over scored days; null when the forecast total is zero. */
  totalError: number | null;
  /** Mean absolute daily error. */
  meanAbsoluteError: number | null;
  /** Mean of (actual − forecast); positive means the forecast ran low. */
  bias: number | null;
  /** Days inside the 80% / 95% ranges, out of days that had that range. */
  inside80: { inside: number; of: number } | null;
  inside95: { inside: number; of: number } | null;
}

export function scoreForecast(
  points: readonly { date: string; value: number; lo80?: number; hi80?: number; lo95?: number; hi95?: number }[],
  actuals: readonly { date: string; value: number }[],
  horizonDays: number,
): ForwardScore {
  const empty = (reason: string | null): ForwardScore => ({ scoredDays: 0, horizonDays, state: "not_started", actualTotal: null, forecastTotal: null, totalError: null, meanAbsoluteError: null, bias: null, inside80: null, inside95: null, unavailableReason: reason });
  if (!Number.isInteger(horizonDays) || horizonDays < 1 || points.length > horizonDays) return empty("The saved forecast horizon is inconsistent; accuracy cannot be checked.");
  if (!validateSeries(points).ok || !validateSeries(actuals).ok) return empty("Invalid or duplicate daily observations must be reconciled before checking accuracy.");
  const chronological = sortSeries(points);
  if (chronological.some((p, i) => i > 0 && p.date !== addDays(chronological[i - 1].date, 1))) return empty("The saved forecast has missing calendar dates; its horizon cannot be checked reliably.");
  for (const p of points) {
    for (const [lo, hi] of [[p.lo80, p.hi80], [p.lo95, p.hi95]]) {
      if ((lo === undefined) !== (hi === undefined) || (lo !== undefined && hi !== undefined && (!Number.isFinite(lo) || !Number.isFinite(hi) || lo > hi))) return empty("The saved forecast ranges are invalid; accuracy cannot be checked.");
    }
  }
  const observed = new Map(actuals.map((a) => [a.date, a.value]));
  const pairs = points.flatMap((p) => (observed.has(p.date) ? [{ p, actual: observed.get(p.date)! }] : []));
  const n = pairs.length;
  if (!n) return empty(null);
  const actualTotal = pairs.reduce((s, x) => s + x.actual, 0);
  const forecastTotal = pairs.reduce((s, x) => s + x.p.value, 0);
  const range = (lo: "lo80" | "lo95", hi: "hi80" | "hi95") => {
    const withRange = pairs.filter((x) => x.p[lo] !== undefined && x.p[hi] !== undefined);
    return withRange.length ? { inside: withRange.filter((x) => x.actual >= x.p[lo]! && x.actual <= x.p[hi]!).length, of: withRange.length } : null;
  };
  return {
    scoredDays: n,
    unavailableReason: null,
    horizonDays,
    state: n === horizonDays ? "complete" : "partial",
    actualTotal,
    forecastTotal,
    totalError: forecastTotal !== 0 ? (actualTotal - forecastTotal) / Math.abs(forecastTotal) : null,
    meanAbsoluteError: pairs.reduce((s, x) => s + Math.abs(x.actual - x.p.value), 0) / n,
    bias: pairs.reduce((s, x) => s + (x.actual - x.p.value), 0) / n,
    inside80: range("lo80", "hi80"),
    inside95: range("lo95", "hi95"),
  };
}
