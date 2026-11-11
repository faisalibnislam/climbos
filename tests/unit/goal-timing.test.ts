import { describe, expect, it } from "vitest";
import { GoalTimingSchema, dayRange, lintGoalTiming } from "../../shared/agents/goalTiming";
import { focusedPlanTask } from "../../shared/agents/focusedPlan";

const timing = { preparation: { minDays: 2, maxDays: 4 }, firstReview: { minDays: 9, maxDays: 13 }, reason: "Existing materials can be reused, but useful replies take time.", assumptions: ["The reviewer is available; capacity has not been measured."], reviewTrigger: "Review after useful replies, or check the test at the end of the estimated window.", outcomeLag: "Customer outcomes may take longer than this first feedback review." };
const phases = [{ days: "1–4", firstAction: "Prepare", howToCheck: "Read the draft", decisionRule: "Fix unclear copy" }, { days: "5–13", firstAction: "Try the approved approach", howToCheck: "Record available responses", decisionRule: "Change or continue from the evidence" }];

describe("goal-specific planning time", () => {
  it("accepts useful custom windows without imposing a plan package", () => {
    expect(GoalTimingSchema.parse(timing)).toEqual(timing);
    expect(lintGoalTiming(timing, phases)).toEqual([]);
    expect(dayRange(timing.firstReview)).toBe("about 9–13 days");
    expect(focusedPlanTask()).toContain("Choose timing by judging THIS goal");
    expect(focusedPlanTask()).not.toContain("EXECUTION CYCLE:");
  });
  it("rejects unsupported timing, reverse ranges, overlap, gaps and a review before preparation", () => {
    expect(lintGoalTiming(undefined, phases)).toHaveLength(1);
    expect(lintGoalTiming({ ...timing, firstReview: { minDays: 2, maxDays: 3 } }, phases)).toHaveLength(1);
    expect(lintGoalTiming({ ...timing, preparation: { minDays: 7, maxDays: 2 } }, phases)).toHaveLength(1);
    expect(lintGoalTiming(timing, [phases[0], { ...phases[1], days: "4–13" }])).toHaveLength(1);
    expect(lintGoalTiming(timing, [phases[0], { ...phases[1], days: "6–13" }])).toHaveLength(1);
    expect(lintGoalTiming(timing, [phases[0], { ...phases[1], days: "5–8" }])).toHaveLength(1);
    expect(GoalTimingSchema.safeParse({ ...timing, firstReview: { minDays: 1.2, maxDays: 9 } }).success).toBe(false);
  });
});
