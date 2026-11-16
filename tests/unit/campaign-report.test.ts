import { describe, expect, it } from "vitest";
import { aggregateGoogleCampaignMetrics, campaignReportWindow } from "../../shared/acquisition/campaignReport";
import { aggregateMetaCampaignInsights } from "../../shared/acquisition/metaCampaignInsights";
import { collectPages, reportedNumber } from "../../shared/integrations/http";
import { parseCampaignMetricsRow } from "../../shared/integrations/googleAds";
import { parseInsightRow } from "../../shared/integrations/metaAds";

const input = { campaignId: "42", currency: "USD", startDate: "2026-11-01", endDate: "2026-11-14" };
const row = { campaignId: "42", campaignName: "Example", date: "2026-11-14", costMicros: 1230000, clicks: 4, impressions: 100, conversions: 2, conversionsValue: 10 };
describe("campaign report evidence", () => {
  it("labels a repeated page cursor as incomplete", async () => {
    const result = await collectPages(async () => ({ ok: true as const, data: { items: [1], nextCursor: "same" } }));
    expect(result).toMatchObject({ ok: true, data: { truncated: true, pages: 2 } });
  });
  it.each([null, undefined])("preserves a missing reported value %s", value => { expect(reportedNumber(value)).toBeUndefined(); });
  it.each(["", " ", true, "1,000", "1e3", "Infinity"])("does not normalize malformed numeric value %s to zero", value => { expect(reportedNumber(value)).toBeNaN(); });
  it("distinguishes explicit zero and absent fields in adapters", () => {
    expect(parseCampaignMetricsRow({ metrics: { costMicros: "0", clicks: "0", impressions: "0" } })).toMatchObject({ costMicros: 0, conversions: undefined });
    expect(parseCampaignMetricsRow({ metrics: {} }).costMicros).toBeNaN();
    expect(parseInsightRow({}).spend).toBeNaN();
    expect(parseInsightRow({}).actions).toBeUndefined();
  });
  it.each([
    { date: "2026-11-31" }, { date: "2026-11-15" }, { campaignId: "99" },
    { costMicros: -1 }, { clicks: 1.5 }, { impressions: Infinity }, { conversions: NaN },
  ])("rejects unsupported daily evidence %j", change => {
    expect(() => aggregateGoogleCampaignMetrics({ ...input, rows: [{ ...row, ...change }] })).toThrow();
  });
  it("rejects unsafe accumulation before rounding", () => {
    expect(() => aggregateGoogleCampaignMetrics({ ...input, rows: [{ ...row, costMicros: Number.MAX_SAFE_INTEGER }, { ...row, date: "2026-11-13", costMicros: Number.MAX_SAFE_INTEGER }] })).toThrow(/large|safely/);
  });
  it("rounds the summed Google micros once, not each daily cost", () => {
    const totals = aggregateGoogleCampaignMetrics({ ...input, rows: [{ ...row, costMicros: 6000 }, { ...row, date: "2026-11-13", costMicros: 6000 }] });
    expect(totals.spendMinor).toBe(1);
  });
  it("withholds the optional conversion total when any row is missing it", () => {
    expect(aggregateGoogleCampaignMetrics({ ...input, rows: [row, { ...row, date: "2026-11-13", conversions: undefined }] }).conversions).toBeUndefined();
  });
  it("does not infer complete Meta action totals from a day with missing actions", () => {
    const meta = { ...row, spend: 1, currency: "USD", actions: [{ actionType: "lead", value: 2 }] };
    expect(aggregateMetaCampaignInsights({ ...input, rows: [meta, { ...meta, date: "2026-11-13", actions: undefined }] }).reportedActions).toBeUndefined();
  });
  it("preserves Meta decimal text through minor-unit arithmetic", () => {
    const meta = parseInsightRow({ campaign_id: "42", date_start: "2026-11-14", spend: "90071992547409.91", account_currency: "USD", clicks: "0", impressions: "0" });
    expect(aggregateMetaCampaignInsights({ ...input, rows: [meta] }).spendMinor).toBe(Number.MAX_SAFE_INTEGER);
  });
  it("keeps DST-local completed dates and bounds the report to 90 days", () => {
    expect(campaignReportWindow({ startDate: "2026-01-01" }, "America/New_York", Date.parse("2026-11-02T04:30:00Z"))).toEqual({ startDate: "2026-08-03", endDate: "2026-10-31" });
  });
});
