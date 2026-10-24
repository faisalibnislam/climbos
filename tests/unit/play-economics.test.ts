import { describe, expect, it } from "vitest";
import { lintEconomics, lockedNumbers, playMaths, simulateCustomers, withForecasts } from "../../shared/agents/economics";

const econ = { revenuePerCustomerMonthUsd: 19, grossMargin: 0.8, monthlyChurn: 0.1, basis: "Business plan price; margin and churn assumed", assumed: ["margin", "churn"] };
type Model = { weeklyReach: number; weeklyReachLow?: number; weeklyReachHigh?: number; rampWeeks?: number; salesLagDays?: number; steps: { name: string; rate: number; low?: number; high?: number; baselineRate?: number }[]; monthlySpendUsd: number; ownerHoursPerWeek: number };
const play = (over: Partial<{ kind: string; model: Model }> = {}) => ({ name: "Agency outreach", kind: "bankable", unit: "paying customers", horizonDays: 91, model: { weeklyReach: 250, steps: [{ name: "reply", rate: 0.02 }, { name: "trial", rate: 0.5 }, { name: "paid", rate: 0.3 }], monthlySpendUsd: 0, ownerHoursPerWeek: 1 } as Model, ...over });

describe("growth maths in code", () => {
  it("computes customers, cost per customer and payback with churn", () => {
    const m = playMaths(play(), econ);
    expect(m.customers).toBeCloseTo(9.75, 1); // 250 × 13 weeks × 0.02 × 0.5 × 0.3
    expect(m.costUsd).toBe(650); // 13 hours × $50
    expect(m.valueUsd).toBeCloseTo(15.2 * (1 - 0.9 ** 12) / 0.1, 4); // 12-month contribution with 10% churn ≈ 109
    expect(m.profitable).toBe(true);
    expect(m.paybackMonths).toBeGreaterThan(650 / 9.75 / 15.2); // churn makes payback longer than simple
  });

  it("keeps attributed revenue separate and leaves incrementality unknown without a baseline", () => {
    const m = playMaths(play(), econ);
    expect(m.outcomeAccounting.attributionBasis).toBe("modeled_play_funnel");
    expect(m.outcomeAccounting.attributedCustomers.p50).toBeCloseTo(m.customers, 8);
    expect(m.outcomeAccounting.attributedRevenue12m?.p50).toBeCloseTo(m.customers * 19 * (1 - 0.9 ** 12) / 0.1, 8);
    expect(m.outcomeAccounting.incrementalityBasis).toBe("not_estimated");
    expect(m.outcomeAccounting.modeledIncrementalCustomers).toBeNull();
    expect(m.outcomeAccounting.modeledIncrementalRevenue12m).toBeNull();
  });

  it("reports modeled incremental revenue only when a funnel baseline is supplied", () => {
    const p = play({ model: { ...play().model, weeklyReach: 100, steps: [{ name: "paid", rate: 0.2, baselineRate: 0.1 }] } });
    const m = playMaths(p, econ);
    expect(m.outcomeAccounting.attributedCustomers.p50).toBeCloseTo(260, 8);
    expect(m.outcomeAccounting.modeledIncrementalCustomers?.p50).toBeCloseTo(130, 8);
    expect(m.outcomeAccounting.incrementalityBasis).toBe("modeled_baseline_delta");
    expect(m.outcomeAccounting.modeledIncrementalRevenue12m?.p50).toBeCloseTo(130 * 19 * (1 - 0.9 ** 12) / 0.1, 8);
    expect(m.outcomeAccounting.currency).toBe("USD");
    expect(m.outcomeAccounting.revenueHorizonMonths).toBe(12);
  });

  it("supports older plans that give months retained", () => {
    const m = playMaths(play(), { revenuePerCustomerMonthUsd: 19, grossMargin: 0.8, monthsRetained: 10, basis: "" });
    expect(m.valueUsd).toBeCloseTo(15.2 * (1 - 0.9 ** 12) / 0.1, 4);
  });

  it("simulates a P10–P90 range from the input ranges, reproducibly", () => {
    const model: Model = { weeklyReach: 250, weeklyReachLow: 150, weeklyReachHigh: 300, steps: [{ name: "reply", rate: 0.02, low: 0.01, high: 0.04 }, { name: "paid", rate: 0.15, low: 0.1, high: 0.25 }], monthlySpendUsd: 0, ownerHoursPerWeek: 1 };
    const a = simulateCustomers(model, 13, "x");
    expect(a.p10).toBeLessThan(a.p50);
    expect(a.p50).toBeLessThan(a.p90);
    expect(simulateCustomers(model, 13, "x")).toEqual(a);
    const point = simulateCustomers({ ...model, weeklyReachLow: undefined, weeklyReachHigh: undefined, steps: model.steps.map(({ name, rate }) => ({ name, rate })) }, 13, "x");
    expect(point.p10).toBe(point.p90);
  });

  it("writes the forecast onto plays (the model never does)", () => {
    const out = withForecasts({ economics: econ, plays: [play()] });
    expect(out.plays[0].p50).toBeCloseTo(9.8, 1);
    expect(out.plays[0].forecastUncertainty).toEqual({
      rangeMethod: "single_scenario",
      variedDrivers: [],
      statisticalInterval: "not_estimated",
      calibratedToBusiness: false,
      timing: { reachRamp: "immediate_assumed", paidConversionLag: "none_assumed" },
      omittedFactors: ["seasonality", "execution_variation", "model_error"],
    });
    expect(out.plays[0].financialEvidence).toMatchObject({ status: "unlabelled_scenario" });
    expect(out.plays[0].outcomeAccounting).toMatchObject({ incrementalityBasis: "not_estimated", modeledIncrementalRevenue12m: null });
    expect(lockedNumbers({ economics: econ, plays: [play()] })).toContain("modeled incremental 12-month revenue: not estimated (not estimated because no baseline was supplied)");
  });

  it("separates named input scenarios from statistical uncertainty and reports modeled timing", () => {
    const ranged = play({ model: { ...play().model, weeklyReachLow: 150, weeklyReachHigh: 350, rampWeeks: 3, salesLagDays: 14, steps: [{ name: "reply", rate: 0.02, low: 0.01, high: 0.04 }, { name: "paid", rate: 0.3 }] } });
    const forecast = withForecasts({ economics: econ, plays: [ranged] }).plays[0].forecastUncertainty;
    expect(forecast).toMatchObject({
      rangeMethod: "input_scenario",
      variedDrivers: ["weekly reach", "reply rate"],
      statisticalInterval: "not_estimated",
      calibratedToBusiness: false,
      timing: { reachRamp: "modeled", paidConversionLag: "modeled" },
    });
    expect(forecast?.omittedFactors).toContain("model_error");
  });

  it("returns one-input-at-a-time sensitivity for explicit funnel, reach, and owner ranges", () => {
    const ranged = play({ model: { ...play().model, weeklyReachLow: 150, weeklyReachHigh: 350, steps: [{ name: "reply", rate: 0.02, low: 0.01, high: 0.04 }, { name: "paid", rate: 0.3 }]} });
    const economics = { ...econ, ranges: { revenue: { low: 10, high: 30 }, margin: { low: 0.6, high: 0.9 }, churn: { low: 0.05, high: 0.2 } } };
    const m = playMaths(ranged, economics);
    expect(m.sensitivity.map((x) => x.driver)).toEqual(expect.arrayContaining(["Weekly reach", "reply rate", "Revenue per customer/month", "Gross margin", "Monthly churn"]));
    expect(m.sensitivity.every((x) => x.metric === "net_contribution_12m" && x.atLow !== x.atMode && x.atHigh !== x.atMode)).toBe(true);
    expect(withForecasts({ economics, plays: [ranged] }).plays[0].sensitivity).toEqual(m.sensitivity);
    expect(lockedNumbers({ economics, plays: [ranged] })).toContain("SENSITIVITY · Agency outreach");
    expect(lockedNumbers({ economics, plays: [ranged] })).toContain("not a joint forecast");
  });

  it("flags conditional money-losing scenarios and bad ranges", () => {
    const losing = play({ model: { weeklyReach: 100, steps: [{ name: "click", rate: 0.02 }, { name: "paid", rate: 0.01 }], monthlySpendUsd: 600, ownerHoursPerWeek: 0 } });
    const badRange = play({ model: { ...play().model, steps: [{ name: "reply", rate: 0.02, low: 0.03, high: 0.05 }] } });
    const issues = lintEconomics({ economics: econ, plays: [losing, badRange] });
    expect(issues.some((i) => i.severity === "warn" && /Does not pay back under the current scenario/.test(i.message))).toBe(true);
    expect(issues.some((i) => /low ≤ rate ≤ high/.test(i.message) && i.path === "plays[1].model.steps")).toBe(true);
    expect(lintEconomics({ economics: econ, plays: [play()] })).toEqual([]);
  });

  it("hands the plan locked totals with overlap", () => {
    const one = lockedNumbers({ economics: econ, plays: [play()] });
    expect(one).toContain("TOTAL: ≈9.8 new customers in 91 days");
    expect(one).toContain("North Star target = ≈10 new customers by day 91");
    const two = lockedNumbers({ economics: econ, plays: [play(), play({ kind: "creative" })] });
    expect(two).toContain("TOTAL: ≈18 new customers"); // 9.75 + 9.75 × (1 − 0.2): the largest play counts in full
    expect(two).toContain("20% overlap");
  });
});

