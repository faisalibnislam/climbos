import { describe, expect, it } from "vitest";
import { z } from "zod";
import { assess, runAgent, type AgentDeps } from "../../shared/agents/runtime";
import type { AgentSpec, CritiqueResult, Rubric } from "../../shared/agents/types";
import { ZERO_USAGE } from "../../shared/ai/types";

const rubric: Rubric = { id: "focused-growth-strategy", title: "Focused test", gates: [{ id: "G1", text: "Truth" }], criteria: [{ id: "F1", name: "Useful", anchors: { 1: "weak", 3: "partial", 5: "ready" } }], shipRule: { minEach: 4, minAverage: 4 } };
const output = { summary: "Audience availability is unknown. A private example may help test the job." };
const audit = () => [
  { category: "business_state", basis: "The supplied brief leaves audience unknown; the draft preserves that distinction.", claims: [{ path: "summary", quote: "Audience availability is unknown.", verdict: "supported", basis: "Supplied brief, not an inferred zero.", correction: "none" }] },
  { category: "comparative_claims", basis: "The draft proposes a test without claiming a best-performing channel.", claims: [] },
  { category: "capabilities_and_results", basis: "No existing capability or performance is claimed.", claims: [] },
];
const review = (evidenceAudit: unknown = audit()): CritiqueResult => ({ gates: [{ id: "G1", pass: true, note: "ok" }], scores: ["F1", "XV"].map(id => ({ id, score: 5, note: "Ready", fix: "none" })), strengths: [], fixes: [], evidenceAudit } as CritiqueResult);

describe("focused review evidence integrity", () => {
  it("refuses a missing semantic audit even when the reviewer gives every score five", () => {
    const c = review(); delete (c as unknown as { evidenceAudit?: unknown }).evidenceAudit;
    expect(assess(c, [], rubric).ship).toBe(false);
  });
  it("refuses duplicate or incomplete audit categories", () => {
    expect(assess(review([audit()[0], audit()[0], audit()[2]]), [], rubric).ship).toBe(false);
    expect(assess(review(audit().slice(0, 2)), [], rubric).ship).toBe(false);
  });
  it.each([
    ["business_state", "It has no audience.", "No traffic does not establish no contacts or followers."],
    ["comparative_claims", "This is the cheapest and fastest route.", "No comparative cost or time evidence was supplied."],
    ["capabilities_and_results", "The integration works without setup.", "The page was not inspected and product behavior was not tested."],
    ["capabilities_and_results", "A checkout is payment.", "A started checkout does not establish a successful payment."],
    ["capabilities_and_results", "Customer payment volume is our software revenue.", "No evidence establishes that the vendor earns the merchant receipts."],
  ])("turns an unsupported %s claim into a blocking finding despite a passing truth gate", (category, quote, basis) => {
    const rows = audit();
    rows.find(row => row.category === category)!.claims = [{ path: "summary", quote, verdict: "unsupported", basis, correction: "Keep this unknown or label it as a proposed hypothesis." }];
    const result = assess(review(rows), [], rubric);
    expect(result.ship).toBe(false);
    expect(result.lint).toContainEqual(expect.objectContaining({ rule: "invented_fact", path: "summary", severity: "error" }));
  });
  it("accepts an explicitly qualified original hypothesis without a precedent or forecast", () => {
    const rows = audit(); rows[0].claims[0].verdict = "qualified";
    expect(assess(review(rows), [], rubric).ship).toBe(true);
  });
  it("rejects a supported or qualified verdict that still requires a factual correction", () => {
    const rows = audit(); rows[0].claims[0].verdict = "qualified";
    rows[0].claims[0].correction = "Remove the unsupported restriction on who pays.";
    expect(assess(review(rows), [], rubric).ship).toBe(false);
  });
  it("does not impose this focused contract on other existing rubrics", () => {
    const c = review(); delete (c as unknown as { evidenceAudit?: unknown }).evidenceAudit;
    expect(assess(c, [], { ...rubric, id: "other-task" }).ship).toBe(true);
  });
});

async function runReview(options: { invalidQuote?: boolean; skipFinalReview?: boolean } = {}) {
  let calls = 0, reviews = 0;
  const spec: AgentSpec<typeof output> = {
    id: "growth_strategy", label: "Synthetic focused strategy", role: "cmo", skills: [], schema: z.object({ summary: z.string() }), rubric,
    models: { research: "gpt-6-luna", draft: "gpt-6-luna", critic: "gpt-6-luna" }, effort: { research: "low", draft: "low", critic: "low" },
    maxTokens: { research: 100, draft: 100, critic: 100 }, maxRevisions: options.skipFinalReview ? 1 : 0, skipFinalReview: options.skipFinalReview,
  };
  const deps: AgentDeps = {
    turn: async req => {
      calls++;
      const isReview = req.system.some(block => block.text.includes("HARD GATES"));
      let value: unknown = output;
      if (isReview) {
        reviews++;
        const rows = audit();
        if (options.invalidQuote) rows[0].claims[0].quote = "A sentence not present in this version.";
        value = review(rows);
        if (options.skipFinalReview && reviews === 1) (value as CritiqueResult).scores.forEach(score => { score.score = 3; });
      }
      return { ok: true, output: value, text: JSON.stringify(value), appended: [], usage: { ...ZERO_USAGE, calls: 1 }, costMicros: 0, sources: [], actualModelId: "fixture", stopReason: "end_turn" };
    },
    phase: async (_key, _label, work) => (await work()).value,
  };
  const result = await runAgent(spec, { task: "Propose a private test", brief: "Audience availability is unknown.", facts: [] }, deps);
  return { result, calls, reviews };
}

it("checks the review quote against the exact draft instead of trusting an invented citation", async () => {
  const { result } = await runReview({ invalidQuote: true });
  expect(result.assessment?.ship).toBe(false);
  expect(result.assessment?.lint).toContainEqual(expect.objectContaining({ rule: "review_scores", severity: "error" }));
});

it("re-reviews a changed focused draft even when the generic fast-review shortcut is enabled", async () => {
  const { result, reviews, calls } = await runReview({ skipFinalReview: true });
  expect(reviews).toBe(2); expect(calls).toBe(4);
  expect(result.assessment?.ship).toBe(true);
});
