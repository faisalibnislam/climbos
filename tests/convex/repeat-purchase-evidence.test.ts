import { expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";
const DAY = 86_400_000;
it("keeps fully refunded repeats and unmatched refunds out of strategy/model conclusions", async () => {
  const t = setup(), owner = await asNewUser(t, "repeat-evidence@example.com");
  const { orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Repeat evidence" });
  const foreignOwner = await asNewUser(t, "foreign-repeat-evidence@example.com");
  const foreign = await foreignOwner.client.mutation(api.orgs.createWorkspace, { businessName: "Foreign" });
  const now = Date.now();
  const base = { orgId, source: "stripe", currency: "USD", amountMinor: 1000, refundedMinor: 0, isFixture: false, ingestedAt: now };
  await t.run(async ctx => {
    for (let i = 0; i < 20; i++) {
      await ctx.db.insert("revenueEvents", { ...base, sourceEventId: `first-${i}`, customerRef: `private-${i}`, orderRef: `first-${i}`, kind: "order", occurredAt: now - 200 * DAY });
      await ctx.db.insert("revenueEvents", { ...base, sourceEventId: `second-${i}`, customerRef: `private-${i}`, orderRef: `second-${i}`, kind: "order", occurredAt: now - 180 * DAY });
      await ctx.db.insert("revenueEvents", { ...base, sourceEventId: `refund-${i}`, orderRef: `second-${i}`, kind: "refund", occurredAt: now - 170 * DAY });
    }
    await ctx.db.insert("revenueEvents", { ...base, orgId: foreign.orgId, sourceEventId: "foreign-unmatched", kind: "refund", occurredAt: now - DAY });
  });
  const run = (kind: "strategy" | "business_model_check") => t.run(ctx => ctx.db.insert("workflowRuns", { orgId, kind, title: "Repeat check", status: "executing", input: "{}", roles: [], estimateMicros: 0, actualMicros: 0, rateVersionId: "verified-2026-10-17", entitlementVersionId: "ent-credits-2026-10-18", routingVersionId: "r1", budget: { modelSteps: 1, researchTools: 0, repairs: 0 }, used: { modelSteps: 0, researchTools: 0, repairs: 0 }, isFixture: false, createdAt: now, updatedAt: now }));
  const strategy = await run("strategy"), model = await run("business_model_check");
  const context = await t.query(internal.jobWrites.jobContext, { runId: strategy });
  expect(context?.repeatPurchaseText).toContain("within 90 days 0/20 (0.0%)");
  expect(context?.repeatPurchaseText).toContain("later refunds can change");
  expect(context?.repeatPurchaseText).not.toContain("private-");
  expect((await t.query(internal.jobWrites.jobContext, { runId: model }))?.businessModelSignalsText).toContain("0/20 (0%)");
  await t.run(ctx => ctx.db.insert("revenueEvents", { ...base, sourceEventId: "unmatched", kind: "refund", occurredAt: now - DAY }));
  const unclear = await t.query(internal.jobWrites.jobContext, { runId: strategy });
  expect(unclear?.repeatPurchaseText).toContain("unavailable");
  expect(unclear?.repeatPurchaseText).toContain("cannot be matched");
  expect(unclear?.repeatPurchaseText).not.toContain("0/20");
  expect((await t.query(internal.jobWrites.jobContext, { runId: model }))?.businessModelSignalsText).toContain("Repeat purchases: A nonzero refund cannot be matched");
  for (const table of ["approvals", "actionReceipts", "emailLog", "webhookDeliveries"] as const) expect(await t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
});
