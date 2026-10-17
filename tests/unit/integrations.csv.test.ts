import { describe, expect, it } from "vitest";
import { parseCsv, parseRevenueCsv } from "../../shared/integrations/csvRevenue";
import { decimalToMinor, minorToMicros } from "../../shared/integrations/currency";

const HEADER = "event_id,occurred_at,customer_id,order_id,currency,amount,refunded_amount,utm_source,utm_medium,utm_campaign";

describe("parseCsv (RFC 4180)", () => {
  it("handles quotes, escaped quotes, embedded commas/newlines and CRLF", () => {
    const res = parseCsv('a,b,c\r\n"x, y","he said ""hi""","line1\nline2"\r\n');
    expect(res).toEqual({ ok: true, records: [["a", "b", "c"], ["x, y", 'he said "hi"', "line1\nline2"]] });
  });
  it("strips BOM, skips blank lines, keeps empty fields", () => {
    const res = parseCsv("﻿a,b\n\n1,\n");
    expect(res).toEqual({ ok: true, records: [["a", "b"], ["1", ""]] });
  });
  it("rejects unterminated quotes and stray quotes", () => {
    expect(parseCsv('a\n"open').ok).toBe(false);
    expect(parseCsv('a\nab"c').ok).toBe(false);
    expect(parseCsv('a\n"x"y').ok).toBe(false);
  });
});

describe("currency conversion", () => {
  it("respects currency exponents", () => {
    expect(decimalToMinor("12.34", "USD")).toEqual({ ok: true, minor: 1234 });
    expect(decimalToMinor("12.5", "usd")).toEqual({ ok: true, minor: 1250 });
    expect(decimalToMinor("1500", "JPY")).toEqual({ ok: true, minor: 1500 });
    expect(decimalToMinor("1500.5", "JPY").ok).toBe(false);
    expect(decimalToMinor("1500.00", "JPY")).toEqual({ ok: true, minor: 1500 });
    expect(decimalToMinor("1.234", "KWD")).toEqual({ ok: true, minor: 1234 });
    expect(decimalToMinor("0.5", "BHD")).toEqual({ ok: true, minor: 500 });
    expect(decimalToMinor("1.001", "USD").ok).toBe(false);
    expect(decimalToMinor("$10", "USD").ok).toBe(false);
    expect(decimalToMinor("1,000.00", "USD").ok).toBe(false);
    expect(decimalToMinor("0.1", "USD")).toEqual({ ok: true, minor: 10 }); // no float error
  });
  it("converts minor units to Google Ads micros", () => {
    expect(minorToMicros(1234, "USD")).toBe(12_340_000);
    expect(minorToMicros(500, "JPY")).toBe(500_000_000);
    expect(minorToMicros(1234, "KWD")).toBe(1_234_000);
  });
});

describe("parseRevenueCsv", () => {
  it("parses valid rows with currency exponents and UTM fields", () => {
    const csv = [
      HEADER,
      'e1,2026-10-01T10:00:00Z,c1,o1,usd,"1,0",0,google,cpc,fall',
      "e2,2026-10-01T10:00:00+09:00,c2,o2,JPY,1500,500,,,",
      "e3,2026-10-02,c3,o3,KWD,1.234,0.234,newsletter,email,",
      'e4,2026-10-02T00:00:00.123Z,"Smith, J",o4,BHD,10.5,,,,',
    ].join("\n");
    const res = parseRevenueCsv(csv);
    // e1 has "1,0" which is not a plain decimal
    expect(res.errors).toEqual([expect.objectContaining({ row: 1, column: "amount" })]);
    expect(res.rows.map((r) => [r.event.sourceEventId, r.event.currency, r.event.amountMinor, r.event.refundedMinor])).toEqual([
      ["e2", "JPY", 1500, 500],
      ["e3", "KWD", 1234, 234],
      ["e4", "BHD", 10500, 0],
    ]);
    expect(res.rows[0]?.event.occurredAt).toBe(Date.parse("2026-10-01T01:00:00Z"));
    expect(res.rows[1]?.utm).toEqual({ source: "newsletter", medium: "email" });
    expect(res.rows[2]?.event.customerRef).toBe("Smith, J");
    expect(res.rows[0]?.event.source).toBe("csv");
    expect(res.rows[0]?.event.kind).toBe("order");
    expect(res.ok).toBe(false);
  });

  it("reports per-row errors without dropping good rows", () => {
    const csv = [
      HEADER,
      "e1,2026-10-01T10:00:00,c1,o1,USD,10,0,,,", // no timezone
      "e2,2026-02-30,c1,o1,USD,10,0,,,", // invalid date
      "e3,2026-10-01T10:00:00Z,c1,o1,US,10,0,,,", // bad currency
      "e4,2026-10-01T10:00:00Z,c1,o1,USD,-5,0,,,", // negative
      "e5,2026-10-01T10:00:00Z,c1,o1,USD,10,20,,,", // refund > amount
      ",2026-10-01T10:00:00Z,c1,o1,USD,10,0,,,", // missing id
      "e7,2026-10-01T10:00:00Z,c1,o1,USD,10", // short row
      "e8,2026-10-01T10:00:00Z,c1,o1,USD,10.00,1.50,,,",
    ].join("\n");
    const res = parseRevenueCsv(csv);
    expect(res.rows.map((r) => r.event.sourceEventId)).toEqual(["e8"]);
    expect(res.rows[0]?.event.refundedMinor).toBe(150);
    const byRow = new Map(res.errors.map((e) => [e.row, e.column]));
    expect(byRow.get(1)).toBe("occurred_at");
    expect(byRow.get(2)).toBe("occurred_at");
    expect(byRow.get(3)).toBe("currency");
    expect(byRow.get(4)).toBe("amount");
    expect(byRow.get(5)).toBe("refunded_amount");
    expect(byRow.get(6)).toBe("event_id");
    expect(res.errors.some((e) => e.row === 7)).toBe(true);
  });

  it("detects duplicate event_ids and keeps the first", () => {
    const csv = [HEADER, "dup,2026-10-01,c,o,USD,1,,,,", "dup,2026-10-02,c,o,USD,2,,,,", "x,2026-10-02,c,o,USD,3,,,,"].join("\n");
    const res = parseRevenueCsv(csv);
    expect(res.duplicateEventIds).toEqual(["dup"]);
    expect(res.rows.map((r) => r.event.amountMinor)).toEqual([100, 300]);
    expect(res.errors).toEqual([expect.objectContaining({ row: 2, column: "event_id" })]);
  });

  it("rejects files over the row cap and files missing required columns", () => {
    const rows = Array.from({ length: 6 }, (_, i) => `e${i},2026-10-01,c,o,USD,1,,,,`);
    const res = parseRevenueCsv([HEADER, ...rows].join("\n"), { maxRows: 5 });
    expect(res.ok).toBe(false);
    expect(res.fatal).toMatch(/more than 5 rows/);
    expect(res.rows).toEqual([]);
    expect(parseRevenueCsv([HEADER, ...rows.slice(0, 5)].join("\n"), { maxRows: 5 }).rows).toHaveLength(5);
    expect(parseRevenueCsv("event_id,amount\n1,2").fatal).toMatch(/occurred_at/);
    expect(parseRevenueCsv("").fatal).toBeDefined();
  });

  it("default cap is 50,000 rows", () => {
    const line = "e,2026-10-01,c,o,USD,1,,,,";
    const many = [HEADER, ...Array.from({ length: 50_001 }, (_, i) => line.replace(/^e/, `e${i}`))].join("\n");
    const res = parseRevenueCsv(many);
    expect(res.fatal).toMatch(/50,000/);
  });
});
