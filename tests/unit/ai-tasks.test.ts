import { describe, expect, it } from "vitest";
import { findRiskyClaims, stripFactMarkers } from "../../shared/ai/tasks";

describe("fact marker cleanup", () => {
  it("removes [n] markers from prose but keeps other brackets and numbers", () => {
    const out = stripFactMarkers({
      evidence: "Plausible uses no cookies [2]. Pricing starts at $9 per month [5], we think [0][3].",
      list: ["EU hosted [1, 4]", "Plan [Pro] costs $19"],
      n: 3,
      factIndexes: [2, 5],
    });
    expect(out.evidence).toBe("Plausible uses no cookies. Pricing starts at $9 per month, we think.");
    expect(out.list).toEqual(["EU hosted", "Plan [Pro] costs $19"]);
    expect(out.n).toBe(3);
    expect(out.factIndexes).toEqual([2, 5]);
  });
});

describe("risky marketing claim screen", () => {
  it.each([
    ["2x faster results", /2x faster/i],
    ["30% fewer errors", /30% fewer/i],
    ["Reduce costs by 40% this quarter", /Reduce costs by 40%/i],
    ["100% secure for every team", /100% secure/i],
    ["Guaranteed customer growth", /Guaranteed/i],
  ])("flags %s for owner review", (copy, expected) => {
    expect(findRiskyClaims(copy)).toEqual(expect.arrayContaining([expect.stringMatching(expected)]));
  });

  it("does not flag ordinary product descriptions", () => {
    expect(findRiskyClaims("A shared dashboard for your weekly planning.")).toEqual([]);
  });
});
