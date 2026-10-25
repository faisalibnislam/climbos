import { describe, expect, it } from "vitest";
import { recommendationGuidance } from "../../shared/acquisition/recommendationGroups";

describe("platform recommendation purpose groups", () => {
  it("keeps reviews and comparison distinct from launch and content channels", () => {
    expect(recommendationGuidance("M11")?.group).toBe("review_comparison");
    expect(recommendationGuidance("M26")?.group).toBe("review_comparison");
    expect(recommendationGuidance("M10")?.group).toBe("launch_feedback");
    expect(recommendationGuidance("C01")?.group).toBe("content_community");
    expect(recommendationGuidance("N01")?.group).toBe("content_community");
    expect(recommendationGuidance("C26")?.group).toBe("content_community");
  });

  it("does not treat votes, comments, ratings, or impressions as customer outcomes", () => {
    expect(recommendationGuidance("M10")?.measurement).toContain("Votes, rank, and comments are not customer");
    expect(recommendationGuidance("M11")?.measurement).toContain("Ratings and review counts alone are not customer");
    expect(recommendationGuidance("N01")?.measurement).toContain("Impressions, votes, and comments are not customer");
  });

  it("does not invent a platform purpose for unclassified channels", () => {
    expect(recommendationGuidance("P01")).toBeNull();
  });
});
