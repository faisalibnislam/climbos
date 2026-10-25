import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { addDays, metricHealth } from "../../shared/forecasting";

vi.mock("convex/react", () => ({ useQuery: vi.fn(), useMutation: vi.fn(() => vi.fn()) }));
const { HealthAlertsSection } = await import("../../src/components/app/results/ResultsView");

const yesterday = "2026-10-24";
const days = (values: number[], end = yesterday) => values.map((value, i) => ({ date: addDays(end, i - values.length + 1), value }));

describe("metric health", () => {
  it("flags stale data first", () => {
    const a = metricHealth(days([10, 11, 12], addDays(yesterday, -5)), { yesterday, label: "Visits" });
    expect(a).toEqual([{ kind: "stale", date: addDays(yesterday, -5), message: expect.stringContaining("no data recorded since") }]);
    // A one- or two-day reporting lag is normal.
    expect(metricHealth(days([10, 11, 12], addDays(yesterday, -2)), { yesterday, label: "Visits" })).toEqual([]);
  });

  it("flags a run of zero days after normal activity, but not for low-volume metrics", () => {
    const busy = metricHealth(days([...Array(14).fill(20), 0, 0, 0]), { yesterday, label: "Sign-ups" });
    expect(busy[0]).toMatchObject({ kind: "zero_run", message: expect.stringContaining("3 days in a row at zero after averaging 20 a day") });
    expect(metricHealth(days([...Array(14).fill(1), 0, 0, 0]), { yesterday, label: "Sign-ups" })).toEqual([]);
  });

  it("flags an unusual recent day against a robust baseline and ignores ordinary noise", () => {
    const base = Array.from({ length: 28 }, (_, i) => 100 + (i % 5) * 3);
    const spike = metricHealth(days([...base, 104, 400]), { yesterday, label: "Visits" });
    expect(spike[0]).toMatchObject({ kind: "unusual_day", date: yesterday, message: expect.stringContaining("unusually high (400 vs a typical 106)") });
    expect(metricHealth(days([...base, 108, 103]), { yesterday, label: "Visits" })).toEqual([]);
    expect(metricHealth([], { yesterday, label: "Visits" })).toEqual([]);
  });

  it("presents alerts as prompts to check, not causes", () => {
    const html = renderToStaticMarkup(createElement(HealthAlertsSection, { alerts: [{ metric: "visits", kind: "zero_run", date: yesterday, message: "Visits: 3 days in a row at zero." }] }));
    expect(html).toContain("Worth checking before you read these numbers");
    expect(html).toContain("don&#x27;t say what caused a change");
  });
});
