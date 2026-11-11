import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StrategicDirectionSchema, lintStrategicDirection } from "../../shared/agents/strategicDirection";
import { StrategicDirectionPanel } from "../../src/components/app/plan/StrategicDirection";
import { growthPlaysSpec, strategySpec } from "../../shared/agents/specs";
import { selectStrategyQualityCases } from "../../bench/strategy-quality/cases";

const direction = {
  ambition: "Become the simplest way for small agencies to turn a client request into a ready-to-start project.",
  customer: "An agency owner receiving a new client request before the project is scoped.",
  unmetNeed: "A plain questionnaire does not show whether the request is ready for delivery.",
  winningApproach: "Test a reusable intake-to-project handoff that pairs the form with the agency's actual scoping decision.",
  whyThisBusiness: "Branching forms and response workflows are published capabilities; the actual handoff needs checking.",
  compoundingAdvantage: "Each owner-approved example could improve the next reusable agency workflow.",
  horizon: "Proposed next year",
  currentBet: "Review one agency's existing intake process before proposing a small prototype.",
  nextHorizon: "If the pilot proves useful, test a reusable workflow with another similar agency.",
  notNow: ["A broad campaign across every software directory."],
  assumptions: ["Agencies consider the handoff worth paying for; no customer evidence has been supplied."],
  changeCourseIf: "Agencies value the questionnaire but see no useful difference in the handoff.",
  evidenceRefs: ["https://livoform.com/"],
};

describe("business direction survives uncertainty", () => {
  it("accepts a specific hypothesis without a fabricated numerical growth target", () => {
    expect(StrategicDirectionSchema.safeParse(direction).success).toBe(true);
    expect(lintStrategicDirection(direction, [], ["https://livoform.com/"])).toEqual([]);
    expect(lintStrategicDirection({ ...direction, currentBet: "Social media" }, [], ["https://livoform.com/"])).toContainEqual(expect.objectContaining({ rule: "generic_action" }));
    expect(lintStrategicDirection(direction, [], [])).toContainEqual(expect.objectContaining({ rule: "citation" }));
  });
  it("requires the direction in new generation while old saved plans remain readable", () => {
    const schema = growthPlaysSpec().schema;
    const parsed = schema.safeParse({});
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues.some((issue) => issue.path[0] === "strategicDirection")).toBe(true);
    expect(renderToStaticMarkup(createElement(StrategicDirectionPanel, { direction: undefined }))).toBe("");
    const html = renderToStaticMarkup(createElement(StrategicDirectionPanel, { direction }));
    expect(html).toContain("Where your business could go");
    expect(html).toContain("Who we want to reach");
    expect(html).toContain("Why they would choose you");
    expect(html).toContain("How this could grow");
    expect(html).toContain("<details");
    expect(html).not.toContain("<details open");
    expect(html).toContain("not a forecast");
  });
  it("does not punish an honest unknown target as a failure of ambition", () => {
    const issues = strategySpec().lint?.({ northStar: { metric: "Paid pilot decisions", baseline: "Unknown", target: "Unknown until the pilot is measured" }, summary: "Test the specific workflow before committing more resources.", channels: [], firstActions: [], leadingIndicators: [], weekOneChecklist: [], audiences: [], experiments: [], phases: [], risks: [], constraints: [], notDoing: [], diagnosis: "Buyer demand is not yet known.", positioning: "Agency intake with a useful delivery handoff.", affordableCac: "Unknown", measurementPlan: "Record paid pilot decisions." }, { task: "Plan a pilot", brief: "No customer evidence supplied", facts: [] }) ?? [];
    expect(issues.filter((issue) => issue.rule === "ambition")).toEqual([]);
  });
  it("keeps acceptance questions out of the supplied business evidence", () => {
    const cases = selectStrategyQualityCases();
    expect(cases).toHaveLength(8);
    for (const item of cases) for (const question of item.reviewQuestions) {
      expect(item.brief).not.toContain(question);
      expect(item.research.notes).not.toContain(question);
    }
    expect(() => selectStrategyQualityCases("not-a-case")).toThrow();
  });
});
