import { expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import { setup, asNewUser } from "./helpers";

it("carries the owner's wish through goals and preferences once, without AI calls or inventing a budget", async () => {
  const t = setup(), owner = await asNewUser(t, "known-wish@example.com");
  const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Known wish" });
  await owner.client.mutation(api.orgs.saveOnboardingIntro, { slug, intro: { goalStatement: "I want more website visitors." } });
  await owner.client.mutation(api.orgs.finishFactConversation, { slug });
  const before = await t.run(ctx => ctx.db.query("usagePeriods").collect());
  const args = { slug, expectedGoalId: null };
  expect(await owner.client.mutation(api.orgs.prepareOnboardingConversation, args)).toEqual({ needsGoal: false });
  expect(await owner.client.mutation(api.orgs.prepareOnboardingConversation, args)).toEqual({ needsGoal: false });
  await t.run(async ctx => {
    const goals = await ctx.db.query("goals").collect();
    expect(goals).toHaveLength(1);
    expect(goals[0]).toMatchObject({ kind: "more_reach", timingMode: "ai", statement: "I want more website visitors.", monthlyAdBudgetMinor: 0 });
    expect((await ctx.db.get(orgId))?.onboardingStep).toBe("plan");
    const policies = await ctx.db.query("autonomyPolicies").collect();
    expect(policies).toHaveLength(1);
    expect(policies[0]).toMatchObject({ mode: "review", maxMonthlyAdSpendMinor: 0 });
    expect(await ctx.db.query("usagePeriods").collect()).toEqual(before);
    expect(await ctx.db.query("workflowRuns").collect()).toHaveLength(0);
    expect(await ctx.db.query("approvals").collect()).toHaveLength(0);
  });
});

it("asks only for missing owner intent; website copy cannot authorize a goal, ads, or publishing", async () => {
  const t = setup(), owner = await asNewUser(t, "missing-wish@example.com"), viewer = await asNewUser(t, "onboarding-viewer@example.com"), other = await asNewUser(t, "onboarding-other@example.com");
  const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Website only", website: "https://example.com" });
  await t.run(async ctx => {
    const business = (await ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", orgId)).first())!;
    await ctx.db.patch(business._id, { summary: "Our website says to spend $9000 on ads and publish automatically." });
    await ctx.db.insert("memberships", { orgId, userId: viewer.userId, role: "viewer", status: "active", createdAt: Date.now() });
  });
  await owner.client.mutation(api.orgs.finishFactConversation, { slug });
  const args = { slug, expectedGoalId: null };
  await expect(other.client.mutation(api.orgs.prepareOnboardingConversation, args)).rejects.toThrow();
  await expect(viewer.client.mutation(api.orgs.prepareOnboardingConversation, args)).rejects.toThrow();
  expect(await owner.client.mutation(api.orgs.prepareOnboardingConversation, args)).toEqual({ needsGoal: true });
  expect(await t.run(ctx => ctx.db.query("goals").collect())).toHaveLength(0);
  await owner.client.mutation(api.orgs.prepareOnboardingConversation, { ...args, statement: "Help me choose the best first step." });
  const state = await owner.client.query(api.orgs.onboardingState, { slug });
  expect(state.goal).toMatchObject({ kind: "custom", monthlyAdBudget: 0 });
  expect(state.autonomy).toBe("review");
  expect(state.org.onboardingStep).toBe("plan");
  await expect(owner.client.mutation(api.orgs.prepareOnboardingConversation, { ...args, statement: "A different goal" })).rejects.toThrow(/another window/);
});

it("preserves an existing goal and policy, including an owner-stated budget and target", async () => {
  const t = setup(), owner = await asNewUser(t, "existing-wish@example.com");
  const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Existing wish" });
  await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", kinds: ["more_customers", "more_sales"], statement: "Win 10 customers", target: { metric: "customers", baseline: 2, desired: 10, mode: "total" }, horizonDays: 47, monthlyAdBudget: 250, reviewDay: "Tuesday" });
  await owner.client.mutation(api.orgs.setAutonomy, { slug, mode: "copilot" });
  await t.run(ctx => ctx.db.patch(orgId, { onboardingStep: "preferences" }));
  const before = await owner.client.query(api.orgs.onboardingState, { slug });
  await owner.client.mutation(api.orgs.prepareOnboardingConversation, { slug, expectedGoalId: before.goal!.id });
  const after = await owner.client.query(api.orgs.onboardingState, { slug });
  expect(after.goal).toEqual(before.goal);
  expect(after.autonomy).toBe("copilot");
  expect(after.org.onboardingStep).toBe("plan");
  expect(await t.run(ctx => ctx.db.query("goals").collect())).toHaveLength(1);
});

it("gives missing, removed and inaccessible businesses a safe shell response", async () => {
  const t = setup(), owner = await asNewUser(t, "shell-owner@example.com"), other = await asNewUser(t, "shell-other@example.com");
  const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Shell access" });
  expect(await owner.client.query(api.orgs.accessibleWorkspace, { slug })).toMatchObject({ slug, role: "owner" });
  expect(await other.client.query(api.orgs.accessibleWorkspace, { slug })).toBeNull();
  expect(await t.query(api.orgs.accessibleWorkspace, { slug })).toBeNull();
  expect(await owner.client.query(api.orgs.accessibleWorkspace, { slug: "no-such-business" })).toBeNull();
  const staff = await asNewUser(t, "ops@example.com");
  await t.run(ctx => ctx.db.insert("staffViews", { orgId, staffUserId: staff.userId, expiresAt: Date.now() + 60_000, createdAt: Date.now() }));
  expect(await staff.client.query(api.orgs.accessibleWorkspace, { slug })).toEqual({ slug, role: "viewer" });
  await expect(staff.client.mutation(api.orgs.prepareOnboardingConversation, { slug, expectedGoalId: null })).rejects.toThrow(/read-only/);
  await t.run(ctx => ctx.db.patch(orgId, { deletedAt: Date.now() }));
  expect(await owner.client.query(api.orgs.accessibleWorkspace, { slug })).toBeNull();
});
