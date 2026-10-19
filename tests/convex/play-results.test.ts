import { describe, expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { asNewUser, setup } from "./helpers";

/** Owner logs a play's weekly results; plan vs actual is computed and the next plan's brief carries them. */
describe("play results", () => {
  it("logs a week, validates the funnel, and feeds the next plan", async () => {
    const t = setup();
    const owner = await asNewUser(t, "results@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Results Co" });
    await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", statement: "More customers", horizonDays: 90, monthlyAdBudget: 0 });
    const strategyId = await t.run(async (ctx) => {
      const business = (await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", orgId as Id<"organizations">)).first())!;
      const goalId = (await ctx.db.query("goals").withIndex("by_org_status", (q) => q.eq("orgId", orgId as Id<"organizations">).eq("status", "active")).first())!._id;
      return ctx.db.insert("strategies", {
        orgId: orgId as Id<"organizations">, businessId: business._id, goalId, version: 1, status: "approved", summary: "s", audiences: [], positioning: "p", channels: [], constraints: [], measurementPlan: "m", reviewDate: "2026-11-01", sourceFactIds: [], generationCostMicros: 0, createdAt: Date.now(),
        expert: { diagnosis: "d", affordableCac: "a", notDoing: [], northStar: { metric: "m", baseline: "0", target: "10" }, leadingIndicators: [], phases: [], weekOneChecklist: [], risks: [],
          plays: [{ name: "Agency outreach", kind: "bankable", p10: 4, p50: 9.75, p90: 18, horizonDays: 91, model: { weeklyReach: 250, steps: [{ name: "reply", rate: 0.02 }, { name: "paid", rate: 0.1 }], monthlySpendUsd: 0, ownerHoursPerWeek: 1 } }] },
      } as never);
    });
    await expect(owner.client.mutation(api.playResults.log, { slug, strategyId, playName: "Agency outreach", reach: 100, steps: [10, 20], spendUsd: 0, ownerHours: 1 })).rejects.toThrow(/bigger than the one before/);
    await owner.client.mutation(api.playResults.log, { slug, strategyId, playName: "Agency outreach", reach: 250, steps: [6, 1], spendUsd: 0, ownerHours: 1 });
    const view = await owner.client.query(api.playResults.forStrategy, { slug, strategyId });
    expect(view["Agency outreach"]).toMatchObject({ weeks: 1, reach: 250, customers: 1, status: "too_early" });
    const brief = await t.query(internal.playResults.briefFor, { orgId: orgId as Id<"organizations"> });
    expect(brief).toContain("reply 6/250 (2.4%, planned 2%)");
  });
});

describe("play lineage (S4, REQ-LEARN-04)", () => {
  it("results follow the play's stable ID when it is renamed", async () => {
    const t = setup();
    const owner = await asNewUser(t, "lineage@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Lineage Co" });
    await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", statement: "More customers", horizonDays: 90, monthlyAdBudget: 0 });
    const play = { id: "pl_fixed01", name: "Agency outreach", kind: "bankable", p10: 4, p50: 9.75, p90: 18, horizonDays: 91, model: { weeklyReach: 250, steps: [{ name: "reply", rate: 0.02 }, { name: "paid", rate: 0.1 }], monthlySpendUsd: 0, ownerHoursPerWeek: 1 } };
    const strategyId = await t.run(async (ctx) => {
      const business = (await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", orgId as Id<"organizations">)).first())!;
      const goalId = (await ctx.db.query("goals").withIndex("by_org_status", (q) => q.eq("orgId", orgId as Id<"organizations">).eq("status", "active")).first())!._id;
      return ctx.db.insert("strategies", {
        orgId: orgId as Id<"organizations">, businessId: business._id, goalId, version: 1, status: "approved", summary: "s", audiences: [], positioning: "p", channels: [], constraints: [], measurementPlan: "m", reviewDate: "2026-11-01", sourceFactIds: [], generationCostMicros: 0, createdAt: Date.now(),
        expert: { diagnosis: "d", affordableCac: "a", notDoing: [], northStar: { metric: "m", baseline: "0", target: "10" }, leadingIndicators: [], phases: [], weekOneChecklist: [], risks: [], plays: [play] },
      } as never);
    });
    await owner.client.mutation(api.playResults.log, { slug, strategyId, playName: "Agency outreach", reach: 250, steps: [6, 1], spendUsd: 0, ownerHours: 1 });
    const row = await t.run(async (ctx) => (await ctx.db.query("playResults").collect())[0]);
    expect(row.playId).toBe("pl_fixed01");
    // Rename the play; the logged week stays with it.
    await t.run(async (ctx) => {
      const s = (await ctx.db.get(strategyId))!;
      await ctx.db.patch(strategyId, { expert: { ...s.expert!, plays: [{ ...play, name: "Agency partner outreach" }] } } as never);
    });
    const view = await owner.client.query(api.playResults.forStrategy, { slug, strategyId });
    expect(view["Agency partner outreach"]).toMatchObject({ weeks: 1, reach: 250 });
    expect(view["Agency outreach"]).toBeUndefined();
  });
});
