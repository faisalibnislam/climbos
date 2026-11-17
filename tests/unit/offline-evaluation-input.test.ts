import { describe, expect, it, vi, afterEach } from "vitest";
import { offlineInput } from "../../bench/strategy-quality/offlineInput";
import { selectStrategyQualityCases } from "../../bench/strategy-quality/cases";
import { lintCampaignTiming } from "../../shared/agents/campaignTiming";
import { campaignTimingFixture, timingContextFixture } from "../fixtures/campaignTiming";

afterEach(() => vi.useRealTimers());

describe("offline strategy evaluation clock", () => {
  it("exports an explicit current evaluation clock without inventing geography or research freshness", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-12-01T00:30:00Z"));
    const item = selectStrategyQualityCases("livoform")[0];
    const input = offlineInput(item);
    expect(input.timingContext).toEqual({ today: "2026-12-01", timezone: "UTC", now: Date.now() });
    expect(input.task).toContain("current local date 2026-12-01");
    expect(input.task).toContain("not evidence of business or customer geography");
    expect(input.creativeRetrievalQuery).toBe([item.brief, ...item.facts].join("\n"));
    expect(input.facts).toEqual(item.facts);
    expect(input.businessWebsite).toBe(item.businessWebsite);
    expect(input.constraints?.horizonDays).toBe(90);
    expect(input.precomputedResearch).not.toHaveProperty("retrievedAt");
  });

  it("checks a saved dated campaign against the review clock rather than the legacy 1970 fallback", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-12-01T12:00:00Z"));
    const input = offlineInput(selectStrategyQualityCases("retail")[0]);
    const context = timingContextFixture({ today: input.timingContext?.today ?? "1970-01-01", now: input.timingContext?.now });
    expect(lintCampaignTiming(campaignTimingFixture, context))
      .toContainEqual(expect.objectContaining({ path: "timingAssessment.proposedWindow.startDate", message: "A proceed window cannot start before the current local date." }));
  });
});
