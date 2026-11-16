import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { asNewUser, makePaid, setup, type T } from "./helpers";
const DAY = 86_400_000;
const now = Date.UTC(2026, 10, 16, 12);
async function workspace(t: T) {
  const owner = await asNewUser(t, "payer-evidence@example.com");
  const w = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Payer evidence" });
  const orgId = w.orgId as Id<"organizations">;
  await t.run(ctx => ctx.db.patch(orgId, { timezone: "UTC" }));
  await makePaid(t, orgId);
  return { ...owner, ...w, orgId };
}
const event = (orgId: Id<"organizations">, id: string, offset: number, extra: Record<string, unknown> = {}) => ({ orgId, source: "stripe", sourceEventId: id, customerRef: "customer", currency: "USD", amountMinor: 1000, refundedMinor: 0, kind: "order" as const, occurredAt: now + offset * DAY, isFixture: false, ingestedAt: now, ...extra });
async function metric(w: Awaited<ReturnType<typeof workspace>>) {
  return (await w.client.query(api.analytics.overview, { slug: w.slug, days: 7 })).metrics.find(m => m.key === "paid_conversions")!;
}

describe("first recorded payer evidence", () => {
  beforeEach(() => vi.spyOn(Date, "now").mockReturnValue(now));
  afterEach(() => vi.restoreAllMocks());
  it("does not turn a refunded first charge into a newly acquired customer on renewal", async () => {
    const t = setup(); const w = await workspace(t);
    await t.run(async ctx => {
      await ctx.db.insert("revenueEvents", event(w.orgId, "first", -100, { refundedMinor: 1000 }));
      await ctx.db.insert("revenueEvents", event(w.orgId, "renewal", -1, { kind: "subscription_payment" }));
    });
    expect(await metric(w)).toMatchObject({ total: 0 });
  });
  it("excludes synthetic payments and synthetic earlier history from a real workspace", async () => {
    const t = setup(); const w = await workspace(t);
    await t.run(async ctx => {
      await ctx.db.insert("revenueEvents", event(w.orgId, "fixture-earlier", -100, { isFixture: true }));
      await ctx.db.insert("revenueEvents", event(w.orgId, "real", -1));
      await ctx.db.insert("revenueEvents", event(w.orgId, "fixture-new", -1, { customerRef: "other", isFixture: true }));
    });
    expect(await metric(w)).toMatchObject({ total: 1, isFixture: false });
  });
  it("does not manufacture observed payer days from zero charges or refund-only records", async () => {
    const t = setup(); const w = await workspace(t);
    await t.run(async ctx => {
      await ctx.db.insert("revenueEvents", event(w.orgId, "free", -2, { amountMinor: 0 }));
      await ctx.db.insert("revenueEvents", event(w.orgId, "refund", -1, { kind: "refund" }));
    });
    expect(await metric(w)).toMatchObject({ total: null, hasData: false, recordedDays: 0, points: [] });
  });
  it("can establish an existing payer without loading a thousand subsequent renewals", async () => {
    const t = setup(); const w = await workspace(t);
    await t.run(async ctx => {
      for (let i = 0; i < 1200; i++) await ctx.db.insert("revenueEvents", event(w.orgId, `old-${i}`, -1500 + i));
      await ctx.db.insert("revenueEvents", event(w.orgId, "recent", -1));
    });
    expect(await metric(w)).toMatchObject({ total: 0, hasData: true });
  });
  it("withholds a first-payer claim when earlier imported money is malformed", async () => {
    const t = setup(); const w = await workspace(t);
    await t.run(async ctx => {
      await ctx.db.insert("revenueEvents", event(w.orgId, "bad-earlier", -100, { amountMinor: 1.5 }));
      await ctx.db.insert("revenueEvents", event(w.orgId, "recent", -1));
    });
    expect(await metric(w)).toMatchObject({ total: null, points: [] });
    expect((await metric(w)).partialReason).toContain("invalid");
  });

  it("keeps a malformed-only period visible as an evidence issue rather than no connection", async () => {
    const t = setup(); const w = await workspace(t);
    await t.run(ctx => ctx.db.insert("revenueEvents", event(w.orgId, "malformed", -1, { amountMinor: 1.5 })));
    expect(await metric(w)).toMatchObject({ total: null, hasData: true, sourceName: "Billing", partialReason: expect.stringContaining("invalid") });
  });

  it("returns unknown when the shared historical scan budget is exhausted", async () => {
    const t = setup(); const w = await workspace(t);
    await t.run(async ctx => {
      for (let i = 0; i < 2001; i++) await ctx.db.insert("revenueEvents", event(w.orgId, `free-${i}`, -100, { amountMinor: 0, occurredAt: now - 100 * DAY + i }));
      await ctx.db.insert("revenueEvents", event(w.orgId, "paid", -1));
    });
    expect(await metric(w)).toMatchObject({ total: null, points: [], partialReason: expect.stringContaining("shared 2,000-record customer-history scan limit") });
  });

  it("returns unknown when the reporting-period read is truncated", async () => {
    const t = setup(); const w = await workspace(t);
    await t.run(async ctx => {
      for (let i = 0; i < 2001; i++) await ctx.db.insert("revenueEvents", event(w.orgId, `paid-${i}`, -1));
    });
    expect(await metric(w)).toMatchObject({ total: null, points: [], partialReason: expect.stringContaining("billing-period read") });
  });

  it("does not select a convenient value from conflicting first-payment identities", async () => {
    const t = setup(); const w = await workspace(t);
    await t.run(async ctx => {
      await ctx.db.insert("revenueEvents", event(w.orgId, "same", -1));
      await ctx.db.insert("revenueEvents", event(w.orgId, "same", -1, { amountMinor: 2000 }));
    });
    expect(await metric(w)).toMatchObject({ total: null, partialReason: expect.stringContaining("conflicting") });
  });

  it("keeps the first charge in its local day and excludes today's incomplete observations", async () => {
    const t = setup(); const w = await workspace(t);
    await t.run(async ctx => {
      await ctx.db.patch(w.orgId, { timezone: "Asia/Dhaka" });
      await ctx.db.insert("revenueEvents", event(w.orgId, "local-start", -1, { occurredAt: Date.UTC(2026, 10, 8, 18) }));
      await ctx.db.insert("revenueEvents", event(w.orgId, "today", -1, { occurredAt: Date.UTC(2026, 10, 15, 18), customerRef: "today-customer" }));
    });
    expect(await metric(w)).toMatchObject({ total: 1, points: [{ date: "2026-11-09", value: 1 }] });
  });

  it("forecasts the corrected charge definition and withholds comparisons with the old definition", async () => {
    const t = setup(); const w = await workspace(t);
    await t.run(async ctx => {
      for (let i = 1; i <= 9; i++) await ctx.db.insert("revenueEvents", event(w.orgId, `refunded-${i}`, -i, { customerRef: `customer-${i}`, refundedMinor: 1000 }));
    });
    const id = await w.client.mutation(api.analytics.createForecast, { slug: w.slug, metricKey: "paid_conversions", horizonDays: 7 });
    const original = await w.client.query(api.analytics.getForecast, { slug: w.slug, forecastId: id });
    expect(original.history.map(p => p.value)).toEqual(Array(9).fill(1));
    expect(original.metric.definition).toContain("before refunds");
    await t.run(async ctx => {
      const row = (await ctx.db.get(id))!; const saved = JSON.parse(row.result);
      expect(saved.evidence.sources).toEqual(["billing-first-recorded-v3"]);
      saved.evidence.sources = ["billing-first-recorded-v2"];
      await ctx.db.patch(id, { result: JSON.stringify(saved) });
      await ctx.db.insert("revenueEvents", event(w.orgId, "future-actual", 1, { customerRef: "actual-customer" }));
    });
    vi.spyOn(Date, "now").mockReturnValue(now + 3 * DAY);
    const legacy = await w.client.query(api.analytics.getForecast, { slug: w.slug, forecastId: id });
    expect(legacy.forwardScore.actualTotal).toBeNull();
    expect(legacy.forwardScore.unavailableReason).toContain("source changed");
    expect(legacy.history).toEqual(original.history);
  });
});
