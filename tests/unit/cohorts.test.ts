import { describe, expect, it } from "vitest";
import { computeCohorts, subscriptionCohortBrief, type CohortPayment } from "../../shared/attribution";

const d = (s: string) => Date.parse(`${s}T12:00:00Z`);
const pay = (customerRef: string, date: string, amountMinor = 2500, extra: Partial<CohortPayment> = {}): CohortPayment => ({ source: "test", sourceEventId: `${customerRef}:${date}`, customerRef, occurredAt: d(date), amountMinor, refundedMinor: 0, kind: "subscription_payment", currency: "USD", ...extra });

describe("monthly cohorts", () => {
  const payments = [
    pay("a", "2026-07-03"), pay("a", "2026-08-03"), pay("a", "2026-09-03"),
    pay("b", "2026-07-20"), pay("b", "2026-08-20"),
    pay("c", "2026-07-25"),
    pay("d", "2026-08-01"), pay("d", "2026-09-01"),
    pay("e", "2026-08-15", 2500, { refundedMinor: 2500 }), // a recorded charge even after a full refund
    pay("f", "2026-09-10", 2500, { currency: "EUR" }), // other currency kept out
    { source: "test", sourceEventId: "refund-a", customerRef: "a", occurredAt: d("2026-09-05"), amountMinor: 2500, refundedMinor: 0, kind: "refund", currency: "USD" } as CohortPayment,
  ];
  const rows = computeCohorts(payments, { currency: "USD", nowMs: d("2026-09-20"), maxMonths: 4 }).rows;

  it("groups by first paid month and measures retention per month offset", () => {
    const done = computeCohorts(payments, { currency: "USD", nowMs: d("2026-10-02"), maxMonths: 4 }).rows;
    expect(done.map((r) => r.cohort)).toEqual(["2026-07", "2026-08"]);
    const july = done[0];
    expect(july.size).toBe(3);
    expect(july.activeCustomers).toEqual([3, 2, 1, null]);
    expect(july.retention[1]).toBeCloseTo(2 / 3, 9);
    expect(july.revenueMinor).toEqual([7500, 5000, 0, null]);
    expect(done[1].activeCustomers).toEqual([2, 1, null, null]);
  });

  it("never shows an unfinished month as churn", () => {
    // 20 Sep: September is still in progress, so it isn't reported for any cohort yet.
    expect(rows[0].activeCustomers).toEqual([3, 2, null, null]);
    expect(rows[1].size).toBe(2);
    expect(rows[1].activeCustomers).toEqual([2, null, null, null]);
  });

  it("keeps matching customer IDs from different billing sources in separate cohort members", () => {
    const result = computeCohorts([
      pay("same-id", "2026-07-05", 1_000, { source: "stripe" }),
      pay("same-id", "2026-07-06", 2_000, { source: "polar" }),
      pay("same-id", "2026-08-05", 1_000, { source: "stripe" }),
    ], { currency: "USD", nowMs: d("2026-09-02"), maxMonths: 3 }).rows;

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ size: 2, activeCustomers: [2, 1, null], retention: [1, 0.5, null], revenueMinor: [3_000, 1_000, null] });
  });

  it("subtracts source- and order-matched refunds from cohort revenue without calling refunds retained activity", () => {
    const result = computeCohorts([
      pay("same-id", "2026-07-05", 10_000, { source: "stripe", orderRef: "order-1" }),
      { source: "stripe", sourceEventId: "refund-stripe", orderRef: "order-1", occurredAt: d("2026-08-05"), amountMinor: 3_000, refundedMinor: 0, kind: "refund", currency: "USD" },
      pay("same-id", "2026-07-06", 20_000, { source: "polar", orderRef: "order-1" }),
      { source: "unknown-provider", sourceEventId: "refund-unknown", orderRef: "order-1", occurredAt: d("2026-08-05"), amountMinor: 7_000, refundedMinor: 0, kind: "refund", currency: "USD" },
    ], { currency: "USD", nowMs: d("2026-09-02"), maxMonths: 3 }).rows;

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ size: 2, activeCustomers: [2, 0, null], revenueMinor: [30_000, -3_000, null] });
  });

  it("formats payer cohorts as observed retention and leaves incomplete months unknown", () => {
    const done = computeCohorts(payments, { currency: "USD", nowMs: d("2026-10-02"), maxMonths: 4 }).rows;
    const brief = subscriptionCohortBrief({ rows: done, issue: null }, { currency: "USD", hasCustomerIds: true });
    expect(brief).toContain("2026-07: 3 first-recorded subscription payers; M1 2/3 (66.7%), M2 1/3 (33.3%), M3 incomplete");
    expect(brief).toContain("Import completeness is unknown");
    expect(brief).toContain("observed payer retention, not contractual churn, gross/net revenue retention, a forecast, or causal evidence");
    expect(brief).not.toContain("M3 0/3");
  });

  it("does not infer retention when billing customer IDs are missing", () => {
    expect(subscriptionCohortBrief({ rows: [], issue: null }, { currency: "USD", hasCustomerIds: false })).toContain("billing events do not include customer IDs");
  });

  it("deduplicates identical events but rejects conflicting copies", () => {
    const first = pay("a", "2026-07-01");
    const options = { currency: "USD", nowMs: d("2026-09-02") };
    expect(computeCohorts([first, first], options).rows[0].revenueMinor[0]).toBe(2500);
    expect(computeCohorts([first, { ...first, refundedMinor: 1 }], options)).toMatchObject({ rows: [], issue: expect.stringContaining("conflicting") });
    expect(computeCohorts([first, { ...first, currency: "EUR" }], options)).toMatchObject({ rows: [], issue: expect.stringContaining("conflicting") });
  });

  it.each([
    { amountMinor: 1.5 }, { occurredAt: NaN }, { refundedMinor: -1 },
    { source: "" }, { sourceEventId: "" }, { amountMinor: -100 }, { refundedMinor: 2501 }, { kind: "refund" as const, refundedMinor: 1 },
  ])("withholds invalid evidence instead of silently assigning a later entry (%j)", (extra) => {
    expect(computeCohorts([pay("a", "2026-07-01", 2500, extra), pay("a", "2026-08-01")], { currency: "USD", nowMs: d("2026-09-02") })).toMatchObject({ rows: [], issue: expect.stringContaining("invalid") });
  });

  it("omits future charges and free orders without manufacturing cohort entry", () => {
    const result = computeCohorts([pay("a", "2026-06-01", 0), pay("a", "2026-07-01"), pay("b", "2026-10-01")], { currency: "USD", nowMs: d("2026-09-02"), maxMonths: 3 });
    expect(result).toMatchObject({ issue: null, rows: [{ cohort: "2026-07", size: 1, activeCustomers: [1, 0, null] }] });
  });

  it("does not turn capped history into percentages in the next strategy", () => {
    const result = computeCohorts([pay("a", "2026-07-01")], { currency: "USD", nowMs: d("2026-09-02"), truncated: true });
    const brief = subscriptionCohortBrief(result, { currency: "USD", hasCustomerIds: true });
    expect(result.rows).toEqual([]);
    expect(brief).toContain("read limit");
    expect(brief).not.toContain("%");
  });

  it("rejects ambiguous order owners rather than assigning a refund arbitrarily", () => {
    const result = computeCohorts([pay("a", "2026-07-01", 100, { orderRef: "same" }), pay("b", "2026-07-01", 100, { orderRef: "same" })], { currency: "USD", nowMs: d("2026-09-02") });
    expect(result).toMatchObject({ rows: [], issue: expect.stringContaining("conflicting customer identities") });
  });

  it("does not return unsafe accumulated revenue", () => {
    const result = computeCohorts([pay("a", "2026-07-01", Number.MAX_SAFE_INTEGER), pay("b", "2026-07-01")], { currency: "USD", nowMs: d("2026-09-02") });
    expect(result).toMatchObject({ rows: [], issue: expect.stringContaining("safe calculation limits") });
  });

  it("rejects a refund that names a different customer from its matched order", () => {
    const result = computeCohorts([pay("a", "2026-07-01", 100, { orderRef: "order" }), pay("b", "2026-08-01", 100, { orderRef: "order", kind: "refund" })], { currency: "USD", nowMs: d("2026-09-02") });
    expect(result).toMatchObject({ rows: [], issue: expect.stringContaining("identities conflict") });
  });
});
