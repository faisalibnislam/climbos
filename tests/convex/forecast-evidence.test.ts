import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { addDays } from "../../shared/forecasting";
import { asNewUser, setup, type T } from "./helpers";

const now = Date.UTC(2026, 10, 16, 12);
const today = "2026-11-16";
async function workspace(t: T, email = "forecast@example.com") {
  const user = await asNewUser(t, email);
  const w = await user.client.mutation(api.orgs.createWorkspace, { businessName: "Forecast evidence" });
  const orgId = w.orgId as Id<"organizations">;
  await t.run(ctx => ctx.db.patch(orgId, { timezone: "UTC", currency: "USD" }));
  return { ...user, ...w, orgId };
}
async function daily(t: T, orgId: Id<"organizations">, points: { date: string; value: number }[], metricKey = "visits", source = "ga4") {
  await t.mutation(internal.analytics.upsertDaily, { orgId, source, kind: "observed", rows: points.map(p => ({ ...p, metricKey })) });
}
const history = (n = 28) => Array.from({ length: n }, (_, i) => ({ date: addDays(today, i - n), value: 10 }));

describe("forecast evidence contract", () => {
  beforeEach(() => { vi.spyOn(Date, "now").mockReturnValue(now); });
  afterEach(() => vi.restoreAllMocks());

  it.each([undefined, "unknown_method"])("does not present %s historical coverage as chronologically verified", async marker => {
    const t = setup(); const w = await workspace(t);
    await daily(t, w.orgId, history(180));
    const id = await w.client.mutation(api.analytics.createForecast, { slug: w.slug, metricKey: "visits", horizonDays: 30 });
    const fresh = await w.client.query(api.analytics.getForecast, { slug: w.slug, forecastId: id });
    expect(fresh.calibration).toMatchObject({ heldOutMethod: "origin_after_calibration_v1", heldOutCount: 645, heldOutCoverage80: 1, heldOutCoverage95: 1 });
    const stored = (await t.run(ctx => ctx.db.get(id)))!;
    const legacy = JSON.parse(stored.result);
    legacy.calibration.heldOutMethod = marker;
    legacy.assumptions.push("Held-out coverage (targets from a historical cutoff): 80% interval 100%.");
    const historical = JSON.stringify(legacy);
    await t.run(ctx => ctx.db.patch(id, { result: historical }));
    const viewed = await w.client.query(api.analytics.getForecast, { slug: w.slug, forecastId: id });
    expect(viewed.points).toEqual(fresh.points);
    expect(viewed.history).toEqual(fresh.history);
    expect(viewed.calibration).toMatchObject({ heldOutCoverage80: null, heldOutCoverage95: null, heldOutCount: 0 });
    expect(viewed.warnings.join(" ")).toMatch(/historical.*coverage.*cutoff/i);
    expect(viewed.assumptions.some(line => line.startsWith("Held-out coverage"))).toBe(false);
    expect((await t.run(ctx => ctx.db.get(id)))!.result).toBe(historical);
    for (const table of ["workflowRuns", "approvals", "actionReceipts"] as const) expect(await t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
  });

  it("uses contiguous observed history, preserves explicit zero and freezes the original training values", async () => {
    const t = setup(); const w = await workspace(t);
    const input = history().filter(p => p.date !== addDays(today, -15)).map(p => p.date === addDays(today, -2) ? { ...p, value: 0 } : p);
    await daily(t, w.orgId, input);
    const id = await w.client.mutation(api.analytics.createForecast, { slug: w.slug, metricKey: "visits", horizonDays: 7 });
    const before = await w.client.query(api.analytics.getForecast, { slug: w.slug, forecastId: id });
    expect(before.history).toHaveLength(14);
    expect(before.history.at(-2)?.value).toBe(0);
    expect(before.warnings.join(" ")).toContain("missing day(s) remain unknown");
    expect(before.points[0].date).toBe(today);
    await daily(t, w.orgId, [{ date: addDays(today, -1), value: 999 }]);
    expect((await w.client.query(api.analytics.getForecast, { slug: w.slug, forecastId: id })).history).toEqual(before.history);
    for (const table of ["workflowRuns", "approvals", "actionReceipts"] as const) expect(await t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
  });

  it("does not fill recent missing days or start a forecast in the past", async () => {
    const t = setup(); const w = await workspace(t);
    const args = { slug: w.slug, metricKey: "visits" as const, horizonDays: 7 };
    await daily(t, w.orgId, history().filter(p => p.date !== addDays(today, -1)));
    await expect(w.client.mutation(api.analytics.createForecast, args)).rejects.toThrow(/data through/);
    await daily(t, w.orgId, [{ date: addDays(today, -1), value: 0 }]);
    await t.run(async ctx => { const p = await ctx.db.query("metricDaily").withIndex("by_org_metric_date", q => q.eq("orgId", w.orgId).eq("metricKey", "visits").eq("date", addDays(today, -3))).first(); await ctx.db.delete(p!._id); });
    await expect(w.client.mutation(api.analytics.createForecast, args)).rejects.toThrow(/Only 2 consecutive/);
    await expect(w.client.mutation(api.analytics.createForecast, { ...args, horizonDays: 9 })).rejects.toThrow(/7-, 30- or 90/);
    expect(await t.run(ctx => ctx.db.query("forecastRuns").collect())).toEqual([]);
  });

  it("keeps scoring the actual forecast window after 120 days and missing observations remain partial", async () => {
    const t = setup(); const w = await workspace(t);
    await daily(t, w.orgId, history());
    const id = await w.client.mutation(api.analytics.createForecast, { slug: w.slug, metricKey: "visits", horizonDays: 7 });
    vi.spyOn(Date, "now").mockReturnValue(now + 200 * 86_400_000);
    await daily(t, w.orgId, Array.from({ length: 6 }, (_, i) => ({ date: addDays(today, i), value: 12 })));
    let f = await w.client.query(api.analytics.getForecast, { slug: w.slug, forecastId: id });
    expect(f.forwardScore).toMatchObject({ state: "partial", scoredDays: 6, actualTotal: 72, forecastTotal: 60 });
    await daily(t, w.orgId, [{ date: addDays(today, 6), value: 0 }]);
    f = await w.client.query(api.analytics.getForecast, { slug: w.slug, forecastId: id });
    expect(f.forwardScore).toMatchObject({ state: "complete", scoredDays: 7, actualTotal: 72, forecastTotal: 70 });
    expect(f.history).toEqual(history());
  });

  it("preserves negative net revenue, original currency and timezone; incompatible outcomes cannot be scored", async () => {
    const t = setup(); const w = await workspace(t);
    await t.mutation(internal.analytics.ingestRevenue, { orgId: w.orgId, events: history().map(p => ({ source: "stripe", sourceEventId: p.date, occurredAt: Date.parse(`${p.date}T12:00:00Z`), currency: "USD", amountMinor: 100, refundedMinor: 0, kind: "refund" as const })) });
    const id = await w.client.mutation(api.analytics.createForecast, { slug: w.slug, metricKey: "revenue", horizonDays: 7 });
    let f = await w.client.query(api.analytics.getForecast, { slug: w.slug, forecastId: id });
    expect(f.points.every(p => p.value === -100)).toBe(true);
    await t.run(ctx => ctx.db.patch(w.orgId, { currency: "EUR", timezone: "Asia/Dhaka" }));
    f = await w.client.query(api.analytics.getForecast, { slug: w.slug, forecastId: id });
    expect(f).toMatchObject({ currency: "USD", timezone: "UTC" });
    expect(f.forwardScore.unavailableReason).toMatch(/currency or timezone changed/);
    expect(f.forwardScore.actualTotal).toBeNull();
  });

  it.each(["duplicate", "sources", "legacy"])("rejects %s daily observations instead of treating them as comparable", async mode => {
    const t = setup(); const w = await workspace(t);
    await daily(t, w.orgId, history());
    await t.run(async ctx => {
      const row = (await ctx.db.query("metricDaily").withIndex("by_org_metric_date", q => q.eq("orgId", w.orgId).eq("metricKey", "visits")).first())!;
      if (mode === "legacy") {
        for (const r of await ctx.db.query("metricDaily").collect()) await ctx.db.patch(r._id, { workspaceTimezone: undefined, workspaceCurrency: undefined });
      } else {
        const { _id: _i, _creationTime: _c, ...copy } = row;
        await ctx.db.insert("metricDaily", { ...copy, source: mode === "sources" ? "other-analytics" : copy.source });
      }
    });
    await expect(w.client.mutation(api.analytics.createForecast, { slug: w.slug, metricKey: "visits", horizonDays: 7 })).rejects.toThrow(/reconcile|Duplicate|unknown workspace/);
  });

  it("rejects negative count observations while net revenue may remain negative", async () => {
    const t = setup(); const w = await workspace(t);
    await daily(t, w.orgId, history().map(p => ({ ...p, value: -1 })));
    await expect(w.client.mutation(api.analytics.createForecast, { slug: w.slug, metricKey: "visits", horizonDays: 7 })).rejects.toThrow(/counts cannot be negative/);
    expect(await t.run(ctx => ctx.db.query("forecastRuns").collect())).toEqual([]);
  });

  it("does not forecast a silently truncated daily-data read", async () => {
    const t = setup(); const w = await workspace(t);
    await daily(t, w.orgId, history());
    await t.run(async ctx => {
      for (let i = 0; i < 2001; i++) await ctx.db.insert("metricDaily", { orgId: w.orgId, metricKey: "visits", date: addDays(today, -28), value: 1, kind: "observed", channel: `channel-${i}`, source: "ga4", isFixture: false, ingestedAt: now, workspaceTimezone: "UTC", workspaceCurrency: "USD" });
    });
    await expect(w.client.mutation(api.analytics.createForecast, { slug: w.slug, metricKey: "visits", horizonDays: 7 })).rejects.toThrow(/read reached its limit/);
    expect(await t.run(ctx => ctx.db.query("forecastRuns").collect())).toEqual([]);
  });

  it("uses refreshed comparable history without relabeling unknown legacy rows", async () => {
    const t = setup(); const w = await workspace(t);
    await daily(t, w.orgId, history());
    await t.run(async ctx => {
      for (const r of await ctx.db.query("metricDaily").collect()) if (r.date < addDays(today, -14)) await ctx.db.patch(r._id, { workspaceTimezone: undefined });
    });
    const id = await w.client.mutation(api.analytics.createForecast, { slug: w.slug, metricKey: "visits", horizonDays: 7 });
    const f = await w.client.query(api.analytics.getForecast, { slug: w.slug, forecastId: id });
    expect(f.history).toHaveLength(14);
    expect(f.warnings.join(" ")).toContain("unknown aggregation settings");
    vi.spyOn(Date, "now").mockReturnValue(now + 8 * 86_400_000);
    await daily(t, w.orgId, [{ date: today, value: 100 }], "visits", "replacement-source");
    expect((await w.client.query(api.analytics.getForecast, { slug: w.slug, forecastId: id })).forwardScore.unavailableReason).toMatch(/source changed/);
  });

  it("uses identified first payments, not the obsolete paid-conversion counter or renewals", async () => {
    const t = setup(); const w = await workspace(t);
    const events = history(9).flatMap((p, i) => [0,1].map(j => ({ source: "csv", sourceEventId: `${i}-${j}`, customerRef: i === 8 ? "customer-0" : `customer-${i}`, occurredAt: Date.parse(`${p.date}T12:00:00Z`) + j, currency: "USD", amountMinor: 100, refundedMinor: 0, kind: "subscription_payment" as const })));
    await t.mutation(internal.analytics.ingestRevenue, { orgId: w.orgId, events });
    await daily(t, w.orgId, history(9).map(p => ({ ...p, value: 999 })), "paid_conversions", "legacy");
    const id = await w.client.mutation(api.analytics.createForecast, { slug: w.slug, metricKey: "paid_conversions", horizonDays: 7 });
    const f = await w.client.query(api.analytics.getForecast, { slug: w.slug, forecastId: id });
    expect(f.history.map(p => p.value)).toEqual([1,1,1,1,1,1,1,1,0]);
    expect(f.metric.label).toBe("First recorded paying customers");
  });

  it("preserves legacy projections without inventing currency or input history, and enforces tenant and edit permissions", async () => {
    const t = setup(); const w = await workspace(t); const other = await workspace(t, "other-forecast@example.com");
    const viewer = await asNewUser(t, "forecast-viewer@example.com");
    await t.run(ctx => ctx.db.insert("memberships", { orgId: w.orgId, userId: viewer.userId, role: "viewer", status: "active", createdAt: now }));
    await daily(t, w.orgId, history());
    await expect(viewer.client.mutation(api.analytics.createForecast, { slug: w.slug, metricKey: "visits", horizonDays: 7 })).rejects.toThrow();
    const id = await w.client.mutation(api.analytics.createForecast, { slug: w.slug, metricKey: "visits", horizonDays: 7 });
    await expect(other.client.query(api.analytics.getForecast, { slug: other.slug, forecastId: id })).rejects.toThrow();
    await t.run(async ctx => { const run = (await ctx.db.get(id))!; const { evidence: _e, ...saved } = JSON.parse(run.result); await ctx.db.patch(id, { result: JSON.stringify(saved) }); });
    const f = await viewer.client.query(api.analytics.getForecast, { slug: w.slug, forecastId: id });
    expect(f.points).toHaveLength(7);
    expect(f).toMatchObject({ currency: null, timezone: null, history: [] });
    expect(f.forwardScore.unavailableReason).toContain("older forecast");
  });
});
