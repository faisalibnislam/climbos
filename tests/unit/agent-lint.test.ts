import { describe, expect, it } from "vitest";
import { hookBeforeFold, lintCopy, maxLength, untracedNumbers } from "../../shared/agents/lint";
import { assess } from "../../shared/agents/runtime";
import { lintVoice, promisedCount } from "../../shared/agents/specs";
import type { Rubric } from "../../shared/agents/types";

describe("copy lint", () => {
  it("flags AI clichés, fact markers and repeated punctuation", () => {
    const issues = lintCopy({ posts: [{ body: "In today's fast-paced world, our game-changing tool helps [2]!!" }] });
    const rules = issues.map((i) => i.rule);
    expect(rules).toContain("banned_phrase");
    expect(rules).toContain("fact_marker");
    expect(rules).toContain("punctuation");
    expect(issues.find((i) => i.rule === "banned_phrase")?.path).toBe("posts[0].body");
  });

  it("respects the brand's own words", () => {
    expect(lintCopy({ t: "A seamless handover" }, { allow: ["seamless"] }).filter((i) => i.severity === "error")).toEqual([]);
  });

  it("only allows numbers that trace to the evidence", () => {
    expect(untracedNumbers("Plans start at $9 for 10k pageviews, trusted by 21,000 teams", "starting at $9 per month for up to 10k monthly pageviews; over 21,000 paying subscribers")).toEqual([]);
    expect(untracedNumbers("Save 40% and join 5,000 happy customers", "No numbers here")).toEqual(["40%", "5,000"]);
    expect(untracedNumbers("3 tips for 2026", "")).toEqual([]);
    // "1 month" is a duration, not "1 million"; "10k" and "3x" are claims.
    expect(untracedNumbers("Review after 1 month and 2 weeks", "")).toEqual([]);
    expect(untracedNumbers("Grew 3x to 10k users", "")).toEqual(["3x", "10k"]);
  });

  it("checks limits and the fold", () => {
    expect(maxLength("x".repeat(31), 30, "h[0]", "Headline")[0].rule).toBe("length");
    expect(hookBeforeFold("a".repeat(200) + "\nrest", 140, "body")[0].rule).toBe("fold");
  });
});

describe("assessment", () => {
  const rubric: Rubric = {
    id: "t", title: "t",
    gates: [{ id: "G1", text: "truth" }],
    criteria: [{ id: "C1", name: "a", anchors: { 1: "x", 3: "y", 5: "z" } }, { id: "C2", name: "b", anchors: { 1: "x", 3: "y", 5: "z" } }],
    shipRule: { minEach: 3, minAverage: 4 },
  };
  const review = (values: number[]) => ({ gates: [{ id: "G1", pass: true, note: "" }], scores: values.map((score, i) => ({ id: ["C1", "C2", "XV"][i], score, note: "", fix: "" })), strengths: [], fixes: [] });
  it("preserves fractional scores and compares the unrounded average to the bar", () => {
    expect(assess(review([3.5, 3.5, 4]), [], rubric)).toMatchObject({ ship: false, average: 3.67, minimum: 3.5 });
    expect(assess(review([3.999, 4, 4]), [], rubric)).toMatchObject({ ship: false, average: 4, minimum: 3.999 });
    expect(assess(review([3.5, 4, 4.5]), [], rubric)).toMatchObject({ ship: true, average: 4, minimum: 3.5 });
    expect(assess(review([2.9, 5, 5]), [], rubric).ship).toBe(false);
  });
  it.each([0, 6, 99, NaN, Infinity, -Infinity])("rejects invalid required scores instead of clamping them: %s", score => {
    const result = assess(review([score, 5, 5]), [], rubric);
    expect(result.ship).toBe(false);
    expect(result.lint).toContainEqual(expect.objectContaining({ rule: "review_scores", severity: "error" }));
    expect(Number.isFinite(result.average)).toBe(true);
  });
  it("rejects missing or duplicated criteria without mutating input or accepting last-wins scores", () => {
    const original = review([5, 5, 5]);
    const lint: Parameters<typeof assess>[1] = [];
    for (const scores of [original.scores.slice(1), [...original.scores, original.scores[0]], [{ ...original.scores[0], score: 1 }, ...original.scores]]) {
      const result = assess({ ...original, scores }, lint, rubric);
      expect(result.ship).toBe(false);
      expect(result.lint).toContainEqual(expect.objectContaining({ rule: "review_scores" }));
    }
    expect(lint).toEqual([]);
    expect(assess(original, lint, rubric).ship).toBe(true);
  });
  it("ships only when gates pass, lint is clean and scores clear the bar", () => {
    const good = { gates: [{ id: "G1", pass: true, note: "" }], scores: [{ id: "C1", score: 4, note: "", fix: "" }, { id: "C2", score: 5, note: "", fix: "" }, { id: "XV", score: 4, note: "", fix: "" }], strengths: [], fixes: [] };
    expect(assess(good, [], rubric).ship).toBe(true);
    expect(assess({ ...good, gates: [{ id: "unrelated", pass: true, note: "" }] }, [], rubric).gatesPassed).toBe(false);
    expect(assess(good, [], { ...rubric, gates: [...rubric.gates, { id: "G2", text: "permission" }] }).ship).toBe(false);
    expect(assess({ ...good, gates: [...good.gates, ...good.gates] }, [], rubric).ship).toBe(false);
    expect(assess(good, [{ severity: "error", rule: "length", message: "" }], rubric).ship).toBe(false);
    expect(assess({ ...good, gates: [{ id: "G1", pass: false, note: "" }] }, [], rubric).ship).toBe(false);
    expect(assess({ ...good, scores: [{ id: "C1", score: 5, note: "", fix: "" }, { id: "C2", score: 2, note: "", fix: "" }, { id: "XV", score: 5, note: "", fix: "" }] }, [], rubric).ship).toBe(false);
    // The holistic expert verdict always counts: a weak verdict blocks shipping.
    expect(assess({ ...good, scores: [...good.scores.slice(0, 2), { id: "XV", score: 2, note: "", fix: "" }] }, [], rubric).ship).toBe(false);
    // Missing criteria count as 1.
    expect(assess({ ...good, scores: [{ id: "C1", score: 5, note: "", fix: "" }] }, [], rubric).minimum).toBe(1);
  });
});

describe("voice and promise lints", () => {
  it("flags reviewer-style third person on the brand's own channel", () => {
    expect(lintVoice("The team says openly that ads fund nothing.", "posts[0]")).toHaveLength(1);
    expect(lintVoice("The site's own claim is that no training is needed.", "p")).toHaveLength(1);
    expect(lintVoice("We built it so you never need a cookie banner.", "p")).toHaveLength(0);
  });
  it("reads the count a title promises", () => {
    expect(promisedCount("Carousel: 6 things your website doesn't need")).toBe(6);
    expect(promisedCount("Five mistakes bakers make")).toBe(5);
    expect(promisedCount("2 ways")).toBeNull();
    expect(promisedCount("Our holiday menu")).toBeNull();
  });
});
