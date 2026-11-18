import { describe, expect, it } from "vitest";
import { assess, FocusedCritiqueSchema } from "../../shared/agents/runtime";
import { focusedStrategySpec } from "../../shared/agents/specs";
import { focusedOriginalityFixture } from "../fixtures/focusedOriginality";
import type { CritiqueResult } from "../../shared/agents/types";

const rubric = { ...focusedStrategySpec().rubric, shipRule: { minEach: 4, minAverage: 4 } };
function review(): CritiqueResult {
  return {
    gates: rubric.gates.map(gate => ({ id: gate.id, pass: true, note: "Synthetic gate" })),
    scores: [...rubric.criteria.map(criterion => criterion.id), "XV"].map(id => ({ id, score: 4, note: "Synthetic score", fix: "none" })),
    strengths: [], fixes: [], escalation: { reason: "none", evidence: "" },
    evidenceAudit: ["business_state", "comparative_claims", "capabilities_and_results"].map(category => ({ category, basis: "Synthetic review only", claims: [] })) as CritiqueResult["evidenceAudit"],
    originalityAudit: { ...focusedOriginalityFixture },
  };
}

describe("the protected bold mechanism has an inspectable originality assessment", () => {
  it.each(["familiar_mechanism", "unclear_difference"] as const)("blocks a passing score paired with %s without rewriting the score or verdict", verdict => {
    const critique = review(); critique.originalityAudit!.mechanismVerdict = verdict;
    const before = structuredClone(critique), assessment = assess(critique, [], rubric);
    expect(assessment.ship).toBe(false);
    expect(assessment.lint).toContainEqual(expect.objectContaining({ path: "review.originalityAudit", severity: "error", rule: "review_scores" }));
    expect(assessment.critique).toEqual(before);
    expect(critique).toEqual(before);
  });
  it("keeps ordinary or unexplained mechanisms below acceptance even with all other scores at five", () => {
    const critique = review(); critique.originalityAudit!.mechanismVerdict = "familiar_mechanism";
    critique.scores.forEach(score => { score.score = score.id === "F7" ? 3 : 5; });
    const assessment = assess(critique, [], rubric);
    expect(assessment.lint).toEqual([]); // internally consistent, still below the unchanged bar
    expect(assessment.ship).toBe(false);
  });
  it("does not penalize an unbuilt speculative departure for lacking precedent, evidence or readiness", () => {
    const critique = review(); critique.originalityAudit!.consequentialDifference = "A proposed exchange of participant control with no matching precedent; value, demand and feasibility remain untested.";
    expect(assess(critique, [], rubric).ship).toBe(true);
    critique.scores.find(score => score.id === "F7")!.score = 3;
    expect(assess(critique, [], rubric).ship).toBe(false); // a material difference alone does not prove fit/test quality
  });
  it("requires a complete fresh review contract without rewriting historical reviews", () => {
    const critique = review(); expect(FocusedCritiqueSchema.safeParse(critique).success).toBe(true);
    delete critique.originalityAudit;
    expect(FocusedCritiqueSchema.safeParse(critique).success).toBe(false);
    expect(assess(critique, [], rubric).ship).toBe(false);
    expect(critique.originalityAudit).toBeUndefined();
  });
  it.each(["closestFamiliarAlternative", "consequentialDifference", "testOfDifference"] as const)("rejects a blank %s", field => {
    const critique = review(); critique.originalityAudit![field] = " ";
    expect(assess(critique, [], rubric).ship).toBe(false);
  });
  it("leaves other specialist reviews unchanged", () => {
    const critique = review(); delete critique.originalityAudit;
    expect(assess(critique, [], { ...rubric, id: "other-specialist" }).ship).toBe(true);
  });
});
