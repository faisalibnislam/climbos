import { describe, expect, it, vi } from "vitest";
import { focusedPlanFixture } from "../fixtures/focusedPlan";
import { FocusedStrategySchema, focusedStrategySpec, starterStrategySpec, strategySpec, lintPreparedDrafts } from "../../shared/agents/specs";
import { focusedPlanTask, focusedRefreshContext } from "../../shared/agents/focusedPlan";
import { lintCycleMilestones } from "../../shared/agents/planningCycles";
import {lintAgentOutput} from "../../shared/agents/runtime";
import { planJob, maxJobMicros } from "../../convex/lib/jobPlans";
import { jsonSchemaFor } from "../../shared/ai/types";
import { claudeSchema } from "../../shared/ai/anthropicSchema";

describe("a focused plan does useful work without invented forecasts", () => {
  it("places creative exploration before the execution plan in the actual provider schema without changing saved fields", () => {
    const schema = claudeSchema(jsonSchemaFor(focusedStrategySpec().schema)) as { properties: Record<string, { properties: Record<string, unknown> }> };
    expect(Object.keys(schema.properties)[0]).toBe("strategyExploration");
    expect(Object.keys(schema.properties.strategyExploration.properties).slice(0, 3)).toEqual(["bold", "grounded", "adjacent"]);
    expect(FocusedStrategySchema.parse(focusedPlanFixture())).toEqual(focusedPlanFixture());
  });
  it("bounds new focused phase checklists while retaining historical plan compatibility", () => {
    const plan = focusedPlanFixture();
    plan.phases[0].tasks = ["Review the prepared example.", "Verify actual product behavior.", "Approve the exact audience and draft.", "Observe the approved test."];
    expect(focusedStrategySpec().schema.safeParse(plan).success).toBe(true);
    plan.phases[0].tasks.push("Start a separate optional workstream.");
    expect(focusedStrategySpec().schema.safeParse(plan).success).toBe(false);
    expect(FocusedStrategySchema.safeParse(plan).success).toBe(true);
  });
  it("quotes full-plan output headroom for both draft and revision while preserving the starter allowance", () => {
    const spec = focusedStrategySpec(), plan = planJob("strategy", { planStyle: "focused" });
    // A real revision used 13,740 thinking tokens plus its structured portfolio and hit 24,000.
    expect(spec.maxTokens.draft).toBeGreaterThan(24000);
    expect(plan.steps).toContainEqual(expect.objectContaining({ kind: "model", modelKey: spec.models.draft, outputBudget: spec.maxTokens.draft }));
    expect(plan.revisionSteps).toContainEqual(expect.objectContaining({ kind: "model", outputBudget: spec.maxTokens.draft }));
    expect(spec.maxRevisions).toBe(2);
    expect(plan.revisionSteps).toHaveLength(4);
    expect(focusedStrategySpec({ maxRevisions: 0 }).maxRevisions).toBe(0);
    const starter = starterStrategySpec(), starterPlan = planJob("strategy", { planStyle: "starter" });
    expect(starter.models).toEqual(spec.models);
    expect(starter.maxTokens.draft).toBe(11000);
    expect(starterPlan.steps).toContainEqual(expect.objectContaining({ kind: "model", outputBudget: 11000 }));
    expect(starterPlan.revisionSteps).toEqual([]);
  });
  it("requires inspectable strategic alternatives rather than an internal comparison only", () => {
    const plan = focusedPlanFixture();
    expect(FocusedStrategySchema.safeParse({ ...plan, strategyExploration: undefined }).success).toBe(false);
    expect(FocusedStrategySchema.safeParse({ ...plan, strategyExploration: { ...plan.strategyExploration, bold: undefined } }).success).toBe(false);
  });
  it("preserves an unproven bold option while rejecting duplicate mechanisms and unsupported citations", () => {
    const plan = focusedPlanFixture();
    const input = { task: focusedPlanTask(14), brief: "Synthetic business context", facts: [], constraints: { horizonDays: 14, monthlyAdBudgetUsd: 0 } };
    expect(plan.strategyExploration.bold).toMatchObject({ precedentIds: [], evidenceStrength: "low", feasibility: "low", risk: "high" });
    expect(focusedStrategySpec().lint?.(plan, input)?.filter(issue => issue.severity === "error")).toEqual([]);
    plan.strategyExploration.bold = { ...plan.strategyExploration.grounded, title: "A bolder sounding title" };
    expect(focusedStrategySpec().lint?.(plan, input)).toContainEqual(expect.objectContaining({ severity: "error", rule: "creative_diversity" }));
    plan.strategyExploration.bold.evidenceRefs = ["https://unread.example/claim", "fact:99"];
    expect(focusedStrategySpec().lint?.(plan, input)).toContainEqual(expect.objectContaining({ severity: "error", rule: "exploration_evidence" }));
  });
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
    expect(value.strategyExploration.bold.businessMechanism).toBe(focusedPlanFixture().strategyExploration.bold.businessMechanism);
    expect(value.strategyExploration.bold).not.toHaveProperty("evidenceRefs");
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
