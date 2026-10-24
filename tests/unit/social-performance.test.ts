import { describe, expect, it } from "vitest";
import { instagramActionsPerReach } from "../../shared/growth/socialPerformance";

describe("Instagram post performance calculations", () => {
  it("calculates interaction actions per reached account from complete provider metrics", () => {
    expect(instagramActionsPerReach([
      { metric: "reach", value: 400 },
      { metric: "likes", value: 30 },
      { metric: "comments", value: 4 },
      { metric: "saved", value: 5 },
      { metric: "shares", value: 1 },
      { metric: "views", value: 900 },
    ])).toEqual({ metric: "calculated_actions_per_reach_pct", value: 10 });
  });

  it("does not calculate a rate from missing actions, zero reach, or malformed counts", () => {
    expect(instagramActionsPerReach([{ metric: "reach", value: 100 }, { metric: "likes", value: 2 }])).toBeNull();
    expect(instagramActionsPerReach([
      { metric: "reach", value: 0 },
      { metric: "likes", value: 2 },
      { metric: "comments", value: 1 },
      { metric: "saved", value: 1 },
      { metric: "shares", value: 0 },
    ])).toBeNull();
    expect(instagramActionsPerReach([
      { metric: "reach", value: 20 },
      { metric: "likes", value: 2.5 },
      { metric: "comments", value: 1 },
      { metric: "saved", value: 1 },
      { metric: "shares", value: 0 },
    ])).toBeNull();
  });
});
