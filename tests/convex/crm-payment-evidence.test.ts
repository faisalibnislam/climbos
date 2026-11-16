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
const payment = (source = "stripe", key = "payment", offset = 1) => ({ source, sourceEventId: key, occurredAt: now - offset * DAY, customerRef: "buyer@example.com", currency: "USD", amountMinor: 1000, refundedMinor: 0, kind: "order" as const });
async function sale(t: T, w: Awaited<ReturnType<typeof workspace>>) {
  const id = await w.client.mutation(api.crm.create, { slug: w.slug, name: "Buyer", email: "buyer@example.com", stage: "won", value: 10 });
  await t.run(async ctx => {
    await ctx.db.patch(id, { wonAt: now - DAY });
    const row = await ctx.db.query("revenueEvents").withIndex("by_org_source_event", q => q.eq("orgId", w.orgId).eq("source", "crm").eq("sourceEventId", id)).first();
    await ctx.db.patch(row!._id, { occurredAt: now - DAY });
  });
  return id;
}
async function run(t: T, w: Awaited<ReturnType<typeof workspace>>, kind: "strategy" | "business_model_check" = "strategy") {
  return t.run(ctx => ctx.db.insert("workflowRuns", { orgId: w.orgId, kind, title: "Evidence check", status: "executing", input: "{}", roles: [], estimateMicros: 0, actualMicros: 0, rateVersionId: "verified-2026-10-17", entitlementVersionId: "ent-credits-2026-10-18", routingVersionId: "r1", budget: { modelSteps: 1, researchTools: 0, repairs: 0 }, used: { modelSteps: 0, researchTools: 0, repairs: 0 }, isFixture: false, createdAt: now, updatedAt: now }));
}

