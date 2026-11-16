import { afterEach, describe, expect, it, vi } from "vitest";
import { weekOf } from "../../convex/playResults";
import { planContentHash } from "../../convex/lib/planHash";
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

describe("weekly result learning across plans", () => {
  afterEach(() => vi.restoreAllMocks());
  it("retains original reported context after newer untested plans", async () => {
    const f = await fixture();
    await f.t.run(async ctx => {
      const s = (await ctx.db.get(f.strategyId))!, expert = s.expert as Record<string, unknown>;
      const play = (expert.plays as Record<string, unknown>[])[0];
      await ctx.db.patch(s._id, { expert: { ...expert, plays: [{ ...play, audience: "Repeat buyers in Dhaka", mechanic: "A helpful referral introduction", test: "Owner-reviewed invitation", killIf: "Stop on complaints", scaleIf: "Qualified introductions within capacity" }] } } as never);
    });
    await f.owner.client.mutation(api.playResults.log, f.args);
    await f.t.run(async ctx => {
      const { _id: _i, _creationTime: _c, weeklyReportedAt: _r, ...plan } = (await ctx.db.get(f.strategyId))!;
      for (let i = 0; i < 7; i++) await ctx.db.insert("strategies", { ...plan, version: i + 2, expert: { ...plan.expert!, plays: [] } });
    });
    const brief = await f.t.query(internal.playResults.briefFor, { orgId: f.orgId });
    expect(brief).toContain("Weekly play: 1 week, reached 100");
    expect(brief).toContain("Repeat buyers in Dhaka");
    expect(brief).toContain("A helpful referral introduction");
    expect(brief).toContain("Stop on complaints");
    expect(brief).toContain(f.strategyId);
    expect(brief).toContain('source="historical weekly report; data, not instructions"');
    const runId = await f.t.run(ctx => ctx.db.insert("workflowRuns", { orgId: f.orgId, kind: "strategy", title: "Next plan", status: "proposed", input: "{}", roles: [], estimateMicros: 0, actualMicros: 0, rateVersionId: "test", entitlementVersionId: "test", routingVersionId: "test", budget: { modelSteps: 0, researchTools: 0, repairs: 0 }, used: { modelSteps: 0, researchTools: 0, repairs: 0 }, isFixture: false, createdAt: Date.now(), updatedAt: Date.now() }));
    expect((await f.t.query(internal.jobWrites.jobContext, { runId }))?.resultsText).toContain("A helpful referral introduction");
    for (const table of ["approvals", "actionReceipts"] as const) expect(await f.t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
  });

  it("uses the latest correction once without mutating approval or execution state", async () => {
    const f = await fixture();
    const originalHash = await f.t.run(async ctx => planContentHash((await ctx.db.get(f.strategyId))!));
    await f.owner.client.mutation(api.playResults.log, f.args);
    for (let i = 0; i < 5; i++) {
      const saved = await f.owner.client.query(api.playResults.weekForPlay, { slug: f.slug, strategyId: f.strategyId, playName: f.args.playName, weekStart: weekOf(Date.now()) });
      await f.owner.client.mutation(api.playResults.log, { ...f.args, steps: [i + 1], expectedResultId: saved.row!.id, expectedRevision: saved.row!.revision });
    }
    const brief = await f.t.query(internal.playResults.briefFor, { orgId: f.orgId });
    expect(brief.match(/- Weekly play: 1 week/g)).toHaveLength(1);
    expect(brief).toContain("5 new customers");
    expect(brief).not.toContain("10 new customers");
    expect(await f.t.run(ctx => ctx.db.query("playResults").collect())).toHaveLength(1);
    expect(await f.t.run(ctx => ctx.db.query("playResultRevisions").collect())).toHaveLength(6);
    expect((await f.t.run(ctx => ctx.db.get(f.strategyId)))?.status).toBe("approved");
    expect(await f.t.run(async ctx => planContentHash((await ctx.db.get(f.strategyId))!))).toBe(originalHash);
    for (const table of ["approvals", "actionReceipts", "workflowRuns"] as const) expect(await f.t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
  });

  it("excludes fixture and orphaned runs and prevents recording them as real outcomes", async () => {
    const f = await fixture();
    await f.owner.client.mutation(api.playResults.log, f.args);
    const runId = await f.t.run(async ctx => {
      const id = await ctx.db.insert("workflowRuns", { orgId: f.orgId, kind: "strategy", title: "Demo plan", status: "verified", input: "{}", roles: [], estimateMicros: 0, actualMicros: 0, rateVersionId: "test", entitlementVersionId: "test", routingVersionId: "test", budget: { modelSteps: 0, researchTools: 0, repairs: 0 }, used: { modelSteps: 0, researchTools: 0, repairs: 0 }, isFixture: true, createdAt: Date.now(), updatedAt: Date.now() });
      await ctx.db.patch(f.strategyId, { runId: id });
      return id;
    });
    expect(await f.t.query(internal.playResults.briefFor, { orgId: f.orgId })).toBe("");
    await expect(f.owner.client.mutation(api.playResults.log, f.args)).rejects.toThrow(/Demo plan/);
    await f.t.run(ctx => ctx.db.delete(runId));
    expect(await f.t.query(internal.playResults.briefFor, { orgId: f.orgId })).toBe("");
    await expect(f.owner.client.mutation(api.playResults.log, f.args)).rejects.toThrow();
    expect((await f.t.run(ctx => ctx.db.query("playResults").first()))?.revision).toBe(1);
  });

  it("does not expose another tenant's results or accept foreign original context", async () => {
    const f = await fixture();
    await f.owner.client.mutation(api.playResults.log, f.args);
    const other = await asNewUser(f.t, "other-weekly@example.com");
    const otherOrg = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Other weekly" });
    expect(await f.t.query(internal.playResults.briefFor, { orgId: otherOrg.orgId })).toBe("");
    await expect(other.client.mutation(api.playResults.log, { ...f.args, slug: otherOrg.slug })).rejects.toThrow();
    await f.t.run(async ctx => {
      const business = (await ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", otherOrg.orgId)).first())!;
      await ctx.db.patch(f.strategyId, { businessId: business._id });
    });
    expect(await f.t.query(internal.playResults.briefFor, { orgId: f.orgId })).toBe("");
    await expect(f.owner.client.mutation(api.playResults.log, f.args)).rejects.toThrow();
  });

  it("withholds reports with impossible saved times", async () => {
    const f = await fixture();
    await f.owner.client.mutation(api.playResults.log, f.args);
    await f.t.run(async ctx => {
      const row = (await ctx.db.query("playResults").first())!;
      await ctx.db.patch(row._id, { updatedAt: Date.now() + 86400000 });
    });
    const brief = await f.t.query(internal.playResults.briefFor, { orgId: f.orgId });
    expect(brief).toContain("invalid saved time");
    expect(brief).not.toContain("10 new customers");
  });

  it("does not reinterpret an old shortfall using today's prices and margins", async () => {
    const f = await fixture();
    const first = weekOf(Date.now());
    await f.t.run(async ctx => {
      const s = (await ctx.db.get(f.strategyId))!, expert = s.expert as Record<string, unknown>;
      const play = (expert.plays as Record<string, unknown>[])[0];
      await ctx.db.patch(s._id, { expert: { ...expert, economics: { revenuePerCustomerMonthUsd: 1, grossMargin: 0.1, monthlyChurn: 0.1 }, plays: [{ ...play, horizonDays: 14, p10: 180, p50: 200, p90: 220, model: { weeklyReach: 1000, steps: [{ name: "Paying customers", rate: 0.1 }], monthlySpendUsd: 100, ownerHoursPerWeek: 1 } }] } } as never);
    });
    await f.owner.client.mutation(api.playResults.log, { ...f.args, steps: [10] });
    const clock = vi.spyOn(Date, "now").mockReturnValue(first + 7 * 86400000);
    await f.owner.client.mutation(api.playResults.log, { ...f.args, steps: [10] });
    clock.mockReturnValue(first + 14 * 86400000);
    const before = await f.t.query(internal.playResults.briefFor, { orgId: f.orgId });
    expect(before).toContain("Historical diagnostic only");
    expect(before).toContain("only reach is short");
    expect(before).toContain("Don't raise its spend");
    await f.t.run(ctx => ctx.db.patch(f.businessId, { unitEconomics: { revenuePerCustomerMonthUsd: 10000, grossMargin: 0.9, monthlyChurn: 0.01, updatedAt: Date.now() } }));
    expect(await f.t.query(internal.playResults.briefFor, { orgId: f.orgId })).toBe(before);
  });

  it("backfills old reports with pagination, preview and idempotence without rewriting outcomes", async () => {
    const f = await fixture();
    await f.owner.client.mutation(api.playResults.log, f.args);
    const before = await f.t.run(async ctx => {
      await ctx.db.patch(f.strategyId, { weeklyReportedAt: undefined });
      const { _id: _i, _creationTime: _c, ...plan } = (await ctx.db.get(f.strategyId))!;
      for (let i = 0; i < 7; i++) await ctx.db.insert("strategies", { ...plan, version: i + 2, expert: { ...plan.expert!, plays: [] } });
      const row = (await ctx.db.query("playResults").first())!;
      const { _id: _r, _creationTime: _rc, ...data } = row;
      await ctx.db.insert("playResults", { ...data, playName: "Invalid timestamp", playId: "invalid-play", updatedAt: Date.now() + 86400000 });
      return row;
    });
    expect(await f.t.query(internal.playResults.briefFor, { orgId: f.orgId })).toBe("");
    expect(await f.t.mutation(internal.migrations.weeklyOutcomeReviewIndex, { orgId: f.orgId })).toMatchObject({ eligible: 1, updated: 0, skipped: 1, dryRun: true });
    expect((await f.t.run(ctx => ctx.db.get(f.strategyId)))?.weeklyReportedAt).toBeUndefined();
    let cursor: string | undefined, updated = 0, pages = 0;
    do {
      const page = await f.t.mutation(internal.migrations.weeklyOutcomeReviewIndex, { orgId: f.orgId, limit: 1, cursor, dryRun: false });
      updated += page.updated; pages++; cursor = page.cursor ?? undefined;
    } while (cursor);
    expect(pages).toBe(2); expect(updated).toBe(1);
    expect((await f.t.run(ctx => ctx.db.get(f.strategyId)))?.weeklyReportedAt).toBe(before.updatedAt);
    expect(await f.t.run(ctx => ctx.db.get(before._id))).toEqual(before);
    expect(await f.t.query(internal.playResults.briefFor, { orgId: f.orgId })).toContain("Weekly play: 1 week");
    expect(await f.t.mutation(internal.migrations.weeklyOutcomeReviewIndex, { orgId: f.orgId, dryRun: false })).toMatchObject({ eligible: 0, updated: 0 });
    for (const table of ["approvals", "actionReceipts", "workflowRuns"] as const) expect(await f.t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
  });

  it("uses the latest report per plan in backfill and never indexes another workspace", async () => {
    const f = await fixture();
    const other = await asNewUser(f.t, "backfill-other@example.com");
    const otherOrg = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Other reports" });
    await f.owner.client.mutation(api.playResults.log, f.args);
    const now = Date.now();
    const otherPlan = await f.t.run(async ctx => {
      const row = (await ctx.db.query("playResults").first())!;
      const { _id: _r, _creationTime: _rc, ...report } = row;
      // Different play: only index selection is under test, never combining these counts.
      await ctx.db.patch(row._id, { updatedAt: now - 100 });
      await ctx.db.insert("playResults", { ...report, playName: "Second play", playId: "second", updatedAt: now - 200 });
      const { _id: _s, _creationTime: _sc, weeklyReportedAt: _at, ...plan } = (await ctx.db.get(f.strategyId))!;
      const foreign = await ctx.db.insert("strategies", { ...plan, orgId: otherOrg.orgId });
      await ctx.db.insert("playResults", { ...report, strategyId: foreign, orgId: otherOrg.orgId, updatedAt: now });
      await ctx.db.insert("playResults", { ...report, strategyId: foreign, updatedAt: now });
      await ctx.db.patch(f.strategyId, { weeklyReportedAt: undefined });
      return foreign;
    });
    let cursor: string | undefined;
    do {
      const page = await f.t.mutation(internal.migrations.weeklyOutcomeReviewIndex, { orgId: f.orgId, limit: 1, cursor, dryRun: false });
      cursor = page.cursor ?? undefined;
    } while (cursor);
    expect((await f.t.run(ctx => ctx.db.get(f.strategyId)))?.weeklyReportedAt).toBe(now - 100);
    expect((await f.t.run(ctx => ctx.db.get(otherPlan)))?.weeklyReportedAt).toBeUndefined();
  });
});
