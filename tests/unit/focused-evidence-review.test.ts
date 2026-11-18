import { describe, expect, it } from "vitest";
import { z } from "zod";
import { assess, runAgent, type AgentDeps } from "../../shared/agents/runtime";
import type { AgentSpec, CritiqueResult, Rubric } from "../../shared/agents/types";
import { ZERO_USAGE } from "../../shared/ai/types";
import { focusedRevisionCriteria } from "../../shared/agents/focusedReview";
import { focusedStrategySpec } from "../../shared/agents/specs";

const rubric: Rubric = { id: "focused-growth-strategy", title: "Focused test", gates: [{ id: "G1", text: "Truth" }], criteria: [{ id: "F1", name: "Useful", anchors: { 1: "weak", 3: "partial", 5: "ready" } }], shipRule: { minEach: 4, minAverage: 4 } };
const output = { summary: "Audience availability is unknown. A private example may help test the job." };
const audit = () => [
  { category: "business_state", planChecks: [], basis: "The supplied brief leaves audience unknown; the draft preserves that distinction.", claims: [{ path: "summary", quote: "Audience availability is unknown.", verdict: "supported", basis: "Supplied brief, not an inferred zero.", correction: "none" }] },
  { category: "comparative_claims", planChecks: [], basis: "The draft proposes a test without claiming a best-performing channel.", claims: [] },
  { category: "capabilities_and_results", planChecks: [], basis: "No existing capability or performance is claimed.", claims: [] },
];
const review = (evidenceAudit: unknown = audit()): CritiqueResult => ({ gates: [{ id: "G1", pass: true, note: "ok" }], scores: ["F1", "XV"].map(id => ({ id, score: 5, note: "Ready", fix: "none" })), strengths: [], fixes: [], evidenceAudit } as CritiqueResult);

