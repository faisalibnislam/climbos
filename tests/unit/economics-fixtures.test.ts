import { describe, expect, it } from "vitest";
import { churnOf, customerValue, lintEconomics, lockedNumbers, monthlyContribution, playMaths } from "../../shared/agents/economics";
import { lintFeasibility } from "../../shared/agents/specs";
import { breakevenCpc, cacMedia, clicks, contributionMonth, contributionOver, funnelCustomers, paybackSimple, paybackWithChurn } from "../../shared/growth/calc";

/** S3 (REQ-MATH): the spec §8.3 reference fixture plus the edge cases. */
const DAYS_PER_MONTH = 365.25 / 12;
const ref = { revenuePerCustomerMonthUsd: 30, grossMargin: 0.8, monthlyChurn: 0.05, basis: "reference" };
const refPlay = (over: Partial<{ horizonDays: number; weeklyReach: number; steps: { name: string; rate: number }[]; monthlySpendUsd: number; ownerHoursPerWeek: number; rampWeeks: number; salesLagDays: number }> = {}) => {
  const horizonDays = over.horizonDays ?? DAYS_PER_MONTH;
  return {
    name: "Search ads",
    kind: "bankable",
    unit: "paying customers",
    horizonDays,
    // 300 clicks over one month, spread by week.
    model: { weeklyReach: over.weeklyReach ?? 300 / (DAYS_PER_MONTH / 7), steps: over.steps ?? [{ name: "signup", rate: 0.08 }, { name: "paid", rate: 0.25 }], monthlySpendUsd: over.monthlySpendUsd ?? 600, ownerHoursPerWeek: over.ownerHoursPerWeek ?? 0, ...(over.rampWeeks !== undefined ? { rampWeeks: over.rampWeeks } : {}), ...(over.salesLagDays !== undefined ? { salesLagDays: over.salesLagDays } : {}) },
  };
};

describe("§8.3 reference fixture", () => {
  it("formula catalog matches every reference number", () => {
    const c = clicks(600, 2)!;
    expect(c).toBe(300);
    const customers = funnelCustomers(c, [0.08, 0.25])!;
    expect(customers).toBeCloseTo(6, 10);
    expect(cacMedia(600, customers)).toBeCloseTo(100, 10);
    const cm = contributionMonth(30, 0.8)!;
    expect(cm).toBeCloseTo(24, 10);
    expect(paybackSimple(100, cm)).toBeCloseTo(4.1667, 4);
    expect(contributionOver(cm, 0.05, 3)).toBeCloseTo(68.46, 10);
    expect(contributionOver(cm, 0.05, 12)).toBeCloseTo(220.6272, 3);
    expect(breakevenCpc(contributionOver(cm, 0.05, 3), 0.08, 0.25)).toBeCloseTo(1.3692, 4);
  });

  it("simple payback is never shown as churn-adjusted payback", () => {
    const withChurn = paybackWithChurn(100, 24, 0.05)!;
    expect(withChurn).toBeGreaterThan(4.1667);
    const m = playMaths(refPlay(), ref);
    expect(m.paybackMonths).toBeCloseTo(withChurn, 6);
  });

  it("the play pipeline reproduces the reference end to end", () => {
    const m = playMaths(refPlay(), ref);
    expect(m.customers).toBeCloseTo(6, 6);
    expect(m.cacUsd).toBeCloseTo(100, 6);
    expect(m.valueUsd).toBeCloseTo(220.6272, 3);
    expect(m.profitable).toBe(true);
    expect(m.invalidInputs).toEqual([]);
  });

  it("reports CAC bounds from the inverse of the same simulated customer range", () => {
    const base = refPlay();
    const ranged = {
      ...base,
      model: {
        ...base.model,
        weeklyReachLow: 30,
        weeklyReachHigh: 120,
        steps: [{ name: "paid", rate: 0.1, low: 0.05, high: 0.2 }],
      },
    };
    const m = playMaths(ranged, ref);

    expect(m.cacRange.p10).toBeCloseTo(m.costUsd / m.range.p90, 8);
    expect(m.cacRange.p50).toBeCloseTo(m.costUsd / m.range.p50, 8);
    expect(m.cacRange.p90).toBeCloseTo(m.costUsd / m.range.p10, 8);
    expect(m.cacRange.p10!).toBeLessThanOrEqual(m.cacRange.p50!);
    expect(m.cacRange.p50!).toBeLessThanOrEqual(m.cacRange.p90!);
  });

  it("marks the high CAC bound unbounded when the low customer draw is zero", () => {
    const m = playMaths(refPlay({ steps: [{ name: "paid", rate: 0 }] }), ref);

    expect(m.cacRange).toEqual({ p10: null, p50: null, p90: null });
  });
});

