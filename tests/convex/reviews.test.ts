import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../convex/_generated/api";
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

  it("asks won customers from the mailbox, tracks the click and routes private notes to the Inbox", async () => {
    const t = setup();
    const owner = await asNewUser(t, "reviews@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Review Co", website: "https://review.example" });
    // Free: sending is a paid feature.
    await expect(owner.client.mutation(api.reviews.request, { slug, people: [{ name: "Ana", email: "ana@x.example" }] })).rejects.toThrow(/package/);
    await makePaid(t, orgId);
    await expect(owner.client.mutation(api.reviews.request, { slug, people: [{ name: "Ana", email: "ana@x.example" }] })).rejects.toThrow(/review link/);
    await expect(owner.client.mutation(api.reviews.setReviewUrl, { slug, url: "javascript:alert(1)" })).rejects.toThrow();
    await owner.client.mutation(api.reviews.setReviewUrl, { slug, url: "https://g.page/r/abc/review" });
    await expect(owner.client.mutation(api.reviews.request, { slug, people: [{ name: "Ana", email: "ana@x.example" }] })).rejects.toThrow(/mailbox/);
    await owner.client.action(api.mailbox.connect, { slug, preset: "gmail", email: "me@review.example", password: "pw" });

    const dealId = await owner.client.mutation(api.crm.create, { slug, name: "Ana Lopez", email: "ana@x.example", stage: "won" });
    let o = await owner.client.query(api.reviews.overview, { slug });
    expect(o.candidates).toEqual([{ dealId, name: "Ana Lopez", email: "ana@x.example" }]);
    expect(await owner.client.mutation(api.reviews.request, { slug, people: [{ name: "Ana Lopez", email: "ana@x.example", dealId }, { name: "Bad", email: "nope" }] })).toEqual({ queued: 1, skipped: 1 });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    o = await owner.client.query(api.reviews.overview, { slug });
    expect(o.stats.sent).toBe(1);
    expect(o.candidates).toHaveLength(0);

    const tok = await t.run(async (ctx) => (await ctx.db.query("reviewRequests").first())!.token);
    expect(await t.query(api.reviews.publicPage, { slug })).toEqual({ name: "Review Co", reviewUrl: "https://g.page/r/abc/review" });
    await t.mutation(api.reviews.opened, { slug, t: tok });
    await t.mutation(api.reviews.privateFeedback, { slug, t: tok, text: "Great work, slow delivery though", rating: 4 });
    o = await owner.client.query(api.reviews.overview, { slug });
    expect(o.stats).toMatchObject({ clicked: 1, feedback: 1 });
    const inbox = await owner.client.query(api.inbox.list, { slug, box: "open" });
    expect(inbox[0]).toMatchObject({ kind: "review", from: "Ana Lopez", canReply: true });
    expect(inbox[0].text).toContain("★★★★☆");
  });
});
