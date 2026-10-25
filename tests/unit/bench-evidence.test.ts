import { describe, expect, it } from "vitest";
import { evaluationEvidence } from "../../bench/evidence";

describe("benchmark evidence reporting", () => {
  it("keeps an empty run explicit instead of implying a quality or outcome result", () => {
    const report = evaluationEvidence([], ["basic"], ["sol"], true, false).join("\n");
    expect(report).toContain("No strategy hard-check results in this run");
    expect(report).toContain("Not measured by this benchmark");
    expect(report).toContain("does not exercise ad, social, email or CMS publishing integrations");
  });

  it("reports hard checks, judge signals and owner review separately", () => {
    const report = evaluationEvidence([{
      outs: { basic: { ok: true }, old: { ok: false } },
      comparisons: { "basic>old": { sol: { result: "win" } } },
      scores: { basic: { overall: 8 }, old: null },
      hard: { basic: { findings: [] }, old: { findings: [{ rule: "budget" }] } },
    }], ["basic", "old"], ["sol"], true, true).join("\n");
    expect(report).toContain("2 strategy outputs re-linted; 1 had at least one counted hard finding");
    expect(report).toContain("2 arm outputs recorded (1 completed, 1 failed)");
    expect(report).toContain("1 pairwise judgments from sol; 1 pointwise scores");
    expect(report).toContain("blind owner-review packet was generated, but no owner scores are recorded");
    expect(report).toContain("Automated judges are quality signals");
  });
});
