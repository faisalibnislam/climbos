import { describe, expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { asNewUser, setup, type T } from "./helpers";

/** Structured experiment outcomes (Book 14 §14): code labels the claim, re-analysis is appended, the next plan learns. */
async function planWithTests(t: T, email: string) {
  const owner = await asNewUser(t, email);
  const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Outcome Co" });
  await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", statement: "More customers", horizonDays: 90, monthlyAdBudget: 0 });
  const ids = await t.run(async (ctx) => {
    const o = orgId as Id<"organizations">;
    const business = (await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", o)).first())!;
    const goalId = (await ctx.db.query("goals").withIndex("by_org_status", (q) => q.eq("orgId", o).eq("status", "active")).first())!._id;
    const strategyId = await ctx.db.insert("strategies", {
      orgId: o, businessId: business._id, goalId, version: 1, status: "approved", summary: "s", audiences: [], positioning: "p", channels: [], constraints: [], measurementPlan: "m", reviewDate: "2026-11-01", sourceFactIds: [], generationCostMicros: 0, createdAt: Date.now(),
    } as never);
    const exp = (name: string, method: "holdout" | "pre_post_observational") =>
      ctx.db.insert("experiments", { orgId: o, strategyId, name, hypothesis: "h", population: "past customers", method, primaryMetric: "booked calls", guardrails: [], durationDays: 14, stoppingRule: "stop if < 2 calls in 14 days", status: "running", createdAt: Date.now() });
    return { strategyId, referral: await exp("Referral ask", "pre_post_observational"), holdout: await exp("Win-back email", "holdout"), cold: await exp("Cold email", "pre_post_observational") };
  });
  return { owner, slug, orgId: orgId as Id<"organizations">, ...ids };
}

describe("experiment outcomes", () => {
  it("saves an outcome with a computed label, and re-analysis never overwrites", async () => {
    const t = setup();
    const { owner, slug, referral } = await planWithTests(t, "outcome@example.com");
    const r1 = await owner.client.mutation(api.playResults.recordExperimentOutcome, { slug, experimentId: referral, executed: true, source: "owner_report", design: "before_after", eligible: 300, exposed: 120, conversions: 1, windowStart: "2026-09-01", windowEnd: "2026-09-14", result: "missed", stopRuleHit: true });
    expect(r1).toEqual({ n: 1, inference: "observed", newAnalysis: true });
    // Same definition: a correction to analysis 1.
    const r2 = await owner.client.mutation(api.playResults.recordExperimentOutcome, { slug, experimentId: referral, executed: true, source: "owner_report", design: "before_after", eligible: 300, exposed: 120, conversions: 2, result: "missed", stopRuleHit: true });
    expect(r2).toMatchObject({ n: 1, newAnalysis: false });
    // Changed definition after results: a new analysis; the first stays.
    const r3 = await owner.client.mutation(api.playResults.recordExperimentOutcome, { slug, experimentId: referral, executed: true, source: "owner_report", design: "before_after", exposed: 120, conversions: 14, metric: "replies", result: "met", stopRuleHit: false });
    expect(r3).toMatchObject({ n: 2, newAnalysis: true });
    const e = await t.run(async (ctx) => ctx.db.get(referral));
    expect(e!.primaryMetric).toBe("booked calls");
    expect(e!.stoppingRule).toBe("stop if < 2 calls in 14 days");
    expect(e!.hypothesis).toBe("h");
    expect(e!.status).toBe("concluded");
    expect(e!.analyses!.map((a) => [a.n, a.metric, a.result, a.redefined, a.conversions])).toEqual([
      [1, "booked calls", "missed", false, 2],
      [2, "replies", "met", true, 14],
    ]);
  });

  it("rejects bad counts, other workspaces and a comparison claim with no group", async () => {
    const t = setup();
    const { owner, slug, holdout } = await planWithTests(t, "bad@example.com");
    await expect(owner.client.mutation(api.playResults.recordExperimentOutcome, { slug, experimentId: holdout, executed: true, source: "owner_report", design: "holdout", exposed: 10, conversions: 11, controlSize: 5, result: "met", stopRuleHit: false })).rejects.toThrow(/more than exposed/);
    await expect(owner.client.mutation(api.playResults.recordExperimentOutcome, { slug, experimentId: holdout, executed: true, source: "owner_report", design: "holdout", exposed: 10, conversions: 1, result: "met", stopRuleHit: false })).rejects.toThrow(/comparison group size/);
    const other = await planWithTests(t, "other@example.com");
    await expect(other.owner.client.mutation(api.playResults.recordExperimentOutcome, { slug: other.slug, experimentId: holdout, executed: false, source: "owner_report", design: "none", result: "unclear", stopRuleHit: false })).rejects.toThrow(/couldn't find/);
  });

  it("feeds reported outcomes into later plans without upgrading reports to verified causal effects", async () => {
    const t = setup();
    const { owner, slug, orgId, referral, holdout, cold } = await planWithTests(t, "brief@example.com");
    expect(await t.query(internal.playResults.briefFor, { orgId })).toBe("");
    await owner.client.mutation(api.playResults.recordExperimentOutcome, { slug, experimentId: referral, executed: true, source: "owner_report", design: "before_after", eligible: 300, exposed: 120, conversions: 6, result: "met", stopRuleHit: false });
    await owner.client.mutation(api.playResults.recordExperimentOutcome, { slug, experimentId: holdout, executed: true, source: "integration", design: "holdout", assignment: "random", eligible: 300, exposed: 200, conversions: 20, controlSize: 100, controlConversions: 5, plannedSharePct: 200 / 3, result: "met", stopRuleHit: false });
    await owner.client.mutation(api.playResults.recordExperimentOutcome, { slug, experimentId: cold, executed: false, source: "owner_report", design: "none", result: "unclear", stopRuleHit: false, note: "No time" });
    const brief = await t.query(internal.playResults.briefFor, { orgId });
    const line = (name: string) => brief.split("\n").find((l) => l.startsWith(`- ${name}`))!;
    expect(line("Referral ask")).toContain("OBSERVED: 6 conversions from 120 exposed of 300 eligible; no validated comparison, so not proof of cause.");
    expect(line("Referral ask")).not.toMatch(/incremental/i);
    // Not significant (p ≈ 0.18), so the brief compares without claiming extra conversions.
    expect(line("Win-back email")).toContain("REPORTED RANDOMIZED COMPARISON (holdout): 20/200 exposed (10%) vs 5/100 in the comparison group (5%): No reliable difference");
    expect(line("Win-back email")).not.toMatch(/incremental conversions/);
    // An unexecuted test is kept out of the lessons.
    const [lessons, notRun] = brief.split("TESTS NOT RUN");
    expect(lessons).not.toContain("Cold email");
    expect(notRun).toContain("Cold email: NOT RUN");
  });

  it("preserves unknown assignment, rejects invalid dates, and cannot grant actions or let viewers record outcomes", async () => {
    const t = setup();
    const f = await planWithTests(t, "integrity@example.com");
    const args = { slug: f.slug, experimentId: f.holdout, executed: true, source: "integration" as const, design: "randomized" as const, exposed: 300, conversions: 15, controlSize: 300, controlConversions: 60, result: "missed" as const, stopRuleHit: false };
    const before = await t.run(ctx => ctx.db.get(f.holdout));
    await expect(f.owner.client.mutation(api.playResults.recordExperimentOutcome, { ...args, windowStart: "2026-02-30" })).rejects.toThrow(/YYYY-MM-DD/);
    expect(await t.run(ctx => ctx.db.get(f.holdout))).toEqual(before);
    const viewer = await asNewUser(t, "viewer-outcome@example.com");
    await t.run(ctx => ctx.db.insert("memberships", { orgId: f.orgId, userId: viewer.userId, role: "viewer", status: "active", createdAt: Date.now() }));
    await expect(viewer.client.mutation(api.playResults.recordExperimentOutcome, args)).rejects.toThrow();
    expect(await f.owner.client.mutation(api.playResults.recordExperimentOutcome, args)).toMatchObject({ inference: "observed" });
    const unknown = (await t.run(ctx => ctx.db.get(f.holdout)))!.analyses!.at(-1)!;
    expect(unknown.assignment).toBeUndefined();
    expect(unknown.plannedSharePct).toBeUndefined();
    let brief = await t.query(internal.playResults.briefFor, { orgId: f.orgId });
    expect(brief).toContain("RANDOMIZATION UNVERIFIED");
    expect(brief).toContain("Member-entered; reported source: connected tool");
    expect(brief).not.toContain("INCREMENTAL");
    await f.owner.client.mutation(api.playResults.recordExperimentOutcome, { ...args, assignment: "random", plannedSharePct: 50 });
    brief = await t.query(internal.playResults.briefFor, { orgId: f.orgId });
    expect(brief).toMatch(/difference of -45 conversions.*95% interval -\d+ to -\d+/);
    expect(brief).toContain("not proof of causal impact");
    // Historical labels must not move a not-run report into the lessons section.
    await t.run(async ctx => {
      const e = (await ctx.db.get(f.holdout))!;
      await ctx.db.patch(e._id, { analyses: [{ ...e.analyses!.at(-1)!, executed: false, inference: "incremental" }] });
    });
    const [lessons, notRun] = (await t.query(internal.playResults.briefFor, { orgId: f.orgId })).split("TESTS NOT RUN");
    expect(lessons).not.toContain("Win-back email");
    expect(notRun).toContain("Win-back email: NOT RUN");
    for (const table of ["approvals", "actionReceipts", "workflowRuns"] as const) expect(await t.run(ctx => ctx.db.query(table).collect())).toHaveLength(0);
  });
});
