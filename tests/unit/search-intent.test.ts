import { describe, expect, it } from "vitest";
import { inferSearchIntentStage } from "../../shared/agents/searchIntent";
import { lintSearchIntent, lintSeoEvidence, lintSeoRecommendation, SeoBriefV2Schema } from "../../shared/agents/specs";

describe("search intent stage", () => {
  it("distinguishes research, evaluation, and ready-to-buy queries", () => {
    expect(inferSearchIntentStage("how to manage customer appointments", "other")).toBe("awareness");
    expect(inferSearchIntentStage("best appointment scheduling software comparison", "other")).toBe("evaluation");
    expect(inferSearchIntentStage("appointment scheduling software pricing and free trial", "other")).toBe("purchase");
  });

  it("uses page type only as a fallback and preserves ambiguity", () => {
    expect(inferSearchIntentStage("appointment scheduling", "alternatives")).toBe("evaluation");
    expect(inferSearchIntentStage("something", "other")).toBe("unclear");
  });

  it("rejects an SEO brief whose declared stage conflicts with its query evidence", () => {
    const base = {
      title: "Pricing",
      metaDescription: "Compare plans",
      primaryKeyword: "appointment scheduling pricing",
      secondaryKeywords: [],
      searchIntent: "Compare scheduling pricing and start a free trial",
      outline: [],
      internalLinks: ["https://example.com/pricing"],
      draft: "",
      factIndexes: [],
      pageType: "pricing",
      intentStage: "awareness",
      intentEvidence: "The query asks for pricing and a trial.",
      eeatSignals: [],
      answerFirst: "Compare the plans before you start a trial.",
      faqs: [],
      citableClaims: [],
      originalContribution: "Use real customer questions and verified plan details.",
      originalContributionEvidence: { status: "hypothesis_pending_owner_evidence", factIndexes: [], sourceUrls: [] },
      ownerEvidenceNeeded: [],
      measurementPlan: "Review page clicks and qualified inquiries if analytics are connected.",
      recommendedAction: "create_new_page",
      targetPageUrl: "",
      recommendationReason: "No matching page was observed.",
    };
    expect(lintSearchIntent(SeoBriefV2Schema.parse(base))).toMatchObject([{ rule: "search_intent", path: "intentStage" }]);
    expect(lintSearchIntent(SeoBriefV2Schema.parse({ ...base, intentStage: "purchase" }))).toEqual([]);
  });

  it("requires citable claims to resolve to run facts or sources actually read", () => {
    const out = SeoBriefV2Schema.parse({
      title: "Pricing",
      metaDescription: "Compare plans",
      primaryKeyword: "appointment scheduling pricing",
      secondaryKeywords: [],
      searchIntent: "pricing",
      outline: [],
      internalLinks: ["https://example.com/pricing"],
      draft: "",
      factIndexes: [],
      pageType: "pricing",
      intentStage: "purchase",
      intentEvidence: "pricing query",
      eeatSignals: [],
      answerFirst: "Plans vary by team size.",
      faqs: [{ question: "How much does it cost?", answer: "See the current pricing page.", factIndexes: [], sourceUrls: ["https://example.com/pricing"] }],
      citableClaims: [{ statement: "The plan includes appointment reminders.", factIndexes: [2], sourceUrls: ["https://example.com/unread"] }],
      originalContribution: "Use verified plan details and customer questions to answer pricing clearly.",
      originalContributionEvidence: { status: "evidence_linked", factIndexes: [0], sourceUrls: ["https://example.com/pricing"] },
      ownerEvidenceNeeded: ["Confirm which plans include appointment reminders."],
      measurementPlan: "Compare clicks and qualified leads with the connected pre-publication baseline.",
      recommendedAction: "refresh_existing_page",
      targetPageUrl: "https://example.com/pricing",
      recommendationReason: "The existing pricing page serves the same purchase intent.",
    });
    const input = { task: "SEO", brief: "", facts: ["Owner confirmed plans are monthly."], businessWebsite: "https://www.example.com", availableSourceUrls: ["https://example.com/pricing"] };
    expect(lintSeoEvidence(out, input)).toMatchObject([
      { rule: "fact_reference", path: "citableClaims[0].factIndexes" },
      { rule: "citation", path: "citableClaims[0].sourceUrls" },
    ]);
    const valid = SeoBriefV2Schema.parse({ ...out, citableClaims: [{ ...out.citableClaims[0], factIndexes: [0], sourceUrls: ["https://example.com/pricing"] }] });
    expect(lintSeoEvidence(valid, input)).toEqual([]);
    expect(lintSeoRecommendation(valid, input)).toEqual([]);
    const generalFaq = { question: "How do plans work?", factIndexes: [], sourceUrls: [] };
    expect(lintSeoEvidence(SeoBriefV2Schema.parse({ ...valid, faqs: [{ ...generalFaq, answer: "Plans start at $49 a month and are trusted by thousands of clinics." }] }), input).map((i) => `${i.rule}@${i.path}`)).toEqual(["faq_grounding@faqs[0].answer", "faq_grounding@faqs[0].answer"]);
    expect(lintSeoEvidence(SeoBriefV2Schema.parse({ ...valid, faqs: [{ ...generalFaq, answer: "Check the plan details and ask us what fits your team." }] }), input)).toEqual([]);
    const overlap = SeoBriefV2Schema.parse({ ...valid, recommendedAction: "create_new_page", targetPageUrl: "" });
    expect(lintSeoRecommendation(overlap, { ...input, observedSitePages: [{ url: "https://example.com/pricing", title: "Appointment scheduling pricing" }] })).toMatchObject([
      { severity: "warn", rule: "seo_topic_overlap", path: "recommendedAction" },
    ]);
    const unsafeLinks = SeoBriefV2Schema.parse({ ...valid, internalLinks: ["https://other.example/pricing", "https://example.com/unread"] });
    expect(lintSeoEvidence(unsafeLinks, input)).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: "citation", path: "internalLinks[1]" }),
      expect.objectContaining({ rule: "seo_internal_link", path: "internalLinks[0]" }),
    ]));
    const inventedTarget = SeoBriefV2Schema.parse({ ...valid, targetPageUrl: "https://example.com/unknown" });
    expect(lintSeoRecommendation(inventedTarget, input)).toMatchObject([{ rule: "citation", path: "targetPageUrl" }]);
    const missingTarget = SeoBriefV2Schema.parse({ ...valid, targetPageUrl: "" });
    expect(lintSeoRecommendation(missingTarget, input)).toMatchObject([{ rule: "seo_recommendation", path: "targetPageUrl" }]);
  });

  it("requires contribution evidence links to resolve or remain an explicit owner-evidence hypothesis", () => {
    const base = SeoBriefV2Schema.parse({
      title: "Pricing", metaDescription: "Compare plans", primaryKeyword: "appointment scheduling pricing",
      secondaryKeywords: [], searchIntent: "pricing", outline: [], internalLinks: [], draft: "",
      factIndexes: [], pageType: "pricing", intentStage: "purchase", intentEvidence: "pricing query",
      eeatSignals: [], answerFirst: "Plans vary by team size.", faqs: [], citableClaims: [],
      originalContribution: "Explain how the service handles plan selection.",
      originalContributionEvidence: { status: "evidence_linked", factIndexes: [0], sourceUrls: ["https://example.com/pricing"] },
      ownerEvidenceNeeded: [], measurementPlan: "Review qualified page outcomes after publication.",
      recommendedAction: "create_new_page", targetPageUrl: "", recommendationReason: "No page observed.",
    });
    const input = { task: "SEO", brief: "", facts: ["Owner reported a plan selection flow."], businessWebsite: "https://www.example.com", availableSourceUrls: ["https://example.com/pricing"] };
    expect(lintSeoEvidence(base, input)).toEqual([]);
    expect(lintSeoEvidence(SeoBriefV2Schema.parse({ ...base, originalContributionEvidence: { status: "evidence_linked", factIndexes: [], sourceUrls: [] } }), input)).toMatchObject([
      { rule: "seo_original_contribution", path: "originalContributionEvidence" },
    ]);
    expect(lintSeoEvidence(SeoBriefV2Schema.parse({ ...base, originalContributionEvidence: { status: "evidence_linked", factIndexes: [4], sourceUrls: ["https://example.com/unread"] } }), input)).toMatchObject([
      { rule: "fact_reference", path: "originalContributionEvidence.factIndexes" },
      { rule: "citation", path: "originalContributionEvidence.sourceUrls" },
    ]);
    const hypothesis = SeoBriefV2Schema.parse({ ...base, originalContributionEvidence: { status: "hypothesis_pending_owner_evidence", factIndexes: [], sourceUrls: [] }, ownerEvidenceNeeded: ["Provide a reviewed customer example."] });
    expect(lintSeoEvidence(hypothesis, input)).toEqual([]);
    expect(lintSeoEvidence(SeoBriefV2Schema.parse({ ...hypothesis, ownerEvidenceNeeded: [] }), input)).toMatchObject([
      { rule: "seo_original_contribution", path: "ownerEvidenceNeeded" },
    ]);
  });
});

import { brandSiteCitations } from "../../shared/aiSearch/visibility";

describe("AI answer citations of the business's own site", () => {
  it("marks each cited URL as the business's own site or not", () => {
    expect(brandSiteCitations(["https://www.example.com/pricing", "https://blog.example.com/a", "https://notexample.com/", "https://rival.io/"], "https://example.com")).toEqual([
      { url: "https://www.example.com/pricing", ownSite: true },
      { url: "https://blog.example.com/a", ownSite: true },
      { url: "https://notexample.com/", ownSite: false },
      { url: "https://rival.io/", ownSite: false },
    ]);
    expect(brandSiteCitations(["https://example.com/"], null)).toEqual([{ url: "https://example.com/", ownSite: false }]);
  });
});
