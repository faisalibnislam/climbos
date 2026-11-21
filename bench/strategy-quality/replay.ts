/** Read-only contract replay. Never invokes a model, research or action adapter. */
import { z } from "zod";
import { ENGINE_VERSION, focusedStrategySpec } from "../../shared/agents/specs";
import { assess, FocusedCritiqueSchema, lintAgentOutput } from "../../shared/agents/runtime";
import type { AgentInput } from "../../shared/agents/types";

const Envelope = z.object({
  caseId: z.string(), engine: z.string().optional(),
  input: z.object({
    task: z.string(), brief: z.string(), facts: z.array(z.string()),
    timingContext: z.object({ today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), now: z.number().finite().nonnegative(), timezone: z.string().optional() }).passthrough(),
    precomputedResearch: z.object({ notes: z.string(), sources: z.array(z.object({ url: z.string() }).passthrough()), retrievedAt: z.number().optional() }).passthrough().optional(),
    availableSourceUrls: z.array(z.string()).optional(),
    constraints: z.record(z.string(), z.unknown()).optional(),
  }).passthrough(),
  result: z.object({ output: z.unknown(), assessment: z.unknown().optional() }),
});

export function replayFocusedStrategy(record: unknown) {
  const base = { currentEngine: ENGINE_VERSION, editorialReview: "not_assessed", externalActions: 0, modelCalls: 0 } as const;
  const saved = Envelope.safeParse(record);
  if (!saved.success) return { ...base, status: "uncheckable" as const, reason: "Missing or invalid saved input, output or evaluation clock. No evidence or clock was invented.", issues: saved.error.issues };
  const { caseId, engine, input, result } = saved.data;
  const context = { ...base, caseId, savedEngine: engine ?? null, evaluationClock: input.timingContext, historicalAssessment: result.assessment ?? null };
  const spec = focusedStrategySpec();
  const output = spec.schema.safeParse(result.output);
  if (!output.success) return { ...context, status: "schema_failed" as const, issues: output.error.issues };
  try {
    const issues = lintAgentOutput(spec, input as AgentInput, output.data, input.precomputedResearch, input.timingContext.now);
    const historical = result.assessment as { critique?: unknown } | null | undefined;
    const critique = FocusedCritiqueSchema.safeParse(historical?.critique);
    const savedReviewValidation = critique.success
      ? { status: "rechecked" as const, assessment: assess(critique.data, issues, spec.rubric, output.data, input as AgentInput), limitation: "Uses the retained critic's judgments, not a new independent assessment." }
      : { status: "uncheckable" as const, reason: "Saved review is missing fields required by the current review contract." };
    if (issues.some(issue => issue.severity === "error")) return { ...context, status: "lint_failed" as const, issues, savedReviewValidation };
    if (savedReviewValidation.status === "rechecked" && !savedReviewValidation.assessment.ship) {
      return { ...context, status: "review_failed" as const, issues, savedReviewValidation };
    }
    if (savedReviewValidation.status === "uncheckable" && z.object({ ship: z.literal(false) }).safeParse(result.assessment).success) {
      return { ...context, status: "historical_review_failed" as const, issues, savedReviewValidation };
    }
    return { ...context, status: "contract_passed" as const, issues, savedReviewValidation };
  } catch (error) {
    return { ...context, status: "uncheckable" as const, reason: `Saved context cannot be evaluated: ${error instanceof Error ? error.message : "invalid context"}` };
  }
}
