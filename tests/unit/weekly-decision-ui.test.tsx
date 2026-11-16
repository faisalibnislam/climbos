import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Id } from "../../convex/_generated/dataModel";
import { PlayResults } from "../../src/components/app/plan/PlayResults";
import { playActuals } from "../../shared/growth/actuals";

const model = { weeklyReach: 1000, steps: [{ name: "pay", rate: 0.1 }], monthlySpendUsd: 100, ownerHoursPerWeek: 1 };
const rows = (reach: number, paid: number) => [0, 1].map(w => ({ weekStart: w * 604800000, reach, steps: [paid], spendUsd: 10, spendCurrency: "USD", ownerHours: 1 }));
const actuals = (reach: number, paid: number) => playActuals(model, rows(reach, paid), { p10: 180, p50: 200, p90: 220 }, 2);
const html = (value: ReturnType<typeof actuals>) => renderToStaticMarkup(createElement(PlayResults, { slug: "example", strategyId: "strategy" as Id<"strategies">, playName: "Helpful introductions", model, actuals: value, currency: "USD", canEdit: false, stopRule: "Review complaints before another invitation" }));

describe("owner weekly decision review", () => {
  it("shows the volume shortfall, its next check and the original stop rule", () => {
    const markup = html(actuals(100, 10));
    expect(markup).toContain("Below scenario range");
    expect(markup).not.toContain("On track");
    expect(markup).toContain("Next check:");
    expect(markup).toContain("only reach is short");
    expect(markup).toContain("Review complaints before another invitation");
    expect(markup).toContain("does not establish statistical confidence");
  });

  it("keeps zero reach unknown rather than declaring that work never ran", () => {
    const markup = html(actuals(0, 0));
    expect(markup).toContain("Confirm whether the activity ran");
    expect(markup).not.toContain("hasn&#x27;t run");
  });

  it("shows a weak conversion step even when the customer total meets the reference", () => {
    const markup = html(actuals(5000, 100));
    expect(markup).toContain("Within scenario range");
    expect(markup).toContain("Next check: Fix &quot;pay&quot;");
    expect(markup).toContain("Review complaints before another invitation");
  });

  it("withholds diagnosis for missing or still-open weeks", () => {
    for (const value of [{ ...actuals(100, 10), unloggedWeeks: 1, status: "incomplete_log" as const }, { ...actuals(100, 10), currentWeekIncluded: true, status: "partial_week" as const }]) {
      expect(html(value)).not.toContain("Next check:");
    }
  });
});
