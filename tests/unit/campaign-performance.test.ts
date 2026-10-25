import { describe, expect, it } from "vitest";
import { reviewCampaignPerformance } from "../../shared/acquisition/campaignPerformance";
import { aggregateMetaCampaignInsights } from "../../shared/acquisition/metaCampaignInsights";
import type { MetaInsightRow } from "../../shared/integrations/metaAds";

const base = {
  campaignStartDate: "2026-10-01",
  observedThrough: "2026-10-07",
  reviewAfterDays: 7,
  spendMinor: 5000,
  conversions: 5,
  targetCostPerConversionMinor: 1200,
};

describe("reviewCampaignPerformance", () => {
  it("waits until the owner-defined review window", () => {
    expect(reviewCampaignPerformance({ ...base, observedThrough: "2026-10-06" }).status).toBe("not_due");
  });

  it("does not invent an efficiency target", () => {
    expect(reviewCampaignPerformance({ ...base, targetCostPerConversionMinor: undefined })).toEqual({
      status: "target_needed",
      message: "Results are available, but there is no owner-set cost-per-conversion target to judge them against.",
    });
  });

  it("recommends review when spend reaches the owner limit without reported conversions", () => {
    expect(reviewCampaignPerformance({ ...base, spendMinor: 1200, conversions: 0 })).toMatchObject({ status: "review", observedCostPerConversionMinor: null });
  });

  it("recommends review when observed cost per conversion exceeds the owner target", () => {
    expect(reviewCampaignPerformance({ ...base, spendMinor: 7000, conversions: 5 }).status).toBe("review");
  });

  it("describes in-target results as a platform signal rather than business profit", () => {
    const result = reviewCampaignPerformance(base);
    expect(result.status).toBe("within_target");
    expect(result.message).toContain("not proof of incremental customers or profit");
  });

  it("rejects invalid inputs rather than silently making a recommendation", () => {
    expect(() => reviewCampaignPerformance({ ...base, conversions: -1 })).toThrow("inputs are invalid");
  });
});

describe("aggregateMetaCampaignInsights", () => {
  const rows: MetaInsightRow[] = [
    { date: "2026-10-01", campaignId: "42", campaignName: "Campaign", spend: 1.25, impressions: 100, clicks: 4, currency: "USD", actions: [{ actionType: "link_click", value: 4 }, { actionType: "lead", value: 1 }] },
    { date: "2026-10-02", campaignId: "42", campaignName: "Campaign", spend: 2, impressions: 200, clicks: 5, currency: "USD", actions: [{ actionType: "link_click", value: 5 }] },
    { date: "2026-10-02", campaignId: "99", campaignName: "Other", spend: 100, impressions: 1000, clicks: 80, currency: "USD", actions: [] },
  ];

  it("sums only the selected campaign and keeps unlike Meta actions separate", () => {
    expect(aggregateMetaCampaignInsights({ rows, campaignId: "42", startDate: "2026-10-01", endDate: "2026-10-02", currency: "USD" })).toEqual({
      spendMinor: 325,
      impressions: 300,
      clicks: 9,
      reportedActions: [{ actionType: "lead", value: 1 }, { actionType: "link_click", value: 9 }],
    });
  });

  it("does not accept missing, conflicting, or unmatched currency data", () => {
    expect(() => aggregateMetaCampaignInsights({ rows, campaignId: "42", startDate: "2026-10-01", endDate: "2026-10-02", currency: "EUR" })).toThrow(/currency/i);
    expect(() => aggregateMetaCampaignInsights({ rows: rows.map((r) => ({ ...r, currency: undefined })), campaignId: "42", startDate: "2026-10-01", endDate: "2026-10-02", currency: "USD" })).toThrow(/currency/i);
  });

  it("keeps an empty report unknown instead of treating it as zero activity", () => {
    expect(() => aggregateMetaCampaignInsights({ rows, campaignId: "42", startDate: "2026-10-03", endDate: "2026-10-04", currency: "USD" })).toThrow(/no daily rows/i);
  });
});
