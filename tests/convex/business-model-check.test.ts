import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { checkInvariants } from "../../shared/economics/ledger";
import { ledgerOf } from "../../convex/lib/periods";
import { asNewUser, makePaid, setup, type T } from "./helpers";

async function workspace(t: T, email: string) {
  const owner = await asNewUser(t, email);
  const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Model Co" });
  // Workflow coverage needs enough credits for Sonnet; free-wallet guards are tested separately.
  await makePaid(t, orgId);
  return { ...owner, slug, orgId: orgId as Id<"organizations"> };
}

describe("business model check", () => {
  beforeEach(() => {
    process.env.CLIMBOS_ENGINE = "v2";
    process.env.CLIMBOS_FAKE_LLM = "ship";
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.CLIMBOS_ENGINE;
    delete process.env.CLIMBOS_FAKE_LLM;
    delete process.env.CLIMBOS_AGENT_SOFT_LIMIT_MS;
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
  it("keeps the latest result for every alternative beyond 200 updates, and exports and deletes scoped history", async () => {
    const t = setup();
    const w = await workspace(t, "model-history@example.com");
    const other = await workspace(t, "model-history-other@example.com");
    const { runId } = await w.client.mutation(api.businessModel.start, { slug: w.slug });
    await t.finishAllScheduledFunctions(() => undefined);
    const baseAt = Date.now() - 10_000;
    const targets = ["deciding", "grounded", "adjacent", "bold"] as const;
    await t.run(async ctx => {
      for (const target of targets) await ctx.db.insert("businessModelTests", { orgId: w.orgId, runId, target, testState: "observed", outcomeNote: `Retain ${target} evidence`, outcomeEvidence: "owner_reported", ownerDecision: "keep_testing", createdBy: w.userId, createdAt: baseAt });
      for (let i = 0; i < 205; i++) await ctx.db.insert("businessModelTests", { orgId: w.orgId, runId, target: "adjacent", testState: "observed", outcomeNote: `Adjacent update ${i}`, outcomeEvidence: "owner_reported", ownerDecision: "drop_alternative", createdBy: w.userId, createdAt: baseAt + i + 1 });
    });
    const latest = await w.client.query(api.businessModel.latest, { slug: w.slug });
    expect(Object.keys(latest.result!.tests).sort()).toEqual([...targets].sort());
    expect(latest.result!.tests.adjacent.outcomeNote).toBe("Adjacent update 204");
    expect(latest.result!.tests.bold.outcomeNote).toBe("Retain bold evidence");
    const strategyRunId = await t.run(async ctx => ctx.db.insert("workflowRuns", { ...(await ctx.db.get(runId))!, _id: undefined, _creationTime: undefined, kind: "strategy", status: "executing", output: undefined } as never));
    const context = await t.query(internal.jobWrites.jobContext, { runId: strategyRunId });
    expect(context!.businessModelTestNotes).toEqual(expect.arrayContaining(["adjacent: Adjacent update 204", "bold: Retain bold evidence", "deciding: Retain deciding evidence", "grounded: Retain grounded evidence"]));
    expect(context!.businessModelTestNotes).toHaveLength(4);
    expect(context!.businessModelTestsText).toContain("not automatic proof");
    expect(context!.businessModelTestsText).not.toContain("outranks");
    expect((await other.client.query(api.businessModel.latest, { slug: other.slug })).result).toBeNull();
    const exported = JSON.parse(await t.query(internal.settings.exportData, { orgId: w.orgId }));
    expect(exported.businessModelTests).toHaveLength(209);
    expect(exported.businessModelTestHistoryLimited).toBe(false);
    expect(JSON.parse(await t.query(internal.settings.exportData, { orgId: other.orgId })).businessModelTests).toEqual([]);
    await t.mutation(internal.settings.purgeWorkspaceBatch, { orgId: w.orgId });
    await t.finishAllScheduledFunctions(() => undefined);
    expect(await t.run(ctx => ctx.db.query("businessModelTests").withIndex("by_org_created", q => q.eq("orgId", w.orgId)).collect())).toEqual([]);
    expect(await t.run(ctx => ctx.db.get(other.orgId))).not.toBeNull();
  });

  it("carries actual billing and pipeline read limits into the viability context without authorizing actions", async () => {
    const t = setup();
    const w = await workspace(t, "model-coverage@example.com");
    const { runId } = await w.client.mutation(api.businessModel.start, { slug: w.slug });
    await t.finishAllScheduledFunctions(() => undefined);
    const now = Date.now();
    await t.run(async ctx => {
      for (let i = 0; i < 10_001; i++) await ctx.db.insert("revenueEvents", { orgId: w.orgId, source: "csv", sourceEventId: `coverage-${i}`, occurredAt: now - 40 * 86_400_000 - i, currency: "USD", amountMinor: 100, refundedMinor: 0, kind: "order", isFixture: false, ingestedAt: now });
      for (let i = 0; i < 2_001; i++) await ctx.db.insert("deals", { orgId: w.orgId, name: `Reported loss ${i}`, stage: "lost", source: "manual", currency: "USD", notes: [], createdAt: now - 86_400_000, updatedAt: now - i, lostAt: now - 1, lostReason: "price" });
    });
    const context = await t.query(internal.jobWrites.jobContext, { runId });
    expect(context!.businessModelSignalsText).toContain("comparison is withheld");
    expect(context!.businessModelSignalsText).toContain("2,000 most recently updated deals");
    expect(context!.businessModelSignalsText).toContain("totals and proportions are partial");
    expect(context!.businessModelSignalsText).toContain("calculated from loaded records");
    expect(context!.businessModelSignalsText).not.toContain("[headwind");
    for (const table of ["approvals", "actionReceipts"] as const) expect(await t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
  });

  it("keeps changed, old and legacy judgments visible but removes them from current plan constraints", async () => {
    const t = setup();
    const w = await workspace(t, "model-freshness@example.com");
    const { runId } = await w.client.mutation(api.businessModel.start, { slug: w.slug });
    await t.finishAllScheduledFunctions(() => undefined);
    const initial = await w.client.query(api.businessModel.latest, { slug: w.slug });
    expect(initial.result!.freshness!.status).toBe("unchanged");
    const strategyRunId = await t.run(async ctx => ctx.db.insert("workflowRuns", { ...(await ctx.db.get(runId))!, _id: undefined, _creationTime: undefined, kind: "strategy", status: "executing", output: undefined } as never));
    expect((await t.query(internal.jobWrites.jobContext, { runId: strategyRunId }))!.businessModelVerdict).toBe("insufficient_evidence");
    await t.run(async ctx => {
      const b = (await ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", w.orgId)).first())!;
      await ctx.db.patch(b._id, { summary: "Owner changed the business offer after the check" });
    });
    const changed = await w.client.query(api.businessModel.latest, { slug: w.slug });
    expect(changed.result!.freshness).toMatchObject({ status: "changed", changed: ["business"] });
    expect(changed.result!.check.alternatives.map(a => a.mode).sort()).toEqual(["adjacent", "bold", "grounded"]);
    let context = await t.query(internal.jobWrites.jobContext, { runId: strategyRunId });
    expect(context!.businessModelVerdict).toBeNull();
    expect(context!.businessModelContext).toContain("HISTORICAL BUSINESS MODEL CHECK");
    expect(context!.businessModelContext).not.toContain("verdict insufficient evidence");
    const next = await w.client.mutation(api.businessModel.start, { slug: w.slug });
    await t.finishAllScheduledFunctions(() => undefined);
    expect((await w.client.query(api.businessModel.latest, { slug: w.slug })).result!.freshness!.status).toBe("unchanged");
    const captured = JSON.parse((await t.run(ctx => ctx.db.get(next.runId)))!.input).businessModelEvidence;
    vi.spyOn(Date, "now").mockReturnValue(captured.capturedAt + 31 * 86_400_000);
    expect((await w.client.query(api.businessModel.latest, { slug: w.slug })).result!.freshness!.status).toBe("review_due");
    expect((await t.query(internal.jobWrites.jobContext, { runId: strategyRunId }))!.businessModelVerdict).toBeNull();
    vi.restoreAllMocks();
    await t.run(ctx => ctx.db.patch(next.runId, { input: "{}" }));
    expect((await w.client.query(api.businessModel.latest, { slug: w.slug })).result!.freshness!.status).toBe("unknown");
    context = await t.query(internal.jobWrites.jobContext, { runId: strategyRunId });
    expect(context!.businessModelVerdict).toBeNull();
    for (const table of ["approvals", "actionReceipts"] as const) expect(await t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
  });

  it("resumes unchanged inputs through checkpoints without replacing the input identity", async () => {
    process.env.CLIMBOS_AGENT_SOFT_LIMIT_MS = "1";
    const t = setup();
    const w = await workspace(t, "model-stable-resume@example.com");
    const { runId } = await w.client.mutation(api.businessModel.start, { slug: w.slug });
    await t.finishAllScheduledFunctions(() => undefined);
    const run = (await t.run(ctx => ctx.db.get(runId)))!;
    expect(run.status).toBe("verified");
    expect(JSON.parse(run.input).businessModelEvidence.contextHash).toMatch(/^[a-f0-9]{64}$/);
    const steps = await t.run(ctx => ctx.db.query("workflowSteps").withIndex("by_run", q => q.eq("runId", runId)).collect());
    expect(steps.length).toBeGreaterThan(1);
    expect(new Set(steps.map(s => s.index)).size).toBe(steps.length);
  });

  it("rejects a changed full prompt even when the displayed evidence groups still match", async () => {
    const t = setup();
    const w = await workspace(t, "model-context-resume@example.com");
    const { runId } = await w.client.mutation(api.businessModel.start, { slug: w.slug });
    await t.finishAllScheduledFunctions(() => undefined);
    const before = (await t.run(ctx => ctx.db.get(runId)))!;
    const original = JSON.parse(before.input).businessModelEvidence;
    // Simulate a checkpoint retry after an audience change, outside the eight displayed evidence groups.
    await t.run(async ctx => {
      await ctx.db.patch(runId, { status: "executing", output: undefined });
      await ctx.db.insert("contacts", { orgId: w.orgId, emailHash: "synthetic-audience", emailDomain: "example.com", source: "crm", segments: [], createdAt: Date.now() });
    });
    const context = await t.query(internal.jobWrites.jobContext, { runId });
    expect(context!.businessModelEvidenceHashes).toEqual(original.hashes);
    const usageBefore = await t.run(ctx => ctx.db.query("usageEvents").collect());
    await t.action(internal.jobs.businessModelCheck, { runId });
    const stopped = (await t.run(ctx => ctx.db.get(runId)))!;
    expect(stopped.status).toBe("failed");
    expect(stopped.output).toBeUndefined();
    expect(JSON.parse(stopped.input).businessModelEvidence).toEqual(original);
    expect(await t.run(ctx => ctx.db.query("usageEvents").collect())).toEqual(usageBefore);
    expect(await t.run(ctx => ctx.db.query("actionReceipts").collect())).toEqual([]);
  });

  it("does not rebind legacy checkpoints or malformed snapshots to current inputs", async () => {
    const t = setup();
    const w = await workspace(t, "model-legacy-resume@example.com");
    const { runId } = await w.client.mutation(api.businessModel.start, { slug: w.slug });
    await t.finishAllScheduledFunctions(() => undefined);
    const run = (await t.run(ctx => ctx.db.get(runId)))!;
    const snapshot = JSON.parse(run.input).businessModelEvidence;
    for (const input of ["{}", JSON.stringify({ businessModelEvidence: { version: 1 } })]) {
      await t.run(ctx => ctx.db.patch(runId, { status: "executing", input }));
      await expect(t.mutation(internal.businessModel.captureEvidence, { runId, hashes: snapshot.hashes, contextHash: snapshot.contextHash })).rejects.toThrow(/earlier work/);
      expect((await t.run(ctx => ctx.db.get(runId)))!.input).toBe(input);
    }
  });

  it("freezes the first input identity and stops a resumed check before model work if inputs changed", async () => {
    const t = setup();
    const w = await workspace(t, "model-resume-evidence@example.com");
    const { runId } = await w.client.mutation(api.businessModel.start, { slug: w.slug });
    const initial = await t.query(internal.jobWrites.jobContext, { runId });
    const captured = await t.mutation(internal.businessModel.captureEvidence, { runId, hashes: initial!.businessModelEvidenceHashes!, contextHash: "a".repeat(64) });
    await t.run(async ctx => {
      const b = (await ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", w.orgId)).first())!;
      await ctx.db.patch(b._id, { summary: "A materially different offer" });
    });
    const changed = await t.query(internal.jobWrites.jobContext, { runId });
    expect(changed!.businessModelEvidenceHashes).not.toEqual(captured.hashes);
    expect(await t.mutation(internal.businessModel.captureEvidence, { runId, hashes: changed!.businessModelEvidenceHashes!, contextHash: "b".repeat(64) })).toEqual(captured);
    await t.finishAllScheduledFunctions(() => undefined);
    const run = (await t.run(ctx => ctx.db.get(runId)))!;
    expect(run.status).toBe("failed");
    expect(run.output).toBeUndefined();
    expect(JSON.parse(run.input).businessModelEvidence).toEqual(captured);
    expect(await t.run(ctx => ctx.db.query("usageEvents").collect())).toEqual([]);
    expect(await t.run(ctx => ctx.db.query("actionReceipts").collect())).toEqual([]);
  });

});

describe("business model check without the agent engine", () => {
  it("falls back to the labelled demo fixture and still saves a valid result", async () => {
    delete process.env.CLIMBOS_ENGINE;
    delete process.env.CLIMBOS_FAKE_LLM;
    delete process.env.CLIMBOS_AGENT_SOFT_LIMIT_MS;
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
