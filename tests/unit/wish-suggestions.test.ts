import { describe, expect, it } from "vitest";
import { wishSuggestions } from "../../src/components/app/wish/WishComposer";

describe("home request suggestions", () => {
  it("leads with the three universal asks, then one tailored to the business type", () => {
    expect(wishSuggestions("saas").slice(0, 3)).toEqual(["New business: plan my launch", "Get more customers", "Grow my followers on social media"]);
    expect(wishSuggestions("saas")[3]).toBe("Help me choose the next step for my software business");
    expect(wishSuggestions("ecommerce")[3]).toBe("Help me choose the next step for my online store");
    expect(wishSuggestions("services")[3]).toBe("Help me choose the next step for my service business");
    for (const type of ["saas", "ecommerce", "physical_products", "services", "other"]) {
      expect(wishSuggestions(type)).toHaveLength(4);
    }
  });

  it("falls back to general suggestions for unknown types", () => {
    expect(wishSuggestions("other")).toEqual(wishSuggestions());
    expect(wishSuggestions("unrecognized")).toHaveLength(4);
  });
});
