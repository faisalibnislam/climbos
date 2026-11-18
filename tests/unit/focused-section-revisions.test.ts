import { focusedOriginalityFixture } from "../fixtures/focusedOriginality";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AgentYield, runAgent, type AgentDeps, type PhaseRecord } from "../../shared/agents/runtime";
import { focusedSectionRevisionSchema, mergeFocusedSections } from "../../shared/agents/focusedPlan";
import { focusedStrategySpec, starterStrategySpec } from "../../shared/agents/specs";
import { ZERO_USAGE, type TurnRequest } from "../../shared/ai/types";

const schema = z.object({ summary: z.string().min(4), preparedWork: z.array(z.object({ draft: z.string().min(10) })).min(1) });
const original = { summary: "An unsupported audience claim", preparedWork: [{ draft: "A complete, useful synthetic private example." }] };
const review = (score: number) => ({
  gates: [{ id: "truth", pass: true, note: "Synthetic judgment only" }],
  scores: ["useful", "XV"].map(id => ({ id, score, note: "Correct the summary, preserve the example.", fix: score < 4 ? "Keep audience availability unknown." : "none" })),
  strengths: ["Keep the complete prepared example."], fixes: score < 4 ? ["Correct the summary only."] : [],
  originalityAudit: focusedOriginalityFixture,
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
  it("carries earlier mechanism and factual findings into a later repair without feeding them to the independent critic", async () => {
    const creativeSchema = schema.extend({ strategyExploration: z.object({ bold: z.object({ title: z.string(), businessMechanism: z.string() }) }) });
    const first = { ...original, summary: "Payers carry all the outcome risk.", strategyExploration: { bold: { title: "Original refund proposal", businessMechanism: "A familiar paid inbox and refund guarantee." } } };
    const middle = { summary: "Payment and customer risk remain unknown.", strategyExploration: { bold: { title: "Replacement wallet proposal", businessMechanism: "A familiar portable answer profile." } } };
    const final = { strategyExploration: { bold: { title: "A changed exchange to review", businessMechanism: "A different synthetic value exchange with honest unknowns." } } };
    const earlierReview = { ...review(3), originalityAudit: { ...focusedOriginalityFixture, mechanismQuote: first.strategyExploration.bold.businessMechanism, mechanismVerdict: "familiar_mechanism", closestFamiliarAlternative: "Earlier paid-inbox comparison", consequentialDifference: "Refunds alone do not change the exchange." } };
    earlierReview.evidenceAudit[0].claims = [{ path: "summary", quote: first.summary, verdict: "unsupported", basis: "No supplied source establishes which party bears all risk.", correction: "Keep the actual risk allocation unknown." }] as never;
    const laterReview = { ...review(3), originalityAudit: { ...focusedOriginalityFixture, mechanismQuote: middle.strategyExploration.bold.businessMechanism, mechanismVerdict: "familiar_mechanism", closestFamiliarAlternative: "Current profile-wallet comparison" } };
    const responses = [first, earlierReview, middle, laterReview, final, review(5)], requests: TurnRequest[] = [];
    const result = await runAgent({ ...spec, schema: creativeSchema, maxRevisions: 2 }, { task: "Synthetic creative repair", brief: "No risk allocation measured", facts: [] }, {
      beforeRevision: async () => true,
      phase: async (_key, _label, fn) => (await fn()).value,
      turn: async req => { requests.push(req); const value = responses.shift(); return { ok: true, output: value, text: JSON.stringify(value), appended: [], usage: ZERO_USAGE, costMicros: 0, sources: [], actualModelId: "fixture", stopReason: "end_turn" }; },
    });
    expect(requests).toHaveLength(6);
    const secondRepair = JSON.stringify(requests[4].messages);
    expect(secondRepair).toContain("Original refund proposal");
    expect(secondRepair).toContain("Earlier paid-inbox comparison");
    expect(secondRepair).toContain("Keep the actual risk allocation unknown.");
    expect(secondRepair).toContain("may revisit or disagree");
    expect(JSON.stringify(requests[5].messages)).not.toContain("Earlier paid-inbox comparison");
    expect(JSON.stringify(requests[5].messages)).not.toContain("Original refund proposal");
    expect(result.assessment?.ship).toBe(true);
  });
  it.each(["recover", "deny", "yield", "repeat_failure", "review_failure"] as const)("uses only the remaining reserved attempt for a string-length failure: %s", async mode => {
    const bounded = schema.extend({ summary: z.string().min(4).max(40) });
    const tooLong = bounded.shape.summary.safeParse("x".repeat(41));
    if (tooLong.success) throw new Error("Fixture must exceed the bound");
    // The provider validates the partial JSON and reports this exact kind of error.
    const issues = tooLong.error.issues.map(issue => ({ ...issue, path: ["summary"] }));
    const failure = { ok: false as const, kind: "invalid_output" as const, message: JSON.stringify(issues), text: "", appended: [], usage: ZERO_USAGE, costMicros: 0 };
    const requests: TurnRequest[] = [], keys: number[] = [], checkpoints = new Map<number, unknown>();
    const reservations: number[] = [];
    let yielded = false;
    const responses = [original, review(3), failure, mode === "repeat_failure" ? failure : { summary: "Audience availability stays unknown." }, review(mode === "review_failure" ? 3 : 5)];
    const deps: AgentDeps = {
      beforeRevision: async round => {
        reservations.push(round);
        if (round === 2 && mode === "deny") return false;
        if (round === 2 && mode === "yield" && !yielded) { yielded = true; throw new AgentYield(); }
        return true;
      },
      turn: async req => {
        requests.push(req); const value = responses.shift();
        if (value === failure) return failure;
        return { ok: true, output: value, text: JSON.stringify(value), appended: [], usage: ZERO_USAGE, costMicros: 0, sources: [], actualModelId: "fixture", stopReason: "end_turn" };
      },
      phase: async (key, _label, fn) => {
        if (checkpoints.has(key.index)) return checkpoints.get(key.index) as never;
        keys.push(key.index); const phase = await fn(); checkpoints.set(key.index, phase.value); return phase.value;
      },
    };
    const execute = () => runAgent({ ...spec, schema: bounded, maxRevisions: 2 }, { task: "Synthetic repair", brief: "Access unknown", facts: [] }, deps);
    if (mode === "yield") await expect(execute()).rejects.toBeInstanceOf(AgentYield);
    const result = await execute();
    expect(reservations).toEqual(mode === "yield" ? [1, 2, 1, 2] : [1, 2]);
    expect(requests.every(req => !req.customTools && !req.webSearch)).toBe(true);
    expect(result.quality?.revisionFailure?.kind).toBe("invalid_output");
    if (mode === "deny" || mode === "repeat_failure") {
      expect(requests).toHaveLength(mode === "deny" ? 3 : 4);
      expect(result.output).toEqual(original); expect(result.assessment?.ship).toBe(false);
    } else {
      expect(requests).toHaveLength(5); // The failed attempt is checkpointed even across a yield.
      expect(keys).toEqual([1, 2, 3, 5, 6]);
      expect(JSON.stringify(requests[3].messages)).toContain("STRING LENGTH CORRECTION");
      expect(JSON.stringify(requests[4].messages)).toContain("Audience availability stays unknown.");
      expect(result.output.preparedWork).toEqual(original.preparedWork);
      expect(result.assessment?.ship).toBe(mode !== "review_failure");
    }
  });
  it.each([
    "The answer was cut off at the length limit.",
    '[{"origin":"array","code":"too_big","maximum":3,"path":["preparedWork"]}]',
    '[{"origin":"string","code":"too_big","maximum":40,"path":["summary"]},{"code":"unrecognized_keys","keys":["publish"],"path":[]}]',
  ])("does not turn other invalid output into a length retry: %s", async message => {
    let calls = 0, reservations = 0;
    const result = await runAgent({ ...spec, maxRevisions: 2 }, { task: "Synthetic", brief: "Unknown audience", facts: [] }, {
      beforeRevision: async () => { reservations++; return true; },
      phase: async (_key, _label, fn) => (await fn()).value,
      turn: async () => {
        calls++;
        if (calls === 3) return { ok: false, kind: "invalid_output", message, text: "", appended: [], usage: ZERO_USAGE, costMicros: 0 };
        const value = calls === 1 ? original : review(3);
        return { ok: true, output: value, text: JSON.stringify(value), appended: [], usage: ZERO_USAGE, costMicros: 0, sources: [], actualModelId: "fixture", stopReason: "end_turn" };
      },
    });
    expect(calls).toBe(3); expect(reservations).toBe(1);
    expect(result.output).toEqual(original); expect(result.assessment?.ship).toBe(false);
  });
  it("delivers mechanism-replacement guidance in the existing reserved repair, then reviews the complete result", async () => {
    const creativeSchema = schema.extend({ strategyExploration: z.object({ bold: z.object({ businessMechanism: z.string() }) }) });
    const first = { ...original, strategyExploration: { bold: { businessMechanism: "A familiar synthetic trial mechanism" } } };
    const patch = { strategyExploration: { bold: { businessMechanism: "A changed synthetic participant exchange" } } };
    const realRubric = focusedStrategySpec().rubric;
    const creativeReview = (score: number, mechanism: string) => ({ ...review(score),
      originalityAudit: { ...focusedOriginalityFixture, mechanismQuote: mechanism },
      gates: realRubric.gates.map(gate => ({ id: gate.id, pass: true, note: "Synthetic gate" })),
      scores: [...realRubric.criteria.map(criterion => criterion.id), "XV"].map(id => ({ id, score: id === "F7" ? score : 4, note: "Synthetic originality assessment", fix: id === "F7" && score < 4 ? "Replace the familiar bold mechanism." : "none" })),
    });
    const responses = [first, creativeReview(3, first.strategyExploration.bold.businessMechanism), patch, creativeReview(5, patch.strategyExploration.bold.businessMechanism)], requests: TurnRequest[] = [];
    let reservations = 0;
    const result = await runAgent({ ...spec, schema: creativeSchema, rubric: realRubric }, { brief: "Synthetic, access and time unknown", task: "Explore distinct mechanisms", facts: [] }, {
      beforeRevision: async () => { reservations++; return true; },
      phase: async (_key, _label, fn) => (await fn()).value,
      turn: async req => { requests.push(req); const output = responses.shift(); return { ok: true, output, text: JSON.stringify(output), appended: [], usage: ZERO_USAGE, costMicros: 0, sources: [], actualModelId: "fixture", stopReason: "end_turn" }; },
    });
    expect(reservations).toBe(1); expect(requests).toHaveLength(4);
    expect(JSON.stringify(requests[2].messages)).toContain("CREATIVE REPAIR SCOPE");
    expect(JSON.stringify(requests[2].messages)).toContain("You may discard every preliminary candidate");
    expect(requests.every(req => req.customTools === undefined && req.webSearch === undefined)).toBe(true);
    expect(JSON.stringify(requests[3].messages)).toContain(patch.strategyExploration.bold.businessMechanism);
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
