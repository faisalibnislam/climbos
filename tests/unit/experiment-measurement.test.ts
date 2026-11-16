import { describe, expect, it } from "vitest";
import { inferenceOf, isRedefined, measurementInputValue, measurementProblems, measurementText, outcomeLine, outcomeProblems, parseMeasurementValue, sameDefinition, type OutcomeInput, type OutcomeMeasurement } from "../../shared/growth/experimentOutcome";

const measurement: OutcomeMeasurement = { type: "continuous", value: 2.5, comparisonValue: null, unit: "hours per request", basis: "Mean owner preparation time across two requests", comparisonBasis: "No earlier observation" };
const report: OutcomeInput = { executed: true, source: "owner_report", design: "before_after", metric: "Preparation time", successRule: "Review whether effort fits the owner's capacity", result: "unclear", stopRuleHit: false, measurement };

describe("typed owner-reported experiment measurements", () => {
  it("preserves unknown versus zero and the actual metric without a conversion-rate claim", () => {
    expect(measurementProblems(measurement)).toEqual([]);
    expect(measurementText(measurement)).toContain("2.5 hours per request");
    expect(measurementText(measurement)).toContain("Comparison value: Unknown");
    expect(measurementText({ ...measurement, comparisonValue: 0 })).toContain("Comparison value: 0 hours per request");
    expect(outcomeLine("Workflow review", { ...report, inference: "observed", redefined: false })).toContain(measurement.basis);
    expect(outcomeLine("Workflow review", { ...report, inference: "observed", redefined: false })).not.toContain("conversions");
  });
  it("cannot turn two aggregate values and reported random assignment into a significance result", () => {
    const input = { ...report, design: "randomized" as const, assignment: "random" as const, exposed: 200, controlSize: 200 };
    expect(inferenceOf(input)).toBe("observed");
    expect(outcomeLine("Workflow review", { ...input, inference: "incremental", redefined: false })).not.toContain("REPORTED RANDOMIZED COMPARISON");
    expect(outcomeLine("Workflow review", { ...input, inference: "incremental", redefined: false })).not.toContain("p =");
    expect(inferenceOf({ ...input, source: "platform_report" })).toBe("attributed");
  });
  it.each([NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1])("rejects invalid measured value %s", value => {
    expect(measurementProblems({ ...measurement, value }).length).toBeGreaterThan(0);
    expect(measurementText({ ...measurement, value })).toContain("invalid");
  });
  it("checks units, scope, comparison basis and whole counts without inventing a baseline", () => {
    for (const patch of [{ unit: " " }, { basis: "" }, { comparisonValue: 3, comparisonBasis: "" }, { type: "count" as const, value: -1 }, { type: "count" as const, value: 1.5 }, { currency: "USD" }]) expect(measurementProblems({ ...measurement, ...patch }).length).toBeGreaterThan(0);
    expect(measurementProblems({ ...measurement, type: "count", value: 0 })).toEqual([]);
    expect(measurementProblems({ ...measurement, value: null })).toEqual([]);
  });
  it("allows negative contribution but requires supported currency and integer minor units", () => {
    const money: OutcomeMeasurement = { ...measurement, type: "monetary", currency: "USD", unit: "contribution", value: -1250 };
    expect(measurementProblems(money)).toEqual([]);
    expect(measurementText(money)).toContain("-$12.50 USD");
    for (const patch of [{ currency: undefined }, { currency: "XYZ" }, { value: 12.5 }]) expect(measurementProblems({ ...money, ...patch }).length).toBeGreaterThan(0);
  });
  it.each([["USD", "-12.50", -1250], ["JPY", "12", 12], ["KWD", "1.234", 1234], ["USD", "90071992547409.91", Number.MAX_SAFE_INTEGER]] as const)("round trips exact %s amounts", (currency, input, value) => {
    expect(parseMeasurementValue(input, "monetary", currency)).toBe(value);
    expect(measurementInputValue(value, "monetary", currency)).toBe(input);
  });
  it("rejects unsupported precision, malformed input and fractional counts", () => {
    expect(() => parseMeasurementValue("1.5", "monetary", "JPY")).toThrow(/decimal places/);
    expect(() => parseMeasurementValue("2.3", "count")).toThrow();
    expect(() => parseMeasurementValue("1e3", "continuous")).toThrow();
    expect(parseMeasurementValue(" ", "count")).toBeNull();
    expect(parseMeasurementValue("0", "count")).toBe(0);
  });
  it("rejects mixing metric values with conversion counts or not-run reports", () => {
    expect(outcomeProblems({ ...report, conversions: 1 }, "2026-11-17")).toContain("Record the metric value separately; it cannot also be a conversion count.");
    expect(outcomeProblems({ ...report, executed: false }, "2026-11-17")).toContain("A test that did not run cannot include measured values.");
    expect(outcomeProblems({ ...report, design: "none", measurement: { ...measurement, comparisonValue: 3 } }, "2026-11-17").length).toBeGreaterThan(0);
  });
  it("treats value corrections differently from changing the measurement definition", () => {
    expect(sameDefinition(report, { ...report, measurement: { ...measurement, value: 0 } })).toBe(true);
    const original = { primaryMetric: report.metric, stoppingRule: report.successRule, primaryMetricType: "continuous" };
    expect(isRedefined(report, original, report)).toBe(false);
    for (const patch of [{ unit: "minutes per request" }, { basis: "Total time, not mean time" }, { comparisonBasis: "Different population" }]) {
      const changed = { ...report, measurement: { ...measurement, ...patch } };
      expect(sameDefinition(report, changed)).toBe(false);
      expect(isRedefined(changed, original, report)).toBe(true);
    }
    expect(isRedefined(report, { ...original, primaryMetricType: "count" })).toBe(true);
  });
  it("does not interpret legacy non-binary values as conversion lift", () => {
    const legacy = { ...report, measurement: undefined, conversions: 4, exposed: 10, inference: "observed" as const, redefined: false };
    expect(outcomeLine("Workflow", legacy, undefined, "continuous")).toContain("Primary metric value unknown");
    expect(outcomeLine("Workflow", legacy, undefined, "continuous")).not.toContain("4 conversions");
  });
});
