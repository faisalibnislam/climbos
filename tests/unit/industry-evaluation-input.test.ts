import { describe, expect, it } from "vitest";
import { industryInput } from "../../bench/strategy-quality/industryInput";
import { selectStrategyQualityCases } from "../../bench/strategy-quality/cases";
import { focusedStrategySpec } from "../../shared/agents/specs";
import { focusedPlanFixture } from "../fixtures/focusedPlan";
import { evergreenTimingFixture } from "../fixtures/campaignTiming";

const item = selectStrategyQualityCases("ecommerce")[0];
const now = Date.parse("2026-11-17T00:30:00Z");

describe("isolated industry evaluation inputs", () => {
  it("supplies a deterministic evaluation clock without inventing customer geography", () => {
    const input = industryInput(item, now);
    expect(input.timingContext).toEqual({ today: "2026-11-17", timezone: "UTC", now });
    expect(input.task).toContain("CAMPAIGN TIMING CONTEXT: current local date 2026-11-17");
    expect(input.task).toContain("UTC is only this synthetic evaluation's workspace clock");
    expect(input.facts).toEqual([]);
    expect(input.constraints).not.toHaveProperty("serviceArea");
    expect(input.precomputedResearch).toEqual(item.research);
    expect(input.precomputedResearch).not.toHaveProperty("retrievedAt");
  });

  it("accepts qualified preparation with unknown business timezone using the real plan validator", () => {
    const plan = focusedPlanFixture(14);
    plan.focusedMove.timingAssessment = {
      ...evergreenTimingFixture(), decision: "prepare_first", timezone: null,
      geographyBasis: "Served geography unknown.", unknowns: ["Owner capacity and preparation time"],
      rationale: "Prepare the draft while the owner checks readiness; no local window is proposed.",
    };
    const issues = focusedStrategySpec().lint?.(plan, industryInput(item, now));
    expect(issues?.filter(issue => issue.rule === "campaign_timing")).toEqual([]);
  });

  it("still rejects borrowing an unsupported business timezone from the test machine", () => {
    const plan = focusedPlanFixture(14);
    plan.focusedMove.timingAssessment = {
      ...evergreenTimingFixture(), decision: "prepare_first", timezone: "Asia/Dhaka",
      timezoneBasis: "Customer timezone inferred from the test machine", timezoneEvidenceRef: null,
    };
    expect(focusedStrategySpec().lint?.(plan, industryInput(item, now)))
      .toContainEqual(expect.objectContaining({ rule: "campaign_timing", path: "focusedMove.timingAssessment.timezoneEvidenceRef" }));
  });

  it("rejects invalid evaluation instants before a paid request", () => {
    expect(() => industryInput(item, NaN)).toThrow();
  });
});
