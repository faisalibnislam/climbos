import { expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { stepWorkFixture, usefulStepResult } from "../fixtures/stepWork";
import { asNewUser } from "./helpers";

async function prepared() {
  const f = await stepWorkFixture();
  const { workId } = await f.owner.client.mutation(api.stepWork.start, { slug: f.slug, strategyId: f.strategyId, stepKey: f.stepKey, requestKey: "home-prepared-work" });
  await f.t.mutation(internal.stepWork.finish, { workId, result: JSON.stringify(usefulStepResult), sources: "[]" });
  const work = (await f.t.run(ctx => ctx.db.get(workId)))!;
  await f.t.mutation(internal.engine.finishRun, { runId: work.runId, status: "verified" });
  return { ...f, workId, work };
}

it("keeps the selected plan's latest prepared work visible behind unrelated history and returns exact identity", async () => {
  const f = await prepared();
  await f.t.run(async ctx => {
    const { _id, _creationTime: _planCreated, ...plan } = (await ctx.db.get(f.strategyId))!;
    const otherPlan = await ctx.db.insert("strategies", { ...plan, version: 2, status: "superseded" });
    const { _id: _workId, _creationTime: _workCreated, ...work } = f.work;
    for (let i = 0; i < 35; i++) await ctx.db.insert("planStepWork", { ...work, strategyId: otherPlan, requestKey: `unrelated-history-${i}` });
    await ctx.db.patch(_id, { status: "approved" });
  });
  const before = await f.t.run(async ctx => ({ runs: await ctx.db.query("workflowRuns").collect(), approvals: await ctx.db.query("approvals").collect(), receipts: await ctx.db.query("actionReceipts").collect() }));
  expect(await f.owner.client.query(api.stepWork.home, { slug: f.slug })).toMatchObject({ workId: f.workId, strategyId: f.strategyId, stepKey: f.stepKey, title: usefulStepResult.drafts[0].title });
  expect(await f.owner.client.query(api.stepWork.view, { slug: f.slug, strategyId: f.strategyId, stepKey: f.stepKey, workId: f.workId })).toMatchObject({ id: f.workId, historical: false });
  expect(await f.t.run(async ctx => ({ runs: await ctx.db.query("workflowRuns").collect(), approvals: await ctx.db.query("approvals").collect(), receipts: await ctx.db.query("actionReceipts").collect() }))).toEqual(before);
  const outsider = await asNewUser(f.t, "other-prepared-work@example.com");
  await expect(outsider.client.query(api.stepWork.home, { slug: f.slug })).rejects.toThrow();
  await expect(outsider.client.query(api.stepWork.view, { slug: f.slug, strategyId: f.strategyId, stepKey: f.stepKey, workId: f.workId })).rejects.toThrow();
});

it.each(["failed", "working", "malformed"] as const)("does not resurrect an earlier ready result behind a %s latest attempt", async state => {
  const f = await prepared();
  await f.t.run(async ctx => {
    const { _id, _creationTime, ...work } = f.work;
    await ctx.db.insert("planStepWork", { ...work, status: state === "malformed" ? "ready" : state, result: state === "malformed" ? "{broken" : undefined, requestKey: `new-${state}` });
  });
  expect(await f.owner.client.query(api.stepWork.home, { slug: f.slug })).toBeNull();
  expect(await f.owner.client.query(api.stepWork.view, { slug: f.slug, strategyId: f.strategyId, stepKey: f.stepKey, workId: f.workId })).toMatchObject({ id: f.workId, historical: true });
});

it("includes later saved steps and allows viewers to inspect but not change their work", async () => {
  const f = await prepared();
  await f.t.run(async ctx => {
    const plan = (await ctx.db.get(f.strategyId))!;
    const phase = plan.expert!.phases[0];
    await ctx.db.patch(f.strategyId, { expert: { ...plan.expert!, phases: Array.from({ length: 5 }, (_, i) => ({ ...phase, name: `Phase ${i + 1}` })) } });
    await ctx.db.patch(f.workId, { stepKey: "step-4", stepTitle: "Phase 5" });
  });
  const viewer = await asNewUser(f.t, "prepared-viewer@example.com");
  await f.t.run(ctx => ctx.db.insert("memberships", { orgId: f.orgId, userId: viewer.userId, role: "viewer", status: "active", createdAt: Date.now() }));
  expect(await viewer.client.query(api.stepWork.home, { slug: f.slug })).toMatchObject({ workId: f.workId, stepKey: "step-4" });
  expect(await viewer.client.query(api.stepWork.view, { slug: f.slug, strategyId: f.strategyId, stepKey: "step-4", workId: f.workId })).toMatchObject({ canEdit: false, historical: false });
  await expect(viewer.client.mutation(api.stepWork.saveDraft, { slug: f.slug, workId: f.workId, index: 0, expectedRevision: 0, body: "A forbidden edit" })).rejects.toThrow();
  await expect(viewer.client.mutation(api.stepWork.start, { slug: f.slug, strategyId: f.strategyId, stepKey: "step-4", requestKey: "viewer-cannot-prepare" })).rejects.toThrow();
  expect((await f.t.run(ctx => ctx.db.get(f.workId)))?.draftRevision).toBe(0);
});
