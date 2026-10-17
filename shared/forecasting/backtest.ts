/**
 * Rolling-origin (time-series cross-validation) backtesting.
 *
 * For each origin index o (the first evaluation day), the forecaster sees ONLY
 * points strictly before o, forecasts forward, and is scored against the
 * actuals. A seasonal-naive baseline is scored on exactly the same windows.
 * A leakage guard runs on every origin and throws if any training date is on
 * or after the first evaluation date.
 */

import { type ForecastMethod, type Forecaster, getForecaster, minHistoryFor, seasonalNaive } from "./baselines";
import type { MetricValue } from "./metrics";
import { type DailyPoint, assertContiguous, assertNoLeakage, assertValidSeries } from "./series";

export interface BacktestOptions {
  /** Contiguous daily series (no gaps; fill explicitly first). */
  series: readonly DailyPoint[];
  /** Named method or custom forecaster. */
  method: ForecastMethod | Forecaster;
  /** Horizons (days) to summarise. Default [7, 30, 90]. */
  horizons?: readonly number[];
  /** Season length for seasonal naive and MASE scaling. Default 7. */
  seasonLength?: number;
  /** Moving-average window (moving_average only). Defaults to seasonLength. */
  window?: number;
  /** Minimum training days before the first origin. Default max(28, 2·seasonLength + 1). */
  minTrainDays?: number;
  /** Days between consecutive origins. Default 1. */
  step?: number;
  /** Collect residuals for steps 1..residualHorizon. Default max(horizons). */
  residualHorizon?: number;
}

/** One out-of-sample error: residual = actual − forecast. */
export interface ResidualRecord {
  originDate: string;
  targetDate: string;
  /** 1-based steps ahead. */
  step: number;
  actual: number;
  forecast: number;
  residual: number;
}

export interface AccuracySummary {
  mae: number | null;
  wape: MetricValue;
  mase: MetricValue;
}

export interface HorizonSummary extends AccuracySummary {
  horizon: number;
  /** Origins with a complete `horizon`-day evaluation window. */
  origins: number;
  baseline: AccuracySummary;
  /** True if method MAE < seasonal-naive MAE on identical windows; null if no origins. */
  beatsBaseline: boolean | null;
}

export interface BacktestResult {
  method: string;
  seasonLength: number;
  minTrainDays: number;
  step: number;
  originDates: string[];
  byHorizon: HorizonSummary[];
  /** residualsByStep[h-1] = residuals at h steps ahead, in origin order. */
  residualsByStep: number[][];
  residualRecords: ResidualRecord[];
}

interface Accumulator {
  origins: number;
  points: number;
  absErr: number;
  absActual: number;
  scaledSum: number;
  scaledCount: number;
}

function newAcc(): Accumulator {
  return { origins: 0, points: 0, absErr: 0, absActual: 0, scaledSum: 0, scaledCount: 0 };
}

function summarise(acc: Accumulator): AccuracySummary {
  if (acc.points === 0) {
    const reason = "No complete evaluation windows";
    return { mae: null, wape: { value: null, reason }, mase: { value: null, reason } };
  }
  return {
    mae: acc.absErr / acc.points,
    wape:
      acc.absActual === 0
        ? { value: null, reason: "WAPE undefined: sum of |actual| is 0 (invalid denominator)" }
        : { value: acc.absErr / acc.absActual, reason: null },
    mase:
      acc.scaledCount === 0
        ? { value: null, reason: "MASE undefined: in-sample seasonal naive error is 0 at every origin" }
        : { value: acc.scaledSum / acc.scaledCount, reason: null },
  };
}

/**
 * Run a rolling-origin backtest. Assumes a contiguous, validated daily series.
 * MASE at each origin is scaled by the seasonal-naive in-sample MAE of that
 * origin's training window only (no future information), then averaged.
 */
