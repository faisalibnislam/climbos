import { describe, expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { asNewUser, setup } from "./helpers";

const DAY = 86_400_000;

describe("first recorded paying customers", () => {
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
