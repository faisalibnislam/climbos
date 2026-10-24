import { describe, expect, it } from "vitest";
import { RESEARCH_EVIDENCE_RULES } from "../../shared/agents/runtime";
import { playsTask } from "../../shared/agents/planTasks";
import { lintInsightSources } from "../../shared/agents/specs";

describe("research source assessment", () => {
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
});
