import { expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { stepWorkFixture, usefulStepResult } from "../fixtures/stepWork";
import { capturePlanPreparation } from "../../convex/lib/preparationContext";

it("captures source-backed step work and owner edits for plan repair, without silently changing the queued snapshot", async () => {
  const { t, owner, slug, orgId, goalId, strategyId, stepKey } = await stepWorkFixture();
  const work = await owner.client.mutation(api.stepWork.start, { slug, strategyId, stepKey, requestKey: "memory-work-request" });
  const product = "https://business.example/apps/product";
  await t.mutation(internal.stepWork.finish, { workId: work.workId, result: JSON.stringify({ ...usefulStepResult, evidence: [{ url: product, quote: "Published product details.", claim: "The page describes this product." }] }), sources: JSON.stringify([{ url: product, text: "Published product details.", status: "ok", fetchedAt: Date.now() }, { url: "https://unread.example/", text: "Unavailable", status: "failed", fetchedAt: Date.now() }]) });
  await owner.client.mutation(api.stepWork.saveDraft, { slug, workId: work.workId, index: 0, expectedRevision: 0, body: "Owner edit captured before planning." });
  const ref = await t.query(internal.stepWork.ref, { workId: work.workId });
  await t.mutation(internal.engine.finishRun, { runId: ref!.runId, status: "verified" });
  const generated = await owner.client.mutation(api.orgs.generatePlan, { slug, planStyle: "starter" });
  const run = (await t.run(ctx => ctx.db.get(generated.runId)))!;
  const snapshot = JSON.parse(JSON.parse(run.input).preparationSnapshot);
  expect(snapshot.drafts[0].body).toBe("Owner edit captured before planning.");
  expect(snapshot.sources.map((source: { url: string }) => source.url)).toEqual([product]);
  await owner.client.mutation(api.stepWork.saveDraft, { slug, workId: work.workId, index: 0, expectedRevision: 1, body: "A newer edit made after enqueue." });
  const context = await t.query(internal.jobWrites.jobContext, { runId: generated.runId });
  expect(context?.preparedStepWork).toContain("Owner edit captured before planning.");
  expect(context?.preparedStepWork).not.toContain("A newer edit");
  expect(context?.focusedResearch?.notes).toContain("Published product details.");
  await t.run(async ctx => {
    const previous = (await ctx.db.get(strategyId))!;
    const { _id, _creationTime, ...copy } = previous;
    void _id; void _creationTime;
    await ctx.db.insert("strategies", { ...copy, version: 2, createdAt: Date.now() + 1 });
  });
  const refreshed = await t.run(ctx => capturePlanPreparation(ctx, orgId, goalId));
  expect(JSON.parse(refreshed!).sourceWorkIds).toContain(String(work.workId));
  await t.run(async ctx => { const business = (await ctx.db.get(goalId))!.businessId; await ctx.db.patch(business, { website: "https://changed.example/" }); });
  expect(await t.run(ctx => capturePlanPreparation(ctx, orgId, goalId))).toBeNull();
  const other = await t.run(ctx => ctx.db.insert("organizations", { slug: "other-scope", name: "Isolated scope", kind: "customer", createdBy: owner.userId, timezone: "UTC", currency: "USD", onboardingStep: "done", createdAt: Date.now() }));
  expect(await t.run(ctx => capturePlanPreparation(ctx, other, goalId))).toBeNull();
});
