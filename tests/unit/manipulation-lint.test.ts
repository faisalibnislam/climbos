import { describe, expect, it } from "vitest";
import { lintClaims, lintManipulation } from "../../shared/agents/lint";
import { reviewDestinationProblem } from "../../shared/acquisition/platformRules";

const rules = (text: string) => lintManipulation([{ path: "body", text }]).map((i) => i.rule);

describe("manipulation lint", () => {
  it.each([
    ["Please upvote us on launch day.", "vote_request"],
    ["Support us on Product Hunt today", "vote_request"],
    ["Leave a 5-star review and get 10% off your next visit.", "review_incentive"],
    ["Free coffee in exchange for a review.", "review_incentive"],
    ["If you loved your visit, leave us a review!", "review_gating"],
    ["Happy customers, please leave a review.", "review_gating"],
    ["This reel is guaranteed to go viral.", "virality_promise"],
  ])("flags %s", (text, rule) => {
    expect(rules(text)).toContain(rule);
  });

  it.each([
    "If you have a moment, you can share an honest review here.",
    "We'd love your feedback on the launch, good or bad.",
    "Our launch is live on Product Hunt. Tell us what's missing.",
    "Book a review call with our team.",
  ])("leaves neutral copy alone: %s", (text) => {
    expect(rules(text)).toEqual([]);
  });

  it("runs wherever the claim lint runs, even with full evidence", () => {
    expect(lintClaims([{ path: "body", text: "Leave a five-star review for a free gift." }], "Everything is confirmed.").map((i) => i.rule)).toContain("review_incentive");
  });
});

describe("review invitation destination", () => {
  it("refuses Yelp, which asks businesses not to solicit reviews", () => {
    expect(reviewDestinationProblem("https://www.yelp.com/writeareview/biz/abc")).toMatch(/Yelp/);
    expect(reviewDestinationProblem("https://yelp.co.uk/biz/abc")).toMatch(/Yelp/);
  });
  it("allows other review pages and ignores look-alike hosts", () => {
    expect(reviewDestinationProblem("https://g.page/r/abc/review")).toBeNull();
    expect(reviewDestinationProblem("https://notyelp.com/review")).toBeNull();
  });
});
