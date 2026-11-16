import { describe, expect, it } from "vitest";
import { focusedPlanFixture } from "../fixtures/focusedPlan";
import { focusedStrategySpec, starterStrategySpec, FocusedStrategySchema } from "../../shared/agents/specs";
import { focusedPlanTask, lintFocusedLearning } from "../../shared/agents/focusedPlan";
import { HARD_RULES } from "../../shared/agents/quality";
import type { AgentInput } from "../../shared/agents/types";
import { fakeTurn } from "../../shared/agents/fake";
import { currentRateVersion } from "../../shared/economics/rates";
const input: AgentInput = { task: focusedPlanTask(14), brief: "Synthetic owner workflow", facts: [], constraints: { horizonDays: 14 } };

describe("primary focused learning test", () => {
  it("keeps the automated focused fixture compatible with the learning contract", async () => {
    const schema = FocusedStrategySchema.pick({ focusedMove: true, experiments: true, diagnosis: true });
    const result = await fakeTurn({ modelKey: "claude-haiku-5.5", system: [], messages: [{ role: "user", content: input.task }], schema, maxTokens: 4000 }, currentRateVersion());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(lintFocusedLearning(schema.parse(result.output), input)).toEqual([]);
  });
  it("requires a trackable test in new output without demanding invented statistical inputs", () => {
    const plan = focusedPlanFixture();
    expect(lintFocusedLearning(plan, input)).toEqual([]);
    expect(FocusedStrategySchema.safeParse({ ...plan, experiments: [] }).success).toBe(false);
    expect(input.task).not.toContain("Leave experiments empty unless");
    expect(input.task).toContain("baselineRate null");
    expect(HARD_RULES.has("focused_learning")).toBe(true);
  });
  it.each(["missing", "unrelated", "duplicate"])("rejects %s primary binding", kind => {
    const plan = focusedPlanFixture();
    if (kind === "missing") plan.experiments = [];
    if (kind === "unrelated") plan.experiments[0].name = "Unrelated study";
    if (kind === "duplicate") plan.experiments.push({ ...plan.experiments[0] });
    for (const spec of [focusedStrategySpec(), starterStrategySpec()]) expect(spec.lint?.(plan, input)).toContainEqual(expect.objectContaining({ rule: "focused_learning", severity: "error" }));
  });
  it.each(["population", "assignmentUnit", "primaryMetric", "baselineBasis", "stoppingRule"] as const)("requires %s without substituting guesses", field => {
    const plan = focusedPlanFixture(); plan.experiments[0][field] = " ";
    expect(lintFocusedLearning(plan, input)).toContainEqual(expect.objectContaining({ path: `experiments[0].${field}` }));
  });
  it("rejects an unsupported measured baseline and preserves accurate owner provenance", () => {
    const plan = focusedPlanFixture(), test = plan.experiments[0];
    test.baselineRate = 3; test.baselineProvenance = "measured"; test.baselineEvidenceRefs = ["fact:0"];
    const owner: AgentInput = { ...input, facts: ["Owner reports three unresolved scoping decisions"], constraints: { ...input.constraints, factEvidenceBases: ["owner_reported"] } };
    expect(lintFocusedLearning(plan, owner)).toContainEqual(expect.objectContaining({ path: "experiments[0].baselineProvenance" }));
    test.baselineProvenance = "owner_report";
    expect(lintFocusedLearning(plan, owner)).toEqual([]);
  });
  it("keeps the observation window in the selected cycle without changing one-day reviews to a week", () => {
    const plan = focusedPlanFixture();
    for (const days of [0, 1.5, 15, 121]) { plan.experiments[0].durationDays = days; expect(lintFocusedLearning(plan, input)).toContainEqual(expect.objectContaining({ path: "experiments[0].durationDays" })); }
    plan.experiments[0].durationDays = 1;
    expect(lintFocusedLearning(plan, input)).toEqual([]);
  });
  it("does not call an observational comparison randomized", () => {
    const plan = focusedPlanFixture(); plan.experiments[0].assignmentMethod = "randomized";
    expect(lintFocusedLearning(plan, input)).toContainEqual(expect.objectContaining({ path: "experiments[0].assignmentMethod" }));
  });
  it("rejects impossible observational rates, negative counts and invalid sample sizes", () => {
    const plan = focusedPlanFixture(), test = plan.experiments[0];
    const owner: AgentInput = { ...input, facts: ["Synthetic owner baseline"], constraints: { ...input.constraints, factEvidenceBases: ["owner_reported"] } };
    test.baselineProvenance = "owner_report"; test.baselineEvidenceRefs = ["fact:0"];
    for (const type of ["binary_rate", "count"] as const) {
      test.primaryMetricType = type;
      for (const value of type === "binary_rate" ? [-0.1, 1.1] : [-1]) {
        test.baselineRate = value;
        expect(lintFocusedLearning(plan, owner)).toContainEqual(expect.objectContaining({ path: "experiments[0].baselineRate" }));
      }
      test.baselineRate = 0;
      expect(lintFocusedLearning(plan, owner)).toEqual([]);
    }
    for (const value of [-1, 0, 1.5]) {
      test.plannedSamplePerArm = value;
      expect(lintFocusedLearning(plan, owner)).toContainEqual(expect.objectContaining({ path: "experiments[0].plannedSamplePerArm" }));
    }
  });
  it("does not accept a fabricated extra baseline reference beside a valid one", () => {
    const plan = focusedPlanFixture();
    Object.assign(plan.experiments[0], { baselineRate: 3, baselineProvenance: "owner_report", baselineEvidenceRefs: ["fact:0", "fact:99"] });
    expect(lintFocusedLearning(plan, { ...input, facts: ["Owner reports three unresolved decisions"], constraints: { factEvidenceBases: ["owner_reported"] } })).toContainEqual(expect.objectContaining({ path: "experiments[0].baselineProvenance" }));
  });
  it("keeps unsupported statistical splits from passing focused quality", () => {
    const plan = focusedPlanFixture(); plan.experiments[0].method = "ab_split";
    expect(focusedStrategySpec().lint?.(plan, input)?.filter(i => i.rule === "focused_learning").length).toBeGreaterThan(0);
  });
});
