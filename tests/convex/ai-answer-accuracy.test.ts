import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";

describe("AI answer accuracy", () => {
  it("records an owner-quoted incorrect claim with the correct fact, and summarizes errors per provider", async () => {
    const t = setup();
    const owner = await asNewUser(t, "accuracy-owner@example.com");
    const { slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Accuracy Co" });
    const base = { slug, provider: "chatgpt" as const, query: "bakery open sunday near me", checkedAt: Date.now() - 60_000, answerStatus: "answered" as const, brandMention: "yes" as const, sentiment: "neutral" as const, citedUrls: [], competitorMentions: [], answerExcerpt: "Accuracy Co is a bakery that is open on Sundays from 8am." };

    await expect(owner.client.mutation(api.aiSearchVisibility.recordObservation, { ...base, accuracy: "contains_error" })).rejects.toThrow(/Quote the incorrect part/);
    await expect(owner.client.mutation(api.aiSearchVisibility.recordObservation, { ...base, accuracy: "contains_error", incorrectClaim: "open every day", correctFact: "Closed on Sundays." })).rejects.toThrow(/copied from the answer excerpt/);
    await expect(owner.client.mutation(api.aiSearchVisibility.recordObservation, { ...base, brandMention: "no", sentiment: "unknown", accuracy: "accurate" })).rejects.toThrow(/mentions the business/);
    await expect(owner.client.mutation(api.aiSearchVisibility.recordObservation, { ...base, accuracy: "accurate", incorrectClaim: "open on Sundays", correctFact: "Closed." })).rejects.toThrow(/only when the answer contains an error/);

    await owner.client.mutation(api.aiSearchVisibility.recordObservation, { ...base, accuracy: "contains_error", incorrectClaim: "open on  Sundays", correctFact: "Closed on Sundays." });
    await owner.client.mutation(api.aiSearchVisibility.recordObservation, { ...base, checkedAt: base.checkedAt + 1, accuracy: "accurate" });
    await owner.client.mutation(api.aiSearchVisibility.recordObservation, { ...base, checkedAt: base.checkedAt + 2 });

    const report = await owner.client.query(api.aiSearchVisibility.report, { slug });
    expect(report.accuracy.byProvider).toEqual([{ provider: "chatgpt", checked: 2, withErrors: 1 }]);
    expect(report.accuracy.recentErrors).toEqual([{ provider: "chatgpt", query: "bakery open sunday near me", checkedAt: base.checkedAt, incorrectClaim: "open on Sundays", correctFact: "Closed on Sundays." }]);
  });
});
