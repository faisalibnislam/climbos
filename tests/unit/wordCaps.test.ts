import { describe, expect, it } from "vitest";
import { capsHint, lintWordCaps, PLAN_CAPS } from "../../shared/agents/wordCaps";

describe("word caps", () => {
  it("flags long fields, including inside lists", () => {
    const out = { northStar: { metric: "Paid accounts", baseline: "0", target: "At least 1 attributable net new paid account by day 90 as a minimum learning threshold" }, weekOneChecklist: ["Connect mailbox", "a ".repeat(20)] };
    const issues = lintWordCaps(out, PLAN_CAPS);
    expect(issues.map((i) => i.path).sort()).toEqual(["northStar.target", "weekOneChecklist[1]"]);
    expect(lintWordCaps({ northStar: { target: "20 paid accounts by day 90" } }, PLAN_CAPS)).toEqual([]);
    expect(capsHint({ "plays[].hook": 20 })).toContain("plays.hook ≤ 20");
  });
});
