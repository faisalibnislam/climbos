import { describe, expect, it } from "vitest";
import { calculateSegmentEconomics, segmentEconomicsBrief } from "../../shared/agents/segmentEconomics";

describe("owner-reported segment economics", () => {
  it("calculates contribution and margin per customer deterministically", () => {
    const [result] = calculateSegmentEconomics([{ segment: "Small plans", currency: "USD", periodDays: 90, customers: 10, netRevenue: 1200, variableCosts: 900, costBoundary: "Usage and support costs", unknownCosts: [], costCoverage: "complete" }], "USD");
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

describe("segment evidence boundaries", () => {
  const row = { segment: "Small plans", currency: "USD", periodDays: 90, customers: 10, netRevenue: 1200, variableCosts: 900, costBoundary: "Usage and support costs", unknownCosts: [] };
  it("does not infer complete coverage from an empty list of unknown costs", () => {
    expect(calculateSegmentEconomics([row], "USD")[0].completeCostCoverage).toBe(false);
  });
  it("preserves missing costs as unknown rather than a zero-cost contribution", () => {
    expect(calculateSegmentEconomics([{ ...row, variableCosts: undefined }], "USD")[0]).toMatchObject({ contributionAfterListedCosts: null, contributionPerCustomer: null, contributionMargin: null });
    expect(segmentEconomicsBrief([{ ...row, variableCosts: undefined }], "USD")).not.toMatch(/NaN|Infinity/);
  });
  it("preserves three-decimal currency contribution", () => {
    expect(calculateSegmentEconomics([{ ...row, currency: "KWD", netRevenue: 10.123, variableCosts: 3.001 }], "USD")[0].contributionAfterListedCosts).toBe(7.122);
  });
  it.each([0, -2, NaN, Infinity])("withholds arithmetic for invalid customer count %s", customers => {
    expect(calculateSegmentEconomics([{ ...row, customers }], "USD")[0].contributionPerCustomer).toBe(null);
  });
  it.each(["", "ZZZ"])("does not substitute a currency for %s", currency => {
    expect(calculateSegmentEconomics([{ ...row, currency }], "USD")[0].contributionAfterListedCosts).toBe(null);
  });
});

describe("explicit segment cost and currency checks", () => {
  const base = { segment: "Small plans", currency: "USD", periodDays: 90, customers: 10, netRevenue: 1200, variableCosts: 900, costBoundary: "Usage and support costs", unknownCosts: [] };
  it("withholds contradictory complete-cost assertions", () => {
    const [result] = calculateSegmentEconomics([{ ...base, costCoverage: "complete", unknownCosts: ["support"] }]);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.contributionAfterListedCosts).toBe(null);
    expect(result.completeCostCoverage).toBe(false);
  });
  it("distinguishes explicit zero from missing amounts", () => {
    const [zero, missing] = calculateSegmentEconomics([{ ...base, netRevenue: 0, variableCosts: 0, costCoverage: "complete" }, { ...base, netRevenue: undefined }]);
    expect(zero).toMatchObject({ contributionAfterListedCosts: 0, contributionMargin: null, completeCostCoverage: true });
    expect(missing).toMatchObject({ contributionAfterListedCosts: null, revenuePerCustomer: null });
  });
  it("preserves refund-dominated negative net revenue without claiming a positive margin", () => {
    expect(calculateSegmentEconomics([{ ...base, netRevenue: -20.01, variableCosts: 10.02 }])[0]).toMatchObject({ contributionAfterListedCosts: -30.03, contributionMargin: null });
  });
  it.each([ ["JPY", 0.5], ["USD", 1.001], ["KWD", 1.0001], ["USD", 0.00000001] ])("rejects unsupported %s precision %s rather than rounding", (currency, netRevenue) => {
    expect(calculateSegmentEconomics([{ ...base, currency: String(currency), netRevenue: Number(netRevenue) }])[0].contributionAfterListedCosts).toBe(null);
  });
  it("keeps mismatched currencies separate and retains all context caveats when bounded", () => {
    const rows = Array.from({ length: 8 }, (_, i) => ({ ...base, segment: `Segment ${i}`, currency: i % 2 ? "KWD" : "USD", costBoundary: "Known costs ".repeat(18), strategicValueNote: "Longer-term value ".repeat(12), unknownCosts: ["support, refunds and other not-yet-known delivery charges"] }));
    const brief = segmentEconomicsBrief(rows, "BDT");
    expect(brief.length).toBeLessThanOrEqual(3000);
    expect(brief).toContain("Some groups omitted");
    expect(brief).toContain("equal period lengths alone do not establish comparable dates");
    expect(brief).toContain("No spending or execution is authorized");
    expect(brief).toContain("USD"); expect(brief).toContain("KWD");
    expect(brief).not.toContain("300 BDT");
  });
});
