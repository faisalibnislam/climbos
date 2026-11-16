import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { encodeToolOutput, toolByName } from "../../convex/lib/climbTools";
import { asNewUser, makePaid, setup, type T } from "./helpers";

const DAY = 86_400_000;
const now = Date.UTC(2026, 10, 16, 12);
async function workspace(t: T, email = "attribution-owner@example.com") {
  const owner = await asNewUser(t, email);
  const w = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Attribution evidence" });
  const orgId = w.orgId as Id<"organizations">;
  await t.run(ctx => ctx.db.patch(orgId, { timezone: "UTC", currency: "USD" }));
  await makePaid(t, orgId);
  return { ...owner, ...w, orgId };
}
async function payment(t: T, orgId: Id<"organizations">, key: string, occurredAt = now - DAY, extra: Record<string, unknown> = {}) {
  return t.run(ctx => ctx.db.insert("revenueEvents", { orgId, source: "stripe", sourceEventId: key, customerRef: "customer", currency: "USD", amountMinor: 1000, refundedMinor: 0, kind: "order", occurredAt, ingestedAt: now, isFixture: false, ...extra }));
}
async function touch(t: T, orgId: Id<"organizations">, channel: string, occurredAt: number, isFixture = false) {
  return t.run(ctx => ctx.db.insert("touches", { orgId, source: "stripe", customerRef: "customer", channel, occurredAt, isFixture }));
}
async function claim(t: T, orgId: Id<"organizations">, extra: Record<string, unknown> = {}) {
  return t.run(ctx => ctx.db.insert("platformClaims", { orgId, platform: "google_ads", date: "2026-11-15", conversions: 1, conversionValueMinor: 1000, spendMinor: 100, currency: "USD", isFixture: false, spendOrigin: "owner_reported", ...extra }));
}

