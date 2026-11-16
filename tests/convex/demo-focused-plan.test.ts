import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";

beforeEach(() => {
  vi.stubEnv("CLIMBOS_ENGINE", "v2");
  vi.stubEnv("CLIMBOS_FAKE_LLM", "");
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Demo must not use the network"); }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("opens a fresh demo with the current focused workflow without generating a plan", async () => {
  const t = setup();
  const owner = await asNewUser(t, "demo-first-visit@example.com", { anonymous: true });
  const { slug } = await owner.client.mutation(api.demo.createDemoWorkspace, {});
  await t.finishAllScheduledFunctions(() => undefined);
  const view = await owner.client.query(api.workspace.plan, { slug });
  expect(view.strategy?.expert?.focusedMove?.title).toBe("Check one agency intake handoff");
  expect(view.strategy?.expert?.preparedWork).toHaveLength(1);
  expect(view.strategy?.expert?.strategyExploration?.bold.title).toBe("Become known for the brief you decline");
  expect(view.strategy?.expert?.phases).toHaveLength(2);
  expect(view.experiments).toMatchObject([{ name: view.strategy?.expert?.focusedMove?.title, status: "proposed", baselineRate: null }]);
  expect(view.strategy?.channels).toMatchObject([{ key: "partnerships", adSpendMinor: 0 }]);
  expect((await t.run(ctx => ctx.db.get(view.strategy!.id)))?.generationCostMicros).toBe(0);
  expect(await t.run(ctx => ctx.db.query("workflowRuns").collect())).toEqual([]);
  const ownerText = "Owner-edited private demo brief. Preserve this text when opening the demo again.";
  await owner.client.mutation(api.planDrafts.save, { slug, strategyId: view.strategy!.id, index: 0, expectedRevision: 0, body: ownerText });
  expect(await owner.client.mutation(api.demo.createDemoWorkspace, {})).toEqual({ slug });
  expect((await owner.client.query(api.workspace.plan, { slug })).strategy?.id).toBe(view.strategy?.id);
  expect((await owner.client.query(api.planDrafts.forStrategy, { slug, strategyId: view.strategy!.id })).edits).toMatchObject([{ body: ownerText, revision: 1 }]);
  expect(fetch).not.toHaveBeenCalled();
});

it.each(["starter", "focused"] as const)("prepares the current %s owner workflow in demo without a provider call", async planStyle => {
  const t = setup();
  const owner = await asNewUser(t, `demo-${planStyle}@example.com`, { anonymous: true });
  const { slug } = await owner.client.mutation(api.demo.createDemoWorkspace, {});
  await t.finishAllScheduledFunctions(() => undefined);
  const before = await owner.client.query(api.workspace.plan, { slug });
  const authority = () => t.run(async ctx => ({
    receipts: await ctx.db.query("actionReceipts").collect(),
    approvals: await ctx.db.query("approvals").collect(),
    artifacts: await ctx.db.query("artifacts").collect(),
  }));
  const beforeAuthority = await authority();
  const { runId } = await owner.client.mutation(api.orgs.generatePlan, { slug, planStyle });
  await t.finishAllScheduledFunctions(() => undefined);
  const result = await t.run(async ctx => {
    const run = (await ctx.db.get(runId))!;
    const plan = await ctx.db.query("strategies").withIndex("by_org", q => q.eq("orgId", run.orgId)).order("desc").first();
    const usage = await ctx.db.query("usageEvents").withIndex("by_run", q => q.eq("runId", runId)).collect();
    return { run, plan, usage };
  });
  expect(result.run.status).toBe("verified");
  expect(result.run.isFixture).toBe(true);
  expect(result.run.engine).toBeUndefined();
  expect(result.plan?.expert?.focusedMove?.title).toBeTruthy();
  expect(result.plan?.expert?.preparedWork).toHaveLength(1);
  expect(result.plan?.expert?.strategyExploration?.bold.evidenceBasis).toBe("speculative_hypothesis");
  const view = await owner.client.query(api.workspace.plan, { slug, strategyId: result.plan!._id });
  expect(view.experiments.filter(e => e.name === result.plan?.expert?.focusedMove?.title)).toHaveLength(1);
  expect(result.plan?.version).toBeGreaterThan(before.strategy?.version ?? 0);
  expect(result.plan?.status).toBe("needs_approval");
  expect(result.plan?.expert?.quality).toBeUndefined();
  expect(result.plan?.expert?.strategyExploration?.promptHash).toBeUndefined();
  expect(result.usage.length).toBeGreaterThan(0);
  expect(result.usage.every(u => u.provider === "fixture")).toBe(true);
  expect(result.usage.every(u => u.costMicros === 0)).toBe(true);
  const afterAuthority = await authority();
  expect(afterAuthority.receipts).toEqual(beforeAuthority.receipts);
  expect(afterAuthority.artifacts).toEqual(beforeAuthority.artifacts);
  expect(afterAuthority.approvals.filter(a => beforeAuthority.approvals.some(b => b._id === a._id))).toEqual(beforeAuthority.approvals);
  expect(afterAuthority.approvals.filter(a => !beforeAuthority.approvals.some(b => b._id === a._id))).toMatchObject([{ subjectId: result.plan!._id, actionKind: "approve_plan", status: "pending", scope: {} }]);
  expect((await owner.client.query(api.workspace.plan, { slug, strategyId: before.strategy!.id })).strategy?.status).toBe("approved");
  const outsider = await asNewUser(t, "outsider@example.com");
  await expect(outsider.client.mutation(api.orgs.generatePlan, { slug, planStyle })).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
});

it("keeps an explicitly detailed demo update on its existing fixture path", async () => {
  const t = setup();
  const owner = await asNewUser(t, "demo-detailed@example.com", { anonymous: true });
  const { slug } = await owner.client.mutation(api.demo.createDemoWorkspace, {});
  await t.finishAllScheduledFunctions(() => undefined);
  const { runId } = await owner.client.mutation(api.orgs.generatePlan, { slug, planStyle: "detailed" });
  await t.finishAllScheduledFunctions(() => undefined);
  const result = await t.run(async ctx => ({ run: await ctx.db.get(runId), plans: await ctx.db.query("strategies").collect() }));
  expect(result.run?.status).toBe("verified");
  const plan = result.plans.find(p => p.runId === runId)!;
  expect(plan.channels).toHaveLength(4);
  expect(plan.expert?.focusedMove).toBeUndefined();
  expect(fetch).not.toHaveBeenCalled();
});
