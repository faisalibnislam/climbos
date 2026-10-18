import { describe, expect, it } from "vitest";
import { lintEconomics, lockedNumbers, playMaths } from "../../shared/agents/economics";

const econ = { revenuePerCustomerMonthUsd: 19, grossMargin: 0.8, monthsRetained: 10, basis: "Business plan price; margin and retention assumed" };
const play = (over: Partial<{ p50: number; kind: string; model: { weeklyReach: number; steps: { name: string; rate: number }[]; monthlySpendUsd: number; ownerHoursPerWeek: number } }> = {}) => ({ name: "Agency outreach", kind: "bankable", p50: 7, unit: "paying customers", horizonDays: 91, model: { weeklyReach: 250, steps: [{ name: "reply", rate: 0.02 }, { name: "trial", rate: 0.5 }, { name: "paid", rate: 0.3 }], monthlySpendUsd: 0, ownerHoursPerWeek: 1 }, ...over });

describe("growth maths in code", () => {
  it("computes customers, cost per customer and payback from the play's numbers", () => {
    const m = playMaths(play(), econ);
    expect(m.customers).toBeCloseTo(9.75, 1); // 250 × 13 weeks × 0.02 × 0.5 × 0.3
    expect(m.costUsd).toBe(650); // 13 hours × $50
    expect(m.valueUsd).toBeCloseTo(152, 0); // 19 × 0.8 × 10
    expect(m.profitable).toBe(true);
  });
  it("rejects money-losing plays and forecasts that don't follow from the model", () => {
    const losing = play({ p50: 0.3, model: { weeklyReach: 100, steps: [{ name: "click", rate: 0.02 }, { name: "paid", rate: 0.01 }], monthlySpendUsd: 600, ownerHoursPerWeek: 0 } });
    const issues = lintEconomics({ economics: econ, plays: [losing, play({ p50: 40 })] });
    expect(issues.some((i) => /Loses money/.test(i.message))).toBe(true);
    expect(issues.some((i) => /own numbers give/.test(i.message) && i.path === "plays[1].p50")).toBe(true);
    expect(lintEconomics({ economics: econ, plays: [play()] })).toEqual([]);
  });
  it("hands the plan locked totals", () => {
    const t = lockedNumbers({ economics: econ, plays: [play()] });
    expect(t).toContain("TOTAL: ≈9.8 customers");
    expect(t).toContain("North Star target = ≈10 customers");
  });
});
