import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkInvariants } from "../../shared/economics/ledger";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { ledgerOf } from "../../convex/lib/periods";
import { asNewUser, setup, type T } from "./helpers";

/**
 * Engine v2 wiring: the agent loop runs as checkpointed, metered workflow
 * steps inside real jobs. The model is a deterministic stand-in
 * (CLIMBOS_FAKE_LLM), so these tests check the plumbing exactly: steps,
 * metering, reservations, revisions, failures and resume after a yield.
 */

async function workspace(t: T, email: string) {
  const owner = await asNewUser(t, email);
  const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Wire Co" });
  await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", statement: "More paying customers", horizonDays: 90, monthlyAdBudget: 300 });
  return { ...owner, slug, orgId: orgId as Id<"organizations"> };
}

async function runData(t: T, runId: Id<"workflowRuns">) {
  return t.run(async (ctx) => {
    const run = await ctx.db.get(runId);
    const steps = await ctx.db.query("workflowSteps").withIndex("by_run", (q) => q.eq("runId", runId)).collect();
    const usage = await ctx.db.query("usageEvents").withIndex("by_run", (q) => q.eq("runId", runId)).collect();
    const reservation = run?.reservationId ? await ctx.db.get(run.reservationId) : null;
    const period = reservation ? await ctx.db.get(reservation.periodId) : null;
    return { run, steps, usage, reservation, period };
  });
}

async function latestRun(t: T, orgId: Id<"organizations">, kind: string) {
  return t.run(async (ctx) => (await ctx.db.query("workflowRuns").withIndex("by_org_created", (q) => q.eq("orgId", orgId)).order("desc").collect()).find((r) => r.kind === kind)!);
}

