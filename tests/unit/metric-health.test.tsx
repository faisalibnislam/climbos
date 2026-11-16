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

  it("does not turn separated zero observations into consecutive zero days", () => {
    const points = [...days(Array(14).fill(20), addDays(yesterday, -5)),
      ...[4, 2, 0].map(offset => ({ date: addDays(yesterday, -offset), value: 0 }))];
    const alerts = metricHealth(points, { yesterday, label: "Visits" });
    expect(alerts.some(a => a.kind === "zero_run")).toBe(false);
    expect(alerts).toContainEqual(expect.objectContaining({ kind: "incomplete", message: expect.stringContaining("2 missing days") }));
    const html = renderToStaticMarkup(createElement(HealthAlertsSection, { alerts: alerts.map(a => ({ metric: "visits", ...a })) }));
    expect(html).toContain("unknown, not zero");
  });

  it("does not borrow an old baseline for a current zero run", () => {
    const points = [...days(Array(14).fill(20), addDays(yesterday, -30)), ...days([0, 0, 0])];
    expect(metricHealth(points, { yesterday, label: "Visits" }).some(a => a.kind === "zero_run")).toBe(false);
  });

  it("does not describe an old spike as an unusual day in the last week", () => {
    const points = [...days([...Array.from({ length: 28 }, (_, i) => 100 + i % 5), 400], addDays(yesterday, -10)), { date: yesterday, value: 102 }];
    expect(metricHealth(points, { yesterday, label: "Visits" }).some(a => a.kind === "unusual_day")).toBe(false);
  });

  it("requires enough observations inside the actual preceding 28 calendar days", () => {
    const points = [...days(Array.from({ length: 28 }, (_, i) => 100 + i % 5), addDays(yesterday, -60)), { date: yesterday, value: 400 }];
    expect(metricHealth(points, { yesterday, label: "Visits" }).some(a => a.kind === "unusual_day")).toBe(false);
  });

  it("retains a real zero run and labels an incomplete baseline as observed days", () => {
    const points = days([...Array(14).fill(20), 0, 0, 0]).filter(p => p.date !== addDays(yesterday, -5));
    const alerts = metricHealth(points, { yesterday, label: "Visits" });
    expect(alerts).toContainEqual(expect.objectContaining({ kind: "incomplete" }));
    expect(alerts).toContainEqual(expect.objectContaining({ kind: "zero_run", message: expect.stringContaining("13 observed days") }));
  });

  it.each([
    [{ date: yesterday, value: 0 }, { date: yesterday, value: 0 }],
    [{ date: "2026-02-30", value: 10 }],
    [{ date: yesterday, value: Number.NaN }],
    [{ date: yesterday, value: Number.POSITIVE_INFINITY }],
  ])("withholds statistical alerts for invalid or duplicate observations (%j)", (...points) => {
    const alerts = metricHealth(points, { yesterday, label: "Visits" });
    expect(alerts).toEqual([expect.objectContaining({ kind: "invalid" })]);
  });

  it("ignores incomplete current and future days without mutating the input", () => {
    const points = [...days([10, 11, 12], addDays(yesterday, -5)), { date: addDays(yesterday, 1), value: 999 }].reverse();
    const before = structuredClone(points);
    expect(metricHealth(points, { yesterday, label: "Visits" })[0]?.kind).toBe("stale");
    expect(points).toEqual(before);
  });
});
