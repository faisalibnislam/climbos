import { describe, expect, it } from "vitest";
import { evidenceKind, lintEvidenceStrength } from "../../shared/agents/evidenceKind";
import { lintPlatformEligibility, platformNotes } from "../../shared/acquisition/platformRules";
import { factsBlock, staleFactsBlock } from "../../shared/ai/tasks";

/** Slices 6 and 9: evidence strength in code (EV02, EV10, EV18, EV27, EV31); platform rules for planning (EV05). */
describe("evidence kind", () => {
  it("classifies facts by what they show", () => {
    expect(evidenceKind("Pro plan costs $19/month", "researched")).toBe("published");
    expect(evidenceKind("Everyone says they love the idea", "owner_supplied")).toBe("stated");
    expect(evidenceKind("Three customers said they would pay $40", "owner_supplied")).toBe("stated");
    expect(evidenceKind("Five firms paid a $200 deposit", "owner_supplied")).toBe("commitment");
    expect(evidenceKind("Stripe shows 4% monthly churn", "owner_supplied")).toBe("measured");
    expect(evidenceKind("100 trial signups last month", "owner_supplied")).toBe("behavior");
    expect(evidenceKind("We have two people on the team", "owner_supplied")).toBe("owner");
  });
  it("labels the kind in the facts the writer sees", () => {
    expect(factsBlock([{ statement: "Everyone loves it", category: "proof", kind: "stated opinion" }])).toMatch(/\[0\] \(proof; stated opinion\) Everyone loves it/);
  });
  it("marks old facts for review without treating age as proof they are wrong", () => {
    expect(factsBlock([{ statement: "Pro costs $20 per month", category: "pricing", freshness: { daysOld: 61, reviewSuggested: true } }])).toContain("review suggested, 61 days since last update");
    expect(factsBlock([{ statement: "Pro costs $20 per month", category: "pricing", freshness: { daysOld: 10, reviewSuggested: false } }])).toMatch(/\[0\] \(pricing\) Pro costs/);
  });
  it("keeps stale facts out of the current fact index and labels their accuracy unknown", () => {
    const stale = staleFactsBlock([{ statement: "Pro costs $20 per month", category: "pricing", freshness: { daysOld: 61 } }]);
    expect(stale).toContain("present accuracy is unknown");
    expect(stale).toMatch(/do not cite them as current facts/i);
    expect(stale).toContain("<untrusted_content source=\"stale business facts\">");
    expect(factsBlock([])).not.toContain("$20");
  });
  it("blocks proof-of-demand language when only opinions and site claims exist", () => {
    const f = [{ path: "summary", text: "Demand is proven: customers love the idea." }];
    expect(lintEvidenceStrength(f, ["stated", "published"])).toMatchObject([{ rule: "evidence_strength", path: "summary" }]);
    expect(lintEvidenceStrength(f, ["stated", "commitment"])).toEqual([]);
    expect(lintEvidenceStrength([{ path: "summary", text: "Test a paid pilot with five firms." }], ["stated"])).toEqual([]);
  });
});

describe("platform rules", () => {
  it("adds the Mac note only for Mac apps, and the general notes for everyone", () => {
    expect(platformNotes(["desktop_app"])).toMatch(/iOS\/iPadOS/);
    expect(platformNotes(["b2b_saas"])).not.toMatch(/iOS\/iPadOS/);
    expect(platformNotes(["b2b_saas"])).toMatch(/never promise a position/);
  });
  it("fails App Store product page tests for a Mac app (EV05)", () => {
    expect(lintPlatformEligibility([{ path: "experiments[0]", text: "Run an App Store product page optimization test on screenshots" }], ["desktop_app"])).toMatchObject([{ rule: "platform_eligibility" }]);
    expect(lintPlatformEligibility([{ path: "experiments[0]", text: "Run an App Store product page optimization test" }], ["mobile_app", "desktop_app"])).toEqual([]);
    expect(lintPlatformEligibility([{ path: "experiments[0]", text: "Before/after on the Mac App Store listing" }], ["desktop_app"])).toEqual([]);
  });
});
