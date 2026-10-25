import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { InsightsV2Schema, lintInsightSources } from "../../shared/agents/specs";

vi.mock("convex/react", () => ({ useQuery: vi.fn(), useMutation: vi.fn(() => vi.fn()) }));
const { Battlecard } = await import("../../src/components/app/plan/PlanSections");

const card = { winsWith: "Teams that want one tool for everything", theyAreStrongerAt: "Integrations with accounting tools", weAreStrongerAt: "Same-day setup with a person", landmineQuestion: "How long until my first invoice goes out?", sourceUrls: ["https://rival.example/features"] };
const competitor = { name: "Rival", url: "https://rival.example", note: "Invoicing suite", sourceUrl: "https://rival.example/", kind: "direct" as const, battlecard: card };
const base = { audiences: [], competitors: [competitor], alternatives: [], vocPhrases: [], objections: [], gaps: [], siteAssessment: [], swot: { strengths: [], weaknesses: [], opportunities: [], threats: [] }, swotEvidence: [], swotMoves: [], commercialAssessment: { status: "insufficient_business_specific_evidence" as const, evidence: [], unknowns: [], nextTest: { question: "q", smallestTest: "t", successSignal: "s", decisionRule: "d" } } };

describe("competitor battlecards", () => {
  it("accepts an optional battlecard and requires at least one source", () => {
    expect(InsightsV2Schema.shape.competitors.element.shape.battlecard.safeParse(card).success).toBe(true);
    expect(InsightsV2Schema.shape.competitors.element.shape.battlecard.safeParse({ ...card, sourceUrls: [] }).success).toBe(false);
    expect(InsightsV2Schema.shape.competitors.element.shape.battlecard.safeParse(undefined).success).toBe(true);
  });

  it("rejects battlecard sources that weren't read in the run", () => {
    const input = { task: "t", brief: "b", facts: [], availableSourceUrls: ["https://rival.example/", "https://rival.example/features"] };
    expect(lintInsightSources(base as never, input).filter((i) => i.path?.includes("battlecard"))).toEqual([]);
    const invented = lintInsightSources({ ...base, competitors: [{ ...competitor, battlecard: { ...card, sourceUrls: ["https://invented.example/blog"] } }] } as never, input);
    expect(invented.some((i) => i.severity === "error" && i.path === "competitors[0].battlecard.sourceUrls[0]")).toBe(true);
  });

  it("shows the card with its sources and a check-before-use caveat", () => {
    const html = renderToStaticMarkup(createElement(Battlecard, { card }));
    expect(html).toContain("Who they win with");
    expect(html).toContain("How long until my first invoice goes out?");
    expect(html).toContain("https://rival.example/features");
    expect(html).toContain("doesn&#x27;t show why buyers choose either business");
  });
});
