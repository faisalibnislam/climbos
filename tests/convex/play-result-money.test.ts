import { describe, expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";

async function fixture(currency = "KWD") {
  const t = setup(), owner = await asNewUser(t, "weekly-money@example.com");
  const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Weekly reports" });
  await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", statement: "More customers", horizonDays: 90, monthlyAdBudget: 0 });
  const ids = await t.run(async ctx => {
    const business = (await ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", orgId)).first())!;
    await ctx.db.patch(business._id, { currency });
    const goal = (await ctx.db.query("goals").withIndex("by_org_status", q => q.eq("orgId", orgId).eq("status", "active")).first())!;
    const strategyId = await ctx.db.insert("strategies", { orgId, businessId: business._id, goalId: goal._id, version: 1, status: "approved", summary: "Weekly plan", audiences: [], positioning: "p", channels: [], constraints: [], measurementPlan: "m", reviewDate: "2026-11-01", sourceFactIds: [], generationCostMicros: 0, createdAt: Date.now(), expert: { diagnosis: "d", affordableCac: "unknown", notDoing: [], northStar: { metric: "m", baseline: "unknown", target: "unknown" }, leadingIndicators: [], phases: [], weekOneChecklist: [], risks: [], plays: [{ id: "weekly-play", name: "Weekly play", kind: "bankable", horizonDays: 90, model: { weeklyReach: 100, steps: [{ name: "Paying customers", rate: 0.1 }], monthlySpendUsd: 0, ownerHoursPerWeek: 1 } }] } } as never);
    return { strategyId, businessId: business._id };
  });
  const args = { slug, strategyId: ids.strategyId, playName: "Weekly play", reach: 100, steps: [10], spendUsd: 12.345, currency, ownerHours: 1 };
  return { t, owner, slug, orgId, ...ids, args };
}

describe("weekly result money provenance", () => {
  it("preserves exact units in storage, owner view and future plans, then withholds incompatible costs", async () => {
    const f = await fixture();
    await f.owner.client.mutation(api.playResults.log, { ...f.args, retainedRevenueMinor: 12345, retainedContributionMinor: -2345 });
    const row = (await f.t.run(ctx => ctx.db.query("playResults").collect()))[0];
    expect(row).toMatchObject({ spendUsd: 12.345, spendCurrency: "KWD", retentionCurrency: "KWD" });
    let view = await f.owner.client.query(api.playResults.forStrategy, { slug: f.slug, strategyId: f.strategyId });
    expect(view.byPlay["Weekly play"]).toMatchObject({ spendUsd: 12.345, spendCurrency: "KWD", spendIssue: null });
    expect(view.byPlay["Weekly play"]).toMatchObject({ expectedByNow: null, status: "forecast_unknown" });
    expect(view.byPlay["Weekly play"].entries[0].spendCurrency).toBe("KWD");
    let brief = await f.t.query(internal.playResults.briefFor, { orgId: f.orgId });
    expect(brief).toContain("12.345"); expect(brief).toContain("KWD"); expect(brief).not.toContain("spent $12");
    await f.t.run(ctx => ctx.db.patch(f.businessId, { currency: "USD" }));
    await expect(f.owner.client.mutation(api.playResults.log, { ...f.args, spendUsd: 10 })).rejects.toThrow(/currency/);
    expect(await f.t.run(ctx => ctx.db.get(row._id))).toEqual(row);
    view = await f.owner.client.query(api.playResults.forStrategy, { slug: f.slug, strategyId: f.strategyId });
    expect(view.byPlay["Weekly play"]).toMatchObject({ spendUsd: null, spendIssue: expect.stringContaining("KWD") });
    expect(view.byPlay["Weekly play"].retention.revenueByCurrency).toEqual([{ currency: "KWD", netRevenueMinor: 12345, weeksReported: 1 }]);
    brief = await f.t.query(internal.playResults.briefFor, { orgId: f.orgId });
    expect(brief).toContain("spend unavailable"); expect(brief).not.toContain("spent $12");
    for (const table of ["approvals", "actionReceipts", "workflowRuns"] as const) expect(await f.t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
  });

  it("does not assume currency for old positive amounts or new callers omitting it", async () => {
    const f = await fixture("USD");
    await expect(f.owner.client.mutation(api.playResults.log, { ...f.args, spendUsd: 10, currency: undefined })).rejects.toThrow(/currency/);
    await f.owner.client.mutation(api.playResults.log, { ...f.args, spendUsd: 10 });
    await f.t.run(async ctx => {
      const row = (await ctx.db.query("playResults").collect())[0];
      await ctx.db.patch(row._id, { spendCurrency: undefined });
    });
    expect((await f.owner.client.query(api.playResults.forStrategy, { slug: f.slug, strategyId: f.strategyId })).byPlay["Weekly play"]).toMatchObject({ spendUsd: null, spendIssue: expect.stringContaining("no confirmed currency") });
    expect(await f.t.query(internal.playResults.briefFor, { orgId: f.orgId })).toContain("spend unavailable");
  });

  it.each([["USD", 12.345], ["JPY", 10.1], ["KWD", 1.2345]])("rejects unsupported precision for %s", async (currency, spendUsd) => {
    const f = await fixture(currency as string);
    await expect(f.owner.client.mutation(api.playResults.log, { ...f.args, spendUsd: spendUsd as number })).rejects.toThrow(/decimal places/);
    expect(await f.t.run(ctx => ctx.db.query("playResults").collect())).toEqual([]);
  });

  it("supports explicit zero without inventing a currency, rejects invalid weeks and denies viewers and outsiders", async () => {
    const f = await fixture();
    await f.t.run(ctx => ctx.db.patch(f.businessId, { currency: "" }));
    const args = { ...f.args, spendUsd: 0, currency: undefined };
    await expect(f.owner.client.mutation(api.playResults.log, { ...args, weekStart: NaN })).rejects.toThrow(/valid reporting week/);
    await expect(f.owner.client.mutation(api.playResults.log, { ...args, retainedContributionMinor: -1 })).rejects.toThrow(/currency/);
    const viewer = await asNewUser(f.t, "weekly-viewer@example.com"), other = await asNewUser(f.t, "weekly-other@example.com");
    const otherOrg = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Other workspace" });
    await f.t.run(ctx => ctx.db.insert("memberships", { orgId: f.orgId, userId: viewer.userId, role: "viewer", status: "active", createdAt: Date.now() }));
    await expect(viewer.client.mutation(api.playResults.log, args)).rejects.toThrow();
    await expect(other.client.mutation(api.playResults.log, { ...args, slug: otherOrg.slug })).rejects.toThrow();
    await f.owner.client.mutation(api.playResults.log, args);
    const view = await viewer.client.query(api.playResults.forStrategy, { slug: f.slug, strategyId: f.strategyId });
    expect(view.byPlay["Weekly play"]).toMatchObject({ spendUsd: 0, spendCurrency: null, spendIssue: null });
    expect((await f.t.run(ctx => ctx.db.query("playResults").collect()))[0].spendCurrency).toBeUndefined();
    await expect(other.client.query(api.playResults.forStrategy, { slug: otherOrg.slug, strategyId: f.strategyId })).rejects.toThrow();
  });
});
