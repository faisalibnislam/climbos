import { describe, expect, it } from "vitest";
import { z } from "zod";
import { runAgent, type AgentDeps, type PhaseRecord } from "../../shared/agents/runtime";
import { focusedSectionRevisionSchema, mergeFocusedSections } from "../../shared/agents/focusedPlan";
import { focusedStrategySpec, starterStrategySpec } from "../../shared/agents/specs";
import { ZERO_USAGE, type TurnRequest } from "../../shared/ai/types";

const schema = z.object({ summary: z.string().min(4), preparedWork: z.array(z.object({ draft: z.string().min(10) })).min(1) });
const original = { summary: "An unsupported audience claim", preparedWork: [{ draft: "A complete, useful synthetic private example." }] };
const review = (score: number) => ({
  gates: [{ id: "truth", pass: true, note: "Synthetic judgment only" }],
  scores: ["useful", "XV"].map(id => ({ id, score, note: "Correct the summary, preserve the example.", fix: score < 4 ? "Keep audience availability unknown." : "none" })),
  strengths: ["Keep the complete prepared example."], fixes: score < 4 ? ["Correct the summary only."] : [],
  evidenceAudit: ["business_state", "comparative_claims", "capabilities_and_results"].map(category => ({ category, basis: "Synthetic fixture, no real business evidence", claims: [] })),
});
const spec = { ...focusedStrategySpec({ maxRevisions: 1 }), creativePreparation: false, sectionRevisions: true, schema, lint: undefined,
  rubric: { id: "focused-growth-strategy", title: "Synthetic repair", gates: [{ id: "truth", text: "Do not invent" }], criteria: [{ id: "useful", name: "Useful", anchors: { 1: "weak", 3: "partial", 5: "ready" } }], shipRule: { minEach: 4, minAverage: 4 } },
};

async function run(patch: unknown, lastReview = review(5)) {
  const responses = [original, review(3), patch, lastReview];
  const requests: TurnRequest[] = [], records: PhaseRecord[] = [], checkpoints = new Map<number, unknown>();
  let reservations = 0;
  const deps: AgentDeps = {
    beforeRevision: async () => { reservations++; return true; },
    turn: async req => { requests.push(req); const output = responses.shift(); return { ok: true, output, text: JSON.stringify(output), appended: [], usage: ZERO_USAGE, costMicros: 0, sources: [], actualModelId: "fixture", stopReason: "end_turn" }; },
    phase: async (key, _label, fn) => {
      if (checkpoints.has(key.index)) return checkpoints.get(key.index) as never;
      const result = await fn(); records.push(result.record); checkpoints.set(key.index, result.value); return result.value;
    },
  };
  const input = { task: "Correct the proposed summary without discarding useful work.", brief: "Synthetic", facts: [] };
  const result = await runAgent(spec, input, deps);
  return { result, requests, records, reservations, resume: () => runAgent(spec, input, deps) };
}

describe("bounded focused section repairs", () => {
  it("delivers mechanism-replacement guidance in the existing reserved repair, then reviews the complete result", async () => {
    const creativeSchema = schema.extend({ strategyExploration: z.object({ bold: z.string() }) });
    const first = { ...original, strategyExploration: { bold: "A familiar synthetic trial mechanism" } };
    const patch = { strategyExploration: { bold: "A changed synthetic participant exchange" } };
    const creativeReview = (score: number) => ({ ...review(score), scores: ["F7", "XV"].map(id => ({ id, score, note: "Synthetic originality assessment", fix: score < 4 ? "Replace the familiar bold mechanism." : "none" })) });
    const responses = [first, creativeReview(3), patch, creativeReview(5)], requests: TurnRequest[] = [];
    let reservations = 0;
    const result = await runAgent({ ...spec, schema: creativeSchema, rubric: { ...spec.rubric, criteria: [{ ...spec.rubric.criteria[0], id: "F7" }] } }, { brief: "Synthetic, access and time unknown", task: "Explore distinct mechanisms", facts: [] }, {
      beforeRevision: async () => { reservations++; return true; },
      phase: async (_key, _label, fn) => (await fn()).value,
      turn: async req => { requests.push(req); const output = responses.shift(); return { ok: true, output, text: JSON.stringify(output), appended: [], usage: ZERO_USAGE, costMicros: 0, sources: [], actualModelId: "fixture", stopReason: "end_turn" }; },
    });
    expect(reservations).toBe(1); expect(requests).toHaveLength(4);
    expect(JSON.stringify(requests[2].messages)).toContain("CREATIVE REPAIR SCOPE");
    expect(JSON.stringify(requests[2].messages)).toContain("You may discard every preliminary candidate");
    expect(requests.every(req => req.customTools === undefined && req.webSearch === undefined)).toBe(true);
    expect(JSON.stringify(requests[3].messages)).toContain(patch.strategyExploration.bold);
    expect(JSON.stringify(requests[3].messages)).toContain(first.preparedWork[0].draft);
    expect(result.output).toEqual({ ...first, ...patch });
    expect(result.assessment?.ship).toBe(true); // synthetic review, not an originality claim
  });
  it("keeps omitted sections, preserves the raw patch and reviews the complete merged draft before accepting it", async () => {
    const patch = { summary: "Audience availability remains unknown." };
    const { result, requests, records, reservations, resume } = await run(patch);
    expect(requests[2].schema!.safeParse(patch).success).toBe(true);
    expect(result.output).toEqual({ ...original, ...patch });
    expect(original.summary).toBe("An unsupported audience claim");
    expect(JSON.stringify(requests[3].messages)).toContain(original.preparedWork[0].draft);
    expect(JSON.stringify(requests[3].messages)).toContain(patch.summary);
    expect(records[2].result).toMatchObject({ ok: true, output: patch });
    expect(result.assessment?.ship).toBe(true);
    expect(reservations).toBe(1);
    expect(await resume()).toEqual(result);
    expect(requests).toHaveLength(4);
  });

  it.each([{}, { unauthorizedPublish: true }, { preparedWork: [] }, { preparedWork: [{ draft: "short" }] }])("rejects invalid or empty patches without erasing the reviewed draft: %j", async patch => {
    const { result, requests } = await run(patch);
    expect(result.output).toEqual(original);
    expect(result.assessment?.ship).toBe(false);
    expect(result.quality?.revisionFailure?.kind).toBe("invalid_output");
    expect(requests).toHaveLength(3);
  });

  it("does not accept a merged revision merely because the previous review passed some checks", async () => {
    const failed = review(5); failed.gates[0].pass = false;
    const { result, requests } = await run({ summary: "A new unsupported claim remains here." }, failed);
    expect(requests).toHaveLength(4);
    expect(result.assessment?.ship).toBe(false);
    expect(result.output).toEqual(original);
  });

  it("validates full cross-section constraints, not only the partial response", () => {
    const linked = z.object({ title: z.string(), experimentName: z.string() }).refine(plan => plan.title === plan.experimentName);
    expect(focusedSectionRevisionSchema(linked).safeParse({ title: "Changed" }).success).toBe(true);
    expect(() => mergeFocusedSections(linked, { title: "Original", experimentName: "Original" }, { title: "Changed" })).toThrow();
    expect(mergeFocusedSections(linked, { title: "Original", experimentName: "Original" }, { title: "Changed", experimentName: "Changed" })).toEqual({ title: "Changed", experimentName: "Changed" });
    expect(() => focusedSectionRevisionSchema(z.string())).toThrow(/object schema/);
    expect(focusedStrategySpec().sectionRevisions).toBe(true);
    expect(starterStrategySpec().sectionRevisions).toBe(false);
  });
});
