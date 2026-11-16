import { describe, expect, it } from "vitest";
import { playActuals } from "../../shared/growth/actuals";
import { diagnoseShortfall, needsShortfallReview } from "../../shared/growth/diagnostics";

const model = { weeklyReach: 1000, steps: [{ name: "pay", rate: 0.1 }], monthlySpendUsd: 100, ownerHoursPerWeek: 1 };
const rows = (reach: number, steps: number[]) => [0, 1].map(w => ({ weekStart: w * 604800000, reach, steps, spendUsd: 10, spendCurrency: "USD", ownerHours: 1 }));

describe("weekly results guide the next decision", () => {
  it("does not call a large volume shortfall on track just because conversion holds", () => {
    const actual = playActuals(model, rows(100, [10]), { p10: 180, p50: 200, p90: 220 }, 2);
    expect(actual.status).toBe("below_scenario");
    expect(diagnoseShortfall(actual).verdict).toBe("reach_only");
  });

  it("does not treat reported zero reach as verified non-execution", () => {
    const actual = playActuals(model, rows(0, [0]), { p10: 180, p50: 200, p90: 220 }, 2);
    const check = diagnoseShortfall(actual);
    expect(check.verdict).toBe("execution_unknown");
    expect(check.next).not.toContain("hasn't run");
    expect(check.moreSpendJustified).toBe(false);
  });

  it("does not recommend more spend while a later conversion step remains too thin", () => {
    const funnel = { ...model, steps: [{ name: "trial", rate: 0.1 }, { name: "pay", rate: 0.2 }] };
    const actual = playActuals(funnel, rows(100, [10, 1]), { p10: 36, p50: 40, p90: 44 }, 2);
    const check = diagnoseShortfall(actual, {}, { affordableCacUsd: 100, currency: "USD" });
    expect(check.moreSpendJustified).toBe(false);
    expect(check.checks.find(x => x.check === "conversion")?.status).toBe("unknown");
  });

  it("keeps a small shortfall inconclusive and explains proportional references", () => {
    const actual = playActuals({ ...model, weeklyReach: 50, steps: [{ name: "pay", rate: 0.04 }] }, rows(50, [1]), { p10: 19.5, p50: 26, p90: 32.5 }, 13);
    expect(actual.status).toBe("below_scenario");
    expect(actual.comparisonNote).toContain("assuming even delivery");
    expect(actual.comparisonNote).toContain("not a validated probability range");
    expect(diagnoseShortfall(actual).verdict).toBe("too_few");
  });

  it("never interprets a completed window as permission to keep running", () => {
    const actual = playActuals(model, rows(1000, [100]), { p10: 180, p50: 200, p90: 220 }, 2);
    expect(actual).toMatchObject({ status: "within_scenario", horizonComplete: true });
    expect(diagnoseShortfall(actual)).toMatchObject({ verdict: "fine", moreSpendJustified: false, next: expect.stringContaining("Review the completed window") });
  });

  it("does not let high reach hide weak conversion when the customer total meets the scenario", () => {
    const actual = playActuals(model, rows(5000, [100]), { p10: 180, p50: 200, p90: 220 }, 2);
    expect(actual.status).toBe("within_scenario");
    expect(needsShortfallReview(actual)).toBe(true);
    expect(diagnoseShortfall(actual)).toMatchObject({ verdict: "conversion", moreSpendJustified: false });
  });

  it("does not compare spend with customer value in a different or unknown currency", () => {
    const actual = playActuals(model, rows(100, [10]), { p10: 180, p50: 200, p90: 220 }, 2);
    for (const currency of ["EUR", undefined]) {
      const check = diagnoseShortfall(actual, {}, { affordableCacUsd: 100, currency });
      expect(check.moreSpendJustified).toBe(false);
      expect(check.checks.find(x => x.check === "cost")?.detail).toContain("$1");
      expect(check.checks.find(x => x.check === "cost")?.detail).not.toContain("€");
    }
  });
});
