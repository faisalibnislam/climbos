import { describe, expect, it } from "vitest";
import { parseIntro } from "../../src/components/app/onboarding/parseIntro";
import { goalSuggestions, toggleGoalSentence } from "../../src/components/app/onboarding/options";

describe("several goals and goal suggestions", () => {
  it("reads every goal type the owner mentions, all equal", () => {
    const p = parseIntro("We're Northstar Bakery. I want more customers and more online orders, and more followers.");
    expect(p.goalKinds).toEqual(["more_customers", "more_sales", "more_reach"]);
    expect(p.goalKind).toBe("more_customers");
  });

  it("tailors suggestions to the business type and chosen goals, without duplicates", () => {
    const s = goalSuggestions({ businessType: "services", kinds: ["more_reach"], local: true });
    expect(s).toContain("Get more booked appointments each week.");
    expect(s).toContain("Get found more often on Google and AI answers.");
    expect(s).toContain("Become the first choice nearby.");
    expect(new Set(s).size).toBe(s.length);
    expect(s.length).toBeLessThanOrEqual(8);
    expect(goalSuggestions({ businessType: "ecommerce", kinds: [] })[0]).toBe("Get more repeat orders from past customers.");
    expect(goalSuggestions({ businessType: null, kinds: [] }).length).toBeGreaterThan(0);
  });

  it("adds and removes one suggestion sentence while keeping the owner's own words", () => {
    const added = toggleGoalSentence("Help us grow", "Fill quiet days and slow weeks.");
    expect(added).toBe("Help us grow. Fill quiet days and slow weeks.");
    expect(toggleGoalSentence(added, "Fill quiet days and slow weeks.")).toBe("Help us grow.");
    expect(toggleGoalSentence("", "Win back past customers.")).toBe("Win back past customers.");
  });
});