describe("Engine v2 wiring", () => {
  beforeEach(() => {
    process.env.CLIMBOS_ENGINE = "v2";
    process.env.CLIMBOS_FAKE_LLM = "ship";
    delete process.env.CLIMBOS_AGENT_SOFT_LIMIT_MS;
  });
  afterEach(() => {
    delete process.env.CLIMBOS_ENGINE;
    delete process.env.CLIMBOS_FAKE_LLM;
    delete process.env.CLIMBOS_AGENT_SOFT_LIMIT_MS;
  });

  it("runs a growth plan as draft + review steps, meters every call and reconciles once", async () => {
    const t = setup();
    const w = await workspace(t, "v2-plan@example.com");
    await w.client.mutation(api.orgs.generatePlan, { slug: w.slug });
    await t.finishAllScheduledFunctions(() => undefined);
    const run = await latestRun(t, w.orgId, "strategy");
    expect(run.engine).toBe("v2");
    const d = await runData(t, run._id);
    expect(d.run?.status).toBe("verified");
    const labels = d.steps.map((s) => s.label);
    expect(labels).toEqual(expect.arrayContaining(["Growth plan: draft", "Growth plan: review 1"]));
    expect(labels.some((l) => l.includes("revision"))).toBe(false); // shipped first time
    expect(d.steps.every((s) => s.status === "succeeded")).toBe(true);
    expect(d.usage.length).toBeGreaterThanOrEqual(2);
    expect(d.run!.actualMicros).toBe(d.usage.reduce((s, u) => s + u.costMicros, 0));
    expect(d.reservation?.status).not.toBe("held");
    expect(checkInvariants(ledgerOf(d.period!))).toEqual([]);
    // The expert plan fields are saved.
    const strategy = await t.run(async (ctx) => ctx.db.query("strategies").withIndex("by_org", (q) => q.eq("orgId", w.orgId)).order("desc").first());
    expect(strategy?.expert?.diagnosis).toContain("fake-v1");
    expect(strategy?.expert?.weekOneChecklist.length).toBeGreaterThan(0);
  });

  it("revises when the review fails, reserving each extra round first, and keeps the better version", async () => {
    process.env.CLIMBOS_FAKE_LLM = "revise";
    const t = setup();
    const w = await workspace(t, "v2-revise@example.com");
    await w.client.mutation(api.orgs.generatePlan, { slug: w.slug });
    await t.finishAllScheduledFunctions(() => undefined);
    const run = await latestRun(t, w.orgId, "strategy");
    const d = await runData(t, run._id);
    expect(d.run?.status).toBe("verified");
    const labels = d.steps.map((s) => s.label);
    expect(labels).toEqual(expect.arrayContaining(["Growth plan: draft", "Growth plan: review 1", "Reserve revision 1", "Growth plan: revision 1", "Growth plan: review 2"]));
    expect(d.run!.estimateMicros).toBeGreaterThan(0);
    const strategy = await t.run(async (ctx) => ctx.db.query("strategies").withIndex("by_org", (q) => q.eq("orgId", w.orgId)).order("desc").first());
    expect(strategy?.expert?.diagnosis).toContain("fake-v2"); // the passing revision was kept
    expect(checkInvariants(ledgerOf(d.period!))).toEqual([]);
  });

  it("fails honestly when the provider fails, keeping what was spent and releasing the rest", async () => {
    process.env.CLIMBOS_FAKE_LLM = "fail";
    const t = setup();
    const w = await workspace(t, "v2-fail@example.com");
    await w.client.mutation(api.orgs.generatePlan, { slug: w.slug });
    await t.finishAllScheduledFunctions(() => undefined);
    const run = await latestRun(t, w.orgId, "strategy");
    const d = await runData(t, run._id);
    expect(d.run?.status).toBe("failed");
    expect(d.run?.userMessage).toMatch(/AI service had a problem|try again/i);
    expect(d.steps.some((s) => s.status === "failed")).toBe(true);
    expect(d.period!.walletReservedMicros).toBe(0);
    expect(d.period!.walletSpentMicros).toBe(d.run!.actualMicros);
    expect(checkInvariants(ledgerOf(d.period!))).toEqual([]);
  });

  it("yields before the action time limit and resumes from checkpoints without repeating work", async () => {
    process.env.CLIMBOS_FAKE_LLM = "revise";
    process.env.CLIMBOS_AGENT_SOFT_LIMIT_MS = "1"; // every action yields after starting
    const t = setup();
    const w = await workspace(t, "v2-yield@example.com");
    await w.client.mutation(api.orgs.generatePlan, { slug: w.slug });
    await t.finishAllScheduledFunctions(() => undefined);
    const run = await latestRun(t, w.orgId, "strategy");
    const d = await runData(t, run._id);
    expect(d.run?.status).toBe("verified");
    // Each phase ran exactly once despite many resumed actions.
    const counts = new Map<string, number>();
    for (const s of d.steps) counts.set(s.label, (counts.get(s.label) ?? 0) + 1);
    expect([...counts.values()].every((n) => n === 1)).toBe(true);
    expect(d.steps.filter((s) => s.label.startsWith("Reserve revision")).length).toBe(1);
  });

  it("runs content jobs through the agent and saves drafts for approval", async () => {
    const t = setup();
    const w = await workspace(t, "v2-content@example.com");
    const { runId } = await w.client.mutation(api.content.generate, { slug: w.slug, job: "content_social", channel: "linkedin", quantity: 1, images: 0 });
    await t.finishAllScheduledFunctions(() => undefined);
    const d = await runData(t, runId);
    expect(d.run?.status).toBe("verified");
    expect(d.steps.map((s) => s.label)).toEqual(expect.arrayContaining(["Social posts: draft", "Social posts: review 1"]));
    const artifacts = await t.run(async (ctx) => ctx.db.query("artifacts").withIndex("by_run", (q) => q.eq("runId", runId)).collect());
    expect(artifacts.length).toBe(1);
    expect(artifacts[0].status).toBe("in_review");
  });

  it("demo workspaces never use the paid engine", async () => {
    const t = setup();
    const u = await asNewUser(t, "demo-v2@example.com", { anonymous: true });
    const { slug } = await u.client.mutation(api.demo.createDemoWorkspace, {});
    await t.finishAllScheduledFunctions(() => undefined);
    const orgId = await t.run(async (ctx) => (await ctx.db.query("organizations").withIndex("by_slug", (q) => q.eq("slug", slug)).unique())!._id);
    const runs = await t.run(async (ctx) => ctx.db.query("workflowRuns").withIndex("by_org_created", (q) => q.eq("orgId", orgId)).collect());
    expect(runs.every((r) => r.engine === undefined)).toBe(true);
  });
});
