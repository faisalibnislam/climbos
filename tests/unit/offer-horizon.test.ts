import { describe, expect, it } from "vitest";
import { offerHorizon } from "../../shared/growth/offerHorizon";
import type { OfferAssessment } from "../../shared/agents/offerAssessment";
const value = (amount: number | null) => ({ amount, basis: "owner_reported", reference: "fact:0", claim: "Owner-supplied test input" });
// Only the unit-economics inputs are consumed here; production parsing enforces the full offer contract.
const offer = (currency = "USD", price: number | null = 95) => ({ currency, horizonDays: 90, current: { netPrice: value(100), unknownCosts: [], variableCosts: [{ category: "all variable costs", value: value(50) }] }, proposed: { netPrice: value(price), unknownCosts: [], variableCosts: [{ category: "all variable costs", value: value(55) }] } }) as unknown as OfferAssessment;
describe("offer contribution in a shared horizon", () => {
  it("requires volume and known costs; never converts an unknown into zero", () => {
    expect(offerHorizon(offer(), null).state).toBe("unknown_volume");
    expect(offerHorizon(offer("USD", null), 100).state).toBe("unknown_costs");
    expect(offerHorizon(offer(), -1).state).toBe("invalid_volume");
  });
  it("calculates the minimum whole sales needed and supports zero-decimal currencies", () => {
    for (const currency of ["USD", "JPY"]) expect(offerHorizon(offer(currency), 100)).toMatchObject({ state: "calculated", currentTotal: 5000, unitsNeeded: 125, extraUnits: 25, proposedAtSameVolume: 4000, horizonDays: 90 });
    expect(offerHorizon(offer(), 0)).toMatchObject({ state: "calculated", unitsNeeded: 0 });
    expect(offerHorizon(offer("USD", 55), 100).state).toBe("cannot_match");
    expect(offerHorizon(offer("USD", 1e20), 100).state).toBe("invalid_amount");
  });
});
