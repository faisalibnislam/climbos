import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { useQuery } from "convex/react";
import { recentForecastHistory, scoreForecast } from "../../shared/forecasting";

vi.mock("convex/react", () => ({ useQuery: vi.fn() }));
const { ForwardScoreSection, ForecastDetail } = await import("../../src/components/app/results/ForecastDetail");

const points = [
  { date: "2026-10-01", value: 10, lo80: 8, hi80: 12, lo95: 6, hi95: 14 },
  { date: "2026-10-02", value: 10, lo80: 8, hi80: 12, lo95: 6, hi95: 14 },
  { date: "2026-10-03", value: 10, lo80: 8, hi80: 12, lo95: 6, hi95: 14 },
  { date: "2026-10-04", value: 10, lo80: 8, hi80: 12, lo95: 6, hi95: 14 },
];

describe("forward forecast score", () => {
  it("scores only observed forecast days, with bias, error and range coverage", () => {
    const s = scoreForecast(points, [{ date: "2026-09-30", value: 99 }, { date: "2026-10-01", value: 12 }, { date: "2026-10-02", value: 15 }, { date: "2026-10-03", value: 9 }], 4);
    expect(s).toMatchObject({ scoredDays: 3, state: "partial", actualTotal: 36, forecastTotal: 30, inside80: { inside: 2, of: 3 }, inside95: { inside: 2, of: 3 } });
    expect(s.totalError).toBeCloseTo(0.2, 9);
    expect(s.meanAbsoluteError).toBeCloseTo((2 + 5 + 1) / 3, 9);
    expect(s.bias).toBeCloseTo(2, 9);
  });

  it("is not started without observed days, complete when the horizon is observed, and has no ranges for uncalibrated forecasts", () => {
    expect(scoreForecast(points, [], 4).state).toBe("not_started");
    const done = scoreForecast(points.map(({ date, value }) => ({ date, value })), points.map((p) => ({ date: p.date, value: 10 })), 4);
    expect(done).toMatchObject({ state: "complete", totalError: 0, inside80: null });
  });

  it("labels partial checks and small samples", () => {
    const s = scoreForecast(points, [{ date: "2026-10-01", value: 12 }, { date: "2026-10-02", value: 15 }], 4);
    const html = renderToStaticMarkup(createElement(ForwardScoreSection, { score: s, format: (n: number) => String(Math.round(n)) }));
    expect(html).toContain("2 of 4 forecast days observed · partial check");
    expect(html).toContain("27 vs 20 (+35%)");
    expect(html).toContain("forecast ran low");
    expect(html).toContain("too few to judge accuracy");
    expect(renderToStaticMarkup(createElement(ForwardScoreSection, { score: scoreForecast(points, [], 4), format: String }))).toContain("can&#x27;t be checked");
  });
  it("does not call a shortened forecast complete and rejects invalid observations and intervals", () => {
    expect(scoreForecast(points.slice(0, 2), points.slice(0, 2), 4)).toMatchObject({ state: "partial", scoredDays: 2 });
    for (const actuals of [[points[0], points[0]], [{ date: "2026-02-30", value: 1 }], [{ date: points[0].date, value: Infinity }]]) {
      expect(scoreForecast(points, actuals, 4).unavailableReason).toMatch(/Invalid or duplicate/);
    }
    expect(scoreForecast([{ ...points[0], lo80: 99 }], [points[0]], 1).unavailableReason).toMatch(/ranges are invalid/);
    expect(scoreForecast([points[0], points[3]], points, 2).unavailableReason).toMatch(/missing calendar dates/);
    expect(scoreForecast([{ date: points[0].date, value: -10 }], [{ date: points[0].date, value: -20 }], 1).totalError).toBe(-1);
  });

  it("keeps gap recovery explicit and distinguishes missing observations from elapsed time", () => {
    expect(() => recentForecastHistory([{ date: "2026-10-01", value: 0 }], "2026-10-02")).toThrow(/Missing days are unknown/);
    const html = renderToStaticMarkup(createElement(ForwardScoreSection, { score: scoreForecast(points, [], 4), format: String }));
    expect(html).toContain("No comparable observations");
    expect(html).not.toContain("No forecast days have passed");
    const blocked = { ...scoreForecast(points, [], 4), unavailableReason: "Original currency is unknown." };
    expect(renderToStaticMarkup(createElement(ForwardScoreSection, { score: blocked, format: String }))).toContain("Accuracy check unavailable");
  });

  it("does not invent held-out coverage or the currency of a legacy projection", () => {
    vi.mocked(useQuery).mockReturnValue({
      status: "calibrated", metric: { label: "Revenue", unit: "currency_minor", source: "Billing", definition: "Legacy definition unknown" }, currency: null,
      history: [], points, method: "seasonal_naive", horizonDays: 4, dataThrough: "2026-09-30", historyDays: 100, isFixture: false,
      calibration: { heldOutCoverage80: null, heldOutCoverage95: null, heldOutCount: 0, reason: null, residualCounts: [] }, backtest: null, assumptions: [], warnings: [], forwardScore: scoreForecast(points, [], 4),
    } as never);
    const html = renderToStaticMarkup(createElement(ForecastDetail, { slug: "example", forecastId: "fixture" }));
    expect(html).toContain("coverage has not been verified on held-out data");
    expect(html).toContain("does not guarantee future coverage");
    expect(html).toContain("minor units (currency unknown)");
    expect(html).not.toContain("about 80%");
    expect(html).not.toContain("USD");
  });

});
