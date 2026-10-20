import { describe, expect, it } from "vitest";
import { lintComparisonPositioning, lintOfferClaims, lintReferralDrivers, lintSelfServeFunnel, lintStageMetric } from "../../shared/agents/specs";

/** Five lenses from marketing books (skills/growth-plays "Five lenses"), as deterministic checks. */
const cheap = { revenuePerCustomerMonthUsd: 9 };

describe("lens 1: self-serve funnel", () => {
  it("asks a low-price product for a play on its own funnel", () => {
    const outreach = [{ name: "Creator pitches", mechanic: "Pitch 20 YouTubers", firstActionToday: "List creators" }];
    expect(lintSelfServeFunnel(outreach, cheap).map((i) => i.rule)).toEqual(["self_serve_funnel"]);
    expect(lintSelfServeFunnel([...outreach, { name: "Faster first value", mechanic: "Onboarding checklist to the first invoice in 5 minutes" }], cheap)).toEqual([]);
    expect(lintSelfServeFunnel(outreach, { revenuePerCustomerMonthUsd: 120 })).toEqual([]);
  });
});

describe("lens 2: positioning on comparison pages", () => {
  it("needs the alternative, the difference and the segment", () => {
    const vague = [{ name: "Comparison page", assetUsed: "https://x.com/compare", hook: "See how we compare", audience: "Everyone" }];
    const issue = lintComparisonPositioning(vague)[0];
    expect(issue.rule).toBe("positioning");
    expect(issue.message).toMatch(/alternative/);
    expect(issue.message).toMatch(/best-fit segment/);
    const sharp = [{ name: "Comparison page", assetUsed: "https://x.com/compare", hook: "Unlike Google Analytics, no cookie banner", audience: "for small EU shops worried about consent" }];
    expect(lintComparisonPositioning(sharp)).toEqual([]);
  });
  it("ignores plays that aren't comparison pages", () => {
    expect(lintComparisonPositioning([{ name: "Referral", mechanic: "Invite link after first invoice" }])).toEqual([]);
  });
});

describe("lens 3: offer claims", () => {
  it("blocks a guarantee the owner hasn't confirmed", () => {
    const plays = [{ name: "Offer", hook: "30-day money-back guarantee, risk-free" }];
    expect(lintOfferClaims(plays, "Pricing: $9/month. No refund policy stated.").map((i) => i.rule)).toEqual(["offer_claim"]);
    expect(lintOfferClaims(plays, "Owner fact: we offer a 30-day money-back guarantee.")).toEqual([]);
  });
});

describe("lens 4: stage metrics", () => {
  it("rejects vanity numbers as the North Star", () => {
    expect(lintStageMetric([{ text: "Monthly website visitors", path: "northStar.metric" }]).map((i) => i.rule)).toEqual(["vanity_metric"]);
    expect(lintStageMetric([{ text: "New paying customers a month", path: "northStar.metric" }])).toEqual([]);
    expect(lintStageMetric([{ text: "Trial sign-ups from 2,000 visits", path: "northStar.metric" }])).toEqual([]);
  });
});

describe("lens 5: word of mouth", () => {
  it("needs a trigger and a share mechanism", () => {
    const bare = [{ name: "Referrals", mechanic: "Ask customers to refer friends", trigger: "Customers like us" }];
    expect(lintReferralDrivers(bare)[0].message).toMatch(/trigger.*share mechanism|share mechanism/);
    const built = [{ name: "Referrals", mechanic: "Invite link on the screen shown right after the first invoice is paid", trigger: "After a client pays their first invoice" }];
    expect(lintReferralDrivers(built)).toEqual([]);
  });
});
