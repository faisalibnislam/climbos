import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { expertPlaysOf, readExpertPlan } from "../../shared/agents/planCompatibility";
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

    // Restoring plays from an older schema keeps that part's own payload version.
    await t.run(async (ctx) => {
      const legacy = (await ctx.db.get(v1.id))!;
      const decoded = readExpertPlan(legacy.expert!);
      const expert = { ...decoded, version: 7 } as Record<string, unknown>;
      delete expert.growthPlanV8;
      delete expert.growthPlanV9;
      await ctx.db.patch(legacy._id, { expert: expert as never });
    });
    const legacyRestore = await w.client.mutation(api.planHistory.restore, { slug: w.slug, fromId: v1.id, parts: ["plays"] });
    const restoredExpert = await t.run(async (ctx) => (await ctx.db.get(legacyRestore.strategyId))?.expert);
    expect(restoredExpert?.version).toBe(7);
    expect(restoredExpert?.growthPlanV9).toBeUndefined();
    expect(restoredExpert?.plays?.length).toBeGreaterThan(0);
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
    const playId = (expertPlaysOf(saved?.expert) as { id?: string }[]).find((play) => play.id)?.id;
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
    const playId = (expertPlaysOf(saved?.expert) as { id?: string }[]).find((play) => play.id)?.id;
    expect(playId).toBeTruthy();

    await w.client.mutation(api.orgs.saveBusinessDetails, { slug: w.slug, lifecycleStage: "growth" });
    const view = await w.client.query(api.workspace.plan, { slug: w.slug, strategyId: plan.id });
    expect(view.staleInputs).toEqual({ ownerEconomics: false, lifecycleStage: true, funnel: false, goal: false, businessProfile: false, businessFacts: false, brandGuidance: false, capabilities: false, businessResearch: false, marketChanges: false, requiresRefresh: true });
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
    expect(view.staleInputs).toEqual({ ownerEconomics: false, lifecycleStage: false, funnel: false, goal: false, businessProfile: false, businessFacts: false, brandGuidance: false, capabilities: false, businessResearch: false, marketChanges: false, requiresRefresh: false });
  });

  it("requires refresh when funnel measurements used by diagnosis change", async () => {
    const t = setup();
    const w = await workspace(t, "history-stale-funnel@example.com");
    await makePaid(t, w.orgId);
    await buildPlan(t, w);
    const [plan] = await w.client.query(api.planHistory.versions, { slug: w.slug });
    const saved = await t.run((ctx) => ctx.db.get(plan.id));
    const playId = (expertPlaysOf(saved?.expert) as { id?: string }[]).find((play) => play.id)?.id;
    expect(playId).toBeTruthy();

    await w.client.mutation(api.workspace.setFunnel, { slug: w.slug, periodDays: 30, visitors: 1_000, leads: 20, activated: 10, newCustomers: 5 });
    const view = await w.client.query(api.workspace.plan, { slug: w.slug, strategyId: plan.id });
    expect(view.staleInputs).toEqual({ ownerEconomics: false, lifecycleStage: false, funnel: true, goal: false, businessProfile: false, businessFacts: false, brandGuidance: false, capabilities: false, businessResearch: false, marketChanges: false, requiresRefresh: true });
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
    const playId = (expertPlaysOf(saved?.expert) as { id?: string }[]).find((play) => play.id)?.id;
    expect(playId).toBeTruthy();

    await w.client.mutation(api.orgs.setGoal, { slug: w.slug, kind: "more_sales", statement: "Increase monthly sales", target: { metric: "revenue_month", baseline: 1_000, desired: 2_000, mode: "incremental" }, horizonDays: 120, monthlyAdBudget: 125 });
    const view = await w.client.query(api.workspace.plan, { slug: w.slug, strategyId: plan.id });
    expect(view.staleInputs).toEqual({ ownerEconomics: false, lifecycleStage: false, funnel: false, goal: true, businessProfile: false, businessFacts: false, brandGuidance: false, capabilities: false, businessResearch: false, marketChanges: false, requiresRefresh: true });
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
    const playId = (expertPlaysOf(saved?.expert) as { id?: string }[]).find((play) => play.id)?.id;
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
    const playId = (expertPlaysOf(saved?.expert) as { id?: string }[]).find((play) => play.id)?.id;
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

  it("requires refresh when business and audience research changes after planning", async () => {
    const t = setup();
    const w = await workspace(t, "history-stale-research@example.com");
    await makePaid(t, w.orgId);
    await buildPlan(t, w);
    const [plan] = await w.client.query(api.planHistory.versions, { slug: w.slug });
    const saved = await t.run((ctx) => ctx.db.get(plan.id));
    const playId = (expertPlaysOf(saved?.expert) as { id?: string }[]).find((play) => play.id)?.id;
    expect(playId).toBeTruthy();

    await t.run(async (ctx) => {
      const business = await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", w.orgId)).first();
      expect(business).toBeTruthy();
      await ctx.db.patch(business!._id, {
        insights: {
          audiences: [{ name: "Independent accountants", description: "Small practices", confidence: "medium", needs: [{ statement: "Reduce reconciliation work.", basis: "inference", evidenceRefs: [] }] }],
          competitors: [],
          positioning: "A simple bookkeeping workflow.", pricingNotes: "Unknown.",
          swot: { strengths: [], weaknesses: [], opportunities: [], threats: [] },
          journey: [], opportunities: [],
          expert: { alternatives: [], vocPhrases: [], objections: [], gaps: [], positioningStatement: "Simple workflow.", confidenceNotes: "Limited information." },
          generatedAt: Date.now(),
        },
      });
    });

    const view = await w.client.query(api.workspace.plan, { slug: w.slug, strategyId: plan.id });
    expect(view.staleInputs).toMatchObject({ businessResearch: true, requiresRefresh: true });
    await expect(w.client.mutation(api.workspace.decidePlan, { slug: w.slug, strategyId: plan.id, decision: "approve" })).rejects.toThrow(/business and audience research changed/);
    await expect(w.client.mutation(api.workspace.startPlay, { slug: w.slug, strategyId: plan.id, playId: playId! })).rejects.toThrow(/business and audience research changed/);
  });

  it("binds monitored competitor changes into refreshed plans and blocks stale ones", async () => {
    const t = setup();
    const w = await workspace(t, "history-stale-market@example.com");
    await makePaid(t, w.orgId);
    await buildPlan(t, w);
    const [plan] = await w.client.query(api.planHistory.versions, { slug: w.slug });
    const saved = await t.run((ctx) => ctx.db.get(plan.id));
    const playId = (expertPlaysOf(saved?.expert) as { id?: string }[]).find((play) => play.id)?.id;
    expect(playId).toBeTruthy();
    expect((saved?.expert?.snapshot as { marketChangeVersions?: unknown[] } | undefined)?.marketChangeVersions).toEqual([]);

    await t.run(async (ctx) => {
      const watchId = await ctx.db.insert("competitorWatches", { orgId: w.orgId, name: "Example Rival", url: "https://rival.example", active: true, createdAt: Date.now() });
      await ctx.db.insert("competitorChanges", {
        orgId: w.orgId,
        watchId,
        name: "Example Rival",
        summary: "Added a new annual plan.",
        bullets: ["Annual plan now shown on pricing page."],
        sourceUrls: ["https://rival.example/pricing"],
        evidence: { removed: [], added: ["Annual plan: $120 per year"] },
        at: Date.now(),
      });
    });

    const view = await w.client.query(api.workspace.plan, { slug: w.slug, strategyId: plan.id });
    expect(view.staleInputs).toMatchObject({ marketChanges: true, requiresRefresh: true });
    await expect(w.client.mutation(api.workspace.decidePlan, { slug: w.slug, strategyId: plan.id, decision: "approve" })).rejects.toThrow(/monitored competitor page changed/);
    await expect(w.client.mutation(api.workspace.startPlay, { slug: w.slug, strategyId: plan.id, playId: playId! })).rejects.toThrow(/monitored competitor page changed/);

    await buildPlan(t, w);
    const [refreshed] = await w.client.query(api.planHistory.versions, { slug: w.slug });
    const [refreshedStrategy, changeId] = await t.run(async (ctx) => [
      await ctx.db.get(refreshed.id),
      String((await ctx.db.query("competitorChanges").withIndex("by_org_at", (q) => q.eq("orgId", w.orgId)).first())!._id),
    ] as const);
    expect((refreshedStrategy?.expert?.snapshot as { marketChangeVersions?: { id: string; at: number }[] } | undefined)?.marketChangeVersions?.map((row) => row.id)).toContain(changeId);
  });

  it("requires refresh when brand guidance changes", async () => {
    const t = setup();
    const w = await workspace(t, "history-stale-brand@example.com");
    await makePaid(t, w.orgId);
    await t.run(async (ctx) => {
      const business = await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", w.orgId)).first();
      expect(business).toBeTruthy();
      await ctx.db.insert("brandProfiles", { orgId: w.orgId, businessId: business!._id, voice: "Friendly and practical", toneWords: ["helpful"], colors: [], doNots: ["No unsupported claims"], updatedAt: Date.now() });
    });
    await buildPlan(t, w);
    const [plan] = await w.client.query(api.planHistory.versions, { slug: w.slug });
    const saved = await t.run((ctx) => ctx.db.get(plan.id));
    const playId = (expertPlaysOf(saved?.expert) as { id?: string }[]).find((play) => play.id)?.id;
    expect(playId).toBeTruthy();

    await w.client.mutation(api.brand.update, { slug: w.slug, voice: "Friendly and practical", toneWords: ["helpful"], colors: [], doNots: ["No unsupported claims"], approvedExamples: ["We make the next step clear."] });
    const view = await w.client.query(api.workspace.plan, { slug: w.slug, strategyId: plan.id });
    expect(view.staleInputs).toMatchObject({ businessProfile: false, businessFacts: false, brandGuidance: true, requiresRefresh: true });
    await expect(w.client.mutation(api.workspace.decidePlan, { slug: w.slug, strategyId: plan.id, decision: "approve" })).rejects.toThrow(/brand guidance changed/);
    await expect(w.client.mutation(api.workspace.startPlay, { slug: w.slug, strategyId: plan.id, playId: playId! })).rejects.toThrow(/brand guidance changed/);
  });

  it("requires refresh when an owner confirms channel-relevant business types", async () => {
    const t = setup();
    const w = await workspace(t, "history-stale-channel-types@example.com");
    await makePaid(t, w.orgId);
    await buildPlan(t, w);
    const [plan] = await w.client.query(api.planHistory.versions, { slug: w.slug });
    const saved = await t.run((ctx) => ctx.db.get(plan.id));
    const playId = (expertPlaysOf(saved?.expert) as { id?: string }[]).find((play) => play.id)?.id;
    expect(playId).toBeTruthy();

    await w.client.mutation(api.acquisition.setTypes, { slug: w.slug, types: ["mobile_app"] });
    const view = await w.client.query(api.workspace.plan, { slug: w.slug, strategyId: plan.id });
    expect(view.staleInputs).toMatchObject({ businessProfile: true, requiresRefresh: true });
    await expect(w.client.mutation(api.workspace.decidePlan, { slug: w.slug, strategyId: plan.id, decision: "approve" })).rejects.toThrow(/business profile changed/);
    await expect(w.client.mutation(api.workspace.startPlay, { slug: w.slug, strategyId: plan.id, playId: playId! })).rejects.toThrow(/business profile changed/);
  });

  it("requires refresh when an owner-confirmed acquisition dimension changes", async () => {
    const t = setup();
    const w = await workspace(t, "history-stale-acquisition-dimension@example.com");
    await makePaid(t, w.orgId);
    await buildPlan(t, w);
    const [plan] = await w.client.query(api.planHistory.versions, { slug: w.slug });
    const saved = await t.run((ctx) => ctx.db.get(plan.id));
    const playId = (expertPlaysOf(saved?.expert) as { id?: string }[]).find((play) => play.id)?.id;
    expect(playId).toBeTruthy();

    await w.client.mutation(api.acquisition.setDimension, { slug: w.slug, key: "geography", value: "local" });
    const view = await w.client.query(api.workspace.plan, { slug: w.slug, strategyId: plan.id });
    expect(view.staleInputs).toMatchObject({ businessProfile: true, requiresRefresh: true });
    await expect(w.client.mutation(api.workspace.decidePlan, { slug: w.slug, strategyId: plan.id, decision: "approve" })).rejects.toThrow(/business profile changed/);
    await expect(w.client.mutation(api.workspace.startPlay, { slug: w.slug, strategyId: plan.id, playId: playId! })).rejects.toThrow(/business profile changed/);
  });

  it("requires refresh when connected capabilities change after planning", async () => {
    const t = setup();
    const w = await workspace(t, "history-stale-capabilities@example.com");
    await makePaid(t, w.orgId);
    await buildPlan(t, w);
    const [plan] = await w.client.query(api.planHistory.versions, { slug: w.slug });
    const saved = await t.run((ctx) => ctx.db.get(plan.id));
    const playId = (expertPlaysOf(saved?.expert) as { id?: string }[]).find((play) => play.id)?.id;
    expect(playId).toBeTruthy();

    await t.run((ctx) => ctx.db.insert("connections", {
      orgId: w.orgId,
      provider: "ga4",
      status: "connected",
      scopes: [],
      isFixture: false,
      createdBy: w.userId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }));

    const view = await w.client.query(api.workspace.plan, { slug: w.slug, strategyId: plan.id });
    expect(view.staleInputs).toMatchObject({ capabilities: true, requiresRefresh: true });
    await expect(w.client.mutation(api.workspace.decidePlan, { slug: w.slug, strategyId: plan.id, decision: "approve" })).rejects.toThrow(/connected tools changed/);
    await expect(w.client.mutation(api.workspace.startPlay, { slug: w.slug, strategyId: plan.id, playId: playId! })).rejects.toThrow(/connected tools changed/);
  });

  it("requires refresh when owner channel experience changes after planning", async () => {
    const t = setup();
    const w = await workspace(t, "history-stale-channel-experience@example.com");
    await makePaid(t, w.orgId);
    await buildPlan(t, w);
    const [plan] = await w.client.query(api.planHistory.versions, { slug: w.slug });

    await w.client.mutation(api.acquisition.setChannelPreference, { slug: w.slug, channelId: "M10", preference: "prefer", rationale: "Past tests brought qualified demos." });
    const view = await w.client.query(api.workspace.plan, { slug: w.slug, strategyId: plan.id });
    expect(view.staleInputs).toMatchObject({ businessProfile: true, requiresRefresh: true });
    await expect(w.client.mutation(api.workspace.decidePlan, { slug: w.slug, strategyId: plan.id, decision: "approve" })).rejects.toThrow(/business profile changed/);
  });
});
