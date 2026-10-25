import { describe, expect, it } from "vitest";
import { RetentionPlanSchema } from "../../shared/ai/tasks";
import { retentionSpec } from "../../shared/agents/specs";
import type { AgentInput } from "../../shared/agents/types";

const facts = [
  "Owner confirms the Team plan is an existing upgrade for accounts with multiple editors.",
  "Measured product usage shows accounts add a second editor before asking about team access.",
  "Measured usage trigger: after an account adds a second editor, show the Team plan option.",
];

const input: AgentInput = { task: "Retention and expansion", brief: "Owner facts supplied.", facts };

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
