import { describe, expect, it } from "vitest";
import {
  attribute,
  ClaimsAggregationError,
  computeReturnMetrics,
  dedupeConversionEvents,
  dedupeRevenueEvents,
  platformConcentration,
  roas,
  roi,
  summarizePlatformClaims,
  totalRevenueFromClaims,
  type PlatformClaim,
  type RevenueEvent,
  type Touch,
} from "../../shared/attribution";

const DAY = 86_400_000;
const T0 = Date.UTC(2025, 0, 10);

function ev(partial: Partial<RevenueEvent> & Pick<RevenueEvent, "id">): RevenueEvent {
  return {
    sourceEventId: partial.id,
    source: "stripe",
    occurredAt: T0,
    currency: "USD",
    amountMinor: 10_000,
    refundedMinor: 0,
    kind: "order",
    ...partial,
  };
}

const touches: Touch[] = [
  { customerRef: "c1", occurredAt: T0 - 10 * DAY, channel: "google_ads", utmSource: "google" },
  { customerRef: "c1", occurredAt: T0 - 3 * DAY, channel: "newsletter" },
  { customerRef: "c1", occurredAt: T0 + DAY, channel: "meta_ads" }, // after the event: ineligible
  { customerRef: "c2", occurredAt: T0 - 60 * DAY, channel: "organic" }, // outside lookback
];

describe("dedupe", () => {
  it("dedupes revenue events by (source, sourceEventId)", () => {
    const events = [
      ev({ id: "a", sourceEventId: "ch_1" }),
      ev({ id: "b", sourceEventId: "ch_1" }),
      ev({ id: "c", sourceEventId: "ch_1", source: "polar" }),
    ];
    const r = dedupeRevenueEvents(events);
    expect(r.duplicates).toBe(1);
    expect(r.events.map((e) => e.id)).toEqual(["a", "c"]);
  });

  it("dedupes browser/server conversions by eventId, preferring server", () => {
    const r = dedupeConversionEvents([
      { eventId: "e1", origin: "browser", occurredAt: 1 },
      { eventId: "e1", origin: "server", occurredAt: 2 },
      { eventId: "e2", origin: "browser", occurredAt: 3 },
    ]);
    expect(r.duplicates).toBe(1);
    expect(r.events).toHaveLength(2);
    expect(r.events[0].origin).toBe("server");
  });
});

