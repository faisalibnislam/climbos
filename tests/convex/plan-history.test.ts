import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { asNewUser, makePaid, setup, type T } from "./helpers";

/** Plan version history: every version listed with why it changed and who approved it; restore makes a new version for approval. */

async function workspace(t: T, email: string) {
  const owner = await asNewUser(t, email);
  const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "History Co" });
  await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", statement: "More paying customers", horizonDays: 90, monthlyAdBudget: 300 });
  return { ...owner, slug, orgId: orgId as Id<"organizations"> };
}

async function buildPlan(t: T, w: { client: Awaited<ReturnType<typeof asNewUser>>["client"]; slug: string }) {
  await w.client.mutation(api.orgs.generatePlan, { slug: w.slug });
  await t.finishAllScheduledFunctions(() => undefined);
}

describe("Plan version history", () => {
  beforeEach(() => {
    process.env.CLIMBOS_ENGINE = "v2";
    process.env.CLIMBOS_FAKE_LLM = "ship";
  });
  afterEach(() => {
    delete process.env.CLIMBOS_ENGINE;
    delete process.env.CLIMBOS_FAKE_LLM;
  });

  it("lists versions with Latest / In use, reasons and approver, and restores parts as a new version", async () => {
    const t = setup();
    const w = await workspace(t, "history-owner@example.com");
    await makePaid(t, w.orgId);
    await buildPlan(t, w);
    const v1 = (await w.client.query(api.planHistory.versions, { slug: w.slug }))[0];
    await w.client.mutation(api.workspace.decidePlan, { slug: w.slug, strategyId: v1.id, decision: "approve" });
    await t.finishAllScheduledFunctions(() => undefined);
    // A second version, then make its summary and channels differ from v1.
    await buildPlan(t, w);
    let list = await w.client.query(api.planHistory.versions, { slug: w.slug });
    expect(list.map((v) => v.version)).toEqual([2, 1]);
    expect(list[0]).toMatchObject({ isLatest: true, inUse: false, status: "needs_approval" });
    expect(list[1]).toMatchObject({ isLatest: false, inUse: true, wasApproved: true, reason: "First plan" });
    expect(list[1].approvedBy).toBe("history-owner");
    await t.run(async (ctx) => {
      const v2 = (await ctx.db.get(list[0].id))!;
      await ctx.db.patch(v2._id, { summary: "A different summary.", channels: v2.channels.slice(0, 1) });
    });

    // Restore v1's channels into a new v3; v2 (still waiting) is replaced, v1 stays in use.
    const r = await w.client.mutation(api.planHistory.restore, { slug: w.slug, fromId: list[1].id, parts: ["channels"] });
    expect(r.version).toBe(3);
    const [v3, v2, v1doc] = await t.run(async (ctx) => Promise.all([ctx.db.get(r.strategyId), ctx.db.get(list[0].id), ctx.db.get(list[1].id)]));
    expect(v3!.status).toBe("needs_approval");
    expect(v3!.summary).toBe("A different summary.");
    expect(v3!.channels.map((c) => c.key)).toEqual(v1doc!.channels.map((c) => c.key));
    expect(v3!.channels.every((c) => c.status !== "active" && !c.cardId)).toBe(true);
    expect(v3!.approvalId).toBeTruthy();
    expect(v2!.status).toBe("superseded");
    expect(v1doc!.status).toBe("approved");

    list = await w.client.query(api.planHistory.versions, { slug: w.slug });
    expect(list[0]).toMatchObject({ version: 3, isLatest: true, reason: "Restored Channels from v1" });
    // Any version opens on the plan page.
    const view = await w.client.query(api.workspace.plan, { slug: w.slug, strategyId: list[2].id });
    expect(view.strategy?.version).toBe(1);

    // Approving the restored version puts it in use.
    await w.client.mutation(api.workspace.decidePlan, { slug: w.slug, strategyId: r.strategyId, decision: "approve" });
    list = await w.client.query(api.planHistory.versions, { slug: w.slug });
    expect(list.find((v) => v.inUse)?.version).toBe(3);
  });

  it("only editors restore, and the latest version can't be restored onto itself", async () => {
    const t = setup();
    const w = await workspace(t, "history-roles@example.com");
    await makePaid(t, w.orgId);
    await buildPlan(t, w);
    const [latest] = await w.client.query(api.planHistory.versions, { slug: w.slug });
    await expect(w.client.mutation(api.planHistory.restore, { slug: w.slug, fromId: latest.id, parts: ["summary"] })).rejects.toThrow(/already the latest/);
    await expect(w.client.mutation(api.planHistory.restore, { slug: w.slug, fromId: latest.id, parts: [] })).rejects.toThrow(/at least one/);
    const viewer = await asNewUser(t, "history-viewer@example.com");
    await t.run(async (ctx) => ctx.db.insert("memberships", { orgId: w.orgId, userId: viewer.userId, role: "viewer", status: "active", createdAt: Date.now() }));
    await expect(viewer.client.mutation(api.planHistory.restore, { slug: w.slug, fromId: latest.id, parts: ["summary"] })).rejects.toThrow();
  });

  it("requires a fresh plan after owner economics change before approval or play launch", async () => {
    const t = setup();
    const w = await workspace(t, "history-stale-economics@example.com");
    await makePaid(t, w.orgId);
    await buildPlan(t, w);
    const [plan] = await w.client.query(api.planHistory.versions, { slug: w.slug });

    await w.client.mutation(api.workspace.setUnitEconomics, {
      slug: w.slug,
      revenuePerCustomerMonthUsd: 250,
      grossMargin: 0.7,
      monthlyChurn: 0.04,
    });

    await expect(w.client.mutation(api.workspace.decidePlan, {
      slug: w.slug,
      strategyId: plan.id,
      decision: "approve",
    })).rejects.toThrow(/numbers changed after this plan was created/);

    const saved = await t.run((ctx) => ctx.db.get(plan.id));
    const refreshed = await w.client.query(api.workspace.plan, { slug: w.slug, strategyId: plan.id });
    expect(refreshed.strategy?.expert?.economics).toMatchObject({ revenuePerCustomerMonthUsd: 250, grossMargin: 0.7, monthlyChurn: 0.04 });
    expect(refreshed.strategy?.expert?.portfolio).toBeTruthy();
    const playId = (saved?.expert?.plays as { id?: string }[] | undefined)?.find((play) => play.id)?.id;
    expect(playId).toBeTruthy();
    await expect(w.client.mutation(api.workspace.startPlay, {
      slug: w.slug,
      strategyId: plan.id,
      playId: playId!,
    })).rejects.toThrow(/numbers changed after this plan was created/);
  });

  it("requires refresh when the owner-reported business stage changes after planning", async () => {
    const t = setup();
    const w = await workspace(t, "history-stale-stage@example.com");
    await makePaid(t, w.orgId);
    await buildPlan(t, w);
    const [plan] = await w.client.query(api.planHistory.versions, { slug: w.slug });
    const saved = await t.run((ctx) => ctx.db.get(plan.id));
    const playId = (saved?.expert?.plays as { id?: string }[] | undefined)?.find((play) => play.id)?.id;
    expect(playId).toBeTruthy();

    await w.client.mutation(api.orgs.saveBusinessDetails, { slug: w.slug, lifecycleStage: "growth" });
    const view = await w.client.query(api.workspace.plan, { slug: w.slug, strategyId: plan.id });
    expect(view.staleInputs).toEqual({ ownerEconomics: false, lifecycleStage: true, funnel: false, goal: false, businessProfile: false, businessFacts: false, requiresRefresh: true });
    await expect(w.client.mutation(api.workspace.decidePlan, { slug: w.slug, strategyId: plan.id, decision: "approve" })).rejects.toThrow(/business stage changed/);
    await expect(w.client.mutation(api.workspace.startPlay, { slug: w.slug, strategyId: plan.id, playId: playId! })).rejects.toThrow(/business stage changed/);
  });

  it("does not mark a plan stale when the owner re-saves the same business stage", async () => {
    const t = setup();
    const w = await workspace(t, "history-same-stage@example.com");
    await makePaid(t, w.orgId);
    await w.client.mutation(api.orgs.saveBusinessDetails, { slug: w.slug, lifecycleStage: "growth" });
    const funnel = { slug: w.slug, periodDays: 30, visitors: 100, leads: 20, activated: 10, newCustomers: 5 };
    await w.client.mutation(api.workspace.setFunnel, funnel);
    await buildPlan(t, w);
    const [plan] = await w.client.query(api.planHistory.versions, { slug: w.slug });

    await w.client.mutation(api.orgs.saveBusinessDetails, { slug: w.slug, lifecycleStage: "growth" });
    await w.client.mutation(api.workspace.setFunnel, funnel);
    const view = await w.client.query(api.workspace.plan, { slug: w.slug, strategyId: plan.id });
    expect(view.staleInputs).toEqual({ ownerEconomics: false, lifecycleStage: false, funnel: false, goal: false, businessProfile: false, businessFacts: false, requiresRefresh: false });
  });

  it("requires refresh when funnel measurements used by diagnosis change", async () => {
    const t = setup();
    const w = await workspace(t, "history-stale-funnel@example.com");
    await makePaid(t, w.orgId);
    await buildPlan(t, w);
    const [plan] = await w.client.query(api.planHistory.versions, { slug: w.slug });
    const saved = await t.run((ctx) => ctx.db.get(plan.id));
    const playId = (saved?.expert?.plays as { id?: string }[] | undefined)?.find((play) => play.id)?.id;
    expect(playId).toBeTruthy();

    await w.client.mutation(api.workspace.setFunnel, { slug: w.slug, periodDays: 30, visitors: 1_000, leads: 20, activated: 10, newCustomers: 5 });
    const view = await w.client.query(api.workspace.plan, { slug: w.slug, strategyId: plan.id });
    expect(view.staleInputs).toEqual({ ownerEconomics: false, lifecycleStage: false, funnel: true, goal: false, businessProfile: false, businessFacts: false, requiresRefresh: true });
    await expect(w.client.mutation(api.workspace.decidePlan, { slug: w.slug, strategyId: plan.id, decision: "approve" })).rejects.toThrow(/funnel measurements changed/);
    await expect(w.client.mutation(api.workspace.startPlay, { slug: w.slug, strategyId: plan.id, playId: playId! })).rejects.toThrow(/funnel measurements changed/);
  });

  it("requires refresh when the active goal or budget changes", async () => {
    const t = setup();
    const w = await workspace(t, "history-stale-goal@example.com");
    await makePaid(t, w.orgId);
    await buildPlan(t, w);
    const [plan] = await w.client.query(api.planHistory.versions, { slug: w.slug });
    const saved = await t.run((ctx) => ctx.db.get(plan.id));
    const playId = (saved?.expert?.plays as { id?: string }[] | undefined)?.find((play) => play.id)?.id;
    expect(playId).toBeTruthy();

    await w.client.mutation(api.orgs.setGoal, { slug: w.slug, kind: "more_sales", statement: "Increase monthly sales", target: { metric: "revenue_month", baseline: 1_000, desired: 2_000, mode: "incremental" }, horizonDays: 120, monthlyAdBudget: 125 });
    const view = await w.client.query(api.workspace.plan, { slug: w.slug, strategyId: plan.id });
    expect(view.staleInputs).toEqual({ ownerEconomics: false, lifecycleStage: false, funnel: false, goal: true, businessProfile: false, businessFacts: false, requiresRefresh: true });
    await expect(w.client.mutation(api.workspace.decidePlan, { slug: w.slug, strategyId: plan.id, decision: "approve" })).rejects.toThrow(/active growth goal or budget changed/);
    await expect(w.client.mutation(api.workspace.startPlay, { slug: w.slug, strategyId: plan.id, playId: playId! })).rejects.toThrow(/active growth goal or budget changed/);
  });

  it("requires refresh when the material business profile changes", async () => {
    const t = setup();
    const w = await workspace(t, "history-stale-profile@example.com");
    await makePaid(t, w.orgId);
    await buildPlan(t, w);
    const [plan] = await w.client.query(api.planHistory.versions, { slug: w.slug });
    const saved = await t.run((ctx) => ctx.db.get(plan.id));
    const playId = (saved?.expert?.plays as { id?: string }[] | undefined)?.find((play) => play.id)?.id;
    expect(playId).toBeTruthy();

    await w.client.mutation(api.orgs.saveBusinessDetails, { slug: w.slug, businessType: "services" });
    const view = await w.client.query(api.workspace.plan, { slug: w.slug, strategyId: plan.id });
    expect(view.staleInputs).toMatchObject({ businessProfile: true, businessFacts: false, requiresRefresh: true });
    await expect(w.client.mutation(api.workspace.decidePlan, { slug: w.slug, strategyId: plan.id, decision: "approve" })).rejects.toThrow(/business profile changed/);
    await expect(w.client.mutation(api.workspace.startPlay, { slug: w.slug, strategyId: plan.id, playId: playId! })).rejects.toThrow(/business profile changed/);
  });

  it("requires refresh when confirmed business facts change", async () => {
    const t = setup();
    const w = await workspace(t, "history-stale-facts@example.com");
    await makePaid(t, w.orgId);
    const businessId = await t.run(async (ctx) => {
      const business = await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", w.orgId)).first();
      expect(business).toBeTruthy();
      await ctx.db.insert("businessFacts", {
        orgId: w.orgId,
        businessId: business!._id,
        category: "audience",
        statement: "Owner-confirmed audience buys online.",
        confidence: "high",
        reviewState: "confirmed",
        provenance: "owner_supplied",
        sourceIds: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      return business!._id;
    });
    await buildPlan(t, w);
    const [plan] = await w.client.query(api.planHistory.versions, { slug: w.slug });
    const saved = await t.run((ctx) => ctx.db.get(plan.id));
    const playId = (saved?.expert?.plays as { id?: string }[] | undefined)?.find((play) => play.id)?.id;
    expect(playId).toBeTruthy();

    await t.run(async (ctx) => {
      await ctx.db.insert("businessFacts", {
        orgId: w.orgId,
        businessId,
        category: "offer",
        statement: "Owner-confirmed offer includes a free consultation.",
        confidence: "high",
        reviewState: "confirmed",
        provenance: "owner_supplied",
        sourceIds: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
    const view = await w.client.query(api.workspace.plan, { slug: w.slug, strategyId: plan.id });
    expect(view.staleInputs).toMatchObject({ businessProfile: false, businessFacts: true, requiresRefresh: true });
    await expect(w.client.mutation(api.workspace.decidePlan, { slug: w.slug, strategyId: plan.id, decision: "approve" })).rejects.toThrow(/confirmed business facts changed/);
    await expect(w.client.mutation(api.workspace.startPlay, { slug: w.slug, strategyId: plan.id, playId: playId! })).rejects.toThrow(/confirmed business facts changed/);
  });
});
