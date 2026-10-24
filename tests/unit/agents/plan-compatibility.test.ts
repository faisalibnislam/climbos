import { describe, expect, it } from "vitest";
import { EXPERT_PLAN_SCHEMA_VERSION, readExpertPlan } from "../../../shared/agents/planCompatibility";

describe("saved expert plan compatibility", () => {
  it("labels rows written before schema versioning as legacy and preserves their payload", () => {
    const legacy = { diagnosis: "Old plan", economics: { monthsRetained: 12 }, plays: [{ name: "Keep customers" }] };

    expect(readExpertPlan(legacy)).toEqual({ ...legacy, version: 0 });
  });

  it("preserves a supported saved version", () => {
    const current = {
      version: EXPERT_PLAN_SCHEMA_VERSION,
      diagnosis: "Current plan",
      growthPlanV9: { plays: [], economics: { revenuePerCustomerMonthUsd: 40, grossMargin: 0.7, monthlyChurn: 0.05, basis: "owner", sources: { revenue: { source: "owner", ref: "fact:revenue", quote: "" }, margin: { source: "owner", ref: "fact:margin", quote: "" }, churn: { source: "owner", ref: "fact:churn", quote: "" } } } },
      plays: [{ name: "Untrusted compatibility mirror" }],
      economics: { revenuePerCustomerMonthUsd: -1 },
    };

    expect(readExpertPlan(current)).toMatchObject({ version: EXPERT_PLAN_SCHEMA_VERSION, diagnosis: "Current plan", plays: [], economics: { revenuePerCustomerMonthUsd: 40 } });
  });

  it("fails closed when a current-version growth payload cannot be parsed", () => {
    const current = { version: EXPERT_PLAN_SCHEMA_VERSION, growthPlanV9: "not json", plays: [{ name: "Malformed mirror" }], economics: { revenuePerCustomerMonthUsd: 40 } };

    expect(readExpertPlan(current)).toMatchObject({ version: EXPERT_PLAN_SCHEMA_VERSION, growthPlanInvalid: true });
    expect(readExpertPlan(current)).not.toHaveProperty("plays");
    expect(readExpertPlan(current)).not.toHaveProperty("economics");
  });

  it("continues to read the v8 JSON envelope while v9 uses a nested object", () => {
    const payload = { plays: [], economics: { revenuePerCustomerMonthUsd: 40, grossMargin: 0.7, monthlyChurn: 0.05, basis: "owner", sources: { revenue: { source: "owner", ref: "fact:revenue", quote: "" }, margin: { source: "owner", ref: "fact:margin", quote: "" }, churn: { source: "owner", ref: "fact:churn", quote: "" } } } };
    expect(readExpertPlan({ version: 8, growthPlanV8: JSON.stringify(payload), plays: [{ name: "old mirror" }] })).toMatchObject({ plays: [], economics: payload.economics });
  });

  it("preserves a future version without guessing how to migrate it", () => {
    const future = { version: EXPERT_PLAN_SCHEMA_VERSION + 1, diagnosis: "Future plan" };

    expect(readExpertPlan(future)).toEqual(future);
  });

  it("treats invalid version values as legacy", () => {
    expect(readExpertPlan({ version: 1.5, diagnosis: "Plan" })).toEqual({ version: 0, diagnosis: "Plan" });
  });
});
