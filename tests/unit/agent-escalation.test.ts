import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ZERO_USAGE, type TurnResult } from "../../shared/ai/types";
import { CritiqueSchema, runAgent, type AgentDeps, type PhaseKey, type PhaseRecord } from "../../shared/agents/runtime";
import type { AgentInput, AgentSpec, Rubric } from "../../shared/agents/types";

const rubric: Rubric = {
  id: "test",
  title: "Test",
  gates: [{ id: "truth", text: "Truth is preserved" }],
  criteria: [{ id: "clarity", name: "Clarity", anchors: { 1: "unclear", 3: "adequate", 5: "clear" } }],
  shipRule: { minEach: 4, minAverage: 4 },
};

const spec: AgentSpec<{ answer: string }> = {
  id: "growth_strategy",
  role: "cmo",
  label: "Test strategy",
  skills: [],
  schema: z.object({ answer: z.string() }),
  rubric,
  models: { research: "gpt-6-luna", draft: "gpt-6-luna", critic: "gpt-6-luna", revise: "gpt-6-luna" },
  effort: { research: "low", draft: "low", critic: "low" },
  maxTokens: { research: 100, draft: 100, critic: 100 },
  maxRevisions: 1,
};

const input: AgentInput = { task: "Recommend a growth move", brief: "Two sources disagree about the main customer concern.", facts: ["Source A says price", "Source B says setup time"] };

async function runWith(escalationModel?: "gpt-6.1-sol", evidence = "Source A says price; Source B says setup time.") {
  const seen: string[] = [];
  let critiques = 0;
  const deps: AgentDeps = {
    escalationModel,
    turn: async (req) => {
      seen.push(req.modelKey);
      const output = req.schema === CritiqueSchema
        ? {
            gates: [{ id: "truth", pass: false, note: "The sources conflict." }],
            scores: [{ id: "clarity", score: 2, note: "Unresolved conflict", fix: "Reconcile the sources." }, { id: "XV", score: 2, note: "Unresolved", fix: "Address the conflict." }],
            strengths: [],
            fixes: ["Address the conflicting evidence."],
            escalation: critiques++ === 0 ? { reason: "conflicting_evidence", evidence } : { reason: "none", evidence: "" },
          }
        : { answer: "A bounded recommendation." };
      return {
        ok: true,
        output,
        text: JSON.stringify(output),
        appended: [],
        usage: { ...ZERO_USAGE, calls: 1 },
        costMicros: 1,
        sources: [],
        actualModelId: req.modelKey,
        stopReason: "stop",
      } satisfies TurnResult;
    },
    phase: async <T>(_key: PhaseKey, _label: string, fn: () => Promise<{ value: T; record: PhaseRecord }>) => {
      const { value } = await fn();
      return value;
    },
  };
  await runAgent(spec, input, deps);
  return seen;
}

describe("measured Expert model escalation", () => {
  it("uses Sol for revision only when an eligible Expert run has evidence-backed escalation", async () => {
    const seen = await runWith("gpt-6.1-sol");
    expect(seen).toEqual(["gpt-6-luna", "gpt-6-luna", "gpt-6.1-sol", "gpt-6-luna"]);
  });

  it("keeps revisions on Luna when no Expert escalation is authorized", async () => {
    const seen = await runWith();
    expect(seen).toEqual(["gpt-6-luna", "gpt-6-luna", "gpt-6-luna", "gpt-6-luna"]);
  });

  it("does not escalate on a reviewer label without supporting evidence", async () => {
    const seen = await runWith("gpt-6.1-sol", "   ");
    expect(seen).toEqual(["gpt-6-luna", "gpt-6-luna", "gpt-6-luna", "gpt-6-luna"]);
  });
});
