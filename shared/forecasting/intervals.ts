/**
 * Empirical (split-conformal-style) prediction intervals from backtest
 * residuals.
 *
 * Assumptions, stated plainly:
 *  - Out-of-sample errors at a given horizon step are roughly exchangeable
 *    over time (no regime change). Drift detection in forecast.ts flags
 *    obvious violations; it cannot prove the assumption holds.
 *  - Residuals from overlapping rolling origins are correlated, so the
 *    effective sample size is smaller than the raw count; the minimum-evidence
 *    thresholds are deliberately conservative.
 *  - Intervals are symmetric around the point forecast: point ± q, where q is
 *    the ceil((n+1)(1−alpha))-th smallest absolute residual in the bucket.
 */

import type { ResidualRecord } from "./backtest";

export interface IntervalCalibrationOptions {
  /** Out-of-sample residuals from {@link rollingOriginBacktest}. */
  residualRecords: readonly ResidualRecord[];
  /** Forecast horizon in days; intervals are produced for steps 1..horizon. */
  horizon: number;
  /** Number of days of history the residuals were derived from. */
  historyDays: number;
  /** Ordered dates of the history (used to locate the held-out segment). */
  historyDates: readonly string[];
  /** Steps per residual bucket (default 7 = weekly buckets). */
  bucketSize?: number;
  /** Minimum residuals required in every bucket (default 20). */
  minResidualsPerBucket?: number;
  /** Minimum days of history (default 56). */
  minHistoryDays?: number;
  /**
   * Trailing days reserved for the held-out coverage check (by residual
   * target date). Default max(28, round(0.2 · historyDays)). 0 disables.
   */
  heldOutDays?: number;
  /** Minimum held-out residuals to report coverage (default 20). */
  minHeldOut?: number;
  /** Clamp lower bounds at 0 (non-negative metrics). */
  nonNegative?: boolean;
}

export interface HeldOutCoverage {
  /** First target date in the held-out segment, or null when no hold-out was possible. */
  startDate: string | null;
  count: number;
  coverage80: number | null;
  coverage95: number | null;
  reason: string | null;
}

export type IntervalCalibration =
  | {
      status: "calibrated";
      bucketSize: number;
      /** Residuals per bucket used for calibration. */
      residualCounts: number[];
      /** Half-widths per step (index = step − 1), non-decreasing. */
      halfWidth80: number[];
      halfWidth95: number[];
      heldOut: HeldOutCoverage;
      reason: null;
    }
  | {
      status: "insufficient_evidence";
      bucketSize: number;
      residualCounts: number[];
      reason: string;
      heldOut: HeldOutCoverage;
    };

/**
 * Split-conformal quantile of absolute residuals: the k-th smallest value with
 * k = ceil((n+1)(1−alpha)). Returns null when k > n (too few residuals for
 * that coverage level).
 */
export function conformalQuantile(absResiduals: readonly number[], alpha: number): number | null {
  if (!(alpha > 0 && alpha < 1)) throw new RangeError("alpha must be in (0,1)");
  const n = absResiduals.length;
  if (n === 0) return null;
  const k = Math.ceil((n + 1) * (1 - alpha) - 1e-9);
  if (k > n) return null;
  const sorted = [...absResiduals].sort((a, b) => a - b);
  return sorted[Math.max(0, k - 1)];
}

/** Running maximum so interval half-widths never shrink with horizon. */
export function cumulativeMax(values: readonly number[]): number[] {
  const out: number[] = [];
  let m = -Infinity;
  for (const v of values) {
    m = Math.max(m, v);
    out.push(m);
  }
  return out;
}

function bucketCounts(records: readonly ResidualRecord[], horizon: number, bucketSize: number): number[] {
  const counts = new Array<number>(Math.ceil(horizon / bucketSize)).fill(0);
  for (const r of records) if (r.step <= horizon) counts[Math.floor((r.step - 1) / bucketSize)] += 1;
  return counts;
}

function noHeldOut(reason: string): HeldOutCoverage {
  return { startDate: null, count: 0, coverage80: null, coverage95: null, reason };
}

/**
 * Calibrate 80% and 95% intervals per horizon-step bucket. Returns
 * `insufficient_evidence` (with a human-readable reason and no numbers) when
 * history is shorter than `minHistoryDays` or any bucket has fewer than
 * `minResidualsPerBucket` residuals. When enough data exists, residuals whose
 * target date falls in the trailing held-out segment are excluded from
 * calibration and used to measure empirical coverage of the resulting
 * intervals; the published intervals are exactly the ones evaluated.
 */
