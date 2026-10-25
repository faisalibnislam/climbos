import { describe, expect, it } from "vitest";
import { prioritizeAiVisibilityGaps, prioritizeSearchOpportunities } from "../../shared/seo/opportunityPriority";

describe("search opportunity priority", () => {
  it("puts direct access blockers before content checks without claiming business impact", () => {
    const ranked = prioritizeSearchOpportunities([
      { id: "missing-title", level: "attention", title: "Missing title", evidence: "No document title was found.", nextStep: "Add a title." },
      { id: "page-noindex", level: "attention", title: "Noindex", evidence: "A noindex directive was observed.", nextStep: "Check the directive." },
      { id: "robots-unavailable", level: "check", title: "Robots unavailable", evidence: "The file could not be retrieved.", nextStep: "Check access." },
    ]);

    expect(ranked.map((item) => item.finding.id)).toEqual(["page-noindex", "robots-unavailable", "missing-title"]);
    expect(ranked[0]).toMatchObject({ priority: "check_first", effort: "unknown", evidenceQuality: "direct_observation", customerRelevance: "business_homepage_only", observedVisibility: "not_measured_by_this_check", businessValue: "unknown" });
    expect(ranked[1]?.evidenceQuality).toBe("incomplete_observation");
    expect(ranked[2]?.effort).toBe("small");
    expect(ranked.map((item) => item.priorityReason).join(" ")).not.toMatch(/will increase traffic|will improve rankings|will generate customers/i);
  });

  it("does not invent demand, value, or visibility when only technical checks are supplied", () => {
    const [item] = prioritizeSearchOpportunities([
      { id: "no-structured-data", level: "check", title: "No structured data", evidence: "No JSON-LD was detected.", nextStep: "Review whether markup applies." },
    ]);
    expect(item).toMatchObject({ customerRelevance: "business_homepage_only", observedVisibility: "not_measured_by_this_check", businessValue: "unknown", nextUsefulCheck: expect.stringContaining("do not add markup just to seek AI citations") });
  });

  it("puts repeated owner-observed gaps before a single sample and links only exact Search Console phrases", () => {
    const opportunities = prioritizeAiVisibilityGaps({
      website: "https://example.com",
      observations: [
        { provider: "chatgpt", query: "Best accounting help for freelancers?", location: "Dhaka", checkedAt: 100, answerStatus: "answered", brandMention: "no", citedUrls: ["https://other.example/review"] },
        { provider: "chatgpt", query: "Best accounting help for freelancers?", location: "Dhaka", checkedAt: 200, answerStatus: "answered", brandMention: "no", citedUrls: ["https://other.example/review"] },
        { provider: "perplexity", query: "Tax help for new businesses", checkedAt: 300, answerStatus: "answered", brandMention: "no", citedUrls: [] },
        { provider: "chatgpt", query: "Bookkeeping tips", checkedAt: 400, answerStatus: "answered", brandMention: "no", citedUrls: [] },
      ],
      searchQueries: [
        { query: "best accounting help for freelancers?", page: "https://example.com/accounting", clicks: 3, impressions: 12 },
        { query: "BEST ACCOUNTING HELP FOR FREELANCERS?", page: "https://example.com/services", clicks: 2, impressions: 30 },
      ],
    });

    expect(opportunities.map((item) => item.query)).toEqual(["Best accounting help for freelancers?", "Bookkeeping tips", "Tax help for new businesses"]);
    expect(opportunities[0]).toMatchObject({ priority: "investigate_repeated_gap", answerSamples: 2, knownMentionSamples: 2, observedNoMention: 2, citationSamples: 2, observedNoOwnCitation: 2, exactSearchConsoleMatch: { page: "https://example.com/services", impressions: 30 }, businessValue: "unknown", effort: "unknown_until_target_page_is_reviewed" });
    expect(opportunities[1]?.priority).toBe("recheck_single_gap");
    expect(opportunities[2]?.priority).toBe("recheck_single_gap");
    expect(opportunities[2]?.exactSearchConsoleMatch).toBeNull();
  });

  it("does not treat failed, unanswered, unknown, or unrecorded citation results as negative visibility evidence", () => {
    const opportunities = prioritizeAiVisibilityGaps({
      website: "https://example.com",
      observations: [
        { provider: "chatgpt", query: "A question", checkedAt: 1, answerStatus: "failed", brandMention: "unknown", citedUrls: [] },
        { provider: "chatgpt", query: "B question", checkedAt: 2, answerStatus: "no_answer", brandMention: "unknown", citedUrls: [] },
        { provider: "chatgpt", query: "C question", checkedAt: 3, answerStatus: "answered", brandMention: "unknown", citedUrls: [] },
        { provider: "chatgpt", query: "D question", checkedAt: 4, answerStatus: "answered", brandMention: "yes", citedUrls: [] },
        { provider: "chatgpt", query: "E question", checkedAt: 5, answerStatus: "answered", brandMention: "yes", citedUrls: ["https://www.example.com/article"] },
      ],
    });
    expect(opportunities).toEqual([]);
  });
});
