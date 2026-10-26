import { describe, expect, it } from "vitest";
import { lintDemandGate } from "../../shared/agents/specs";

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
});
