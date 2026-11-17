import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { businessModelPlanContext, BusinessModelCheckSchema, BusinessModelGenerationSchema, demoBusinessModelCheck, lintBusinessModelCheck } from "../../shared/agents/businessModel";
import { emptyStrategicLandscape, lintStrategicLandscape, StrategicLandscapeSchema, type StrategicLandscape } from "../../shared/agents/strategicLandscape";
import { researchFor, businessModelCheckSpec } from "../../shared/agents/specs";
import { StrategicLandscapeView } from "../../src/components/app/plan/StrategicLandscapeView";

const signal = { dimension: "cost_structure" as const, direction: "unknown" as const, basis: "owner_report" as const, finding: "Owner reports delivery depends on one specialist supplier.", evidenceRefs: ["fact:0"], limitation: "No independent verification or alternative supplier quote.", observedAt: "2026-11-01" };
const response = { basis: "evidence_supported_inference" as const, signalIndexes: [0], mechanism: "A supplier interruption could delay existing customer deliveries.", businessImplication: "Delivery promises may depend on an untested alternative supplier.", possibleResponse: "Investigate a small backup supply arrangement before expanding demand.", tradeoff: "Comparing a backup takes owner time and may increase unit cost.", nextCheck: "Ask a potential backup for its actual lead time and compare it with current commitments." };
function sample(): StrategicLandscape {
  const value = emptyStrategicLandscape();
  value.forces = [{ ...response, force: "supplier_power", pressure: "high" }];
  value.unassessedForces = value.unassessedForces.filter(key => key !== "supplier_power");
  value.macroFactors = [{ ...response, basis: "speculative_hypothesis", signalIndexes: [], factor: "technological", direction: "unknown", mechanism: "A different production process might reduce dependence on the specialist.", nextCheck: "Ask the owner which production step can be safely prototyped." }];
  value.unassessedMacroFactors = value.unassessedMacroFactors.filter(key => key !== "technological");
  value.priorityRefs = ["force:supplier_power"];
  value.decisionSummary = "Check delivery dependence before choosing whether to expand or test another model.";
  return value;
}

describe("competitive structure and external context", () => {
  it("requires explicit coverage for new generation while preserving old reports", () => {
    const check = demoBusinessModelCheck("Synthetic business");
    expect(BusinessModelGenerationSchema.safeParse(check).success).toBe(true);
    delete check.strategicLandscape;
    expect(BusinessModelCheckSchema.safeParse(check).success).toBe(true);
    expect(BusinessModelGenerationSchema.safeParse(check).success).toBe(false);
    expect(lintStrategicLandscape(emptyStrategicLandscape(), [])).toEqual([]);
  });
  it("keeps source observations separate from pressure judgments and unsupported possibilities", () => {
    expect(StrategicLandscapeSchema.safeParse(sample()).success).toBe(true);
    expect(lintStrategicLandscape(sample(), [signal])).toEqual([]);
    const check = demoBusinessModelCheck("Synthetic business"); check.marketSignals = [signal]; check.strategicLandscape = sample();
    expect(lintBusinessModelCheck(check, { factCount: 1, factEvidenceBases: ["owner_reported"], readUrls: [] })).toEqual([]);
    check.strategicLandscape.scopeBasis = "measured"; check.strategicLandscape.scopeEvidenceRefs = ["fact:0"];
    expect(lintBusinessModelCheck(check, { factCount: 1, factEvidenceBases: ["owner_reported"], readUrls: [] })).toContainEqual(expect.objectContaining({ rule: "evidence_basis", path: "strategicLandscape.scopeBasis" }));
  });
  it.each(["missing_force", "duplicate_force", "overlap", "missing_macro", "duplicate_macro", "missing_signal", "duplicate_signal", "unsupported_inference", "priority_unknown", "duplicate_priority", "no_priority"])("rejects %s coverage or evidence", kind => {
    const value = sample();
    if (kind === "missing_force") value.unassessedForces.pop();
    if (kind === "duplicate_force") value.forces.push(value.forces[0]);
    if (kind === "overlap") value.unassessedForces.push("supplier_power");
    if (kind === "missing_macro") value.unassessedMacroFactors.pop();
    if (kind === "duplicate_macro") value.macroFactors.push(value.macroFactors[0]);
    if (kind === "missing_signal") value.forces[0].signalIndexes = [7];
    if (kind === "duplicate_signal") value.forces[0].signalIndexes = [0, 0];
    if (kind === "unsupported_inference") value.macroFactors[0].basis = "evidence_supported_inference";
    if (kind === "no_priority") value.priorityRefs = [];
    if (kind === "priority_unknown") value.priorityRefs = ["force:rivalry"];
    if (kind === "duplicate_priority") value.priorityRefs.push(value.priorityRefs[0]);
    expect(lintStrategicLandscape(value, [signal]).some(issue => issue.severity === "error")).toBe(true);
  });
  it("does not turn a cited speculation into evidence", () => {
    expect(lintStrategicLandscape(sample(), [{ ...signal, basis: "inference" }])).toContainEqual(expect.objectContaining({ path: "strategicLandscape.forces[0].basis" }));
  });
  it("rejects missing business consequences, tradeoffs and tests structurally", () => {
    for (const field of ["mechanism", "businessImplication", "possibleResponse", "tradeoff", "nextCheck"] as const) {
      const value = sample(); value.forces[0][field] = "";
      expect(StrategicLandscapeSchema.safeParse(value).success).toBe(false);
    }
  });
  it("carries prioritized reasoning into later planning without hiding a bold model", () => {
    const check = demoBusinessModelCheck("Synthetic business"); check.strategicLandscape = sample();
    const context = businessModelPlanContext(check, 1);
    expect(context).toContain(response.businessImplication); expect(context).toContain(response.nextCheck);
    expect(context).toContain("AI interpretations"); expect(context).toContain("bold");
    const historical = businessModelPlanContext(check, 1, { status: "changed", changed: ["facts"], capturedAt: 1, checkedAt: 2, reason: "Facts changed" });
    expect(historical).not.toContain(response.businessImplication); expect(historical).toContain("Keep all three");
  });
  it("keeps research bounded and asks for applicable primary evidence and unknown coverage", () => {
    const research = researchFor("business_model_check", { businessName: "Synthetic business", today: "2026-11-17" })!;
    const criterion = businessModelCheckSpec().rubric.criteria.find(row => row.id === "strategic-pressure-relevance");
    expect(criterion?.anchors[5]).toContain("do not penalize novelty or uncertainty alone");
    expect(criterion?.anchors[1]).toContain("Generic framework lists");
    expect(research.maxSearches).toBe(5); expect(research.maxFetches).toBe(4);
    expect(research.brief).toContain("unassessed"); expect(research.brief).toContain("Unknown geography"); expect(research.brief).toContain("official sources");
  });
  it("shows impacts, tradeoffs, sources and unknown geography without an unexplained score", () => {
    const html = renderToStaticMarkup(createElement(StrategicLandscapeView, { landscape: sample(), signals: [signal], facts: [{ statement: signal.finding, basis: "owner_reported" }] }));
    for (const text of ["What could change this decision", "Served geography", "Unknown", response.businessImplication, response.possibleResponse, response.tradeoff, response.nextCheck, "Speculative hypothesis", signal.limitation, "Business fact 1", "Not assessed means unknown"]) expect(html).toContain(text);
    expect(html).not.toContain('href="#sources-heading"');
  });
});
