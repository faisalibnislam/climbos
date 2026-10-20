import { describe, expect, it } from "vitest";
import { lintExperimentFeasibility } from "../../shared/agents/specs";

/** Slice 3 (BK06 Ch 2–3, 10–11; BK04 test requirements): tests in plans must be able to finish and be read once. */
const exp = (o: Partial<{ name: string; method: string; population: string; durationDays: number; stoppingRule: string }>) => ({ name: "Test", method: "ab_split", population: "", durationDays: 14, stoppingRule: "Read once on day 14", ...o });

describe("experiment feasibility", () => {
  it("requires an eligible count for split and holdout tests", () => {
    expect(lintExperimentFeasibility({ experiments: [exp({ population: "New visitors to the pricing page" })] })).toMatchObject([{ rule: "experiment_feasibility", path: "experiments[0].population" }]);
  });
  it("fails a test the traffic can't finish (EV28: 50 a month, 7 days)", () => {
    const issues = lintExperimentFeasibility({ experiments: [exp({ population: "About 50 qualified visitors a month", durationDays: 7 })] });
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toMatch(/before\/after labelled observational/);
  });
  it("passes a test with enough eligible people, per week or in total", () => {
    expect(lintExperimentFeasibility({ experiments: [exp({ population: "About 1,000 visitors a week", durationDays: 14 })] })).toEqual([]);
    expect(lintExperimentFeasibility({ experiments: [exp({ method: "holdout", population: "2,000 existing customers", durationDays: 30 })] })).toEqual([]);
  });
  it("leaves before/after and interview methods to their own labels", () => {
    expect(lintExperimentFeasibility({ experiments: [exp({ method: "pre_post_observational", population: "Everyone who books" })] })).toEqual([]);
  });
  it("blocks stopping a test when it looks significant (peeking)", () => {
    expect(lintExperimentFeasibility({ experiments: [exp({ method: "pre_post_observational", stoppingRule: "Stop as soon as the lift is significant" })] })).toMatchObject([{ rule: "experiment_feasibility", path: "experiments[0].stoppingRule" }]);
  });
});
