import { describe, expect, it } from "vitest";
import { inferenceOf, isRedefined, lift, outcomeLine, outcomeProblems, type OutcomeInput } from "../../shared/growth/experimentOutcome";

const base: OutcomeInput = { executed: true, source: "owner_report", design: "none", metric: "booked calls", successRule: "stop if < 2 calls in 14 days", result: "met", stopRuleHit: false };

describe("experiment inference label (Book 14 §14)", () => {
  it("is observed when there is no comparison group", () => {
    expect(inferenceOf({ ...base, exposed: 200 })).toBe("observed");
    expect(inferenceOf({ ...base, design: "before_after", exposed: 200, controlSize: 200 })).toBe("observed");
  });
  it("is incremental only for holdout or randomized with both groups present", () => {
    expect(inferenceOf({ ...base, design: "holdout", exposed: 200, controlSize: 50, assignment: "random" })).toBe("incremental");
    // Decision books: a holdout picked by a rule or by hand isn't exchangeable, so it isn't incremental (Hernán & Robins Ch 3).
    expect(inferenceOf({ ...base, design: "holdout", exposed: 200, controlSize: 50, assignment: "rule" })).toBe("observed");
    expect(inferenceOf({ ...base, design: "holdout", exposed: 200, controlSize: 50 })).toBe("observed");
    expect(inferenceOf({ ...base, design: "randomized", exposed: 100, controlSize: 100 })).toBe("incremental");
    expect(inferenceOf({ ...base, design: "holdout", exposed: 200 })).toBe("observed");
    expect(inferenceOf({ ...base, design: "randomized", exposed: 0, controlSize: 100 })).toBe("observed");
    expect(inferenceOf({ ...base, design: "holdout", exposed: 200, controlSize: 0 })).toBe("observed");
  });
  it("is attributed for a platform report, whatever the design", () => {
    expect(inferenceOf({ ...base, source: "platform_report" })).toBe("attributed");
    expect(inferenceOf({ ...base, source: "platform_report", design: "randomized", exposed: 100, controlSize: 100 })).toBe("attributed");
  });
  it("is not_run when the test wasn't carried out", () => {
    expect(inferenceOf({ ...base, executed: false, design: "randomized", exposed: 100, controlSize: 100 })).toBe("not_run");
  });
});

describe("outcome checks and wording", () => {
  it("rejects impossible counts and future windows", () => {
    expect(outcomeProblems({ ...base, eligible: 100, exposed: 80, controlSize: 40 }, "2026-10-20")).toContain("Exposed plus comparison can't be more than eligible.");
    expect(outcomeProblems({ ...base, exposed: 10, conversions: 11 }, "2026-10-20")).toContain("Conversions can't be more than exposed.");
    expect(outcomeProblems({ ...base, design: "holdout", exposed: 10 }, "2026-10-20")).toContain("Give the comparison group size.");
    expect(outcomeProblems({ ...base, windowStart: "2026-10-01", windowEnd: "2026-11-01" }, "2026-10-20")).toContain("The window can't end in the future.");
    expect(outcomeProblems({ ...base, exposed: 2.5 }, "2026-10-20")).toContain("Counts must be whole numbers, zero or more.");
    expect(outcomeProblems({ ...base, eligible: 100, exposed: 50, conversions: 5 }, "2026-10-20")).toEqual([]);
  });
  it("flags a changed definition", () => {
    expect(isRedefined(base, { primaryMetric: "booked calls", stoppingRule: "stop if < 2 calls in 14 days" })).toBe(false);
    expect(isRedefined({ ...base, metric: "replies" }, { primaryMetric: "booked calls", stoppingRule: "stop if < 2 calls in 14 days" })).toBe(true);
  });
  it("computes lift in code", () => {
    expect(lift({ exposed: 200, conversions: 20, controlSize: 100, controlConversions: 5 })).toEqual({ exposedRate: 0.1, controlRate: 0.05, extra: 10 });
  });
  it("never says incremental without a comparison group", () => {
    const obs = outcomeLine("Referral ask", { ...base, exposed: 200, conversions: 12, inference: "observed", redefined: false });
    expect(obs).toContain("OBSERVED");
    expect(obs).toContain("not proof of cause");
    expect(obs).not.toMatch(/incremental/i);
    const att = outcomeLine("Meta ads", { ...base, source: "platform_report", conversions: 30, inference: "attributed", redefined: false });
    expect(att).toContain("ATTRIBUTED");
    expect(att).not.toMatch(/incremental/i);
    const inc = outcomeLine("Holdout email", { ...base, design: "holdout", assignment: "random", exposed: 200, conversions: 20, controlSize: 100, controlConversions: 5, inference: "incremental", redefined: false });
    // 20/200 vs 5/100 isn't significant (Fisher p ≈ 0.18): no "incremental conversions" claim (blog research BRP-21).
    expect(inc).toContain("COMPARED (holdout)");
    expect(inc).toContain("No reliable difference");
    expect(inc).not.toMatch(/incremental conversions/);
    const sig = outcomeLine("Holdout email", { ...base, design: "holdout", assignment: "random", exposed: 300, conversions: 60, controlSize: 300, controlConversions: 15, plannedSharePct: 50, inference: "incremental", redefined: false });
    const byHand = outcomeLine("Holdout email", { ...base, design: "holdout", assignment: "owner_choice", exposed: 300, conversions: 60, controlSize: 300, controlConversions: 15, inference: "observed", redefined: false });
    expect(byHand).toContain("COMPARED, NOT RANDOMIZED (holdout chosen by hand)");
    expect(byHand).not.toMatch(/incremental/i);
    expect(sig).toContain("INCREMENTAL (holdout)");
    expect(sig).toMatch(/about 45 incremental conversions, likely \d+–\d+ \(p < 0\.001\)/);
    // A split far from its plan can't be read at all.
    const bad = outcomeLine("Holdout email", { ...base, design: "randomized", exposed: 300, conversions: 60, controlSize: 100, controlConversions: 5, plannedSharePct: 50, inference: "incremental", redefined: false });
    expect(bad).toContain("doesn't match the plan");
    expect(bad).not.toMatch(/incremental conversions/);
    expect(outcomeLine("Cold email", { ...base, executed: false, inference: "not_run", redefined: false })).toContain("NOT RUN");
  });
  it("marks a changed definition as exploratory and keeps the original result", () => {
    const l = outcomeLine("Referral ask", { ...base, metric: "replies", result: "met", exposed: 50, conversions: 9, inference: "observed", redefined: true }, "missed");
    expect(l).toContain("exploratory only");
    expect(l).toContain("On the original definition it missed its success rule");
  });
});
