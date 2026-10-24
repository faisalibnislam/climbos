import { describe, expect, it } from "vitest";
import { lintClaims, lintCopy } from "../../shared/agents/lint";
import { lintBorrowedUplift, verifiedCapabilityEvidence } from "../../shared/agents/specs";
import type { EvidenceKind } from "../../shared/agents/evidenceKind";

/** Slices 5 and 10: claims need support; other businesses' results are hypotheses, not forecasts (EV04, EV07, EV11, EV23, EV30). */
describe("claim ledger", () => {
  it("flags unsupported capability, scale and leadership claims", () => {
    const f = (text: string) => lintClaims([{ path: "hook", text }], "Formkit builds forms with logic and payments.");
    expect(f("10x faster for everyone")).toMatchObject([{ rule: "unsupported_claim" }]);
    expect(f("24/7 support for your team")).toMatchObject([{ rule: "unsupported_claim" }]);
    expect(f("The leading platform for all businesses")).toMatchObject([{ rule: "unsupported_claim" }]);
    expect(f("Trusted by thousands of teams")).toMatchObject([{ rule: "unsupported_claim" }]);
    expect(f("Award-winning form builder")).toMatchObject([{ rule: "unsupported_claim" }]);
    expect(f("Fully automated matching")).toMatchObject([{ rule: "unsupported_claim" }]);
  });
  it("passes claims the facts support, and plain capability statements", () => {
    expect(lintClaims([{ path: "hook", text: "Support 24/7 by chat" }], "FACT: live chat support 24/7")).toEqual([]);
    expect(lintClaims([{ path: "hook", text: "3x faster checkout" }], "Case study on our site: checkout 3x faster after redesign")).toEqual([]);
    expect(lintClaims([{ path: "hook", text: "Build a payment form in minutes" }], "")).toEqual([]);
  });
  it("applies to all publishable copy", () => {
    expect(lintCopy({ body: "The #1 platform for florists" }, { evidence: "", publishable: true }).some((i) => i.rule === "unsupported_claim")).toBe(true);
    expect(lintCopy({ body: "The #1 platform for florists" }, { evidence: "" }).some((i) => i.rule === "unsupported_claim")).toBe(false);
  });
  it("does not let website promises or stated opinions verify marketing claims", () => {
    const input = {
      task: "Write marketing copy",
      brief: "The site claims 24/7 chat support.",
      facts: ["The site claims 24/7 chat support", "Customers said they would use chat support", "Owner confirmed live chat support 24/7"],
      constraints: { factKinds: ["published", "stated", "owner"] as EvidenceKind[] },
    };
    const verified = verifiedCapabilityEvidence(input);
    expect(verified).toBe("Owner confirmed live chat support 24/7");
    expect(lintCopy({ body: "Support 24/7 by chat" }, { evidence: input.brief, claimEvidence: "", publishable: true })).toMatchObject([{ rule: "unsupported_claim" }]);
    expect(lintCopy({ body: "Support 24/7 by chat" }, { evidence: input.brief, claimEvidence: verified, publishable: true })).toEqual([]);
  });
  it("requires confirmed evidence for named product integrations", () => {
    const check = (evidence: string) => lintClaims([{ path: "body", text: "Connects directly to Slack" }], evidence);
    expect(check("The homepage mentions Slack and our team uses it internally.")).toMatchObject([{ rule: "unsupported_capability" }]);
    expect(check("Owner confirmed: Slack integration connects ClimbOS to the workspace.")).toEqual([]);
  });
});

describe("borrowed uplift", () => {
  it("fails a funnel rate taken from another company's reported lift", () => {
    const plays = [{ name: "Exit popup", model: { steps: [{ name: "convert", source: "research", quote: "Acme increased conversions by 30% with an exit popup" }] } }];
    expect(lintBorrowedUplift(plays)).toMatchObject([{ rule: "borrowed_uplift", path: "plays[0].model.steps[0]" }]);
  });
  it("allows base rates and labelled assumptions", () => {
    const plays = [{ name: "SEO", model: { steps: [{ name: "click", source: "benchmark", quote: "Typical organic CTR for position 3 is 10%" }, { name: "pay", source: "assumption", quote: "" }] } }];
    expect(lintBorrowedUplift(plays)).toEqual([]);
  });
  it("fails plan prose that promises a case study's result", () => {
    expect(lintBorrowedUplift([], [{ path: "summary", text: "Do what Calendly did: like Calendly, who saw 40% more signups." }])).toMatchObject([{ rule: "borrowed_uplift", path: "summary" }]);
    expect(lintBorrowedUplift([], [{ path: "summary", text: "Test a referral prompt after first booking." }])).toEqual([]);
  });
});
