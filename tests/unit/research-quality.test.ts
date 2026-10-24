import { describe, expect, it } from "vitest";
import { RESEARCH_EVIDENCE_RULES } from "../../shared/agents/runtime";
import { playsTask } from "../../shared/agents/planTasks";

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
});
