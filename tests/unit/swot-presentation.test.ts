import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BusinessInsights, type Insights } from "../../src/components/app/plan/PlanSections";

function insights(overrides: Partial<Insights> = {}): Insights {
  return {
    generatedAt: 1_800_000_000_000,
    audiences: [],
    competitors: [],
    positioning: "",
    pricingNotes: "",
    swot: {
      strengths: ["Repeat customers refer neighbors"],
      weaknesses: [],
      opportunities: ["Local buyers ask for weekend service"],
      threats: [],
    },
    journey: [],
    opportunities: [],
    ...overrides,
  } as Insights;
}

describe("SWOT presentation", () => {
  it("shows evidence basis, confidence, implication, source, and tested strategic combinations on demand", () => {
    const html = renderToStaticMarkup(createElement(BusinessInsights, {
      insights: insights({
        commercialAssessment: {
          status: "mixed_evidence",
          evidence: [],
          unknowns: [],
          nextTest: {
            question: "Do local buyers need weekend service?",
            smallestTest: "Ask a small group of possible customers.",
            successSignal: "A qualified booking request.",
            decisionRule: "Review the replies before expanding.",
          },
        },
        swotEvidence: [{
          dimension: "strength",
          finding: "Repeat customers refer neighbors",
          basis: "measured",
          evidenceRefs: ["fact:1", "https://example.com/referrals"],
          strategicImplication: "A small referral test may build on an existing behavior.",
          confidence: "medium",
        }],
        swotMoves: [{
          kind: "strength_opportunity",
          firstIndex: 0,
          secondIndex: 0,
          move: "Offer an optional referral link after a completed service visit.",
          firstTest: "Try the link with a small group of existing customers.",
          measure: "Qualified referred bookings during the test window",
        }],
      }),
    }));

    expect(html).toContain("Evidence and why it matters");
    expect(html).toContain("What we know about sales and what to check next");
    expect(html).toContain("Some evidence, some uncertainty");
    expect(html).not.toContain("mixed_evidence");
    expect(html).toContain("Measured result");
    expect(html).toContain("medium confidence");
    expect(html).toContain("A small referral test may build on an existing behavior.");
    expect(html).toContain('href="https://example.com/referrals"');
    expect(html).toContain("Possible next steps (1)");
    expect(html).toContain("Small first test:");
    expect(html).toContain("Qualified referred bookings during the test window");
    expect(html).not.toContain("fact:1");
  });

  it("labels legacy statements without saved support as hypotheses", () => {
    const html = renderToStaticMarkup(createElement(BusinessInsights, { insights: insights() }));
    expect(html).toContain("No supporting evidence is saved for this item. Treat it as an idea to check, not a confirmed fact.");
    expect(html).toContain("What helps, what gets in the way, and what to watch");
  });
});
