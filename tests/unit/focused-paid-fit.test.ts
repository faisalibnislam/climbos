import { expect, it } from "vitest";
import { focusedStrategySpec, starterStrategySpec, lintPlanFit } from "../../shared/agents/specs";
import { canDriveWork, planQuality } from "../../shared/agents/quality";
import type { Diagnosis } from "../../shared/agents/diagnosis";
import { focusedPlanFixture } from "../fixtures/focusedPlan";

const diagnosis = (constraint: Diagnosis["constraint"], status: Diagnosis["status"] = "supported"): Diagnosis => ({ constraint, status, basis: "measured", readings: [], competing: "Synthetic competing explanation", missing: [] });

it.each(["focused", "starter"] as const)("applies existing paid eligibility to the %s recommendation without filtering creative alternatives", style => {
  const out = focusedPlanFixture();
  out.channels[0].suggestedMonthlyAdSpend = 150;
  const spec = style === "focused" ? focusedStrategySpec() : starterStrategySpec();
  for (const ownerGrossMargin of [0, -0.25]) {
    const constraints = { monthlyAdBudgetUsd: 200, ownerGrossMargin };
    const issues = spec.lint!(out, { task: "Recommend the next move", brief: "Synthetic business", facts: [], constraints }).filter(issue => issue.rule === "paid_acquisition_fit");
    expect(issues).toContainEqual(expect.objectContaining({ severity: "error", path: "channels[0].suggestedMonthlyAdSpend" }));
    expect(canDriveWork(planQuality([], issues))).toBe(false);
  }
  expect(out.strategyExploration.bold).toMatchObject({ evidenceStrength: "low", feasibility: "low", precedentIds: [] });
});

it.each(["activation", "conversion", "retention", "delivery", "economics"] as const)("blocks a paid allocation when the supported constraint is %s", constraint => {
  const out = focusedPlanFixture(); out.channels[0].suggestedMonthlyAdSpend = 150;
  const issues = lintPlanFit(out, { monthlyAdBudgetUsd: 200, diagnosis: diagnosis(constraint) });
  expect(issues).toContainEqual(expect.objectContaining({ severity: "error", rule: "paid_acquisition_fit" }));
});

it("does not interpret missing margin or uncertain diagnosis as paid ineligibility, or block unpaid preparation", () => {
  const out = focusedPlanFixture(); out.channels[0].suggestedMonthlyAdSpend = 150;
  for (const ownerGrossMargin of [undefined, 0.4]) for (const status of ["ambiguous", "insufficient_evidence", "conflicting_inputs"] as const) {
    const constraints = { monthlyAdBudgetUsd: 200, ownerGrossMargin, diagnosis: diagnosis("conversion", status) };
    expect(lintPlanFit(out, constraints)).toEqual([]);
  }
  expect(lintPlanFit(out, { monthlyAdBudgetUsd: 200, diagnosis: diagnosis("acquisition") })).toEqual([]);
  out.channels[0].suggestedMonthlyAdSpend = 0;
  const blockedBusiness = { ownerGrossMargin: 0, diagnosis: diagnosis("delivery") };
  expect(lintPlanFit(out, blockedBusiness)).toEqual([]);
});