describe("owner numbers and decision questions", () => {
  const marginal = play({ model: { weeklyReach: 250, steps: [{ name: "reply", rate: 0.02 }, { name: "trial", rate: 0.5 }, { name: "paid", rate: 0.3 }], monthlySpendUsd: 0, ownerHoursPerWeek: 2 } });

  it("owner-confirmed numbers replace assumptions", async () => {
    const { applyOwnerEconomics } = await import("../../shared/agents/economics");
    const e = applyOwnerEconomics(econ, { revenuePerCustomerMonthUsd: 49, ownerHourUsd: 80 });
    expect(e.revenuePerCustomerMonthUsd).toBe(49);
    expect(e.ownerHourUsd).toBe(80);
    expect(e.assumed).toEqual(["margin", "churn"]);
    expect(e.basis).toMatch(/^Owner confirmed revenue, owner hour\./);
  });

  it("asks only about assumptions that would flip a verdict, at most 3", async () => {
    const { decisionQuestions, playMaths } = await import("../../shared/agents/economics");
    // 26 hours × $50 = $1,300 for ≈9.75 customers ≈ $133 each vs ≈ $109 value: close to break-even, so inputs matter.
    expect(playMaths(marginal, econ).profitable).toBe(false);
    const qs = decisionQuestions({ economics: econ, plays: [marginal] });
    expect(qs.length).toBeGreaterThan(0);
    expect(qs.length).toBeLessThanOrEqual(3);
    expect(qs).toHaveLength(3); // four inputs would flip it; the three biggest swings are asked
    // Once the owner confirms everything, nothing is left to ask.
    expect(decisionQuestions({ economics: econ, plays: [marginal] }, { revenuePerCustomerMonthUsd: 19, grossMargin: 0.8, monthlyChurn: 0.1, ownerHourUsd: 50 })).toEqual([]);
  });

  it("doesn't ask when no plausible answer changes anything", async () => {
    const { decisionQuestions } = await import("../../shared/agents/economics");
    const cheap = play({ model: { weeklyReach: 5000, steps: [{ name: "paid", rate: 0.05 }], monthlySpendUsd: 0, ownerHoursPerWeek: 0 } });
    expect(decisionQuestions({ economics: { ...econ, monthlyChurn: 0.02 }, plays: [cheap] })).toEqual([]);
  });
});

