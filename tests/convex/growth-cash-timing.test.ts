import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { asNewUser, setup, type T } from "./helpers";

async function workspaceWithPlan(t: T, email: string) {
  const owner = await asNewUser(t, email);
  const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: `Cash ${email}` });
  await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", statement: "More customers", horizonDays: 28, monthlyAdBudget: 2_000 });
  await t.run(async (ctx) => {
    const business = (await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", orgId as Id<"organizations">)).first())!;
    const goalId = (await ctx.db.query("goals").withIndex("by_org_status", (q) => q.eq("orgId", orgId as Id<"organizations">).eq("status", "active")).first())!._id;
    await ctx.db.patch(business._id, { unitEconomics: { revenuePerCustomerMonthUsd: 130, grossMargin: 0.5, monthlyChurn: 0, updatedAt: 1 } });
    await ctx.db.insert("strategies", {
      orgId: orgId as Id<"organizations">, businessId: business._id, goalId, version: 1, status: "approved", summary: "s", audiences: [], positioning: "p", channels: [], constraints: [], measurementPlan: "m", reviewDate: "2026-11-01", sourceFactIds: [], generationCostMicros: 0, createdAt: Date.now(),
      expert: { diagnosis: "d", affordableCac: "a", notDoing: [], northStar: { metric: "m", baseline: "0", target: "10" }, leadingIndicators: [], phases: [], weekOneChecklist: [], risks: [],
        economics: { revenuePerCustomerMonthUsd: 1, grossMargin: 0.1, monthlyChurn: 0.5, basis: "planner" },
        plays: [{ id: "pl_cash01", name: "Partner referrals", kind: "bankable", horizonDays: 28, unit: "customers", model: { weeklyReach: 100, steps: [{ name: "paid", rate: 0.1 }], monthlySpendUsd: 1_000, otherMonthlyUsd: 300, ownerHoursPerWeek: 1 } }] },
    } as never);
  });
  return { owner, slug, orgId: orgId as Id<"organizations"> };
}

