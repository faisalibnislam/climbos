import { describe, expect, it } from "vitest";
import { factFreshness } from "@shared/agents/factFreshness";

describe("business fact freshness", () => {
  const now = Date.UTC(2026, 0, 1);
  it("uses shorter review intervals for pricing and competitor claims", () => {
    expect(factFreshness("pricing", now - 60 * 86_400_000, now).reviewSuggested).toBe(true);
    expect(factFreshness("competitor", now - 45 * 86_400_000, now).reviewSuggested).toBe(true);
    expect(factFreshness("brand", now - 180 * 86_400_000, now).reviewSuggested).toBe(false);
  });

  it("treats future timestamps as fresh without claiming validity", () => {
    expect(factFreshness("offer", now + 86_400_000, now)).toEqual({ daysOld: 0, reviewSuggested: false });
  });
});
