import { describe, expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";
import { focusedPlanFixture } from "../fixtures/focusedPlan";
import { runGoal } from "../../convex/lib/goals";
import { planTimeline } from "../../shared/agents/planTimeline";
import { encodeToolOutput, toolByName, type Caller } from "../../convex/lib/climbTools";

async function fixture() {
  const t = setup(); const owner = await asNewUser(t, "goal-owner@example.com");
  const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Goal Test" });
  const first = await owner.client.mutation(api.goals.save, { slug, statement: "Find a useful route to new customers" });
  const second = await owner.client.mutation(api.goals.save, { slug, statement: "Prepare a focused launch", deadline: "2027-02-23" });
  const plan = focusedPlanFixture();
  const strategyId = await t.run(async ctx => {
    const goal = (await ctx.db.get(first))!;
    return ctx.db.insert("strategies", { orgId, businessId: goal.businessId, goalId: first, version: 1, status: "needs_approval", summary: plan.summary, positioning: plan.positioning, audiences: [], channels: [], constraints: [], measurementPlan: plan.measurementPlan, sourceFactIds: [], reviewDate: "2027-02-01", generationCostMicros: 0, createdAt: Date.now(), expert: { version: 0, diagnosis: plan.diagnosis, affordableCac: plan.affordableCac, notDoing: plan.notDoing, northStar: plan.northStar, leadingIndicators: plan.leadingIndicators, phases: plan.phases, weekOneChecklist: plan.weekOneChecklist, risks: plan.risks, focusedMove: plan.focusedMove, preparedWork: plan.preparedWork, timing: plan.timing } });
  });
  return { t, owner, slug, orgId, first, second, strategyId, plan };
}

describe("goal workspace and private drafts", () => {
  it("gives the assistant the selected plan's reported measurement without new action authority", async () => {
    const { t, owner, slug, orgId, strategyId, plan } = await fixture();
    const experimentId = await t.run(ctx => ctx.db.insert("experiments", { ...plan.experiments[0], orgId, strategyId, status: "proposed", createdAt: Date.now() }));
    await owner.client.mutation(api.playResults.recordExperimentOutcome, { slug, experimentId, expectedRevision: 0, executed: true, source: "owner_report", design: "before_after", result: "missed", stopRuleHit: true, note: "No payment was made. Reconsider the proposed question.", measurement: { type: "count", value: 0, comparisonValue: null, unit: "scoping decisions", basis: "One private brief review", comparisonBasis: "Earlier count unknown" } });
    const caller = { query: owner.client.query, mutation: owner.client.mutation } as unknown as Caller;
    const tool = toolByName("get_plan")!;
    const args = tool.input.parse({ strategyId, view: "learning", experimentId });
    const output = JSON.parse(encodeToolOutput(await tool.run!(caller, slug, args), 7_800, tool.output));
    expect(output.strategyId).toBe(strategyId);
    expect(output.experiments).toHaveLength(1);
    expect(output.experiments[0].details.report).toMatchObject({ executed: true, result: "missed", stopRuleHit: true, note: "No payment was made. Reconsider the proposed question." });
    expect(output.experiments[0].details.report.reading).toContain("Recorded value: 0 scoping decisions");
    expect(output.experiments[0].details.report.reading).toContain("Comparison value: Unknown");
    expect(output.experiments[0].details.population).toBe(plan.experiments[0].population);
    expect(output.coverage).toContain("or execution authority");
    expect(tool.risk).toBe("read");
    const other = await asNewUser(t, "learning-tool-outsider@example.com");
    const foreign = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Foreign reports" });
    const foreignPlanId = await t.run(async ctx => {
      const { _id: _id, _creationTime: _time, ...row } = (await ctx.db.get(strategyId))!;
      return ctx.db.insert("strategies", { ...row, orgId: foreign.orgId });
    });
    await expect(tool.run!(caller, slug, { strategyId: foreignPlanId, view: "learning" })).rejects.toThrow(/unavailable/);
    await expect(tool.run!(caller, slug, { strategyId, experimentId: "unrelated-test", view: "learning" })).rejects.toThrow(/not available/);
    const outsider = { query: other.client.query, mutation: other.client.mutation } as unknown as Caller;
    await expect(tool.run!(outsider, slug, args)).rejects.toThrow();
    const overview = JSON.parse(encodeToolOutput(await tool.run!(caller, slug, { strategyId }), 7_800, tool.output));
    expect(overview.strategyId).toBe(strategyId);
    expect(overview.goal).toBeNull(); // Current selected goal belongs to another plan.
    expect(overview.experiments[0]).toMatchObject({ id: experimentId, hasReport: true });
    for (const table of ["approvals", "actionReceipts", "workflowRuns"] as const) expect(await t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
  });
  it("keeps the selected plan's tests visible after newer plans and excludes foreign rows", async () => {
    const { t, owner, slug, orgId, strategyId, plan } = await fixture();
    const other = await asNewUser(t, "learning-outsider@example.com");
    const foreign = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Other learning" });
    const primaryId = await t.run(async ctx => {
      const test = { ...plan.experiments[0], orgId, strategyId, status: "proposed" as const, createdAt: Date.now() };
      const primary = await ctx.db.insert("experiments", test);
      const { _id: _id, _creationTime: _time, ...old } = (await ctx.db.get(strategyId))!;
      const newer = await ctx.db.insert("strategies", { ...old, version: 2 });
      for (let i = 0; i < 25; i++) await ctx.db.insert("experiments", { ...test, strategyId: newer, name: `Other plan test ${i}` });
      // Defensive tenant check even if a malformed legacy record points at this strategy.
      await ctx.db.insert("experiments", { ...test, orgId: foreign.orgId });
      return primary;
    });
    const view = await owner.client.query(api.workspace.plan, { slug, strategyId });
    expect(view.experiments.map(e => e.id)).toEqual([primaryId]);
    expect(view.experiments[0].name).toBe(plan.focusedMove.title);
    await expect(other.client.query(api.workspace.plan, { slug, strategyId })).rejects.toThrow();
    for (const table of ["approvals", "actionReceipts", "workflowRuns"] as const) {
      expect(await t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
    }
  });
  it("persists team-reported task progress for the exact plan without approving or executing anything", async () => {
    const { t, owner, slug, orgId, strategyId, plan } = await fixture();
    const task = planTimeline(plan)[0].tasks[0];
    const args = { slug, strategyId, taskKey: task.key, expectedText: task.text, expectedRevision: 0, completed: true };
    expect(await owner.client.mutation(api.planProgress.save, args)).toEqual({ revision: 1 });
    expect(await owner.client.mutation(api.planProgress.save, args)).toEqual({ revision: 1 });
    expect((await owner.client.query(api.planProgress.view, { slug, strategyId })).rows).toEqual([expect.objectContaining({ taskKey: task.key, taskText: task.text, completed: true, revision: 1 })]);
    await expect(owner.client.mutation(api.planProgress.save, { ...args, completed: false })).rejects.toThrow(/Someone updated/);
    await expect(owner.client.mutation(api.planProgress.save, { ...args, expectedText: "A task from another plan" })).rejects.toThrow(/step has changed/);
    const next = await t.run(async ctx => {
      const { _id: _id, _creationTime: _time, ...row } = (await ctx.db.get(strategyId))!;
      return ctx.db.insert("strategies", { ...row, version: 2 });
    });
    expect((await owner.client.query(api.planProgress.view, { slug, strategyId: next })).rows).toEqual([]);
    expect((await t.run(ctx => ctx.db.get(strategyId)))?.status).toBe("needs_approval");
    expect(await t.run(ctx => ctx.db.query("artifacts").collect())).toEqual([]);
    expect(await t.run(ctx => ctx.db.query("workflowRuns").collect())).toEqual([]);
    const exported = JSON.parse(await t.query(internal.settings.exportData, { orgId }));
    expect(exported.planTaskProgress).toHaveLength(1);
    await owner.client.mutation(api.planProgress.save, { ...args, expectedRevision: 1, completed: false });
    expect((await owner.client.query(api.planProgress.view, { slug, strategyId })).rows[0].completed).toBe(false);
  });
  it("rejects cross-tenant progress and viewer edits", async () => {
    const { t, owner, slug, orgId, strategyId, plan } = await fixture();
    const other = await asNewUser(t, "progress-outsider@example.com");
    const task = planTimeline(plan)[0].tasks[0];
    const args = { slug, strategyId, taskKey: task.key, expectedText: task.text, expectedRevision: 0, completed: true };
    await expect(other.client.query(api.planProgress.view, { slug, strategyId })).rejects.toThrow();
    await t.run(ctx => ctx.db.insert("memberships", { orgId, userId: other.userId, role: "viewer", status: "active", createdAt: Date.now() }));
    expect((await other.client.query(api.planProgress.view, { slug, strategyId })).canEdit).toBe(false);
    await expect(other.client.mutation(api.planProgress.save, args)).rejects.toThrow();
    await expect(owner.client.mutation(api.planProgress.save, { ...args, taskKey: "999:999" })).rejects.toThrow(/step has changed/);
  });
  it("keeps sibling goals and plans separate, preserves deadline, and switches without AI work", async () => {
    const { t, owner, slug, orgId, first, second, strategyId } = await fixture();
    const initial = await owner.client.query(api.goals.list, { slug });
    expect(initial.goals).toHaveLength(2); expect(initial.selectedId).toBe(second);
    expect(initial.goals.find(g => g.id === second)?.deadline).toBe("2027-02-23");
    expect((await owner.client.query(api.workspace.plan, { slug })).strategy).toBeNull();
    await owner.client.mutation(api.goals.select, { slug, goalId: first });
    expect((await owner.client.query(api.workspace.plan, { slug })).strategy?.id).toBe(strategyId);
    expect((await owner.client.query(api.workspace.today, { slug })).strategy?.id).toBe(strategyId);
    expect(await t.run(ctx => ctx.db.query("workflowRuns").collect())).toEqual([]);
    await owner.client.mutation(api.goals.select, { slug, goalId: second });
    const bound = await t.run(ctx => runGoal(ctx, { orgId, input: JSON.stringify({ goalId: first }) }));
    expect(bound?._id).toBe(first);
  });
  it("edits drafts with optimistic revision checks, retains the original plan and never schedules outside actions", async () => {
    const { t, owner, slug, orgId, first, second, strategyId, plan } = await fixture();
    await owner.client.mutation(api.planDrafts.save, { slug, strategyId, index: 0, expectedRevision: 0, body: "An owner-edited private draft, ready for another look." });
    const saved = await owner.client.query(api.planDrafts.forStrategy, { slug, strategyId });
    expect(saved.edits[0]).toMatchObject({ revision: 1, body: "An owner-edited private draft, ready for another look." });
    await expect(owner.client.mutation(api.planDrafts.save, { slug, strategyId, index: 0, expectedRevision: 0, body: "A stale write must not replace the newer draft." })).rejects.toThrow(/newer draft/);
    await owner.client.mutation(api.goals.select, { slug, goalId: second });
    const library = await owner.client.query(api.planDrafts.list, { slug });
    expect(library.rows.find(r => r.strategyId === strategyId)?.goal).toBe((await t.run(ctx => ctx.db.get(first)))!.statement);
    const original = await t.run(ctx => ctx.db.get(strategyId));
    expect(original?.status).toBe("needs_approval"); expect(original?.expert?.preparedWork?.[0].draft).toBe(plan.preparedWork[0].draft);
    expect(await t.run(ctx => ctx.db.query("artifacts").collect())).toEqual([]);
    expect(await t.run(ctx => ctx.db.query("workflowRuns").collect())).toEqual([]);
    const exported = JSON.parse(await t.query(internal.settings.exportData, { orgId }));
    expect(exported.privatePlanDrafts).toHaveLength(1);
  });
  it("rejects cross-tenant access, viewer writes and unknown draft indexes", async () => {
    const { t, owner, slug, orgId, first, strategyId } = await fixture();
    const stranger = await asNewUser(t, "goal-outsider@example.com");
    await expect(stranger.client.mutation(api.goals.select, { slug, goalId: first })).rejects.toThrow();
    await expect(stranger.client.query(api.planDrafts.forStrategy, { slug, strategyId })).rejects.toThrow();
    await t.run(ctx => ctx.db.insert("memberships", { orgId, userId: stranger.userId, role: "viewer", status: "active", createdAt: Date.now() }));
    expect((await stranger.client.query(api.planDrafts.forStrategy, { slug, strategyId })).canEdit).toBe(false);
    await expect(stranger.client.mutation(api.planDrafts.save, { slug, strategyId, index: 0, expectedRevision: 0, body: "This viewer must not be allowed to save it." })).rejects.toThrow();
    await expect(owner.client.mutation(api.planDrafts.save, { slug, strategyId, index: 2, expectedRevision: 0, body: "This draft does not exist in the saved plan." })).rejects.toThrow(/not in this plan/);
    await expect(owner.client.mutation(api.goals.save, { slug, statement: "A date that does not exist", deadline: "2027-02-31" })).rejects.toThrow(/valid deadline/);
  });
});
