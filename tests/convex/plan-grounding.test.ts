import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { planContentHash } from "../../convex/lib/planHash";
import type { PlanEvidence } from "../../shared/agents/evidence";
import { asNewUser, setup, type T } from "./helpers";

/** P0 grounding slice: each plan version keeps what it knew, and approval binds to its content. */

async function workspace(t: T, email: string) {
  const owner = await asNewUser(t, email);
  const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Grounded Co" });
  await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", statement: "More paying customers", horizonDays: 90, monthlyAdBudget: 300 });
  return { ...owner, slug, orgId: orgId as Id<"organizations"> };
}

async function latestStrategy(t: T, orgId: Id<"organizations">) {
  return t.run(async (ctx) => (await ctx.db.query("strategies").withIndex("by_org", (q) => q.eq("orgId", orgId)).order("desc").first())!);
}

describe("Plan grounding (Books 13/14, P0)", () => {
  beforeEach(() => {
    process.env.CLIMBOS_ENGINE = "v2";
    process.env.CLIMBOS_FAKE_LLM = "ship";
  });
  afterEach(() => {
    delete process.env.CLIMBOS_ENGINE;
    delete process.env.CLIMBOS_FAKE_LLM;
  });

  it("saves an evidence record, the run's cost and a content-bound approval with each version", async () => {
    const t = setup();
    const w = await workspace(t, "grounded@example.com");
    await w.client.mutation(api.orgs.generatePlan, { slug: w.slug });
    await t.finishAllScheduledFunctions(() => undefined);
    const s = await latestStrategy(t, w.orgId);
    const { evidence, approval, run } = await t.run(async (ctx) => ({
      evidence: await ctx.db.query("planEvidence").withIndex("by_strategy", (q) => q.eq("strategyId", s._id)).first(),
      approval: s.approvalId ? await ctx.db.get(s.approvalId) : null,
      run: s.runId ? await ctx.db.get(s.runId) : null,
    }));
    expect(evidence).not.toBeNull();
    const data = JSON.parse(evidence!.data) as PlanEvidence;
    expect(data.engine).toMatch(/^v2/);
    expect(data.currency).toBe("USD");
    expect(data.goal?.monthlyAdBudget).toBe(300);
    expect(Object.keys(data.skills)).toEqual(expect.arrayContaining(["growth-plays", "growth-strategy"]));
    expect(evidence!.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(approval!.contentHash).toBe(await planContentHash(s));
    expect(s.generationCostMicros).toBeGreaterThan(0);
    expect(s.generationCostMicros).toBeLessThanOrEqual(run!.actualMicros);
    // No hours and no contacts: listed as unknown, not assumed.
    const q = (s.expert as { quality?: { unknowns?: string[] } }).quality;
    expect(q?.unknowns).toEqual(expect.arrayContaining([expect.stringMatching(/Hours/), expect.stringMatching(/email/)]));
  });

  it("conflicting confirmed facts are kept, briefed and shown on the plan (item 9)", async () => {
    const t = setup();
    const w = await workspace(t, "grounded-conflict@example.com");
    await t.run(async (ctx) => {
      const b = (await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", w.orgId)).first())!;
      for (const statement of ["Pro plan costs $19/month", "Pro is $24 per month"])
        await ctx.db.insert("businessFacts", { orgId: w.orgId, businessId: b._id, category: "pricing", statement, confidence: "high", reviewState: "confirmed", provenance: "owner_supplied", sourceIds: [], createdAt: Date.now(), updatedAt: Date.now() });
    });
    await w.client.mutation(api.orgs.generatePlan, { slug: w.slug });
    await t.finishAllScheduledFunctions(() => undefined);
    const s = await latestStrategy(t, w.orgId);
    expect((s.expert as { quality?: { conflicts?: string[] } }).quality?.conflicts).toEqual(["Pro price per month: $19 vs $24"]);
    const ev = await t.run(async (ctx) => ctx.db.query("planEvidence").withIndex("by_strategy", (q) => q.eq("strategyId", s._id)).first());
    expect((JSON.parse(ev!.data) as PlanEvidence).conflicts?.[0].factIds).toHaveLength(2);
  });

  it("the owner's funnel decides the weak link in code; playbooks are gated and saved with the plan (cycle 2)", async () => {
    const t = setup();
    const w = await workspace(t, "grounded-funnel@example.com");
    await expect(w.client.mutation(api.workspace.setFunnel, { slug: w.slug, periodDays: 30, leads: 10, activated: 50 })).rejects.toThrow(/smaller than the one before/);
    await w.client.mutation(api.workspace.setFunnel, { slug: w.slug, periodDays: 30, visitors: 2000, leads: 100, activated: 12, newCustomers: 3 });
    await w.client.mutation(api.orgs.generatePlan, { slug: w.slug });
    await t.finishAllScheduledFunctions(() => undefined);
    const s = await latestStrategy(t, w.orgId);
    const x = s.expert as { constraintDiagnosis?: { constraint: string; basis: string }; playbooks?: { eligible: { id: string }[]; ineligible: { id: string; reasons: string[] }[] }; diagnosis?: string };
    expect(x.constraintDiagnosis).toMatchObject({ basis: "measured" });
    expect(typeof x.diagnosis).toBe("string");
    expect(x.playbooks?.eligible.length).toBeGreaterThan(0);
    // No consented contacts: lifecycle email isn't eligible.
    expect(x.playbooks?.ineligible.map((p) => p.id)).toContain("PB-lifecycle-email");
  });

  it("a plan changed after review can't be approved, but can be sent back; parking a channel doesn't void it", async () => {
    const t = setup();
    const w = await workspace(t, "grounded-change@example.com");
    await w.client.mutation(api.orgs.generatePlan, { slug: w.slug });
    await t.finishAllScheduledFunctions(() => undefined);
    const s = await latestStrategy(t, w.orgId);
    const hash = await planContentHash(s);
    expect(await planContentHash({ ...s, channels: s.channels.map((c) => ({ ...c, status: "parked" as const })) })).toBe(hash);
    await t.run(async (ctx) => ctx.db.patch(s._id, { summary: `${s.summary} Spend $5,000 on ads.` }));
    await expect(w.client.mutation(api.workspace.decidePlan, { slug: w.slug, strategyId: s._id, decision: "approve" })).rejects.toThrow(/changed after it was sent for review/);
    await w.client.mutation(api.workspace.decidePlan, { slug: w.slug, strategyId: s._id, decision: "reject" });
    expect((await latestStrategy(t, w.orgId)).status).toBe("draft");
  });
});
