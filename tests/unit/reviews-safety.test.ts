import { describe, expect, it } from "vitest";
import { reviewSafetySignals } from "@shared/reviews/safety";

describe("public review safety routing", () => {
  it("routes potentially sensitive topics without deciding whether the report is true", () => {
    expect(reviewSafetySignals("My lawyer says this unsafe product caused an injury and my private data was exposed.")).toEqual(["legal", "health_safety", "privacy"]);
    expect(reviewSafetySignals("They charged me twice and discriminated against my family.")).toEqual(["discrimination", "payment"]);
  });

  it("leaves ordinary praise and service complaints eligible for a grounded draft", () => {
    expect(reviewSafetySignals("The room was clean, but breakfast arrived late.")).toEqual([]);
    expect(reviewSafetySignals("Great team, but please refund me for the unused add-on.")).toEqual([]);
  });
});
