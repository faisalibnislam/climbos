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
  it("rejects impossible research chronology while retaining legacy observations", () => {
    const evidence = brief("2026-10-20");
    const withTime = (retrievedAt: number) => ({ ...evidence, trendEvidence: { ...evidence.trendEvidence, retrievedAt } });
    expect(trendFreshnessIssue(withTime(Date.parse("2026-10-20T10:00:00Z")), now)).toBeNull();
    for (const retrievedAt of [now + 1, now - 86_400_000, Number.NaN, 1e20]) {
      expect(trendFreshnessIssue(withTime(retrievedAt), now)).toMatch(/retrieval time/);
    }
  });

  it("does not relabel legacy or evergreen drafts as trend-based", () => {
    expect(trendFreshnessIssue(undefined, now)).toBeNull();
    expect(trendFreshnessIssue({ supportingSourceUrls: [] }, now)).toBeNull();
  });
});