describe("attribute", () => {
  const events = [
    ev({ id: "o1", customerRef: "c1", orderRef: "ord1", amountMinor: 10_000, refundedMinor: 2_500 }),
    ev({ id: "o2", customerRef: "c2", orderRef: "ord2", amountMinor: 5_000 }),
    ev({ id: "o3", amountMinor: 1_234, kind: "subscription_payment" }), // no customerRef
    ev({ id: "r1", customerRef: "c1", orderRef: "ord1", amountMinor: 1_000, kind: "refund", occurredAt: T0 + 5 * DAY }),
    ev({ id: "o1-dup", sourceEventId: "o1", customerRef: "c1", amountMinor: 10_000 }),
  ];

  it("last vs first touch differ on a multi-touch customer", () => {
    const last = attribute(events, touches, { model: "last_touch", lookbackDays: 30 });
    const first = attribute(events, touches, { model: "first_touch", lookbackDays: 30 });
    expect(Object.keys(last.byCurrency.USD.channels)).toEqual(["newsletter"]);
    expect(Object.keys(first.byCurrency.USD.channels)).toEqual(["google_ads"]);
    // 10000 - 2500 (embedded refund) - 1000 (refund event inherits ord1's channel)
    expect(last.byCurrency.USD.channels.newsletter.netRevenueMinor).toBe(6_500);
    expect(last.byCurrency.USD.channels.newsletter.conversions).toBe(1);
    expect(last.duplicatesRemoved).toBe(1);
  });

  it("has an explicit unattributed bucket and reconciles exactly with refunds", () => {
    const r = attribute(events, touches, { model: "last_touch", lookbackDays: 30 });
    const usd = r.byCurrency.USD;
    expect(usd.unattributed.netRevenueMinor).toBe(5_000 + 1_234);
    expect(usd.unattributed.eventIds.sort()).toEqual(["o2", "o3"]);
    expect(usd.totalNetBillingMinor).toBe(10_000 - 2_500 - 1_000 + 5_000 + 1_234);
    expect(usd.attributedNetMinor + usd.unattributed.netRevenueMinor).toBe(usd.totalNetBillingMinor);
    expect(usd.reconciled).toBe(true);
    expect(r.reconciled).toBe(true);
  });

  it("keeps customer and order attribution scoped to their billing source", () => {
    const events = [
      ev({ id: "stripe-order", source: "stripe", customerRef: "same-id", orderRef: "same-order", amountMinor: 10_000 }),
      ev({ id: "polar-order", source: "polar", customerRef: "same-id", orderRef: "same-order", amountMinor: 20_000 }),
      ev({ id: "stripe-refund", source: "stripe", orderRef: "same-order", amountMinor: 1_000, kind: "refund", occurredAt: T0 + DAY }),
    ];
    const sourceTouches: Touch[] = [
      { customerRef: "same-id", source: "stripe", occurredAt: T0 - DAY, channel: "stripe_ads" },
      { customerRef: "same-id", source: "polar", occurredAt: T0 - DAY, channel: "polar_ads" },
    ];

    const result = attribute(events, sourceTouches, { model: "last_touch", lookbackDays: 30 });
    expect(result.byCurrency.USD.channels.stripe_ads.netRevenueMinor).toBe(9_000);
    expect(result.byCurrency.USD.channels.polar_ads.netRevenueMinor).toBe(20_000);
    expect(result.byCurrency.USD.reconciled).toBe(true);
  });

  it("does not apply a legacy unscoped touch when a customer ID appears in multiple sources", () => {
    const events = [
      ev({ id: "stripe-order", source: "stripe", customerRef: "same-id" }),
      ev({ id: "polar-order", source: "polar", customerRef: "same-id" }),
    ];
    const result = attribute(events, [{ customerRef: "same-id", occurredAt: T0 - DAY, channel: "unknown_source" }], { model: "last_touch", lookbackDays: 30 });
    expect(result.byCurrency.USD.unattributed.eventIds).toEqual(["stripe-order", "polar-order"]);
    expect(result.byCurrency.USD.channels.unknown_source).toBeUndefined();
  });

  it("keeps currencies separate without FX and reports unconverted currencies with FX", () => {
    const mixed = [
      ev({ id: "u1", customerRef: "c1", amountMinor: 10_000 }),
      ev({ id: "e1", customerRef: "c1", amountMinor: 8_000, currency: "EUR" }),
      ev({ id: "g1", customerRef: "c1", amountMinor: 3_000, currency: "GBP" }),
    ];
    const r = attribute(mixed, touches, { model: "last_touch", lookbackDays: 30 });
    expect(Object.keys(r.byCurrency).sort()).toEqual(["EUR", "GBP", "USD"]);
    expect(r.byCurrency.USD.totalNetBillingMinor).toBe(10_000);
    expect(r.byCurrency.EUR.totalNetBillingMinor).toBe(8_000);
    expect(r.reporting).toBeNull();
    expect(r.notes.some((n) => /kept separate/.test(n))).toBe(true);

    const withFx = attribute(mixed, touches, {
      model: "last_touch",
      lookbackDays: 30,
      fx: { asOf: "2025-01-10", reportingCurrency: "USD", rates: { EUR: 1.1 } },
    });
    expect(withFx.reporting?.totalNetMinor).toBe(10_000 + 8_800);
    expect(withFx.reporting?.unconvertedCurrencies).toEqual(["GBP"]);
    expect(withFx.byCurrency.GBP.totalNetBillingMinor).toBe(3_000);
  });

  it("rejects non-integer minor amounts", () => {
    expect(() => attribute([ev({ id: "x", amountMinor: 10.5 })], [], { model: "last_touch", lookbackDays: 7 })).toThrow(/integer/);
  });
});

