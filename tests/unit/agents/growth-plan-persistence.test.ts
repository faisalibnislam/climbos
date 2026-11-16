import { describe, expect, it } from "vitest";
import { assertCurrentExpertGrowthPayload } from "../../../shared/agents/growthPlanPersistence";

describe("current expert growth-plan persistence", () => {
  const economics = {
    revenuePerCustomerMonthUsd: 100,
    grossMargin: 0.7,
    monthlyChurn: 0.05,
    basis: "Owner confirmed",
    sources: {
      revenue: { source: "owner", ref: "fact:revenue", quote: "" },
      margin: { source: "owner", ref: "fact:margin", quote: "" },
      churn: { source: "owner", ref: "fact:churn", quote: "" },
    },
  };

  it("rejects malformed economics carrying current source provenance", () => {
    expect(() => assertCurrentExpertGrowthPayload([], { ...economics, grossMargin: 1.1 })).toThrow(/economics/u);
  });

  it.each([0, -0.1, -2])("preserves an owner-confirmed contribution margin of %s", grossMargin => {
    expect(() => assertCurrentExpertGrowthPayload([], { ...economics, grossMargin })).not.toThrow();
  });

  it("rejects malformed plays when saving a current sourced plan", () => {
    expect(() => assertCurrentExpertGrowthPayload([{ name: "Missing typed play fields" }], economics)).toThrow(/play/u);
  });

  it("keeps legacy plans without structured economics provenance compatible", () => {
    expect(() => assertCurrentExpertGrowthPayload([{ name: "Legacy play" }], { revenuePerCustomerMonthUsd: 40, basis: "old" })).not.toThrow();
  });
});
