import { describe, expect, it } from "vitest";
import { lockedNumbers, playsGoalGap, portfolioRange } from "../../shared/agents/economics";
import { customerNeedPerMonth, goalGap } from "../../shared/agents/goal";
import { lintPlanFit } from "../../shared/agents/specs";

/** S3 (spec §8.1): goal, scenario and gap stay separate. */
const range = (p50: number) => ({ p10: p50 * 0.5, p50, p90: p50 * 1.5 });
const DAYS_PER_MONTH = 365.25 / 12;

describe("goal gap", () => {
  it("converts incremental customer goals to a monthly pace and includes known churn for total goals", () => {
    expect(customerNeedPerMonth({ metric: "customers", baseline: null, desired: 30, mode: "incremental" }, 90, null)).toBeCloseTo(30 / (90 / (365.25 / 12)), 8);
    const total = customerNeedPerMonth({ metric: "customers", baseline: 20, desired: 50, mode: "total" }, 90, 0.05);
    expect(total).toBeCloseTo((30 + 20 * (1 - (1 - 0.05) ** (90 / (365.25 / 12)))) / (90 / (365.25 / 12)), 8);
  });
  it("does not understate a total goal when the existing customer's churn is unknown", () => {
    expect(customerNeedPerMonth({ metric: "customers", baseline: 20, desired: 50, mode: "total" }, 90, null)).toBeNull();
    expect(customerNeedPerMonth({ metric: "customers", baseline: 0, desired: 30, mode: "total" }, 90, null)).not.toBeNull();
    expect(customerNeedPerMonth({ metric: "revenue_month", baseline: 100, desired: 200, mode: "incremental" }, 90, 0)).toBeNull();
  });
  it("'50 customers by day 90' from 20 means 30 more plus expected losses, not 50 new", () => {
    const g = goalGap({ metric: "customers", baseline: 20, desired: 50, mode: "total" }, 90, range(25), { churn: 0.05, revenuePerCustomerMonth: 30 });
    const lost = 20 * (1 - 0.95 ** (90 / DAYS_PER_MONTH));
    expect(g.lostFromBase).toBeCloseTo(lost, 10);
    expect(g.needed).toBeCloseTo(30 + lost, 10);
    expect(g.gap).toBeCloseTo(30 + lost - 25, 10);
    expect(g.state).toBe("short");
  });

  it("incremental goals need exactly the stated number", () => {
    const g = goalGap({ metric: "customers", baseline: null, desired: 10, mode: "incremental" }, 60, range(12), { churn: null, revenuePerCustomerMonth: null });
    expect(g.needed).toBe(10);
    expect(g.state).toBe("met");
  });

  it("out of reach when even the high case falls short", () => {
    expect(goalGap({ metric: "customers", baseline: 0, desired: 100, mode: "total" }, 90, range(10), { churn: 0, revenuePerCustomerMonth: 30 }).state).toBe("out_of_reach");
  });

  it("unknown churn: losses not counted, and the note says the real need is higher", () => {
    const g = goalGap({ metric: "customers", baseline: 20, desired: 50, mode: "total" }, 90, range(25), { churn: null, revenuePerCustomerMonth: 30 });
    expect(g.lostFromBase).toBeNull();
    expect(g.needed).toBe(30);
    expect(g.note).toMatch(/real need is higher/);
  });

  it("missing numbers give an unknown gap, never a default", () => {
    expect(goalGap(null, 90, range(5), { churn: 0.05, revenuePerCustomerMonth: 30 }).state).toBe("unknown");
    expect(goalGap({ metric: "customers", baseline: null, desired: 50, mode: "total" }, 90, range(5), { churn: 0.05, revenuePerCustomerMonth: 30 }).needed).toBeNull();
  });

  it("revenue goals convert through price; unknown price stays unknown", () => {
    const g = goalGap({ metric: "revenue_month", baseline: 1000, desired: 1600, mode: "total" }, 90, range(10), { churn: 0, revenuePerCustomerMonth: 30 });
    expect(g.supported?.p50).toBe(300);
    expect(g.needed).toBe(600);
    expect(g.state).toBe("out_of_reach"); // high case $450 < $600
    expect(goalGap({ metric: "revenue_month", baseline: 1000, desired: 1600, mode: "total" }, 90, range(10), { churn: 0, revenuePerCustomerMonth: null }).state).toBe("unknown");
  });

  it("a goal in another measure isn't swapped for a customer count", () => {
    expect(goalGap({ metric: "other", baseline: null, desired: 5000, mode: "incremental" }, 90, range(10), { churn: 0.05, revenuePerCustomerMonth: 30 }).state).toBe("not_comparable");
  });
});

describe("horizon and locked numbers", () => {
  const econ = { revenuePerCustomerMonthUsd: 30, grossMargin: 0.8, monthlyChurn: 0.05, basis: "" };
  const plays = [
    { name: "A", kind: "bankable", unit: "customers", horizonDays: 90, model: { weeklyReach: 100, steps: [{ name: "paid", rate: 0.02 }], monthlySpendUsd: 0, ownerHoursPerWeek: 1 } },
    { name: "B", kind: "creative", unit: "customers", horizonDays: 30, model: { weeklyReach: 100, steps: [{ name: "paid", rate: 0.02 }], monthlySpendUsd: 0, ownerHoursPerWeek: 1 } },
  ];

  it("the portfolio total re-runs every play at the goal's horizon (no mixed periods)", () => {
    const r = portfolioRange({ economics: econ, plays }, 60);
    expect(r.p50).toBeCloseTo(100 * 0.02 * (60 / 7) * (1 + 0.8), 6); // two equal plays: the largest in full, the other less 20% overlap
  });

  it("locked numbers keep the owner goal and use its horizon", () => {
    const text = lockedNumbers({ economics: econ, plays }, { statement: "Reach 50 customers", target: { metric: "customers", baseline: 20, desired: 50, mode: "total" }, horizonDays: 60 });
    expect(text).toMatch(/TOTAL: ≈\S+ new customers in 60 days/);
    expect(text).toMatch(/by day 60: what these plays support/);
    expect(text).toMatch(/OWNER GOAL .*"Reach 50 customers" within 60 days/);
    expect(text).toMatch(/GOAL GAP/);
    expect(playsGoalGap({ economics: econ, plays }, { target: { metric: "customers", baseline: 20, desired: 50, mode: "total" }, horizonDays: 60 }).state).not.toBe("unknown");
  });

  it("the North Star check ignores the horizon number itself", () => {
    expect(lintPlanFit({ channels: [], northStar: { target: "≈27 new customers by day 45" } }, { lockedCustomers: 27, horizonDays: 45 })).toEqual([]);
    expect(lintPlanFit({ channels: [], northStar: { target: "50 customers by day 45" } }, { lockedCustomers: 27, horizonDays: 45 })[0]?.message).toMatch(/by day 45/);
  });
});
