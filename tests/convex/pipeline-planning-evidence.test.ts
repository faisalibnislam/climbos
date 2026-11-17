import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { asNewUser, makePaid, setup, type T } from "./helpers";

const DAY = 86_400_000;
const now = Date.UTC(2026, 10, 16, 12);
async function workspace(t: T) {
  const owner = await asNewUser(t, "crm-payment-evidence@example.com");
  const w = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Sale evidence" });
  await t.run(ctx => ctx.db.patch(w.orgId, { timezone: "UTC", currency: "USD" }));
  await makePaid(t, w.orgId);
  return { ...owner, ...w };
}
async function run(t: T, w: Awaited<ReturnType<typeof workspace>>, kind: "strategy" | "business_model_check" = "strategy") {
  return t.run(ctx => ctx.db.insert("workflowRuns", { orgId: w.orgId, kind, title: "Evidence check", status: "executing", input: "{}", roles: [], estimateMicros: 0, actualMicros: 0, rateVersionId: "verified-2026-10-17", entitlementVersionId: "ent-credits-2026-10-18", routingVersionId: "r1", budget: { modelSteps: 1, researchTools: 0, repairs: 0 }, used: { modelSteps: 0, researchTools: 0, repairs: 0 }, isFixture: false, createdAt: now, updatedAt: now }));
}

describe("dated sales learning in actual recommendation context", () => {
  beforeEach(() => vi.spyOn(Date, "now").mockReturnValue(now));
  afterEach(() => vi.restoreAllMocks());

  it("does not date legacy losses by later edits or include another tenant's reasons", async () => {
    const t = setup(); const w = await workspace(t);
    const foreignOwner = await asNewUser(t, "foreign-pipeline@example.com");
    const foreign = await foreignOwner.client.mutation(api.orgs.createWorkspace, { businessName: "Other sales" });
    const id = await t.run(async ctx => {
      const base = { source: "manual" as const, currency: "USD", notes: [], createdAt: now - 500 * DAY, updatedAt: now - 400 * DAY };
      await ctx.db.insert("deals", { ...base, orgId: foreign.orgId, name: "Foreign", stage: "lost", lostAt: now - DAY, lostReason: "price", lostReasonNote: "Other tenant's private reason" });
      return ctx.db.insert("deals", { ...base, orgId: w.orgId, name: "Historic", stage: "lost", lostReason: "price", lostReasonNote: "Historic price note" });
    });
    const runId = await run(t, w);
    const before = await t.query(internal.jobWrites.jobContext, { runId });
    await w.client.mutation(api.crm.update, { slug: w.slug, id, lostReasonNote: "Edited old price note" });
    const after = await t.query(internal.jobWrites.jobContext, { runId });
    expect(after?.pipelineOutcomesText).toBe(before?.pipelineOutcomesText);
    expect(after?.pipelineOutcomesText).toContain("close date not recorded for 1");
    expect(after?.pipelineOutcomesText).toContain("0 won / 0 lost");
    expect(after?.pipelineLossNotes).toEqual([]);
    const model = await t.query(internal.jobWrites.jobContext, { runId: await run(t, w, "business_model_check") });
    expect(model?.businessModelSignalsText).toContain("Win rate unknown");
    expect(model?.businessModelSignalsText).not.toContain("headwind");
    for (const table of ["approvals", "actionReceipts", "webhookDeliveries"] as const) expect(await t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
  });

  it("carries the actual 2,000-record limit into both strategy and business-model decisions", async () => {
    const t = setup(); const w = await workspace(t);
    await t.run(async ctx => {
      for (let i = 0; i < 2001; i++) await ctx.db.insert("deals", { orgId: w.orgId, name: `Recorded ${i}`, stage: "lost", source: "manual", currency: "USD", notes: [], createdAt: now - 30 * DAY, updatedAt: now - i, lostAt: now - DAY, lostReason: "price" });
    });
    const context = await t.query(internal.jobWrites.jobContext, { runId: await run(t, w) });
    expect(context?.pipelineOutcomesText).toContain("win rate unknown (0 won / 2000 lost");
    expect(context?.pipelineOutcomesText).toContain("bounded read: totals and proportions are partial");
    expect(context?.pipelineOutcomesText).not.toContain("win rate 0%");
    const model = await t.query(internal.jobWrites.jobContext, { runId: await run(t, w, "business_model_check") });
    expect(model?.businessModelSignalsText).toContain("Win rate unknown");
    expect(model?.businessModelSignalsText).toContain("2,000 most recently updated deals");
    expect(model?.businessModelSignalsText).not.toContain("headwind");
    for (const table of ["approvals", "actionReceipts", "webhookDeliveries"] as const) expect(await t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
  });

  it("retains dated owner observations and loss notes without treating them as payments or causation", async () => {
    const t = setup(); const w = await workspace(t);
    await w.client.mutation(api.crm.create, { slug: w.slug, name: "Won", stage: "won" });
    const id = await w.client.mutation(api.crm.create, { slug: w.slug, name: "Lost", stage: "talking" });
    await w.client.mutation(api.crm.update, { slug: w.slug, id, stage: "lost", lostReason: "timing", lostReasonNote: "Buyer reported postponing this purchase" });
    const context = await t.query(internal.jobWrites.jobContext, { runId: await run(t, w) });
    expect(context?.pipelineOutcomesText).toContain("win rate 50% (1 won of 2 closed; small sample)");
    expect(context?.pipelineOutcomesText).toContain("not verified payments");
    expect(context?.pipelineOutcomesText).toContain("not verified acquisition attribution");
    expect(context?.pipelineOutcomesText).not.toContain("Buyer reported");
    expect(context?.pipelineLossNotes).toEqual(["Buyer reported postponing this purchase"]);
    for (const table of ["approvals", "actionReceipts", "webhookDeliveries"] as const) expect(await t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
  });
  it("carries overlapping owner reasons into strategy and model checks without inflating customers", async () => {
    const t = setup(), w = await workspace(t);
    for (let i = 0; i < 5; i++) {
      const id = await w.client.mutation(api.crm.create, { slug: w.slug, name: `Lost ${i}`, stage: "lost" });
      await w.client.mutation(api.crm.update, { slug: w.slug, id, lostReasons: i === 0 ? ["price", "no_need", "chose_competitor"] : ["timing"], expectedLossState: { reasons: [], note: null, closedAt: now, stageSequence: 1 } });
    }
    const context = await t.query(internal.jobWrites.jobContext, { runId: await run(t, w) });
    expect(context?.pipelineOutcomesText).toContain("0 won of 5 closed");
    expect(context?.pipelineOutcomesText).toContain("Reasons can overlap");
    const model = await t.query(internal.jobWrites.jobContext, { runId: await run(t, w, "business_model_check") });
    expect(model?.businessModelSignalsText).toContain("1 of 5 lost deals with recorded reasons");
  });

});
