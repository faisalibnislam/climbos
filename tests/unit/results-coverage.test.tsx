import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Overview, OverviewMetric } from "../../src/components/app/results/ResultsView";
import type { FunctionReturnType } from "convex/server";
import { METRICS } from "../../convex/analytics";
import { api } from "../../convex/_generated/api";

vi.mock("convex/react", () => ({ useQuery: vi.fn(), useMutation: vi.fn(() => vi.fn()) }));
const { MetricCard, FunnelSection } = await import("../../src/components/app/results/ResultsView");
const { ThisWeekCard } = await import("../../src/components/app/today/HomeCards");
const metric: OverviewMetric = {
  key: "visits", label: "Website visits", unit: "count", definition: "Sessions reported by your analytics.", source: "Google Analytics 4",
  hasData: true, total: 200, previousTotal: null, comparisonReason: "Period comparison unavailable: one or both periods have incomplete observations.",
  recordedDays: 1, expectedDays: 7, points: [{ date: "2026-11-15", value: 200 }], freshness: null, sourceName: "ga4",
  isFixture: false, currency: null, timezone: "UTC", partial: true, partialReason: "Recorded subtotal from 1 of 7 days. Missing days remain unknown.",
};

describe("Results coverage presentation", () => {
  it("labels a recorded subtotal and explains why a period change is unavailable", () => {
    const html = renderToStaticMarkup(createElement(MetricCard, { slug: "test", metric, span: 7 }));
    expect(html).toContain(">200</p>");
    expect(html).toContain("Recorded subtotal from 1 of 7 days");
    expect(html).toContain("incomplete observations");
    expect(html).not.toContain("Up ");
    expect(html).not.toContain("Down ");
    expect(html).not.toContain("No prior 7 days");
  });

  it("shows a normal change only when the backend supplies comparable periods", () => {
    const html = renderToStaticMarkup(createElement(MetricCard, { slug: "test", metric: { ...metric, total: 140, previousTotal: 70, comparisonReason: null, partial: false, partialReason: null }, span: 7 }));
    expect(html).toContain("Up 100% vs prior 7 days");
  });

  it("does not label incompatible money with the current currency or plot it as a total", () => {
    const html = renderToStaticMarkup(createElement(MetricCard, { slug: "test", metric: { ...metric, key: "revenue", label: "Revenue (net of refunds)", definition: METRICS.revenue.definition, source: "Billing", unit: "currency_minor", total: null, currency: "EUR", points: [], partialReason: "Recorded currency differs; total unavailable." }, span: 7 }));
    expect(html).toContain("Total unavailable");
    expect(html).toContain("Recorded currency differs");
    expect(html).not.toContain("€");
    expect(html).not.toContain(">0</p>");
  });

  it("keeps separate activity counts without inventing a linked-customer conversion rate", () => {
    const data = { metrics: [metric, { ...metric, key: "signups", label: "Sign-ups", total: 10 }, { ...metric, key: "paid_conversions", label: "First recorded paying customers", total: 2 }] } as Overview;
    const html = renderToStaticMarkup(createElement(FunnelSection, { slug: "test", data }));
    expect(html).toContain("Visits, sign-ups and customers");
    expect(html).toContain("not a linked conversion funnel");
    expect(html).toContain("matched audience and observation window");
    expect(html).not.toContain("5%");
    expect(html).not.toContain("20%");
    expect(html).not.toContain("from step");
  });

  it("shows coverage and unknown totals in the active Home results card", () => {
    const data = { counts: { doneThisWeek: 0, workingNow: 0 } } as FunctionReturnType<typeof api.workspace.today>;
    const snapshot: FunctionReturnType<typeof api.analytics.homeSnapshot> = { from: "2026-10-17", to: "2026-11-15", timezone: "UTC", metrics: [
      { ...metric, key: "visits" as const, expectedDays: 30, partialReason: "Recorded subtotal from 1 of 30 days. Missing days remain unknown." },
      { ...metric, key: "signups" as const, label: "Sign-ups", total: null, partialReason: "Total unavailable: overlapping observations." },
    ] };
    const html = renderToStaticMarkup(createElement(ThisWeekCard, { slug: "test", data, snapshot }));
    expect(html).toContain("Recorded subtotal from 1 of 30 days");
    expect(html).toContain("Total unavailable: overlapping observations");
    expect(html).toContain(">—</dd>");
  });
});