describe("platform concentration", () => {
  it("uses recognized tagged billing paths, attaches refunds, and leaves unknown sources out", () => {
    const result = platformConcentration([
      ev({ id: "google-order", customerRef: "c1", orderRef: "g1", amountMinor: 10_000, utmSource: "google", utmMedium: "cpc" }),
      ev({ id: "google-refund", orderRef: "g1", amountMinor: 2_000, kind: "refund", occurredAt: T0 + DAY }),
      ev({ id: "meta-order", source: "polar", customerRef: "c2", orderRef: "m1", amountMinor: 6_000, utmSource: "instagram", utmMedium: "paid_social" }),
      ev({ id: "unknown-order", source: "shopify", customerRef: "c3", orderRef: "u1", amountMinor: 5_000, utmSource: "made-up-channel", utmMedium: "cpc" }),
    ], { currency: "USD", fromMs: T0, toMs: T0 + 2 * DAY })!;

    expect(result.topSource).toBe("Google ads");
    expect(result.attributedPositiveNetMinor).toBe(14_000);
    expect(result.topSourceShare).toBeCloseTo(8 / 14);
    expect(result.attributedConversions).toBe(2);
    expect(result.totalConversions).toBe(3);
    expect(result.topThreeShare).toBe(1);
  });

  it("returns a truthful empty attribution state when no recognized UTMs exist", () => {
    const result = platformConcentration([
      ev({ id: "no-utm", customerRef: "c1", amountMinor: 4_000 }),
    ], { currency: "USD", fromMs: T0, toMs: T0 + DAY })!;
    expect(result.topSource).toBeNull();
    expect(result.topSourceShare).toBeNull();
    expect(result.attributedPositiveNetMinor).toBe(0);
  });
});

describe("platform claims", () => {
  const claims: PlatformClaim[] = [
    { platform: "google_ads", date: "2025-01-01", conversions: 10, conversionValueMinor: 50_000, currency: "USD" },
    { platform: "google_ads", date: "2025-01-02", conversions: 5, conversionValueMinor: 20_000, currency: "USD" },
    { platform: "meta_ads", date: "2025-01-01", conversions: 12, conversionValueMinor: 60_000, currency: "USD" },
  ];
  it("summarises per platform, labelled platform_reported, with an overlap warning and no total", () => {
    const s = summarizePlatformClaims(claims);
    expect(s.label).toBe("platform_reported");
    expect(s.platforms.map((p) => [p.platform, p.conversions, p.conversionValueMinorByCurrency.USD])).toEqual([
      ["google_ads", 15, 70_000],
      ["meta_ads", 12, 60_000],
    ]);
    expect(s.overlapWarning).toMatch(/overlap/);
    expect(Object.keys(s)).not.toContain("total");
  });
  it("refuses to sum claims into total revenue", () => {
    expect(() => totalRevenueFromClaims(claims)).toThrow(ClaimsAggregationError);
  });
});

describe("ROAS / ROI", () => {
  it("uses distinct definitions and returns null on zero spend", () => {
    expect(roas(30_000, 10_000)).toBe(3);
    expect(roi(30_000, 10_000, 5_000)).toBe(1); // (30000-10000-5000)/15000
    expect(roas(30_000, 0)).toBeNull();
    expect(roi(30_000, 0, 0)).toBeNull();
    expect(roi(30_000, 0, 10_000)).toBe(2);
    const m = computeReturnMetrics({ attributedRevenueMinor: 20_000, adSpendMinor: 10_000, otherCostsMinor: 10_000 });
    expect(m).toMatchObject({ roas: 2, roi: 0, contributionMinor: 0 });
  });
});
