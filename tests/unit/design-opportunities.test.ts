import { describe, expect, it } from "vitest";
import { designOpportunityRows, groupDesignOpportunities, opportunityPageUrl } from "../../shared/agents/designOpportunities";

function rows(runId: string, auditedAt: number, patch = {}) {
  return designOpportunityRows({ runId, auditedAt, output: JSON.stringify({ designCritic: { findings: [{ lens: "usability", region: "Contact form", sourceUrl: "https://example.com/contact", observation: "Missing field label", evidence: "Input has no associated label", classification: "automated_check", confidence: "high", automatedCheckIds: ["label"], visualEvidence: { view: "mobile" }, directions: [{ name: "Label the input", responseLevel: "quick_fix", effort: "Ask the page maintainer", assumptions: ["Editable template"] }, { name: "Conversation-led inquiry", responseLevel: "bold_alternative", effort: "unknown" }], ...patch }] } }) }, []).findings;
}

describe("design opportunity grouping", () => {
  it("groups related page areas without inflating repeated checks or increasing confidence", () => {
    const older = rows("old", 1);
    const newer = rows("new", 2, { observation: "The form still lacks a label", confidence: "low" });
    const otherPage = rows("other", 3, { sourceUrl: "https://example.com/booking" });
    const groups = groupDesignOpportunities([...older, ...newer, ...otherPage, ...newer]);
    expect(groups).toHaveLength(1);
    expect(groups[0].items).toHaveLength(2);
    const repeated = groups[0].items.find(item => item.latest.runId === "new")!;
    expect(repeated.latest.confidence).toBe("low");
    expect(repeated.history.map(row => row.runId)).toEqual(["old"]);
    expect(repeated.latest.directions.map(d => d.responseLevel)).toContain("bold_alternative");
  });

  it("preserves viewport, page-variant and different observation distinctions", () => {
    const groups = groupDesignOpportunities([
      ...rows("one", 1), ...rows("desktop", 2, { visualEvidence: { view: "desktop" } }),
      ...rows("variant", 3, { sourceUrl: "https://example.com/contact?variant=b" }),
      ...rows("case", 4, { sourceUrl: "https://example.com/Contact" }),
      ...rows("other-check", 5, { automatedCheckIds: ["contrast"] }),
      ...rows("judgment", 6, { classification: "expert_judgment", observation: "The form asks too much" }),
    ]);
    expect(groups[0].items).toHaveLength(6);
    expect(opportunityPageUrl("https://example.com/contact#/form")).toBe("https://example.com/contact#/form");
  });

  it("keeps malformed and incomplete evidence honest and never links unsafe URLs", () => {
    expect(designOpportunityRows({ runId: "bad", auditedAt: 1, output: "{" }, []).unavailable).toBe(true);
    const parsed = designOpportunityRows({ runId: "partial", auditedAt: 1, output: JSON.stringify({ designCritic: { findings: [null, { observation: "Unknown source", sourceUrl: "javascript:alert(1)", directions: [null] }] } }) }, []);
    expect(parsed.unavailable).toBe(true);
    expect(parsed.findings[0]).toMatchObject({ findingIndex: 1, sourceUrl: null, capturedAt: null, confidence: "", relevance: "" });
    expect(opportunityPageUrl("https://user:secret@example.com/")).toBeNull();
    expect(groupDesignOpportunities([...rows("a", 1, { sourceUrl: null }), ...rows("b", 2, { sourceUrl: null })])[0].items).toHaveLength(2);
  });

  it("retains each exact finding decision without silently applying it to a newer audit", () => {
    const old = rows("old", 1)[0];
    old.review = { findingIndex: 0, status: "resolved", note: "Fixed this version", updatedAt: 3 };
    const group = groupDesignOpportunities([old, ...rows("new", 4)])[0];
    expect(group.items[0].latest.review).toBeUndefined();
    expect(group.items[0].history[0].review?.note).toBe("Fixed this version");
  });

  it("uses capture time only for a matching reviewed page and supplied viewport", () => {
    const parse = (pageUrl: string, view: string) => designOpportunityRows({ runId: "capture", auditedAt: 2, output: JSON.stringify({ auditCoverage: { website: { visualReview: { state: "reviewed", pageUrl: "https://example.com/", views: ["mobile"], capturedAt: 1 } } }, designCritic: { findings: [{ observation: "A saved observation", sourceUrl: pageUrl, visualEvidence: { view } }] } }) }, []).findings[0];
    expect(parse("https://example.com/", "mobile").capturedAt).toBe(1);
    expect(parse("https://example.com/pricing", "mobile").capturedAt).toBeNull();
    expect(parse("https://example.com/", "desktop").capturedAt).toBeNull();
  });
});
