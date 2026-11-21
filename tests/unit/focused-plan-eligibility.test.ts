import { describe, expect, it } from "vitest";
import { assess } from "../../shared/agents/runtime";
import type { AgentInput, CritiqueResult, Rubric } from "../../shared/agents/types";

type PlanCheck = NonNullable<CritiqueResult["evidenceAudit"]>[number]["planChecks"][number];

// Narrow excerpts from the saved 2026-11-18 Livoform acceptance evidence, not a live product test.
const url = "https://livoform.com/help/ai-credits";
const aiQuote = "Core has no Livoform AI allowance or use for credits.";
const briefQuote = "Pro/Business can build forms from a brief, uploaded document or existing form.";
const input: AgentInput = { task: "Check a proposed workflow", brief: "Account access and founder time are unknown", facts: [],
  precomputedResearch: { notes: `${url}\n${aiQuote}\n${briefQuote}`, sources: [{ url }], pageReads: [{ url, text: `${aiQuote}\n${briefQuote}`, retrievedAt: Date.parse("2026-11-17T00:00:00Z") }], retrievedAt: Date.parse("2026-11-18T00:00:00Z") } };
const rubric: Rubric = { id: "focused-growth-strategy", title: "Eligibility regression", gates: [{ id: "G1", text: "Truth" }], criteria: [{ id: "F2", name: "Economics", anchors: { 1: "Weak", 3: "Partial", 5: "Ready" } }], shipRule: { minEach: 4, minAverage: 4 } };
const output = { task: "If Core or Pro access exists, check AI drafting from a brief." };
const check = (): PlanCheck => ({ path: "task", quote: output.task, claimedPlans: ["Core", "Pro"], availabilityClaim: "asserted_available",
  requirements: [{ capabilityQuote: "AI drafting from a brief", eligiblePlans: ["Pro", "Business"], excludedPlans: ["Core"], basis: "source_reported", evidenceRef: url, sourceQuote: `${aiQuote}\n${briefQuote}` }] });
function review(planCheck?: PlanCheck): CritiqueResult {
  return { gates: [{ id: "G1", pass: true, note: "Synthetic passing review" }], scores: ["F2", "XV"].map(id => ({ id, score: 5, note: "Synthetic", fix: "none" })), strengths: [], fixes: [],
    evidenceAudit: (["business_state", "comparative_claims", "capabilities_and_results"] as const).map(category => ({ category, basis: "Local review annotation, not independently verified entitlement.", claims: [], measurementChecks: [], planChecks: category === "capabilities_and_results" && planCheck !== undefined ? [planCheck] : [] })) };
}

