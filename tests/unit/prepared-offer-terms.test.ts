import { describe, expect, it } from "vitest";
import { lintPreparedDrafts } from "../../shared/agents/specs";
import type { AgentInput } from "../../shared/agents/types";

const offer = { playName: "New customer offer", recommendation: "recommend_promotion", currency: "USD", allowedPrices: [20], allowedMechanisms: ["discount"], allowedDiscountPercentages: [20], urgencyClaim: null, eligibleAudience: "new customers" };
const input: AgentInput = { task: "Prepare copy", brief: "A service business", facts: ["A different service costs $99. The selected offer is $20 for new customers."], approvedOfferTerms: [offer] };
const rules = (draft: string, context = input, approvedOfferPlayName?: string, kind = "social_post") => lintPreparedDrafts([{ kind, draft, approvedOfferPlayName }], context).map(issue => issue.rule);

describe("prepared customer copy retains approved offer terms", () => {
  it("rejects an unrelated evidenced price and an unapproved mechanism", () => {
    expect(rules("New customers can get started for $99.")).toContain("approved_offer_price");
    expect(rules("New customers receive a free gift with the service.")).toContain("approved_offer_mechanism");
  });
  it("keeps validation-only proposals out of customer-facing promotions", () => {
    expect(rules("New customers can use the discount offer.", { ...input, approvedOfferTerms: [{ ...offer, recommendation: "validate_first" }] })).toContain("offer_validation_only");
  });
  it("requires an exact offer when multiple approved offers exist", () => {
    const context = { ...input, approvedOfferTerms: [offer, { ...offer, playName: "Other offer", allowedPrices: [99] }] };
    expect(rules("New customers can get started for $20.", context)).toContain("approved_offer_play");
    expect(rules("New customers can get started for $20.", context, "Missing offer")).toContain("approved_offer_play");
    expect(rules("New customers can get started for $20.", context, offer.playName).filter(rule => rule.startsWith("approved_offer"))).toEqual([]);
  });
  it("leaves internal offer experiments as proposals", () => {
    expect(rules("Proposed test: compare a bonus with a discount; neither is available to customers.", input, undefined, "test_brief").filter(rule => rule.startsWith("approved_offer"))).toEqual([]);
  });
  it("rejects unsupported money-back promises", () => {
    expect(rules("We guarantee your money back. Try our service.", { ...input, facts: [], approvedOfferTerms: [] })).toContain("unsupported_refund_promise");
  });
});
