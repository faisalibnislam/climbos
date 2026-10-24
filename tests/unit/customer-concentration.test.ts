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
    expect(result.identifiedCoverage).toBeCloseTo(16 / 23);
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
});