describe("attribution evidence in Results", () => {
  beforeEach(() => vi.spyOn(Date, "now").mockReturnValue(now));
  afterEach(() => vi.restoreAllMocks());

  it("uses the displayed completed local dates and excludes current/future events", async () => {
    const t = setup(); const w = await workspace(t);
    await t.run(ctx => ctx.db.patch(w.orgId, { timezone: "Asia/Dhaka" }));
    const first = Date.UTC(2026, 10, 8, 18); // Nov 9 midnight in Dhaka.
    const end = Date.UTC(2026, 10, 15, 18); // Nov 16 midnight in Dhaka.
    await payment(t, w.orgId, "start", first);
    await payment(t, w.orgId, "end-minus-one", end - 1);
    await payment(t, w.orgId, "too-early", first - 1);
    await payment(t, w.orgId, "today", end);
    await payment(t, w.orgId, "future", now + DAY);
    const result = await w.client.query(api.analytics.overview, { slug: w.slug, days: 7 });
    expect(result).toMatchObject({ from: "2026-11-09", to: "2026-11-15" });
    expect(result.attribution.lastTouch?.byCurrency[0]).toMatchObject({ totalNetBillingMinor: 2000, unattributed: { conversions: 2 } });
  });

  it("selects first and last eligible recorded touches beyond the old 20-row cap", async () => {
    const t = setup(); const w = await workspace(t);
    await payment(t, w.orgId, "purchase");
    for (let i = 0; i < 25; i++) await touch(t, w.orgId, `channel-${i}`, now - 3 * DAY + i * 1000);
    await touch(t, w.orgId, "future-touch", now + DAY);
    const result = await w.client.query(api.analytics.overview, { slug: w.slug, days: 7 });
    expect(result.attribution.issues).toEqual([]);
    expect(result.attribution.firstTouch?.byCurrency[0].channels[0].channel).toBe("channel-0");
    expect(result.attribution.lastTouch?.byCurrency[0].channels[0].channel).toBe("channel-24");
  });

  it("excludes demo events, touches and claims from a real workspace", async () => {
    const t = setup(); const w = await workspace(t);
    await payment(t, w.orgId, "real");
    await payment(t, w.orgId, "fixture", now - DAY, { isFixture: true, amountMinor: 900000 });
    await touch(t, w.orgId, "real-channel", now - 2 * DAY);
    await touch(t, w.orgId, "fixture-channel", now - DAY - 1, true);
    await claim(t, w.orgId);
    await claim(t, w.orgId, { platform: "meta_ads", isFixture: true, spendMinor: 900000 });
    const result = await w.client.query(api.analytics.overview, { slug: w.slug, days: 7 });
    expect(result.attribution.lastTouch?.byCurrency[0]).toMatchObject({ totalNetBillingMinor: 1000, channels: [{ channel: "real-channel" }] });
    expect(result.platformClaims?.platforms).toHaveLength(1);
    expect(result.platformClaims?.platforms[0].origin).toBe("owner_reported");
    expect(result.platformClaims?.adSpendMinor).toBe(100);
    expect(result.platformClaimsNote).toContain("owner reported");
  });

  it.each(["conflict", "invalid"])("withholds %s billing evidence instead of choosing a convenient value", async kind => {
    const t = setup(); const w = await workspace(t);
    await payment(t, w.orgId, "same-id");
    await payment(t, w.orgId, kind === "conflict" ? "same-id" : "invalid", now - DAY, { amountMinor: kind === "conflict" ? 2000 : 1.5 });
    const result = await w.client.query(api.analytics.overview, { slug: w.slug, days: 7 });
    expect(result.attribution.lastTouch).toBeNull();
    expect(result.attribution.firstTouch).toBeNull();
    expect(result.attribution.issues.join(" ")).toMatch(kind === "conflict" ? /conflicting/ : /amounts/);
    const encoded = JSON.parse(encodeToolOutput(result, 30000, toolByName("get_results")?.output));
    expect(encoded.attribution.issues).toEqual(result.attribution.issues);
  });

  it("reports a capped touch read as unavailable, not as an unattributed sale", async () => {
    const t = setup(); const w = await workspace(t);
    await payment(t, w.orgId, "purchase");
    await t.run(async ctx => {
      for (let i = 0; i < 2001; i++) await ctx.db.insert("touches", { orgId: w.orgId, source: "stripe", customerRef: "customer", channel: "channel", occurredAt: now - 2 * DAY + i, isFixture: false });
    });
    const result = await w.client.query(api.analytics.overview, { slug: w.slug, days: 7 });
    expect(result.attribution.lastTouch).toBeNull();
    expect(result.attribution.issues.join(" ")).toContain("2,000-record limit");
  });

  it("withholds ambiguous legacy customer matching across billing sources", async () => {
    const t = setup(); const w = await workspace(t);
    await payment(t, w.orgId, "purchase");
    await t.run(ctx => ctx.db.insert("touches", { orgId: w.orgId, customerRef: "customer", channel: "unknown-origin", occurredAt: now - 2 * DAY, isFixture: false }));
    const result = await w.client.query(api.analytics.overview, { slug: w.slug, days: 7 });
    expect(result.attribution.lastTouch).toBeNull();
    expect(result.attribution.issues.join(" ")).toContain("billing-source identity");
  });

  it("withholds a capped billing read and retains genuine unattributed negative net revenue", async () => {
    const t = setup(); const w = await workspace(t);
    await payment(t, w.orgId, "refunded", now - DAY, { refundedMinor: 1500 });
    const initial = await w.client.query(api.analytics.overview, { slug: w.slug, days: 7 });
    expect(initial.attribution.lastTouch?.byCurrency[0]).toMatchObject({ totalNetBillingMinor: -500, unattributed: { netRevenueMinor: -500, conversions: 1 } });
    await t.run(async ctx => {
      for (let i = 0; i < 2000; i++) await ctx.db.insert("revenueEvents", { orgId: w.orgId, source: "stripe", sourceEventId: `extra-${i}`, currency: "USD", amountMinor: 1000, refundedMinor: 0, kind: "order", occurredAt: now - DAY, ingestedAt: now, isFixture: false });
    });
    const result = await w.client.query(api.analytics.overview, { slug: w.slug, days: 7 });
    expect(result.attribution.lastTouch).toBeNull();
    expect(result.attribution.issues.join(" ")).toContain("2,000-record limit");
  });

  it("bounds platform observations to the selected dates and preserves unknown currency spend", async () => {
    const t = setup(); const w = await workspace(t);
    await claim(t, w.orgId, { currency: "EUR" });
    await claim(t, w.orgId, { date: "2026-11-16", spendMinor: 99999 });
    await claim(t, w.orgId, { date: "2026-11-20", spendMinor: 99999 });
    const result = await w.client.query(api.analytics.overview, { slug: w.slug, days: 7 });
    expect(result.platformClaims).toMatchObject({ adSpendMinor: null, adSpendByCurrency: { EUR: 100 } });
    expect(result.platformClaims?.platforms[0].days).toBe(1);
    expect(result.platformClaimsNote).toContain("missing days");
  });

  it.each(["duplicate", "invalid"])("withholds %s ad observations without disguising them as no connection", async kind => {
    const t = setup(); const w = await workspace(t);
    await claim(t, w.orgId);
    await claim(t, w.orgId, kind === "duplicate" ? {} : { date: "2026-11-14", spendMinor: -1 });
    const result = await w.client.query(api.analytics.overview, { slug: w.slug, days: 7 });
    expect(result.platformClaims).toBeNull();
    expect(result.platformClaimsNote).toMatch(kind === "duplicate" ? /Duplicate/ : /Invalid/);
  });

  it("keeps unusual channel names as data, and reading results cannot authorize actions", async () => {
    const t = setup(); const w = await workspace(t); const other = await workspace(t, "other-attribution@example.com");
    await payment(t, w.orgId, "purchase");
    await touch(t, w.orgId, "__proto__", now - 2 * DAY);
    const actions = () => t.run(async ctx => Promise.all([ctx.db.query("workflowRuns").collect(), ctx.db.query("approvals").collect(), ctx.db.query("actionReceipts").collect()]));
    const before = await actions();
    const result = await w.client.query(api.analytics.overview, { slug: w.slug, days: 7 });
    expect(result.attribution.lastTouch?.byCurrency[0].channels).toEqual([{ channel: "__proto__", netRevenueMinor: 1000, conversions: 1 }]);
    await expect(other.client.query(api.analytics.overview, { slug: w.slug })).rejects.toThrow();
    await expect(t.query(api.analytics.overview, { slug: w.slug })).rejects.toThrow();
    expect(await actions()).toEqual(before);
  });
});
