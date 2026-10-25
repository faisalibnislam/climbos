import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { creativeStrategyLearningBrief } from "../../convex/creativeStrategy";
import { asNewUser, makePaid, setup } from "./helpers";

async function makeWorkspace(t: ReturnType<typeof setup>, email: string) {
  const owner = await asNewUser(t, email);
  const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Creative Strategy Co" });
  await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", statement: "Find more customers", horizonDays: 90, monthlyAdBudget: 250 });
  await makePaid(t, orgId as Id<"organizations">);
  return { ...owner, slug, orgId: orgId as Id<"organizations"> };
}

async function generate(t: ReturnType<typeof setup>, workspace: Awaited<ReturnType<typeof makeWorkspace>>, creativeRange: "balanced" | "conventional" | "surprising" | "ambitious") {
  await workspace.client.mutation(api.orgs.generatePlan, { slug: workspace.slug, creativeRange });
  await t.finishAllScheduledFunctions(() => undefined);
  return await t.run(async (ctx) => (await ctx.db.query("strategies").withIndex("by_org", (q) => q.eq("orgId", workspace.orgId)).order("desc").first())!);
}

describe("creative strategy preference and tenant-scoped learning", () => {
  beforeEach(() => {
    process.env.CLIMBOS_ENGINE = "v2";
    process.env.CLIMBOS_FAKE_LLM = "ship";
  });
  afterEach(() => {
    delete process.env.CLIMBOS_ENGINE;
    delete process.env.CLIMBOS_FAKE_LLM;
  });

  it.each(["balanced", "conventional", "surprising", "ambitious"] as const)("persists the %s request and exact strategy provenance", async (creativeRange) => {
    const t = setup();
    const workspace = await makeWorkspace(t, `creative-${creativeRange}@example.com`);
    const strategy = await generate(t, workspace, creativeRange);
    const input = await t.run(async (ctx) => JSON.parse((await ctx.db.get(strategy.runId!))!.input));
    const exploration = (strategy.expert as { strategyExploration?: { requestedRange?: string; retrievedPrecedentIds?: string[]; promptVersion?: string; promptHash?: string; inputHash?: string; grounded?: unknown; adjacent?: unknown; bold?: unknown } }).strategyExploration;
    expect(input.creativeRange).toBe(creativeRange);
    expect(exploration).toMatchObject({ requestedRange: creativeRange, promptVersion: expect.any(String), promptHash: expect.stringMatching(/^[a-f0-9]{64}$/), inputHash: expect.stringMatching(/^[a-f0-9]{64}$/), grounded: expect.any(Object), adjacent: expect.any(Object), bold: expect.any(Object) });
    expect(exploration?.retrievedPrecedentIds).toEqual(expect.any(Array));
  });

  it("keeps owner edits distinct, records explicitly labeled results, and isolates feedback to its tenant", async () => {
    const t = setup();
    const workspace = await makeWorkspace(t, "creative-owner@example.com");
    const other = await makeWorkspace(t, "creative-other@example.com");
    const viewer = await asNewUser(t, "creative-viewer@example.com");
    const strategy = await generate(t, workspace, "ambitious");
    await t.run(async (ctx) => ctx.db.insert("memberships", { orgId: workspace.orgId, userId: viewer.userId, role: "viewer", status: "active", createdAt: Date.now() }));
    await expect(workspace.client.mutation(api.creativeStrategy.recordFeedback, { slug: workspace.slug, strategyId: strategy._id, mode: "bold", decision: "edited", testState: "executed", outcomeEvidence: "unknown" })).rejects.toThrow(/describe the version/i);
    await expect(workspace.client.mutation(api.creativeStrategy.recordFeedback, { slug: workspace.slug, strategyId: strategy._id, mode: "bold", decision: "selected", testState: "observed", outcomeEvidence: "measured" })).rejects.toThrow(/add the observed result/i);
    await workspace.client.mutation(api.creativeStrategy.recordFeedback, { slug: workspace.slug, strategyId: strategy._id, mode: "bold", decision: "edited", ownerEdit: "Keep the core idea, but test it with five existing customers first.", testState: "executed", outcomeEvidence: "unknown" });
    await workspace.client.mutation(api.creativeStrategy.recordFeedback, { slug: workspace.slug, strategyId: strategy._id, mode: "bold", decision: "selected", testState: "observed", outcomeNote: "Five customer interviews completed; no conversion result was measured.", outcomeEvidence: "owner_reported" });

    expect(await workspace.client.query(api.creativeStrategy.feedbackForStrategy, { slug: workspace.slug, strategyId: strategy._id })).toMatchObject({ canEdit: true, feedback: { bold: { decision: "selected", testState: "observed", outcomeEvidence: "owner_reported" } } });
    expect(await viewer.client.query(api.creativeStrategy.feedbackForStrategy, { slug: workspace.slug, strategyId: strategy._id })).toMatchObject({ canEdit: false });
    await expect(viewer.client.mutation(api.creativeStrategy.recordFeedback, { slug: workspace.slug, strategyId: strategy._id, mode: "bold", decision: "rejected", testState: "not_started", outcomeEvidence: "unknown" })).rejects.toThrow(/can't/i);
    await expect(other.client.query(api.creativeStrategy.feedbackForStrategy, { slug: other.slug, strategyId: strategy._id })).rejects.toThrow(/couldn't find/i);
    const learning = await t.run(async (ctx) => creativeStrategyLearningBrief(ctx, workspace.orgId));
    expect(learning).toContain("owner-reported");
    expect(learning).toContain("Five customer interviews");
    expect(learning).toContain("not proof of business performance");
    expect(learning).not.toContain("creative-other@example.com");
    const audits = await t.run(async (ctx) => ctx.db.query("auditEvents").withIndex("by_org_created", (q) => q.eq("orgId", workspace.orgId)).collect());
    expect(audits.filter((entry) => entry.action === "strategy_exploration.feedback")).toHaveLength(2);
    const records = await t.run(async (ctx) => ctx.db.query("strategyExplorationFeedback").withIndex("by_strategy_mode", (q) => q.eq("strategyId", strategy._id).eq("mode", "bold")).collect());
    expect(records[0]).toMatchObject({ optionHash: expect.stringMatching(/^[a-f0-9]{64}$/), strategyStatusAtFeedback: "needs_approval" });
    expect(records.find((record) => record.ownerEdit)?.ownerEditHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("reuses explicit plan rejection notes as tenant-scoped preferences, not evidence", async () => {
    const t = setup();
    const workspace = await makeWorkspace(t, "creative-rejected-plan@example.com");
    const other = await makeWorkspace(t, "creative-rejected-other@example.com");
    const rejected = await generate(t, workspace, "balanced");
    await workspace.client.mutation(api.workspace.decidePlan, {
      slug: workspace.slug,
      strategyId: rejected._id,
      decision: "reject",
      note: "We cannot support another live workshop this quarter; keep work asynchronous.",
    });

    const learning = await t.run(async (ctx) => creativeStrategyLearningBrief(ctx, workspace.orgId));
    const otherLearning = await t.run(async (ctx) => creativeStrategyLearningBrief(ctx, other.orgId));
    expect(learning).toContain("owner-reported rationale");
    expect(learning).toContain("keep work asynchronous");
    expect(learning).toContain("preference signals, not proof of business performance");
    expect(learning).toContain("Recheck current facts, goal and constraints");
    expect(otherLearning).not.toContain("keep work asynchronous");
  });
});
