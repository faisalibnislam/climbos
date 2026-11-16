import { afterEach, describe, expect, it, vi } from "vitest";
import { weekOf } from "../../convex/playResults";
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

describe("weekly report correction history", () => {
  afterEach(() => vi.restoreAllMocks());
  it("rejects a blind overwrite of an existing report", async () => {
    const f = await fixture();
    await f.owner.client.mutation(api.playResults.log, f.args);
    await expect(f.owner.client.mutation(api.playResults.log, { ...f.args, reach: 200 })).rejects.toThrow(/changed|reload/i);
    expect((await f.t.run(ctx => ctx.db.query("playResults").collect()))[0].reach).toBe(100);
  });

  it("keeps revisions, refuses stale editors and learns only the current report", async () => {
    const f = await fixture();
    const weekStart = weekOf(Date.now());
    const lookup = { slug: f.slug, strategyId: f.strategyId, playName: f.args.playName, weekStart };
    await f.owner.client.mutation(api.playResults.log, { ...f.args, repeatCustomers: 2, retainedRevenueMinor: 9876 });
    const first = (await f.owner.client.query(api.playResults.weekForPlay, lookup)).row!;
    const correction = { ...f.args, expectedResultId: first.id, expectedRevision: first.revision, reach: 200 };
    await f.owner.client.mutation(api.playResults.log, correction);
    await expect(f.owner.client.mutation(api.playResults.log, { ...correction, reach: 300 })).rejects.toThrow(/changed/);
    const latest = (await f.owner.client.query(api.playResults.weekForPlay, lookup)).row!;
    expect(latest).toMatchObject({ id: first.id, revision: 2, reach: 200 });
    expect(latest.repeatCustomers).toBeUndefined();
    const page1 = await f.owner.client.query(api.playResults.weeklyHistoryPage, { slug: f.slug, resultId: first.id, paginationOpts: { numItems: 1, cursor: null } });
    expect(page1.page[0]).toMatchObject({ revision: 2, current: true, snapshot: { reach: 200 } });
    const page2 = await f.owner.client.query(api.playResults.weeklyHistoryPage, { slug: f.slug, resultId: first.id, paginationOpts: { numItems: 1, cursor: page1.continueCursor } });
    expect(page2.page[0]).toMatchObject({ revision: 1, current: false, snapshot: { reach: 100, repeatCustomers: 2, retainedRevenueMinor: 9876, stepNames: ["Paying customers"] } });
    expect(page2.page[0].snapshot).not.toHaveProperty("enteredBy");
    const view = await f.owner.client.query(api.playResults.forStrategy, { slug: f.slug, strategyId: f.strategyId });
    expect(view.byPlay["Weekly play"]).toMatchObject({ weeks: 1, reach: 200, customers: 10 });
    expect(await f.t.query(internal.playResults.briefFor, { orgId: f.orgId })).toContain("reached 200");
    for (const table of ["approvals", "actionReceipts", "workflowRuns"] as const) expect(await f.t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
  });

  it("loads and corrects an older week beyond the old 400-row scan, and preserves a legacy snapshot", async () => {
    const f = await fixture();
    const weekStart = weekOf(Date.now());
    await f.t.run(async ctx => {
      for (let i = 0; i < 405; i++) await ctx.db.insert("playResults", { orgId: f.orgId, strategyId: f.strategyId, playName: `AAA ${i}`, weekStart, reach: 1, steps: [1], spendUsd: 0, ownerHours: 0, enteredBy: f.owner.userId, updatedAt: Date.now() });
      await ctx.db.insert("playResults", { orgId: f.orgId, strategyId: f.strategyId, playName: "Old weekly name", playId: "weekly-play", weekStart, reach: 100, steps: [10], spendUsd: 1, ownerHours: 2, enteredBy: f.owner.userId, updatedAt: Date.now() });
    });
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 21 * 86400000);
    const row = (await f.owner.client.query(api.playResults.weekForPlay, { slug: f.slug, strategyId: f.strategyId, playName: "Weekly play", weekStart })).row!;
    expect(row).toMatchObject({ revision: 0, spendUsd: 1 });
    await f.owner.client.mutation(api.playResults.log, { ...f.args, weekStart, expectedResultId: row.id, expectedRevision: 0 });
    const rows = await f.t.run(ctx => ctx.db.query("playResults").collect());
    expect(rows).toHaveLength(406);
    const history = await f.owner.client.query(api.playResults.weeklyHistoryPage, { slug: f.slug, resultId: row.id, paginationOpts: { numItems: 10, cursor: null } });
    expect(history.page).toHaveLength(2);
    expect(history.page[1]).toMatchObject({ kind: "legacy_snapshot", revision: 0, snapshot: { spendUsd: 1, ownerHours: 2 } });
    expect(history.page[1].snapshot.spendCurrency).toBeUndefined();
    await expect(f.owner.client.mutation(api.playResults.log, { ...f.args, weekStart: weekStart - 7 * 86400000 })).rejects.toThrow(/before/);
    await expect(f.owner.client.mutation(api.playResults.log, { ...f.args, weekStart: Date.now() + 14 * 86400000 })).rejects.toThrow(/hasn't started/);
  });

  it("corrects saved currency without converting it after a settings change", async () => {
    const f = await fixture();
    await f.owner.client.mutation(api.playResults.log, f.args);
    const row = (await f.t.run(ctx => ctx.db.query("playResults").collect()))[0];
    await f.t.run(ctx => ctx.db.patch(f.businessId, { currency: "USD" }));
    const correction = { ...f.args, expectedResultId: row._id, expectedRevision: 1, expectedWorkspaceCurrency: "USD", spendUsd: 9.876 };
    await expect(f.owner.client.mutation(api.playResults.log, { ...correction, expectedWorkspaceCurrency: "KWD" })).rejects.toThrow(/currency changed/);
    await f.owner.client.mutation(api.playResults.log, correction);
    expect(await f.t.run(ctx => ctx.db.get(row._id))).toMatchObject({ spendCurrency: "KWD", spendUsd: 9.876 });
  });

  it("rejects duplicates and protects history from other tenants and viewers from edits", async () => {
    const f = await fixture();
    await f.owner.client.mutation(api.playResults.log, f.args);
    const row = (await f.t.run(ctx => ctx.db.query("playResults").collect()))[0];
    const viewer = await asNewUser(f.t, "weekly-history-viewer@example.com"), other = await asNewUser(f.t, "weekly-history-other@example.com");
    const otherOrg = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Other" });
    await f.t.run(ctx => ctx.db.insert("memberships", { orgId: f.orgId, userId: viewer.userId, role: "viewer", status: "active", createdAt: Date.now() }));
    const historyArgs = { slug: f.slug, resultId: row._id, paginationOpts: { numItems: 10, cursor: null } };
    expect((await viewer.client.query(api.playResults.weeklyHistoryPage, historyArgs)).page).toHaveLength(1);
    await expect(viewer.client.mutation(api.playResults.log, { ...f.args, expectedResultId: row._id, expectedRevision: 1 })).rejects.toThrow();
    await expect(other.client.query(api.playResults.weeklyHistoryPage, { ...historyArgs, slug: otherOrg.slug })).rejects.toThrow();
    await expect(other.client.query(api.playResults.weekForPlay, { slug: otherOrg.slug, strategyId: f.strategyId, playName: "Weekly play", weekStart: row.weekStart })).rejects.toThrow();
    await f.t.run(async ctx => { const { _id: _i, _creationTime: _c, ...data } = row; await ctx.db.insert("playResults", data); });
    await expect(f.owner.client.mutation(api.playResults.log, { ...f.args, expectedResultId: row._id, expectedRevision: 1 })).rejects.toThrow(/Conflicting/);
    expect(await f.owner.client.query(api.playResults.weekForPlay, { slug: f.slug, strategyId: f.strategyId, playName: "Weekly play", weekStart: row.weekStart })).toMatchObject({ row: null, issue: expect.stringContaining("Conflicting") });
  });

  it("exports and purges weekly versions within their workspace", async () => {
    const f = await fixture();
    await f.owner.client.mutation(api.playResults.log, f.args);
    const other = await asNewUser(f.t, "weekly-export-other@example.com");
    const otherOrg = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Other export" });
    const exported = JSON.parse(await f.t.query(internal.settings.exportData, { orgId: f.orgId }));
    expect(exported.weeklyReports).toHaveLength(1);
    expect(exported.weeklyReportRevisions).toHaveLength(1);
    expect(exported.weeklyReportHistoryLimited).toBe(false);
    expect(JSON.parse(await f.t.query(internal.settings.exportData, { orgId: otherOrg.orgId })).weeklyReportRevisions).toEqual([]);
    await f.t.mutation(internal.settings.purgeWorkspaceBatch, { orgId: f.orgId });
    expect(await f.t.run(ctx => ctx.db.query("playResultRevisions").collect())).toEqual([]);
  });
});
