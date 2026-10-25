import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { leadScoreBrief, leadScoreCheck, type LeadScoreRow } from "../../shared/growth/leadScores";

vi.mock("convex/react", () => ({ useQuery: vi.fn() }));
const { LeadScoreCheckCard } = await import("../../src/components/app/outbound/LeadScoreCheck");

const rows = (n: number, fit: number, timing: number, replied: number, booked: number): LeadScoreRow[] =>
  Array.from({ length: n }, (_, i) => ({ fit, timing, replied: i < replied, booked: i < booked }));

describe("prospect score check", () => {
  it("calls a difference only with 20+ contacts per band and non-overlapping 90% intervals", () => {
    const [fit, timing] = leadScoreCheck([...rows(40, 85, 50, 20, 6), ...rows(40, 40, 50, 4, 1)]);
    expect(fit).toMatchObject({ score: "fit", high: { contacted: 40, replied: 20, booked: 6 }, lower: { contacted: 40, replied: 4, booked: 1 }, reply: "high_better" });
    expect(fit.booking).toBe("no_clear_difference");
    // Everyone has timing below 70, so the timing comparison has no high band.
    expect(timing.reply).toBe("too_few");
    expect(leadScoreCheck([...rows(10, 90, 90, 9, 5), ...rows(10, 20, 20, 0, 0)])[0].reply).toBe("too_few");
  });

  it("flags a score that predicts the wrong way, and says nothing with no contacts", () => {
    expect(leadScoreCheck([...rows(40, 85, 85, 2, 0), ...rows(40, 30, 30, 18, 2)])[0].reply).toBe("lower_better");
    expect(leadScoreBrief(leadScoreCheck([]))).toBe("");
  });

  it("explains the comparison and its limits", () => {
    const comparisons = leadScoreCheck([...rows(40, 85, 50, 20, 6), ...rows(40, 40, 50, 4, 1)]);
    expect(leadScoreBrief(comparisons)).toContain("fit score 70+ vs below 70: replies 20/40 (50%) vs 4/40 (10%), higher-scored prospects did better");
    const html = renderToStaticMarkup(createElement(LeadScoreCheckCard, { comparisons }));
    expect(html).toContain("Are the prospect scores working?");
    expect(html).toContain("association, not cause");
  });
});
