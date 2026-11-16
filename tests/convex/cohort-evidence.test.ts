import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { asNewUser, makePaid, setup, type T } from "./helpers";

const now = Date.UTC(2026, 10, 16, 12);
async function workspace(t: T, paid = true) {
  const owner = await asNewUser(t, "cohort-evidence@example.com");
  const w = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Cohort evidence" });
  const orgId = w.orgId as Id<"organizations">;
  if (paid) await makePaid(t, orgId);
  return { ...owner, ...w, orgId };
}
const event = (orgId: Id<"organizations">, id: string, date: string, extra = {}) => ({
  orgId, source: "stripe", sourceEventId: id, customerRef: "customer", currency: "USD",
  amountMinor: 1000, refundedMinor: 0, kind: "subscription_payment" as const,
  occurredAt: Date.parse(`${date}T12:00:00Z`), isFixture: false, ingestedAt: now, ...extra,
});

describe("cohort evidence from recorded billing history", () => {
  beforeEach(() => vi.spyOn(Date, "now").mockReturnValue(now));
  afterEach(() => vi.restoreAllMocks());

  it("keeps the refunded first charge as entry and uses that definition in strategy context", async () => {
    const t = setup(); const w = await workspace(t);
    const runId = await t.run(async ctx => {
      await ctx.db.insert("revenueEvents", event(w.orgId, "first", "2026-07-01", { refundedMinor: 1000 }));
      await ctx.db.insert("revenueEvents", event(w.orgId, "renewal", "2026-08-01"));
      return ctx.db.insert("workflowRuns", { orgId: w.orgId, kind: "strategy", title: "Plan", status: "executing", input: "{}", roles: [], estimateMicros: 0, actualMicros: 0, rateVersionId: "verified-2026-10-17", entitlementVersionId: "ent-credits-2026-10-18", routingVersionId: "r1", budget: { modelSteps: 1, researchTools: 0, repairs: 0 }, used: { modelSteps: 0, researchTools: 0, repairs: 0 }, isFixture: false, createdAt: now, updatedAt: now });
    });
    const before = await t.run(async ctx => Promise.all([ctx.db.query("workflowRuns").collect(), ctx.db.query("approvals").collect(), ctx.db.query("actionReceipts").collect()]));
    const result = await w.client.query(api.analytics.cohorts, { slug: w.slug });
    expect(result.rows).toEqual([expect.objectContaining({ cohort: "2026-07", size: 1, activeCustomers: [1, 1, 0, 0, null, null], revenueMinor: [0, 1000, 0, 0, null, null] })]);
    const context = await t.query(internal.jobWrites.jobContext, { runId });
    expect(context?.subscriptionCohortText).toContain("2026-07: 1 first-recorded subscription payers; M1 1/1 (100.0%)");
    expect(context?.subscriptionCohortText).toContain("Import completeness is unknown");
    expect(await t.run(async ctx => Promise.all([ctx.db.query("workflowRuns").collect(), ctx.db.query("approvals").collect(), ctx.db.query("actionReceipts").collect()]))).toEqual(before);
    await t.run(ctx => ctx.db.insert("revenueEvents", event(w.orgId, "bad", "2026-06-01", { amountMinor: 1.5 })));
    const invalidContext = await t.query(internal.jobWrites.jobContext, { runId });
    expect(invalidContext?.subscriptionCohortText).toContain("invalid");
    expect(invalidContext?.subscriptionCohortText).not.toContain("100.0%");
    expect(invalidContext).toMatchObject({ customerConcentration: null, platformSourceConcentration: null, refundExposure: null, repeatPurchaseText: "", billingEvidenceIssue: expect.stringContaining("imported amounts are invalid") });
  });

  it("does not relabel a customer whose first charge predates the visible history", async () => {
    const t = setup(); const w = await workspace(t);
    await t.run(async ctx => {
      await ctx.db.insert("revenueEvents", event(w.orgId, "old", "2025-01-01"));
      await ctx.db.insert("revenueEvents", event(w.orgId, "renewal", "2026-11-01"));
    });
    expect((await w.client.query(api.analytics.cohorts, { slug: w.slug })).rows).toEqual([]);
  });

  it("excludes fixture and future records before assigning a real customer's first month", async () => {
    const t = setup(); const w = await workspace(t);
    await t.run(async ctx => {
      await ctx.db.insert("revenueEvents", event(w.orgId, "fixture", "2026-06-01", { isFixture: true }));
      await ctx.db.insert("revenueEvents", event(w.orgId, "real", "2026-07-01"));
      await ctx.db.insert("revenueEvents", event(w.orgId, "future", "2026-12-01", { customerRef: "future" }));
    });
    expect(await w.client.query(api.analytics.cohorts, { slug: w.slug })).toMatchObject({ isFixture: false, rows: [expect.objectContaining({ cohort: "2026-07", size: 1 })] });
  });

  it.each([
    ["invalid", { amountMinor: 1.5 }],
    ["customer IDs", { customerRef: undefined }],
  ])("withholds figures with %s billing evidence", async (reason, extra) => {
    const t = setup(); const w = await workspace(t);
    await t.run(async ctx => {
      await ctx.db.insert("revenueEvents", event(w.orgId, "earlier", "2026-07-01", extra));
      await ctx.db.insert("revenueEvents", event(w.orgId, "renewal", "2026-10-01"));
    });
    expect(await w.client.query(api.analytics.cohorts, { slug: w.slug })).toMatchObject({ rows: [], issue: expect.stringContaining(reason) });
  });

  it("withholds capped history instead of assigning a new first-paid month", async () => {
    const t = setup(); const w = await workspace(t);
    await t.run(async ctx => {
      for (let i = 0; i < 10001; i++) await ctx.db.insert("revenueEvents", event(w.orgId, `payment-${i}`, "2026-07-01"));
    });
    expect(await w.client.query(api.analytics.cohorts, { slug: w.slug })).toMatchObject({ rows: [], truncated: true, issue: expect.stringContaining("read limit") });
  });

  it("keeps old customers outside the free account's visible cohorts", async () => {
    const t = setup(); const w = await workspace(t, false);
    await t.run(async ctx => {
      await ctx.db.insert("revenueEvents", event(w.orgId, "old", "2026-07-01"));
      await ctx.db.insert("revenueEvents", event(w.orgId, "renewal", "2026-11-01"));
      await ctx.db.insert("revenueEvents", event(w.orgId, "new", "2026-11-01", { customerRef: "new" }));
    });
    expect((await w.client.query(api.analytics.cohorts, { slug: w.slug })).rows).toEqual([expect.objectContaining({ cohort: "2026-11", size: 1 })]);
  });

  it("does not combine real and synthetic observations in a demo cohort", async () => {
    const t = setup(); const w = await workspace(t);
    await t.run(async ctx => {
      await ctx.db.patch(w.orgId, { kind: "demo" });
      await ctx.db.insert("revenueEvents", event(w.orgId, "fixture", "2026-07-01", { isFixture: true }));
      await ctx.db.insert("revenueEvents", event(w.orgId, "real", "2026-08-01"));
    });
    expect(await w.client.query(api.analytics.cohorts, { slug: w.slug })).toMatchObject({ rows: [], issue: expect.stringContaining("Synthetic and real") });
  });
});
