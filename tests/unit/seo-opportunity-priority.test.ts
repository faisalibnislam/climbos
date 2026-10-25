import { describe, expect, it } from "vitest";
import { prioritizeSearchOpportunities } from "../../shared/seo/opportunityPriority";

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
});
