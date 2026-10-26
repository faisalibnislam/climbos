import { describe, expect, it } from "vitest";
import { lintClaims } from "../../shared/agents/lint";

const rules = (text: string, evidence = "") => lintClaims([{ path: "body", text }], evidence).map((i) => i.rule);

describe("offer disclosure and buyer-relied claims", () => {
  it("needs evidence for a reference price, star rating, no-hidden-fees or cancel-anytime promise", () => {
    expect(rules("Was $120, now $90 this week.")).toContain("unsupported_claim");
    expect(rules("Rated 4.9 stars by local families.")).toContain("unsupported_claim");
    expect(rules("Simple pricing with no hidden fees.")).toContain("unsupported_claim");
    expect(rules("Monthly plan, cancel anytime.")).toContain("unsupported_claim");
  });

  it("accepts them when a confirmed fact matches", () => {
    expect(rules("Was $120, now $90 this week.", "Our standard price for this service was $120 until October.")).toEqual([]);
    expect(rules("Rated 4.9 stars on Google.", "Our Google Business Profile shows a 4.9 average from 212 reviews.")).toEqual([]);
    expect(rules("Monthly plan, cancel anytime.", "Members can cancel at any time from their account.")).toEqual([]);
  });

  it("requires a free trial to say what happens when it ends", () => {
    expect(rules("Start your free trial today.")).toContain("trial_terms");
    expect(rules("Start a 14-day free trial, then $29 a month. Cancel before it ends and you won't be charged.", "Members can cancel at any time.")).not.toContain("trial_terms");
    expect(rules("Try it free for 7 days. No card needed.")).not.toContain("trial_terms");
  });
});

import { lintPersuasion, type OfferAssessment } from "../../shared/agents/offerAssessment";

describe("persuasion mechanisms on offers", () => {
  const base = { recommendation: "recommend_promotion", mechanism: "trial", persuasion: [] } as unknown as OfferAssessment;
  const entry = (o: Partial<NonNullable<OfferAssessment["persuasion"]>[number]>) => ({ mechanism: "free_trial", use: "14 days free", legalStatus: "needs_disclosure", evidenceNeeded: "", lowerRiskAlternative: "A paid first month with a refund window", ...o }) as NonNullable<OfferAssessment["persuasion"]>[number];
  const rules = (a: OfferAssessment) => lintPersuasion(a, "plays[0].offerAssessment").map((i) => `${i.severity}:${i.path}`);

  it("requires a trial offer to list its trial with disclosure", () => {
    expect(rules(base)).toEqual(["error:plays[0].offerAssessment.persuasion"]);
    expect(rules({ ...base, persuasion: [entry({})] })).toEqual([]);
    expect(rules({ ...base, persuasion: [entry({ legalStatus: "generally_permitted" })] })).toEqual(["error:plays[0].offerAssessment.persuasion[0].legalStatus"]);
  });

  it("treats proof, anchoring, scarcity and urgency as lawful only when true, with evidence named", () => {
    const issues = rules({ ...base, mechanism: "discount", persuasion: [entry({ mechanism: "anchoring", legalStatus: "generally_permitted" })] });
    expect(issues).toEqual(["error:plays[0].offerAssessment.persuasion[0].legalStatus", "error:plays[0].offerAssessment.persuasion[0].evidenceNeeded"]);
  });

  it("warns, rather than assumes, when the legal posture is unknown", () => {
    expect(rules({ ...base, mechanism: "discount", persuasion: [entry({ mechanism: "decoy", legalStatus: "unknown" })] })).toEqual(["warn:plays[0].offerAssessment.persuasion[0].legalStatus"]);
  });
});
