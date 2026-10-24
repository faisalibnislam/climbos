import { describe, expect, it } from "vitest";
import { CRITIC_RULES, OPERATING_RULES, RESEARCH_EVIDENCE_RULES } from "../../shared/agents/runtime";
import { playsTask } from "../../shared/agents/planTasks";
import { lintInsightSources } from "../../shared/agents/specs";
import { factsBlock } from "../../shared/ai/tasks";

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

  it("requires the growth-planning agent to carry source quality limits into its recommendation", () => {
    const task = playsTask({ scorecard: "", insights: "" });
    expect(task).toContain("Prefer primary evidence for current company/platform claims and independent sources for market behavior");
    expect(task).toContain("count shared-origin URLs once");
    expect(task).toContain("Never invent a reliability score");
  });

  it("accepts insight citations only when their URLs were supplied to the run", () => {
    const input = { task: "Assess alternatives", brief: "Business facts", facts: [], precomputedResearch: { notes: "Review page", sources: [{ url: "https://example.com/reviews/" }] } };
    const base = { competitors: [], alternatives: [], objections: [], gaps: [] };
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
    };
    expect(lintInsightSources(base, input)).toEqual([]);
    const issues = lintInsightSources({ ...base, competitors: [{ ...base.competitors[0], comparison: [{ ...base.competitors[0].comparison[0], sourceUrl: "https://unread.example/pricing" }] }] }, input);
    expect(issues).toMatchObject([{ severity: "error", rule: "citation", path: "competitors[0].comparison[0].sourceUrl" }]);
  });
});
