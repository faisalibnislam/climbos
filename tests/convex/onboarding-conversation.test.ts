import { expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";

it("confirms only displayed wording atomically, saves corrections, and leaves skipped research unconfirmed", async () => {
  const t = setup(), owner = await asNewUser(t, "chat-owner@example.com"), outsider = await asNewUser(t, "chat-outsider@example.com"), viewer = await asNewUser(t, "chat-viewer@example.com");
  const { orgId, slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Isolated chat test" });
  const ids = await t.run(async ctx => {
    const b = (await ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", orgId)).first())!;
    await ctx.db.patch(orgId, { onboardingStep: "facts" });
    await ctx.db.insert("memberships", { orgId, userId: viewer.userId, role: "viewer", status: "active", createdAt: Date.now() });
    return Promise.all(["First detail", "Second detail", "Unseen detail"].map(statement => ctx.db.insert("businessFacts", { orgId, businessId: b._id, category: "product", statement, confidence: "medium", reviewState: "needs_review", provenance: "researched", sourceIds: [], createdAt: Date.now(), updatedAt: Date.now() })));
  });
  const budget = await t.run(ctx => ctx.db.query("usagePeriods").collect());
  const args = { slug, facts: [{ id: ids[0], statement: "First detail" }, { id: ids[1], statement: "stale wording" }], answer: "confirm" as const };
  await expect(owner.client.mutation(api.orgs.answerOnboardingCheck, args)).rejects.toThrow(/detail changed/);
  expect((await t.run(ctx => ctx.db.get(ids[0])))?.reviewState).toBe("needs_review");
  await expect(outsider.client.mutation(api.orgs.answerOnboardingCheck, args)).rejects.toThrow();
  await expect(viewer.client.mutation(api.orgs.finishFactConversation, { slug })).rejects.toThrow();
  await expect(viewer.client.mutation(api.orgs.answerOnboardingCheck, args)).rejects.toThrow();
  await owner.client.mutation(api.orgs.answerOnboardingCheck, { ...args, facts: [{ id: ids[0], statement: "First detail" }] });
  await owner.client.mutation(api.orgs.answerOnboardingCheck, { slug, facts: [{ id: ids[1], statement: "Second detail" }], answer: "edit", replacement: "The owner’s correction" });
  await expect(owner.client.mutation(api.orgs.answerOnboardingCheck, { ...args, answer: "edit", replacement: "Cannot edit a batch" })).rejects.toThrow(/one detail/);
  await owner.client.mutation(api.orgs.finishFactConversation, { slug });
  await t.run(async ctx => {
    expect((await ctx.db.get(ids[0]))?.reviewState).toBe("confirmed");
    expect(await ctx.db.get(ids[1])).toMatchObject({ reviewState: "edited", statement: "The owner’s correction", provenance: "researched" });
    expect((await ctx.db.get(ids[2]))?.reviewState).toBe("needs_review");
    expect((await ctx.db.get(orgId))?.onboardingStep).toBe("goal");
    expect(await ctx.db.query("usagePeriods").collect()).toEqual(budget);
    expect(await ctx.db.query("workflowRuns").collect()).toHaveLength(0);
    await ctx.db.patch(orgId, { onboardingStep: "done" });
  });
  await owner.client.mutation(api.orgs.finishFactConversation, { slug });
  expect((await t.run(ctx => ctx.db.get(orgId)))?.onboardingStep).toBe("done");
});
