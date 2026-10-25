import { describe, expect, it } from "vitest";
import { lintFeasibility, lintGrowthCashReserve } from "../../shared/agents/specs";
import { canDriveWork, planQuality, type AgentQuality } from "../../shared/agents/quality";
import { growthCashReserveConstraint, type Economics } from "../../shared/agents/economics";
import type { PlanConstraints } from "../../shared/agents/types";

// 10 customers a week; cash 300/week for "Partner referrals". 130 × 50% = 65/month contribution, no churn.
const play = (name: string, monthlyCash: number, rate = 0.1, low?: number) => ({
  name,
  kind: "bankable",
  unit: "customers",
  horizonDays: 28,
  model: { weeklyReach: 100, steps: [{ name: "paid", rate, ...(low !== undefined ? { low, high: rate + 0.02 } : {}) }], monthlySpendUsd: monthlyCash, otherMonthlyUsd: 0, ownerHoursPerWeek: 1 },
});
const draft: Economics = { revenuePerCustomerMonthUsd: 1, grossMargin: 0.1, monthlyChurn: 0.5, basis: "draft", currency: "USD" };
const owner = { revenuePerCustomerMonthUsd: 130, grossMargin: 0.5, monthlyChurn: 0 };
const limits = (reserveUsd: number, paymentLagDays: number, extra: Partial<PlanConstraints> = {}): PlanConstraints => ({ currency: "USD", growthCashTiming: { reserveUsd, paymentLagDays, horizonDays: 28, ownerEconomics: owner }, ...extra });

describe("growth cash reserve plan check", () => {
  it("rejects a selected set whose most-likely low point exceeds the reserve, with a computed fix", () => {
    // Referrals alone: low point −750 at a 14-day delay. Adding a profitable 2,600/month play takes it below −1,800 by week 2.
    const plays = [play("Partner referrals", 1_300), play("Paid search", 2_600)];
    const issues = lintGrowthCashReserve(plays, limits(1_000, 14), draft);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: "error", rule: "growth_cash_reserve", path: "plays" });
    expect(issues[0].message).toContain("Partner referrals + Paid search");
    expect(issues[0].message).toContain("owner-reported growth reserve is $1,000");
    expect(issues[0].message).toContain('Deferring "Paid search" (computed) keeps the low point at -$750, within the reserve.');
    // lintFeasibility carries the same check alongside the monthly limits.
    expect(lintFeasibility(plays, limits(1_000, 14), draft).map((i) => i.rule)).toContain("growth_cash_reserve");
  });

  it("says when deferring the heaviest play still isn't enough", () => {
    const issues = lintGrowthCashReserve([play("Partner referrals", 1_300), play("Paid search", 2_600)], limits(100, 14), draft);
    expect(issues[0].severity).toBe("error");
    expect(issues[0].message).toContain('Even without "Paid search" the low point is -$750');
  });

  it("uses the owner's confirmed economics, not the draft's", () => {
    // With the draft's 0.10/month contribution the low point would be −1,200; owner numbers give −150.
    expect(lintGrowthCashReserve([play("Partner referrals", 1_300)], limits(200, 0), draft)).toEqual([]);
  });

  it("warns when only the low end of the customer range runs past the reserve", () => {
    const issues = lintGrowthCashReserve([play("Partner referrals", 1_300, 0.1, 0.01)], limits(200, 0), draft);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: "warn", rule: "growth_cash_reserve" });
    expect(issues[0].message).toContain("low end of the customer range (P10)");
  });

  it("does not check against assumed inputs", () => {
    const plays = [play("Partner referrals", 1_300)];
    expect(lintGrowthCashReserve(plays, { currency: "USD" }, draft)).toEqual([]);
    expect(lintGrowthCashReserve(plays, limits(0, 14), undefined)).toEqual([]);
    // Unknown churn: customer payments can't be timed, so there's no low point to compare.
    const noChurn = { currency: "USD", growthCashTiming: { reserveUsd: 0, paymentLagDays: 14, horizonDays: 28, ownerEconomics: { revenuePerCustomerMonthUsd: 130, grossMargin: 0.5 } } };
    expect(lintGrowthCashReserve(plays, noChurn, { revenuePerCustomerMonthUsd: 130, grossMargin: 0.5, basis: "", currency: "USD" })).toEqual([]);
    // Plays with no cash cost never fall below zero.
    expect(lintGrowthCashReserve([play("Partner referrals", 0)], limits(0, 30), draft)).toEqual([]);
  });

  it("builds the constraint only from reported inputs usable in the plan currency", () => {
    expect(growthCashReserveConstraint({ reserveMinor: 100_000, currency: "USD", paymentLagDays: 14 }, { ...owner, ownerHourUsd: 80 } as never, "USD", 28)).toEqual({ reserveUsd: 1_000, paymentLagDays: 14, horizonDays: 28, ownerEconomics: owner });
    expect(growthCashReserveConstraint({ reserveMinor: 100_000, currency: "USD", paymentLagDays: null }, owner, "USD", 28)).toBeNull();
    expect(growthCashReserveConstraint({ reserveMinor: null, currency: "USD", paymentLagDays: 14 }, owner, "USD", 28)).toBeNull();
    expect(growthCashReserveConstraint({ reserveMinor: 100_000, currency: "EUR", paymentLagDays: 14 }, owner, "USD", 28)).toBeNull();
    expect(growthCashReserveConstraint(null, owner, "USD", 28)).toBeNull();
    expect(growthCashReserveConstraint({ reserveMinor: 0, currency: "USD", paymentLagDays: 0 }, undefined, "USD", 90)).toEqual({ reserveUsd: 0, paymentLagDays: 0, horizonDays: 90 });
  });

  it("fails plan quality, blocking approval, when the shortfall survives revision; a P10-only warning does not", () => {
    const plays = [play("Partner referrals", 1_300), play("Paid search", 2_600)];
    const agent = (lint: ReturnType<typeof lintGrowthCashReserve>): AgentQuality => ({ agentId: "growth_strategy", shipped: true, gatesPassed: true, average: 8, rounds: 2, errors: Object.fromEntries(lint.filter((l) => l.severity === "error").map((l) => [l.rule, 1])), researchSources: 2 });
    const failed = planQuality([agent(lintGrowthCashReserve(plays, limits(1_000, 14), draft))]);
    expect(failed.state).toBe("failed");
    expect(failed.reasons.join(" ")).toContain("cash you set aside");
    expect(canDriveWork(failed)).toBe(false);
    const warned = planQuality([agent(lintGrowthCashReserve([play("Partner referrals", 1_300, 0.1, 0.01)], limits(200, 0), draft))]);
    expect(canDriveWork(warned)).toBe(true);
  });

  it("treats going over the monthly growth-cash limit as a hard failure too", () => {
    const issues = lintFeasibility([play("Partner referrals", 1_300)], { currency: "USD", monthlyGrowthCashUsd: 500 }, draft);
    expect(issues.map((i) => i.rule)).toEqual(["growth_cash"]);
    const agent: AgentQuality = { agentId: "growth_strategy", shipped: true, gatesPassed: true, average: 8, rounds: 2, errors: { growth_cash: 1 }, researchSources: 2 };
    const q = planQuality([agent]);
    expect(q.state).toBe("failed");
    expect(q.reasons.join(" ")).toContain("monthly growth cash you said you can commit");
    expect(canDriveWork(q)).toBe(false);
    // Within the limit: no finding.
    expect(lintFeasibility([play("Partner referrals", 1_300)], { currency: "USD", monthlyGrowthCashUsd: 1_300 }, draft)).toEqual([]);
  });
});
