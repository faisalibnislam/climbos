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
});
