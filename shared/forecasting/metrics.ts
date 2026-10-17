/**
 * Forecast accuracy and interval-quality metrics. Inputs are aligned arrays
 * (actual[i] pairs with predicted[i]). Metrics that can have an invalid
 * denominator return `{ value: null, reason }` instead of Infinity/NaN.
 */

export interface MetricValue {
  value: number | null;
  /** Why `value` is null; null when the metric is defined. */
  reason: string | null;
}

function ok(value: number): MetricValue {
  return { value, reason: null };
}
function undefinedMetric(reason: string): MetricValue {
  return { value: null, reason };
}

function checkAligned(a: readonly number[], b: readonly number[], name: string): void {
  if (a.length !== b.length) throw new RangeError(`${name}: arrays must have equal length (${a.length} vs ${b.length})`);
  if (a.length === 0) throw new RangeError(`${name}: arrays must be non-empty`);
}

/** Mean absolute error. Scale-dependent; same units as the series. */
export function mae(actual: readonly number[], predicted: readonly number[]): number {
  checkAligned(actual, predicted, "mae");
  let s = 0;
  for (let i = 0; i < actual.length; i++) s += Math.abs(actual[i] - predicted[i]);
  return s / actual.length;
}

/** Root mean squared error. Penalises large misses more than MAE. */
export function rmse(actual: readonly number[], predicted: readonly number[]): number {
  checkAligned(actual, predicted, "rmse");
  let s = 0;
  for (let i = 0; i < actual.length; i++) s += (actual[i] - predicted[i]) ** 2;
  return Math.sqrt(s / actual.length);
}

/**
 * Weighted absolute percentage error: Σ|a−p| / Σ|a|. Robust to individual
 * zero days, but undefined (null) when every actual is zero.
 */
export function wape(actual: readonly number[], predicted: readonly number[]): MetricValue {
  checkAligned(actual, predicted, "wape");
  let num = 0;
  let den = 0;
  for (let i = 0; i < actual.length; i++) {
    num += Math.abs(actual[i] - predicted[i]);
    den += Math.abs(actual[i]);
  }
  if (den === 0) return undefinedMetric("WAPE undefined: sum of |actual| is 0 (invalid denominator)");
  return ok(num / den);
}

/**
 * In-sample MAE of the seasonal naive one-step forecast,
 * mean |y[t] − y[t−m]|; the MASE scale. Null when history ≤ m.
 */
export function seasonalNaiveScale(insample: readonly number[], seasonLength = 7): number | null {
  if (insample.length <= seasonLength) return null;
  let s = 0;
  for (let t = seasonLength; t < insample.length; t++) s += Math.abs(insample[t] - insample[t - seasonLength]);
  return s / (insample.length - seasonLength);
}

/**
 * Mean absolute scaled error: MAE / in-sample seasonal-naive MAE.
 * < 1 means better than the in-sample seasonal naive one-step error.
 * Null when the scale is 0 (perfectly repeating history) or unavailable.
 */
export function mase(
  actual: readonly number[],
  predicted: readonly number[],
  insample: readonly number[],
  seasonLength = 7,
): MetricValue {
  const scale = seasonalNaiveScale(insample, seasonLength);
  if (scale === null) return undefinedMetric(`MASE undefined: need more than ${seasonLength} in-sample points`);
  if (scale === 0) return undefinedMetric("MASE undefined: in-sample seasonal naive error is 0 (invalid scale)");
  return ok(mae(actual, predicted) / scale);
}

/** Share of actuals inside [lo, hi] (inclusive). */
export function intervalCoverage(actual: readonly number[], lo: readonly number[], hi: readonly number[]): number {
  checkAligned(actual, lo, "intervalCoverage");
  checkAligned(actual, hi, "intervalCoverage");
  let inside = 0;
  for (let i = 0; i < actual.length; i++) if (actual[i] >= lo[i] && actual[i] <= hi[i]) inside++;
  return inside / actual.length;
}

/** Mean of hi − lo. */
export function meanIntervalWidth(lo: readonly number[], hi: readonly number[]): number {
  checkAligned(lo, hi, "meanIntervalWidth");
  let s = 0;
  for (let i = 0; i < lo.length; i++) s += hi[i] - lo[i];
  return s / lo.length;
}

/**
 * Winkler / interval score for a (1 − alpha) central interval:
 * width + (2/alpha)·(lo − y) if y < lo, + (2/alpha)·(y − hi) if y > hi.
 * Lower is better; rewards narrow intervals and penalises misses. Mean over points.
 */
export function winklerScore(
  actual: readonly number[],
  lo: readonly number[],
  hi: readonly number[],
  alpha: number,
): number {
  if (!(alpha > 0 && alpha < 1)) throw new RangeError("winklerScore: alpha must be in (0,1)");
  checkAligned(actual, lo, "winklerScore");
  checkAligned(actual, hi, "winklerScore");
  let s = 0;
  for (let i = 0; i < actual.length; i++) {
    let score = hi[i] - lo[i];
    if (actual[i] < lo[i]) score += (2 / alpha) * (lo[i] - actual[i]);
    else if (actual[i] > hi[i]) score += (2 / alpha) * (actual[i] - hi[i]);
    s += score;
  }
  return s / actual.length;
}
