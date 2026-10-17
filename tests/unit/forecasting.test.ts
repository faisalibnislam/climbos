import { describe, expect, it } from "vitest";
import {
  assertNoLeakage,
  compareScenarios,
  conformalQuantile,
  createRng,
  drift,
  fillMissingDays,
  generateSyntheticDailySeries,
  LeakageError,
  mase,
  movingAverage,
  naive,
  rollingOriginBacktest,
  runForecast,
  seasonalNaive,
  simulateFunnel,
  splitChronological,
  wape,
  winklerScore,
  type DailyPoint,
} from "../../shared/forecasting";

describe("prng", () => {
  it("is reproducible with the same seed and differs across seeds", () => {
    const draw = (seed: number) => {
      const r = createRng(seed);
      return [r.next(), r.normal(), r.gamma(2.5), r.beta(2, 3), r.binomial(20, 0.3), r.binomial(10000, 0.05), r.poisson(4), r.poisson(500)];
    };
    expect(draw(123)).toEqual(draw(123));
    expect(draw(123)).not.toEqual(draw(124));
  });

  it("produces sensible moments", () => {
    const r = createRng(7);
    const n = 20000;
    let sN = 0;
    let sB = 0;
    let sG = 0;
    for (let i = 0; i < n; i++) {
      sN += r.normal(10, 2);
      sB += r.beta(2, 8);
      sG += r.gamma(0.5, 2);
    }
    expect(sN / n).toBeCloseTo(10, 1);
    expect(sB / n).toBeCloseTo(0.2, 2);
    expect(sG / n).toBeCloseTo(1, 1);
  });

  it("synthetic series is reproducible", () => {
    const a = generateSyntheticDailySeries({ days: 30, seed: 9 });
    const b = generateSyntheticDailySeries({ days: 30, seed: 9 });
    expect(a).toEqual(b);
  });
});

describe("series", () => {
  const pts: DailyPoint[] = [
    { date: "2025-01-03", value: 3 },
    { date: "2025-01-01", value: 1 },
    { date: "2025-01-05", value: 5 },
  ];

  it("reports missing days without inventing values by default", () => {
    const r = fillMissingDays(pts);
    expect(r.missingDates).toEqual(["2025-01-02", "2025-01-04"]);
    expect(r.series.map((p) => p.date)).toEqual(["2025-01-01", "2025-01-03", "2025-01-05"]);
    const z = fillMissingDays(pts, "zero_fill_known_count");
    expect(z.series).toHaveLength(5);
    expect(z.series[1]).toEqual({ date: "2025-01-02", value: 0 });
  });

  it("rejects duplicate dates and non-finite values", () => {
    expect(() => fillMissingDays([...pts, { date: "2025-01-01", value: 2 }])).toThrow(/Duplicate/);
    expect(() => fillMissingDays([{ date: "2025-01-01", value: Number.NaN }])).toThrow(/Non-finite/);
  });

  it("splits chronologically and the leakage guard throws when misused", () => {
    const { train, test } = splitChronological(pts, "2025-01-03");
    expect(train.map((p) => p.date)).toEqual(["2025-01-01"]);
    expect(test.map((p) => p.date)).toEqual(["2025-01-03", "2025-01-05"]);
    expect(() => assertNoLeakage(pts, "2025-01-03")).toThrow(LeakageError);
    expect(() => assertNoLeakage(train, test[0].date)).not.toThrow();
  });

  it("backtest refuses series with gaps", () => {
    expect(() => rollingOriginBacktest({ series: pts, method: "naive" })).toThrow(/missing/);
  });
});

describe("baselines", () => {
  it("seasonal naive repeats the last season", () => {
    const hist = [1, 2, 3, 4, 5, 6, 7, 10, 20, 30, 40, 50, 60, 70];
    expect(seasonalNaive(hist, 9)).toEqual([10, 20, 30, 40, 50, 60, 70, 10, 20]);
    expect(seasonalNaive([1, 2, 3, 4], 3, 2)).toEqual([3, 4, 3]);
  });
  it("naive, drift and moving average", () => {
    expect(naive([1, 5], 2)).toEqual([5, 5]);
    expect(drift([0, 2, 4], 2)).toEqual([6, 8]);
    expect(movingAverage([1, 2, 3, 4], 2, 2)).toEqual([3.5, 3.5]);
  });
});

