import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { asNewUser, setup, type T } from "./helpers";
import { designLearningBrief, designLearningRecord } from "../../convex/lib/designLearning";

const APPROVED_AT = Date.UTC(2026, 9, 1, 12);
const content = { headline: "An explicit offer", subhead: "Information for the right customer.", benefits: [{ title: "Useful", text: "A concrete benefit." }], steps: ["Ask a question"], proof: "", faq: [{ q: "Who is this for?", a: "Ask us." }], ctaLabel: "Get details", formIntro: "Tell us what you need." };

async function fixture(t: T) {
  const owner = await asNewUser(t, "design-learning-owner@example.com");
  const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Page Learning Co" });
  await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", statement: "More qualified inquiries", horizonDays: 90, monthlyAdBudget: 0 });
  const ids = await t.run(async ctx => {
    const business = (await ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", orgId)).first())!;
    const goal = (await ctx.db.query("goals").withIndex("by_org_status", q => q.eq("orgId", orgId).eq("status", "active")).first())!;
    const strategyId = await ctx.db.insert("strategies", { orgId, businessId: business._id, goalId: goal._id, version: 1, status: "approved", summary: "Test the inquiry page", audiences: [], positioning: "Clear offer", channels: [], constraints: [], measurementPlan: "Qualified inquiries", reviewDate: "2026-10-20", sourceFactIds: [], generationCostMicros: 0, createdAt: Date.now() });
    const runId = await ctx.db.insert("workflowRuns", { orgId, kind: "conversion_audit", title: "Page audit", status: "verified", input: "{}", output: JSON.stringify({ designCritic: { findings: [{ lens: "communication_hierarchy", region: "Hero", sourceUrl: "https://example.com/", observation: "The offer is unclear.", directions: [{ id: "clear", name: "Make the offer explicit" }] }] } }), roles: [], estimateMicros: 0, actualMicros: 0, rateVersionId: "test", entitlementVersionId: "test", routingVersionId: "test", budget: { modelSteps: 0, researchTools: 0, repairs: 0 }, used: { modelSteps: 0, researchTools: 0, repairs: 0 }, isFixture: false, createdAt: Date.now(), updatedAt: Date.now() });
    const pageId = await ctx.db.insert("landingPages", { orgId, slug: `learning-${orgId}`, title: "Inquiry page", brief: "Explain our offer", status: "draft", version: 1, content: JSON.stringify(content), color: "#225533", views: 0, leads: 0, createdAt: Date.now(), updatedAt: Date.now(), designCriticSource: { runId, findingIndex: 0, directionId: "clear", directionName: "Make the offer explicit", region: "Hero", sourceUrl: "https://example.com/", selectedAt: Date.now() } });
    return { strategyId, runId, pageId };
  });
  const plan = { metric: "Qualified inquiries", method: "Compare equal periods using the analytics export and inquiry qualification log", baseline: { state: "recorded" as const, value: "5 qualified inquiries from 100 visits", source: "Owner's September analytics export and qualification log" }, audience: "Visitors looking for this service", guardrail: "Do not increase unqualified support requests", observationDays: 14, decisionRule: "Keep only if inquiries improve without more support work" };
  await owner.client.mutation(api.landing.saveDesignMeasurementPlan, { slug, id: ids.pageId, expectedVersion: 1, ...plan });
  const experimentId = await owner.client.mutation(api.designCritic.createResultTest, { slug, pageId: ids.pageId, expectedVersion: 2 });
  return { ...owner, slug, orgId, ...ids, experimentId, plan };
}

async function record(t: T, f: Awaited<ReturnType<typeof fixture>>, result: "met" | "missed" | "unclear" = "met", executed = true) {
  vi.setSystemTime(Date.UTC(2026, 9, 20));
  await f.client.mutation(api.playResults.recordExperimentOutcome, { slug: f.slug, experimentId: f.experimentId, executed, source: "owner_report", design: "before_after", ...(executed ? { exposed: 100, conversions: 8 } : {}), windowStart: "2026-10-02", windowEnd: "2026-10-15", result, stopRuleHit: false });
  return t.run(async ctx => designLearningRecord(ctx, f.orgId, (await ctx.db.get(f.experimentId))!));
}

describe("version-bound design outcomes in later advice", () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(APPROVED_AT); });
  afterEach(() => vi.useRealTimers());

  it("retains exact-version approval through later edits and publications and feeds both audit and strategy context", async () => {
    const t = setup();
    const f = await fixture(t);
    await f.client.mutation(api.landing.setLive, { slug: f.slug, id: f.pageId, live: true, expectedVersion: 2 });
    const learning = await record(t, f);
    expect(learning).toMatchObject({ pageVersion: 2, publicationConfirmed: true, publicationApprovedAt: APPROVED_AT, assessment: { state: "observed" }, outcome: { result: "met", source: "owner_report" } });
    expect(JSON.stringify(learning)).not.toContain("reviewedBy");
    await f.client.mutation(api.landing.setLive, { slug: f.slug, id: f.pageId, live: true, expectedVersion: 2 });
    await f.client.mutation(api.landing.update, { slug: f.slug, id: f.pageId, content: { ...content, headline: "Later draft" } });
    await f.client.mutation(api.landing.saveDesignMeasurementPlan, { slug: f.slug, id: f.pageId, expectedVersion: 3, ...f.plan });
    await f.client.mutation(api.landing.setLive, { slug: f.slug, id: f.pageId, live: true, expectedVersion: 4 });
    const history = await f.client.query(api.landing.history, { slug: f.slug, id: f.pageId });
    expect(history.find(row => row.version === 2)).toMatchObject({ publicationApprovedAt: APPROVED_AT, isPublished: false });
    expect(history.find(row => row.version === 4)?.publicationApprovedAt).toBe(Date.now());
    expect((await f.client.query(api.designCritic.results, { slug: f.slug, runId: f.runId, findingIndex: 0 })).tests[0].learning).toMatchObject({ pageVersion: 2, assessment: { state: "observed" } });

    for (const kind of ["strategy", "conversion_audit"] as const) {
      const id = await t.run(async ctx => {
        const { _id, _creationTime, ...prior } = (await ctx.db.get(f.runId))!;
        return ctx.db.insert("workflowRuns", { ...prior, kind, status: "executing", output: undefined, createdAt: Date.now(), updatedAt: Date.now() });
      });
      const context = await t.query(internal.jobWrites.jobContext, { runId: id });
      expect(context?.designLearningText).toContain('"pageVersion":2');
      expect(context?.designLearningText).toContain('"state":"observed"');
      expect(context?.designLearningText).toContain("Make the offer explicit");
      expect(context?.resultsText).not.toContain("Page change: Inquiry page");
    }
  });

  it.each(["met", "missed", "unclear"] as const)("retains %s reports without inventing publication or causal evidence", async result => {
    const t = setup();
    const f = await fixture(t);
    const learning = await record(t, f, result);
    expect(learning).toMatchObject({ publicationConfirmed: false, outcome: { result }, assessment: { state: "needs_evidence" } });
    expect((await f.client.query(api.landing.list, { slug: f.slug })).pages[0].status).toBe("draft");
    await t.run(async ctx => {
      expect(await ctx.db.query("approvals").collect()).toHaveLength(0);
      expect(await ctx.db.query("actionReceipts").collect()).toHaveLength(0);
    });
  });

  it("keeps a not-run result separate and rejects unavailable or cross-tenant source links", async () => {
    const t = setup();
    const f = await fixture(t);
    expect(await record(t, f, "unclear", false)).toMatchObject({ assessment: { state: "not_run" } });
    const other = await asNewUser(t, "design-learning-other@example.com");
    const { slug: otherSlug, orgId: otherOrg } = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Other" });
    await expect(other.client.query(api.designCritic.results, { slug: otherSlug, runId: f.runId, findingIndex: 0 })).rejects.toThrow();
    expect(await t.run(ctx => designLearningBrief(ctx, otherOrg))).toBe("");
    await t.run(async ctx => ctx.db.patch(f.pageId, { orgId: otherOrg }));
    expect(await t.run(ctx => designLearningBrief(ctx, f.orgId))).toBe("");
  });

  it("excludes fixture audit results and preserves unknown historical approval dates", async () => {
    const t = setup();
    const f = await fixture(t);
    await t.run(async ctx => ctx.db.patch(f.pageId, { publishedVersion: 2 }));
    expect(await record(t, f)).toMatchObject({ publicationConfirmed: true, publicationApprovedAt: null, assessment: { state: "observed" } });
    await t.run(async ctx => ctx.db.patch(f.runId, { isFixture: true }));
    expect(await t.run(ctx => designLearningBrief(ctx, f.orgId))).toBe("");
    await t.run(async ctx => ctx.db.patch(f.runId, { isFixture: false, output: JSON.stringify({ designCritic: { findings: [{ directions: [null] }] } }) }));
    expect(await t.run(ctx => designLearningBrief(ctx, f.orgId))).toBe("");
  });

  it("does not create publication evidence from a viewer or stale-version request", async () => {
    const t = setup();
    const f = await fixture(t);
    const viewer = await asNewUser(t, "design-learning-viewer@example.com");
    await t.run(ctx => ctx.db.insert("memberships", { orgId: f.orgId, userId: viewer.userId, role: "viewer", status: "active", createdAt: Date.now() }));
    await expect(viewer.client.mutation(api.landing.setLive, { slug: f.slug, id: f.pageId, live: true, expectedVersion: 2 })).rejects.toThrow();
    await expect(f.client.mutation(api.landing.setLive, { slug: f.slug, id: f.pageId, live: true, expectedVersion: 1 })).rejects.toThrow(/changed after review/);
    await t.run(async ctx => ctx.db.patch(f.pageId, { content: JSON.stringify({ ...content, headline: "Unversioned corruption" }) }));
    await expect(f.client.mutation(api.landing.setLive, { slug: f.slug, id: f.pageId, live: true, expectedVersion: 2 })).rejects.toThrow(/does not match this draft/);
    expect((await f.client.query(api.landing.history, { slug: f.slug, id: f.pageId }))[0].publicationApprovedAt).toBeNull();
  });

  it("does not cut off evidence limits in a long learning context", async () => {
    const t = setup();
    const f = await fixture(t);
    await record(t, f);
    await t.run(async ctx => {
      const { _id, _creationTime, ...test } = (await ctx.db.get(f.experimentId))!;
      for (let i = 0; i < 19; i++) await ctx.db.insert("experiments", { ...test, name: `Test ${i}`, population: "Recorded audience ".repeat(80) });
    });
    const text = await t.run(ctx => designLearningBrief(ctx, f.orgId));
    const context = JSON.parse(text);
    expect(context.truncated).toBe(true);
    expect(context.records.length).toBeGreaterThan(0);
    expect(context.records.length).toBeLessThan(20);
    expect(context.records.every((row: { assessment: { limits: string[] } }) => row.assessment.limits.some(limit => limit.includes("not been independently verified")))).toBe(true);
    expect(text.length).toBeLessThan(12_000);
  });
});
