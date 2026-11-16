import { describe, expect, it, vi } from "vitest";
import { FocusedStrategySchema, focusedStrategySpec } from "../../shared/agents/specs";
import { focusedPlanFixture } from "../fixtures/focusedPlan";
import { campaignTimingFixture, timingContextFixture } from "../fixtures/campaignTiming";
import { lintAgentOutput } from "../../shared/agents/runtime";
import { evergreenTimingFixture } from "../fixtures/campaignTiming";
import { lintCampaignTiming } from "../../shared/agents/campaignTiming";

function sample() {
  const plan = focusedPlanFixture(30), timing = structuredClone(campaignTimingFixture), context = timingContextFixture();
  return { plan: { ...plan, focusedMove: { ...plan.focusedMove, timingAssessment: timing } }, input: {
    task: "Plan a date-sensitive campaign", brief: "Synthetic local service", facts: context.facts,
    timingContext: { today: context.today, timezone: context.timezone! },
    precomputedResearch: { notes: context.researchNotes, sources: context.sourceUrls.map(url => ({ url })), retrievedAt: context.researchRetrievedAt },
    constraints: { horizonDays: 30, monthlyAdBudgetUsd: 0 },
  } };
}
describe("campaign timing in focused strategy", () => {
  it("retains a supported timing assessment in the default schema", () => {
    const { plan, input } = sample();
    expect(FocusedStrategySchema.parse(plan).focusedMove).toHaveProperty("timingAssessment", plan.focusedMove.timingAssessment);
    expect(focusedStrategySpec().lint?.(plan, input)?.filter(issue => issue.severity === "error")).toEqual([]);
  });
  it("requires an assessment in new output, but preserves an evergreen recommendation without a calendar context", () => {
    const { plan, input } = sample();
    expect(FocusedStrategySchema.safeParse({ ...plan, focusedMove: { ...plan.focusedMove, timingAssessment: undefined } }).success).toBe(false);
    plan.focusedMove.timingAssessment = evergreenTimingFixture();
    expect(focusedStrategySpec().lint?.(plan, { ...input, timingContext: undefined })?.filter(issue => issue.rule === "campaign_timing")).toEqual([]);
  });
  it("keeps unknown readiness and geography explicit without suggesting a date", () => {
    const { plan, input } = sample();
    plan.focusedMove.timingAssessment = { ...evergreenTimingFixture(), decision: "not_enough_evidence", geographyBasis: "Served geography unknown.", unknowns: ["Served geography", "Timezone", "Capacity and lead time"], rationale: "Prepare a geography-neutral draft while checking the missing timing inputs." };
    expect(focusedStrategySpec().lint?.(plan, input)?.filter(issue => issue.rule === "campaign_timing")).toEqual([]);
  });
  it("rechecks after research rather than treating a newer source read as a future timestamp", () => {
    const { plan, input } = sample(), evaluatedAt = Date.parse("2026-10-20T14:00:00Z");
    const spy = vi.spyOn(Date, "now").mockReturnValue(evaluatedAt);
    try {
      input.precomputedResearch.retrievedAt = evaluatedAt - 1000;
      const result = lintAgentOutput(focusedStrategySpec(), { ...input, timingContext: { ...input.timingContext, now: evaluatedAt - 60000 } }, plan);
      expect(result.filter(issue => issue.rule === "campaign_timing")).toEqual([]);
    } finally { spy.mockRestore(); }
  });
  it.each(["too_close", "capacity", "stale", "unknown_zone", "conflict"])("rejects a contradictory %s timing recommendation", condition => {
    const { plan, input } = sample(), timing = plan.focusedMove.timingAssessment;
    if (condition === "too_close") input.timingContext.today = "2026-11-19";
    if (condition === "capacity") timing.capacity.status = "constrained";
    if (condition === "stale") input.precomputedResearch.retrievedAt = Date.now() - 48 * 3600_000;
    if (condition === "unknown_zone") timing.timezone = null;
    if (condition === "conflict") timing.moment.evidence.push({ ...timing.moment.evidence[0], eventDate: "2026-11-28", claim: "Another source states November 28, 2026." });
    expect(focusedStrategySpec().lint?.(plan, input)).toContainEqual(expect.objectContaining({ rule: "campaign_timing", severity: "error" }));
  });
  it("does not borrow a different number from the same fact to shorten preparation", () => {
    const { plan, input } = sample();
    plan.focusedMove.timingAssessment.preparation.leadTimeDays = 2;
    expect(focusedStrategySpec().lint?.(plan, input)).toContainEqual(expect.objectContaining({ rule: "campaign_timing", path: "focusedMove.timingAssessment.preparation.leadTimeDays" }));
  });
  it("does not count working days as calendar days", () => {
    const { plan, input } = sample();
    plan.focusedMove.timingAssessment.preparation.basis = "We need 14 working days to prepare the campaign";
    input.facts = [input.facts[0].replace("14 days", "14 working days"), ...input.facts.slice(1)];
    expect(focusedStrategySpec().lint?.(plan, input)).toContainEqual(expect.objectContaining({ rule: "campaign_timing", path: "focusedMove.timingAssessment.preparation.leadTimeDays" }));
  });
  it("uses the evidenced business timezone for lead time when its calendar day differs from the workspace", () => {
    const timing = structuredClone(campaignTimingFixture);
    timing.timezone = "Pacific/Auckland"; timing.timezoneEvidenceRef = "fact:2";
    // In New York it is still November 3; in Auckland it is already November 4.
    const now = Date.parse("2026-11-04T02:00:00Z");
    timing.proposedWindow = { startDate: "2026-11-19", endDate: "2026-11-27" };
    const context = { ...timingContextFixture(), now, today: "2026-11-03", facts: [...timingContextFixture().facts, "The business uses Pacific/Auckland for campaign planning."], researchRetrievedAt: now };
    expect(lintCampaignTiming(timing, context)).toContainEqual(expect.objectContaining({ path: "timingAssessment.preparation.feasible" }));
  });
});
