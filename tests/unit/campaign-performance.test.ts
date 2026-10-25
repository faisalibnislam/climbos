import { describe, expect, it } from "vitest";
import { reviewCampaignPerformance } from "../../shared/acquisition/campaignPerformance";

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