describe("metrics", () => {
  it("WAPE is null with a reason when the denominator is 0", () => {
    const r = wape([0, 0, 0], [1, 2, 3]);
    expect(r.value).toBeNull();
    expect(r.reason).toMatch(/denominator/);
    expect(wape([2, 2], [1, 3]).value).toBeCloseTo(0.5);
  });
  it("MASE null when scale is 0", () => {
    expect(mase([1], [1], [5, 5, 5, 5], 1).value).toBeNull();
    expect(mase([3], [1], [1, 2, 3, 4], 1).value).toBeCloseTo(2);
  });
  it("Winkler score penalises misses", () => {
    expect(winklerScore([5], [4], [6], 0.2)).toBe(2);
    expect(winklerScore([7], [4], [6], 0.2)).toBe(2 + 10);
  });
  it("conformal quantile needs enough residuals", () => {
    expect(conformalQuantile([1, 2, 3], 0.05)).toBeNull();
    const r = Array.from({ length: 20 }, (_, i) => i + 1);
    expect(conformalQuantile(r, 0.05)).toBe(20);
    expect(conformalQuantile(r, 0.2)).toBe(17);
  });
});

describe("backtest", () => {
  const series = generateSyntheticDailySeries({ days: 200, seed: 3, noiseSd: 4 });
  it("reports per-horizon metrics and baseline comparison", () => {
    const bt = rollingOriginBacktest({ series, method: "moving_average", horizons: [7, 30, 90], step: 7 });
    expect(bt.byHorizon.map((h) => h.horizon)).toEqual([7, 30, 90]);
    for (const h of bt.byHorizon) {
      expect(h.origins).toBeGreaterThan(0);
      expect(h.mae).not.toBeNull();
      expect(h.baseline.mae).not.toBeNull();
      expect(typeof h.beatsBaseline).toBe("boolean");
    }
    expect(bt.residualsByStep).toHaveLength(90);
    expect(bt.residualsByStep[0].length).toBeGreaterThanOrEqual(bt.residualsByStep[89].length);
  });
  it("never trains on data at or after the origin", () => {
    const seen: number[] = [];
    rollingOriginBacktest({
      series,
      method: (h, k) => {
        seen.push(h.length);
        return new Array<number>(k).fill(h[h.length - 1]);
      },
      horizons: [7],
      minTrainDays: 30,
      step: 10,
    });
    expect(seen[0]).toBe(30);
    expect(seen[1]).toBe(40);
  });
});

