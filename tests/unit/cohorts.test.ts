import { describe, expect, it } from "vitest";
import { computeCohorts, subscriptionCohortBrief, type CohortPayment } from "../../shared/attribution";

const d = (s: string) => Date.parse(`${s}T12:00:00Z`);
const pay = (customerRef: string, date: string, amountMinor = 2500, extra: Partial<CohortPayment> = {}): CohortPayment => ({ customerRef, occurredAt: d(date), amountMinor, refundedMinor: 0, kind: "subscription_payment", currency: "USD", ...extra });

describe("monthly cohorts", () => {
  const payments = [
    pay("a", "2026-07-03"), pay("a", "2026-08-03"), pay("a", "2026-09-03"),
    pay("b", "2026-07-20"), pay("b", "2026-08-20"),
    pay("c", "2026-07-25"),
    pay("d", "2026-08-01"), pay("d", "2026-09-01"),
    pay("e", "2026-08-15", 2500, { refundedMinor: 2500 }), // fully refunded: not a customer
    pay("f", "2026-09-10", 2500, { currency: "EUR" }), // other currency kept out
    { customerRef: "a", occurredAt: d("2026-09-05"), amountMinor: 2500, refundedMinor: 0, kind: "refund", currency: "USD" } as CohortPayment,
  ];
  const rows = computeCohorts(payments, { currency: "USD", nowMs: d("2026-09-20"), maxMonths: 4 });

  it("groups by first paid month and measures retention per month offset", () => {
    const done = computeCohorts(payments, { currency: "USD", nowMs: d("2026-10-02"), maxMonths: 4 });
    expect(done.map((r) => r.cohort)).toEqual(["2026-07", "2026-08"]);
    const july = done[0];
    expect(july.size).toBe(3);
    expect(july.activeCustomers).toEqual([3, 2, 1, null]);
    expect(july.retention[1]).toBeCloseTo(2 / 3, 9);
    expect(july.revenueMinor).toEqual([7500, 5000, 0, null]);
    expect(done[1].activeCustomers).toEqual([1, 1, null, null]);
  });

  it("never shows an unfinished month as churn", () => {
    // 20 Sep: September is still in progress, so it isn't reported for any cohort yet.
    expect(rows[0].activeCustomers).toEqual([3, 2, null, null]);
    expect(rows[1].size).toBe(1);
    expect(rows[1].activeCustomers).toEqual([1, null, null, null]);
  });

  it("keeps matching customer IDs from different billing sources in separate cohort members", () => {
    const result = computeCohorts([
      pay("same-id", "2026-07-05", 1_000, { source: "stripe" }),
      pay("same-id", "2026-07-06", 2_000, { source: "polar" }),
      pay("same-id", "2026-08-05", 1_000, { source: "stripe" }),
    ], { currency: "USD", nowMs: d("2026-09-02"), maxMonths: 3 });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ size: 2, activeCustomers: [2, 1, null], retention: [1, 0.5, null], revenueMinor: [3_000, 1_000, null] });
  });

  it("subtracts source- and order-matched refunds from cohort revenue without calling refunds retained activity", () => {
    const result = computeCohorts([
      pay("same-id", "2026-07-05", 10_000, { source: "stripe", orderRef: "order-1" }),
      { source: "stripe", orderRef: "order-1", occurredAt: d("2026-08-05"), amountMinor: 3_000, refundedMinor: 0, kind: "refund", currency: "USD" },
      pay("same-id", "2026-07-06", 20_000, { source: "polar", orderRef: "order-1" }),
      { source: "unknown-provider", orderRef: "order-1", occurredAt: d("2026-08-05"), amountMinor: 7_000, refundedMinor: 0, kind: "refund", currency: "USD" },
    ], { currency: "USD", nowMs: d("2026-09-02"), maxMonths: 3 });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ size: 2, activeCustomers: [2, 0, null], revenueMinor: [30_000, -3_000, null] });
  });

  it("formats payer cohorts as observed retention and leaves incomplete months unknown", () => {
    const done = computeCohorts(payments, { currency: "USD", nowMs: d("2026-10-02"), maxMonths: 4 });
    const brief = subscriptionCohortBrief(done, { currency: "USD", hasCustomerIds: true, truncated: true });
    expect(brief).toContain("2026-07: 3 first-paid customers; M1 2/3 (66.7%), M2 1/3 (33.3%), M3 incomplete");
    expect(brief).toContain("history is truncated to the latest 10,000 events");
    expect(brief).toContain("observed payer retention, not contractual churn, gross/net revenue retention, a forecast, or causal evidence");
    expect(brief).not.toContain("M3 0/3");
  });

  it("does not infer retention when billing customer IDs are missing", () => {
    expect(subscriptionCohortBrief([], { currency: "USD", hasCustomerIds: false, truncated: false })).toContain("billing events do not include customer IDs");
  });
});
