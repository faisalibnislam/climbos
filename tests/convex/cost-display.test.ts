import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { asNewUser, makePaid, setup, type T } from "./helpers";

/** Admin-controlled cost display: credits for everyone by default, real API cost in dollars for users an operator enabled. */

async function workspace(t: T, email: string) {
  const owner = await asNewUser(t, email);
  const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Cost Co" });
  await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", statement: "More paying customers", horizonDays: 90, monthlyAdBudget: 300 });
  await makePaid(t, orgId, 500_000_000);
  return { ...owner, slug, orgId: orgId as Id<"organizations"> };
}

async function planRun(t: T, w: Awaited<ReturnType<typeof workspace>>) {
  await w.client.mutation(api.orgs.generatePlan, { slug: w.slug });
  await t.finishAllScheduledFunctions(() => undefined);
  return t.run(async (ctx) => (await ctx.db.query("workflowRuns").withIndex("by_org_created", (q) => q.eq("orgId", w.orgId)).order("desc").collect()).find((r) => r.kind === "strategy")!);
}

async function eventsOf(t: T, runId: Id<"workflowRuns">) {
  return t.run(async (ctx) => ctx.db.query("usageEvents").withIndex("by_run", (q) => q.eq("runId", runId)).collect());
}

const MONEY_KEYS = ["providerMicros", "totalProviderMicros"];
/** Every key anywhere in a payload, to prove money fields never reach a user who wasn't enabled. */
function keysOf(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => keysOf(v, out));
  else if (value && typeof value === "object")
    for (const [k, v] of Object.entries(value)) {
      out.add(k);
      keysOf(v, out);
    }
  return out;
}

