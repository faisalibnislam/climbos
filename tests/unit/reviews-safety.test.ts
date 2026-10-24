import { describe, expect, it } from "vitest";
import { ratingOnlyReviewReply, reviewSafetySignals } from "@shared/reviews/safety";

describe("public review safety routing", () => {
  it("routes potentially sensitive topics without deciding whether the report is true", () => {
    expect(reviewSafetySignals("My lawyer says this unsafe product caused an injury and my private data was exposed.")).toEqual(["legal", "health_safety", "privacy"]);
    expect(reviewSafetySignals("They charged me twice and discriminated against my family.")).toEqual(["discrimination", "payment"]);
  });

  it("leaves ordinary praise and service complaints eligible for a grounded draft", () => {
    expect(reviewSafetySignals("The room was clean, but breakfast arrived late.")).toEqual([]);
    expect(reviewSafetySignals("Great team, but please refund me for the unused add-on.")).toEqual([]);
  });

  it("offers a fixed, non-inventive thank-you only for positive rating-only reviews", () => {
    expect(ratingOnlyReviewReply(5)).toBe("Thank you for taking the time to leave a 5-star rating. We appreciate your support.");
    expect(ratingOnlyReviewReply(4)).toContain("4-star rating");
    expect(ratingOnlyReviewReply(3)).toBeNull();
    expect(ratingOnlyReviewReply(6)).toBeNull();
  });
});
