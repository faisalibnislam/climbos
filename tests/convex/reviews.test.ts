import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { unsubscribeToken } from "../../shared/outbound/sending";
import { asNewUser, makePaid, setup } from "./helpers";

describe("reviews engine", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    process.env.CLIMBOS_FAKE_MAILBOX = "1";
  });
  afterEach(() => {
    vi.useRealTimers();
    delete process.env.CLIMBOS_FAKE_MAILBOX;
  });

  it("holds sensitive public reviews for owner review and blocks AI drafting", async () => {
    const t = setup();
    const owner = await asNewUser(t, "sensitive-review@example.com");
    const { slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Review Co" });
    await owner.client.mutation(api.reviews.addReview, { slug, author: "A customer", text: "I was injured by an unsafe product and will contact my lawyer.", source: "google" });
    const [review] = await owner.client.query(api.inbox.list, { slug, box: "open" });
    expect(review).toMatchObject({ status: "escalated", reviewSafety: { categories: ["legal", "health_safety"] } });
    await expect(owner.client.mutation(api.inbox.draftReply, { slug, id: review.id })).rejects.toThrow(/direct owner review/i);
  });

  it("uses an approved fixed reply for a positive rating-only review without a model run", async () => {
    const t = setup();
    const owner = await asNewUser(t, "rating-only-review@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Review Co" });
    await expect(owner.client.mutation(api.reviews.addReview, { slug, author: "A customer", text: "A review", rating: 4.5, source: "google" })).rejects.toThrow(/whole number from 1 to 5/);
    await expect(owner.client.mutation(api.reviews.addReview, { slug, author: "A customer", text: "A review", source: "google", sourceUrl: "javascript:alert(1)" })).rejects.toThrow(/public https/);
    await owner.client.mutation(api.reviews.addReview, { slug, author: "A customer", text: "", rating: 5, source: "google", sourceUrl: "https://maps.google.com/review/123" });
    let [review] = await owner.client.query(api.inbox.list, { slug, box: "open" });
    expect(review).toMatchObject({ status: "new", reviewRating: 5, text: "★★★★★", reviewSourceUrl: "https://maps.google.com/review/123" });
    await owner.client.mutation(api.inbox.draftReply, { slug, id: review.id });
    [review] = await owner.client.query(api.inbox.list, { slug, box: "open" });
    expect(review).toMatchObject({ status: "suggested", suggestedReply: "Thank you for taking the time to leave a 5-star rating. We appreciate your support." });
    expect(await t.run((ctx) => ctx.db.query("workflowRuns").withIndex("by_org_created", (q) => q.eq("orgId", orgId)).collect())).toHaveLength(0);
    await owner.client.mutation(api.inbox.setStatus, { slug, id: review.id, status: "dismissed" });
    expect(await owner.client.query(api.inbox.list, { slug, box: "done" })).toMatchObject([{ status: "dismissed", finalReply: null }]);
  });

  it("deduplicates pasted reviews by channel and public URL without overwriting owner work", async () => {
    const t = setup();
    const owner = await asNewUser(t, "duplicate-review@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Review Co" });
    const sourceUrl = "https://maps.google.com/review/123";
    await expect(owner.client.mutation(api.reviews.addReview, { slug, author: "A customer", text: "Review", source: "google", sourceUrl: `https://example.com/${"a".repeat(2000)}` })).rejects.toThrow(/public https/);
    const first = await owner.client.mutation(api.reviews.addReview, { slug, author: "A customer", text: "Original review", rating: 3, source: "Google", sourceUrl });
    expect(first.duplicate).toBe(false);
    await t.run(async (ctx) => ctx.db.patch(first.id, { status: "dismissed", finalReply: "Owner follow-up recorded", updatedAt: Date.now() }));

    const repeated = await owner.client.mutation(api.reviews.addReview, { slug, author: "Changed name", text: "Edited review", rating: 5, source: "google", sourceUrl });
    expect(repeated).toEqual({ id: first.id, duplicate: true });
    const reviews = await t.run(async (ctx) => (await ctx.db.query("communityMessages").withIndex("by_org_external", (q) => q.eq("orgId", orgId)).collect()).filter((message) => message.kind === "review"));
    expect(reviews).toHaveLength(1);
    expect(reviews[0]).toMatchObject({ authorName: "A customer", text: "Original review", reviewRating: 3, status: "dismissed", finalReply: "Owner follow-up recorded" });
  });

  it("routes a low rating without written context to the owner instead of guessing", async () => {
    const t = setup();
    const owner = await asNewUser(t, "low-rating-review@example.com");
    const { slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Review Co" });
    await owner.client.mutation(api.reviews.addReview, { slug, author: "A customer", text: "", rating: 2, source: "google" });
    const [review] = await owner.client.query(api.inbox.list, { slug, box: "open" });
    expect(review).toMatchObject({ status: "escalated", reviewRating: 2, reviewSafety: { categories: [], reason: "low_rating_without_text" } });
    await expect(owner.client.mutation(api.inbox.draftReply, { slug, id: review.id })).rejects.toThrow(/direct owner review/);
  });

  it("shows tentative repeated voice themes with provenance and retains owner corrections per tenant", async () => {
    const t = setup();
    const owner = await asNewUser(t, "voice-themes@example.com");
    const { slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Review Co" });
    await owner.client.mutation(api.reviews.addReview, { slug, author: "Pat", text: "Setup was confusing; write to pat@example.com", source: "google", sourceUrl: "https://reviews.example/1" });
    await owner.client.mutation(api.reviews.addReview, { slug, author: "Lee", text: "Getting started was confusing", source: "trustpilot", sourceUrl: "https://reviews.example/2" });
    let result = await owner.client.query(api.reviews.voiceThemes, { slug });
    expect(result.themes[0]).toMatchObject({ key: "onboarding", count: 2, channels: ["google", "trustpilot"], confidence: "low" });
    expect(result.themes[0]!.examples[0]).toMatchObject({ source: "review · trustpilot" });
    expect(result.themes[0]!.examples.some((row) => row.excerpt.includes("pat@example.com"))).toBe(false);

    await owner.client.mutation(api.reviews.setVoiceThemeFeedback, { slug, themeKey: "onboarding", status: "corrected", correctedLabel: "Reliability", note: "These comments refer to recurring app errors, not onboarding." });
    result = await owner.client.query(api.reviews.voiceThemes, { slug });
    expect(result.themes[0]).toMatchObject({ label: "Reliability", status: "corrected", ownerNote: "These comments refer to recurring app errors, not onboarding." });

    const other = await asNewUser(t, "voice-theme-other@example.com");
    await other.client.mutation(api.orgs.createWorkspace, { businessName: "Other Co" });
    await expect(other.client.mutation(api.reviews.setVoiceThemeFeedback, { slug, themeKey: "onboarding", status: "dismissed" })).rejects.toThrow(/workspace|access/i);
    await owner.client.mutation(api.reviews.setVoiceThemeFeedback, { slug, themeKey: "onboarding", status: "dismissed", note: "Not relevant" });
    result = await owner.client.query(api.reviews.voiceThemes, { slug });
    expect(result.themes[0]).toMatchObject({ status: "dismissed" });
    await owner.client.mutation(api.reviews.setVoiceThemeFeedback, { slug, themeKey: "onboarding", status: "clear" });
    expect((await owner.client.query(api.reviews.voiceThemes, { slug })).themes[0]).toMatchObject({ status: "suggested", label: "Getting started" });
  });

  it("shows a neutral invitation preview, requires exact-scope approval, and tracks clicks and private notes", async () => {
    const t = setup();
    const owner = await asNewUser(t, "reviews@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Review Co", website: "https://review.example" });
    // Free: sending is a paid feature.
    await expect(owner.client.mutation(api.reviews.prepareBatch, { slug, people: [{ name: "Ana", email: "ana@x.example" }] })).rejects.toThrow(/package/);
    await makePaid(t, orgId);
    await expect(owner.client.mutation(api.reviews.prepareBatch, { slug, people: [{ name: "Ana", email: "ana@x.example" }] })).rejects.toThrow(/review link/);
    await expect(owner.client.mutation(api.reviews.setReviewUrl, { slug, url: "javascript:alert(1)" })).rejects.toThrow();
    await owner.client.mutation(api.reviews.setReviewUrl, { slug, url: "https://g.page/r/abc/review" });
    await expect(owner.client.mutation(api.reviews.prepareBatch, { slug, people: [{ name: "Ana", email: "ana@x.example" }] })).rejects.toThrow(/mailbox/);
    await owner.client.action(api.mailbox.connect, { slug, preset: "gmail", email: "me@review.example", password: "pw" });

    const dealId = await owner.client.mutation(api.crm.create, { slug, name: "Ana Lopez", email: "ana@x.example", stage: "won" });
    let o = await owner.client.query(api.reviews.overview, { slug });
    expect(o.candidates).toEqual([{ dealId, name: "Ana Lopez", email: "ana@x.example" }]);
    const staged = await owner.client.mutation(api.reviews.prepareBatch, { slug, people: [{ name: "Ana Lopez", email: "ana@x.example", dealId }, { name: "Bad", email: "nope" }] });
    expect(staged).toMatchObject({ count: 1, skipped: 1, destination: "https://g.page/r/abc/review" });
    expect(staged.preview).toContain("honest review");
    expect(staged.preview).not.toMatch(/happy|satisfied|positive/i);
    expect(await t.run(async (ctx) => (await ctx.db.query("reviewRequests").collect()).length)).toBe(0); // Staging does not send.
    const other = await asNewUser(t, "other-review-tenant@example.com");
    const otherWorkspace = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Other Co" });
    await expect(other.client.mutation(api.reviews.approveBatch, { slug: otherWorkspace.slug, batchId: staged.batchId, contentHash: staged.contentHash, scopeHash: staged.scopeHash, confirmEligibleRecipients: true })).rejects.toThrow(/not found/);
    await expect(owner.client.mutation(api.reviews.approveBatch, { slug, batchId: staged.batchId, contentHash: "changed", scopeHash: staged.scopeHash, confirmEligibleRecipients: true })).rejects.toThrow(/changed/);
    const businessId = await t.run(async (ctx) => (await ctx.db.query("businesses").first())!._id);
    await t.run((ctx) => ctx.db.patch(businessId, { name: "Renamed Co" }));
    await expect(owner.client.mutation(api.reviews.approveBatch, { slug, batchId: staged.batchId, contentHash: staged.contentHash, scopeHash: staged.scopeHash, confirmEligibleRecipients: true })).rejects.toThrow(/changed/);
    await t.run((ctx) => ctx.db.patch(businessId, { name: "Review Co" }));
    await expect(owner.client.mutation(api.reviews.approveBatch, { slug, batchId: staged.batchId, contentHash: staged.contentHash, scopeHash: staged.scopeHash, confirmEligibleRecipients: false })).rejects.toThrow(/eligible customer/);
    await owner.client.mutation(api.reviews.approveBatch, { slug, batchId: staged.batchId, contentHash: staged.contentHash, scopeHash: staged.scopeHash, confirmEligibleRecipients: true });
    // The email has a real unsubscribe link (no "reply stop" promise nobody reads).
    const reqId = await t.run(async (ctx) => (await ctx.db.query("reviewRequests").first())!._id);
    const mail = (await t.query(internal.reviews.prepareRequest, { id: reqId }))!;
    expect(mail.text).not.toMatch(/reply "stop"/i);
    expect(mail.text).toContain(`/u/${await unsubscribeToken(reqId, "test-server-secret")}`);
    expect(mail.unsubscribeUrl).toBeTruthy();
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    o = await owner.client.query(api.reviews.overview, { slug });
    expect(o.stats.sent).toBe(1);
    expect(o.candidates).toHaveLength(0);
    // The same customer isn't asked again within 90 days.
    await expect(owner.client.mutation(api.reviews.prepareBatch, { slug, people: [{ name: "Ana Lopez", email: "ana@x.example" }] })).rejects.toThrow(/last 90 days/);
    const bo = await owner.client.mutation(api.reviews.prepareBatch, { slug, people: [{ name: "Ana Lopez", email: "ana@x.example" }, { name: "Bo", email: "bo@x.example" }] });
    expect(bo).toMatchObject({ count: 1, skipped: 1, recentlyAsked: 1, destination: staged.destination });
    await owner.client.mutation(api.reviews.approveBatch, { slug, batchId: bo.batchId, contentHash: bo.contentHash, scopeHash: bo.scopeHash, confirmEligibleRecipients: true });
    // Private feedback, including a low rating, does not remove the public review option.
    const boId = await t.run(async (ctx) => (await ctx.db.query("reviewRequests").collect()).find((r) => r.email === "bo@x.example")!._id);
    const boRequest = await t.run((ctx) => ctx.db.get(boId));
    await t.mutation(api.reviews.privateFeedback, { slug, t: boRequest!.token, text: "Delivery was late", rating: 1 });
    const boMail = await t.query(internal.reviews.prepareRequest, { id: boId });
    expect(boMail?.text).toContain("you can share an honest review here:");
    expect(boMail?.text).toContain("/review/");
    // Unsubscribing still suppresses the queued email.
    expect(await t.mutation(api.outboundSending.unsubscribe, { token: await unsubscribeToken(boId, "test-server-secret") })).toEqual({ company: expect.any(String) });
    await expect(owner.client.mutation(api.reviews.prepareBatch, { slug, people: [{ name: "Bo", email: "bo@x.example" }] })).rejects.toThrow(/No eligible/);

    const tok = await t.run(async (ctx) => (await ctx.db.query("reviewRequests").first())!.token);
    expect(await t.query(api.reviews.publicPage, { slug })).toEqual({ name: "Review Co", reviewUrl: "https://g.page/r/abc/review" });
    await t.mutation(api.reviews.opened, { slug, t: tok });
    await t.mutation(api.reviews.privateFeedback, { slug, t: tok, text: "Great work, slow delivery though", rating: 4 });
    o = await owner.client.query(api.reviews.overview, { slug });
    expect(o.stats).toMatchObject({ clicked: 1, feedback: 2 });
    const inbox = await owner.client.query(api.inbox.list, { slug, box: "open" });
    expect(inbox[0]).toMatchObject({ kind: "review", from: "Ana Lopez", canReply: true });
    expect(inbox[0].text).toContain("★★★★☆");
  });
});
