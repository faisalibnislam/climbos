import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { estimateJobMicros, planJob } from "../../convex/lib/jobPlans";
import { BUILT_IN_ROUTE, userRoute } from "../../shared/ai/modelChoice";
import { asNewUser, makePaid, setup, type T } from "./helpers";

/** Admin-controlled model choice: operator defaults per tier, per-user permission, routed estimates and usage. */

async function workspace(t: T, email: string) {
  const owner = await asNewUser(t, email);
  const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Model Co" });
  await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", statement: "More paying customers", horizonDays: 90, monthlyAdBudget: 300 });
  // Room for the most expensive models' worst-case reservations.
  await makePaid(t, orgId, 5_000_000_000);
  return { ...owner, slug, orgId: orgId as Id<"organizations"> };
}

async function lastRun(t: T, orgId: Id<"organizations">, kind: string) {
  return t.run(async (ctx) => (await ctx.db.query("workflowRuns").withIndex("by_org_created", (q) => q.eq("orgId", orgId)).order("desc").collect()).find((r) => r.kind === kind)!);
}

async function usageOf(t: T, runId: Id<"workflowRuns">) {
  return t.run(async (ctx) => (await ctx.db.query("usageEvents").collect()).filter((e) => e.runId === runId && e.type === "model_call"));
}

