import { describe, expect, it } from "vitest";
import { planAiSearchQueries } from "../../shared/aiSearch/queryPlanner";

describe("AI-search query planning from Search Console observations", () => {
  it("keeps exact observed wording, classifies explicit intent, and avoids summing page rows", () => {
    const suggestions = planAiSearchQueries([
      { query: "best payroll software", page: "https://example.com/a", clicks: 4, impressions: 60 },
      { query: " Best   Payroll Software ", page: "https://example.com/b", clicks: 8, impressions: 40 },
      { query: "how to run payroll", page: "https://example.com/guide", clicks: 3, impressions: 100 },
      { query: "payroll", page: "https://example.com/", clicks: 1, impressions: 20 },
    ]);

    expect(suggestions).toEqual([
      { query: "best payroll software", intent: "evaluation", highestPageImpressions: 60, highestPageClicks: 4, observedPageCount: 2 },
      { query: "how to run payroll", intent: "awareness", highestPageImpressions: 100, highestPageClicks: 3, observedPageCount: 1 },
      { query: "payroll", intent: "unclear", highestPageImpressions: 20, highestPageClicks: 1, observedPageCount: 1 },
    ]);
  });

  it("skips invalid rows and respects the result cap", () => {
    const rows = Array.from({ length: 20 }, (_, index) => ({
      query: `query ${index}`,
      page: "https://example.com/",
      clicks: index,
      impressions: index,
    }));
    rows.push({ query: "", page: "https://example.com/", clicks: 100, impressions: 100 });
    rows.push({ query: "bad count", page: "https://example.com/", clicks: -1, impressions: 10 });

    expect(planAiSearchQueries(rows, 5)).toHaveLength(5);
  });
});
