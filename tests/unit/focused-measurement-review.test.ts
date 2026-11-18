import { describe, expect, it } from "vitest";
import { assess } from "../../shared/agents/runtime";
import type { CritiqueResult, Rubric } from "../../shared/agents/types";
import type { FocusedMeasurementCheck } from "../../shared/agents/focusedMeasurement";

// Verbatim metric from the saved Livoform docs-v2 evaluation (2026-11-18).
// The annotations below are local review fixtures, not a new model evaluation.
const metric = "Providers who complete a test-mode paid submission on the hosted sample and name a real client enquiry they would send it to (activation)";
const draft = { experiments: [{ primaryMetric: metric }], brief: "The provider tries our hosted sample as a respondent; their own product workflow remains untested." };
const rubric: Rubric = { id: "focused-growth-strategy", title: "Measurement scope", gates: [{ id: "G1", text: "Truth" }], criteria: [{ id: "F5", name: "Learning", anchors: { 1: "Weak", 3: "Partial", 5: "Ready" } }], shipRule: { minEach: 4, minAverage: 4 } };
const check = (): FocusedMeasurementCheck => ({ claimPath: "experiments[0].primaryMetric", claimQuote: metric, observationPath: "brief", observationQuote: draft.brief,
  activity: "simulation_or_walkthrough", claimedOutcome: "product_use", actorMatchesTarget: false, basis: "The buyer acts as a respondent on the owner's sample, not in their own customer workflow." });
function review(row = check()): CritiqueResult {
  return { gates: [{ id: "G1", pass: true, note: "Synthetic" }], scores: ["F5", "XV"].map(id => ({ id, score: 5, note: "Synthetic", fix: "none" })), strengths: [], fixes: [],
    evidenceAudit: (["business_state", "comparative_claims", "capabilities_and_results"] as const).map(category => ({ category, basis: "Synthetic applicability judgment", planChecks: [], claims: [], measurementChecks: category === "capabilities_and_results" ? [row] : [] })) };
}

const activities = {
  simulation_or_walkthrough: "The buyer walks through the owner's fictional sample in test mode.",
  stated_preference: "The buyer says they would use this again.",
  checkout_started: "The buyer opens checkout without a confirmed charge.",
  customer_job_completed: "If access is available and use approved, observe the person completing their own customer job; otherwise leave use untested.",
  confirmed_payment: "If a completed payment is confirmed, record it separately with its payer, recipient and source.",
  repeated_customer_job: "If observed, record the same customer's completion of a second actual job separately.",
  unknown: "The activity to observe is not yet established.",
} as const;
function assessment(activity: FocusedMeasurementCheck["activity"], claimedOutcome: FocusedMeasurementCheck["claimedOutcome"], actorMatchesTarget: boolean | null = true) {
  const output = { claim: `Count the proposed observation as ${claimedOutcome}.`, observation: activities[activity] };
  const row = { ...check(), claimPath: "claim", claimQuote: output.claim, observationPath: "observation", observationQuote: output.observation, activity, claimedOutcome, actorMatchesTarget,
    basis: "Synthetic event and actor classification for this definition only; no test has run." };
  return assess(review(row), [], rubric, output);
}

describe("focused measurement scope", () => {
  it("blocks the saved sample-walkthrough activation mistake even with passing scores", () => {
    const result = assess(review(), [], rubric, draft);
    expect(result.ship).toBe(false);
    expect(result.lint).toContainEqual(expect.objectContaining({ rule: "focused_learning", path: "experiments[0].primaryMetric" }));
  });
  it("allows the same demonstration as comprehension or job-fit learning", () => {
    expect(assessment("simulation_or_walkthrough", "comprehension_or_job_fit", false).ship).toBe(true);
  });
  it.each(["stated_preference", "checkout_started", "simulation_or_walkthrough"] as const)("does not turn %s into payment", activity => {
    expect(assessment(activity, "payment").ship).toBe(false);
  });
  it.each([false, null])("does not attribute actual use to an unverified target actor: %s", actorMatchesTarget => {
    expect(assessment("customer_job_completed", "product_use", actorMatchesTarget).ship).toBe(false);
  });
  it("allows a conditional proposed customer-job observation without requiring free access or a purchase", () => {
    expect(assessment("customer_job_completed", "product_use").ship).toBe(true);
  });
  it("requires repeat behavior rather than a promise to return", () => {
    expect(assessment("stated_preference", "repeat_use").ship).toBe(false);
    expect(assessment("repeated_customer_job", "repeat_use").ship).toBe(true);
  });
  it.each(["claimQuote", "observationQuote", "claimPath", "observationPath"])("rejects an assessment bound to another draft's %s", key => {
    const result = assess(review({ ...check(), [key]: "not in this draft" }), [], rubric, draft);
    expect(result.lint).toContainEqual(expect.objectContaining({ rule: "review_scores" }));
  });
  it("keeps unknown activity from supporting a known outcome", () => {
    expect(assessment("unknown", "product_use").ship).toBe(false);
    expect(assessment("unknown", "unknown", null).ship).toBe(true);
  });
  it("keeps a successful payment and successful use independent", () => {
    expect(assessment("confirmed_payment", "payment", null).ship).toBe(true);
    expect(assessment("confirmed_payment", "product_use").ship).toBe(false);
    expect(assessment("customer_job_completed", "payment").ship).toBe(false);
  });
  it("requires new reviews to declare their measurement applicability", () => {
    const old = review();
    for (const row of old.evidenceAudit!) delete (row as { measurementChecks?: unknown }).measurementChecks;
    expect(assess(old, [], rubric, draft).ship).toBe(false);
    expect(assess(old, [], { ...rubric, id: "other-specialist" }, draft).ship).toBe(true);
  });
});
