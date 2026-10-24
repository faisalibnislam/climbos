import { describe, expect, it } from "vitest";
import { CRITIC_RULES, OPERATING_RULES, RESEARCH_EVIDENCE_RULES } from "../../shared/agents/runtime";
import { playsTask } from "../../shared/agents/planTasks";
import { lintInsightSources, researchFor } from "../../shared/agents/specs";
import { businessResearchContext, factsBlock } from "../../shared/ai/tasks";

describe("research source assessment", () => {
  it("keeps published claims and owner reports from becoming proof of viability or demand", () => {
    const records = factsBlock([
      { statement: "The service is the most reliable in town", category: "proof", kind: "site says" },
      { statement: "Customers are ready to buy", category: "audience", kind: "owner report" },
    ]);
    expect(records).toContain('"site says" is a published claim');
    expect(records).toContain('"owner report" is not independent verification');
    expect(OPERATING_RULES).toContain("not that its offer works");
    expect(OPERATING_RULES).toContain("use numbers only when supplied");
    expect(CRITIC_RULES).toContain("a weak page alone is not proof that the underlying business is unviable");
    expect(CRITIC_RULES).not.toContain("Details stated in the brief (name, website, offers) are known facts");
  });

  it("asks research agents to assess provenance, freshness, fit, independence, and method without invented scores", () => {
    expect(RESEARCH_EVIDENCE_RULES).toContain("Source role");
    expect(RESEARCH_EVIDENCE_RULES).toContain("Freshness");
    expect(RESEARCH_EVIDENCE_RULES).toContain("Relevance");
    expect(RESEARCH_EVIDENCE_RULES).toContain("Independence");
    expect(RESEARCH_EVIDENCE_RULES).toContain("Method and limitations");
    expect(RESEARCH_EVIDENCE_RULES).toContain("Never invent a numeric source score");
  });

  it("keeps market research local only when the business has evidence for a real location", () => {
    const business = researchFor("business_insights", { businessName: "Example Co", website: "https://example.co" })!;
    expect(business.brief).toContain("served market and customer geography");
    expect(business.brief).toMatch(/never infer a city or country from currency, timezone, domain suffix or search ranking/i);
    expect(business.brief).toContain("if the location is unknown, say so");

    const growth = researchFor("growth_strategy", { businessName: "Example Co", marketScope: "local" })!;
    expect(growth.brief).toContain("Business reach is classified as local");
    expect(growth.brief).toContain("not a named city or country");
    expect(growth.brief).toContain("prioritize sources and channels available in that served area");
  });

  it("requires the growth-planning agent to carry source quality limits into its recommendation", () => {
    const task = playsTask({ scorecard: "", insights: "" });
    expect(task).toContain("Prefer primary evidence for current company/platform claims and independent sources for market behavior");
    expect(task).toContain("count shared-origin URLs once");
    expect(task).toContain("Never invent a reliability score");
  });

  it("accepts insight citations only when their URLs were supplied to the run", () => {
    const input = { task: "Assess alternatives", brief: "Business facts", facts: [], precomputedResearch: { notes: "Review page", sources: [{ url: "https://example.com/reviews/" }] } };
    const base = { competitors: [], alternatives: [], objections: [], gaps: [], swot: { strengths: [], weaknesses: [], opportunities: [], threats: [] }, swotEvidence: [], swotMoves: [] };
    expect(lintInsightSources({ ...base, vocPhrases: [{ phrase: "Useful", theme: "value", sourceUrl: "https://example.com/reviews" }] }, input)).toEqual([]);
    const issues = lintInsightSources({ ...base, vocPhrases: [{ phrase: "Made up", theme: "value", sourceUrl: "https://invented.example/reviews" }] }, input);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: "error", rule: "citation", path: "vocPhrases[0].sourceUrl" });
  });

  it("requires each structured competitor comparison to cite a page read in this run", () => {
    const input = { task: "Compare competitors", brief: "Business facts", facts: [], precomputedResearch: { notes: "Pricing and offer pages", sources: [{ url: "https://rival.example/pricing" }] } };
    const base = {
      competitors: [{
        name: "Rival",
        url: "https://rival.example",
        note: "Direct alternative",
        sourceUrl: "https://rival.example/pricing",
        kind: "direct" as const,
        comparison: [{ dimension: "pricing" as const, finding: "Publishes a monthly plan price.", sourceUrl: "https://rival.example/pricing", implication: "A comparable price test may be useful if the offers serve the same buyer." }],
      }],
      alternatives: [],
      vocPhrases: [],
      objections: [],
      gaps: [],
      swot: { strengths: [], weaknesses: [], opportunities: [], threats: [] },
      swotEvidence: [],
      swotMoves: [],
    };
    expect(lintInsightSources(base, input)).toEqual([]);
    const issues = lintInsightSources({ ...base, competitors: [{ ...base.competitors[0], comparison: [{ ...base.competitors[0].comparison[0], sourceUrl: "https://unread.example/pricing" }] }] }, input);
    expect(issues).toMatchObject([{ severity: "error", rule: "citation", path: "competitors[0].comparison[0].sourceUrl" }]);
  });

  it("requires SWOT claims to match their dimension and carry decision-useful evidence", () => {
    const input = {
      task: "Build a sourced SWOT",
      brief: "Business facts",
      facts: ["Owner-confirmed: serves 40 active customers"],
      precomputedResearch: { notes: "Market and competitor page", sources: [{ url: "https://market.example/report" }] },
    };
    const base = {
      competitors: [], alternatives: [], vocPhrases: [], objections: [], gaps: [],
      swot: { strengths: ["Serves 40 active customers"], weaknesses: [], opportunities: ["Local searches have grown"] , threats: [] },
      swotEvidence: [
        { dimension: "strength" as const, finding: "Serves 40 active customers", basis: "owner_report" as const, evidenceRefs: ["fact:0"], strategicImplication: "Use this customer base for opt-in referrals before buying reach.", confidence: "medium" as const },
        { dimension: "opportunity" as const, finding: "Local searches have grown", basis: "research" as const, evidenceRefs: ["https://market.example/report"], strategicImplication: "Check local-intent visits before investing in new service areas.", confidence: "low" as const },
      ],
      swotMoves: [{ kind: "strength_opportunity" as const, firstIndex: 0, secondIndex: 0, move: "Offer opt-in referrals to existing customers in the researched local service area.", firstTest: "Invite the last five consenting customers to refer one neighbor.", measure: "Qualified referred inquiries in 14 days" }],
    };
    expect(lintInsightSources(base, input)).toEqual([]);
    const issues = lintInsightSources({ ...base, swotEvidence: [{ ...base.swotEvidence[0], evidenceRefs: ["fact:8"] }, { ...base.swotEvidence[1], dimension: "strength" as const }], swotMoves: [{ ...base.swotMoves[0], kind: "weakness_opportunity" as const }] }, input);
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: "citation", path: "swotEvidence[0].evidenceRefs" }),
      expect.objectContaining({ rule: "swot_evidence", path: "swotEvidence[1].finding" }),
      expect.objectContaining({ rule: "swot_evidence", path: "swot.opportunities" }),
      expect.objectContaining({ rule: "swot_move", path: "swotMoves[0].firstIndex" }),
    ]));
  });

  it("carries competitor comparisons into downstream content as untrusted context with publishing limits", () => {
    const context = businessResearchContext({ competitors: [{ name: "Rival", comparison: [{ dimension: "pricing", finding: "Published annual pricing.", sourceUrl: "https://rival.example/pricing", implication: "Test whether annual terms fit the buyer." }] }] });
    expect(context).toContain("dimension");
    expect(context).toContain("<untrusted_content source=\"business research\">");
    expect(context).toContain("do not copy their wording");
    expect(context).toContain("not independent proof of effectiveness");
    expect(businessResearchContext()).toBe("");
  });
});
