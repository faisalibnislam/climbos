import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OfferAssessmentPanel } from "../../src/components/app/plan/OfferAssessmentPanel";
import { FocusedStrategySchema, focusedStrategySpec } from "../../shared/agents/specs";
import { approvedPlanContext, approvedPlanOfferTerms } from "../../shared/agents/approvedPlanContext";
import { agentQuality, canDriveWork, planQuality } from "../../shared/agents/quality";
import { evaluateOfferUnitEconomics } from "../../shared/agents/offerAssessment";
import { focusedPlanFixture } from "../fixtures/focusedPlan";
import { offerAssessmentFixture, offerFact } from "../fixtures/offerAssessment";
import type { AgentInput } from "../../shared/agents/types";

const input: AgentInput = { task: "Assess the proposed offer", brief: offerFact, facts: [offerFact], constraints: { factEvidenceBases: ["owner_reported"], horizonDays: 30, currency: "USD", monthlyAdBudgetUsd: 0 } };
const plan = (offer = offerAssessmentFixture()) => {
  const base = focusedPlanFixture(30);
  return { ...base, diagnosis: offer.diagnosis, focusedMove: { ...base.focusedMove, title: "Test the proposed introductory discount", why: "The owner reports a price obstacle for qualified quote requests.", firstAction: "Review the prepared offer test.", aiCanDo: "Prepare a private discount test brief for owner review.", offerAssessment: offer } };
};
const issues = (value: ReturnType<typeof plan>, context = input) => focusedStrategySpec().lint?.(value, context) ?? [];
const offerErrors = (value: ReturnType<typeof plan>, context = input) => issues(value, context).filter(issue => issue.rule === "focused_offer_assessment");

