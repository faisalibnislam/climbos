import { describe, expect, it } from "vitest";
import { assertReusableEvaluation, comparisonIdentity, evaluationIdentity } from "../../bench/strategy-quality/evaluationIdentity";
import { focusedStrategySpec } from "../../shared/agents/specs";
import type { AgentInput } from "../../shared/agents/types";

const input: AgentInput = { task: "Explore an original strategy", brief: "Synthetic business", facts: [], timingContext: { today: "2026-11-17", now: 1794873600000, timezone: "UTC" } };
const spec = focusedStrategySpec({ maxRevisions: 1 });
const identity = (context = input, configuration = spec, source = "source-a", engine = "engine-a") => evaluationIdentity("retail", "acceptance", "focused-14", engine, source, configuration, context);

describe("paid evaluation cache identity", () => {
  it("reuses only the exact configured input, retaining failed-quality results as failed quality", () => {
    const result = { assessment: { ship: false } };
    const saved = { evaluationIdentity: identity(), result };
    expect(() => assertReusableEvaluation(saved, identity())).not.toThrow();
    expect(saved.result.assessment.ship).toBe(false);
  });

  it.each([
    () => identity({ ...input, facts: ["New owner report"] }),
    () => identity({ ...input, creativeRetrievalQuery: "Different mechanism" }),
    () => identity({ ...input, timingContext: { ...input.timingContext!, now: input.timingContext!.now! + 1 } }),
    () => identity(input, { ...spec, maxRevisions: 2 }),
    () => identity(input, { ...spec, models: { ...spec.models, draft: "gpt-6-luna" } }),
    () => identity(input, spec, "source-b"),
    () => identity(input, spec, "source-a", "engine-b"),
  ])("rejects changed evidence, clock, retrieval, settings or source before reuse", changed => {
    expect(() => assertReusableEvaluation({ evaluationIdentity: identity(), result: {} }, changed())).toThrow("Choose a new variant");
  });

  it("rejects incomplete and legacy records without modifying them", () => {
    for (const saved of [{ result: { output: "historical" } }, { evaluationIdentity: identity(), error: "interrupted" }]) {
      const before = JSON.stringify(saved);
      expect(() => assertReusableEvaluation(saved, identity())).toThrow();
      expect(JSON.stringify(saved)).toBe(before);
    }
  });

  it("binds a comparison to the exact reference, candidates, questions and code", () => {
    const mapping = { A: "old", B: "new" };
    const input = { brief: "Synthetic case", questions: ["Is the test useful?"], A: { title: "Old plan" }, B: { title: "New plan" } };
    const expected = comparisonIdentity("code", "retail", mapping, input);
    const saved = { evaluationIdentity: expected, result: { verdict: "B" } };
    expect(() => assertReusableEvaluation(saved, comparisonIdentity("code", "retail", mapping, input))).not.toThrow();
    for (const changed of [
      comparisonIdentity("code", "retail", { ...mapping, A: "different-reference" }, input),
      comparisonIdentity("code", "retail", mapping, { ...input, B: { title: "Changed output" } }),
      comparisonIdentity("code", "retail", mapping, { ...input, questions: ["A different question"] }),
      comparisonIdentity("changed-code", "retail", mapping, input),
    ]) expect(() => assertReusableEvaluation(saved, changed)).toThrow();
  });
});
