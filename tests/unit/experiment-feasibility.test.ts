import { describe, expect, it } from "vitest";
import { lintExperimentFeasibility } from "../../shared/agents/specs";

/** Slice 3 (BK06 Ch 2–3, 10–11; BK04 test requirements): tests in plans must be able to finish and be read once. */
const exp = (o: Partial<{ name: string; method: string; population: string; durationDays: number; stoppingRule: string; primaryMetric: string; primaryMetricType: "binary_rate" | "count" | "continuous" | "monetary"; assignmentUnit: string; assignmentMethod: string; denominator: string; baselineRate: number | null; baselineProvenance: "measured" | "owner_report" | "source_reported" | "unknown"; baselineEvidenceRefs: string[]; baselineBasis: string; minimumMeaningfulEffect: { value: number | null; unit: string; basis: string }; plannedSamplePerArm: number | null; plannedSampleBasis: string; guardrails: string[] }>) => ({ name: "Test", method: "ab_split", population: "", durationDays: 14, stoppingRule: "Read once on day 14", primaryMetric: "signups", primaryMetricType: "binary_rate" as const, assignmentUnit: "eligible visitor", assignmentMethod: "randomized", denominator: "eligible visitors assigned per arm", baselineRate: 0.1, baselineProvenance: "measured" as const, baselineEvidenceRefs: ["synthetic measured test fixture"], baselineBasis: "synthetic measured test fixture", minimumMeaningfulEffect: { value: 0.05, unit: "absolute_rate", basis: "predeclared synthetic threshold" }, plannedSamplePerArm: 700, plannedSampleBasis: "sampleSize calculator at alpha .05 and power .8", guardrails: ["Unsubscribes under 1%"], ...o });

describe("experiment feasibility", () => {
  it("requires an eligible count for split and holdout tests", () => {
    expect(lintExperimentFeasibility({ experiments: [exp({ population: "New visitors to the pricing page" })] })).toMatchObject([{ rule: "experiment_feasibility", path: "experiments[0].population" }]);
  });
  it("fails a test the traffic can't finish (EV28: 50 a month, 7 days)", () => {
    const issues = lintExperimentFeasibility({ experiments: [exp({ population: "About 50 qualified visitors a month", durationDays: 7 })] });
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toMatch(/before\/after labelled observational/);
  });
  it("passes a test with enough eligible people, per week or in total", () => {
    expect(lintExperimentFeasibility({ experiments: [exp({ population: "About 1,000 visitors a week", durationDays: 14 })] })).toEqual([]);
    expect(lintExperimentFeasibility({ experiments: [exp({ method: "holdout", population: "2,000 existing customers", durationDays: 30 })] })).toEqual([]);
  });
  it("leaves before/after and interview methods to their own labels", () => {
    expect(lintExperimentFeasibility({ experiments: [exp({ method: "pre_post_observational", population: "Everyone who books" })] })).toEqual([]);
  });
  it("blocks stopping a test when it looks significant (peeking)", () => {
    expect(lintExperimentFeasibility({ experiments: [exp({ method: "pre_post_observational", stoppingRule: "Stop as soon as the lift is significant" })] })).toMatchObject([{ rule: "experiment_feasibility", path: "experiments[0].stoppingRule" }]);
  });
  it("needs a whole week and 1-3 numeric guardrails (blog research BRP-21/22)", () => {
    const rules = (o: Parameters<typeof exp>[0]) => lintExperimentFeasibility({ experiments: [exp({ population: "About 2,000 visitors a week", ...o })] }).map((i) => i.path);
    expect(rules({ durationDays: 5 })).toContain("experiments[0].durationDays");
    expect(rules({ guardrails: [] })).toContain("experiments[0].guardrails");
    expect(rules({ guardrails: ["Keep refunds low"] })).toContain("experiments[0].guardrails");
    expect(rules({})).toEqual([]);
  });
  it("allows stopping early for harm, not for a win", () => {
    expect(lintExperimentFeasibility({ experiments: [exp({ population: "About 2,000 visitors a week", stoppingRule: "Stop when complaints rise significantly" })] })).toEqual([]);
    expect(lintExperimentFeasibility({ experiments: [exp({ population: "About 2,000 visitors a week", stoppingRule: "Stop once the lift is significant" })] })).toMatchObject([{ path: "experiments[0].stoppingRule" }]);
  });
  it("sizes on the owner's measured rate when the metric matches it", () => {
    // 300 a week for 35 days passes the generous default but not a 2% purchase baseline.
    const e = exp({ population: "About 300 visitors a week", durationDays: 35, primaryMetric: "booked calls" });
    expect(lintExperimentFeasibility({ experiments: [e] })).toEqual([]);
    const issues = lintExperimentFeasibility({ experiments: [e] }, { funnelRates: { purchase: 0.02 } });
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toMatch(/from your measured purchase rate/);
  });
  it("sizes qualified-lead experiments on the measured lead qualification rate", () => {
    const e = exp({ population: "About 50 leads a week", durationDays: 7, primaryMetric: "qualified leads" });
    const issues = lintExperimentFeasibility({ experiments: [e] }, { funnelRates: { lead: 0.1, qualification: 0.2, activation: 0.5, purchase: 0.3 } });
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toMatch(/from your measured qualification rate/);
  });
  it("requires the pre-registration contract and refuses unsupported binary baselines", () => {
    const issues = lintExperimentFeasibility({ experiments: [exp({ baselineRate: null, baselineProvenance: "unknown", baselineEvidenceRefs: [], baselineBasis: "No measured data is available", plannedSamplePerArm: null })] });
    expect(issues.map((issue) => issue.rule)).toContain("experiment_preregistration");
    expect(issues.map((issue) => issue.path)).toContain("experiments[0].baselineRate");
    expect(issues.map((issue) => issue.path)).toContain("experiments[0].plannedSamplePerArm");
  });
  it("checks the declared per-arm sample against the baseline and minimum effect", () => {
    const issues = lintExperimentFeasibility({ experiments: [exp({ population: "About 2,000 visitors a week", plannedSamplePerArm: 100 })] });
    expect(issues).toHaveLength(1);
    expect(issues[0].path).toBe("experiments[0].plannedSamplePerArm");
    expect(issues[0].message).toMatch(/default two-sided 5% alpha and 80% power/);
  });
});
