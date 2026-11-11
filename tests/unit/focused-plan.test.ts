import { describe, expect, it, vi } from "vitest";
import { focusedPlanFixture } from "../fixtures/focusedPlan";
import { FocusedStrategySchema, focusedStrategySpec, starterStrategySpec, strategySpec, lintPreparedDrafts } from "../../shared/agents/specs";
import { focusedPlanTask, focusedRefreshContext } from "../../shared/agents/focusedPlan";
import { lintCycleMilestones } from "../../shared/agents/planningCycles";
import {lintAgentOutput} from "../../shared/agents/runtime";
import { planJob, maxJobMicros } from "../../convex/lib/jobPlans";

describe("a focused plan does useful work without invented forecasts", () => {
  it.each([14, 30, 90])("requires concrete %i-day milestones and real starter drafts", days => {
    const plan = focusedPlanFixture(days);
    expect(lintCycleMilestones(plan.phases, days)).toEqual([]);
    expect(FocusedStrategySchema.safeParse({ ...plan, preparedWork: [] }).success).toBe(false);
    expect(lintCycleMilestones(plan.phases.slice(1), days)).toContainEqual(expect.objectContaining({ severity: "error" }));
    expect(plan).not.toHaveProperty("plays"); expect(plan).not.toHaveProperty("economics");
    const issues = focusedStrategySpec().lint?.(plan, { task: focusedPlanTask(days), brief: "Synthetic workflow test, not business evidence", facts: [], constraints: { horizonDays: days, monthlyAdBudgetUsd: 0 } });
    expect(issues?.filter(i => i.severity === "error")).toEqual([]);
  });
  it("rejects analytics homework as the first action, missing citations and unbudgeted spend", () => {
    const plan = focusedPlanFixture(); plan.focusedMove.firstAction = "Export analytics and baseline metrics before starting."; plan.focusedMove.evidenceRefs = ["fact:7"]; plan.channels[0].suggestedMonthlyAdSpend = 100;
    const issues = focusedStrategySpec().lint?.(plan, { task: focusedPlanTask(14), brief: "Synthetic test", facts: [], constraints: { horizonDays: 14, monthlyAdBudgetUsd: 0 } });
    expect(issues).toContainEqual(expect.objectContaining({ rule: "generic_action", severity: "error" }));
    expect(issues).toContainEqual(expect.objectContaining({ rule: "citation", severity: "error" }));
    expect(issues?.some(i => /budget/i.test(i.rule) && i.severity === "error")).toBe(true);
  });
  it("keeps the same safety gates and acceptance bar, with fewer paid phases", () => {
    const focused = focusedStrategySpec(), detailed = strategySpec();
    expect(focused.rubric.gates).toEqual(detailed.rubric.gates); expect(focused.rubric.shipRule).toEqual(detailed.rubric.shipRule);
    vi.stubEnv("CLIMBOS_ENGINE", "v2");
    const small = planJob("strategy", { planStyle: "focused" }), large = planJob("strategy", { planStyle: "detailed" });
    expect(small.steps.length).toBeLessThan(large.steps.length);
    expect(maxJobMicros(small)).toBeLessThan(maxJobMicros(large));
    vi.unstubAllEnvs();
  });
  it("distinguishes proposed recording cues from invented dashboard counts and unfinished public copy",()=>{
    const input={task:"Prepare a proposed demo",brief:"No performance data supplied",facts:[]};
    expect(lintPreparedDrafts([{kind:"test_brief",draft:"0:40 Show the existing question.\n0:52 Close with the next step. Proposed demo, not recorded or tested."}],input).some(issue=>issue.rule==="invented_fact")).toBe(false);
    expect(lintPreparedDrafts([{kind:"social_post",draft:"Our form had 417 completions yesterday. See [page link]."}],input)).toEqual(expect.arrayContaining([expect.objectContaining({rule:"invented_fact",severity:"error"}),expect.objectContaining({rule:"generic_action",severity:"error"})]));
  });
  it("carries useful draft work into an update without turning old forecasts or approvals into context",()=>{
    const value=JSON.parse(focusedRefreshContext({...focusedPlanFixture(),approved:true,permission:"publish",facts:["Unverified old claim"],economics:{forecast:10000},plays:[{name:"An old proposal",oneLiner:"Useful idea to recheck",model:{conversion:0.2},approved:true}]}));
    expect(value.preparedWork[0].draft).toContain("proposed test");expect(value.plays[0].name).toBe("An old proposal");
    expect(value.strategicDirection.nextHorizon).toBe(focusedPlanFixture().strategicDirection.nextHorizon);
    expect(value.strategicDirection.compoundingAdvantage).toBe(focusedPlanFixture().strategicDirection.compoundingAdvantage);
    for(const key of ["facts","approved","permission","economics"])expect(value).not.toHaveProperty(key);
    expect(value.plays[0]).not.toHaveProperty("model");expect(value.plays[0]).not.toHaveProperty("approved");expect(value.preparedWork[0]).not.toHaveProperty("status");
  });
  it("keeps Sonnet judgment while limiting optional starter corrections to the original quote",()=>{
    const spec=starterStrategySpec();
    expect(spec.models.draft).toBe(focusedStrategySpec().models.draft);expect(spec.models.critic).toBe(focusedStrategySpec().models.critic);
    expect(spec.maxRevisions).toBe(1);expect(spec.revisionWithinInitialCap).toBe(true);
    const plan=planJob("strategy",{planStyle:"starter"});expect(plan.revisionSteps).toEqual([]);
  });
  it("retains a longer destination note with its conditions instead of truncating safety context",()=>{
    const plan=focusedPlanFixture();plan.preparedWork[0].target="A proposed destination and its context. ".repeat(10)+"Do not send until the contact policy is checked.";
    const parsed=FocusedStrategySchema.parse(plan);expect(parsed.preparedWork[0].target).toBe(plan.preparedWork[0].target);
    plan.preparedWork[0].target="x".repeat(601);expect(FocusedStrategySchema.safeParse(plan).success).toBe(false);
  });
  it("uses the same supplied research index in independent reviews as in the production runtime",()=>{
    const plan=focusedPlanFixture(),url="https://business.example/observed-resource";
    plan.channels[0].cites=[url];plan.audiences[0].cites=[url];
    const issues=lintAgentOutput(focusedStrategySpec(),{task:focusedPlanTask(14),brief:"Isolated source-index regression",facts:[],precomputedResearch:{notes:"An observed published resource, not measured demand.",sources:[{url}]},constraints:{horizonDays:14,monthlyAdBudgetUsd:0}},plan);
    expect(issues.filter(issue=>issue.rule==="citation")).toEqual([]);
  });
});
