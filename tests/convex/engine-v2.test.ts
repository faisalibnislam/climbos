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
    // Climb AI Basic writes a second version of each strategy agent's draft and keeps the better one.
    expect(labels).toEqual(expect.arrayContaining(["Growth plan: draft B", "Growth plan: review B", "Growth plays: draft B"]));
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
    // Forecasts are computed in code from each play's model and ranges (never written by the model).
    const plays = strategy?.expert?.plays as { p10: number; p50: number; p90: number }[];
    expect(plays.length).toBe(2);
    for (const p of plays) {
      expect(p.p10).toBeLessThan(p.p50);
      expect(p.p50).toBeLessThan(p.p90);
      expect(p.p50).toBeGreaterThan(5); // 100 a week × 13 weeks × ~10% × ~10%
    }
    // Pages the research read are saved, and so is what the plan was built from.
    expect(strategy?.expert?.webSources?.[0]?.url).toBe("https://example.com");
    expect(strategy?.expert?.snapshot?.engine).toMatch(/^v2/);
    // Every input keeps its source; the "assumed" list is derived from the tags.
    const econ = strategy?.expert?.economics as { sources: Record<string, { source: string }>; assumed: string[] };
    expect(econ.sources.revenue.source).toBe("research");
    expect(econ.assumed).toEqual(["margin", "churn"]);
    expect((strategy?.expert?.plays as { model: { reachSource: { source: string } } }[])[0].model.reachSource.source).toBe("assumption");
  });

  it("revises when the review fails, reserving each extra round first, and keeps the better version", async () => {
    process.env.CLIMBOS_FAKE_LLM = "revise";
    const t = setup();
    const w = await workspace(t, "v2-revise@example.com");
    // Headroom so every agent's revision round fits (a trial wallet covers the plan, not every worst case).
    await t.run(async (ctx) => {
      for (const p of await ctx.db.query("usagePeriods").collect()) if (p.orgId === w.orgId) await ctx.db.patch(p._id, { walletCapMicros: 20_000_000 });
    });
    await w.client.mutation(api.orgs.generatePlan, { slug: w.slug });
    await t.finishAllScheduledFunctions(() => undefined);
    const run = await latestRun(t, w.orgId, "strategy");
    const d = await runData(t, run._id);
    expect(d.run?.status).toBe("verified");
    const labels = d.steps.map((s) => s.label);
    expect(labels).toEqual(expect.arrayContaining(["Growth plan: draft", "Growth plan: review 1", "Growth plan: reserve revision 1", "Growth plan: revision 1", "Growth plan: review 2"]));
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
    // Plays agent + plan agent each reserved their one revision round, once.
    expect(d.steps.filter((s) => /reserve revision/i.test(s.label)).length).toBe(2);
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