export function calibrateIntervals(options: IntervalCalibrationOptions): IntervalCalibration {
  const bucketSize = options.bucketSize ?? 7;
  const minPerBucket = options.minResidualsPerBucket ?? 20;
  const minHistory = options.minHistoryDays ?? 56;
  const minHeldOut = options.minHeldOut ?? 20;
  const horizon = options.horizon;
  if (!Number.isInteger(horizon) || horizon < 1) throw new RangeError("horizon must be a positive integer");
  const relevant = options.residualRecords.filter((r) => r.step <= horizon);
  const allCounts = bucketCounts(relevant, horizon, bucketSize);

  if (options.historyDays < minHistory) {
    return {
      status: "insufficient_evidence",
      bucketSize,
      residualCounts: allCounts,
      reason: `Only ${options.historyDays} days of history; at least ${minHistory} are required before intervals can be calibrated.`,
      heldOut: noHeldOut("Not calibrated"),
    };
  }

  const heldOutDays =
    options.heldOutDays ?? Math.max(28, Math.round(0.2 * options.historyDays));
  const dates = options.historyDates;
  let heldOutStart: string | null =
    heldOutDays > 0 && heldOutDays < dates.length ? dates[dates.length - heldOutDays] : null;

  let calibration = heldOutStart === null ? relevant : relevant.filter((r) => r.targetDate < (heldOutStart as string));
  let counts = bucketCounts(calibration, horizon, bucketSize);
  let heldOutReason: string | null = null;
  if (heldOutStart !== null && counts.some((c) => c < minPerBucket)) {
    // Not enough data to also hold out a segment: calibrate on everything, report no coverage.
    heldOutStart = null;
    calibration = relevant;
    counts = allCounts;
    heldOutReason = "Not enough history to reserve a held-out segment; coverage is unverified.";
  } else if (heldOutStart === null) {
    heldOutReason = "Held-out check disabled or history too short.";
  }

  const weakest = counts.findIndex((c) => c < minPerBucket);
  if (weakest !== -1) {
    const fromStep = weakest * bucketSize + 1;
    const toStep = Math.min(horizon, (weakest + 1) * bucketSize);
    return {
      status: "insufficient_evidence",
      bucketSize,
      residualCounts: counts,
      reason: `Only ${counts[weakest]} backtest residuals for forecast days ${fromStep}–${toStep}; at least ${minPerBucket} are required. Collect more history or shorten the horizon.`,
      heldOut: noHeldOut("Not calibrated"),
    };
  }

  const byBucket: number[][] = counts.map(() => []);
  for (const r of calibration) byBucket[Math.floor((r.step - 1) / bucketSize)].push(Math.abs(r.residual));
  const q80Raw: number[] = [];
  const q95Raw: number[] = [];
  for (const abs of byBucket) {
    const q80 = conformalQuantile(abs, 0.2);
    const q95 = conformalQuantile(abs, 0.05);
    if (q80 === null || q95 === null) {
      return {
        status: "insufficient_evidence",
        bucketSize,
        residualCounts: counts,
        reason: "Too few residuals for a finite 95% conformal quantile.",
        heldOut: noHeldOut("Not calibrated"),
      };
    }
    q80Raw.push(q80);
    q95Raw.push(Math.max(q80, q95));
  }
  const q80b = cumulativeMax(q80Raw);
  const q95b = cumulativeMax(q95Raw);
  const halfWidth80: number[] = [];
  const halfWidth95: number[] = [];
  for (let s = 1; s <= horizon; s++) {
    const b = Math.floor((s - 1) / bucketSize);
    halfWidth80.push(q80b[b]);
    halfWidth95.push(q95b[b]);
  }

  let heldOut: HeldOutCoverage;
  if (heldOutStart === null) {
    heldOut = noHeldOut(heldOutReason ?? "No held-out segment.");
  } else {
    const start = heldOutStart;
    const held = relevant.filter((r) => r.targetDate >= start);
    if (held.length < minHeldOut) {
      heldOut = { ...noHeldOut(`Only ${held.length} held-out residuals; need ${minHeldOut}.`), startDate: start, count: held.length };
    } else {
      let in80 = 0;
      let in95 = 0;
      for (const r of held) {
        const w80 = halfWidth80[r.step - 1];
        const w95 = halfWidth95[r.step - 1];
        const lo80 = options.nonNegative ? Math.max(0, r.forecast - w80) : r.forecast - w80;
        const lo95 = options.nonNegative ? Math.max(0, r.forecast - w95) : r.forecast - w95;
        if (r.actual >= lo80 && r.actual <= r.forecast + w80) in80++;
        if (r.actual >= lo95 && r.actual <= r.forecast + w95) in95++;
      }
      heldOut = {
        startDate: start,
        count: held.length,
        coverage80: in80 / held.length,
        coverage95: in95 / held.length,
        reason: null,
      };
    }
  }

  return { status: "calibrated", bucketSize, residualCounts: counts, halfWidth80, halfWidth95, heldOut, reason: null };
}

export interface IntervalBounds {
  lo80: number;
  hi80: number;
  lo95: number;
  hi95: number;
}

/** Applies calibrated half-widths to point forecasts (index = step − 1). */
export function applyIntervals(
  points: readonly number[],
  calibration: Extract<IntervalCalibration, { status: "calibrated" }>,
  nonNegative = false,
): IntervalBounds[] {
  return points.map((p, i) => {
    const w80 = calibration.halfWidth80[i];
    const w95 = calibration.halfWidth95[i];
    const clamp = (x: number) => (nonNegative ? Math.max(0, x) : x);
    return { lo80: clamp(p - w80), hi80: p + w80, lo95: clamp(p - w95), hi95: p + w95 };
  });
}
