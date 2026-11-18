import { describe, expect, it, vi } from "vitest";
import { focusedOriginalityFixture } from "../fixtures/focusedOriginality";
import { z } from "zod";
import { CreativePreparationSchema, CREATIVE_PREPARATION_TOKENS, CreativeFeedbackSchema, CREATIVE_FEEDBACK_TOKENS, creativeFeedbackMatches } from "../../shared/agents/creativePreparation";
import { runAgent, lintAgentOutput, type AgentDeps, type PhaseKey } from "../../shared/agents/runtime";
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
const feedback = { developedDirection: { ...seeds.directions[0], title: "Constructive synthetic departure" }, directions: seeds.directions.map(candidate => ({ ...focusedOriginalityFixture, mechanismQuote: candidate.mechanism, testQuote: candidate.reversibleTest, comparisonVerdict: "isolates_difference" as const, creativeMethod: candidate.creativeMethod, candidateTitle: candidate.title, mechanismVerdict: "familiar_mechanism" as const, consequentialDifference: "ADVISORY_ONLY: synthetic feedback, not evidence or a gate." })) };
const draft = { summary: "Customer interest remains unknown." };
const review = {
  gates: [{ id: "G1", pass: true, note: "Unknown preserved." }],
  scores: ["F1", "XV"].map(id => ({ id, score: 5, note: "Synthetic review only.", fix: "none" })),
  strengths: [], fixes: [],
  evidenceAudit: ["business_state", "comparative_claims", "capabilities_and_results"].map(category => ({ category, measurementChecks: [], planChecks: [], basis: "Synthetic output retains uncertainty.", claims: [] })),
};
const spec = () => ({ ...focusedStrategySpec({ maxRevisions: 0 }), schema: z.object({ summary: z.string() }), lint: undefined,
  rubric: { id: "focused-growth-strategy", title: "Synthetic", gates: [{ id: "G1", text: "Truth" }], criteria: [{ id: "F1", name: "Useful", anchors: { 1: "weak", 3: "partial", 5: "ready" } }], shipRule: { minEach: 4, minAverage: 4 } },
});

