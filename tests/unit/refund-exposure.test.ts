import { describe, expect, it } from "vitest";
import { refundExposure } from "../../shared/attribution/refundExposure";
import type { RevenueEvent } from "../../shared/attribution/types";

const window = { currency: "USD", fromMs: 0, toMs: 1_000 };
function event(overrides: Partial<RevenueEvent> & Pick<RevenueEvent, "sourceEventId" | "amountMinor" | "kind">): RevenueEvent {
  return { id: overrides.sourceEventId, source: "billing", occurredAt: 100, currency: "USD", refundedMinor: 0, ...overrides };
}

describe("refund exposure", () => {
  it("computes same-window refund amount from embedded and separate refunds and removes retried events", () => {
    const result = refundExposure([
      event({ sourceEventId: "embedded", amountMinor: 10_000, refundedMinor: 1_000, kind: "order" }),
      event({ sourceEventId: "standalone-payment", amountMinor: 5_000, kind: "order" }),
      event({ sourceEventId: "standalone-refund", amountMinor: 500, kind: "refund" }),
      event({ sourceEventId: "standalone-refund", id: "retry", amountMinor: 500, kind: "refund" }),
      event({ sourceEventId: "foreign-currency", amountMinor: 90_000, kind: "order", currency: "EUR" }),
    ], window)!;

    expect(result).toMatchObject({
      paymentCount: 2,
      explicitRefundEventCount: 1,
      grossPaidMinor: 15_000,
      refundsRecordedMinor: 1_500,
      netPaidMinor: 13_500,
      refundToGrossShare: 0.1,
      duplicatesRemoved: 1,
      partial: false,
    });
  });

  it("does not invent a percentage when standalone refunds exceed same-window gross sales", () => {
    expect(refundExposure([
      event({ sourceEventId: "old-order-refund", amountMinor: 2_000, kind: "refund" }),
      event({ sourceEventId: "new-sale", amountMinor: 1_000, kind: "order" }),
    ], window)).toMatchObject({
      grossPaidMinor: 1_000,
      refundsRecordedMinor: 2_000,
      netPaidMinor: -1_000,
      refundToGrossShare: null,
      ratioUnavailableReason: "refunds_exceed_window_gross",
    });
  });

  it("keeps missing billing data and read truncation explicit", () => {
    expect(refundExposure([], window)).toBeNull();
    const result = refundExposure([
      event({ sourceEventId: "refund-only", amountMinor: 500, kind: "refund" }),
    ], { ...window, partial: true })!;
    expect(result.refundToGrossShare).toBeNull();
    expect(result.ratioUnavailableReason).toBe("no_gross_payments");
    expect(result.partial).toBe(true);
  });

  it("rejects inconsistent monetary data instead of clipping it", () => {
    expect(() => refundExposure([
      event({ sourceEventId: "bad", amountMinor: 100, refundedMinor: 101, kind: "order" }),
    ], window)).toThrow(/inconsistent/);
  });
});