describe("plan fits budget, time and the computed total", () => {
  it("flags overspend, too many owner hours and a North Star that ignores the plays", async () => {
    const { lintFeasibility, lintPlanFit } = await import("../../shared/agents/specs");
    const plays = [{ name: "a", kind: "bankable", model: { monthlySpendUsd: 400, ownerHoursPerWeek: 4 } }, { name: "b", kind: "creative", model: { monthlySpendUsd: 300, ownerHoursPerWeek: 3 } }];
    expect(lintFeasibility(plays, { monthlyAdBudgetUsd: 600, ownerHoursPerWeek: 5 }).map((i) => i.rule)).toEqual(["budget", "capacity"]);
    expect(lintFeasibility(plays, { monthlyAdBudgetUsd: 700, ownerHoursPerWeek: 7 })).toEqual([]);
    const plan = (target: string) => ({ channels: [{ name: "Search", suggestedMonthlyAdSpend: 200 }], northStar: { target } });
    expect(lintPlanFit(plan("40 paying customers by day 90"), { monthlyAdBudgetUsd: 600, lockedCustomers: 17 })[0].rule).toBe("consistency");
    expect(lintPlanFit(plan("≈17 paying customers by day 90 (v2 estimate)"), { monthlyAdBudgetUsd: 600, lockedCustomers: 17 })).toEqual([]);
    expect(lintPlanFit(plan("17 customers"), { monthlyAdBudgetUsd: 100, lockedCustomers: 17 })[0].rule).toBe("budget");
  });
});
