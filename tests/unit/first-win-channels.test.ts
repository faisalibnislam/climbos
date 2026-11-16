import { describe, expect, it } from "vitest";
import { firstWinChannels } from "../../convex/content";
import { parseIntro } from "../../src/components/app/onboarding/parseIntro";
import { hasNoCustomersYet } from "../../shared/agents/lifecycle";

describe("first posts follow the plan's channels", () => {
  it("spreads three posts over the plan's social channels in priority order", () => {
    const ch = [
      { key: "email", name: "Email newsletter", priority: 0 },
      { key: "instagram", name: "Instagram", priority: 2 },
      { key: "linkedin", name: "LinkedIn posts", priority: 1 },
      { key: "seo", name: "SEO", priority: 3 },
      { key: "community", name: "Facebook groups", priority: 4 },
    ];
    expect(firstWinChannels(ch, "saas")).toEqual(["linkedin", "instagram", "linkedin"]);
    expect(firstWinChannels([{ key: "tiktok", name: "TikTok", priority: 0 }], "ecommerce")).toEqual(["tiktok", "tiktok", "tiktok"]);
    expect(firstWinChannels([{ key: "social_organic", name: "YouTube demonstrations", priority: 0 }], "saas")).toEqual(["youtube", "youtube", "youtube"]);
  });

  it("does not invent a social destination from business type", () => {
    expect(firstWinChannels([{ key: "seo", name: "SEO", priority: 0 }], "saas")).toEqual([]);
    expect(firstWinChannels([], "physical_products")).toEqual([]);
    expect(firstWinChannels([{ key: "social_organic", name: "Instagram or LinkedIn", priority: 1 }])).toEqual([]);
    expect(firstWinChannels([{ key: "social_organic", name: "Instagram and Facebook", priority: 1 }])).toEqual(["instagram", "facebook", "instagram"]);
  });
});

describe("new businesses", () => {
  it("detects the stage from the owner's own words", () => {
    expect(parseIntro("We're Formkit. We just launched last week and have no customers yet.").businessStage).toBe("just_launched");
    expect(parseIntro("My business is called Nook. We're pre-launch.").businessStage).toBe("launching_soon");
    expect(parseIntro("It's still an idea I'm validating.").businessStage).toBe("idea");
    expect(parseIntro("We have 120 paying customers.").businessStage).toBe("has_customers");
    expect(parseIntro("We sell bread.").businessStage).toBeUndefined();
  });

  it("treats owner-reported no customers, idea and pre-launch as having no customer figures", () => {
    expect(hasNoCustomersYet({ customerData: { status: "no_customers_yet" } })).toBe(true);
    expect(hasNoCustomersYet({ lifecycleStage: { stage: "pre_launch" } })).toBe(true);
    expect(hasNoCustomersYet({ customerData: { status: "no_data_yet" }, lifecycleStage: { stage: "growth" } })).toBe(false);
    expect(hasNoCustomersYet(null)).toBe(false);
  });
});