describe("creative preparation within the existing focused run", () => {
  it.each([false, true])("delivers reasoning contrasts to every active creative stage without turning them into evidence (checkpoint=%s)", async cached => {
    const requests: TurnRequest[] = [];
    const input = { brief: "Synthetic new product; no measured demand. Tester access and founder time unknown.", task: focusedPlanTask(14), facts: [] };
    const result = await runAgent(spec(), input, {
      phase: async (key, _label, fn) => {
        if (cached && key.index === 49) return seeds as never;
        if (cached && key.index === 48) return feedback as never;
        return (await fn()).value;
      },
      turn: async req => {
        requests.push(req);
        const output = req.schema === CreativePreparationSchema ? seeds : req.schema === CreativeFeedbackSchema ? feedback : req.system.some(s => s.text.includes("HARD GATES")) ? review : draft;
        return { ok: true, output, text: JSON.stringify(output), appended: [], usage: ZERO_USAGE, costMicros: 0, sources: [], actualModelId: "fixture", stopReason: "end_turn" };
      },
    });
    expect(requests).toHaveLength(cached ? 2 : 4);
    for (const req of requests) {
      const text = JSON.stringify({ system: req.system, messages: req.messages });
      expect(text.includes("REASONING CONTRASTS — instructional hypotheses, not business evidence")).toBe(true);
      expect(text.includes("Same benefit, stronger control")).toBe(true);
      expect(text.includes("Unbuilt reciprocal exchange")).toBe(true);
      expect(text.includes("Required bundle is not paid value")).toBe(true);
      expect(req.customTools).toBeUndefined(); expect(req.webSearch).toBeFalsy(); expect(req.webFetch).toBeFalsy();
    }
    expect(input.facts).toEqual([]);
    expect(result.research).toBeNull();
  });

  it.each(["supplied", "fresh", "checkpoint"])("retains saved research restrictions through every creative phase (%s)", async mode => {
    const restriction = "Source-reported restriction: the Core plan excludes AI brief drafting; Pro eligibility is untested.";
    const notes = "Source-reported background; no measured demand.\n".repeat(720) + restriction;
    expect(notes.length).toBeGreaterThan(30_000); expect(notes.length).toBeLessThan(40_000);
    const research = { notes, sources: [{ url: "https://example.com/plans", title: "Published plan restrictions" }], retrievedAt: Date.now() - 1000 };
    const requests: TurnRequest[] = [];
    const result = await runAgent(spec(), { brief: "Synthetic eligibility test", task: "Prepare possibilities", facts: [],
      ...(mode === "supplied" ? { precomputedResearch: research } : { research: { maxSearches: 1, maxFetches: 1, brief: "Check eligibility" } }),
    }, {
      phase: async (key, _label, fn) => mode === "checkpoint" && key.index === 0 ? research as never : (await fn()).value,
      turn: async req => {
        requests.push(req);
        const output = !req.schema ? notes : req.schema === CreativePreparationSchema ? seeds : req.schema === CreativeFeedbackSchema ? feedback : req.system.some(s => s.text.includes("HARD GATES")) ? review : draft;
        return { ok: true, output, text: typeof output === "string" ? output : JSON.stringify(output), appended: [], usage: ZERO_USAGE, costMicros: 0, sources: research.sources, actualModelId: "fixture", stopReason: "end_turn" };
      },
    });
    const downstream = requests.filter(req => req.schema);
    expect(downstream).toHaveLength(4);
    expect(downstream.map(req => req.modelKey)).toEqual([spec().models.draft, spec().models.critic, spec().models.draft, spec().models.critic]);
    expect(downstream.every(req => !req.customTools && !req.webSearch && !req.webFetch)).toBe(true);
    for (const req of downstream) expect(JSON.stringify(req.messages)).toContain(restriction);
    expect(result.research?.notes).toBe(notes);
    expect(result.research?.sources).toEqual(research.sources);
    if (mode !== "fresh") expect(result.research?.retrievedAt).toBe(research.retrievedAt);
  });

  it("uses the same visibly bounded research for drafting, review and deterministic validation", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const notes = "Supplied source excerpt; no commercial outcome.\n".repeat(1000) + "UNSEEN_TAIL: measured 987654 customers.";
      const research = { notes, sources: [{ url: "https://example.com/plans" }], retrievedAt: Date.now() - 1000 };
      const requests: TurnRequest[] = [], lintContexts: import("../../shared/agents/types").AgentInput[] = [];
      const result = await runAgent({ ...spec(), creativePreparation: false, lint: (_out, input) => { lintContexts.push(input); return []; } },
        { brief: "Synthetic research bound", task: "Prepare a draft", facts: [], precomputedResearch: research }, {
          phase: async (_key, _label, fn) => (await fn()).value,
          turn: async req => {
            requests.push(req); const output = req.system.some(s => s.text.includes("HARD GATES")) ? review : draft;
            return { ok: true, output, text: JSON.stringify(output), appended: [], usage: ZERO_USAGE, costMicros: 0, sources: [], actualModelId: "fixture", stopReason: "end_turn" };
          },
        });
      expect(result.research?.notes.length).toBeLessThanOrEqual(40_000);
      expect(result.research?.notes).toContain("more characters not shown");
      expect(result.research?.notes).not.toContain("UNSEEN_TAIL");
      for (const req of requests) {
        expect(JSON.stringify(req.messages)).toContain("more characters not shown");
        expect(JSON.stringify(req.messages)).not.toContain("UNSEEN_TAIL");
      }
      expect(lintContexts.length).toBeGreaterThan(0);
      lintAgentOutput({ ...spec(), lint: (_out, input) => { lintContexts.push(input); return []; } },
        { brief: "Same saved evidence", task: "Offline check", facts: [], precomputedResearch: research }, draft);
      for (const input of lintContexts) {
        expect(input.precomputedResearch?.notes).toBe(result.research?.notes);
        expect(input.untrustedContext).not.toContain("UNSEEN_TAIL");
      }
      expect(research.notes).toBe(notes);
      expect(result.research?.retrievedAt).toBe(research.retrievedAt);
      expect(requests).toHaveLength(2);
    } finally { warn.mockRestore(); }
  });

  it("omits oversized source records visibly without shortening their restrictions or losing later sources", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const oversized = { url: "https://example.com/long-policy", title: "Published policy", productPitchPolicy: { status: "refused" as const, evidence: "A complete policy qualification. ".repeat(500) } };
      const retained = { url: "https://example.com/plans", title: "Plans", pageReportedDates: [{ kind: "updated" as const, date: "2026-11-18", source: "meta" as const }], productPitchPolicy: { status: "refused" as const, evidence: "No product pitches." } };
      const sources = [oversized, retained], requests: TurnRequest[] = [];
      await runAgent({ ...spec(), creativePreparation: false }, { brief: "Synthetic", task: "Draft", facts: [], precomputedResearch: { notes: "Source entries are not inspected page evidence.", sources } }, {
        phase: async (_key, _label, fn) => (await fn()).value,
        turn: async req => {
          requests.push(req); const output = req.system.some(s => s.text.includes("HARD GATES")) ? review : draft;
          return { ok: true, output, text: JSON.stringify(output), appended: [], usage: ZERO_USAGE, costMicros: 0, sources: [], actualModelId: "fixture", stopReason: "end_turn" };
        },
      });
      for (const req of requests) {
        const body = String(req.messages[0].content);
        const packet = body.match(/<untrusted_content source="(?:research source index|reviewer source index)">\n([\s\S]*?)\n<\/untrusted_content>/)?.[1];
        expect(JSON.parse(packet!)).toEqual([retained]);
        expect(body).toContain("1 complete source record omitted");
        expect(body).not.toContain(oversized.url);
      }
      expect(sources).toEqual([oversized, retained]);
    } finally { warn.mockRestore(); }
  });

  it.each([false, true])("keeps every bounded candidate and the complete developed direction past the old cutoff (checkpoint=%s)", async cached => {
    const fill = (prefix: string, max: number) => prefix + "x".repeat(max - prefix.length);
    const marker = "END_OF_SYNTHETIC_DEVELOPED_SOURCE";
    const direction = { ...seeds.directions[0], methodApplication: fill("Synthetic method ", 600), title: fill("Synthetic candidate ", 120),
      businessTension: fill("Synthetic tension ", 500), mechanism: fill("Synthetic exchange ", 700), changedBehavior: fill("Proposed behavior ", 400),
      whyParticipantsCare: fill("Unknown demand ", 500), closestFamiliarAlternative: fill("Synthetic comparison ", 300), meaningfulDifference: fill("Unverified difference ", 500),
      unsupportedAssumptions: Array.from({ length: 5 }, (_, i) => fill(`Assumption ${i} `, 220)), reversibleTest: fill("Private synthetic comparison ", 500),
      evidenceRefs: Array.from({ length: 5 }, (_, i) => fill(`https://example.com/synthetic-${i}/`, 500 - marker.length) + marker),
    };
    const possibilities = CreativePreparationSchema.parse({ directions: ["convention_inversion", "distant_transfer", "asset_recombination", "ownable_behavior"].map((creativeMethod, i) => ({ ...direction, creativeMethod, title: `Synthetic direction ${i}` })) });
    const largeFeedback = CreativeFeedbackSchema.parse({ developedDirection: direction, directions: possibilities.directions.map(candidate => ({
      creativeMethod: candidate.creativeMethod, candidateTitle: candidate.title, mechanismQuote: candidate.mechanism, testQuote: candidate.reversibleTest, comparisonVerdict: "isolates_difference" as const,
      closestFamiliarAlternative: fill("Closest synthetic practice ", 600), consequentialDifference: fill("Unverified consequential difference ", 900),
      mechanismVerdict: "unclear_difference", testOfDifference: fill("Synthetic comparison only ", 700),
    })) });
    expect(JSON.stringify(largeFeedback).length).toBeGreaterThan(20_000);
    const requests: TurnRequest[] = [];
    await runAgent(spec(), { brief: "Synthetic bounded-context test", task: "Prepare possibilities", facts: [] }, {
      phase: async (key, _label, fn) => {
        if (cached && key.index === 49) return { ...possibilities, extra: "UNVALIDATED_CHECKPOINT_EXTRA" } as never;
        if (cached && key.index === 48) return { ...largeFeedback, extra: "UNVALIDATED_CHECKPOINT_EXTRA" } as never;
        return (await fn()).value;
      },
      turn: async req => {
        requests.push(req); const output = req.schema === CreativePreparationSchema ? possibilities : req.schema === CreativeFeedbackSchema ? largeFeedback : req.system.some(s => s.text.includes("HARD GATES")) ? review : draft;
        return { ok: true, output, text: JSON.stringify(output), appended: [], usage: ZERO_USAGE, costMicros: 0, sources: [], actualModelId: "fixture", stopReason: "end_turn" };
      },
    });
    const writer = String(requests[cached ? 0 : 2].messages[0].content);
    const packet = writer.split('<untrusted_content source="advisory mechanism feedback">\n')[1]?.split("\n</untrusted_content>")[0];
    expect(packet?.endsWith("}")).toBe(true);
    expect(JSON.parse(packet!)).toEqual(largeFeedback);
    expect(writer).not.toContain("UNVALIDATED_CHECKPOINT_EXTRA");
    expect(requests).toHaveLength(cached ? 2 : 4);
    expect(requests.every(req => !req.customTools && !req.webSearch && !req.webFetch)).toBe(true);
  });
  it("rejects a malformed exploration checkpoint before requesting feedback or drafting", async () => {
    let calls = 0;
    await expect(runAgent(spec(), { brief: "Synthetic", task: "Resume possibilities", facts: [] }, {
      phase: async (key, _label, fn) => key.index === 49 ? { directions: seeds.directions.slice(0, 1) } as never : (await fn()).value,
      turn: async () => { calls++; return { ok: true, output: feedback, text: "{}", appended: [], usage: ZERO_USAGE, costMicros: 0, sources: [], actualModelId: "fixture", stopReason: "end_turn" }; },
    })).rejects.toMatchObject({ kind: "invalid_output" });
    expect(calls).toBe(0);
  });
  it.each([[false, "mechanism"], [true, "mechanism"], [false, "test"], [true, "test"]] as const)("rejects feedback about different work even when method and title match (checkpoint=%s, field=%s)", async (cached, field) => {
    const wrong = structuredClone(feedback);
    if (field === "mechanism") wrong.directions[0].mechanismQuote = "An unrelated exchange from another candidate or earlier run.";
    else wrong.directions[0].testQuote = "An improved test suggested by the reviewer, absent from the candidate.";
    let calls = 0;
    await expect(runAgent(spec(), { brief: "Synthetic", task: "Prepare possibilities", facts: [] }, {
      phase: async (key, _label, fn) => {
        if (cached && key.index === 49) return seeds as never;
        if (cached && key.index === 48) return wrong as never;
        return (await fn()).value;
      },
      turn: async req => {
        calls++; const output = req.schema === CreativePreparationSchema ? seeds : req.schema === CreativeFeedbackSchema ? wrong : req.system.some(s => s.text.includes("HARD GATES")) ? review : draft;
        return { ok: true, output, text: JSON.stringify(output), appended: [], usage: ZERO_USAGE, costMicros: 0, sources: [], actualModelId: "fixture", stopReason: "end_turn" };
      },
    })).rejects.toMatchObject({ kind: "invalid_output" });
    expect(calls).toBe(cached ? 0 : 2);
  });
  it("can omit advisory feedback without omitting exploration or the independent final review", async () => {
    const requests: TurnRequest[] = [], keys: number[] = [], checkpoints = new Map<number, unknown>();
    const selected = { ...spec(), creativeFeedback: false };
    const deps: AgentDeps = {
      phase: async (key, _label, fn) => {
        if (checkpoints.has(key.index)) return checkpoints.get(key.index) as never;
        keys.push(key.index); const result = await fn(); checkpoints.set(key.index, result.value); return result.value;
      },
      turn: async req => {
        requests.push(req);
        const output = req.schema === CreativePreparationSchema ? seeds : req.system.some(s => s.text.includes("HARD GATES")) ? review : draft;
        return { ok: true, output, text: JSON.stringify(output), appended: [], usage: ZERO_USAGE, costMicros: 0, sources: [], actualModelId: "fixture", stopReason: "end_turn" };
      },
    };
    const input = { brief: "Synthetic case, unknown capacity", task: focusedPlanTask(14), facts: [] };
    const result = await runAgent(selected, input, deps);
    expect(keys).toEqual([49, 1, 2]);
    expect(requests).toHaveLength(3);
    expect(requests.some(req => req.schema === CreativeFeedbackSchema)).toBe(false);
    expect(JSON.stringify(requests[1].messages)).toContain("Synthetic possibility 0");
    expect(JSON.stringify(requests[1].messages)).not.toContain("advisory mechanism feedback");
    expect(JSON.stringify(requests[2].messages)).not.toContain("Synthetic possibility 0");
    expect(requests[2].system.some(s => s.text.includes("FOCUSED ORIGINALITY AUDIT"))).toBe(true);
    expect(requests.every(req => !req.customTools && !req.webSearch && !req.webFetch)).toBe(true);
    const quoted = agentSteps({ ...selected, lint: undefined });
    expect(quoted).toHaveLength(3);
    expect(quoted.map(step => [step.modelKey, step.outputBudget])).toEqual(requests.map(req => [req.modelKey, req.maxTokens]));
    expect(await runAgent(selected, input, deps)).toEqual(result);
    expect(requests).toHaveLength(3);
  });
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

  it("rejects truncated exploration before feedback or drafting, with its full allowance quoted", async () => {
    const requests: TurnRequest[] = [];
    await expect(runAgent(spec(), { brief: "Synthetic", task: "Prepare possibilities", facts: [] }, {
      phase: async (_key, _label, fn) => (await fn()).value,
      turn: async req => {
        requests.push(req);
        return { ok: false, kind: "invalid_output", message: "The answer was cut off at the length limit.", text: '{"directions":[', appended: [], usage: ZERO_USAGE, costMicros: 0 };
      },
    })).rejects.toMatchObject({ kind: "invalid_output" });
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ maxTokens: 16000, modelKey: spec().models.draft });
    expect(agentSteps({ ...focusedStrategySpec(), lint: undefined })[0].outputBudget).toBe(requests[0].maxTokens);
    expect(requests[0].customTools).toBeUndefined();
    expect(requests[0].webSearch).toBeUndefined();
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
    expect(requests[1]).toMatchObject({ maxTokens: 16000, modelKey: spec().models.critic, effort: "high" });
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
