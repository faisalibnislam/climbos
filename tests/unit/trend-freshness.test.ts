import { describe, expect, it } from "vitest";
import { trendFreshnessIssue } from "../../shared/agents/trendFreshness";

const now = Date.parse("2026-10-20T23:59:00Z");
const brief = (observationDate: string) => ({
  supportingSourceUrls: ["https://example.com/trend"],
  trendEvidence: { sourceUrl: "https://example.com/trend", observationDate, observation: "Source-reported example" },
});

describe("saved trend freshness", () => {
  it("accepts the 30th UTC day but rejects the 31st and later schedules", () => {
    expect(trendFreshnessIssue(brief("2026-09-20"), now)).toBeNull();
    expect(trendFreshnessIssue(brief("2026-09-19"), now)).toMatch(/30-day/);
    expect(trendFreshnessIssue(brief("2026-09-20"), now, now + 86_400_000)).toMatch(/30-day/);
  });
  it("rejects future and impossible dates and detached or empty evidence", () => {
    expect(trendFreshnessIssue(brief("2026-10-21"), now)).toMatch(/future/);
    expect(trendFreshnessIssue(brief("2026-02-30"), now)).toMatch(/invalid/);
    expect(trendFreshnessIssue({ ...brief("2026-10-20"), supportingSourceUrls: [] }, now)).toMatch(/source/);
    const empty = brief("2026-10-20"); empty.trendEvidence.observation = " ";
    expect(trendFreshnessIssue(empty, now)).toMatch(/source/);
  });
  it("does not relabel legacy or evergreen drafts as trend-based", () => {
    expect(trendFreshnessIssue(undefined, now)).toBeNull();
    expect(trendFreshnessIssue({ supportingSourceUrls: [] }, now)).toBeNull();
  });
});
