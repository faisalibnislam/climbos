import { describe, expect, it } from "vitest";
import { lintOfferAssessment, type OfferAssessmentContext } from "../../shared/agents/offerAssessment";
import { factEvidenceBasis, referenceEvidenceBasis } from "../../shared/agents/evidenceKind";
import { lintCampaignTiming } from "../../shared/agents/campaignTiming";
import { offerAssessmentFixture, offerContext } from "../fixtures/offerAssessment";
import { campaignTimingFixture, timingContextFixture } from "../fixtures/campaignTiming";

describe("offer and timing source classifications", () => {
  const context = { ...offerContext, factEvidenceBases: ["owner_reported" as const] };
  const check = (offer = offerAssessmentFixture(), input: OfferAssessmentContext = context) => lintOfferAssessment(offer, { name: "Test an introductory discount", actionContract: { diagnosis: offer.diagnosis } }, input, "offer");
  it("uses recorded provenance independently of wording signals", () => {
    expect(factEvidenceBasis("owner_supplied")).toBe("owner_reported");
    expect(factEvidenceBasis("researched")).toBe("source_reported");
    expect(factEvidenceBasis("demo_fixture")).toBe("unknown");
    expect(referenceEvidenceBasis("fact:2", ["measured"], [])).toBe("unknown");
  });
  it("accepts accurate owner, source and explicitly trusted measured labels without changing amounts", () => {
    expect(check()).toEqual([]);
    const offer = offerAssessmentFixture(), claim = offer.current.netPrice.claim, url = "https://source.example/pricing";
    offer.current.netPrice = { ...offer.current.netPrice, basis: "source_reported", reference: url };
    expect(check(offer, { ...context, researchNotes: claim, sourceUrls: [url] })).toEqual([]);
    offer.current.netPrice = { ...offer.current.netPrice, basis: "measured", reference: "fact:1" };
    expect(check(offer, { ...context, facts: [...context.facts, claim], factEvidenceBases: ["owner_reported", "measured"] })).toEqual([]);
    offer.risks[4].status = "source_reported"; offer.risks[4].evidenceRef = url;
    expect(check(offer, { ...context, facts: [...context.facts, claim], factEvidenceBases: ["owner_reported", "measured"], researchNotes: offer.risks[4].evidenceClaim, sourceUrls: [url] })).toEqual([]);
  });
  it.each(["decision", "price", "risk", "history"])("rejects an owner report mislabeled measured in %s", field => {
    const offer = offerAssessmentFixture();
    if (field === "decision") offer.evidenceBasis = "measured";
    if (field === "price") offer.current.netPrice.basis = "measured";
    if (field === "risk") offer.risks[4].status = "measured";
    if (field === "history") offer.promotionHistory = { ...offer.promotionHistory!, status: "measured", reference: "fact:0", claim: context.facts[0], period: "Owner reports the last month" };
    expect(check(offer)).toContainEqual(expect.objectContaining({ severity: "error", message: expect.stringMatching(/evidence basis/i) }));
  });
  it("does not use an unrelated owner reference to relabel a source claim as owner evidence", () => {
    const offer = offerAssessmentFixture(), url = "https://source.example/report";
    offer.evidenceRefs = ["fact:1", url];
    expect(check(offer, { ...context, facts: ["Unrelated", "Owner confirms the business name."], factEvidenceBases: ["owner_reported", "owner_reported"], researchNotes: context.facts[0], sourceUrls: [url] })).toContainEqual(expect.objectContaining({ path: "offer.evidenceBasis" }));
  });
  it("does not infer measurement provenance from a citation or missing metadata", () => {
    const offer = offerAssessmentFixture(); offer.current.netPrice.basis = "measured";
    expect(check(offer, { ...context, factEvidenceBases: [] })).toContainEqual(expect.objectContaining({ path: "offer.current.netPrice.basis" }));
  });
  it("keeps owner-supplied event dates owner-reported even if their text mentions analytics", () => {
    const timing = structuredClone(campaignTimingFixture), claim = "Owner analytics calendar reports the event on November 27, 2026.";
    timing.moment.evidence = [{ basis: "measured", reference: "fact:2", sourceUrl: null, publishedDate: null, eventDate: "2026-11-27", claim }];
    const context = { ...timingContextFixture(), facts: [...timingContextFixture().facts, claim], factEvidenceBases: ["owner_reported", "owner_reported", "owner_reported"] as const };
    expect(lintCampaignTiming(timing, context)).toContainEqual(expect.objectContaining({ path: "timingAssessment.moment.evidence[0].basis" }));
    timing.moment.evidence[0].basis = "owner_reported";
    expect(lintCampaignTiming(timing, context)).toEqual([]);
  });
});