describe("source-bound product-plan reasoning", () => {
  it("blocks the saved Core-or-Pro brief-drafting mistake despite passing review scores", () => {
    const result = assess(review(check()), [], rubric, output, input);
    expect(result.ship).toBe(false);
    expect(result.lint).toContainEqual(expect.objectContaining({ rule: "invented_fact", path: "task", message: expect.stringContaining("Core") }));
  });
  it("rejects an actual quote attributed to a different listed page, or only to an AI summary", () => {
    const draft = { task: "If Pro access exists, check AI drafting from a brief." };
    const other = "https://example.com/plans";
    const row = { ...check(), quote: draft.task, claimedPlans: ["Pro"] };
    const research = { ...input.precomputedResearch!, sources: [{ url }, { url: other }] };
    row.requirements[0].evidenceRef = other;
    expect(assess(review(row), [], rubric, draft, { ...input, precomputedResearch: research }).ship).toBe(false);
    row.requirements[0].evidenceRef = url;
    expect(assess(review(row), [], rubric, draft, { ...input, precomputedResearch: { ...research, pageReads: [] } }).ship).toBe(false);
  });
  it("allows the source-supported Pro branch without asserting account access or tested behavior", () => {
    const draft = { task: "If Pro access exists, check AI drafting from a brief." }, row = { ...check(), quote: draft.task, claimedPlans: ["Pro"] };
    expect(assess(review(row), [], rubric, draft, input).ship).toBe(true);
  });
  it("does not inherit features upward or satisfy a bundle from different plans", () => {
    const draft = { task: "If Core or Pro access exists, check AI drafting from a brief and export a legacy pack." };
    const row: PlanCheck = { ...check(), quote: draft.task };
    const ownerQuote = "Synthetic case only: exporting a legacy pack is supported on Core and excluded on Pro.";
    row.requirements.push({ capabilityQuote: "export a legacy pack", eligiblePlans: ["Core"], excludedPlans: ["Pro"], basis: "owner_reported", evidenceRef: "fact:0", sourceQuote: ownerQuote });
    const context: AgentInput = { ...input, facts: [ownerQuote], constraints: { factEvidenceBases: ["owner_reported"] } };
    expect(assess(review(row), [], rubric, draft, context).lint.filter(issue => issue.rule === "invented_fact")).toHaveLength(2);
  });
  it.each(["missing_context", "invented_quote", "unretrieved_url", "wrong_plan", "wrong_capability"])("rejects an unbound eligibility annotation: %s", mode => {
    const row: PlanCheck = check();
    if (mode === "invented_quote") row.requirements[0].sourceQuote = "An invented product eligibility statement.";
    if (mode === "unretrieved_url") row.requirements[0].evidenceRef = "https://unread.example/plans";
    if (mode === "wrong_plan") row.claimedPlans = ["Enterprise"];
    if (mode === "wrong_capability") row.requirements[0].capabilityQuote = "An unrelated feature";
    expect(assess(review(row), [], rubric, output, mode === "missing_context" ? undefined : input).lint).toContainEqual(expect.objectContaining({ rule: "review_scores" }));
  });
  it.each(["asserted_available", "conditional_unknown"] as const)("keeps unknown plan eligibility distinct: %s", availabilityClaim => {
    const draft = availabilityClaim === "conditional_unknown" ? { task: "Eligibility for Core or Pro is unknown: verify AI drafting from a brief before attempting it." } : output;
    const row: PlanCheck = { ...check(), quote: draft.task, availabilityClaim, requirements: [{ capabilityQuote: "AI drafting from a brief", eligiblePlans: null, excludedPlans: [], basis: "unknown", evidenceRef: null, sourceQuote: null }] };
    expect(assess(review(row), [], rubric, draft, input).ship).toBe(availabilityClaim === "conditional_unknown");
  });
  it("does not infer an exclusion from an incomplete positive list", () => {
    const draft = { task: "Eligibility for Core or Pro is not fully known: verify AI drafting from a brief before attempting it." };
    const row: PlanCheck = { ...check(), quote: draft.task, availabilityClaim: "conditional_unknown" };
    row.requirements[0].excludedPlans = [];
    row.requirements[0].sourceQuote = briefQuote;
    expect(assess(review(row), [], rubric, draft, input).ship).toBe(true);
    row.availabilityClaim = "asserted_available";
    expect(assess(review(row), [], rubric, draft, input).ship).toBe(false);
  });
  it("cannot waive an explicit exclusion using a general verification caveat", () => {
    expect(assess(review({ ...check(), availabilityClaim: "conditional_unknown" }), [], rubric, output, input).ship).toBe(false);
  });
  it("keeps owner reports distinct from source reports and binds them to the referenced fact", () => {
    const fact = "Owner reports Pro supports AI drafting from a brief.";
    const context: AgentInput = { ...input, facts: [fact, "A different fact."], constraints: { factEvidenceBases: ["owner_reported", "owner_reported"] } };
    const draft = { task: "If Pro access exists, check AI drafting from a brief." };
    const row: PlanCheck = { ...check(), quote: draft.task, claimedPlans: ["Pro"] };
    Object.assign(row.requirements[0], { basis: "owner_reported", evidenceRef: "fact:0", sourceQuote: fact, excludedPlans: [] });
    expect(assess(review(row), [], rubric, draft, context).ship).toBe(true);
    row.requirements[0].basis = "source_reported";
    expect(assess(review(row), [], rubric, draft, context).ship).toBe(false);
    row.requirements[0].basis = "owner_reported"; row.requirements[0].evidenceRef = "fact:1";
    expect(assess(review(row), [], rubric, draft, context).ship).toBe(false);
  });
  it("rejects conflicting eligibility sets and leaves speculative future capabilities ungated", () => {
    const row: PlanCheck = check(); row.requirements[0].eligiblePlans!.push("Core");
    expect(assess(review(row), [], rubric, output, input).lint).toContainEqual(expect.objectContaining({ rule: "review_scores" }));
    expect(assess(review(), [], rubric, { proposal: "Hypothetical, unbuilt: explore a new client-controlled exchange without assuming plan support." }, input).ship).toBe(true);
  });
  it("requires an explicit applicability inventory for new reviews", () => {
    const old = review();
    for (const row of old.evidenceAudit!) delete (row as { planChecks?: unknown }).planChecks;
    expect(assess(old, [], rubric, output, input).ship).toBe(false);
  });
});
