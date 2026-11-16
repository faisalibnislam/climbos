import { describe, expect, it } from "vitest";
import { lintDemandGate, focusedStrategySpec, starterStrategySpec } from "../../shared/agents/specs";
import { focusedPlanFixture } from "../fixtures/focusedPlan";
import { planQuality, canDriveWork } from "../../shared/agents/quality";

const play = (name: string, monthlySpendUsd: number) => ({ name, model: { monthlySpendUsd } });
const weak = { demandValidation: { reasons: ["The latest business model check judged the current model at risk."] } };

describe("demand-validation gate", () => {
  it("blocks a plan that leads with ad spend when demand isn't validated", () => {
    const issues = lintDemandGate([play("Meta ads", 600), play("Past-customer offer", 0)], weak);
    expect(issues).toEqual([expect.objectContaining({ severity: "error", rule: "demand_gate", path: "plays[0].model.monthlySpendUsd" })]);
    expect(issues[0].message).toContain("at risk");
  });

  it("allows a supporting paid test but flags it as a test", () => {
    const issues = lintDemandGate([play("Customer interviews", 0), play("Small search ads test", 150)], weak);
    expect(issues.map((i) => i.severity)).toEqual(["warn"]);
  });

  it("does nothing when demand is validated or unknown to the gate", () => {
    expect(lintDemandGate([play("Meta ads", 600)], {})).toEqual([]);
    expect(lintDemandGate([play("Meta ads", 600)], undefined)).toEqual([]);
  });

  it("makes a demand-gate error block work while a supporting-test warning does not", () => {
    const failed = planQuality([], lintDemandGate([play("Meta ads", 600)], weak));
    expect(failed.state).toBe("failed");
    expect(canDriveWork(failed)).toBe(false);
    expect(planQuality([], lintDemandGate([play("Private demand test", 0), play("Supporting paid test", 150)], weak)).state).not.toBe("failed");
  });

  it.each(["focused", "starter"] as const)("checks primary spend in the %s plan without filtering bold exploration", style => {
    const out = focusedPlanFixture();
    out.channels[0].suggestedMonthlyAdSpend = 150;
    const spec = style === "focused" ? focusedStrategySpec() : starterStrategySpec();
    const lint = (constraints = weak) => spec.lint!(out, { task: "Plan a useful next step", brief: "Synthetic business", facts: [], constraints }).filter(issue => issue.rule === "demand_gate");
    expect(lint()).toContainEqual(expect.objectContaining({ severity: "error", path: "channels[0].suggestedMonthlyAdSpend" }));
    out.channels.push({ ...out.channels[0], name: "Unpaid demand test", priority: 0, suggestedMonthlyAdSpend: 0 });
    expect(lint().map(issue => issue.severity)).toEqual(["warn"]);
    // Tied first priority cannot hide a primary paid recommendation behind an unpaid one.
    out.channels[1].priority = 1;
    expect(lint()).toContainEqual(expect.objectContaining({ severity: "error", path: "channels[0].suggestedMonthlyAdSpend" }));
    expect(lint({ demandValidation: { reasons: [] } })).toEqual([]);
    expect(out.strategyExploration.bold).toMatchObject({ evidenceStrength: "low", feasibility: "low", precedentIds: [] });
  });
});