describe("edge cases", () => {
  it("known-zero churn is a real value, not unknown", () => {
    const e = { ...ref, monthlyChurn: 0 };
    expect(churnOf(e)).toBe(0);
    expect(customerValue(e)).toBeCloseTo(24 * 12, 10);
    expect(lintEconomics({ economics: e, plays: [refPlay()] }).filter((l) => l.path === "economics")).toEqual([]);
  });

  it("unknown churn stays unknown: no value, no verdict, flagged", () => {
    const e = { revenuePerCustomerMonthUsd: 30, grossMargin: 0.8, basis: "no churn" };
    expect(churnOf(e)).toBeNull();
    expect(customerValue(e)).toBeNull();
    const m = playMaths(refPlay(), e);
    expect(m.valueUsd).toBeNull();
    expect(m.profitable).toBeNull();
    expect(m.paybackMonths).toBeNull();
    expect(lintEconomics({ economics: e, plays: [refPlay()] }).some((l) => l.rule === "economics" && l.path === "economics")).toBe(true);
    expect(lockedNumbers({ economics: e, plays: [refPlay()] })).toMatch(/churn unknown/);
    // Never reported as a money loser on unknown economics.
    expect(lintEconomics({ economics: e, plays: [refPlay()] }).some((l) => /Loses money/.test(l.message))).toBe(false);
  });

  it("one-off order: churn 1 means one month of contribution", () => {
    expect(customerValue({ ...ref, monthlyChurn: 1 })).toBeCloseTo(24, 10);
  });

  it("percent-looking inputs are rejected, never read as percents", () => {
    const e = { ...ref, grossMargin: 80 };
    expect(monthlyContribution(e)).toBeNull();
    expect(lintEconomics({ economics: e, plays: [refPlay()] }).some((l) => l.path === "economics.grossMargin")).toBe(true);
    expect(churnOf({ ...ref, monthlyChurn: 5 })).toBeNull();
    const m = playMaths(refPlay({ steps: [{ name: "signup", rate: 8 }, { name: "paid", rate: 0.25 }] }), ref);
    expect(m.customers).toBe(0);
    expect(m.invalidInputs).toEqual(["signup"]);
    expect(m.profitable).toBeNull();
  });

  it("fractional horizon: 3 days is 3/7 of a week, not rounded up", () => {
    const week = playMaths(refPlay({ horizonDays: 7 }), ref);
    const three = playMaths(refPlay({ horizonDays: 3 }), ref);
    expect(three.customers / week.customers).toBeCloseTo(3 / 7, 10);
    expect(three.costUsd / week.costUsd).toBeCloseTo(3 / 7, 10);
    // Spend follows calendar months (30.44 days), not 4.33 weeks.
    expect(playMaths(refPlay(), ref).costUsd).toBeCloseTo(600, 6);
  });

  it("models gradual reach and paid-conversion lag without discounting the planned cost", () => {
    const base = refPlay({ horizonDays: 28, weeklyReach: 100, steps: [{ name: "paid", rate: 0.1 },], monthlySpendUsd: 700 });
    const immediate = playMaths(base, ref);
    const ramped = playMaths(refPlay({ horizonDays: 28, weeklyReach: 100, steps: [{ name: "paid", rate: 0.1 }], monthlySpendUsd: 700, rampWeeks: 4 }), ref);
    const delayed = playMaths(refPlay({ horizonDays: 28, weeklyReach: 100, steps: [{ name: "paid", rate: 0.1 }], monthlySpendUsd: 700, salesLagDays: 7 }), ref);
    const both = playMaths(refPlay({ horizonDays: 28, weeklyReach: 100, steps: [{ name: "paid", rate: 0.1 }], monthlySpendUsd: 700, rampWeeks: 4, salesLagDays: 7 }), ref);
    expect(immediate.customers).toBeCloseTo(40, 9);
    expect(ramped.customers).toBeCloseTo(20, 9);
    expect(delayed.customers).toBeCloseTo(30, 9);
    expect(both.customers).toBeCloseTo(11.25, 9);
    expect([ramped.costUsd, delayed.costUsd, both.costUsd]).toEqual([immediate.costUsd, immediate.costUsd, immediate.costUsd]);
    expect(lockedNumbers({ economics: ref, plays: [refPlay({ horizonDays: 28, weeklyReach: 100, steps: [{ name: "paid", rate: 0.1 }], rampWeeks: 4, salesLagDays: 7 })] })).toContain("reach ramps to full volume over 4 weeks; allows 7 days for paid conversion");
  });

  it("does not count paid conversions that fall after the forecast horizon", () => {
    const p = refPlay({ horizonDays: 7, weeklyReach: 100, steps: [{ name: "paid", rate: 0.1 }], salesLagDays: 7 });
    const m = playMaths(p, ref);
    expect(m.customers).toBe(0);
    expect(m.costUsd).toBeGreaterThan(0);
    expect(m.cacUsd).toBeNull();
  });

  it("unprofitable action is a hard economics finding", () => {
    const losing = refPlay({ monthlySpendUsd: 6000 });
    const m = playMaths(losing, ref);
    expect(m.profitable).toBe(false);
    expect(lintEconomics({ economics: ref, plays: [losing] }).some((l) => l.rule === "economics" && /Loses money/.test(l.message))).toBe(true);
  });

  it("no customers: no cost per customer, no verdict, flagged", () => {
    const none = refPlay({ weeklyReach: 0 });
    const m = playMaths(none, ref);
    expect(m.customers).toBe(0);
    expect(m.cacUsd).toBeNull();
    expect(m.profitable).toBeNull();
    expect(lintEconomics({ economics: ref, plays: [none] }).some((l) => l.path === "plays[0].model")).toBe(true);
  });

  it("missing price: contribution unknown", () => {
    const e = { ...ref, revenuePerCustomerMonthUsd: Number.NaN };
    expect(monthlyContribution(e)).toBeNull();
    expect(playMaths(refPlay(), e).valueUsd).toBeNull();
    expect(lintEconomics({ economics: e, plays: [refPlay()] }).some((l) => l.path === "economics")).toBe(true);
  });

  it("finite capacity (owner hours) beyond what the owner has is a hard finding", () => {
    const issues = lintFeasibility([refPlay({ ownerHoursPerWeek: 6 }).model].map((model) => ({ name: "x", kind: "bankable", model })), { ownerHoursPerWeek: 4 });
    expect(issues.some((l) => l.rule === "capacity" && l.severity === "error")).toBe(true);
  });
});

describe("headline basis (REQ-MATH-06, regression check 2026-10-19)", () => {
  it("the headline is the most-likely-rates number, inside its simulated range, even with skewed ranges", async () => {
    const { withForecasts } = await import("../../shared/agents/economics");
    const skewed = { ...refPlay(), model: { ...refPlay().model, steps: [{ name: "signup", rate: 0.03, low: 0.02, high: 0.2 }, { name: "paid", rate: 0.03, low: 0.02, high: 0.2 }] } };
    const m = playMaths(skewed, ref);
    expect(m.range.p50).toBeGreaterThan(m.customers * 1.5); // the simulation median drifts up
    expect(m.headline.p50).toBe(m.customers);
    expect(m.headline.p10).toBeLessThanOrEqual(m.customers);
    expect(m.headline.p90).toBeGreaterThanOrEqual(m.customers);
    const out = withForecasts({ economics: ref, plays: [skewed] });
    expect(out.plays[0].p50).toBeCloseTo(m.customers, 1);
    expect(out.plays[0].cacRange).toEqual(m.cacRange);
  });
});