describe("AI model choice", () => {
  beforeEach(() => {
    process.env.CLIMBOS_ENGINE = "v2";
    process.env.CLIMBOS_FAKE_LLM = "ship";
  });
  afterEach(() => {
    delete process.env.CLIMBOS_ENGINE;
    delete process.env.CLIMBOS_FAKE_LLM;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GEMINI_API_KEY;
  });

  it("runs on the built-in OpenAI route when no default is set, and model choice is off for everyone", async () => {
    const t = setup();
    const w = await workspace(t, "default-route@example.com");
    expect(await w.client.query(api.models.myModelChoice, { kind: "strategy" })).toEqual({ canChoose: false, options: [], defaultModel: null });
    await w.client.mutation(api.orgs.generatePlan, { slug: w.slug });
    await t.finishAllScheduledFunctions(() => undefined);
    const run = await lastRun(t, w.orgId, "strategy");
    expect(run.modelRoute).toEqual(BUILT_IN_ROUTE);
    const usage = await usageOf(t, run._id);
    expect(usage.length).toBeGreaterThan(0);
    expect(usage.every((e) => e.provider === "openai" && e.model === "gpt-6-luna" && e.modelSource === "default")).toBe(true);
  });

  it("applies the operator default, audits it, and falls back to OpenAI when that provider's key is removed", async () => {
    const t = setup();
    const ops = await asNewUser(t, "ops@example.com");
    const w = await workspace(t, "admin-default@example.com");
    // A provider without a key is listed as unavailable and can't become a default.
    const before = await ops.client.query(api.admin.modelSettings, {});
    expect(before.options.find((o) => o.key === "claude-sonnet-5.5")?.available).toBe(false);
    expect(before.providers.find((p) => p.provider === "anthropic")).toMatchObject({ envVar: "ANTHROPIC_API_KEY", configured: false });
    await expect(ops.client.mutation(api.admin.setDefaultModel, { tier: "standard", model: "claude-sonnet-5.5" })).rejects.toThrow(/ANTHROPIC_API_KEY/);

    process.env.ANTHROPIC_API_KEY = "test-placeholder";
    await ops.client.mutation(api.admin.setDefaultModel, { tier: "standard", model: "claude-sonnet-5.5" });
    const audit = await t.run(async (ctx) => ctx.db.query("auditEvents").collect());
    expect(audit.find((a) => a.action === "admin.model_default")?.summary).toContain("gpt-6-luna to claude-sonnet-5.5");

    await w.client.mutation(api.orgs.generatePlan, { slug: w.slug });
    await t.finishAllScheduledFunctions(() => undefined);
    const run = await lastRun(t, w.orgId, "strategy");
    expect(run.modelRoute).toEqual({ standard: "claude-sonnet-5.5", advanced: "gpt-6.1-sol", source: "default" });
    // Reserved at Sonnet's rates, not Luna's.
    const route = { standard: "claude-sonnet-5.5" as const, advanced: "gpt-6.1-sol" as const, source: "default" as const };
    expect(run.estimateMicros).toBe(estimateJobMicros(planJob("strategy", {}, { mode: run.aiMode ?? "basic" }), { route }));
    expect(run.estimateMicros).toBeGreaterThan(estimateJobMicros(planJob("strategy", {}, { mode: run.aiMode ?? "basic" })));
    const usage = await usageOf(t, run._id);
    expect(usage.length).toBeGreaterThan(0);
    expect(usage.every((e) => e.provider === "anthropic" && e.model === "claude-sonnet-5-5" && e.modelSource === "default")).toBe(true);

    // Key removed later: new runs fall back to the built-in model instead of failing.
    delete process.env.ANTHROPIC_API_KEY;
    expect((await ops.client.query(api.admin.modelSettings, {})).tiers.find((x) => x.tier === "standard")).toMatchObject({ saved: "claude-sonnet-5.5", effective: "gpt-6-luna" });
    await t.run(async (ctx) => {
      for (const r of await ctx.db.query("workflowRuns").collect()) await ctx.db.patch(r._id, { status: "verified" });
    });
    await w.client.mutation(api.orgs.generatePlan, { slug: w.slug });
    expect((await lastRun(t, w.orgId, "strategy")).modelRoute).toEqual(BUILT_IN_ROUTE);
  });

  it("refuses a model argument from a user an operator hasn't enabled", async () => {
    const t = setup();
    process.env.ANTHROPIC_API_KEY = "test-placeholder";
    const w = await workspace(t, "no-permission@example.com");
    await expect(w.client.mutation(api.orgs.generatePlan, { slug: w.slug, model: "claude-opus-5.5" })).rejects.toThrow(/isn't enabled/);
    await expect(w.client.mutation(api.orgs.startResearch, { slug: w.slug, website: "https://example.com", model: "claude-opus-5.5" })).rejects.toThrow(/isn't enabled/);
    await expect(w.client.mutation(api.content.generate, { slug: w.slug, job: "content_social", model: "claude-opus-5.5" })).rejects.toThrow(/isn't enabled/);
    expect(await t.run(async (ctx) => ctx.db.query("workflowRuns").collect())).toHaveLength(0);
    // Only staff can change who may choose, or the defaults.
    await expect(w.client.mutation(api.admin.setUserModelChoice, { email: "no-permission@example.com", enabled: true })).rejects.toThrow();
    await expect(w.client.mutation(api.admin.setDefaultModel, { tier: "standard", model: "claude-opus-5.5" })).rejects.toThrow();
  });

  it("lets an enabled user pick any connected model, cheapest first, and records it on every usage record", async () => {
    const t = setup();
    process.env.ANTHROPIC_API_KEY = "test-placeholder";
    const ops = await asNewUser(t, "ops@example.com");
    const w = await workspace(t, "chooser@example.com");
    await ops.client.mutation(api.admin.setUserModelChoice, { email: "chooser@example.com", enabled: true });
    const audit = await t.run(async (ctx) => ctx.db.query("auditEvents").collect());
    expect(audit.find((a) => a.action === "admin.model_choice_enabled")?.summary).toContain("chooser@example.com");
    expect((await ops.client.query(api.admin.modelSettings, {})).grants.map((g) => g.email)).toEqual(["chooser@example.com"]);

    const choice = await w.client.query(api.models.myModelChoice, { kind: "strategy", aiMode: "expert" });
    expect(choice.canChoose).toBe(true);
    // Only connected providers (Anthropic here; no OpenAI or Gemini key in tests), cheapest to most expensive.
    expect(choice.options.every((o) => o.provider === "anthropic")).toBe(true);
    expect(choice.options.map((o) => o.key)).toEqual(["claude-haiku-5.5", "claude-sonnet-5", "claude-sonnet-5.5", "claude-opus-5.5", "claude-opus-5", "claude-fable-5", "claude-fable-5.1"]);
    const estimates = choice.options.map((o) => o.estimateMicros ?? 0);
    expect([...estimates].sort((a, b) => a - b)).toEqual(estimates);

    // Gemini isn't connected: refused even for a permitted user.
    await expect(w.client.mutation(api.orgs.generatePlan, { slug: w.slug, model: "gemini-3.1-pro" })).rejects.toThrow(/isn't connected/);

    await w.client.mutation(api.orgs.generatePlan, { slug: w.slug, model: "claude-opus-5.5" });
    await t.finishAllScheduledFunctions(() => undefined);
    const run = await lastRun(t, w.orgId, "strategy");
    expect(run.modelRoute).toEqual(userRoute("claude-opus-5.5"));
    expect(run.estimateMicros).toBe(estimateJobMicros(planJob("strategy", {}, { mode: run.aiMode ?? "basic" }), { route: userRoute("claude-opus-5.5") }));
    const usage = await usageOf(t, run._id);
    expect(usage.length).toBeGreaterThan(0);
    expect(usage.every((e) => e.provider === "anthropic" && e.model === "claude-opus-5-5" && e.modelSource === "user")).toBe(true);

    // Turning it off again hides the selector and refuses the argument.
    await ops.client.mutation(api.admin.setUserModelChoice, { email: "chooser@example.com", enabled: false });
    expect((await w.client.query(api.models.myModelChoice, {})).canChoose).toBe(false);
    await t.run(async (ctx) => {
      for (const r of await ctx.db.query("workflowRuns").collect()) await ctx.db.patch(r._id, { status: "verified" });
    });
    await expect(w.client.mutation(api.orgs.generatePlan, { slug: w.slug, model: "claude-opus-5.5" })).rejects.toThrow(/isn't enabled/);
  });

  it("lets an enabled user start onboarding research on a chosen Gemini model", async () => {
    const t = setup();
    process.env.GEMINI_API_KEY = "test-placeholder";
    const ops = await asNewUser(t, "ops@example.com");
    const w = await workspace(t, "research-chooser@example.com");
    await ops.client.mutation(api.admin.setUserModelChoice, { email: "research-chooser@example.com", enabled: true });
    await w.client.mutation(api.orgs.startResearch, { slug: w.slug, website: "https://example.com", model: "gemini-3.8-flash" });
    await t.finishAllScheduledFunctions(() => undefined);
    const run = await lastRun(t, w.orgId, "onboarding_research");
    expect(run.modelRoute).toEqual(userRoute("gemini-3.8-flash"));
    const usage = await usageOf(t, run._id);
    expect(usage.length).toBeGreaterThan(0);
    expect(usage.every((e) => e.provider === "google" && e.model === "gemini-3.8-flash")).toBe(true);
  });
});
