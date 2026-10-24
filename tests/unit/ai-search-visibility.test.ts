import { describe, expect, it } from "vitest";
import { compareAiSearchObservationPeriods, observedRate, summarizeAiSearchPanel, summarizeAiSearchVisibility, wilsonInterval, type AiSearchObservation } from "../../shared/aiSearch/visibility";

const row = (overrides: Partial<AiSearchObservation> = {}): AiSearchObservation => ({
  provider: "chatgpt",
  query: "best invoicing tool for freelancers",
  checkedAt: Date.UTC(2026, 9, 1),
  answerStatus: "answered",
  brandMention: "yes",
  sentiment: "positive",
  citedUrls: ["https://docs.example.com/guide"],
  competitorMentions: ["Rival Co"],
  ...overrides,
});

describe("AI search visibility observations", () => {
  it("uses a bounded Wilson interval and reports no rate without a denominator", () => {
    const interval = wilsonInterval(0, 1);
    expect(interval?.low).toBe(0);
    expect(interval?.high).toBeGreaterThan(0.5);
    expect(observedRate(0, 0)).toEqual({ successes: 0, trials: 0, rate: null, interval95: null, intervalMethod: null });
    expect(wilsonInterval(2, 1)).toBeNull();
  });

  it("groups only matching platform, query, and location and separates mention from first-party citation", () => {
    const rows = summarizeAiSearchVisibility([
      row(),
      row({ query: " Best   invoicing tool for freelancers ", checkedAt: Date.UTC(2026, 9, 8), brandMention: "no", sentiment: "unknown", citedUrls: ["https://review.example/rival"], competitorMentions: ["Rival Co", "Other"] }),
      row({ provider: "gemini", checkedAt: Date.UTC(2026, 9, 4), citedUrls: ["https://example.com/pricing"] }),
      row({ location: "Dhaka" }),
    ], "https://www.example.com");

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      provider: "chatgpt",
      query: "best invoicing tool for freelancers",
      samples: { answered: 2, noAnswer: 0, failed: 0 },
      brandMentions: { successes: 1, trials: 2, rate: 0.5 },
      firstPartyCitations: { successes: 1, trials: 2, rate: 0.5 },
      sentiment: { positive: 1, neutral: 0, negative: 0, mixed: 0, unknown: 0 },
      competitors: [{ name: "Rival Co", answers: 2 }, { name: "Other", answers: 1 }],
      evidenceBasis: "owner_observed",
    });
    expect(rows.some((item) => item.provider === "gemini")).toBe(true);
    expect(rows.some((item) => item.location === "Dhaka")).toBe(true);
  });

  it("keeps failed checks and no-answer results out of mention-rate denominators", () => {
    const rows = summarizeAiSearchVisibility([
      row({ brandMention: "unknown", sentiment: "unknown", citedUrls: ["https://review.example/rival"] }),
      row({ answerStatus: "no_answer", brandMention: "unknown", sentiment: "unknown", citedUrls: [], competitorMentions: [] }),
      row({ answerStatus: "failed", brandMention: "unknown", sentiment: "unknown", citedUrls: [], competitorMentions: [] }),
    ], "https://example.com");

    expect(rows[0]).toMatchObject({
      samples: { answered: 1, noAnswer: 1, failed: 1 },
      brandMentions: { successes: 0, trials: 0, rate: null, interval95: null, intervalMethod: null },
      firstPartyCitations: { successes: 0, trials: 1, rate: 0 },
    });
  });

  it("does not claim citation visibility when the business domain is unknown", () => {
    expect(summarizeAiSearchVisibility([row()])[0].firstPartyCitations).toBeNull();
  });

  it("reports panel-level observed mention share with explicit coverage limits", () => {
    const observations = [
      row(),
      row({ brandMention: "no", sentiment: "unknown", competitorMentions: ["Rival Co", "Other"] }),
      row({ provider: "gemini", answerStatus: "no_answer", brandMention: "unknown", sentiment: "unknown", citedUrls: [], competitorMentions: [] }),
      row({ location: "Dhaka" }),
      row({ answerStatus: "failed", brandMention: "unknown", sentiment: "unknown", citedUrls: [], competitorMentions: [] }),
    ];
    const panel = summarizeAiSearchPanel(observations, "https://example.com");

    expect(panel).toMatchObject({
      observations: 5,
      answered: 3,
      noAnswer: 1,
      failed: 1,
      queryCount: 3,
      businessMentionAnswers: 2,
      competitorMentionEvents: 4,
      answersWithKnownBrandOrCompetitorMention: 3,
      businessShareAmongAnswersWithKnownBrandOrCompetitorMention: { successes: 2, trials: 3, rate: 2 / 3 },
      firstPartyCitationAnswers: 3,
      observedFirstPartyCitationRate: { successes: 3, trials: 3, rate: 1 },
      evidenceBasis: "owner_observed",
    });
    expect(panel.competitorMentionAnswers).toEqual([{ name: "Rival Co", answers: 3 }, { name: "Other", answers: 1 }]);
    expect(panel.limitations.join(" ")).toMatch(/not market share/);
  });

  it("does not calculate mention share when brand mention labeling is unknown", () => {
    const panel = summarizeAiSearchPanel([row({ brandMention: "unknown", sentiment: "unknown" })]);
    expect(panel.competitorMentionEvents).toBe(1);
    expect(panel.answersWithKnownBrandOrCompetitorMention).toBe(0);
    expect(panel.businessShareAmongAnswersWithKnownBrandOrCompetitorMention.rate).toBeNull();
  });

  it("compares only matching observation periods and leaves missing denominators unscored", () => {
    const baseline = [
      row({ checkedAt: Date.UTC(2026, 8, 1), brandMention: "no", sentiment: "unknown", citedUrls: [] }),
      row({ query: "best accounting software", brandMention: "yes" }),
    ];
    const current = [
      row({ checkedAt: Date.UTC(2026, 9, 1), citedUrls: ["https://example.com/pricing"] }),
    ];
    const changes = compareAiSearchObservationPeriods(baseline, current, "https://example.com");
    const invoice = changes.find((item) => item.query === "best invoicing tool for freelancers");
    const accounting = changes.find((item) => item.query === "best accounting software");

    expect(changes).toHaveLength(2);
    expect(invoice).toMatchObject({
      baseline: { brandMentions: { rate: 0 }, firstPartyCitations: { rate: 0 } },
      current: { brandMentions: { rate: 1 }, firstPartyCitations: { rate: 1 } },
      brandMentionRateChange: 1,
      firstPartyCitationRateChange: 1,
    });
    expect(accounting).toMatchObject({
      current: null,
      brandMentionRateChange: null,
      firstPartyCitationRateChange: null,
    });
  });
});
