import { describe, expect, it } from "vitest";
import { assess, FocusedCritiqueSchema } from "../../shared/agents/runtime";
import { focusedStrategySpec } from "../../shared/agents/specs";
import { focusedOriginalityFixture } from "../fixtures/focusedOriginality";
import type { CritiqueResult } from "../../shared/agents/types";
import { focusedPlanFixture } from "../fixtures/focusedPlan";
import { focusedRevisionOriginality } from "../../shared/agents/focusedReview";

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
  it("forwards the full current mechanism finding only for a required repair, including an average deficit", () => {
    const critique = review(), plan = focusedPlanFixture(), actual = focusedStrategySpec().rubric;
    expect(focusedRevisionOriginality(critique, actual, plan)).toBe("");
    // F7 meets the individual floor but contributes to a failed average.
    critique.scores.find(score => score.id === "F7")!.score = 3.5;
    const before = structuredClone(critique);
    expect(JSON.parse(focusedRevisionOriginality(critique, actual, plan))).toEqual(critique.originalityAudit);
    expect(critique).toEqual(before);
    critique.scores.forEach(score => { score.score = 5; });
    critique.originalityAudit!.mechanismVerdict = "familiar_mechanism";
    expect(JSON.parse(focusedRevisionOriginality(critique, actual, plan))).toEqual(critique.originalityAudit);
  });
  it("does not forward unbound, missing or malformed originality findings as repair guidance", () => {
    const critique = review(), plan = focusedPlanFixture(); critique.scores.find(score => score.id === "F7")!.score = 2;
    expect(focusedRevisionOriginality(critique, { ...rubric, id: "another-task" }, plan)).toBe("");
    expect(focusedRevisionOriginality(critique, rubric, {})).toBe("");
    const stale = structuredClone(critique); stale.originalityAudit!.mechanismQuote = plan.strategyExploration.adjacent.businessMechanism;
    expect(focusedRevisionOriginality(stale, rubric, plan)).toBe("");
    const duplicate = structuredClone(critique); duplicate.scores.push({ ...duplicate.scores.find(score => score.id === "F7")! });
    expect(focusedRevisionOriginality(duplicate, rubric, plan)).toBe("");
    critique.originalityAudit!.testOfDifference = " ";
    expect(focusedRevisionOriginality(critique, rubric, plan)).toBe("");
  });
  it("binds the originality verdict to the complete current bold mechanism, not another idea or a stale excerpt", () => {
    const plan = focusedPlanFixture(), critique = review();
    Object.assign(critique.originalityAudit!, { mechanismQuote: plan.strategyExploration.bold.businessMechanism });
    expect(assess(critique, [], rubric, plan).ship).toBe(true);
    for (const quote of [plan.strategyExploration.adjacent.businessMechanism, "A mechanism from an earlier draft, with the same title.", plan.strategyExploration.bold.businessMechanism.slice(0, 30)]) {
      const wrong = structuredClone(critique); Object.assign(wrong.originalityAudit!, { mechanismQuote: quote });
      const before = structuredClone(wrong), assessment = assess(wrong, [], rubric, plan);
      expect(assessment.ship).toBe(false);
      expect(assessment.lint).toContainEqual(expect.objectContaining({ rule: "review_scores", path: "review.originalityAudit" }));
      expect(wrong).toEqual(before);
    }
    expect(assess(critique, [], rubric).ship).toBe(false);
  });
  it.each(["familiar_mechanism", "unclear_difference"] as const)("blocks a passing score paired with %s without rewriting the score or verdict", verdict => {
    const critique = review(); critique.originalityAudit!.mechanismVerdict = verdict;
    const before = structuredClone(critique), assessment = assess(critique, [], rubric, focusedPlanFixture());
    expect(assessment.ship).toBe(false);
    expect(assessment.lint).toContainEqual(expect.objectContaining({ path: "review.originalityAudit", severity: "error", rule: "review_scores" }));
    expect(assessment.critique).toEqual(before);
    expect(critique).toEqual(before);
  });
  it("keeps ordinary or unexplained mechanisms below acceptance even with all other scores at five", () => {
    const critique = review(); critique.originalityAudit!.mechanismVerdict = "familiar_mechanism";
    critique.scores.forEach(score => { score.score = score.id === "F7" ? 3 : 5; });
    const assessment = assess(critique, [], rubric, focusedPlanFixture());
    expect(assessment.lint).toEqual([]); // internally consistent, still below the unchanged bar
    expect(assessment.ship).toBe(false);
  });
  it("does not penalize an unbuilt speculative departure for lacking precedent, evidence or readiness", () => {
    const critique = review(); critique.originalityAudit!.consequentialDifference = "A proposed exchange of participant control with no matching precedent; value, demand and feasibility remain untested.";
    expect(assess(critique, [], rubric, focusedPlanFixture()).ship).toBe(true);
    critique.scores.find(score => score.id === "F7")!.score = 3;
    expect(assess(critique, [], rubric, focusedPlanFixture()).ship).toBe(false); // a material difference alone does not prove fit/test quality
  });
  it("requires a complete fresh review contract without rewriting historical reviews", () => {
    const critique = review(); expect(FocusedCritiqueSchema.safeParse(critique).success).toBe(true);
    delete critique.originalityAudit;
    expect(FocusedCritiqueSchema.safeParse(critique).success).toBe(false);
    expect(assess(critique, [], rubric, focusedPlanFixture()).ship).toBe(false);
    expect(critique.originalityAudit).toBeUndefined();
  });
  it.each(["mechanismQuote", "closestFamiliarAlternative", "consequentialDifference", "testOfDifference"] as const)("rejects a blank %s", field => {
    const critique = review(); critique.originalityAudit![field] = " ";
    expect(assess(critique, [], rubric, focusedPlanFixture()).ship).toBe(false);
  });
  it("leaves other specialist reviews unchanged", () => {
    const critique = review(); delete critique.originalityAudit;
    expect(assess(critique, [], { ...rubric, id: "other-specialist" }).ship).toBe(true);
  });
});
