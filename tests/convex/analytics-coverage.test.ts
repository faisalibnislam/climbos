import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { encodeToolOutput, toolByName } from "../../convex/lib/climbTools";
import { addDays } from "../../shared/forecasting";
import { asNewUser, makePaid, setup, type T } from "./helpers";

const today = "2026-11-16";
const now = Date.UTC(2026, 10, 16, 12);
async function workspace(t: T) {
  const owner = await asNewUser(t, "coverage-owner@example.com");
  const w = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Coverage Co" });
  const orgId = w.orgId as Id<"organizations">;
  await t.run(ctx => ctx.db.patch(orgId, { timezone: "UTC", currency: "USD" }));
  await makePaid(t, orgId);
  return { ...owner, ...w, orgId };
}
async function daily(t: T, orgId: Id<"organizations">, offsets: number[], value: number, source = "ga4", metricKey = "visits") {
  await t.mutation(internal.analytics.upsertDaily, { orgId, source, kind: "observed", rows: offsets.map(offset => ({ metricKey, date: addDays(today, -offset), value })) });
}
const week = [1, 2, 3, 4, 5, 6, 7];
const previous = week.map(n => n + 7);

describe("comparable Results periods", () => {
  beforeEach(() => { vi.spyOn(Date, "now").mockReturnValue(now); });
  afterEach(() => vi.restoreAllMocks());

  it("compares full matching periods and keeps explicit zero observations", async () => {
    const t = setup(); const w = await workspace(t);
    await daily(t, w.orgId, previous, 10);
    await daily(t, w.orgId, week, 20);
    await daily(t, w.orgId, [1], 0);
    const data = await w.client.query(api.analytics.overview, { slug: w.slug, days: 7 });
    expect(data.metrics.find(m => m.key === "visits")).toMatchObject({ total: 120, previousTotal: 70, partial: false, comparisonReason: null, recordedDays: 7, expectedDays: 7 });
  });

  it.each(["current", "previous"])("withholds change when the %s period has missing days", async period => {
    const t = setup(); const w = await workspace(t);
    await daily(t, w.orgId, period === "current" ? [1] : week, 20);
    await daily(t, w.orgId, period === "previous" ? [8] : previous, 10);
    const data = await w.client.query(api.analytics.overview, { slug: w.slug, days: 7 });
    const metric = data.metrics.find(m => m.key === "visits")!;
    expect(metric.previousTotal).toBeNull();
    expect(metric.comparisonReason).toMatch(/incomplete/i);
    expect(metric.total).toBe(period === "current" ? 20 : 140);
    if (period === "current") expect(metric).toMatchObject({ partial: true, recordedDays: 1, expectedDays: 7, partialReason: expect.stringContaining("1 of 7") });
    const encoded = JSON.parse(encodeToolOutput(data, 20_000, toolByName("get_results")?.output));
    expect(encoded.metrics.find((m: { key: string }) => m.key === "visits").comparisonReason).toBe(metric.comparisonReason);
  });

  it("does not compare different source populations even when both periods have every day", async () => {
    const t = setup(); const w = await workspace(t);
    await daily(t, w.orgId, week, 20);
    await daily(t, w.orgId, previous, 10, "different-analytics");
    const metric = (await w.client.query(api.analytics.overview, { slug: w.slug, days: 7 })).metrics.find(m => m.key === "visits")!;
    expect(metric.total).toBe(140);
    expect(metric.previousTotal).toBeNull();
    expect(metric.comparisonReason).toMatch(/sources/i);
  });

  it("keeps overlapping totals unknown in Results, Home and the assistant tool", async () => {
    const t = setup(); const w = await workspace(t);
    await daily(t, w.orgId, week, 20);
    await daily(t, w.orgId, week, 10, "other-import");
    const data = await w.client.query(api.analytics.overview, { slug: w.slug, days: 7 });
    const metric = data.metrics.find(m => m.key === "visits")!;
    expect(metric).toMatchObject({ hasData: true, total: null, previousTotal: null, partial: true, points: [] });
    expect(metric.partialReason).toMatch(/overlapping/);
    const home = await w.client.query(api.analytics.homeSnapshot, { slug: w.slug });
    expect(home.metrics.find(m => m.key === "visits")).toMatchObject({ total: null, partialReason: expect.stringContaining("overlapping") });
    const encoded = JSON.parse(encodeToolOutput(data, 20_000, toolByName("get_results")?.output));
    expect(encoded.metrics.find((m: { key: string }) => m.key === "visits").total).toBeNull();
  });

  it("retains a partial Home subtotal but never turns no observations into zero", async () => {
    const t = setup(); const w = await workspace(t);
    await daily(t, w.orgId, [1], 20);
    const home = await w.client.query(api.analytics.homeSnapshot, { slug: w.slug });
    expect(home.metrics.find(m => m.key === "visits")).toMatchObject({ total: 20, recordedDays: 1, expectedDays: 30, partial: true });
    expect(home.metrics.find(m => m.key === "signups")).toMatchObject({ hasData: false, total: null });
  });

  it.each(["currency", "timezone", "legacy", "mixed-fixture"])("withholds totals with %s conflicts rather than relabeling or combining them", async mode => {
    const t = setup(); const w = await workspace(t);
    await daily(t, w.orgId, week, -1000, "billing", "revenue");
    await t.run(async ctx => {
      if (mode === "currency") await ctx.db.patch(w.orgId, { currency: "EUR" });
      else if (mode === "timezone") await ctx.db.patch(w.orgId, { timezone: "Asia/Dhaka" });
      else {
        const row = (await ctx.db.query("metricDaily").first())!;
        await ctx.db.patch(row._id, mode === "legacy" ? { workspaceCurrency: undefined } : { isFixture: true });
      }
    });
    const metric = (await w.client.query(api.analytics.overview, { slug: w.slug, days: 7 })).metrics.find(m => m.key === "revenue")!;
    expect(metric).toMatchObject({ total: null, previousTotal: null, points: [], partial: true });
    expect(metric.partialReason).toMatch(/Total unavailable/);
  });

  it("compares negative net revenue without treating it as zero", async () => {
    const t = setup(); const w = await workspace(t);
    await t.mutation(internal.analytics.ingestRevenue, { orgId: w.orgId, events: [...week, ...previous].map(offset => ({ source: "stripe", sourceEventId: `refund-${offset}`, occurredAt: now - offset * 86_400_000, currency: "USD", amountMinor: offset <= 7 ? 1000 : 2000, refundedMinor: 0, kind: "refund" as const })) });
    const metric = (await w.client.query(api.analytics.overview, { slug: w.slug, days: 7 })).metrics.find(m => m.key === "revenue")!;
    expect(metric).toMatchObject({ total: -7000, previousTotal: -14000, partial: false, comparisonReason: null });
  });

  it("does not compare fabricated zero days in billing history", async () => {
    const t = setup(); const w = await workspace(t);
    await t.mutation(internal.analytics.ingestRevenue, { orgId: w.orgId, events: [{ source: "csv", sourceEventId: "payer", occurredAt: now - 86_400_000, customerRef: "customer", currency: "USD", amountMinor: 1000, refundedMinor: 0, kind: "order" }] });
    const metric = (await w.client.query(api.analytics.overview, { slug: w.slug, days: 7 })).metrics.find(m => m.key === "paid_conversions")!;
    expect(metric).toMatchObject({ total: 1, previousTotal: null, partial: true, recordedDays: 1, expectedDays: 7 });
    expect(metric.points).toEqual([{ date: addDays(today, -1), value: 1 }]);
    expect(metric.comparisonReason).toMatch(/billing.*unknown/i);
  });

  it("rejects fractional or non-finite reporting windows rather than drifting date boundaries", async () => {
    const t = setup(); const w = await workspace(t);
    for (const days of [7.5, Number.NaN, Number.POSITIVE_INFINITY]) await expect(w.client.query(api.analytics.overview, { slug: w.slug, days })).rejects.toThrow();
  });

  it("does not turn previous-period billing observations into current-period zero customers", async () => {
    const t = setup(); const w = await workspace(t);
    await t.mutation(internal.analytics.ingestRevenue, { orgId: w.orgId, events: [{ source: "csv", sourceEventId: "old-payer", occurredAt: now - 10 * 86_400_000, customerRef: "customer", currency: "USD", amountMinor: 1000, refundedMinor: 0, kind: "order" }] });
    const metric = (await w.client.query(api.analytics.overview, { slug: w.slug, days: 7 })).metrics.find(m => m.key === "paid_conversions")!;
    expect(metric).toMatchObject({ hasData: false, total: null, previousTotal: null, points: [], recordedDays: 0 });
    for (const table of ["workflowRuns", "approvals", "actionReceipts", "forecastRuns"] as const) expect(await t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
  });
});
