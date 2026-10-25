import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { checkInvariants } from "../../shared/economics/ledger";
import { ledgerOf } from "../../convex/lib/periods";
import { asNewUser, setup, type T } from "./helpers";

async function workspace(t: T, email: string) {
  const owner = await asNewUser(t, email);
  const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Model Co" });
  return { ...owner, slug, orgId: orgId as Id<"organizations"> };
}

describe("business model check", () => {
  beforeEach(() => {
    process.env.CLIMBOS_ENGINE = "v2";
    process.env.CLIMBOS_FAKE_LLM = "ship";
  });
  afterEach(() => {
    delete process.env.CLIMBOS_ENGINE;
    delete process.env.CLIMBOS_FAKE_LLM;
  });

  it("runs an owner-started, metered check and returns three alternatives with a labelled verdict", async () => {
    const t = setup();
    const w = await workspace(t, "model-owner@example.com");
    const estimate = await w.client.query(api.businessModel.estimate, { slug: w.slug });
    expect(estimate.maxCostMicros).toBeGreaterThan(0);

    const { runId } = await w.client.mutation(api.businessModel.start, { slug: w.slug });
    await expect(w.client.mutation(api.businessModel.start, { slug: w.slug })).rejects.toThrow(/already running/);
    await t.finishAllScheduledFunctions(() => undefined);

    const run = await t.run(async (ctx) => ctx.db.get(runId));
    expect(run?.status).toBe("verified");
    expect(run?.engine).toBe("v2");
    const reservation = run?.reservationId ? await t.run(async (ctx) => ctx.db.get(run.reservationId!)) : null;
    const period = reservation ? await t.run(async (ctx) => ctx.db.get(reservation.periodId)) : null;
    expect(checkInvariants(ledgerOf(period!))).toEqual([]);

    const latest = await w.client.query(api.businessModel.latest, { slug: w.slug });
    expect(latest.canEdit).toBe(true);
    expect(latest.result?.check.alternatives.map((a) => a.mode).sort()).toEqual(["adjacent", "bold", "grounded"]);
    expect(latest.result?.check.verdict.status).toBe("insufficient_evidence");
    const audits = await t.run(async (ctx) => ctx.db.query("auditEvents").collect());
    expect(audits.some((a) => a.action === "business_model.check_started")).toBe(true);
  });

  it("records owner test results with validation, and keeps viewers and other workspaces out", async () => {
    const t = setup();
    const w = await workspace(t, "model-tests@example.com");
    const other = await workspace(t, "model-other@example.com");
    const viewer = await asNewUser(t, "model-viewer@example.com");
    await t.run(async (ctx) => ctx.db.insert("memberships", { orgId: w.orgId, userId: viewer.userId, role: "viewer", status: "active", createdAt: Date.now() }));
    await expect(viewer.client.mutation(api.businessModel.start, { slug: w.slug })).rejects.toThrow(/can't/i);
    const { runId } = await w.client.mutation(api.businessModel.start, { slug: w.slug });
    await t.finishAllScheduledFunctions(() => undefined);

    const base = { slug: w.slug, runId, target: "grounded" as const, outcomeEvidence: "unknown" as const, ownerDecision: "undecided" as const };
    await expect(w.client.mutation(api.businessModel.recordTest, { ...base, testState: "observed" })).rejects.toThrow(/what you observed/);
    await expect(w.client.mutation(api.businessModel.recordTest, { ...base, testState: "run", outcomeEvidence: "measured" })).rejects.toThrow(/observed result/);
    await expect(w.client.mutation(api.businessModel.recordTest, { ...base, target: "deciding", testState: "run", ownerDecision: "adopt_alternative" })).rejects.toThrow(/Choose an alternative/);
    await expect(viewer.client.mutation(api.businessModel.recordTest, { ...base, testState: "designed" })).rejects.toThrow(/can't/i);
    await expect(other.client.mutation(api.businessModel.recordTest, { ...base, slug: other.slug, testState: "designed" })).rejects.toThrow();

    await w.client.mutation(api.businessModel.recordTest, { ...base, testState: "designed" });
    await w.client.mutation(api.businessModel.recordTest, { ...base, testState: "observed", outcomeNote: "3 of 20 past customers asked to join the plan.", outcomeEvidence: "owner_reported", ownerDecision: "keep_testing" });
    const latest = await viewer.client.query(api.businessModel.latest, { slug: w.slug });
    expect(latest.canEdit).toBe(false);
    expect(latest.result?.tests.grounded).toMatchObject({ testState: "observed", outcomeEvidence: "owner_reported", ownerDecision: "keep_testing", outcomeNote: "3 of 20 past customers asked to join the plan." });
    expect((await other.client.query(api.businessModel.latest, { slug: other.slug })).result).toBeNull();

    // Later runs carry the latest check (strategy only) and the owner's test results.
    const strategyRunId = await t.run(async (ctx) => ctx.db.insert("workflowRuns", { ...(await ctx.db.get(runId))!, _id: undefined, _creationTime: undefined, kind: "strategy", status: "executing", output: undefined } as never));
    const context = await t.query(internal.jobWrites.jobContext, { runId: strategyRunId });
    expect(context?.businessModelContext).toContain("AI judgment for owner review");
    expect(context?.businessModelTestsText).toContain("grounded: observed, evidence owner reported, decision keep testing");
    expect(context?.businessModelTestNotes).toEqual(["grounded: 3 of 20 past customers asked to join the plan."]);
  });
});

describe("business model check without the agent engine", () => {
  it("falls back to the labelled demo fixture and still saves a valid result", async () => {
    delete process.env.CLIMBOS_ENGINE;
    delete process.env.CLIMBOS_FAKE_LLM;
    const t = setup();
    const w = await workspace(t, "model-v1@example.com");
    // Demo workspaces use labelled fixtures instead of a provider.
    await t.run(async (ctx) => ctx.db.patch(w.orgId, { kind: "demo" }));
    await w.client.mutation(api.businessModel.start, { slug: w.slug });
    await t.finishAllScheduledFunctions(() => undefined);
    const latest = await w.client.query(api.businessModel.latest, { slug: w.slug });
    expect(latest.result?.check.currentModel.summary).toContain("Demo data");
    expect(latest.running).toBeNull();
  });
});
