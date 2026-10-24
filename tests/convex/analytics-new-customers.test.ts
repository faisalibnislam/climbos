import { describe, expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { asNewUser, setup } from "./helpers";

const DAY = 86_400_000;

describe("first recorded paying customers", () => {
  it("imports owner-reported ad spend with currency precision and safely replaces the same day", async () => {
    const t = setup();
    const owner = await asNewUser(t, "ad-spend-import@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Spend Co" });
    const other = await asNewUser(t, "other-ad-spend-import@example.com");
    await other.client.mutation(api.orgs.createWorkspace, { businessName: "Other Spend Co" });
    await t.run(async (ctx) => ctx.db.insert("platformClaims", {
      orgId,
      platform: "google_ads",
      date: "2026-10-23",
      conversions: 1,
      conversionValueMinor: 1000,
      spendMinor: 1000,
      currency: "USD",
      spendOrigin: "platform_reported",
      isFixture: false,
    }));
    const input = { slug, rows: [{ platform: "google_ads" as const, date: "2026-10-23", conversions: 3, conversionValue: 240.5, spend: 60.25, currency: "USD" }] };
    await expect(owner.client.mutation(api.analytics.importPlatformClaims, { ...input, rows: [...input.rows, ...input.rows] })).rejects.toThrow(/duplicate platform/);
    await expect(other.client.mutation(api.analytics.importPlatformClaims, input)).rejects.toThrow();
    await expect(owner.client.mutation(api.analytics.importPlatformClaims, { ...input, rows: [{ ...input.rows[0], date: "2026-02-30" }] })).rejects.toThrow(/real calendar date/);
    await owner.client.mutation(api.analytics.importPlatformClaims, input);
    await owner.client.mutation(api.analytics.importPlatformClaims, { ...input, rows: [{ ...input.rows[0], spend: 75.3 }] });
    await owner.client.mutation(api.analytics.importPlatformClaims, {
      slug,
      rows: [{ platform: "meta_ads", date: "2026-10-22", conversions: 1, conversionValue: 90, spend: 25.5, currency: "EUR" }],
    });

    const rows = await t.run(async (ctx) => ctx.db.query("platformClaims").withIndex("by_org_platform_date", (q) => q.eq("orgId", orgId).eq("platform", "google_ads").eq("date", "2026-10-23")).collect());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ conversions: 3, conversionValueMinor: 24_050, spendMinor: 7_530, currency: "USD", spendOrigin: "owner_reported", isFixture: false });
    const overview = await owner.client.query(api.analytics.overview, { slug, days: 30 });
    expect(overview?.platformClaims).toMatchObject({ adSpendMinor: 7_530, adSpendByCurrency: { USD: 7_530, EUR: 2_550 } });
  });

  it("counts an identified customer once, not again for renewals or duplicate same-day payments", async () => {
    const t = setup();
    const owner = await asNewUser(t, "first-payer@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "First Payer Co" });
    const now = Date.now();
    const events = [
      { source: "csv", sourceEventId: "c1-first", occurredAt: now - 4 * DAY, customerRef: "customer-1", currency: "USD", amountMinor: 10_000, refundedMinor: 0, kind: "order" as const },
      { source: "csv", sourceEventId: "c1-renewal", occurredAt: now - DAY, customerRef: "customer-1", currency: "USD", amountMinor: 10_000, refundedMinor: 0, kind: "subscription_payment" as const },
      { source: "csv", sourceEventId: "c2-first", occurredAt: now - DAY, customerRef: "customer-2", currency: "USD", amountMinor: 5_000, refundedMinor: 0, kind: "order" as const },
      { source: "csv", sourceEventId: "c2-second", occurredAt: now - DAY, customerRef: "customer-2", currency: "USD", amountMinor: 1_000, refundedMinor: 0, kind: "order" as const },
      { source: "csv", sourceEventId: "unknown-customer", occurredAt: now - DAY, currency: "USD", amountMinor: 2_500, refundedMinor: 0, kind: "order" as const },
    ];

    await t.mutation(internal.analytics.ingestRevenue, { orgId: orgId as Id<"organizations">, events });
    const view = await owner.client.query(api.analytics.overview, { slug, days: 30 });
    const metric = view!.metrics.find((m) => m.key === "paid_conversions")!;

    expect(metric.total).toBe(2);
    expect(metric.hasData).toBe(true);
    expect(metric.label).toBe("First recorded paying customers");
    expect(metric.definition).toMatch(/without a customer ID are excluded/);
    expect(metric.points.reduce((sum, point) => sum + point.value, 0)).toBe(2);
  });

  it("does not report customer counts when imported payments have no customer IDs", async () => {
    const t = setup();
    const owner = await asNewUser(t, "unknown-payer@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Unknown Payer Co" });
    await t.mutation(internal.analytics.ingestRevenue, {
      orgId: orgId as Id<"organizations">,
      events: [{ source: "csv", sourceEventId: "no-id", occurredAt: Date.now() - DAY, currency: "USD", amountMinor: 1_000, refundedMinor: 0, kind: "order" }],
    });

    const view = await owner.client.query(api.analytics.overview, { slug, days: 30 });
    const metric = view!.metrics.find((m) => m.key === "paid_conversions")!;

    expect(metric.hasData).toBe(false);
    expect(metric.total).toBe(0);
    expect(metric.sourceName).toBeNull();
  });

  it("does not report paying-customer data for a refund-only window", async () => {
    const t = setup();
    const owner = await asNewUser(t, "refund-only@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Refund Only Co" });
    await t.mutation(internal.analytics.ingestRevenue, {
      orgId: orgId as Id<"organizations">,
      events: [{ source: "stripe", sourceEventId: "refund-only", occurredAt: Date.now() - DAY, customerRef: "customer-1", currency: "USD", amountMinor: 1_000, refundedMinor: 0, kind: "refund" }],
    });

    const view = await owner.client.query(api.analytics.overview, { slug, days: 30 });
    const metric = view!.metrics.find((m) => m.key === "paid_conversions")!;
    expect(metric.hasData).toBe(false);
    expect(metric.total).toBe(0);
    expect(metric.sourceName).toBeNull();
  });

  it("keeps identical provider customer IDs separate instead of merging unrelated billing customers", async () => {
    const t = setup();
    const owner = await asNewUser(t, "provider-ids@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Provider IDs Co" });
    const now = Date.now();

    await t.mutation(internal.analytics.ingestRevenue, {
      orgId: orgId as Id<"organizations">,
      events: [
        { source: "stripe", sourceEventId: "stripe-event", occurredAt: now - DAY, customerRef: "customer-7", currency: "USD", amountMinor: 1_000, refundedMinor: 0, kind: "order" },
        { source: "polar", sourceEventId: "polar-event", occurredAt: now - DAY, customerRef: "customer-7", currency: "USD", amountMinor: 1_000, refundedMinor: 0, kind: "order" },
      ],
    });

    const view = await owner.client.query(api.analytics.overview, { slug, days: 30 });
    const metric = view!.metrics.find((m) => m.key === "paid_conversions")!;
    expect(metric.total).toBe(2);
    expect(metric.definition).toMatch(/source-scoped customer IDs/);
    expect(metric.definition).toMatch(/same person across billing systems may count more than once/);
  });

  it("does not cross-attribute UTMs when two billing providers reuse the same customer and order IDs", async () => {
    const t = setup();
    const owner = await asNewUser(t, "provider-attribution@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Provider Attribution Co" });
    const now = Date.now();

    await t.mutation(internal.analytics.ingestRevenue, {
      orgId: orgId as Id<"organizations">,
      events: [
        { source: "stripe", sourceEventId: "stripe-event", occurredAt: now - DAY, customerRef: "customer-7", orderRef: "order-1", currency: "USD", amountMinor: 1_000, refundedMinor: 0, kind: "order", utmSource: "google", utmMedium: "cpc" },
        { source: "polar", sourceEventId: "polar-event", occurredAt: now - DAY, customerRef: "customer-7", orderRef: "order-1", currency: "USD", amountMinor: 2_000, refundedMinor: 0, kind: "order", utmSource: "meta", utmMedium: "cpc" },
      ],
    });

    const view = await owner.client.query(api.analytics.overview, { slug, days: 30 });
    const channels = view!.attribution.lastTouch!.byCurrency[0].channels;
    expect(channels).toEqual(expect.arrayContaining([
      expect.objectContaining({ channel: "google ads", netRevenueMinor: 1_000 }),
      expect.objectContaining({ channel: "meta ads", netRevenueMinor: 2_000 }),
    ]));
  });
});
