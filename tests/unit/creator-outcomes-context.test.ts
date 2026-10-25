import { describe, expect, it } from "vitest";
import { formatCreatorOutcomeContext, type CreatorOutcomeReport } from "../../shared/agents/creatorOutcomes";

const report = (index: number): CreatorOutcomeReport => ({
  creator: `Creator ${index}`,
  status: "completed",
  format: "paid",
  agreedValueMinor: 25_000,
  actualCostMinor: 20_000,
  currency: "USD",
  publishedUrl: "https://creator.example/post",
  metric: {
    name: "Qualified visits",
    kind: "count",
    value: 12,
    unit: "visits",
    denominator: 300,
    periodStartAt: Date.UTC(2026, 9, 1),
    periodEndAt: Date.UTC(2026, 9, 7),
    sourceUrl: "https://creator.example/report",
  },
  note: "Owner-reported; verify before comparison.",
  reportedAt: Date.UTC(2026, 9, index + 1),
});

describe("creator outcome context", () => {
  it("keeps reported units, denominators, sources, and dates intact in a bounded sample", () => {
    const rows = JSON.parse(formatCreatorOutcomeContext([report(1)])) as Record<string, unknown>[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ creator: "Creator 1", status: "completed", format: "paid", actualCostMinor: 20_000, currency: "USD", reportedAt: "2026-10-02" });
    expect(rows[0]?.metric).toMatchObject({ name: "Qualified visits", value: 12, unit: "visits", denominator: 300, periodStart: "2026-10-01", periodEnd: "2026-10-07", sourceUrl: "https://creator.example/report" });
  });

  it("caps context at 20 reports and returns no context for an empty or zero-limit sample", () => {
    expect(JSON.parse(formatCreatorOutcomeContext(Array.from({ length: 25 }, (_, index) => report(index)), 40))).toHaveLength(20);
    expect(formatCreatorOutcomeContext([], 10)).toBe("");
    expect(formatCreatorOutcomeContext([report(1)], 0)).toBe("");
  });
});
