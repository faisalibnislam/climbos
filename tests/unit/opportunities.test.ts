import { describe, expect, it } from "vitest";
import { linkQuickTakeEvidence, projectGrowthOpportunities, type OpportunityPlayInput } from "../../shared/agents/opportunities";

describe("quick take evidence links", () => {
  it("links only valid, unique indexes to the exact confirmed facts supplied", () => {
    const facts = [
      { id: "fact-a", statement: "Customers ask for weekend sessions.", kind: "owner_input" },
      { id: "fact-b", statement: "The booking page has four steps.", kind: "observed" },
    ];
    const result = linkQuickTakeEvidence({
      headline: "A useful first take",
      opportunities: [{ title: "Test weekend slots", why: "There is stated demand.", nextStep: "Ask customers which hours work.", factIndexes: [0, 0, 1, -1, 4, 1.2] }],
    }, facts);

    expect(result).toEqual({
      headline: "A useful first take",
      opportunities: [{
        title: "Test weekend slots",
        why: "There is stated demand.",
        nextStep: "Ask customers which hours work.",
        evidence: [
          { factId: "fact-a", statement: "Customers ask for weekend sessions.", kind: "owner_input" },
          { factId: "fact-b", statement: "The booking page has four steps.", kind: "observed" },
        ],
        basis: "confirmed_facts",
      }],
    });
  });

  it("labels unsupported opportunities as hypotheses and bounds the preview", () => {
    const result = linkQuickTakeEvidence({
      headline: "  First take  ",
      opportunities: Array.from({ length: 5 }, (_, index) => ({ title: `Idea ${index + 1}`, why: "", nextStep: "", factIndexes: [0] })),
    }, []);

    expect(result.headline).toBe("First take");
    expect(result.opportunities).toHaveLength(3);
    expect(result.opportunities[0]).toMatchObject({ title: "Idea 1", evidence: [], basis: "hypothesis" });
  });

  it("drops entries with blank titles", () => {
    expect(linkQuickTakeEvidence({ headline: "take", opportunities: [{ title: " ", why: "", nextStep: "", factIndexes: [] }] }, []).opportunities).toEqual([]);
  });
});

describe("Growth Home opportunity projection", () => {
  it("preserves the plan's ordering and makes evidence status explicit", () => {
    const plays: OpportunityPlayInput[] = [
      {
        id: "creative-1",
        name: "Interview recent customers",
        kind: "creative",
        oneLiner: "Learn why buyers chose the service.",
        firstActionToday: "Invite three recent customers to a short call.",
        model: { ownerHoursPerWeek: 1.5, steps: [{ source: "assumption", ref: "To test" }] },
      },
      {
        id: "bankable-1",
        name: "Fix the booking page",
        kind: "bankable",
        oneLiner: "Make the next step clearer.",
        firstActionToday: "Rewrite the booking button label.",
        model: {
          reachSource: { source: "research", ref: "https://example.com/pricing", quote: "Plans start at $20 per month.", check: "source_verified", checkedBy: "climbos-provenance-1", access: "read" },
          steps: [{ source: "owner", ref: "Confirmed conversion rate", check: "owner_input", checkedBy: "climbos-provenance-1" }],
        },
      },
    ];

    const result = projectGrowthOpportunities(plays);

    expect(result.map((x) => x.id)).toEqual(["creative-1", "bankable-1"]);
    expect(result[0].sources).toEqual([
      { label: "Assumption to test", detail: "To test" },
    ]);
    expect(result[0].nextStep).toBe("Invite three recent customers to a short call.");
    expect(result[0].ownerHoursPerWeek).toBe(1.5);
    expect(result[1].ownerHoursPerWeek).toBeNull();
    expect(result[1].sources.map((source) => source.label)).toEqual(["Verified on source", "Owner-confirmed input"]);
  });

  it("does not turn unchecked research claims into verified citations", () => {
    const [result] = projectGrowthOpportunities([
      {
        name: "Test a new offer",
        kind: "bankable",
        model: { steps: [{ source: "research", ref: "https://example.com/research", quote: "A reported figure.", check: "reported", checkedBy: "climbos-provenance-1", access: "read" }] },
      },
    ]);

    expect(result.sources[0]).toMatchObject({ label: "Page read; claim not verified", url: "https://example.com/research" });
  });

  it("bounds the number of projected opportunities and ignores nameless plays", () => {
    const plays = Array.from({ length: 5 }, (_, index) => ({ name: `Opportunity ${index + 1}`, kind: "bankable" })) as OpportunityPlayInput[];
    plays.unshift({ kind: "bankable", name: "   " });

    expect(projectGrowthOpportunities(plays, 3).map((x) => x.title)).toEqual(["Opportunity 1", "Opportunity 2", "Opportunity 3"]);
    expect(projectGrowthOpportunities(plays, 0)).toEqual([]);
  });
});
