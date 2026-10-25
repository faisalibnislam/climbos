import { describe, expect, it } from "vitest";
import { parseIntro } from "../../src/components/app/onboarding/parseIntro";

describe("onboarding chat parser", () => {
  it("understands the blueprint's Formkit request", () => {
    const p = parseIntro("We are Formkit (formkit.app). Help Formkit acquire more paying customers over the next 90 days. I can spend $600 a month on ads and review content on Fridays.");
    expect(p.website).toBe("formkit.app");
    expect(p.businessName).toBe("Formkit");
    expect(p.goalKind).toBe("more_customers");
    expect(p.monthlyAdBudget).toBe(600);
    expect(p.horizonDays).toBe(90);
    expect(p.reviewDay).toBe("Friday");
    expect(p.goalStatement).toMatch(/paying customers/);
  });

  it("handles no website, months and no ads", () => {
    const p = parseIntro("I run Bloom Bakery. I want more sales in 3 months. No ads please.");
    expect(p.website).toBeUndefined();
    expect(p.businessName).toBe("Bloom Bakery");
    expect(p.goalKind).toBe("more_sales");
    expect(p.horizonDays).toBe(90);
    expect(p.monthlyAdBudget).toBe(0);
  });

  it("understands ordinary name introductions and curly apostrophes", () => {
    expect(parseIntro("My business is called Northstar Bakery. I want more local orders.").businessName).toBe("Northstar Bakery");
    expect(parseIntro("We’re Bloom Bakery. We need help.").businessName).toBe("Bloom Bakery");
  });

  it("does not mistake an email address for a website", () => {
    const p = parseIntro("Contact me at owner@shop.com about growing reach");
    expect(p.website).toBeUndefined();
    expect(p.goalKind).toBe("more_reach");
  });
});
