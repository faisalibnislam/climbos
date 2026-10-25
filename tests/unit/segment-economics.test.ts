import { describe, expect, it } from "vitest";
import { calculateSegmentEconomics, segmentEconomicsBrief } from "../../shared/agents/segmentEconomics";

describe("owner-reported segment economics", () => {
  it("calculates contribution and margin per customer deterministically", () => {
    const [result] = calculateSegmentEconomics([{ segment: "Small plans", currency: "USD", periodDays: 90, customers: 10, netRevenue: 1200, variableCosts: 900, costBoundary: "Usage and support costs", unknownCosts: [] }], "USD");
    expect(result).toMatchObject({ contributionAfterListedCosts: 300, revenuePerCustomer: 120, contributionPerCustomer: 30, contributionMargin: 0.25, completeCostCoverage: true, basis: "owner_reported" });
  });

  it("keeps incomplete segment costs from being described as full profitability", () => {
    const [result] = calculateSegmentEconomics([{ segment: "Large plans", currency: "USD", periodDays: 180, customers: 4, netRevenue: 2000, variableCosts: 700, costBoundary: "Usage cost only; excludes support", unknownCosts: ["support time"] }], "USD");
    expect(result).toMatchObject({ contributionAfterListedCosts: 1300, completeCostCoverage: false, unknownCosts: ["support time"] });
    const brief = segmentEconomicsBrief([{ segment: "Large plans", currency: "USD", periodDays: 180, customers: 4, netRevenue: 2000, variableCosts: 700, costBoundary: "Usage cost only; excludes support", unknownCosts: ["support time"] }], "USD");
    expect(brief).toContain("not full profitability");
    expect(brief).toContain("Do not automatically exclude a group");
  });

  it("does not infer profitability when no segment inputs exist", () => {
    expect(segmentEconomicsBrief(undefined, "USD")).toContain("Do not infer segment profitability");
  });
});
