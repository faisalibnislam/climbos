import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { addDays } from "../../shared/forecasting";
import { asNewUser, setup, type T } from "./helpers";

const now = Date.UTC(2026, 10, 16, 0, 30);
const yesterday = "2026-11-14"; // Still November 15 in Los Angeles.
async function workspace(t: T, email: string) {
  const user = await asNewUser(t, email);
  const w = await user.client.mutation(api.orgs.createWorkspace, { businessName: "Metric health" });
  const orgId = w.orgId as Id<"organizations">;
  await t.run(ctx => ctx.db.patch(orgId, { timezone: "America/Los_Angeles" }));
  return { ...user, ...w, orgId };
}
const activity = () => [
  ...Array.from({ length: 14 }, (_, i) => ({ date: addDays(yesterday, i - 18), value: 20 })),
  ...[4, 2, 0].map(offset => ({ date: addDays(yesterday, -offset), value: 0 })),
];

describe("Results metric-health evidence", () => {
  beforeEach(() => { vi.spyOn(Date, "now").mockReturnValue(now); });
  afterEach(() => vi.restoreAllMocks());

  it("shows missing days without false zero runs through the tenant-scoped read-only overview", async () => {
    const t = setup();
    const w = await workspace(t, "health-owner@example.com");
    const other = await workspace(t, "other-health@example.com");
    const viewer = await asNewUser(t, "health-viewer@example.com");
    await t.run(ctx => ctx.db.insert("memberships", { orgId: w.orgId, userId: viewer.userId, role: "viewer", status: "active", createdAt: now }));
    await t.mutation(internal.analytics.upsertDaily, { orgId: w.orgId, source: "ga4", kind: "observed", rows: activity().map(p => ({ ...p, metricKey: "visits" })) });
    const overview = await viewer.client.query(api.analytics.overview, { slug: w.slug });
    expect(overview.to).toBe(yesterday);
    expect(overview.healthAlerts).toEqual([expect.objectContaining({ metric: "visits", kind: "incomplete", message: expect.stringContaining("2 missing days") })]);
    expect(overview.metrics.find(m => m.key === "visits")?.points).toHaveLength(17);
    expect((await other.client.query(api.analytics.overview, { slug: other.slug })).healthAlerts).toEqual([]);
    await expect(other.client.query(api.analytics.overview, { slug: w.slug })).rejects.toThrow();
    await expect(t.query(api.analytics.overview, { slug: w.slug })).rejects.toThrow();
    for (const table of ["workflowRuns", "approvals", "actionReceipts", "forecastRuns"] as const) {
      expect(await t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
    }
  });

  it("recovers to a genuine zero-run warning when missing days are imported as explicit zero", async () => {
    const t = setup(); const w = await workspace(t, "health-recovery@example.com");
    await t.mutation(internal.analytics.upsertDaily, { orgId: w.orgId, source: "ga4", kind: "observed", rows: activity().map(p => ({ ...p, metricKey: "visits" })) });
    await t.mutation(internal.analytics.upsertDaily, { orgId: w.orgId, source: "ga4", kind: "observed", rows: [3, 1].map(offset => ({ date: addDays(yesterday, -offset), value: 0, metricKey: "visits" })) });
    const overview = await w.client.query(api.analytics.overview, { slug: w.slug });
    expect(overview.healthAlerts).toEqual([expect.objectContaining({ metric: "visits", kind: "zero_run", message: expect.stringContaining("5 days in a row") })]);
  });

  it("does not present fixture data as a live tracking alert", async () => {
    const t = setup(); const w = await workspace(t, "health-fixture@example.com");
    await t.mutation(internal.analytics.upsertDaily, { orgId: w.orgId, source: "ga4", kind: "observed", rows: activity().map(p => ({ ...p, metricKey: "visits" })) });
    await t.run(async ctx => {
      for (const row of await ctx.db.query("metricDaily").collect()) await ctx.db.patch(row._id, { isFixture: true });
    });
    expect((await w.client.query(api.analytics.overview, { slug: w.slug })).healthAlerts).toEqual([]);
  });

  it.each([
    ["duplicate", "overlapping daily observations"],
    ["source", "multiple sources"],
    ["timezone", "currency/timezone settings"],
    ["legacy", "currency/timezone settings"],
    ["negative", "counts cannot be negative"],
  ])("withholds statistical alerts for %s source data before aggregation", async (mode, reason) => {
    const t = setup(); const w = await workspace(t, `health-${mode}@example.com`);
    await t.mutation(internal.analytics.upsertDaily, { orgId: w.orgId, source: "ga4", kind: "observed", rows: activity().map(p => ({ ...p, metricKey: "visits" })) });
    await t.run(async ctx => {
      const row = (await ctx.db.query("metricDaily").first())!;
      if (mode === "duplicate") {
        const { _id: _i, _creationTime: _c, ...copy } = row;
        await ctx.db.insert("metricDaily", copy);
      } else if (mode === "source") await ctx.db.patch(row._id, { source: "different-provider" });
      else if (mode === "negative") await ctx.db.patch(row._id, { value: -1 });
      else await ctx.db.patch(row._id, { workspaceTimezone: mode === "legacy" ? undefined : "UTC" });
    });
    const overview = await w.client.query(api.analytics.overview, { slug: w.slug });
    expect(overview.healthAlerts).toEqual([expect.objectContaining({ metric: "visits", kind: "invalid", message: expect.stringContaining(reason) })]);
  });

  it("warns instead of judging a truncated read, including channel-only rows", async () => {
    const t = setup(); const w = await workspace(t, "health-limit@example.com");
    await t.run(async ctx => {
      for (let i = 0; i < 2001; i++) await ctx.db.insert("metricDaily", { orgId: w.orgId, metricKey: "visits", date: yesterday, value: 1, source: "ga4", kind: "observed", channel: `channel-${i}`, isFixture: false, ingestedAt: now, workspaceTimezone: "America/Los_Angeles", workspaceCurrency: "USD" });
    });
    const overview = await w.client.query(api.analytics.overview, { slug: w.slug });
    expect(overview.healthAlerts).toEqual([expect.objectContaining({ metric: "visits", kind: "invalid", message: expect.stringContaining("read reached its limit") })]);
  });

  it("warns on revenue currency changes but permits negative net revenue", async () => {
    const t = setup(); const w = await workspace(t, "health-currency@example.com");
    await t.run(ctx => ctx.db.patch(w.orgId, { currency: "USD" }));
    await t.mutation(internal.analytics.upsertDaily, { orgId: w.orgId, source: "billing", kind: "observed", rows: activity().map(p => ({ ...p, value: -100, metricKey: "revenue" })) });
    const initial = await w.client.query(api.analytics.overview, { slug: w.slug });
    expect(initial.healthAlerts.every(a => a.kind === "incomplete")).toBe(true);
    await t.run(ctx => ctx.db.patch(w.orgId, { currency: "EUR" }));
    const changed = await w.client.query(api.analytics.overview, { slug: w.slug });
    expect(changed.healthAlerts).toEqual([expect.objectContaining({ metric: "revenue", kind: "invalid", message: expect.stringContaining("currency/timezone settings") })]);
  });
});