describe("focused promotion assessment", () => {
  it("accepts a non-price comprehension test that explicitly declines a discount", () => {
    const value = focusedPlanFixture(30);
    value.focusedMove.title = "School approval pack comprehension check";
    value.focusedMove.why = "Teachers may need school approval to pay. A clear forwardable page needs no ads, audience or discount.";
    value.focusedMove.aiCanDo = "Draft the pack and private comprehension questions for owner review.";
    expect(focusedStrategySpec().lint?.(value, input)?.filter(issue => issue.rule === "focused_offer_assessment")).toEqual([]);
    value.focusedMove.aiCanDo = "Draft a free trial to help teachers test the workshop.";
    expect(focusedStrategySpec().lint?.(value, input))
      .toContainEqual(expect.objectContaining({ rule: "focused_offer_assessment", severity: "error" }));
  });

  it("retains the existing full assessment and calculates contribution from supplied inputs", () => {
    const value = plan();
    expect(FocusedStrategySchema.parse(value).focusedMove).toHaveProperty("offerAssessment", value.focusedMove.offerAssessment);
    expect(offerErrors(value)).toEqual([]);
    expect(evaluateOfferUnitEconomics(value.focusedMove.offerAssessment)).toMatchObject({ currentContribution: 50, proposedContribution: 40, proposedUnitsPerCurrentUnitToMatchContribution: 1.25 });
  });
  it("requires assessment for the primary promotion without gating speculative alternatives", () => {
    const value = plan(); delete (value.focusedMove as { offerAssessment?: unknown }).offerAssessment;
    const found = offerErrors(value);
    expect(found).toContainEqual(expect.objectContaining({ path: "focusedMove.offerAssessment", severity: "error" }));
    const summaryOnly = focusedPlanFixture(30); summaryOnly.summary = "Test a discount for quote requesters.";
    expect(focusedStrategySpec().lint?.(summaryOnly, input)).toContainEqual(expect.objectContaining({ rule: "focused_offer_assessment" }));
    const baseline = focusedPlanFixture(30);
    baseline.strategyExploration.bold.businessAction = "Explore a speculative bundle without changing any public offer.";
    expect(focusedStrategySpec().lint?.(baseline, input)?.filter(issue => issue.rule === "focused_offer_assessment")).toEqual([]);
    const quality = planQuality([agentQuality("growth_strategy", { lint: found, ship: true, gatesPassed: true, average: 5, minimum: 5, critique: { gates: [], scores: [], strengths: [], fixes: [] } }, 1, null)]);
    expect(canDriveWork(quality)).toBe(false);
  });
  it.each(["guardrail", "unknown_cost", "conflicting_amount", "capacity", "deadline"])("rejects a primary promotion with %s", condition => {
    const value = plan(), offer = value.focusedMove.offerAssessment;
    if (condition === "guardrail") offer.minimumContribution = { amount: 45, basis: "owner_reported", reference: "fact:0", claim: "Owner minimum contribution is $35 per sale" };
    if (condition === "unknown_cost") offer.proposed.unknownCosts = ["Variable delivery cost"];
    if (condition === "conflicting_amount") offer.proposed.netPrice.amount = 85;
    if (condition === "capacity") offer.capacity = { status: "constrained", evidenceRef: "fact:0", claim: "The team has capacity for 20 additional jobs per month." };
    if (condition === "deadline") value.focusedMove.firstAction = "Launch the discount; it ends tomorrow.";
    const context = condition === "guardrail" ? { ...input, facts: [offerFact.replace("$35 per sale", "$45 per sale")] } : input;
    expect(offerErrors(value, context).some(issue => issue.severity === "error")).toBe(true);
  });
  it("preserves missing costs in a private validation test instead of making them up", () => {
    const offer = offerAssessmentFixture({ recommendation: "validate_first" });
    offer.proposed.unknownCosts = ["Incremental delivery cost"]; offer.risks[0].status = "unknown";
    offer.test.ownerInputs = ["Confirm incremental delivery cost before changing the offer"];
    expect(offerErrors(plan(offer))).toEqual([]);
  });
  it("does not turn absent cost categories into zero-cost contribution", () => {
    const offer = offerAssessmentFixture({ recommendation: "validate_first" });
    offer.current.variableCosts = []; offer.proposed.variableCosts = [];
    expect(evaluateOfferUnitEconomics(offer)).toMatchObject({ known: false, currentContribution: null, proposedContribution: null });
    const markup = renderToStaticMarkup(createElement(OfferAssessmentPanel, { offer }));
    expect(markup).toContain("calculate yet. Missing:");
    expect(markup).not.toContain("About 1.25 sales");
  });
  it("does not recommend a discount when the supported bottleneck is delivery capacity", () => {
    expect(offerErrors(plan(), { ...input, constraints: { ...input.constraints, diagnosis: { constraint: "delivery", status: "supported", basis: "partial", readings: [], competing: "", missing: [] } } })).toContainEqual(expect.objectContaining({ path: "focusedMove.offerAssessment.recommendation" }));
  });
  it("preserves no-change recommendations and exposes their comparison", () => {
    const value = plan(offerAssessmentFixture({ recommendation: "improve_other_constraint", mechanism: "none" }));
    value.focusedMove.title = "Improve the quote follow-up path";
    value.focusedMove.why = "Follow-up friction is the stronger explanation to investigate.";
    value.focusedMove.aiCanDo = "Prepare a private walkthrough of the existing booking path.";
    expect(offerErrors(value)).toEqual([]);
  });
  it("checks prepared copy against the selected new proposal without silently inheriting old prices", () => {
    const value = plan();
    value.preparedWork[0] = { ...value.preparedWork[0], kind: "social_post", approvedOfferPlayName: value.focusedMove.title, draft: "First-time quote requesters can review the discount at $95. Existing full-price bookings are excluded." };
    const context = { ...input, approvedOfferTerms: [{ playName: "Earlier proposal", recommendation: "recommend_promotion", currency: "USD", allowedPrices: [100, 90], allowedMechanisms: ["discount"], urgencyClaim: null, eligibleAudience: "first-time quote requesters" }] };
    expect(issues(value, context).filter(issue => issue.rule.startsWith("approved_offer"))).toEqual([]);
    value.preparedWork[0].draft = value.preparedWork[0].draft.replace("$95", "$90");
    expect(issues(value, context)).toContainEqual(expect.objectContaining({ rule: "approved_offer_price" }));
    value.focusedMove.offerAssessment.recommendation = "validate_first";
    expect(issues(value, context)).toContainEqual(expect.objectContaining({ rule: "offer_validation_only" }));
  });
  it("carries focused offer terms into later approved-plan drafts only after approval", () => {
    const value = plan(), saved = { status: "approved", version: 1, audiences: [{ name: "First-time quote requesters" }], expert: { diagnosis: value.diagnosis, focusedMove: value.focusedMove } };
    expect(approvedPlanOfferTerms(saved)).toMatchObject([{ playName: value.focusedMove.title, allowedPrices: [100, 95], allowedMechanisms: ["discount"] }]);
    expect(approvedPlanContext(saved)).toContain("proposed net price 95 USD");
    expect(approvedPlanContext(saved)).toContain("Audiences: First-time quote requesters");
    expect(approvedPlanOfferTerms({ ...saved, status: "needs_approval" })).toEqual([]);
    expect(approvedPlanOfferTerms({ ...saved, status: "superseded" })).toEqual([]);
    expect(approvedPlanOfferTerms({ ...saved, status: "superseded" }, { pinnedAtLaunch: true })).toHaveLength(1);
  });
});
