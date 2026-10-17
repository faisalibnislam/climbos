/**
 * Synthetic data for demos and tests ONLY. Output is fabricated by a seeded
 * generator and must never be presented as a customer's real data.
 */

import { createRng } from "./prng";
import { addDays, type DailyPoint } from "./series";

export interface SyntheticSeriesOptions {
  /** First date, "YYYY-MM-DD". Default "2024-01-01". */
  startDate?: string;
  days: number;
  /** Level on day 0. Default 100. */
  base?: number;
  /** Additive change in level per day. Default 0. */
  trendPerDay?: number;
  /**
   * Multiplicative weekly factors indexed by day offset mod 7 (day 0 = startDate).
   * Default [1.0, 1.1, 1.15, 1.1, 1.05, 0.85, 0.75].
   */
  weeklyFactors?: readonly number[];
  /** Gaussian noise standard deviation (additive). Default 5. */
  noiseSd?: number;
  /** Clamp values at 0. Default true. */
  nonNegative?: boolean;
  /** Round values to integers (count-like). Default false. */
  integer?: boolean;
  seed?: number;
}

/**
 * value[t] = (base + trendPerDay·t) · weeklyFactors[t mod 7] + Normal(0, noiseSd),
 * optionally clamped at 0 and rounded. Same options + seed ⇒ identical output.
 */
export function generateSyntheticDailySeries(options: SyntheticSeriesOptions): DailyPoint[] {
  const start = options.startDate ?? "2024-01-01";
  const base = options.base ?? 100;
  const trend = options.trendPerDay ?? 0;
  const factors = options.weeklyFactors ?? [1.0, 1.1, 1.15, 1.1, 1.05, 0.85, 0.75];
  if (factors.length !== 7) throw new RangeError("weeklyFactors must have 7 entries");
  const sd = options.noiseSd ?? 5;
  const nonNegative = options.nonNegative ?? true;
  const rng = createRng(options.seed ?? 42);
  const out: DailyPoint[] = [];
  for (let t = 0; t < options.days; t++) {
    let v = (base + trend * t) * factors[t % 7] + rng.normal(0, sd);
    if (nonNegative) v = Math.max(0, v);
    if (options.integer) v = Math.round(v);
    out.push({ date: addDays(start, t), value: v });
  }
  return out;
}
