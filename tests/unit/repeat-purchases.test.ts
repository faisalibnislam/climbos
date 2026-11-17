import { describe, expect, it } from "vitest";
import { repeatPurchaseBrief, repeatPurchaseSummary, type CohortPayment } from "../../shared/attribution/cohorts";

const DAY = 86_400_000;
const now = Date.UTC(2026, 9, 25);
const order = (customerRef: string | undefined, daysAgo: number, o: Partial<CohortPayment> = {}): CohortPayment => ({ source: "stripe", sourceEventId: `${customerRef}-${daysAgo}`, customerRef, orderRef: `${customerRef}-${daysAgo}`, occurredAt: now - daysAgo * DAY, amountMinor: 5_000, refundedMinor: 0, kind: "order", currency: "USD", ...o });

describe("repeat purchases for one-off orders", () => {
  it("counts only customers whose whole window has passed, and distinct second orders", () => {
    const s = repeatPurchaseSummary([
      order("a", 200), order("a", 180), // reordered after 20 days
      order("b", 150), order("b", 60), // reordered after 90 days
      order("c", 120), // never reordered
      order("d", 40), order("d", 35), // reordered, but only 40 days old: not eligible for 60/90
      order("e", 100, { orderRef: "same" }), order("e", 99, { orderRef: "same" }), // two rows of one order
    ], { currency: "USD", nowMs: now });
    expect(s.customers).toBe(5);
    expect(s.windows).toEqual([
      { days: 30, eligible: 5, repeated: 2, rate: 2 / 5 },
      { days: 60, eligible: 4, repeated: 1, rate: 1 / 4 },
      { days: 90, eligible: 4, repeated: 2, rate: 2 / 4 },
    ]);
    expect(s.reorderedCustomers).toBe(3);
    expect(s.medianDaysToSecond).toBe(20);
  });

  it("excludes other currencies, subscriptions, refunds, and fully refunded orders; keeps provider namespaces apart", () => {
    const s = repeatPurchaseSummary([
      order("a", 200), order("a", 190, { currency: "EUR" }), order("a", 185, { kind: "subscription_payment" }), order("a", 180, { refundedMinor: 5_000 }), order("a", 170, { kind: "refund", orderRef: "a-185" }),
      order("a", 150, { source: "csv" }),
    ], { currency: "USD", nowMs: now });
    expect(s.customers).toBe(2);
    expect(s.reorderedCustomers).toBe(0);
  });

  it("says repeat purchases are unknown without customer IDs and never prints IDs", () => {
    const none = repeatPurchaseSummary([order(undefined, 100), order(undefined, 50)], { currency: "USD", nowMs: now });
    expect(repeatPurchaseBrief(none, { truncated: false })).toContain("do not include customer IDs");
    expect(repeatPurchaseBrief(repeatPurchaseSummary([], { currency: "USD", nowMs: now }), { truncated: false })).toBe("");

    const text = repeatPurchaseBrief(repeatPurchaseSummary([order("cus_secret_123", 200), order("cus_secret_123", 180), order(undefined, 10)], { currency: "USD", nowMs: now }), { truncated: true });
    expect(text).toContain("within 30 days 1/1 (100.0%, small sample)");
    expect(text).toContain("1 orders without a customer ID excluded");
    expect(text).toContain("truncated to the latest 10,000 events");
    expect(text).toContain("not necessarily the customer's first ever");
    expect(text).not.toContain("cus_secret_123");
  });
});

it("excludes a second order fully refunded through a separate event", () => {
  const rows = [order("a", 200), order("a", 180), order("a", 170, { kind: "refund", orderRef: "a-180" })];
  const result = repeatPurchaseSummary(rows, { currency: "USD", nowMs: now });
  expect(result).toMatchObject({ customers: 1, reorderedCustomers: 0, medianDaysToSecond: null });
  expect(result.windows[0]).toMatchObject({ eligible: 1, repeated: 0, rate: 0 });
});
it("combines partial captures and refunds once per identified order", () => {
  const rows = [order("a", 200), order("a", 180, { amountMinor: 3000 }), order("a", 179, { orderRef: "a-180", amountMinor: 2000 }), order("a", 170, { kind: "refund", orderRef: "a-180", amountMinor: 4000 })];
  const result = repeatPurchaseSummary([...rows, rows[2]], { currency: "USD", nowMs: now });
  expect(result).toMatchObject({ reorderedCustomers: 1, medianDaysToSecond: 20, issue: null });
});
it.each([
  ["unmatched refund", [order("a", 200), order("a", 180), order("a", 170, { kind: "refund", orderRef: undefined })]],
  ["conflicting customer", [order("a", 200), order("b", 180, { orderRef: "a-200" })]],
  ["missing order identity", [order("a", 200), order("a", 180, { orderRef: undefined })]],
  ["missing event identity", [order("a", 200, { sourceEventId: undefined })]],
])("keeps repeat purchase unknown for %s", (_label, rows) => {
  const result = repeatPurchaseSummary(rows, { currency: "USD", nowMs: now });
  expect(result.issue).toBeTruthy();
  expect(result.windows).toEqual([]);
  expect(repeatPurchaseBrief(result, { truncated: false })).toContain("unavailable");
});
it("does not count future orders as observed repurchases", () => {
  expect(repeatPurchaseSummary([order("a", 10), order("a", -1)], { currency: "USD", nowMs: now })).toMatchObject({ customers: 1, reorderedCustomers: 0, medianDaysToSecond: null });
});

it.each([
  ["conflicting event copies", [order("a", 200), order("a", 200, { amountMinor: 4000 })]],
  ["refund customer conflict", [order("a", 200), order("b", 190, { kind: "refund", orderRef: "a-200" })]],
  ["refund before charge", [order("a", 200), order("a", 210, { kind: "refund", orderRef: "a-200" })]],
  ["excessive refund", [order("a", 200), order("a", 190, { kind: "refund", orderRef: "a-200", amountMinor: 5001 })]],
  ["unsafe partial captures", [order("a", 200, { amountMinor: Number.MAX_SAFE_INTEGER }), order("a", 199, { orderRef: "a-200", amountMinor: 1 })]],
])("withholds rates for %s", (_label, rows) => {
  const result = repeatPurchaseSummary(rows, { currency: "USD", nowMs: now });
  expect(result.issue).toBeTruthy();
  expect(result.windows).toEqual([]);
});
it("excludes a fully refunded first order without inventing a prior positive purchase", () => {
  const result = repeatPurchaseSummary([order("a", 200), order("a", 180), order("a", 170, { kind: "refund", orderRef: "a-200" })], { currency: "USD", nowMs: now });
  expect(result).toMatchObject({ customers: 1, reorderedCustomers: 0, historyFrom: now - 180 * DAY });
});
