import { describe, expect, it } from "vitest";
import { wishSuggestions } from "../../src/components/app/wish/WishComposer";

describe("Home request starters", () => {
  it("uses short, business-relevant requests for each known business type", () => {
    expect(wishSuggestions("saas")).toContain("Help new customers reach their first useful result");
    expect(wishSuggestions("ecommerce")).toContain("Help more shoppers finish an order");
    expect(wishSuggestions("physical_products")).toContain("Help shoppers understand what makes my product useful");
    expect(wishSuggestions("services")).toContain("Help more of the right people book with me");
    for (const type of ["saas", "ecommerce", "physical_products", "services"]) {
      expect(wishSuggestions(type)).toHaveLength(4);
    }
  });

  it("keeps generic editable starters for unknown or missing business types", () => {
    expect(wishSuggestions("other")).toEqual(wishSuggestions());
    expect(wishSuggestions("unrecognized")).toHaveLength(4);
  });
});
