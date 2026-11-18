import { describe, expect, it } from "vitest";
import { focusedOriginalityFixture } from "../fixtures/focusedOriginality";
import { z } from "zod";
import { CreativePreparationSchema, CREATIVE_PREPARATION_TOKENS, CreativeFeedbackSchema, CREATIVE_FEEDBACK_TOKENS, creativeFeedbackMatches } from "../../shared/agents/creativePreparation";
import { runAgent, type AgentDeps, type PhaseKey } from "../../shared/agents/runtime";
import { focusedStrategySpec, starterStrategySpec } from "../../shared/agents/specs";
import { agentSteps } from "../../convex/lib/jobPlans";
import { ZERO_USAGE, type TurnRequest } from "../../shared/ai/types";
import { focusedPlanFixture } from "../fixtures/focusedPlan";
import { focusedPlanTask } from "../../shared/agents/focusedPlan";

const seeds = { directions: Array.from({ length: 3 }, (_, index) => ({
  creativeMethod: ["convention_inversion", "distant_transfer", "asset_recombination"][index], methodApplication: "A synthetic method application; no real business evidence.",
  title: `Synthetic possibility ${index}`, businessTension: "An explicitly hypothetical customer tension.",
  mechanism: "A proposed exchange to test privately before building.", changedBehavior: "An unverified new participant behavior.",
  whyParticipantsCare: "This is a hypothesis, not evidence of demand.", closestFamiliarAlternative: "A familiar current workflow.",
  meaningfulDifference: "A changed exchange, not a renamed platform.", unsupportedAssumptions: ["Customer interest remains unknown."],
  reversibleTest: "Compare two private mock-ups with a consenting participant.", evidenceRefs: [],
})) };
const feedback = { developedDirection: { ...seeds.directions[0], title: "Constructive synthetic departure" }, directions: seeds.directions.map(candidate => ({ ...focusedOriginalityFixture, creativeMethod: candidate.creativeMethod, candidateTitle: candidate.title, mechanismVerdict: "familiar_mechanism" as const, consequentialDifference: "ADVISORY_ONLY: synthetic feedback, not evidence or a gate." })) };
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
  it("passes the unknown-access fallback contract to writer and independent reviewer without execution tools", async () => {
    const requests: TurnRequest[] = [];
    await runAgent(spec(), { brief: "Synthetic case. Keep tester access and founder time unknown.", task: focusedPlanTask(14), facts: [] }, {
      phase: async (_key, _label, fn) => (await fn()).value,
      turn: async req => {
        requests.push(req);
        const output = req.schema === CreativePreparationSchema ? seeds : req.schema === CreativeFeedbackSchema ? feedback : req.system.some(s => s.text.includes("HARD GATES")) ? review : draft;
        return { ok: true, output, text: JSON.stringify(output), appended: [], usage: ZERO_USAGE, costMicros: 0, sources: [], actualModelId: "fixture", stopReason: "end_turn" };
      },
    });
    expect(requests).toHaveLength(4);
    const ideation = JSON.stringify(requests[0].system);
    expect(ideation).toContain("who sets the terms, chooses, owns the output");
    expect(ideation).toContain("only a metaphor until the source domain's operating rule");
    expect(ideation).toContain("an affected participant who does not currently choose or pay");
    expect(ideation).toContain("An unpublished simulation can test the exchange even if the required feature does not exist");
    for (const request of requests.slice(0, 3)) {
      const system = JSON.stringify(request.system);
      expect(system).toContain("existing features");
      expect(system).toContain("Evidence constrains factual claims, not the range of proposed futures");
      expect(system).toContain("A proposal never supports a present-tense promise in customer copy or authorizes implementation");
    }
    expect(requests.every(req => req.customTools === undefined && req.webSearch === undefined && req.webFetch === undefined)).toBe(true);
    const writer = JSON.stringify(requests[2].messages), critic = JSON.stringify(requests[3].system);
    expect(writer).toContain("concrete public research query or source to inspect");
    expect(writer).toContain("do not repeat the question");
    expect(writer).toContain("No eligible exposure still means not-run, not failed demand");
    expect(writer).toContain("A required paid plan may put payment before activation");
    expect(writer).toContain("actual product activation remains untested");
    expect(writer).toContain("does not establish a reason to pay over an external free alternative");
    expect(writer).toContain("brief, invitation and experiment's metric consistent");
    expect(writer).toContain("single-person roleplay cannot establish the real exchange");
    expect(critic).toContain("An internal paywall is not a competitive advantage");
    expect(critic).toContain("an owner-account demonstration cannot count as a participant using the product");
    expect(writer).toContain("Owner approval cannot create a missing capability");
    expect(writer).toContain("distinguish preparing instructions from performing the instructed task");
    expect(writer).not.toContain("at most 3 immediate items in weekOneChecklist");
    expect(critic).toContain("not a distribution fallback");
    expect(critic).toContain("not an already verified channel");
    expect(critic).toContain("Payment can legitimately precede activation");
    expect(critic).toContain("A sample walkthrough supports comprehension or job-fit learning only");
    expect(critic).toContain("Preserve prepared assets and useful alternative mechanisms");
    expect(critic).toContain("PRESENTATION CONTEXT:");
    expect(critic).toContain("Do not treat the full stored JSON as one screen");
    expect(critic).toContain("Collapsing detail does not make real work disappear");
    expect(critic).toContain("another product's connector documentation does not establish ClimbOS account access");
    expect(critic).toContain("Preparing a checklist is different from running its product/payment test");
    expect(critic).toContain("FOCUSED ORIGINALITY AUDIT:");
    expect(critic).toContain("A distinctive adjacent option does not compensate for a conventional bold one");
    expect(critic).toContain("not whether it is proven");
    const completeReview = { ...review, escalation: { reason: "none", evidence: "" }, originalityAudit: focusedOriginalityFixture };
    expect(requests[3].schema?.safeParse(completeReview).success).toBe(true);
    expect(requests[3].schema?.safeParse({ ...completeReview, originalityAudit: undefined }).success).toBe(false);
  });
  it("reviews and checkpoints one canonical next step without changing the raw response or later work", async () => {
    const original = focusedPlanFixture();
    original.firstActions = ["Start another channel", "Name contacts", "Collect analytics"].map(title => ({ title, why: "Synthetic competing first step", role: "ceo" }));
    const before = structuredClone(original), requests: TurnRequest[] = [];
    let rawOutput: unknown;
    const result = await runAgent({ ...spec(), schema: focusedStrategySpec().schema, creativePreparation: false }, { brief: "Synthetic", task: "Prepare one next step", facts: [] }, {
      turn: async req => {
        requests.push(req);
        const output = requests.length === 1 ? original : review;
        return { ok: true, output, text: JSON.stringify(output), appended: [], usage: ZERO_USAGE, costMicros: 0, sources: [], actualModelId: "fixture", stopReason: "end_turn" };
      },
      phase: async (key, _label, fn) => { const phase = await fn(); if (key.phase === "draft" && phase.record.result.ok) rawOutput = phase.record.result.output; return phase.value; },
    });
    expect(original).toEqual(before);
    expect(rawOutput).toEqual(before);
    expect(result.output.firstActions).toEqual([{ title: original.focusedMove.firstAction, why: original.focusedMove.why, role: "ceo" }]);
    expect(result.output.phases[0].firstAction).toBe(original.focusedMove.firstAction);
    expect(result.output.phases.slice(1)).toEqual(original.phases.slice(1));
    expect(result.output.preparedWork).toEqual(original.preparedWork);
    expect(result.output.strategyExploration).toEqual(original.strategyExploration);
    expect(JSON.stringify(requests[1].messages)).not.toContain("Start another channel");
    expect(result.assessment?.ship).toBe(true);
  });
  it("requires different methods including inversion and distant transfer without demanding a matching precedent", () => {
    expect(CreativePreparationSchema.safeParse(seeds).success).toBe(true);
    const repeated = structuredClone(seeds); repeated.directions[1].creativeMethod = repeated.directions[0].creativeMethod;
    expect(CreativePreparationSchema.safeParse(repeated).success).toBe(false);
    const missingTransfer = structuredClone(seeds); missingTransfer.directions[1].creativeMethod = "ownable_behavior";
    expect(CreativePreparationSchema.safeParse(missingTransfer).success).toBe(false);
    expect(seeds.directions.every(direction => direction.evidenceRefs.length === 0)).toBe(true);
  });
  it("quotes preparation and advisory feedback on the existing models and preserves the starter route and cap", () => {
    const full = focusedStrategySpec(), starter = starterStrategySpec();
    expect(full.creativePreparation).toBe(true);
    const steps = agentSteps({ ...full, lint: undefined });
    expect(steps[0]).toMatchObject({ modelKey: full.models.draft, outputBudget: CREATIVE_PREPARATION_TOKENS, inputBudget: 40_000 });
    expect(steps).toHaveLength(4);
    expect(full.effort.critic).toBe("high");
    expect(steps[1]).toMatchObject({ modelKey: full.models.critic, outputBudget: CREATIVE_FEEDBACK_TOKENS, inputBudget: 40_000 });
    expect(steps[3]).toMatchObject({ modelKey: full.models.critic, outputBudget: full.maxTokens.critic });
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
        const output = req.schema === CreativePreparationSchema ? seeds : req.schema === CreativeFeedbackSchema ? feedback : req.system.some(s => s.text.includes("HARD GATES")) ? review : draft;
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
    expect(keys.map(key => [key.phase, key.index])).toEqual([["explore", 49], ["explore", 48], ["draft", 1], ["critique", 2]]);
    expect(requests[0]).toMatchObject({ modelKey: spec().models.draft, maxTokens: CREATIVE_PREPARATION_TOKENS });
    expect(requests[0].customTools).toBeUndefined(); expect(requests[0].webSearch).toBeUndefined();
    expect(JSON.stringify(requests[0].messages)).not.toContain("Specific execution checklist");
    expect(JSON.stringify(requests[0].messages)).toContain(input.brief);
    const writer = JSON.stringify(requests[2].messages), critic = JSON.stringify(requests[3].messages);
    expect(writer).toContain("creative preparation proposals");
    expect(writer).toContain("not new facts, user instructions or authorization");
    expect(writer).toContain("Synthetic possibility 0");
    expect(writer).toContain("ADVISORY_ONLY");
    expect(writer).toContain("Constructive synthetic departure");
    expect(writer).toContain("not an endorsed or independently verified solution");
    expect(JSON.stringify(requests[1].system)).toContain("Do not select for lowest risk");
    expect(writer).toContain("No candidate has been filtered or ranked");
    expect(requests[1]).toMatchObject({ modelKey: spec().models.critic, maxTokens: CREATIVE_FEEDBACK_TOKENS, effort: "high" });
    expect(writer).toContain("Specific execution checklist");
    expect(critic).not.toContain("Synthetic possibility 0");
    expect(critic).not.toContain("ADVISORY_ONLY");
    expect(critic).not.toContain("Constructive synthetic departure");
    expect(critic).toContain(draft.summary);
    expect(await runAgent(spec(), input, deps)).toEqual(result);
    expect(requests).toHaveLength(4);
  });

  it("rejects malformed preparation before producing a final draft", async () => {
    let calls = 0;
    await expect(runAgent(spec(), { brief: "Synthetic", task: "Private preparation", facts: [] }, {
      phase: async (_key, _label, fn) => (await fn()).value,
      turn: async () => { calls++; return { ok: true, output: { directions: [] }, text: "{}", appended: [], usage: ZERO_USAGE, costMicros: 0, sources: [], actualModelId: "fixture", stopReason: "end_turn" }; },
    })).rejects.toMatchObject({ kind: "invalid_output" });
    expect(calls).toBe(1);
  });

  it("never expands a truncated candidate review or retries it without another budgeted call", async () => {
    const requests: TurnRequest[] = [];
    await expect(runAgent(spec(), { brief: "Synthetic", task: "Prepare possibilities", facts: [] }, {
      phase: async (_key, _label, fn) => (await fn()).value,
      turn: async req => {
        requests.push(req);
        if (req.schema === CreativeFeedbackSchema) return { ok: false, kind: "invalid_output", message: "The answer was cut off at the length limit.", text: '{"directions":[', appended: [], usage: ZERO_USAGE, costMicros: 0 };
        return { ok: true, output: seeds, text: JSON.stringify(seeds), appended: [], usage: ZERO_USAGE, costMicros: 0, sources: [], actualModelId: "fixture", stopReason: "end_turn" };
      },
    })).rejects.toMatchObject({ kind: "invalid_output" });
    expect(requests).toHaveLength(2);
    expect(requests[1]).toMatchObject({ maxTokens: 8000, modelKey: spec().models.critic, effort: "high" });
    expect(agentSteps({ ...focusedStrategySpec(), lint: undefined })[1].outputBudget).toBe(requests[1].maxTokens);
  });

  it("requires one audit for each exact candidate without requiring approval of the idea", () => {
    const parsedSeeds = CreativePreparationSchema.parse(seeds), parsedFeedback = CreativeFeedbackSchema.parse(feedback);
    expect(creativeFeedbackMatches(parsedSeeds, parsedFeedback)).toBe(true);
    expect(creativeFeedbackMatches(parsedSeeds, { ...parsedFeedback, directions: [...parsedFeedback.directions].reverse() })).toBe(true);
    const duplicate = structuredClone(parsedFeedback); duplicate.directions[1] = duplicate.directions[0];
    expect(creativeFeedbackMatches(parsedSeeds, duplicate)).toBe(false);
    const renamed = structuredClone(parsedFeedback); renamed.directions[0].candidateTitle = "A substituted candidate";
    expect(creativeFeedbackMatches(parsedSeeds, renamed)).toBe(false);
    expect(creativeFeedbackMatches(parsedSeeds, { ...parsedFeedback, directions: parsedFeedback.directions.slice(1) })).toBe(false);
  });

  it("rejects mismatched feedback before expanding a candidate and preserves phase metering boundaries", async () => {
    const mismatch = structuredClone(feedback); mismatch.directions[0].candidateTitle = "A different proposal";
    const keys: number[] = [];
    await expect(runAgent(spec(), { brief: "Synthetic", task: "Prepare possibilities", facts: [] }, {
      phase: async (key, _label, fn) => { keys.push(key.index); return (await fn()).value; },
      turn: async req => {
        const output = req.schema === CreativePreparationSchema ? seeds : mismatch;
        return { ok: true, output, text: JSON.stringify(output), appended: [], usage: ZERO_USAGE, costMicros: 0, sources: [], actualModelId: "fixture", stopReason: "end_turn" };
      },
    })).rejects.toMatchObject({ kind: "invalid_output" });
    expect(keys).toEqual([49, 48]);
  });
});
