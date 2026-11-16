import { describe, expect, it } from "vitest";
import { offerHorizon } from "../../shared/growth/offerHorizon";
import { offerAssessmentFixture } from "../fixtures/offerAssessment";
const offer = (currency = "USD", price: number | null = 95) => {
  const assessment = offerAssessmentFixture({ currency, horizonDays: 90 });
  assessment.proposed.netPrice.amount = price;
  return assessment;
};
describe("offer contribution in a shared horizon", () => {
  it("requires volume and known costs; never converts an unknown into zero", () => {
    expect(offerHorizon(offer(), null).state).toBe("unknown_volume");
    expect(offerHorizon(offer("USD", null), 100).state).toBe("unknown_costs");
    const incomplete = offer(); incomplete.proposed.variableCosts = [];
    expect(offerHorizon(incomplete, 100).state).toBe("unknown_costs");
    expect(offerHorizon(offer(), -1).state).toBe("invalid_volume");
  });
  it("calculates the minimum whole sales needed and supports zero-decimal currencies", () => {
    for (const currency of ["USD", "JPY"]) expect(offerHorizon(offer(currency), 100)).toMatchObject({ state: "calculated", currentTotal: 5000, unitsNeeded: 125, extraUnits: 25, proposedAtSameVolume: 4000, horizonDays: 90 });
    expect(offerHorizon(offer(), 0)).toMatchObject({ state: "calculated", unitsNeeded: 0 });
    expect(offerHorizon(offer("USD", 55), 100).state).toBe("cannot_match");
    expect(offerHorizon(offer("USD", 1e20), 100).state).toBe("invalid_amount");
  });
});
