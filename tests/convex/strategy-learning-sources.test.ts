import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { playsTask } from "../../shared/agents/planTasks";
import { STRATEGY_LEARNING_CONTEXT_CHARS } from "../../shared/agents/context";
import { focusedPlanFixture } from "../fixtures/focusedPlan";
import { creativeStrategyLearningBrief } from "../../convex/creativeStrategy";
import { asNewUser, makePaid, setup } from "./helpers";

async function learningWorkspace() {
  const t = setup();
  const owner = await asNewUser(t, "learning-selection@example.com");
  const { slug, orgId: rawOrgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Learning selection" });
  const orgId = rawOrgId as Id<"organizations">;
  await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", statement: "Find a useful test", horizonDays: 90, monthlyAdBudget: 0 });
  await makePaid(t, orgId);
  await owner.client.mutation(api.orgs.generatePlan, { slug });
  await t.finishAllScheduledFunctions(() => undefined);
  const plan = (await t.run(ctx => ctx.db.query("strategies").withIndex("by_org", q => q.eq("orgId", orgId)).first()))!;
  const exploration = focusedPlanFixture().strategyExploration;
  await t.run(ctx => ctx.db.patch(plan._id, { expert: { ...plan.expert!, strategyExploration: exploration } }));
  const report = async (note: string, mode: "grounded" | "adjacent" | "bold" = "bold", strategyId = plan._id) => {
    await owner.client.mutation(api.creativeStrategy.recordFeedback, { slug, strategyId, mode, decision: "selected", testState: "observed", outcomeNote: note, outcomeEvidence: "owner_reported" });
    return (await t.run(ctx => ctx.db.query("strategyExplorationFeedback").withIndex("by_strategy_mode", q => q.eq("strategyId", strategyId).eq("mode", mode)).order("desc").first()))!;
  };
  const selection = () => owner.client.query(api.creativeStrategy.learningSources, { slug });
  const brief = () => t.run(ctx => creativeStrategyLearningBrief(ctx, orgId));
  const clonePlan = () => t.run(async ctx => {
    const current = (await ctx.db.get(plan._id))!;
    const { _id, _creationTime, ...copy } = current;
    void _id; void _creationTime;
    return ctx.db.insert("strategies", { ...copy, approvalId: undefined, createdAt: Date.now() });
  });
  return { t, owner, slug, orgId, plan, exploration, report, selection, brief, clonePlan };
}

describe("owner control over strategy learning", () => {
  beforeEach(() => { process.env.CLIMBOS_ENGINE = "v2"; process.env.CLIMBOS_FAKE_LLM = "ship"; });
  afterEach(() => { delete process.env.CLIMBOS_ENGINE; delete process.env.CLIMBOS_FAKE_LLM; });

  it("lists feedback, lets editors retire and restore it, and expires old items, within the workspace", async () => {
    const t = setup();
    const owner = await asNewUser(t, "learning-owner@example.com");
    const viewer = await asNewUser(t, "learning-viewer@example.com");
    const other = await asNewUser(t, "learning-other@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Learning Co" });
    const { slug: otherSlug } = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Other Co" });
    await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", statement: "More customers", horizonDays: 90, monthlyAdBudget: 0 });
    await makePaid(t, orgId as Id<"organizations">);
    await t.run(async (ctx) => ctx.db.insert("memberships", { orgId: orgId as Id<"organizations">, userId: viewer.userId, role: "viewer", status: "active", createdAt: Date.now() }));
    await owner.client.mutation(api.orgs.generatePlan, { slug, creativeRange: "surprising" });
    await t.finishAllScheduledFunctions(() => undefined);
    const strategy = (await t.run(async (ctx) => ctx.db.query("strategies").withIndex("by_org", (q) => q.eq("orgId", orgId as Id<"organizations">)).order("desc").first()))!;

    await owner.client.mutation(api.creativeStrategy.recordFeedback, { slug, strategyId: strategy._id, mode: "bold", decision: "rejected", testState: "not_started", outcomeEvidence: "unknown" });
    let sources = await owner.client.query(api.creativeStrategy.learningSources, { slug });
    expect(sources.feedback).toHaveLength(1);
    expect(sources.feedback[0]).toMatchObject({ mode: "bold", decision: "rejected", retired: false, used: true });
    expect(await t.run(async (ctx) => creativeStrategyLearningBrief(ctx, orgId as Id<"organizations">))).toContain("bold option");

    const feedbackId = sources.feedback[0].id;
    await expect(viewer.client.mutation(api.creativeStrategy.setFeedbackRetired, { slug, feedbackId, retired: true })).rejects.toThrow(/can't/i);
    await expect(other.client.mutation(api.creativeStrategy.setFeedbackRetired, { slug: otherSlug, feedbackId, retired: true })).rejects.toThrow();
    await owner.client.mutation(api.creativeStrategy.setFeedbackRetired, { slug, feedbackId, retired: true });
    sources = await owner.client.query(api.creativeStrategy.learningSources, { slug });
    expect(sources.feedback[0]).toMatchObject({ retired: true, used: false });
    expect(await t.run(async (ctx) => creativeStrategyLearningBrief(ctx, orgId as Id<"organizations">))).not.toContain("bold option");

    await owner.client.mutation(api.creativeStrategy.setFeedbackRetired, { slug, feedbackId, retired: false });
    // Older than a year: kept in the list but no longer used.
    await t.run(async (ctx) => ctx.db.patch(feedbackId, { createdAt: Date.now() - 400 * 86_400_000 }));
    sources = await owner.client.query(api.creativeStrategy.learningSources, { slug });
    expect(sources.feedback[0]).toMatchObject({ retired: false, used: false });
    expect(await t.run(async (ctx) => creativeStrategyLearningBrief(ctx, orgId as Id<"organizations">))).not.toContain("bold option");
    expect((await other.client.query(api.creativeStrategy.learningSources, { slug: otherSlug })).feedback).toEqual([]);
  });
  it("uses only the latest report per option and retirement never revives superseded observations", async () => {
    const w = await learningWorkspace();
    const old = await w.report("FIRST observation superseded");
    await w.t.run(ctx => ctx.db.patch(old._id, { createdAt: Date.now() - 1000 }));
    const latest = await w.report("CORRECTED observation");
    const selection = await w.selection();
    expect(selection.feedback.find(r => r.id === old._id)).toMatchObject({ used: false, reason: "superseded" });
    expect(selection.feedback.find(r => r.id === latest._id)).toMatchObject({ used: true, reason: "included" });
    expect(await w.brief()).toContain("CORRECTED observation");
    expect(await w.brief()).not.toContain("FIRST observation");
    await w.owner.client.mutation(api.creativeStrategy.setFeedbackRetired, { slug: w.slug, feedbackId: latest._id, retired: true });
    expect(await w.brief()).toBe("");
    expect((await w.selection()).feedback.find(r => r.id === old._id)?.reason).toBe("superseded");
  });

  it("selects by report date, exposes exactly the whole records passed to the planner, and discloses limits", async () => {
    const w = await learningWorkspace();
    for (let i = 0; i < 85; i++) {
      const id = await w.clonePlan();
      const row = await w.report(`Report ${i}`, "grounded", id);
      await w.t.run(ctx => ctx.db.patch(row._id, { createdAt: Date.now() - (100 - i) * 1000 }));
    }
    const newest = await w.report("Recent result on oldest plan");
    const sources = await w.selection();
    const brief = await w.brief();
    expect(sources.feedback[0].id).toBe(newest._id);
    expect(sources.limited).toBe(true);
    expect(sources.feedback).toHaveLength(80);
    expect(brief.length).toBeLessThanOrEqual(STRATEGY_LEARNING_CONTEXT_CHARS);
    expect(brief.length).toBeGreaterThan(4_000);
    expect(playsTask({ scorecard: "", insights: "", ownerLearning: brief })).toContain(brief);
    expect(sources.feedback.some(r => r.reason === "context_limit")).toBe(true);
    for (const row of sources.feedback) expect(brief.includes(`report ${row.id},`)).toBe(row.used);
    expect(brief).toContain(w.exploration.bold.reversibleTest.stopIf);
    expect(brief).toContain(w.exploration.bold.audienceOrCondition);
    expect(brief).toContain("Never treat selection as approval to execute.");
  });

  it("preserves the reviewed option after a plan changes, verifies legacy hashes, and excludes broken tenant provenance", async () => {
    const w = await learningWorkspace();
    const original = await w.report("Original test observation");
    const legacy = await w.report("Legacy observation", "adjacent");
    await w.t.run(ctx => ctx.db.patch(legacy._id, { optionSnapshot: undefined }));
    expect((await w.selection()).feedback.find(r => r.id === legacy._id)?.used).toBe(true);
    await w.t.run(async ctx => {
      const plan = (await ctx.db.get(w.plan._id))!;
      const exploration = plan.expert!.strategyExploration!;
      await ctx.db.patch(plan._id, { expert: { ...plan.expert!, strategyExploration: { ...exploration, bold: { ...exploration.bold, audienceOrCondition: "CHANGED audience" }, adjacent: { ...exploration.adjacent, title: "CHANGED legacy proposal" } } } });
    });
    const sources = await w.selection();
    expect(sources.feedback.find(r => r.id === original._id)?.used).toBe(true);
    expect(sources.feedback.find(r => r.id === legacy._id)?.reason).toBe("unverified");
    expect(await w.brief()).toContain(w.exploration.bold.audienceOrCondition);
    expect(await w.brief()).not.toContain("CHANGED audience");
    const outsider = await asNewUser(w.t, "learning-wrong-org@example.com");
    const { orgId } = await outsider.client.mutation(api.orgs.createWorkspace, { businessName: "Other learning" });
    await w.t.run(ctx => ctx.db.patch(w.plan._id, { orgId: orgId as Id<"organizations"> }));
    expect(await w.brief()).toBe("");
  });

  it("omits future dates and oversized records without cutting off test conditions or evidence limits", async () => {
    const w = await learningWorkspace();
    const future = await w.report("FUTURE observation");
    await w.t.run(ctx => ctx.db.patch(future._id, { createdAt: Date.now() + 86_400_000 }));
    expect((await w.selection()).feedback[0].reason).toBe("invalid_date");
    await w.t.run(async ctx => {
      const plan = (await ctx.db.get(w.plan._id))!;
      const exploration = plan.expert!.strategyExploration!;
      const option = { ...exploration.grounded, businessAction: "Complete original action ".repeat(1000) };
      await ctx.db.patch(plan._id, { expert: { ...plan.expert!, strategyExploration: { ...exploration, grounded: option } } });
    });
    const oversized = await w.report("Oversized proposal", "grounded");
    expect((await w.selection()).feedback.find(r => r.id === oversized._id)?.reason).toBe("context_limit");
    expect(await w.brief()).toBe("");
  });

  it("uses the actual rejection date on old plans and never turns feedback into action authority", async () => {
    const w = await learningWorkspace();
    await w.t.run(ctx => ctx.db.patch(w.plan._id, { createdAt: Date.now() - 500 * 86_400_000 }));
    for (let i = 0; i < 25; i++) await w.clonePlan();
    await w.owner.client.mutation(api.workspace.decidePlan, { slug: w.slug, strategyId: w.plan._id, decision: "reject", note: "Recent rejection on old plan" });
    const sources = await w.selection();
    expect(sources.planNotes).toMatchObject([{ strategyId: w.plan._id, used: true, reason: "included" }]);
    expect(await w.brief()).toContain("Recent rejection on old plan");
    const snapshot = () => w.t.run(async ctx => Promise.all([ctx.db.query("approvals").collect(), ctx.db.query("actionReceipts").collect(), ctx.db.query("artifacts").collect(), ctx.db.query("workflowRuns").collect()]));
    const before = await snapshot();
    await w.report("No external action authorized");
    await w.selection(); await w.brief();
    expect(await snapshot()).toEqual(before);
    await w.t.run(ctx => ctx.db.patch(w.plan.approvalId!, { decidedAt: undefined }));
    expect((await w.selection()).planNotes[0]).toMatchObject({ used: false, reason: "invalid_date", createdAt: null });
  });

});
