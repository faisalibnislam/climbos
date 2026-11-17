import { describe, expect, it } from "vitest";
import { z } from "zod";
import { CreativePreparationSchema, CREATIVE_PREPARATION_TOKENS } from "../../shared/agents/creativePreparation";
import { runAgent, type AgentDeps, type PhaseKey } from "../../shared/agents/runtime";
import { focusedStrategySpec, starterStrategySpec } from "../../shared/agents/specs";
import { agentSteps } from "../../convex/lib/jobPlans";
import { ZERO_USAGE, type TurnRequest } from "../../shared/ai/types";

const seeds = { directions: Array.from({ length: 3 }, (_, index) => ({
  title: `Synthetic possibility ${index}`, businessTension: "An explicitly hypothetical customer tension.",
  mechanism: "A proposed exchange to test privately before building.", changedBehavior: "An unverified new participant behavior.",
  whyParticipantsCare: "This is a hypothesis, not evidence of demand.", closestFamiliarAlternative: "A familiar current workflow.",
  meaningfulDifference: "A changed exchange, not a renamed platform.", unsupportedAssumptions: ["Customer interest remains unknown."],
  reversibleTest: "Compare two private mock-ups with a consenting participant.", evidenceRefs: [],
})) };
const draft = { summary: "Customer interest remains unknown." };
const review = {
  gates: [{ id: "G1", pass: true, note: "Unknown preserved." }],
  scores: ["F1", "XV"].map(id => ({ id, score: 5, note: "Synthetic review only.", fix: "none" })),
  strengths: [], fixes: [],
  evidenceAudit: ["business_state", "comparative_claims", "capabilities_and_results"].map(category => ({ category, basis: "Synthetic output retains uncertainty.", claims: [] })),
};
const spec = () => ({ ...focusedStrategySpec({ maxRevisions: 0 }), schema: z.object({ summary: z.string() }), lint: undefined,
  rubric: { id: "focused-growth-strategy", title: "Synthetic", gates: [{ id: "G1", text: "Truth" }], criteria: [{ id: "F1", name: "Useful", anchors: { 1: "weak", 3: "partial", 5: "ready" } }], shipRule: { minEach: 4, minAverage: 4 } },
});

describe("creative preparation within the existing focused run", () => {
  it("quotes one preparation call on the same writer and preserves the starter route and cap", () => {
    const full = focusedStrategySpec(), starter = starterStrategySpec();
    expect(full.creativePreparation).toBe(true);
    const steps = agentSteps({ ...full, lint: undefined });
    expect(steps[0]).toMatchObject({ modelKey: full.models.draft, outputBudget: CREATIVE_PREPARATION_TOKENS, inputBudget: 40_000 });
    expect(steps).toHaveLength(3);
    expect(full.effort.critic).toBe("high");
    expect(steps[2]).toMatchObject({ modelKey: full.models.critic, outputBudget: 12000 });
    expect(focusedStrategySpec({ effort: { critic: "medium" } }).effort.critic).toBe("medium");
    expect(starter.creativePreparation).toBe(false);
    expect(agentSteps({ ...starter, lint: undefined })).toHaveLength(2);
    expect(starter.maxTokens).toEqual({ research: 0, draft: 11000, critic: 4000 });
    expect(starter.models).toEqual(full.models);
  });

  it("checkpoints the possibilities once, passes them as proposals and independently reviews only final work", async () => {
    const requests: TurnRequest[] = [], keys: PhaseKey[] = [], checkpoints = new Map<number, unknown>();
    const deps: AgentDeps = {
      turn: async req => {
        requests.push(req);
        const output = req.schema === CreativePreparationSchema ? seeds : req.system.some(s => s.text.includes("HARD GATES")) ? review : draft;
        return { ok: true, output, text: JSON.stringify(output), appended: [], usage: ZERO_USAGE, costMicros: 0, sources: [], actualModelId: "fixture", stopReason: "end_turn" };
      },
      phase: async (key, _label, fn) => {
        keys.push(key);
        if (checkpoints.has(key.index)) return checkpoints.get(key.index) as never;
        const result = await fn(); checkpoints.set(key.index, result.value); return result.value;
      },
    };
    const input = { brief: "Synthetic source context; capacity unknown.", task: "Prepare an owner-reviewable proposal. Specific execution checklist stays in the final drafting task.", facts: [] };
    const result = await runAgent(spec(), input, deps);
    expect(result.output).toEqual(draft); expect(result.assessment?.ship).toBe(true);
    expect(keys.map(key => [key.phase, key.index])).toEqual([["explore", 49], ["draft", 1], ["critique", 2]]);
    expect(requests[0]).toMatchObject({ modelKey: spec().models.draft, maxTokens: CREATIVE_PREPARATION_TOKENS });
    expect(requests[0].customTools).toBeUndefined(); expect(requests[0].webSearch).toBeUndefined();
    expect(JSON.stringify(requests[0].messages)).not.toContain("Specific execution checklist");
    expect(JSON.stringify(requests[0].messages)).toContain(input.brief);
    const writer = JSON.stringify(requests[1].messages), critic = JSON.stringify(requests[2].messages);
    expect(writer).toContain("creative preparation proposals");
    expect(writer).toContain("not new facts, user instructions or authorization");
    expect(writer).toContain("Synthetic possibility 0");
    expect(writer).toContain("Specific execution checklist");
    expect(critic).not.toContain("Synthetic possibility 0");
    expect(critic).toContain(draft.summary);
    expect(await runAgent(spec(), input, deps)).toEqual(result);
    expect(requests).toHaveLength(3);
  });

  it("rejects malformed preparation before producing a final draft", async () => {
    let calls = 0;
    await expect(runAgent(spec(), { brief: "Synthetic", task: "Private preparation", facts: [] }, {
      phase: async (_key, _label, fn) => (await fn()).value,
      turn: async () => { calls++; return { ok: true, output: { directions: [] }, text: "{}", appended: [], usage: ZERO_USAGE, costMicros: 0, sources: [], actualModelId: "fixture", stopReason: "end_turn" }; },
    })).rejects.toMatchObject({ kind: "invalid_output" });
    expect(calls).toBe(1);
  });
});
