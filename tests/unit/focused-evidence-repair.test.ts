import { focusedOriginalityFixture } from "../fixtures/focusedOriginality";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { runAgent, type AgentDeps } from "../../shared/agents/runtime";
import { focusedStrategySpec } from "../../shared/agents/specs";
import { ZERO_USAGE, type TurnRequest } from "../../shared/ai/types";

const base = focusedStrategySpec();
const schema = z.object({ summary: z.string() });
const original = { summary: "Unsupported claim one. Unsupported claim two." };
const revision = { summary: "Only one remaining unsupported claim." };
const repaired = { summary: "Qualified proposal, not a proven result." };
type Options = { reserve?: boolean; errors?: number; score?: number; failedGate?: string; malformed?: boolean; finalPass?: boolean; sectionRevisions?: boolean; maxRevisions?: number; cleanOriginal?: boolean };
function review(summary: string, errors: number, score: number, failedGate?: string, malformed = false) {
  return {
    gates: base.rubric.gates.map(gate => ({ id: gate.id, pass: gate.id !== failedGate, note: "Synthetic review" })),
    scores: [...base.rubric.criteria.map(criterion => criterion.id), "XV"].map(id => ({ id, score, note: "Synthetic quality", fix: "Correct the unsupported claim." })),
    strengths: ["Keep the improved reasoning."], fixes: ["Correct the remaining claim."],
    originalityAudit: focusedOriginalityFixture,
    evidenceAudit: ["business_state", "comparative_claims", "capabilities_and_results"].map((category, index) => ({
      category, basis: "Synthetic evidence", claims: index === 0 ? Array.from({ length: errors }, (_, i) => ({
        path: malformed ? "missingField" : "summary", quote: summary, verdict: "unsupported", basis: `Missing evidence ${i}.`, correction: "Qualify the claim.",
      })) : [],
    })),
  };
}
async function run(options: Options = {}) {
  const requests: TurnRequest[] = [], reservations: number[] = [];
  const responses = [original, review(original.summary, options.cleanOriginal ? 0 : 2, 3), revision,
    review(revision.summary, options.errors ?? 1, options.score ?? 4, options.failedGate ?? "G1", options.malformed),
    repaired, review(repaired.summary, options.finalPass === false ? 1 : 0, 4, options.finalPass === false ? "G1" : undefined)];
  const deps: AgentDeps = {
    phase: async (_key, _label, fn) => (await fn()).value,
    beforeRevision: async round => { reservations.push(round); return round === 1 || options.reserve !== false; },
    turn: async request => {
      requests.push(request);
      const output = responses.shift();
      return { ok: true, output, text: JSON.stringify(output), appended: [], usage: ZERO_USAGE, costMicros: 0, sources: [], actualModelId: request.modelKey, stopReason: "end_turn" };
    },
  };
  const result = await runAgent({ ...base, schema, lint: () => [], creativePreparation: false,
    sectionRevisions: options.sectionRevisions ?? true, maxRevisions: options.maxRevisions ?? 2 },
  { task: "Repair the factual defects", brief: "Synthetic regression", facts: [] }, deps);
  return { result, requests, reservations };
}

describe("bounded factual repair without relaxing acceptance", () => {
  it("finishes improving factual work despite a changed truth-gate verdict, then reviews the full result", async () => {
    const { result, requests, reservations } = await run();
    expect(requests).toHaveLength(6);
    expect(reservations).toEqual([1, 2]);
    expect(JSON.stringify(requests[4].messages)).toContain(revision.summary);
    expect(JSON.stringify(requests[5].messages)).toContain(repaired.summary);
    expect(result.history.map(row => row.lintErrors)).toEqual([2, 1, 0]);
    expect(result.assessment?.ship).toBe(true);
    expect(result.output).toEqual(repaired);
    expect(requests.every(request => !request.customTools?.length && !request.webSearch && !request.webFetch)).toBe(true);
    expect(requests.map(request => request.modelKey)).toEqual([base.models.draft, base.models.critic, base.models.revise ?? base.models.draft, base.models.critic, base.models.revise ?? base.models.draft, base.models.critic]);
  });
  it.each([{ errors: 2 }, { score: 2 }, { failedGate: "G2" }, { failedGate: "G3" }, { failedGate: "G4" }, { malformed: true }, { sectionRevisions: false }, { cleanOriginal: true }])("does not relax limits or expand repair for unrelated failures: %j", async options => {
    const { result, requests } = await run(options);
    expect(requests).toHaveLength(4);
    expect(result.output).toEqual(original);
    expect(result.assessment?.ship).toBe(false);
  });
  it("retains a reviewed failed fallback when the last repair still fails", async () => {
    const { result, requests } = await run({ finalPass: false });
    expect(requests).toHaveLength(6);
    expect(result.assessment?.ship).toBe(false);
    expect(result.output).toEqual(revision);
  });
  it.each([{ reserve: false }, { maxRevisions: 1 }])("retains the improved reviewed failure without another budgeted round: %j", async options => {
    const { result, requests } = await run(options);
    expect(requests).toHaveLength(4);
    expect(result.output).toEqual(revision);
    expect(result.assessment?.ship).toBe(false);
    expect(result.assessment?.gatesPassed).toBe(false);
    expect(result.assessment?.lint.filter(issue => issue.severity === "error")).toHaveLength(1);
  });
  it.each([false, true])("selects the less-defective reviewed candidate regardless of initial ordering (%s)", async reverse => {
    const drafts = reverse ? [revision, original] : [original, revision];
    const result = await runAgent({ ...base, schema, lint: () => [], creativePreparation: false, sectionRevisions: true, drafts: 2, maxRevisions: 0 },
      { task: "Compare reviewed candidates", brief: "Synthetic regression", facts: [] }, {
        phase: async (_key, _label, fn) => (await fn()).value,
        turn: async request => {
          const revised = JSON.stringify(request.messages).includes(revision.summary);
          const output = request.system.some(block => block.text.includes("HARD GATES"))
            ? revised ? review(revision.summary, 1, 4, "G1") : review(original.summary, 2, 3)
            : drafts.shift();
          return { ok: true, output, text: JSON.stringify(output), appended: [], usage: ZERO_USAGE, costMicros: 0, sources: [], actualModelId: request.modelKey, stopReason: "end_turn" };
        },
      });
    expect(result.output).toEqual(revision);
    expect(result.assessment?.ship).toBe(false);
    expect(result.assessment?.gatesPassed).toBe(false);
  });
});