describe("API cost display", () => {
  beforeEach(() => {
    process.env.CLIMBOS_ENGINE = "v2";
    process.env.CLIMBOS_FAKE_LLM = "ship";
  });
  afterEach(() => {
    delete process.env.CLIMBOS_ENGINE;
    delete process.env.CLIMBOS_FAKE_LLM;
  });

  it("shows credits by default and never sends a non-enabled user cost-in-money fields", async () => {
    const t = setup();
    const w = await workspace(t, "credits-only@example.com");
    const run = await planRun(t, w);
    expect(run.actualMicros).toBeGreaterThan(0);
    expect(await w.client.query(api.costDisplay.myCostDisplay, {})).toEqual({ mode: "credits" });
    const payloads = [
      await w.client.query(api.workspace.runs, { slug: w.slug }),
      await w.client.query(api.workspace.runDetail, { slug: w.slug, runId: run._id }),
      await w.client.query(api.content.runStatus, { slug: w.slug, runId: run._id }),
      await w.client.action(api.settings.usage, { slug: w.slug }),
    ];
    for (const p of payloads) for (const k of MONEY_KEYS) expect(keysOf(p).has(k)).toBe(false);
  });

  it("only operators can enable it; changes are audited and apply per user", async () => {
    const t = setup();
    const ops = await asNewUser(t, "ops@example.com");
    const w = await workspace(t, "sees-cost@example.com");
    const teammate = await asNewUser(t, "teammate@example.com");
    await t.run(async (ctx) => ctx.db.insert("memberships", { orgId: w.orgId, userId: teammate.userId as Id<"users">, role: "editor", status: "active", createdAt: Date.now() }));

    await expect(w.client.mutation(api.admin.setUserCostDisplay, { email: "sees-cost@example.com", enabled: true })).rejects.toThrow();
    await expect(w.client.query(api.admin.costDisplayGrants, {})).rejects.toThrow();
    await ops.client.mutation(api.admin.setUserCostDisplay, { email: "Sees-Cost@example.com ", enabled: true });
    expect((await ops.client.query(api.admin.costDisplayGrants, {})).grants.map((g) => g.email)).toEqual(["sees-cost@example.com"]);
    expect(await w.client.query(api.costDisplay.myCostDisplay, {})).toEqual({ mode: "usd" });
    // Same workspace, not enabled: still credits, still no money fields.
    expect(await teammate.client.query(api.costDisplay.myCostDisplay, {})).toEqual({ mode: "credits" });

    const run = await planRun(t, w);
    expect((await w.client.query(api.workspace.runDetail, { slug: w.slug, runId: run._id })).providerMicros).toBe(run.providerMicros);
    expect(keysOf(await teammate.client.query(api.workspace.runDetail, { slug: w.slug, runId: run._id })).has("providerMicros")).toBe(false);
    expect(keysOf(await teammate.client.action(api.settings.usage, { slug: w.slug })).has("totalProviderMicros")).toBe(false);

    await ops.client.mutation(api.admin.setUserCostDisplay, { email: "sees-cost@example.com", enabled: false });
    expect(await w.client.query(api.costDisplay.myCostDisplay, {})).toEqual({ mode: "credits" });
    expect(keysOf(await w.client.query(api.workspace.runs, { slug: w.slug })).has("providerMicros")).toBe(false);
    const audit = await t.run(async (ctx) => ctx.db.query("auditEvents").collect());
    expect(audit.filter((a) => a.action.startsWith("admin.api_cost_")).map((a) => [a.action, a.actorId])).toEqual([
      ["admin.api_cost_enabled", ops.userId],
      ["admin.api_cost_disabled", ops.userId],
    ]);
  });

  it("a run's displayed API cost equals the sum of its usage events, and billing is unchanged", async () => {
    const t = setup();
    const ops = await asNewUser(t, "ops@example.com");
    const w = await workspace(t, "reconcile@example.com");
    await ops.client.mutation(api.admin.setUserCostDisplay, { email: "reconcile@example.com", enabled: true });
    const run = await planRun(t, w);

    // Add an image (flat credit allowance above Google's bill) and built-in page reads (no provider bill).
    const step = await t.run(async (ctx) => (await ctx.db.query("workflowSteps").withIndex("by_run", (q) => q.eq("runId", run._id)).first())!);
    const zero = { inputTokens: 0, outputTokens: 0, reasoningTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, quantity: 1, estimated: true };
    await t.mutation(internal.engine.recordUsage, {
      stepId: step._id,
      records: [
        { ...zero, type: "image_attempt", provider: "google", model: "gemini-3.1-flash-lite-image", costMicros: 45_000, providerMicros: 33_650 },
        { ...zero, type: "scrape_credit", provider: "builtin", quantity: 3, costMicros: 15_000, providerMicros: 0 },
      ],
    });

    const after = await t.run(async (ctx) => (await ctx.db.get(run._id))!);
    const events = await eventsOf(t, run._id);
    const billed = events.reduce((s, e) => s + (e.providerMicros ?? e.costMicros), 0);
    const charged = events.reduce((s, e) => s + e.costMicros, 0);
    expect(after.providerMicros).toBe(billed);
    expect(after.actualMicros).toBe(charged);
    expect(after.actualMicros - after.providerMicros!).toBe(45_000 - 33_650 + 15_000);

    const detail = await w.client.query(api.workspace.runDetail, { slug: w.slug, runId: run._id });
    const status = await w.client.query(api.content.runStatus, { slug: w.slug, runId: run._id });
    const listed = (await w.client.query(api.workspace.runs, { slug: w.slug })).find((r) => r.id === run._id)!;
    expect([detail.providerMicros, status.providerMicros, listed.providerMicros]).toEqual([billed, billed, billed]);
    expect(detail.actualMicros).toBe(charged);

    const usage = await w.client.action(api.settings.usage, { slug: w.slug });
    const all = await t.run(async (ctx) => ctx.db.query("usageEvents").withIndex("by_org_created", (q) => q.eq("orgId", w.orgId)).collect());
    expect(usage.totalProviderMicros).toBe(all.reduce((s, e) => s + (e.providerMicros ?? e.costMicros), 0));
    expect(usage.totalCostMicros).toBe(all.reduce((s, e) => s + e.costMicros, 0));
    expect(usage.byModel.reduce((s, m) => s + (m.providerMicros ?? 0), 0)).toBe(usage.totalProviderMicros);
  });

  it("treats runs from before provider cost was tracked as billed at what they were charged", async () => {
    const t = setup();
    const w = await workspace(t, "legacy@example.com");
    const run = await planRun(t, w);
    await t.run(async (ctx) => ctx.db.patch(run._id, { providerMicros: undefined }));
    const step = await t.run(async (ctx) => (await ctx.db.query("workflowSteps").withIndex("by_run", (q) => q.eq("runId", run._id)).first())!);
    await t.mutation(internal.engine.recordUsage, {
      stepId: step._id,
      records: [{ type: "scrape_credit", provider: "builtin", inputTokens: 0, outputTokens: 0, reasoningTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, quantity: 1, costMicros: 5_000, providerMicros: 0, estimated: true }],
    });
    const after = await t.run(async (ctx) => (await ctx.db.get(run._id))!);
    expect(after.providerMicros).toBe(run.actualMicros);
    expect(after.actualMicros).toBe(run.actualMicros + 5_000);
  });
});
