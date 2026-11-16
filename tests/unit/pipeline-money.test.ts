import { describe, expect, it } from "vitest";
import { DEAL_VALUE_VERSION, dealValueMinor, dealValueSummaryLabel, formatDealValue, summarizeDealValues } from "../../shared/growth/pipeline";

describe("recorded deal values", () => {
  it("keeps currency precision without rounding an offer or multiplying yen by 100", () => {
    expect(dealValueMinor(0.29, "USD")).toBe(29);
    expect(dealValueMinor(1200, "JPY")).toBe(1200);
    expect(dealValueMinor(12.345, "KWD")).toBe(12345);
    expect(formatDealValue(12345, "KWD")).toMatch(/12\.345/);
    expect(formatDealValue(1200, "JPY")).toMatch(/1,200/);
    expect(() => dealValueMinor(1.01, "JPY")).toThrow(/0 decimal places/);
  });
  it("keeps zero known, unknown missing, and currencies separate", () => {
    const values = summarizeDealValues([{ currency: "USD", valueMinor: 0 }, { currency: "USD" }, { currency: "KWD", valueMinor: 12345, valueVersion: DEAL_VALUE_VERSION }], "USD");
    expect(values.totalMinor).toBeNull();
    expect(values.byCurrency).toEqual([{ currency: "KWD", recordedMinor: 12345, known: 1, missing: 0, needsReview: 0 }, { currency: "USD", recordedMinor: 0, known: 1, missing: 1, needsReview: 0 }]);
    expect(dealValueSummaryLabel(values)).toContain("1 not recorded");
  });
  it("withholds invalid and unsafe totals without manufacturing zeros", () => {
    const values = summarizeDealValues([{ currency: "USD", valueMinor: Number.MAX_SAFE_INTEGER }, { currency: "USD", valueMinor: 100 }], "USD");
    expect(values).toMatchObject({ totalMinor: null, byCurrency: [{ recordedMinor: null, needsReview: 2 }] });
    expect(summarizeDealValues([{ currency: "JPY", valueMinor: 100000 }], "JPY").totalMinor).toBeNull();
    expect(summarizeDealValues([{ currency: "USD", valueMinor: 1.5 }], "USD").totalMinor).toBeNull();
  });
});