describe("focused review evidence integrity", () => {
  it("delivers average-deficit feedback at the real focused rubric's individual floor", () => {
    const realRubric = focusedStrategySpec().rubric;
    expect(realRubric.shipRule).toEqual({ minEach: 3, minAverage: 4 });
    const c = review();
    c.scores = realRubric.criteria.map(criterion => ({ id: criterion.id, score: criterion.id === "F7" ? 3 : 4, note: "Synthetic criterion", fix: criterion.id === "F7" ? "Replace the familiar bold mechanism." : "Optional polish" }));
    expect(focusedRevisionCriteria(c, realRubric)).toContain("CREATIVE REPAIR SCOPE");
    expect(focusedRevisionCriteria(c, realRubric)).not.toContain("Optional polish");
    c.scores.find(score => score.id === "F7")!.score = 3.5;
    expect(focusedRevisionCriteria(c, realRubric)).toContain("Replace the familiar bold mechanism.");
    c.scores.filter(score => score.id !== "F7").forEach(score => { score.score = 5; });
    expect(focusedRevisionCriteria(c, realRubric)).toBe(""); // no average deficit: no optional rewrites
    c.scores.filter(score => score.id !== "F7").forEach(score => { score.score = 4; });
    c.scores.push({ ...c.scores[0] });
    expect(focusedRevisionCriteria(c, realRubric)).toBe(""); // an incomplete/duplicate review cannot justify an average
  });
  it("normalizes explicit dot-number array paths only when the exact indexed quote matches", () => {
    const draft = { preparedWork: [{ draft: "Audience availability is unknown." }, { draft: "Audience availability is unknown." }] };
    const rows = audit(); rows[0].claims[0].path = "preparedWork.1.draft";
    const raw = review(rows), result = assess(raw, [], rubric, draft);
    expect(result.ship).toBe(true);
    expect(result.critique.evidencePathCorrections).toEqual([{ reportedPath: "preparedWork.1.draft", resolvedPath: "preparedWork[1].draft", quote: "Audience availability is unknown." }]);
    expect(raw.evidenceAudit?.[0].claims[0].path).toBe("preparedWork.1.draft");
    rows[0].claims[0].verdict = "unsupported"; rows[0].claims[0].correction = "Correct this unsupported claim.";
    expect(assess(review(rows), [], rubric, draft).lint).toContainEqual(expect.objectContaining({ rule: "invented_fact", path: "preparedWork[1].draft" }));
    rows[0].claims[0].path = "preparedWork.9.draft";
    expect(assess(review(rows), [], rubric, draft).lint).toContainEqual(expect.objectContaining({ rule: "review_scores" }));
    rows[0].claims[0].path = "preparedWork.1.draft"; rows[0].claims[0].quote = "An invented quotation";
    expect(assess(review(rows), [], rubric, draft).lint).toContainEqual(expect.objectContaining({ rule: "review_scores" }));
  });
  it("uses an explicitly named array to disambiguate an omitted index without waiving the claim", () => {
    const rows = audit(); rows[0].claims[0] = { ...rows[0].claims[0], path: "choice.evidenceRefs", quote: "fact:2", verdict: "unsupported", correction: "This source does not support the offered price." };
    const draft = { choice: { evidenceRefs: ["fact:1", "fact:2"] }, otherChoice: { evidenceRefs: ["fact:2"] } };
    const c = review(rows), result = assess(c, [], rubric, draft);
    expect(result.critique.evidencePathCorrections).toEqual([{ reportedPath: "choice.evidenceRefs", resolvedPath: "choice.evidenceRefs[1]", quote: "fact:2" }]);
    expect(result.lint.some(issue => issue.rule === "review_scores")).toBe(false);
    expect(result.lint).toContainEqual(expect.objectContaining({ rule: "invented_fact", path: "choice.evidenceRefs[1]" }));
    expect(result.ship).toBe(false);
    expect(c.evidenceAudit?.[0].claims[0].path).toBe("choice.evidenceRefs");
    const duplicate = assess(c, [], rubric, { ...draft, choice: { evidenceRefs: ["fact:2", "fact:2"] } });
    expect(duplicate.critique.evidencePathCorrections).toBeUndefined();
    expect(duplicate.lint.some(issue => issue.rule === "review_scores")).toBe(true);
  });
  it.each([
    ["strategicDirection.assumptions", "strategicDirection.assumptions[0]", { strategicDirection: { assumptions: ["Contacts remain unknown."] } }],
    ["baselineBasis", "experiments[0].baselineBasis", { experiments: [{ baselineBasis: "Contacts remain unknown." }] }],
  ])("resolves a unique exact quotation at shortened path %s and records the original locator", (reportedPath, resolvedPath, draft) => {
    const rows = audit(); rows[0].claims[0] = { ...rows[0].claims[0], path: reportedPath, quote: "Contacts remain unknown." };
    const c = review(rows), result = assess(c, [], rubric, draft);
    expect(result.ship).toBe(true);
    expect(result.critique.evidenceAudit?.[0].claims[0].path).toBe(resolvedPath);
    expect(result.critique).toHaveProperty("evidencePathCorrections", [{ reportedPath, resolvedPath, quote: "Contacts remain unknown." }]);
    expect(c.evidenceAudit?.[0].claims[0].path).toBe(reportedPath);
  });
  it("refuses ambiguous or unrelated path corrections and still blocks an unsupported resolved quote", () => {
    const rows = audit(); rows[0].claims[0] = { ...rows[0].claims[0], path: "baselineBasis", quote: "Contacts remain unknown." };
    const draft = { experiments: [{ baselineBasis: "Contacts remain unknown." }] };
    expect(assess(review(rows), [], rubric, { experiments: [...draft.experiments, ...draft.experiments] }).ship).toBe(false);
    rows[0].claims[0].path = "unrelatedField";
    expect(assess(review(rows), [], rubric, draft).ship).toBe(false);
    rows[0].claims[0] = { ...rows[0].claims[0], path: "baselineBasis", verdict: "unsupported", correction: "Correct this claim using the supplied evidence." };
    const result = assess(review(rows), [], rubric, draft);
    expect(result.ship).toBe(false);
    expect(result.lint).toContainEqual(expect.objectContaining({ rule: "invented_fact", path: "experiments[0].baselineBasis" }));
  });
  it("keeps repair feedback focused on failing criteria rather than optional edits to passing work", () => {
    const c = review(); c.scores[0] = { id: "F1", score: 4, note: "Good", fix: "An optional stylistic change" };
    expect(focusedRevisionCriteria(c, rubric)).toBe("");
    c.scores[0].score = 3;
    expect(focusedRevisionCriteria(c, rubric)).toContain("An optional stylistic change");
  });
  it("allows a rejected creative mechanism to be replaced without forcing replacement for a narrow test defect", () => {
    const creativeRubric = { ...rubric, criteria: [...rubric.criteria, { id: "F7", name: "Originality", anchors: { 1: "missing", 3: "familiar", 5: "distinct" } }] };
    const c = review(); c.scores.push({ id: "F7", score: 3, note: "The bold option repeats a conventional billing trial.", fix: "Change the mechanism, preserve the useful main test." });
    const feedback = focusedRevisionCriteria(c, creativeRubric);
    expect(feedback).toContain("replace that option with a different value exchange");
    expect(feedback).toContain("already distinctive and only its evidence labelling or test is weak");
    expect(feedback).toContain("no precedent, high confidence or immediate feasibility is required");
    expect(feedback).toContain("Keep grounded/adjacent work");
    c.scores.at(-1)!.score = 4;
    expect(focusedRevisionCriteria(c, creativeRubric)).toBe("");
    c.scores.at(-1)!.score = NaN;
    expect(focusedRevisionCriteria(c, creativeRubric)).toBe("");
    c.scores.at(-1)!.score = 3;
    c.scores.push({ ...c.scores.at(-1)! });
    expect(focusedRevisionCriteria(c, creativeRubric)).toBe("");
    expect(focusedRevisionCriteria(review(), { ...creativeRubric, id: "another-rubric" })).toBe("");
  });
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

async function runReview(options: { invalidQuote?: boolean; skipFinalReview?: boolean; criterionOnlyFeedback?: boolean; gateOnlyFeedback?: boolean; twoRepairs?: boolean; denySecondRepair?: boolean } = {}) {
  let calls = 0, reviews = 0;
  const revisionMessages: string[] = [];
  const spec: AgentSpec<typeof output> = {
    id: "growth_strategy", label: "Synthetic focused strategy", role: "cmo", skills: [], schema: z.object({ summary: z.string() }), rubric,
    models: { research: "gpt-6-luna", draft: "gpt-6-luna", critic: "gpt-6-luna" }, effort: { research: "low", draft: "low", critic: "low" },
    maxTokens: { research: 100, draft: 100, critic: 100 }, maxRevisions: options.twoRepairs ? 2 : options.skipFinalReview || options.criterionOnlyFeedback || options.gateOnlyFeedback ? 1 : 0, skipFinalReview: options.skipFinalReview,
  };
  const deps: AgentDeps = {
    turn: async req => {
      calls++;
      const isReview = req.system.some(block => block.text.includes("HARD GATES"));
      if (!isReview && calls > 1) revisionMessages.push(JSON.stringify(req.messages));
      let value: unknown = output;
      if (isReview) {
        reviews++;
        const rows = audit();
        if (options.invalidQuote) rows[0].claims[0].quote = "A sentence not present in this version.";
        value = review(rows);
        if (options.gateOnlyFeedback && reviews === 1) {
          const critique = value as CritiqueResult;
          critique.gates[0] = { id: "G1", pass: false, note: "Synthetic failed gate detail omitted from the short fixes." };
          critique.fixes = ["Optional headline polish unrelated to the failure."];
        }
        if (options.skipFinalReview && reviews === 1) (value as CritiqueResult).scores.forEach(score => { score.score = 3; });
        if (options.twoRepairs) (value as CritiqueResult).scores.forEach(score => { score.score = reviews === 1 ? 3 : reviews === 2 ? 3.5 : 5; });
        if (options.criterionOnlyFeedback && reviews === 1) {
          const critique = value as CritiqueResult;
          critique.scores[0] = { id: "F1", score: 3, note: "The two options use the same exchange.", fix: "Change who receives value and explain the reason they would invite the buyer." };
          critique.fixes = ["Make the next step clear."];
          critique.strengths = ["Keep the worked example and its approval dependency."];
        }
      }
      return { ok: true, output: value, text: JSON.stringify(value), appended: [], usage: { ...ZERO_USAGE, calls: 1 }, costMicros: 0, sources: [], actualModelId: "fixture", stopReason: "end_turn" };
    },
    phase: async (_key, _label, work) => (await work()).value,
    beforeRevision: async round => !(options.denySecondRepair && round === 2),
  };
  const result = await runAgent(spec, { task: "Propose a private test", brief: "Audience availability is unknown.", facts: [] }, deps);
  return { result, calls, reviews, revisionMessages };
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

it("delivers a failed criterion's concrete reasoning and fix even when the top-level fixes omit it", async () => {
  const { revisionMessages, result } = await runReview({ criterionOnlyFeedback: true });
  expect(revisionMessages).toHaveLength(1);
  expect(revisionMessages[0]).toContain("The two options use the same exchange.");
  expect(revisionMessages[0]).toContain("Change who receives value and explain the reason they would invite the buyer.");
  expect(revisionMessages[0]).toContain("Keep the worked example and its approval dependency.");
  expect(result.assessment?.ship).toBe(true);
});

it("delivers failed gate details and separates optional reviewer suggestions from required repairs", async () => {
  const { revisionMessages, result } = await runReview({ gateOnlyFeedback: true });
  expect(revisionMessages).toHaveLength(1);
  const message = revisionMessages[0];
  expect(message).toContain("Synthetic failed gate detail omitted from the short fixes.");
  expect(message).toContain("ADDITIONAL REVIEWER SUGGESTIONS");
  expect(message.indexOf("FAILED GATES")).toBeLessThan(message.indexOf("ADDITIONAL REVIEWER SUGGESTIONS"));
  expect(message).not.toContain("FIX (most important first)");
  expect(result.assessment?.ship).toBe(true);
});

it("freshly reviews each bounded repair and respects refusal of the second reservation", async () => {
  const complete = await runReview({ twoRepairs: true });
  expect(complete.calls).toBe(6); expect(complete.reviews).toBe(3);
  expect(complete.result.assessment?.ship).toBe(true);
  const capped = await runReview({ twoRepairs: true, denySecondRepair: true });
  expect(capped.calls).toBe(4); expect(capped.reviews).toBe(2);
  expect(capped.result.assessment?.average).toBe(3.5);
  expect(capped.result.assessment?.ship).toBe(false);
});
