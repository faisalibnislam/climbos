import { describe, expect, it } from "vitest";
import { factsBlock, staleFactsBlock } from "../../shared/ai/tasks";
import { factFreshness } from "@shared/agents/factFreshness";

describe("business fact freshness", () => {
  const now = Date.UTC(2026, 0, 1);
  it("uses shorter review intervals for pricing and competitor claims", () => {
    expect(factFreshness("pricing", now - 60 * 86_400_000, now).reviewSuggested).toBe(true);
    expect(factFreshness("competitor", now - 45 * 86_400_000, now).reviewSuggested).toBe(true);
    expect(factFreshness("brand", now - 180 * 86_400_000, now).reviewSuggested).toBe(false);
  });

  it.each([now + 86_400_000, NaN, Infinity, -1])("requires review for an invalid confirmation date %s", (verifiedAt) => {
    expect(factFreshness("offer", now, now, verifiedAt)).toEqual({ daysOld: null, reviewSuggested: true });
  });

  it("uses the last owner verification instead of a later unrelated record update", () => {
    expect(factFreshness("pricing", now, now, now - 61 * 86_400_000)).toEqual({ daysOld: 61, reviewSuggested: true });
    // Legacy records have no verifiedAt and continue using updatedAt.
    expect(factFreshness("pricing", now - 59 * 86_400_000, now)).toEqual({ daysOld: 59, reviewSuggested: false });
  });
  it("preserves unknown confirmation age in model context without invalid dates or invented zero age", () => {
    const facts = [{ statement: "Pro includes support.", category: "product", verifiedAt: NaN, freshness: { daysOld: null, reviewSuggested: true } }];
    expect(() => staleFactsBlock(facts)).not.toThrow();
    expect(staleFactsBlock(facts)).toContain("confirmation date unknown or invalid");
    expect(staleFactsBlock(facts)).not.toContain("0 days");
    expect(factsBlock(facts)).toContain("confirmation date unknown or invalid");
  });

});