describe("runForecast", () => {
  it("returns insufficient_evidence and no numeric intervals on sparse data", () => {
    const series = generateSyntheticDailySeries({ days: 20, seed: 1 });
    const r = runForecast({ series, horizonDays: 14, method: "seasonal_naive", nonNegative: true, seed: 1 });
    expect(r.status).toBe("insufficient_evidence");
    expect(r.calibration.reason).toMatch(/56/);
    expect(r.points).toHaveLength(14);
    for (const p of r.points) {
      expect(p.lo80).toBeUndefined();
      expect(p.hi95).toBeUndefined();
    }
  });

  it("calibrated intervals achieve held-out coverage on a stationary series and widen with horizon", () => {
    const series = generateSyntheticDailySeries({ days: 400, seed: 2024, noiseSd: 8, base: 200 });
    const r = runForecast({ series, horizonDays: 30, method: "seasonal_naive", nonNegative: true, seed: 1 });
    expect(r.status).toBe("calibrated");
    const c80 = r.calibration.heldOutCoverage80;
    const c95 = r.calibration.heldOutCoverage95;
    expect(c80).not.toBeNull();
    expect(c80 as number).toBeGreaterThanOrEqual(0.65);
    expect(c80 as number).toBeLessThanOrEqual(0.93);
    expect(c95 as number).toBeGreaterThanOrEqual(0.85);
    expect(c95 as number).toBeLessThanOrEqual(1);
    const widths80 = r.points.map((p) => (p.hi80 as number) - p.value);
    const widths95 = r.points.map((p) => (p.hi95 as number) - p.value);
    for (let i = 1; i < widths80.length; i++) {
      expect(widths80[i]).toBeGreaterThanOrEqual(widths80[i - 1] - 1e-9);
      expect(widths95[i]).toBeGreaterThanOrEqual(widths95[i - 1] - 1e-9);
    }
    for (const p of r.points) {
      expect(p.lo95 as number).toBeLessThanOrEqual(p.lo80 as number);
      expect(p.hi95 as number).toBeGreaterThanOrEqual(p.hi80 as number);
    }
    expect(r.warnings.some((w) => /drift/i.test(w))).toBe(false);
  });

  it("is deterministic", () => {
    const series = generateSyntheticDailySeries({ days: 120, seed: 5 });
    const a = runForecast({ series, horizonDays: 7, method: "drift", seed: 1 });
    const b = runForecast({ series, horizonDays: 7, method: "drift", seed: 1 });
    expect(a).toEqual(b);
  });

  it("warns on input drift and trailing-zero outages", () => {
    const shifted = generateSyntheticDailySeries({ days: 120, seed: 8 }).map((p, i) => ({
      ...p,
      value: i >= 92 ? p.value + 80 : p.value,
    }));
    const r1 = runForecast({ series: shifted, horizonDays: 7, method: "seasonal_naive" });
    expect(r1.warnings).toContain(r1.warnings.find((w) => w.startsWith("Input drift detected; review before using for decisions")));
    const outage = generateSyntheticDailySeries({ days: 90, seed: 8 }).map((p, i) => ({ ...p, value: i >= 86 ? 0 : p.value }));
    const r2 = runForecast({ series: outage, horizonDays: 7, method: "seasonal_naive", nonNegative: true });
    expect(r2.warnings.some((w) => /outage/.test(w))).toBe(true);
  });

  it("handles 3 years of daily history quickly", () => {
    const series = generateSyntheticDailySeries({ days: 3 * 365, seed: 11, trendPerDay: 0.05 });
    const t0 = performance.now();
    const r = runForecast({ series, horizonDays: 90, method: "moving_average", nonNegative: true });
    const elapsed = performance.now() - t0;
    expect(r.points).toHaveLength(90);
    expect(r.backtest?.byHorizon.find((h) => h.horizon === 90)?.origins).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(2000);
  });
});

describe("funnel", () => {
  const common = { arpu: 25, monthlyChurn: 0.03, lagDays: 14, horizonDays: 90 };
  it("reproduces the deterministic examples exactly", () => {
    const a = simulateFunnel({ ...common, visits: 10_000, signupRate: 0.05, paidRate: 0.08 });
    expect(a.kind).toBe("assumption_scenario");
    expect(a.expectedNewPayingAccounts).toBe(40);
    expect(a.newCohortMrrAtMaturation).toBe(1000);
    const b = simulateFunnel({ ...common, visits: 12_000, signupRate: 0.055, paidRate: 0.085 });
    expect(b.expectedNewPayingAccounts).toBe(56.1);
    expect(b.newCohortMrrAtMaturation).toBe(1402.5);
    const cmp = compareScenarios(a, b);
    expect(cmp.deltaNewCohortMrrAtMaturation).toBe(402.5);
    expect(cmp.note).toBe("Scenario difference, not evidence of causal uplift");
  });

  it("point-assumption funnel has no interval", () => {
    const a = simulateFunnel({ ...common, visits: 10_000, signupRate: 0.05, paidRate: 0.08 });
    expect(a.simulation).toBeUndefined();
    expect(a.uncertaintySources).toEqual([]);
  });

  it("simulates quantiles from observed data, reproducibly", () => {
    const input = {
      ...common,
      visits: { mean: 10_000 },
      signupRate: { successes: 50, trials: 1000 },
      paidRate: { alpha: 8, beta: 92 },
      runs: 5000,
      seed: 99,
    };
    const r = simulateFunnel(input);
    expect(r.kind).toBe("simulated_from_observed");
    const q = r.simulation?.newPayingAccounts;
    expect(q).toBeDefined();
    expect(q!.p10).toBeLessThan(q!.p50);
    expect(q!.p50).toBeLessThan(q!.p90);
    expect(q!.p50).toBeGreaterThan(25);
    expect(q!.p50).toBeLessThan(60);
    expect(simulateFunnel(input)).toEqual(r);
  });
});
