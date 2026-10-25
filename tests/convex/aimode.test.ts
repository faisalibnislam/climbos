import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { estimateJobMicros, planJob } from "../../convex/lib/jobPlans";
import { asNewUser, setup, type T } from "./helpers";

/** Climb AI Basic is available to all; Expert (paid) allows measured Sol escalation on eligible work. */

async function workspace(t: T, email: string) {
  const owner = await asNewUser(t, email);
  const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Mode Co" });
  await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", statement: "More paying customers", horizonDays: 90, monthlyAdBudget: 300 });
  return { ...owner, slug, orgId: orgId as Id<"organizations"> };
}

async function makePaid(t: T, orgId: Id<"organizations">) {
  await t.run(async (ctx) => {
    const now = Date.now();
    const accountId = (await ctx.db.get(orgId))!.accountId;
    await ctx.db.insert("subscriptions", { orgId, accountId, polarSubscriptionId: `sub_${orgId}`, productId: "p", planKey: "starter", status: "active", cancelAtPeriodEnd: false, currentPeriodStart: now - 86_400_000, currentPeriodEnd: now + 29 * 86_400_000, entitlementVersionId: "e", rateVersionId: "r", sourceModifiedAt: now, updatedAt: now });
    for (const p of await ctx.db.query("usagePeriods").collect()) if (p.accountId === accountId) await ctx.db.patch(p._id, { source: "subscription", walletCapMicros: 20_000_000 });
  });
}

async function lastRun(t: T, orgId: Id<"organizations">, kind: string) {
  return t.run(async (ctx) => (await ctx.db.query("workflowRuns").withIndex("by_org_created", (q) => q.eq("orgId", orgId)).order("desc").collect()).find((r) => r.kind === kind)!);
}

describe("Climb AI Basic / Expert", () => {
  beforeEach(() => {
    process.env.CLIMBOS_ENGINE = "v2";
    process.env.CLIMBOS_FAKE_LLM = "ship";
  });
  afterEach(() => {
    delete process.env.CLIMBOS_ENGINE;
    delete process.env.CLIMBOS_FAKE_LLM;
  });

  it("free workspaces run Basic on Luna and can't choose Expert", async () => {
    const t = setup();
    const w = await workspace(t, "mode-free@example.com");
    expect(await w.client.query(api.workspace.aiMode, { slug: w.slug })).toMatchObject({ mode: "basic", expertUnlocked: false });
    await expect(w.client.mutation(api.orgs.generatePlan, { slug: w.slug, aiMode: "expert" })).rejects.toThrow(/paid plan/);
    await w.client.mutation(api.orgs.generatePlan, { slug: w.slug });
    await t.finishAllScheduledFunctions(() => undefined);
    const run = await lastRun(t, w.orgId, "strategy");
    expect(run.aiMode).toBeUndefined();
    const steps = await t.run(async (ctx) => ctx.db.query("workflowSteps").withIndex("by_run", (q) => q.eq("runId", run._id)).collect());
    expect(steps.filter((s) => s.model).every((s) => s.model === "gpt-6-luna")).toBe(true);
  });

  it("paid workspaces default to Expert with Luna baseline and keep Basic available", async () => {
    const t = setup();
    const w = await workspace(t, "mode-paid@example.com");
    await makePaid(t, w.orgId);
    expect(await w.client.query(api.workspace.aiMode, { slug: w.slug })).toMatchObject({ mode: "expert", expertUnlocked: true });
    await w.client.mutation(api.orgs.generatePlan, { slug: w.slug });
    await t.finishAllScheduledFunctions(() => undefined);
    const run = await lastRun(t, w.orgId, "strategy");
    expect(run.aiMode).toBe("expert");
    expect(run.estimateMicros).toBe(estimateJobMicros(planJob("strategy", {}, { mode: "expert" })));
    const steps = await t.run(async (ctx) => ctx.db.query("workflowSteps").withIndex("by_run", (q) => q.eq("runId", run._id)).collect());
    const modelOf = (label: string) => steps.find((s) => s.label === label)?.model;
    expect(modelOf("Growth plan: draft")).toBe("gpt-6-luna");
    expect(modelOf("Growth plan: review 1")).toBe("gpt-6-luna");
    expect(modelOf("Growth plays: research")).toBe("gpt-6-luna");
    // The owner can save Basic as the default.
    await w.client.mutation(api.workspace.setAiMode, { slug: w.slug, mode: "basic" });
    expect(await w.client.query(api.workspace.aiMode, { slug: w.slug })).toMatchObject({ mode: "basic", expertUnlocked: true });
  });

  it("shows first-research credit estimates and honors a paid owner's Basic choice", async () => {
    const t = setup();
    const w = await workspace(t, "mode-onboarding-choice@example.com");
    await makePaid(t, w.orgId);

    const available = await w.client.query(api.orgs.newWorkspaceAiMode, {});
    expect(available.expertUnlocked).toBe(true);
    expect(available.estimates.onboarding_research.basic).toBeGreaterThan(0);
    expect(available.estimates.onboarding_research.expert).toBeGreaterThan(0);
    expect(available.estimates.onboarding_research.basic).toBe(estimateJobMicros(planJob("onboarding_research", { pages: 3 }, { mode: "basic" })));
    expect(available.estimates.onboarding_research.expert).toBe(estimateJobMicros(planJob("onboarding_research", { pages: 3 }, { mode: "expert" })));

    await w.client.mutation(api.orgs.startResearch, {
      slug: w.slug,
      website: "https://mode.example",
      ownerText: "We provide a local repair service.",
      aiMode: "basic",
    });
    const run = await lastRun(t, w.orgId, "onboarding_research");
    expect(run.estimateMicros).toBe(estimateJobMicros(planJob("onboarding_research", { pages: 3 }, { mode: "basic" })));
    expect(run.estimateMicros).not.toBe(estimateJobMicros(planJob("onboarding_research", { pages: 3 }, { mode: "expert" })));
  });

  it("matches the legacy-engine reservation estimate when Engine v2 is disabled", async () => {
    delete process.env.CLIMBOS_ENGINE;
    const t = setup();
    const w = await workspace(t, "mode-legacy-estimate@example.com");
    await w.client.mutation(api.orgs.startResearch, {
      slug: w.slug,
      website: "https://legacy-mode.example",
      ownerText: "We provide a local repair service.",
      aiMode: "basic",
    });
    const run = await lastRun(t, w.orgId, "onboarding_research");
    expect(run.estimateMicros).toBe(estimateJobMicros(planJob("onboarding_research", { pages: 3 }, { mode: "basic" })));
  });
});
