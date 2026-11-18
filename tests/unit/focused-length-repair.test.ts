import { describe, expect, it } from "vitest";
import { z } from "zod";
import { runAgent, type AgentDeps } from "../../shared/agents/runtime";
import { focusedStrategySpec } from "../../shared/agents/specs";
import { ZERO_USAGE, type TurnRequest } from "../../shared/ai/types";
import type { LintIssue } from "../../shared/agents/types";

const schema = z.object({ summary: z.string(), preparedWork: z.array(z.object({ draft: z.string() })) });
const original = { summary: "Original", preparedWork: [{ draft: "Short original work." }] };
const revised = { summary: "Improved strategic mechanism", preparedWork: [{ draft: "x".repeat(2432) }] };
const repaired = { ...revised, preparedWork: [{ draft: "Concise revised work." }] };
const base = focusedStrategySpec();
function review(stage: "original" | "revised" | "repaired", improve = true, truth = true) {
  return { gates: base.rubric.gates.map(g => ({ id: g.id, pass: truth, note: "Synthetic check" })),
    scores: [...base.rubric.criteria.map(c => c.id), "XV"].map(id => ({ id,
      score: stage === "repaired" ? 4 : id === "F7" ? stage === "original" || !improve ? 3 : 4 : id === "F3" ? stage === "revised" && improve ? 3 : 4 : 4,
      note: "Synthetic strategy and length tradeoff", fix: "Retain strategic improvement and shorten the draft." })),
    strengths: ["Retain the improved mechanism."], fixes: ["Shorten preparedWork[0].draft without deleting its substance."],
    evidenceAudit: ["business_state", "comparative_claims", "capabilities_and_results"].map(category => ({ category, basis: "Synthetic fixture", claims: [] })),
  };
}
async function run(options: { rule?: string; improve?: boolean; budget?: boolean; finalPass?: boolean; truth?: boolean; sectionRevisions?: boolean } = {}) {
  const requests: TurnRequest[] = [], reservations: number[] = [];
  const responses = [original, review("original"), revised, review("revised", options.improve, options.truth), repaired, review(options.finalPass === false ? "original" : "repaired")];
  const spec = { ...base, creativePreparation: false, sectionRevisions: options.sectionRevisions ?? true, schema,
    lint: (out: z.infer<typeof schema>): LintIssue[] => out.preparedWork[0].draft.length > 2400 ? [{ severity: "error", rule: options.rule ?? "word_cap", path: "preparedWork[0].draft", message: "Synthetic failure" }] : [],
  };
  const deps: AgentDeps = {
    beforeRevision: async round => { reservations.push(round); return round === 1 || options.budget !== false; },
    phase: async (_key, _label, fn) => (await fn()).value,
    turn: async req => { requests.push(req); const output = responses.shift(); return { ok: true, output, text: JSON.stringify(output), appended: [], usage: ZERO_USAGE, costMicros: 0, sources: [], actualModelId: "synthetic", stopReason: "end_turn" }; },
  };
  const result = await runAgent(spec, { task: "Improve the strategy without changing known inputs.", brief: "Synthetic regression", facts: [] }, deps);
  return { result, requests, reservations };
}

describe("a bounded repair after a strategically improved but overlong focused revision", () => {
  it("uses the remaining reserved revision and re-reviews the full corrected output", async () => {
    const { result, requests, reservations } = await run();
    expect(requests).toHaveLength(6);
    expect(reservations).toEqual([1, 2]);
    expect(JSON.stringify(requests[4].messages)).toContain(revised.summary);
    expect(JSON.stringify(requests[5].messages)).toContain(repaired.preparedWork[0].draft);
    expect(result.output).toEqual(repaired);
    expect(result.assessment?.ship).toBe(true);
    expect(result.history.map(row => row.lintErrors)).toEqual([0, 1, 0]);
  });
  it.each([{ rule: "invented_fact" }, { improve: false }, { truth: false }, { sectionRevisions: false }])("keeps early stopping for other failures or no strategic improvement: %j", async options => {
    const { result, requests, reservations } = await run(options);
    expect(requests).toHaveLength(4);
    expect(reservations).toEqual([1]);
    expect(result.output).toEqual(original);
    expect(result.assessment?.ship).toBe(false);
  });
  it("honors a refused reservation without changing model or exposing the failed revision", async () => {
    const { result, requests, reservations } = await run({ budget: false });
    expect(reservations).toEqual([1, 2]);
    expect(requests).toHaveLength(4);
    expect(result.output).toEqual(original);
    expect(result.assessment?.ship).toBe(false);
  });
  it("does not declare success when the final independent review still fails", async () => {
    const { result, requests } = await run({ finalPass: false });
    expect(requests).toHaveLength(6);
    expect(result.assessment?.ship).toBe(false);
    expect(result.output).toEqual(original);
    expect(result.history).toHaveLength(3);
  });
});
