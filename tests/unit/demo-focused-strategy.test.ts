import { expect, it } from "vitest";
import { fixtureOutput } from "../../convex/ai/fixtures";
import { FocusedStrategySchema } from "../../shared/agents/specs";
import { lintFocusedLearning } from "../../shared/agents/focusedPlan";
import { lintGoalTiming } from "../../shared/agents/goalTiming";
import { lintPreparedWork } from "../../shared/agents/preparedWork";

it.each(["starter", "focused"] as const)("validates the complete %s demo contract and primary learning without fabricated evidence", planStyle => {
  const input = { task: "Demo only", brief: "Synthetic form-builder example", facts: [] };
  const plan = FocusedStrategySchema.parse(fixtureOutput("growth_strategy", { businessName: "Demo", facts: [], planStyle }));
  expect(lintFocusedLearning(plan, input)).toEqual([]);
  expect(lintGoalTiming(plan.timing, plan.phases)).toEqual([]);
  expect(lintPreparedWork(plan.preparedWork, input)).toEqual([]);
  expect(plan.experiments[0].baselineRate).toBeNull();
  expect(plan.experiments[0].plannedSamplePerArm).toBeNull();
  expect(plan.focusedMove.timingAssessment.proposedWindow).toBeNull();
  expect(plan.focusedMove.timingAssessment.capacity.status).toBe("unknown");
  expect(plan.strategyExploration.bold.precedentIds).toEqual([]);
  expect(new Set([plan.strategyExploration.grounded.businessMechanism, plan.strategyExploration.adjacent.businessMechanism, plan.strategyExploration.bold.businessMechanism]).size).toBe(3);
  expect(plan.preparedWork[0].draft).toContain("Demo draft");
});
