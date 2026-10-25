import { describe, expect, it } from "vitest";
import { applyOwnerEconomics, growthCashTiming, selectPortfolio, type Economics, type PlayLike } from "../../shared/agents/economics";

// 100 reached a week × 10% paid = 10 customers a week; 1,300/month cash = 300 a week.
const play = (over: Partial<PlayLike["model"]> = {}): PlayLike => ({
  name: "Partner referrals",
  kind: "bankable",
  unit: "customers",
  horizonDays: 28,
  model: { weeklyReach: 100, steps: [{ name: "paid", rate: 0.1 }], monthlySpendUsd: 1_000, otherMonthlyUsd: 300, ownerHoursPerWeek: 1, ...over },
});
// 130 revenue × 50% margin = 65 contribution a month = 15 a week; no churn.
const owned = (over: Partial<Economics> = {}): Economics => applyOwnerEconomics(
  { revenuePerCustomerMonthUsd: 1, grossMargin: 0.1, monthlyChurn: 0.5, basis: "", currency: "USD", ...over },
  { revenuePerCustomerMonthUsd: 130, grossMargin: 0.5, monthlyChurn: 0 },
);

describe("growth cash timing", () => {
  it("times customer contribution against growth costs when paid up front", () => {
    const t = growthCashTiming({ economics: owned(), plays: [play()] }, ["Partner referrals"], { horizonDays: 28, paymentLagDays: 0, reserveUsd: 100 })!;
    expect(t.horizonWeeks).toBe(4);
    expect(t.weeklyCashOutUsd).toBeCloseTo(300, 6);
    expect(t.cashOutOverPeriodUsd).toBeCloseTo(1_200, 6);
    expect(t.missing).toEqual([]);
    expect(t.unconfirmedEconomics).toEqual([]);
    // Week balances: −150, −150, 0, +300.
    expect(t.mostLikely).toMatchObject({ lowestWeek: 1, recoveredWeek: 3, reserveCovers: false });
    expect(t.mostLikely!.customers).toBeCloseTo(40, 6);
    expect(t.mostLikely!.lowestBalanceUsd).toBeCloseTo(-150, 6);
    expect(t.mostLikely!.endBalanceUsd).toBeCloseTo(300, 6);
    expect(t.mostLikely!.shortfallUsd).toBeCloseTo(50, 6);
    // No ranges: the low case equals the most-likely case.
    expect(t.lowCase!.lowestBalanceUsd).toBeCloseTo(-150, 6);
  });

  it("deepens and delays the low point when customers pay later", () => {
    const t = growthCashTiming({ economics: owned(), plays: [play()] }, ["Partner referrals"], { horizonDays: 28, paymentLagDays: 14, reserveUsd: 1_000 })!;
    // First payments arrive two weeks after each customer: −300, −600, −750, −750.
    expect(t.mostLikely!.lowestBalanceUsd).toBeCloseTo(-750, 6);
    expect(t.mostLikely).toMatchObject({ lowestWeek: 3, recoveredWeek: null, reserveCovers: true, shortfallUsd: null });
  });

  it("shows a deeper low point at the low end of the customer range", () => {
    const ranged = play({ steps: [{ name: "paid", rate: 0.1, low: 0.02, high: 0.12 }] });
    const t = growthCashTiming({ economics: owned(), plays: [ranged] }, ["Partner referrals"], { horizonDays: 28, paymentLagDays: 0 })!;
    expect(t.lowCase!.customers).toBeLessThan(t.mostLikely!.customers);
    expect(t.lowCase!.lowestBalanceUsd).toBeLessThan(t.mostLikely!.lowestBalanceUsd);
    expect(t.mostLikely!.reserveCovers).toBeNull();
    expect(t.missing).toEqual(["reserve"]);
  });

  it("keeps customer cash in untimed instead of assuming a payment delay or churn", () => {
    const noLag = growthCashTiming({ economics: owned(), plays: [play()] }, ["Partner referrals"], { horizonDays: 28 })!;
    expect(noLag.mostLikely).toBeNull();
    expect(noLag.lowCase).toBeNull();
    expect(noLag.missing).toEqual(["payment_lag", "reserve"]);
    expect(noLag.cashOutOverPeriodUsd).toBeCloseTo(1_200, 6);

    const noChurn = growthCashTiming({ economics: { revenuePerCustomerMonthUsd: 130, grossMargin: 0.5, basis: "", currency: "USD" }, plays: [play()] }, ["Partner referrals"], { horizonDays: 28, paymentLagDays: 0 })!;
    expect(noChurn.mostLikely).toBeNull();
    expect(noChurn.missing).toContain("churn");
    expect(noChurn.unconfirmedEconomics).toEqual(["revenue", "margin", "churn"]);
  });

  it("only counts the selected set and returns nothing without one", () => {
    const other = { ...play({ monthlySpendUsd: 5_000 }), name: "Paid search" };
    const t = growthCashTiming({ economics: owned(), plays: [play(), other] }, ["Partner referrals"], { horizonDays: 28, paymentLagDays: 0 })!;
    expect(t.weeklyCashOutUsd).toBeCloseTo(300, 6);
    expect(growthCashTiming({ economics: owned(), plays: [play()] }, [], { horizonDays: 28, paymentLagDays: 0 })).toBeNull();
  });

  it("follows the portfolio's selected set and play ramp", () => {
    const ramped = play({ rampWeeks: 4 });
    const out = { economics: owned(), plays: [ramped] };
    const pick = selectPortfolio(out, { horizonDays: 28 })!;
    const t = growthCashTiming(out, pick.selected, { horizonDays: 28, paymentLagDays: 0 })!;
    expect(t.mostLikely!.customers).toBeCloseTo(pick.customers, 6);
    // A ramp delays customers, so the low point is lower than at immediate full volume.
    expect(t.mostLikely!.lowestBalanceUsd).toBeLessThan(-150);
  });
});
