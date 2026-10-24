import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import { setup, asNewUser } from "./helpers";

describe("AI search visibility observations", () => {
  it("stores tenant-owned observations and reports sampled mention/citation rates separately", async () => {
    const t = setup();
    const owner = await asNewUser(t, "ai-search-owner@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Example Co" });
    const business = await t.run((ctx) => ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", orgId)).first());
    if (!business) throw new Error("Business was not created");
    await t.run((ctx) => ctx.db.patch(business._id, { website: "https://example.com" }));
    const checkedAt = Date.now() - 60_000;

    await owner.client.mutation(api.aiSearchVisibility.recordObservation, {
      slug,
      provider: "chatgpt",
      query: "best invoicing tool for freelancers",
      checkedAt,
      answerStatus: "answered",
      brandMention: "yes",
      sentiment: "positive",
      citedUrls: ["https://docs.example.com/guide"],
      competitorMentions: ["Rival Co", "Rival Co"],
      answerExcerpt: "Example Co is a useful option for freelancers. [source]",
    });
    await owner.client.mutation(api.aiSearchVisibility.recordObservation, {
      slug,
      provider: "chatgpt",
      query: "best invoicing tool for freelancers",
      checkedAt: checkedAt + 1,
      answerStatus: "answered",
      brandMention: "no",
      sentiment: "unknown",
      citedUrls: ["https://review.example/rival"],
      competitorMentions: ["Rival Co"],
      answerExcerpt: "The answer recommends Rival Co.",
    });
    await owner.client.mutation(api.aiSearchVisibility.recordObservation, {
      slug,
      provider: "gemini",
      query: "best invoicing tool for freelancers",
      checkedAt: checkedAt + 2,
      answerStatus: "no_answer",
      brandMention: "unknown",
      sentiment: "unknown",
      citedUrls: [],
      competitorMentions: [],
    });

    const report = await owner.client.query(api.aiSearchVisibility.report, { slug, days: 90 });
    expect(report.observationCount).toBe(3);
    expect(report.summary).toHaveLength(2);
    expect(report.panelSummary).toMatchObject({
      observations: 3,
      answered: 2,
      noAnswer: 1,
      queryCount: 2,
      businessMentionAnswers: 1,
      competitorMentionEvents: 2,
      businessShareAmongAnswersWithKnownBrandOrCompetitorMention: { successes: 1, trials: 2, rate: 0.5 },
    });
    expect(report.summary[0]).toMatchObject({
      provider: "chatgpt",
      samples: { answered: 2, noAnswer: 0, failed: 0 },
      brandMentions: { successes: 1, trials: 2, rate: 0.5 },
      firstPartyCitations: { successes: 1, trials: 2, rate: 0.5 },
      competitors: [{ name: "Rival Co", answers: 2 }],
      evidenceBasis: "owner_observed",
    });
    expect(report.summary.find((item) => item.provider === "gemini")?.samples).toEqual({ answered: 0, noAnswer: 1, failed: 0 });
    expect(report.interpretation.join(" ")).toMatch(/owner-recorded samples only/);

    const other = await asNewUser(t, "ai-search-other@example.com");
    await other.client.mutation(api.orgs.createWorkspace, { businessName: "Other Co" });
    await expect(other.client.query(api.aiSearchVisibility.report, { slug })).rejects.toThrow();
  });

  it("rejects invalid citations, unsupported sentiment, future dates, and claims on failed checks", async () => {
    const t = setup();
    const owner = await asNewUser(t, "ai-search-validation@example.com");
    const { slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Example Co" });
    const base = {
      slug,
      provider: "perplexity" as const,
      query: "best invoicing tool for freelancers",
      checkedAt: Date.now() - 1_000,
      answerStatus: "answered" as const,
      brandMention: "no" as const,
      sentiment: "unknown" as const,
      citedUrls: [] as string[],
      competitorMentions: [] as string[],
      answerExcerpt: "No mention in the answer.",
    };
    await expect(owner.client.mutation(api.aiSearchVisibility.recordObservation, { ...base, citedUrls: ["javascript:alert(1)"] })).rejects.toThrow(/HTTP or HTTPS/);
    await expect(owner.client.mutation(api.aiSearchVisibility.recordObservation, { ...base, sentiment: "positive" })).rejects.toThrow(/Only label sentiment/);
    await expect(owner.client.mutation(api.aiSearchVisibility.recordObservation, { ...base, checkedAt: Date.now() + 60_000 })).rejects.toThrow(/future/);
    await expect(owner.client.mutation(api.aiSearchVisibility.recordObservation, {
      ...base,
      answerStatus: "failed",
      brandMention: "yes",
      sentiment: "positive",
      answerExcerpt: undefined,
    })).rejects.toThrow(/failed or empty response/);
  });
});