export function rollingOriginBacktest(options: BacktestOptions): BacktestResult {
  const series = assertValidSeries(options.series);
  assertContiguous(series);
  const horizons = [...(options.horizons ?? [7, 30, 90])].sort((a, b) => a - b);
  for (const h of horizons) if (!Number.isInteger(h) || h < 1) throw new RangeError(`Invalid horizon ${h}`);
  const m = options.seasonLength ?? 7;
  const step = options.step ?? 1;
  if (!Number.isInteger(step) || step < 1) throw new RangeError("step must be a positive integer");
  const methodName = typeof options.method === "string" ? options.method : "custom";
  const forecaster: Forecaster =
    typeof options.method === "string" ? getForecaster(options.method, m, options.window ?? m) : options.method;
  const methodMin = typeof options.method === "string" ? minHistoryFor(options.method, m, options.window ?? m) : 1;
  const minTrainDays = Math.max(options.minTrainDays ?? Math.max(28, 2 * m + 1), methodMin, m);
  const residualHorizon = options.residualHorizon ?? (horizons.length ? horizons[horizons.length - 1] : 0);
  const maxNeeded = Math.max(residualHorizon, horizons.length ? horizons[horizons.length - 1] : 0);

  const values = series.map((p) => p.value);
  const n = values.length;

  // Prefix sums of |y[t] - y[t-m]| for O(1) MASE scale per origin.
  const seasonalAbs = new Array<number>(n + 1).fill(0);
  for (let t = 0; t < n; t++) {
    seasonalAbs[t + 1] = seasonalAbs[t] + (t >= m ? Math.abs(values[t] - values[t - m]) : 0);
  }

  const methodAcc = horizons.map(() => newAcc());
  const baseAcc = horizons.map(() => newAcc());
  const residualsByStep: number[][] = Array.from({ length: residualHorizon }, () => []);
  const residualRecords: ResidualRecord[] = [];
  const originDates: string[] = [];

  for (let o = minTrainDays; o < n; o += step) {
    const train = series.slice(0, o);
    assertNoLeakage(train, series[o].date);
    const trainValues = values.slice(0, o);
    const hMax = Math.min(maxNeeded, n - o);
    if (hMax < 1) break;
    const fc = forecaster(trainValues, hMax);
    const base = seasonalNaive(trainValues, hMax, m);
    originDates.push(series[o].date);

    const rSteps = Math.min(residualHorizon, hMax);
    for (let s = 1; s <= rSteps; s++) {
      const actual = values[o + s - 1];
      const residual = actual - fc[s - 1];
      residualsByStep[s - 1].push(residual);
      residualRecords.push({
        originDate: series[o].date,
        targetDate: series[o + s - 1].date,
        step: s,
        actual,
        forecast: fc[s - 1],
        residual,
      });
    }

    const scale = o > m ? seasonalAbs[o] / (o - m) : 0;
    horizons.forEach((H, idx) => {
      if (o + H > n) return;
      let errM = 0;
      let errB = 0;
      let absA = 0;
      for (let s = 0; s < H; s++) {
        const a = values[o + s];
        errM += Math.abs(a - fc[s]);
        errB += Math.abs(a - base[s]);
        absA += Math.abs(a);
      }
      for (const [acc, err] of [
        [methodAcc[idx], errM],
        [baseAcc[idx], errB],
      ] as const) {
        acc.origins += 1;
        acc.points += H;
        acc.absErr += err;
        acc.absActual += absA;
        if (scale > 0) {
          acc.scaledSum += err / H / scale;
          acc.scaledCount += 1;
        }
      }
    });
  }

  const byHorizon: HorizonSummary[] = horizons.map((H, idx) => {
    const mSum = summarise(methodAcc[idx]);
    const bSum = summarise(baseAcc[idx]);
    return {
      horizon: H,
      origins: methodAcc[idx].origins,
      ...mSum,
      baseline: bSum,
      beatsBaseline: mSum.mae === null || bSum.mae === null ? null : mSum.mae < bSum.mae,
    };
  });

  return { method: methodName, seasonLength: m, minTrainDays, step, originDates, byHorizon, residualsByStep, residualRecords };
}
