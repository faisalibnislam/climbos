import { describe, expect, it } from "vitest";
import { assessDesignLearning } from "../../shared/growth/designLearning";
import type { OutcomeInput } from "../../shared/growth/experimentOutcome";

const outcome: OutcomeInput & { redefined: boolean } = { executed: true, source: "owner_report", design: "before_after", exposed: 100, conversions: 8, metric: "Qualified inquiries", successRule: "Maintain qualified inquiries without increasing support time", result: "met", stopRuleHit: false, windowStart: "2026-10-02", windowEnd: "2026-10-15", redefined: false };
const input = { outcome, publicationConfirmed: true, publicationApprovedAt: Date.UTC(2026, 9, 1), measurementBound: true, baselineRecorded: true, method: "pre_post_observational", deviations: 0, now: Date.UTC(2026, 9, 20) };

describe("design result evidence for later advice", () => {
  it.each(["met", "missed"] as const)("keeps %s before/after results as observations, not causal winners", result => {
    const assessment = assessDesignLearning({ ...input, outcome: { ...outcome, result } });
    expect(assessment.state).toBe("observed");
    expect(assessment.summary).toContain("not proof");
    expect(assessment.limits.join(" ")).toContain("not been independently verified");
    expect(assessment.limits.join(" ")).toContain("audience mix");
  });

  it("distinguishes absent, unclear and not-run outcomes without treating them as failure", () => {
    expect(assessDesignLearning({ ...input, outcome: undefined }).state).toBe("no_outcome");
    expect(assessDesignLearning({ ...input, outcome: { ...outcome, result: "unclear" } }).state).toBe("inconclusive");
    expect(assessDesignLearning({ ...input, publicationConfirmed: false, outcome: { ...outcome, executed: false } }).state).toBe("not_run");
  });

  it("requires exact-version publication and measurement evidence", () => {
    expect(assessDesignLearning({ ...input, publicationConfirmed: false }).state).toBe("needs_evidence");
    expect(assessDesignLearning({ ...input, measurementBound: false }).state).toBe("needs_evidence");
    expect(assessDesignLearning({ ...input, publicationApprovedAt: Date.UTC(2026, 9, 16) }).state).toBe("needs_evidence");
    expect(assessDesignLearning({ ...input, publicationApprovedAt: undefined }).limits.join(" ")).toContain("historical publication time is unrecorded");
  });

  it("keeps missing counts, missing baseline, changed definitions and deviations inconclusive", () => {
    expect(assessDesignLearning({ ...input, outcome: { ...outcome, exposed: undefined } }).state).toBe("inconclusive");
    expect(assessDesignLearning({ ...input, baselineRecorded: false }).state).toBe("inconclusive");
    expect(assessDesignLearning({ ...input, outcome: { ...outcome, redefined: true } }).state).toBe("inconclusive");
    expect(assessDesignLearning({ ...input, outcome: { ...outcome, stopRuleHit: true } }).state).toBe("inconclusive");
    expect(assessDesignLearning({ ...input, deviations: 1 }).state).toBe("inconclusive");
  });

  it("rejects missing, impossible, reversed and future observation dates", () => {
    for (const patch of [{ windowStart: undefined }, { windowStart: "2026-02-30" }, { windowStart: "2026-10-16" }, { windowEnd: "2026-10-21" }]) {
      expect(assessDesignLearning({ ...input, outcome: { ...outcome, ...patch } }).state).toBe("needs_evidence");
    }
  });

  it("uses existing comparison checks and refuses to reinterpret monetary or unplanned tests as conversion rates", () => {
    const compared = { ...input, method: "ab_split", metricType: "binary_rate", preregisteredAt: Date.UTC(2026, 8, 30), outcome: { ...outcome, design: "randomized" as const, assignment: "random" as const, exposed: 1000, conversions: 200, controlSize: 1000, controlConversions: 100, plannedSharePct: 50 } };
    expect(assessDesignLearning(compared).state).toBe("compared");
    expect(assessDesignLearning({ ...compared, outcome: { ...compared.outcome, assignment: undefined } }).state).toBe("inconclusive");
    expect(assessDesignLearning({ ...compared, outcome: { ...compared.outcome, exposed: 2000 } }).state).toBe("inconclusive");
    expect(assessDesignLearning({ ...compared, outcome: { ...compared.outcome, conversions: 101 } }).state).toBe("inconclusive");
    expect(assessDesignLearning({ ...compared, metricType: "monetary" }).state).toBe("inconclusive");
    expect(assessDesignLearning({ ...compared, preregisteredAt: undefined }).state).toBe("inconclusive");
    expect(assessDesignLearning({ ...compared, method: "pre_post_observational" }).state).toBe("inconclusive");
  });
});
