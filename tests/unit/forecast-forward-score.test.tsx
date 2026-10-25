import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { scoreForecast } from "../../shared/forecasting";

vi.mock("convex/react", () => ({ useQuery: vi.fn() }));
const { ForwardScoreSection } = await import("../../src/components/app/results/ForecastDetail");

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
});
