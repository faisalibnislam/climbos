import { afterEach, describe, expect, it, vi } from "vitest";
import { replayFocusedStrategy } from "../../bench/strategy-quality/replay";
import { focusedOriginalityFixture } from "../fixtures/focusedOriginality";
import { focusedPlanFixture } from "../fixtures/focusedPlan";
import { campaignTimingFixture, timingContextFixture } from "../fixtures/campaignTiming";

function saved() {
  const context = timingContextFixture({ researchRetrievedAt: Date.parse("2026-10-20T12:00:00Z") });
  const output = focusedPlanFixture(30);
  output.focusedMove.timingAssessment = structuredClone(campaignTimingFixture);
  return { caseId: "synthetic-local-retailer", engine: "historical", input: {
    task: "Plan a date-sensitive campaign", brief: "Synthetic local service", facts: context.facts,
    timingContext: { today: context.today, timezone: context.timezone!, now: context.researchRetrievedAt! + 1000 },
    precomputedResearch: { notes: context.researchNotes, sources: context.sourceUrls.map(url => ({ url })), retrievedAt: context.researchRetrievedAt },
    constraints: { horizonDays: 30, monthlyAdBudgetUsd: 0 },
  }, result: { output, assessment: { average: 4, ship: true } } };
}
afterEach(() => vi.restoreAllMocks());

describe("saved strategy contract replay", () => {
  it("uses the saved evidence and clock without network calls, mutations or rerating historical quality", () => {
    const network = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network forbidden"));
    vi.spyOn(Date, "now").mockReturnValue(Date.UTC(2030, 0, 1));
    const record = saved(), original = structuredClone(record);
    const report = replayFocusedStrategy(record);
    expect(report.status, JSON.stringify(report)).toBe("contract_passed");
    expect(report).toMatchObject({ historicalAssessment: { average: 4, ship: true }, editorialReview: "not_assessed", modelCalls: 0, externalActions: 0, savedReviewValidation: { status: "uncheckable" } });
    expect(record).toEqual(original);
    expect(network).not.toHaveBeenCalled();
  });
  it("does not label a retained failed assessment as a pass when the old review cannot be rechecked", () => {
    const record = saved();
    record.result.assessment.ship = false;
    expect(replayFocusedStrategy(record)).toMatchObject({ status: "historical_review_failed", savedReviewValidation: { status: "uncheckable" } });
  });
  it("propagates a rejected rechecked review even when the saved output passes lint", () => {
    const record = saved();
    const critique = { originalityAudit: focusedOriginalityFixture, strengths: [], fixes: [], gates: [], scores: [],
      escalation: { reason: "none", evidence: "" }, evidenceAudit: ["business_state", "comparative_claims", "capabilities_and_results"].map(category => ({
        category, basis: "Synthetic review", claims: [], planChecks: [], measurementChecks: [],
      })),
    };
    expect(replayFocusedStrategy({ ...record, result: { ...record.result, assessment: { ship: true, critique } } })).toMatchObject({
      status: "review_failed", savedReviewValidation: { status: "rechecked", assessment: { ship: false } }, modelCalls: 0,
    });
  });
  it("refuses to reconstruct missing historical clocks or inputs", () => {
    const record = saved();
    expect(replayFocusedStrategy({ ...record, input: { ...record.input, timingContext: undefined } }).status).toBe("uncheckable");
    expect(replayFocusedStrategy({ ...record, input: undefined }).status).toBe("uncheckable");
  });
  it("does not silently upgrade obsolete output contracts", () => {
    const record = saved();
    expect(replayFocusedStrategy({ ...record, result: { output: { summary: "Old output" } } }).status).toBe("schema_failed");
  });
  it.each(["unsupported_source", "insufficient_capacity", "unknown_timezone", "too_late"])("rejects a %s counterfactual while leaving the original record recoverable", change => {
    const record = saved();
    if (change === "unsupported_source") record.input.precomputedResearch.sources = [];
    if (change === "insufficient_capacity") record.result.output.focusedMove.timingAssessment.capacity.status = "constrained";
    if (change === "unknown_timezone") record.result.output.focusedMove.timingAssessment.timezone = null;
    if (change === "too_late") { record.input.timingContext.today = "2026-11-19"; record.input.timingContext.now = Date.parse("2026-11-19T12:00:00Z"); }
    expect(replayFocusedStrategy(record).status).toBe("lint_failed");
    expect(record.result.assessment).toEqual({ average: 4, ship: true });
  });
});
