import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkInvariants } from "../../shared/economics/ledger";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { ledgerOf } from "../../convex/lib/periods";
import { asNewUser, setup, type T } from "./helpers";

/** Stopped jobs continue from their last finished step: owner Retry and automatic resume after an interruption. */

async function workspace(t: T, email: string) {
  const owner = await asNewUser(t, email);
  const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Retry Co" });
  await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", statement: "More paying customers", horizonDays: 90, monthlyAdBudget: 300 });
  return { ...owner, slug, orgId: orgId as Id<"organizations"> };
}

async function planRun(t: T, orgId: Id<"organizations">) {
  return t.run(async (ctx) => (await ctx.db.query("workflowRuns").withIndex("by_org_created", (q) => q.eq("orgId", orgId)).order("desc").collect()).find((r) => r.kind === "strategy")!);
}

async function periodOf(t: T, orgId: Id<"organizations">) {
  return t.run(async (ctx) => (await ctx.db.query("usagePeriods").collect()).find((p) => p.orgId === orgId)!);
}

describe("Retry from checkpoints", () => {
  beforeEach(() => {
    process.env.CLIMBOS_ENGINE = "v2";
    delete process.env.CLIMBOS_AGENT_SOFT_LIMIT_MS;
  });
  afterEach(() => {
    delete process.env.CLIMBOS_ENGINE;
    delete process.env.CLIMBOS_FAKE_LLM;
  });

  it("an owner retry continues a failed plan, charges only the rest and keeps the ledger whole", async () => {
    process.env.CLIMBOS_FAKE_LLM = "fail";
    const t = setup();
    const w = await workspace(t, "retry-owner@example.com");
    await w.client.mutation(api.orgs.generatePlan, { slug: w.slug });
    await t.finishAllScheduledFunctions(() => undefined);
    const failed = await planRun(t, w.orgId);
    expect(failed.status).toBe("failed");
    expect(failed.resumeWith?.fn).toBe("buildStrategy");
    const status = await w.client.query(api.content.runStatus, { slug: w.slug, runId: failed._id });
    expect(status.canRetry).toBe(true);
    const spentBefore = (await periodOf(t, w.orgId)).walletSpentMicros;

    process.env.CLIMBOS_FAKE_LLM = "ship";
    await w.client.mutation(api.workspace.retryRun, { slug: w.slug, runId: failed._id });
    await t.finishAllScheduledFunctions(() => undefined);
    const run = await planRun(t, w.orgId);
    expect(run.status).toBe("verified");
    expect(run.retries).toBe(1);
    const steps = await t.run(async (ctx) => ctx.db.query("workflowSteps").withIndex("by_run", (q) => q.eq("runId", run._id)).collect());
    // The failed step ran again in place; no step is duplicated.
    expect(new Set(steps.map((s) => s.label)).size).toBe(steps.length);
    expect(steps.every((s) => s.status === "succeeded")).toBe(true);
    expect(steps.some((s) => s.attempt > 1)).toBe(true);
    const period = await periodOf(t, w.orgId);
    expect(period.walletReservedMicros).toBe(0);
    // Total spend equals the jobs' total cost (the plan plus its first-win drafts): the first attempt isn't charged twice.
    const allRuns = await t.run(async (ctx) => (await ctx.db.query("workflowRuns").collect()).filter((r) => r.orgId === w.orgId));
    expect(period.walletSpentMicros).toBe(allRuns.reduce((s, r) => s + r.actualMicros, 0));
    expect(allRuns.filter((r) => r.kind !== "strategy").length).toBe(2); // first win: posts + email
    expect(period.walletSpentMicros).toBeGreaterThanOrEqual(spentBefore);
    expect(checkInvariants(ledgerOf(period))).toEqual([]);
    // A finished run can't be retried.
    await expect(w.client.mutation(api.workspace.retryRun, { slug: w.slug, runId: run._id })).rejects.toThrow(/stopped job/);
  });

  it("the reaper resumes an interrupted run instead of failing it, then fails after the resume limit", async () => {
    process.env.CLIMBOS_FAKE_LLM = "ship";
    const t = setup();
    const w = await workspace(t, "retry-reaper@example.com");
    await w.client.mutation(api.orgs.generatePlan, { slug: w.slug });
    await t.finishAllScheduledFunctions(() => undefined);
    const done = await planRun(t, w.orgId);
    expect(done.status).toBe("verified");
    // Simulate an action that died mid-step: the run looks in progress and silent for 20 minutes.
    const stale = Date.now() - 20 * 60_000;
    await t.run(async (ctx) => {
      await ctx.db.patch(done._id, { status: "executing", updatedAt: stale, finishedAt: undefined });
      const last = (await ctx.db.query("workflowSteps").withIndex("by_run", (q) => q.eq("runId", done._id)).collect()).at(-1)!;
      await ctx.db.patch(last._id, { status: "running" });
    });
    await t.mutation(internal.engine.recoverStuckRuns, {});
    let run = await planRun(t, w.orgId);
    expect(run.status).toBe("executing");
    expect(run.resumes).toBe(1);
    await t.finishAllScheduledFunctions(() => undefined);
    run = await planRun(t, w.orgId);
    expect(run.status).toBe("verified");

    // Past the limit, the run fails and offers Retry.
    await t.run(async (ctx) => ctx.db.patch(done._id, { status: "executing", updatedAt: stale, finishedAt: undefined, resumes: 2 }));
    await t.mutation(internal.engine.recoverStuckRuns, {});
    run = await planRun(t, w.orgId);
    expect(run.status).toBe("failed");
    expect(run.userMessage).toMatch(/Retry/);
  });
});
