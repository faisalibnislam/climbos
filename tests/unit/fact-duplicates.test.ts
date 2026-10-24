import { describe, expect, it } from "vitest";
import { groupExactDuplicateFacts } from "../../shared/agents/factDuplicates";

describe("exact duplicate business facts", () => {
  it("groups only same-category facts with equivalent case, spacing, and ending punctuation", () => {
    const groups = groupExactDuplicateFacts([
      { id: "one", category: "pricing", statement: "Pro plan costs $19 per month." },
      { id: "two", category: "pricing", statement: "  PRO plan   costs $19 per month? " },
      { id: "three", category: "product", statement: "Pro plan costs $19 per month." },
      { id: "four", category: "pricing", statement: "Pro plan costs $24 per month." },
    ]);

    expect(groups).toHaveLength(3);
    expect(groups[0]).toMatchObject({ primary: { id: "one" }, duplicates: [{ id: "two" }] });
    expect(groups[1]).toMatchObject({ primary: { id: "three" }, duplicates: [] });
    expect(groups[2]).toMatchObject({ primary: { id: "four" }, duplicates: [] });
  });

  it("retains every underlying fact in its group", () => {
    const group = groupExactDuplicateFacts([
      { id: "older", category: "offer", statement: "Free shipping over $50" },
      { id: "newer", category: "offer", statement: "free shipping over $50." },
      { id: "third", category: "offer", statement: " FREE SHIPPING OVER $50! " },
    ])[0];

    expect([group.primary.id, ...group.duplicates.map((fact) => fact.id)]).toEqual(["older", "newer", "third"]);
  });

  it("does not group matching statements across review states", () => {
    const groups = groupExactDuplicateFacts([
      { id: "confirmed", category: "pricing", statement: "Pro costs $20 monthly.", state: "confirmed" },
      { id: "pending", category: "pricing", statement: "Pro costs $20 monthly.", state: "needs_review" },
    ]);
    expect(groups).toHaveLength(2);
  });

  it("groups equivalent wording and token order but keeps different entities, values, currencies, or polarity", () => {
    const groups = groupExactDuplicateFacts([
      { id: "a", category: "pricing", statement: "The Pro plan costs $20 per month." },
      { id: "b", category: "pricing", statement: "$20 monthly price for the Pro plan" },
      { id: "tier", category: "pricing", statement: "The Starter plan costs $20 per month." },
      { id: "value", category: "pricing", statement: "The Pro plan costs $30 per month." },
      { id: "currency", category: "pricing", statement: "The Pro plan costs €20 per month." },
      { id: "polarity", category: "pricing", statement: "The Pro plan does not cost $20 per month." },
    ]);
    expect(groups).toHaveLength(5);
    expect(groups.find((group) => group.primary.id === "a")?.duplicates.map((fact) => fact.id)).toEqual(["b"]);
  });
});
