import { describe, expect, it } from "vitest";
import { googleMonitorSpend, metaMonitorSpend, spendMonitorWindow } from "../../shared/acquisition/spendMonitor";

const window = { campaignId: "42", startDate: "2026-11-01", endDate: "2026-11-15", currency: "USD", truncated: false };
const google = (costMicros = 1230000) => ({ campaignId: "42", campaignName: "Example", date: "2026-11-15", costMicros, impressions: 0, clicks: 0 });
const meta = (spendDecimal = "1.23") => ({ campaignId: "42", campaignName: "Example", date: "2026-11-15", spend: Number(spendDecimal), spendDecimal, currency: "USD", impressions: 0, clicks: 0 });
describe("spend monitor evidence and arithmetic", () => {
  it("includes the account-local partial day, not a guessed workspace day", () => {
    expect(spendMonitorWindow("2026-11-01", "Pacific/Honolulu", Date.parse("2026-11-16T01:00Z"))).toEqual({ startDate: "2026-11-01", endDate: "2026-11-15" });
    expect(() => spendMonitorWindow("2026-11-01", "", Date.now())).toThrow(/timezone/);
    expect(() => spendMonitorWindow("2026-11-01", "unknown", Date.now())).toThrow(/timezone/);
    expect(() => spendMonitorWindow("2026-11-17", "UTC", Date.parse("2026-11-16T01:00Z"))).toThrow(/future/);
    expect(() => spendMonitorWindow("2026-01-01", "UTC", Date.parse("2026-11-16T01:00Z"))).toThrow(/90-day/);
  });
  it.each([["USD", 1239999, 123], ["JPY", 1999999, 1], ["KWD", 1234999, 1234]] as const)("floors summed Google micros at %s currency precision", (currency, micros, result) => {
    expect(googleMonitorSpend({ ...window, currency, rows: [google(micros)] })).toBe(result);
    expect(googleMonitorSpend({ ...window, currency, rows: [google(500), { ...google(500), date: "2026-11-14" }] })).toBe(currency === "KWD" ? 1 : 0);
  });
  it.each([["JPY", "123", 123], ["KWD", "1.234", 1234], ["USD", "1.23", 123]] as const)("keeps Meta %s decimal spend exact", (currency, decimal, minor) => {
    expect(metaMonitorSpend({ ...window, currency, rows: [{ ...meta(decimal), currency }] })).toBe(minor);
  });
  it("rejects missing/duplicate/out-of-window/foreign/unsafe Google evidence", () => {
    for (const rows of [[], [google(), google()], [{ ...google(), date: "2026-11-16" }], [{ ...google(), campaignId: "99" }], [google(NaN)], [google(-1)], [google(Number.MAX_SAFE_INTEGER), { ...google(1), date: "2026-11-14" }]]) expect(() => googleMonitorSpend({ ...window, rows })).toThrow();
    expect(() => googleMonitorSpend({ ...window, rows: [google()], truncated: true })).toThrow(/incomplete/);
  });
  it("rejects unknown Meta identity, currency, precision, and incomplete reports", () => {
    for (const rows of [[], [meta(), meta()], [{ ...meta(), campaignId: "" }], [{ ...meta(), currency: undefined }], [{ ...meta(), currency: "EUR" }], [meta("1.234")], [meta("-1")], [meta("NaN")]]) expect(() => metaMonitorSpend({ ...window, rows })).toThrow();
    expect(() => metaMonitorSpend({ ...window, rows: [meta()], truncated: true })).toThrow(/incomplete/);
    expect(metaMonitorSpend({ ...window, rows: [meta(), { ...meta("999"), campaignId: "99" }] })).toBe(123);
  });
});
