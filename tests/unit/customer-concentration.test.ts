import { describe, expect, it } from "vitest";
import { customerConcentration } from "../../shared/attribution/concentration";
import type { RevenueEvent } from "../../shared/attribution/types";

const window = { currency: "USD", fromMs: 0, toMs: 1_000 };
function event(overrides: Partial<RevenueEvent> & Pick<RevenueEvent, "sourceEventId" | "amountMinor" | "kind">): RevenueEvent {
  return {
    id: overrides.sourceEventId,
    source: "billing",
    occurredAt: 100,
    currency: "USD",
    refundedMinor: 0,
    ...overrides,
  };
}

describe("customer concentration", () => {
  it("dedupes billing retries and assigns an order refund to its customer", () => {
    const result = customerConcentration([
      event({ sourceEventId: "a", amountMinor: 10_000, kind: "order", customerRef: "private-a", orderRef: "order-a" }),
      event({ sourceEventId: "a", id: "duplicate", amountMinor: 10_000, kind: "order", customerRef: "private-a", orderRef: "order-a" }),
      event({ sourceEventId: "refund-a", amountMinor: 2_000, kind: "refund", orderRef: "order-a" }),
      event({ sourceEventId: "b", amountMinor: 8_000, kind: "subscription_payment", customerRef: "private-b" }),
      event({ sourceEventId: "unknown", amountMinor: 5_000, kind: "order" }),
      event({ sourceEventId: "eur", amountMinor: 99_000, kind: "order", customerRef: "private-eur", currency: "EUR" }),
    ], window)!;

    expect(result.eventCount).toBe(4);
    expect(result.duplicatesRemoved).toBe(1);
    expect(result.customerCount).toBe(2);
    expect(result.identifiedPositiveMinor).toBe(16_000);
    expect(result.totalPositiveMinor).toBe(23_000);
    expect(result.identifiedCoverage).toBeCloseTo(18 / 23);
    expect(result.identifiedBillingPositiveMinor).toBe(18_000);
    expect(result.topCustomerShare).toBeCloseTo(8 / 16);
    expect(result.topThreeCustomerShare).toBe(1);
    expect(JSON.stringify(result)).not.toContain("private-");
  });

  it("returns no signal without matching events and null shares when net positive revenue is absent", () => {
    expect(customerConcentration([], window)).toBeNull();
    const result = customerConcentration([
      event({ sourceEventId: "refund", amountMinor: 500, kind: "refund", customerRef: "private-a" }),
    ], window)!;
    expect(result.customerCount).toBe(0);
    expect(result.identifiedCoverage).toBeNull();
    expect(result.topCustomerShare).toBeNull();
    expect(result.topThreeCustomerShare).toBeNull();
  });

  it("marks the bounded source read as partial and rejects an invalid time window", () => {
    expect(customerConcentration([
      event({ sourceEventId: "a", amountMinor: 100, kind: "order", customerRef: "private-a" }),
    ], { ...window, partial: true })?.partial).toBe(true);
    expect(() => customerConcentration([], { currency: "USD", fromMs: 2, toMs: 1 })).toThrow(RangeError);
  });

  it("does not combine customer or order identifiers across billing sources", () => {
    const result = customerConcentration([
      event({ source: "provider-a", sourceEventId: "a", amountMinor: 10_000, kind: "order", customerRef: "same-id", orderRef: "same-order" }),
      event({ source: "provider-b", sourceEventId: "b", amountMinor: 10_000, kind: "order", customerRef: "same-id", orderRef: "same-order" }),
      event({ source: "provider-b", sourceEventId: "refund-b", amountMinor: 2_000, kind: "refund", orderRef: "same-order" }),
    ], window)!;

    expect(result.customerCount).toBe(2);
    expect(result.identifiedPositiveMinor).toBe(18_000);
    expect(result.topCustomerShare).toBeCloseTo(10 / 18);
  });
});

it("keeps identity coverage on the same positive-event basis despite refunds", () => {
  const result = customerConcentration([
    event({ sourceEventId: "sale", amountMinor: 1000, kind: "order", customerRef: "a", orderRef: "o" }),
    event({ sourceEventId: "refund", amountMinor: 200, kind: "refund", orderRef: "o" }),
  ], window)!;
  expect(result).toMatchObject({ identifiedCoverage: 1, identifiedBillingPositiveMinor: 1000, identifiedPositiveMinor: 800, totalPositiveMinor: 1000 });
});
it("does not assign an ambiguous order refund to whichever customer was read first", () => {
  const rows = [
    event({ sourceEventId: "a", amountMinor: 1000, kind: "order", customerRef: "a", orderRef: "same" }),
    event({ sourceEventId: "b", amountMinor: 500, kind: "order", customerRef: "b", orderRef: "same" }),
    event({ sourceEventId: "r", amountMinor: 200, kind: "refund", orderRef: "same" }),
  ];
  const result = customerConcentration(rows, window)!;
  expect(result).toMatchObject({ conflictingOrderCount: 1, unresolvedRefundCount: 1, topCustomerShare: null, topThreeCustomerShare: null });
  expect(customerConcentration([...rows].reverse(), window)).toEqual(result);
});
it("withholds concentration when a nonzero refund cannot be assigned or contradicts its order", () => {
  const sale = event({ sourceEventId: "a", amountMinor: 1000, kind: "order", customerRef: "a", orderRef: "o" });
  expect(customerConcentration([sale, event({ sourceEventId: "r", amountMinor: 200, kind: "refund" })], window)).toMatchObject({ unresolvedRefundCount: 1, topCustomerShare: null });
  expect(customerConcentration([sale, event({ sourceEventId: "r", amountMinor: 200, kind: "refund", orderRef: "o", customerRef: "b" })], window)).toMatchObject({ conflictingOrderCount: 1, topCustomerShare: null });
});
it("treats blank customer identifiers as unknown and rejects unsafe aggregate arithmetic", () => {
  expect(customerConcentration([event({ sourceEventId: "a", amountMinor: 1000, kind: "order", customerRef: "   " })], window)).toMatchObject({ identifiedCoverage: 0, customerCount: 0 });
  expect(() => customerConcentration([
    event({ sourceEventId: "a", amountMinor: Number.MAX_SAFE_INTEGER, kind: "order", customerRef: "a" }),
    event({ sourceEventId: "b", amountMinor: 1, kind: "order", customerRef: "b" }),
  ], window)).toThrow(RangeError);
});

it("does not mistake zero refunds, foreign currency or out-of-window events for material identity uncertainty", () => {
  const result = customerConcentration([
    event({ sourceEventId: "a", amountMinor: 1000, kind: "order", customerRef: "a", orderRef: "o" }),
    event({ sourceEventId: "zero", amountMinor: 0, kind: "refund" }),
    event({ sourceEventId: "foreign", amountMinor: 200, kind: "refund", currency: "EUR" }),
    event({ sourceEventId: "future", amountMinor: 200, kind: "refund", occurredAt: 1001 }),
  ], window)!;
  expect(result).toMatchObject({ eventCount: 2, unresolvedRefundCount: 0, identifiedCoverage: 1, topCustomerShare: 1 });
});
it.each([
  { amountMinor: 0.5, refundedMinor: 0 },
  { amountMinor: 100, refundedMinor: 101 },
  { amountMinor: 100, refundedMinor: -1 },
])("rejects invalid imported amounts %j", extra => {
  expect(() => customerConcentration([event({ sourceEventId: "a", kind: "order", ...extra })], window)).toThrow(RangeError);
});
