import { describe, expect, it } from "vitest";
import { planLearningView, PlanLearningOutputSchema } from "../../shared/climb/planLearning";
import { encodeToolOutput } from "../../convex/lib/climbTools";
import { focusedPlanFixture } from "../fixtures/focusedPlan";
import type { OutcomeInput } from "../../shared/growth/experimentOutcome";

const fixture = focusedPlanFixture();
const test = { ...fixture.experiments[0], id: "experiment", status: "concluded", analyses: [] };
const report = (patch: Partial<OutcomeInput> = {}) => ({ executed: true, source: "owner_report" as const, design: "before_after" as const, metric: test.primaryMetric, successRule: test.stoppingRule, result: "unclear" as const, stopRuleHit: false, n: 1, inference: "observed" as const, redefined: false, reviewedAt: Date.now() - 1_000, ...patch });
const plan = { id: "strategy", version: 2, primaryTitle: test.name };

describe("assistant learning view", () => {
  it.each(["met", "missed", "unclear"] as const)("preserves reported %s without deriving success from status", result => {
    const value = planLearningView(plan, [{ ...test, status: "proposed", analyses: [report({ result })] }]);
    expect(value.experiments[0].details?.report?.result).toBe(result);
    expect(value.experiments[0].details?.report?.reading).toContain("not proof of cause");
    expect(value.coverage).toContain("status alone is not a business result");
  });

  it("keeps no report and not run distinct and never resurrects an earlier success", () => {
    expect(planLearningView(plan, [test]).experiments[0].details?.report).toBeNull();
    const value = planLearningView(plan, [{ ...test, analyses: [report({ result: "met" }), { ...report({ executed: false }), n: 2 }] }]);
    expect(value.experiments[0].details?.report?.reading).toContain("NOT RUN");
    expect(value.experiments[0].details?.report?.reading).not.toContain("met");
  });

  it("retains unknown money comparison, cost boundary, source and original failed definition", () => {
    const value = planLearningView(plan, [{ ...test, analyses: [report({ result: "missed" }), { ...report({ result: "met", metric: "Contribution", measurement: { type: "monetary", currency: "KWD", value: -1234, comparisonValue: null, unit: "net contribution", basis: "One job after variable costs; overhead excluded", comparisonBasis: "Earlier contribution unknown" } }), n: 2 }] }]);
    const reading = value.experiments[0].details!.report!;
    expect(reading.redefined).toBe(true);
    for (const text of ["KWD", "1.234", "Comparison value: Unknown", "overhead excluded", "Member-entered", "exploratory only", "original definition it missed"]) expect(reading.reading).toContain(text);
  });

  it("omits complete oversized details and supports reading another record separately", () => {
    const large = { ...test, id: "large", hypothesis: "x".repeat(9_000), analyses: [report()] };
    const value = planLearningView(plan, [large, { ...test, id: "small" }]);
    expect(value.experiments[0].details).toBeNull();
    expect(value.experiments[0].limitation).toContain("omitted in full");
    expect(value.experiments[1].details?.hypothesis).toBe(test.hypothesis);
    const encoded = encodeToolOutput(value, 7_800, PlanLearningOutputSchema);
    expect(encoded.length).toBeLessThan(7_800);
    expect(JSON.parse(encoded).truncated).toBeUndefined();
    expect(encoded).not.toContain("x".repeat(100));
  });

  it("bounds escaped names and retains the primary record before unrelated metadata", () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({ ...test, id: `other-${i}`, name: "<".repeat(100), analyses: [] }));
    const value = planLearningView(plan, [...rows, test]);
    expect(value.experiments[0].id).toBe(test.id);
    expect(value.omittedExperiments).toBeGreaterThan(0);
    const encoded = encodeToolOutput(value, 7_800, PlanLearningOutputSchema);
    expect(encoded.length).toBeLessThan(7_800);
    expect(JSON.parse(encoded).truncated).toBeUndefined();
    expect(encoded).not.toContain("<");
  });

  it("withholds invalid latest report dates without replacing them with an older report", () => {
    const value = planLearningView(plan, [{ ...test, analyses: [report({ result: "met" }), { ...report(), reviewedAt: Date.now() + 86_400_000 }] }]);
    expect(value.experiments[0].details).toBeNull();
    expect(value.experiments[0].limitation).toContain("No earlier report substituted");
  });
});
