import { describe, expect, it } from "vitest";
import { inferSearchIntentStage } from "../../shared/agents/searchIntent";
import { lintSearchIntent, lintSeoEvidence, SeoBriefV2Schema } from "../../shared/agents/specs";

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
      internalLinks: [],
      draft: "",
      factIndexes: [],
      pageType: "pricing",
      intentStage: "awareness",
      intentEvidence: "The query asks for pricing and a trial.",
      eeatSignals: [],
      answerFirst: "Compare the plans before you start a trial.",
      faqs: [],
      citableClaims: [],
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
      internalLinks: [],
      draft: "",
      factIndexes: [],
      pageType: "pricing",
      intentStage: "purchase",
      intentEvidence: "pricing query",
      eeatSignals: [],
      answerFirst: "Plans vary by team size.",
      faqs: [{ question: "How much does it cost?", answer: "See the current pricing page.", factIndexes: [], sourceUrls: ["https://example.com/pricing"] }],
      citableClaims: [{ statement: "The plan includes appointment reminders.", factIndexes: [2], sourceUrls: ["https://example.com/unread"] }],
    });
    const input = { task: "SEO", brief: "", facts: ["Owner confirmed plans are monthly."], availableSourceUrls: ["https://example.com/pricing"] };
    expect(lintSeoEvidence(out, input)).toMatchObject([
      { rule: "fact_reference", path: "citableClaims[0].factIndexes" },
      { rule: "citation", path: "citableClaims[0].sourceUrls" },
    ]);
    const valid = SeoBriefV2Schema.parse({ ...out, citableClaims: [{ ...out.citableClaims[0], factIndexes: [0], sourceUrls: ["https://example.com/pricing"] }] });
    expect(lintSeoEvidence(valid, input)).toEqual([]);
  });
});
