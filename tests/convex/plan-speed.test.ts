import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { asNewUser, makePaid, setup } from "./helpers";

/** Faster plans: research runs alongside channel scoring (once), and the run shows an early preview. */
describe("Plan speed", () => {
  beforeEach(() => {
    process.env.CLIMBOS_ENGINE = "v2";
    process.env.CLIMBOS_FAKE_LLM = "ship";
  });
  afterEach(() => {
    delete process.env.CLIMBOS_ENGINE;
    delete process.env.CLIMBOS_FAKE_LLM;
  });

  it("researches once, in parallel, and previews channels and plays before the plan is saved", async () => {
    const t = setup();
    const owner = await asNewUser(t, "speed-owner@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Speed Co" });
    await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", statement: "More paying customers", horizonDays: 90, monthlyAdBudget: 300 });
    await makePaid(t, orgId);
    await owner.client.mutation(api.orgs.generatePlan, { slug });
    await t.finishAllScheduledFunctions(() => undefined);
    const run = await t.run(async (ctx) => (await ctx.db.query("workflowRuns").withIndex("by_org_created", (q) => q.eq("orgId", orgId as Id<"organizations">)).collect()).find((r) => r.kind === "strategy")!);
    expect(run.status).toBe("verified");
    const steps = await t.run(async (ctx) => ctx.db.query("workflowSteps").collect());
    const research = steps.filter((s) => s.runId === run._id && /: research$/.test((s as { label?: string }).label ?? ""));
    expect(research.length).toBe(1);
    const preview = JSON.parse(run.preview ?? "{}") as { channels?: string[]; plays?: { name: string; p50: number }[] };
    expect(preview.channels?.length).toBeGreaterThan(0);
    expect(preview.plays?.length).toBeGreaterThan(0);
  });

  it("reuses channel scoring on a re-plan when nothing changed, and scores again for a new goal", async () => {
    const t = setup();
    const owner = await asNewUser(t, "replan-owner@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Replan Co" });
    await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", statement: "More paying customers", horizonDays: 90, monthlyAdBudget: 300 });
    await makePaid(t, orgId);
    const scoringSteps = async () =>
      t.run(async (ctx) => {
        const runs = (await ctx.db.query("workflowRuns").withIndex("by_org_created", (q) => q.eq("orgId", orgId as Id<"organizations">)).collect()).filter((r) => r.kind === "strategy");
        const steps = await ctx.db.query("workflowSteps").collect();
        return runs.map((r) => steps.filter((s) => s.runId === r._id && s.label.startsWith("Channel scoring")).length);
      });
    await owner.client.mutation(api.orgs.generatePlan, { slug });
    await t.finishAllScheduledFunctions(() => undefined);
    await owner.client.mutation(api.orgs.generatePlan, { slug });
    await t.finishAllScheduledFunctions(() => undefined);
    // A new goal: score again.
    await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", statement: "Double paying customers", horizonDays: 60, monthlyAdBudget: 800 });
    await owner.client.mutation(api.orgs.generatePlan, { slug });
    await t.finishAllScheduledFunctions(() => undefined);
    const [first, second, third] = await scoringSteps();
    expect(first).toBeGreaterThan(0);
    expect(second).toBe(0);
    expect(third).toBeGreaterThan(0);
  });

  it("runs the plan with the speed flags on (fast_review, lean_plan)", async () => {
    const t = setup();
    const owner = await asNewUser(t, "flags-owner@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Flags Co" });
    await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", statement: "More paying customers", horizonDays: 90, monthlyAdBudget: 300 });
    await makePaid(t, orgId);
    await t.mutation(internal.engineFlags.setEngineFlag, { orgId: orgId as Id<"organizations">, flag: "fast_review", on: true });
    await t.mutation(internal.engineFlags.setEngineFlag, { orgId: orgId as Id<"organizations">, flag: "lean_plan", on: true });
    await owner.client.mutation(api.orgs.generatePlan, { slug });
    await t.finishAllScheduledFunctions(() => undefined);
    const run = await t.run(async (ctx) => (await ctx.db.query("workflowRuns").withIndex("by_org_created", (q) => q.eq("orgId", orgId as Id<"organizations">)).collect()).find((r) => r.kind === "strategy")!);
    expect(run.status).toBe("verified");
    const plan = await t.run(async (ctx) => (await ctx.db.query("strategies").collect()).find((s) => s.orgId === orgId));
    expect(plan?.status).toBe("needs_approval");
  });

  it("merges preview pieces instead of replacing them", async () => {
    const t = setup();
    const owner = await asNewUser(t, "preview-owner@example.com");
    const { orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Preview Co" });
    const runId = await t.run(async (ctx) => {
      const any = (await ctx.db.query("workflowRuns").collect())[0];
      if (any) return any._id;
      return ctx.db.insert("workflowRuns", {
        orgId: orgId as Id<"organizations">,
        kind: "strategy",
        title: "Plan",
        status: "executing",
        input: "{}",
        roles: ["ceo"],
        estimateMicros: 0,
        actualMicros: 0,
        rateVersionId: "r",
        entitlementVersionId: "e",
        routingVersionId: "x",
        budget: { modelSteps: 1, researchTools: 0, repairs: 0 },
        used: { modelSteps: 0, researchTools: 0, repairs: 0 },
        isFixture: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as never);
    });
    await t.mutation(internal.engine.setRunPreview, { runId, preview: JSON.stringify({ channels: ["SEO pages"] }) });
    await t.mutation(internal.engine.setRunPreview, { runId, preview: JSON.stringify({ headline: "Start with SEO", points: ["a"] }) });
    const run = await t.run(async (ctx) => ctx.db.get(runId));
    expect(JSON.parse(run!.preview!)).toEqual({ channels: ["SEO pages"], headline: "Start with SEO", points: ["a"] });
  });
});
