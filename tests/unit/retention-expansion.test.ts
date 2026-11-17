import { describe, expect, it } from "vitest";
import { RetentionPlanSchema } from "../../shared/ai/tasks";
import { retentionSpec } from "../../shared/agents/specs";
import type { AgentInput } from "../../shared/agents/types";

const facts = [
  "Owner confirms the Team plan is an existing upgrade for accounts with multiple editors.",
  "Measured product usage shows accounts add a second editor before asking about team access.",
  "Measured usage trigger: after an account adds a second editor, show the Team plan option.",
];

const input: AgentInput = { task: "Retention and expansion", brief: "Owner facts supplied.", facts, constraints: { factEvidenceBases: ["owner_reported", "measured", "measured"] } };

function output(overrides: Record<string, unknown> = {}) {
  return RetentionPlanSchema.parse({
    segments: [],
    plays: [{
      type: "upsell",
      name: "Explain the Team plan at the relevant usage moment",
      trigger: "After an account adds a second editor",
      message: "Show the verified Team plan details and let the owner review the message before use.",
      channel: "in-app",
      expansionAssessment: {
        decision: "recommend",
        offering: "Team plan",
        customerNeed: "Team access for accounts adding editors",
        customerValueSignal: "Accounts add a second editor before asking about team access",
        offerEvidenceBasis: "owner_reported",
        offerEvidenceRef: "fact:0",
        offerEvidenceClaim: facts[0],
        valueEvidenceBasis: "measured",
        valueEvidenceRef: "fact:1",
        valueEvidenceClaim: facts[1],
        timingEvidenceBasis: "measured",
        timingEvidenceRef: "fact:2",
        timingEvidenceClaim: facts[2],
        primaryOutcome: "Paid Team plan expansion among eligible accounts",
        comparison: "Compare eligible accounts exposed to the prompt with the pre-test baseline or a concurrent holdout.",
        observationWindowDays: 30,
        continueRule: "Continue if the owner-defined paid expansion threshold is met without worse support burden.",
        stopRule: "Stop if customers report confusion or support burden materially increases.",
        ownerInputs: ["Set the minimum contribution threshold from verified plan economics."],
        unknowns: [],
      },
    }],
    ...overrides,
  });
}

describe("retention expansion recommendations", () => {
  it("accepts an evidence-backed upgrade with a customer-value signal and behavior timing", () => {
    expect(retentionSpec().lint?.(output(), input)).toEqual([]);
  });

  it("rejects an expansion based only on inference or invented offer evidence", () => {
    const invalid = output({ plays: [{
      ...output().plays[0],
      expansionAssessment: {
        ...output().plays[0].expansionAssessment,
        offerEvidenceBasis: "inferred",
        offerEvidenceRef: null,
        offerEvidenceClaim: "",
        valueEvidenceBasis: "assumed",
        valueEvidenceRef: null,
        valueEvidenceClaim: "",
        timingEvidenceRef: null,
        timingEvidenceClaim: "",
      },
    }] });
    expect(retentionSpec().lint?.(invalid, input)?.some((issue) => issue.rule === "retention_expansion" && issue.severity === "error")).toBe(true);
  });

  it("requires an owner input or explicit unknowns when the right offer cannot be established", () => {
    const ungrounded = output({ plays: [{
      ...output().plays[0],
      expansionAssessment: {
        ...output().plays[0].expansionAssessment,
        decision: "validate_first",
        offering: null,
        ownerInputs: [],
        unknowns: [],
      },
    }] });
    expect(retentionSpec().lint?.(ungrounded, input)?.some((issue) => /missing owner input or unknown/u.test(issue.message))).toBe(true);
  });
});

it("does not promote an owner report about analytics into measured expansion evidence", () => {
  const ownerInput: AgentInput = { ...input, constraints: { factEvidenceBases: ["owner_reported", "owner_reported", "owner_reported"] } };
  expect(retentionSpec().lint?.(output(), ownerInput)?.some(issue => issue.rule === "evidence_basis")).toBe(true);
});
it("keeps absent provenance unknown even when the fact says measured", () => {
  expect(retentionSpec().lint?.(output(), { ...input, constraints: undefined })?.some(issue => issue.rule === "evidence_basis")).toBe(true);
});
it("accepts an unknown observation window with a targeted owner input", () => {
  const candidate = output();
  const raw = { ...candidate, plays: [{ ...candidate.plays[0], expansionAssessment: { ...candidate.plays[0].expansionAssessment, observationWindowDays: null, ownerInputs: ["Confirm the observation window for this customer buying cycle."] } }] };
  const parsed = RetentionPlanSchema.safeParse(raw);
  expect(parsed.success).toBe(true);
  if (parsed.success) expect(retentionSpec().lint?.(parsed.data, input)).toEqual([]);
});
it("requires useful outcomes and decision rules for retention as well as expansion", () => {
  const candidate = output();
  candidate.plays[0].type = "retention";
  candidate.plays[0].expansionAssessment.decision = "no_expansion";
  candidate.plays[0].expansionAssessment.primaryOutcome = "";
  candidate.plays[0].expansionAssessment.stopRule = "";
  expect(retentionSpec().lint?.(candidate, input)?.some(issue => issue.rule === "retention_expansion")).toBe(true);
});
it("keeps published claims source-reported rather than measured", () => {
  const url = "https://example.com/team";
  const sourceInput: AgentInput = { ...input, availableSourceUrls: [url], precomputedResearch: { notes: facts.join("\n"), sources: [{ url }] } };
  const candidate = output(), assessment = candidate.plays[0].expansionAssessment;
  assessment.valueEvidenceRef = url;
  expect(retentionSpec().lint?.(candidate, sourceInput)?.some(issue => issue.rule === "evidence_basis")).toBe(true);
  assessment.valueEvidenceBasis = "source_reported";
  expect(retentionSpec().lint?.(candidate, sourceInput)).toEqual([]);
});
it("validates reported evidence on retention plays as well as upsells", () => {
  const candidate = output(); candidate.plays[0].type = "retention";
  const assessment = candidate.plays[0].expansionAssessment;
  assessment.decision = "no_expansion"; assessment.timingEvidenceClaim = "This customer has already finished setup.";
  expect(retentionSpec().lint?.(candidate, input)?.some(issue => issue.rule === "retention_expansion" && issue.path?.endsWith("timingEvidenceClaim"))).toBe(true);
});
it("allows explicit hypotheses that ask for validation without pretending they are measurements", () => {
  const candidate = output(); const assessment = candidate.plays[0].expansionAssessment;
  assessment.decision = "validate_first"; assessment.offering = null;
  assessment.offerEvidenceBasis = "unknown"; assessment.offerEvidenceRef = null; assessment.offerEvidenceClaim = "";
  assessment.valueEvidenceBasis = "inferred"; assessment.valueEvidenceRef = null; assessment.valueEvidenceClaim = "";
  assessment.timingEvidenceBasis = "assumed"; assessment.timingEvidenceRef = null; assessment.timingEvidenceClaim = "";
  assessment.observationWindowDays = null; assessment.ownerInputs = ["Confirm the available offering, customer need, and observation window."];
  expect(retentionSpec().lint?.(candidate, { ...input, constraints: undefined })).toEqual([]);
});
