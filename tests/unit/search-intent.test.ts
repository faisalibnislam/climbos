import { describe, expect, it } from "vitest";
import { inferSearchIntentStage } from "../../shared/agents/searchIntent";
import { lintSearchIntent, SeoBriefV2Schema } from "../../shared/agents/specs";

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
    };
    expect(lintSearchIntent(SeoBriefV2Schema.parse(base))).toMatchObject([{ rule: "search_intent", path: "intentStage" }]);
    expect(lintSearchIntent(SeoBriefV2Schema.parse({ ...base, intentStage: "purchase" }))).toEqual([]);
  });
});