describe("owner-recorded sales stay separate from payment evidence", () => {
  beforeEach(() => vi.spyOn(Date, "now").mockReturnValue(now));
  afterEach(() => vi.restoreAllMocks());

  it("keeps a won deal visible without manufacturing payments, customers or cohorts", async () => {
    const t = setup(); const w = await workspace(t); await sale(t, w);
    const overview = await w.client.query(api.analytics.overview, { slug: w.slug, days: 7 });
    expect(overview.metrics.find(m => m.key === "paid_conversions")).toMatchObject({ total: null, recordedDays: 0 });
    expect(overview.attribution.lastTouch).toBeNull();
    expect(overview.attribution.note).toContain("Owner-recorded sales");
    expect(await w.client.query(api.analytics.cohorts, { slug: w.slug })).toMatchObject({ rows: [], hasCustomerIds: false });
    expect((await w.client.query(api.crm.list, { slug: w.slug })).totals.wonValue).toBe(1000);
    for (const table of ["workflowRuns", "approvals", "actionReceipts", "webhookDeliveries"] as const) expect(await t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
  });

  it("does not double count a sale when its payment is imported, including materialized revenue", async () => {
    const t = setup(); const w = await workspace(t); await sale(t, w);
    await t.mutation(internal.analytics.ingestRevenue, { orgId: w.orgId, events: [payment()] });
    const result = await w.client.query(api.analytics.overview, { slug: w.slug, days: 7 });
    expect(result.metrics.find(m => m.key === "revenue")?.total).toBe(1000);
    expect(result.metrics.find(m => m.key === "paid_conversions")?.total).toBe(1);
    expect(result.attribution.lastTouch?.byCurrency[0].totalNetBillingMinor).toBe(1000);
    expect((await w.client.query(api.analytics.cohorts, { slug: w.slug })).rows[0].size).toBe(1);
  });

  it("excludes historical CRM amounts with unconfirmed units from payment calculations", async () => {
    const t = setup(); const w = await workspace(t); const id = await sale(t, w);
    await t.run(async ctx => {
      await ctx.db.patch(id, { currency: "JPY", valueMinor: 100000, valueVersion: undefined });
      const row = await ctx.db.query("revenueEvents").withIndex("by_org_source_event", q => q.eq("orgId", w.orgId).eq("source", "crm").eq("sourceEventId", id)).first();
      await ctx.db.patch(row!._id, { currency: "JPY", amountMinor: 100000 });
    });
    expect((await w.client.query(api.analytics.overview, { slug: w.slug, days: 7 })).attribution.lastTouch).toBeNull();
    expect((await w.client.query(api.crm.list, { slug: w.slug })).deals[0]).toMatchObject({ value: null, valueNeedsReview: true });
  });

  it("withholds legacy billing aggregates until their payment-only basis is refreshed", async () => {
    const t = setup(); const w = await workspace(t);
    await t.mutation(internal.analytics.upsertDaily, { orgId: w.orgId, source: "billing", kind: "observed", rows: Array.from({ length: 14 }, (_, i) => ({ metricKey: "revenue", date: new Date(now - (i + 1) * DAY).toISOString().slice(0, 10), value: 2000 })) });
    const result = await w.client.query(api.analytics.overview, { slug: w.slug, days: 7 });
    expect(result.metrics.find(m => m.key === "revenue")).toMatchObject({ total: null, partialReason: expect.stringContaining("owner-recorded sales") });
    const snapshot = JSON.parse(await t.query(internal.workspace.resultsSnapshot, { runId: await run(t, w) }));
    expect(snapshot.totals.revenue).toBeUndefined();
    expect(snapshot.unknowns.revenue).toContain("owner-recorded sales");
    await expect(w.client.mutation(api.analytics.createForecast, { slug: w.slug, metricKey: "revenue", horizonDays: 7 })).rejects.toThrow(/owner-recorded sales/);
  });

  it("refreshes the old aggregate on a repeated import without duplicating payments", async () => {
    const t = setup(); const w = await workspace(t); await sale(t, w);
    await t.mutation(internal.analytics.ingestRevenue, { orgId: w.orgId, events: [payment()] });
    await t.mutation(internal.analytics.upsertDaily, { orgId: w.orgId, source: "billing", kind: "observed", rows: [{ metricKey: "revenue", date: "2026-11-15", value: 2000 }] });
    expect(await t.mutation(internal.analytics.ingestRevenue, { orgId: w.orgId, events: [payment()] })).toBe(0);
    expect((await w.client.query(api.analytics.overview, { slug: w.slug, days: 7 })).metrics.find(m => m.key === "revenue")?.total).toBe(1000);
    expect(await t.run(ctx => ctx.db.query("revenueEvents").collect())).toHaveLength(2);
  });

  it("does not build a payer forecast from owner sales alone", async () => {
    const t = setup(); const w = await workspace(t);
    await t.run(async ctx => { for (let i = 1; i <= 14; i++) await ctx.db.insert("revenueEvents", { ...payment("crm", `deal-${i}`, i), customerRef: `buyer-${i}`, orgId: w.orgId, isFixture: false, ingestedAt: now }); });
    await expect(w.client.mutation(api.analytics.createForecast, { slug: w.slug, metricKey: "paid_conversions", horizonDays: 7 })).rejects.toThrow();
    expect(await t.run(ctx => ctx.db.query("forecastRuns").collect())).toEqual([]);
    const outsider = await asNewUser(t, "outside-payments@example.com");
    await expect(outsider.client.query(api.analytics.overview, { slug: w.slug, days: 7 })).rejects.toThrow();
  });

  it("keeps sale-based repeat purchases and revenue trends out of strategy and model-check evidence", async () => {
    const t = setup(); const w = await workspace(t); await sale(t, w);
    await t.run(async ctx => {
      for (const offset of [200, 150, 100, 50, 1]) await ctx.db.insert("revenueEvents", { ...payment("crm", `sale-${offset}`, offset), orgId: w.orgId, isFixture: false, ingestedAt: now });
    });
    const context = await t.query(internal.jobWrites.jobContext, { runId: await run(t, w) });
    expect(context?.billingEvidenceIssue).toContain("Owner-recorded sales stay in the customer pipeline");
    expect(context?.pipelineOutcomesText).toContain("OWNER PIPELINE OUTCOMES");
    expect(context?.repeatPurchaseText).not.toContain("100.0%");
    const model = await t.query(internal.jobWrites.jobContext, { runId: await run(t, w, "business_model_check") });
    expect(model?.businessModelSignalsText).not.toContain("Revenue, last 90 days");
    expect(await t.run(ctx => ctx.db.query("actionReceipts").collect())).toEqual([]);
  });

  it.each([{ amountMinor: 1.5 }, { refundedMinor: 1001 }])("does not stamp an invalid payment aggregate as refreshed: %j", async invalid => {
    const t = setup(); const w = await workspace(t);
    await expect(t.mutation(internal.analytics.ingestRevenue, { orgId: w.orgId, events: [{ ...payment(), ...invalid }] })).rejects.toThrow(/amounts need correction/);
    expect(await t.run(ctx => ctx.db.query("metricDaily").collect())).toEqual([]);
    expect(await t.run(ctx => ctx.db.query("revenueEvents").collect())).toEqual([]);
  });

  it("rejects an unsafe aggregate rather than recording a rounded payment total", async () => {
    const t = setup(); const w = await workspace(t);
    await expect(t.mutation(internal.analytics.ingestRevenue, { orgId: w.orgId, events: [{ ...payment(), amountMinor: Number.MAX_SAFE_INTEGER }, payment("stripe", "second")] })).rejects.toThrow(/numeric range/);
    expect(await t.run(ctx => ctx.db.query("metricDaily").collect())).toEqual([]);
    expect(await t.run(ctx => ctx.db.query("revenueEvents").collect())).toEqual([]);
  });

  it("does not save a truncated billing-day total when the rebuild limit is reached", async () => {
    const t = setup(); const w = await workspace(t);
    await t.run(async ctx => { for (let i = 0; i < 10000; i++) await ctx.db.insert("revenueEvents", { ...payment("crm", `sale-${i}`), orgId: w.orgId, isFixture: false, ingestedAt: now }); });
    await expect(t.mutation(internal.analytics.ingestRevenue, { orgId: w.orgId, events: [payment()] })).rejects.toThrow(/10,000-record/);
    expect(await t.run(ctx => ctx.db.query("metricDaily").collect())).toEqual([]);
    expect(await t.run(ctx => ctx.db.query("revenueEvents").withIndex("by_org_source_event", q => q.eq("orgId", w.orgId).eq("source", "stripe").eq("sourceEventId", "payment")).collect())).toEqual([]);
  });
});