describe("growth cash timing", () => {
  it("keeps unknown inputs unknown, then times cash from owner-reported inputs", async () => {
    const t = setup();
    const { owner, slug } = await workspaceWithPlan(t, "cash-owner@example.com");
    const before = (await owner.client.query(api.workspace.plan, { slug })).strategy!.expert as { portfolioComparisons?: { cashTiming?: { mostLikely: unknown; missing: string[]; reserveUsd: number | null } } };
    expect(before.portfolioComparisons?.cashTiming).toMatchObject({ mostLikely: null, missing: ["payment_lag", "reserve"], reserveUsd: null });

    await owner.client.mutation(api.workspace.setGrowthCashTiming, { slug, reserve: 1_000, paymentLagDays: 14 });
    const view = await owner.client.query(api.workspace.plan, { slug });
    const timing = (view.strategy!.expert as { portfolioComparisons: { cashTiming: { reserveUsd: number; paymentLagDays: number; currency: string; selected: string[]; mostLikely: { lowestBalanceUsd: number; lowestWeek: number; reserveCovers: boolean }; unconfirmedEconomics: string[] } } }).portfolioComparisons.cashTiming;
    expect(timing).toMatchObject({ reserveUsd: 1_000, paymentLagDays: 14, currency: "USD", selected: ["Partner referrals"], unconfirmedEconomics: [] });
    expect(timing.mostLikely.lowestBalanceUsd).toBeCloseTo(-750, 6);
    expect(timing.mostLikely).toMatchObject({ lowestWeek: 3, reserveCovers: true });
    // Plans whose snapshot predates cash timing (v22) never used it, so changing it doesn't mark them stale.
    expect(view.staleInputs).toMatchObject({ cashTiming: false, requiresRefresh: false });

    const stored = await t.run(async (ctx) => (await ctx.db.query("businesses").collect()).find((b) => b.growthCashTiming)!.growthCashTiming);
    expect(stored).toMatchObject({ reserveMinor: 100_000, currency: "USD", paymentLagDays: 14, provenance: "owner_reported" });

    // Leaving a field out keeps it; null clears it.
    await owner.client.mutation(api.workspace.setGrowthCashTiming, { slug, paymentLagDays: 0 });
    const kept = await t.run(async (ctx) => (await ctx.db.query("businesses").collect()).find((b) => b.growthCashTiming)!.growthCashTiming);
    expect(kept).toMatchObject({ reserveMinor: 100_000, paymentLagDays: 0 });
    await owner.client.mutation(api.workspace.setGrowthCashTiming, { slug, reserve: null, paymentLagDays: null });
    expect(await t.run(async (ctx) => (await ctx.db.query("businesses").collect()).some((b) => b.growthCashTiming))).toBe(false);
  });

  it("rejects invalid values, viewers, and other tenants", async () => {
    const t = setup();
    const { owner, slug, orgId } = await workspaceWithPlan(t, "cash-perm@example.com");
    const other = await workspaceWithPlan(t, "cash-other@example.com");
    const viewer = await asNewUser(t, "cash-viewer@example.com");
    await t.run(async (ctx) => ctx.db.insert("memberships", { orgId, userId: viewer.userId, role: "viewer", status: "active", createdAt: Date.now() }));

    await expect(owner.client.mutation(api.workspace.setGrowthCashTiming, { slug, reserve: -1 })).rejects.toThrow(/reserve looks wrong/i);
    await expect(owner.client.mutation(api.workspace.setGrowthCashTiming, { slug, paymentLagDays: 2.5 })).rejects.toThrow(/whole number/i);
    await expect(owner.client.mutation(api.workspace.setGrowthCashTiming, { slug, paymentLagDays: 400 })).rejects.toThrow(/whole number/i);
    await expect(owner.client.mutation(api.workspace.setGrowthCashTiming, { slug })).rejects.toThrow(/enter a reserve/i);
    await expect(viewer.client.mutation(api.workspace.setGrowthCashTiming, { slug, reserve: 500 })).rejects.toThrow(/can't/i);
    await expect(other.owner.client.mutation(api.workspace.setGrowthCashTiming, { slug, reserve: 500 })).rejects.toThrow();

    // Viewers can read the computed view but not change it; another tenant's input never leaks in.
    await other.owner.client.mutation(api.workspace.setGrowthCashTiming, { slug: other.slug, reserve: 9_999, paymentLagDays: 3 });
    const viewed = (await viewer.client.query(api.workspace.plan, { slug })).strategy!.expert as { portfolioComparisons: { cashTiming: { reserveUsd: number | null; paymentLagDays: number | null } } };
    expect(viewed.portfolioComparisons.cashTiming).toMatchObject({ reserveUsd: null, paymentLagDays: null });
  });

  it("does not convert a reserve saved in another currency", async () => {
    const t = setup();
    const { owner, slug, orgId } = await workspaceWithPlan(t, "cash-fx@example.com");
    await owner.client.mutation(api.workspace.setGrowthCashTiming, { slug, reserve: 1_000, paymentLagDays: 0 });
    await t.run(async (ctx) => {
      const business = (await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", orgId)).first())!;
      await ctx.db.patch(business._id, { growthCashTiming: { ...business.growthCashTiming!, currency: "EUR" } });
    });
    const timing = ((await owner.client.query(api.workspace.plan, { slug })).strategy!.expert as { portfolioComparisons: { cashTiming: { reserveUsd: number | null; reserveCurrencyMismatch: boolean; paymentLagDays: number } } }).portfolioComparisons.cashTiming;
    expect(timing).toMatchObject({ reserveUsd: null, reserveCurrencyMismatch: true, paymentLagDays: 0 });
    // Saving again in the business currency drops the mismatched reserve rather than relabelling it.
    await owner.client.mutation(api.workspace.setGrowthCashTiming, { slug, paymentLagDays: 7 });
    const stored = await t.run(async (ctx) => (await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", orgId)).first())!.growthCashTiming);
    expect(stored).toMatchObject({ currency: "USD", paymentLagDays: 7 });
    expect(stored?.reserveMinor).toBeUndefined();
  });
});
