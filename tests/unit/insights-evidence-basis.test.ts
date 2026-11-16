import { describe, expect, it } from "vitest";
import { lintInsightSources } from "../../shared/agents/specs";
import type { AgentInput } from "../../shared/agents/types";

type Output = Parameters<typeof lintInsightSources>[0];
type Basis = "owner_report" | "measured" | "research" | "inference";
function findings(surface: string, basis: Basis, refs: string[]): Output {
  const output: Output = { audiences: [], competitors: [], alternatives: [], vocPhrases: [], objections: [], gaps: [], siteAssessment: [], swot: { strengths: [], weaknesses: [], opportunities: [], threats: [] }, swotEvidence: [], swotMoves: [], commercialAssessment: { status: "insufficient_business_specific_evidence", evidence: [], unknowns: ["Demand is unknown."], nextTest: { question: "Will buyers commit?", smallestTest: "Discuss a bounded test with the owner.", successSignal: "Recorded buyer commitment.", decisionRule: "Set the rule before testing." } } };
  const statement = "The owner says their analytics show returning customers.";
  if (surface === "commercial") output.commercialAssessment.evidence = [{ dimension: "demand", finding: statement, basis, evidenceRefs: refs, limitation: "Reported claim; prevalence and independent verification unknown." }];
  else if (surface === "swot") {
    output.swot.strengths = [statement];
    output.swotEvidence = [{ dimension: "strength", finding: statement, basis, evidenceRefs: refs, confidence: "low", strategicImplication: "Check whether repeat purchases justify a retention test." }];
  } else {
    output.audiences = [{ name: "Returning buyers", description: "Proposed research segment", confidence: "low", needs: [], objections: [], purchasingMotivations: [], channelPreferences: [] }];
    if (surface === "channel") output.audiences[0].channelPreferences = [{ channel: "Newsletter", rationale: statement, basis, evidenceRefs: refs }];
    else output.audiences[0].needs = [{ statement, basis, evidenceRefs: refs }];
  }
  return output;
}

describe.each(["commercial", "swot", "audience", "channel"])("%s evidence labels", surface => {
  const input: AgentInput = { task: "Research the business", brief: "Synthetic business", facts: ["The owner says their analytics show returning customers."], constraints: { factEvidenceBases: ["owner_reported"] }, availableSourceUrls: ["https://research.example/Claim"] };
  it("does not upgrade an owner report to measured evidence based on its wording", () => {
    expect(lintInsightSources(findings(surface, "measured", ["fact:0"]), input)).toContainEqual(expect.objectContaining({ rule: "evidence_basis", severity: "error" }));
    expect(lintInsightSources(findings(surface, "owner_report", ["fact:0"]), input)).toEqual([]);
  });
  it("keeps missing provenance unknown and researched facts separate from owner reports", () => {
    expect(lintInsightSources(findings(surface, "owner_report", ["fact:0"]), { ...input, constraints: {} })).toContainEqual(expect.objectContaining({ rule: "evidence_basis" }));
    expect(lintInsightSources(findings(surface, "owner_report", ["fact:0"]), { ...input, constraints: { factEvidenceBases: ["source_reported"] } })).toContainEqual(expect.objectContaining({ rule: "evidence_basis" }));
  });
  it("does not let a matching citation conceal differently sourced evidence", () => {
    expect(lintInsightSources(findings(surface, "owner_report", ["fact:0", "https://research.example/Claim"]), input)).toContainEqual(expect.objectContaining({ rule: "evidence_basis" }));
  });
  it("preserves recorded measurements, researched claims and uncited hypotheses", () => {
    expect(lintInsightSources(findings(surface, "measured", [" FACT:0 "]), { ...input, constraints: { factEvidenceBases: ["measured"] } })).toEqual([]);
    expect(lintInsightSources(findings(surface, "research", ["https://research.example/Claim"]), input)).toEqual([]);
    expect(lintInsightSources(findings(surface, "inference", []), input)).toEqual([]);
  });
});
