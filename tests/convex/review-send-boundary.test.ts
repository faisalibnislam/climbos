import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fakeMailbox, resetFakeMailbox } from "../../shared/outbound/fakeMailbox";
import { sha256Hex } from "../../shared/policy";
import { hasQueuedReviewInvitation } from "../../convex/lib/contactPressure";
import { api, internal } from "../../convex/_generated/api";
import { asNewUser, makePaid, setup } from "./helpers";
const NOW = Date.UTC(2026, 10, 17, 12);
beforeEach(() => { resetFakeMailbox(); vi.useFakeTimers(); vi.setSystemTime(NOW); vi.stubEnv("CLIMBOS_FAKE_MAILBOX", "1"); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });
async function fixture() {
  const t = setup(), owner = await asNewUser(t, "review-boundary@example.com");
  const w = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Review boundary" });
  await makePaid(t, w.orgId);
  await owner.client.mutation(api.reviews.setReviewUrl, { slug: w.slug, url: "https://g.page/r/boundary/review" });
  await owner.client.action(api.mailbox.connect, { slug: w.slug, preset: "gmail", email: "owner@example.com", password: "synthetic" });
  const batch = await owner.client.mutation(api.reviews.prepareBatch, { slug: w.slug, people: [{ name: "Ana", email: "ana@example.com" }] });
  await owner.client.mutation(api.reviews.approveBatch, { slug: w.slug, batchId: batch.batchId, contentHash: batch.contentHash, scopeHash: batch.scopeHash, confirmEligibleRecipients: true });
  const request = await t.run(async ctx => (await ctx.db.query("reviewRequests").first())!);
  return { t, owner, ...w, batch, request };
}
it("does not prepare a review invitation while its workspace is paused", async () => {
  const f = await fixture();
  await f.owner.client.mutation(api.workspace.pauseAll, { slug: f.slug });
  expect(await f.t.query(internal.reviews.prepareRequest, { id: f.request._id })).toBeNull();
});
it("does not overwrite a completed review invitation when the worker is repeated", async () => {
  const f = await fixture();
  await f.t.action(internal.mailbox.sendReviewRequests, { ids: [f.request._id] });
  expect((await f.t.run(ctx => ctx.db.get(f.request._id)))?.status).toBe("sent");
  await f.t.action(internal.mailbox.sendReviewRequests, { ids: [f.request._id] });
  expect((await f.t.run(ctx => ctx.db.get(f.request._id)))?.status).toBe("sent");
  expect(fakeMailbox().sent).toHaveLength(1);
});
async function claimInput(f: Awaited<ReturnType<typeof fixture>>) {
  const job = (await f.t.query(internal.reviews.prepareRequest, { id: f.request._id }))!;
  return { id: f.request._id, payloadHash: job.payloadHash, credentialId: job.credentialId };
}
it("does not let an invitation's own queued row block its approved claim", async () => {
  const f = await fixture();
  await f.owner.client.mutation(api.settings.setContactFrequency, { slug: f.slug, days: 7 });
  const input = await claimInput(f);
  expect(await f.t.mutation(internal.reviews.claimRequest, input)).toMatchObject({ claimToken: expect.any(String) });
  expect(fakeMailbox().sent).toEqual([]);
});
it("filters recent broadcast recipients neutrally and explains the partial review preview", async () => {
  const f = await fixture();
  await f.owner.client.action(api.marketing.importContacts, { slug: f.slug, csv: "email,consent,consent_source,consent_date,segment\nbea@example.com,yes,signup,2026-10-01,newsletter" });
  await f.t.run(async ctx => { const c = (await ctx.db.query("contacts").first())!; await ctx.db.patch(c._id, { lastMarketingEmailAt: NOW - 86400000 }); });
  await f.owner.client.mutation(api.settings.setContactFrequency, { slug: f.slug, days: 7 });
  const batch = await f.owner.client.mutation(api.reviews.prepareBatch, { slug: f.slug, people: [{ name: "Bea", email: "bea@example.com" }, { name: "Dee", email: "dee@example.com" }] });
  expect(batch).toMatchObject({ count: 1, contactLimitHeld: 1, recipients: [{ name: "Dee", email: "dee@example.com" }] });
  expect(fakeMailbox().sent).toEqual([]);
});
it("rechecks recent broadcast contact before review dispatch and permits a fresh preview after the exact interval", async () => {
  const f = await fixture(), input = await claimInput(f);
  await f.owner.client.action(api.marketing.importContacts, { slug: f.slug, csv: "email,consent,consent_source,consent_date,segment\nana@example.com,yes,signup,2026-10-01,newsletter" });
  await f.t.run(async ctx => { const c = (await ctx.db.query("contacts").first())!; await ctx.db.patch(c._id, { lastMarketingEmailAt: NOW }); });
  await f.owner.client.mutation(api.settings.setContactFrequency, { slug: f.slug, days: 7 });
  expect(await f.t.mutation(internal.reviews.claimRequest, input)).toBeNull();
  await f.t.action(internal.mailbox.sendReviewRequests, { ids: [f.request._id] });
  expect(fakeMailbox().sent).toEqual([]);
  expect(await f.t.run(ctx => ctx.db.get(f.request._id))).toMatchObject({ status: "failed", notSentConfirmed: true });
  vi.setSystemTime(NOW + 7 * 86400000);
  expect((await f.owner.client.mutation(api.reviews.prepareBatch, { slug: f.slug, people: f.batch.recipients })).count).toBe(1);
  expect(fakeMailbox().sent).toEqual([]);
});
it("allows only one current claim and rejects another worker's result", async () => {
  const f = await fixture(), input = await claimInput(f);
  const claims = await Promise.all([f.t.mutation(internal.reviews.claimRequest, input), f.t.mutation(internal.reviews.claimRequest, input)]);
  expect(claims.filter(Boolean)).toHaveLength(1);
  await f.t.mutation(internal.reviews.recordRequest, { id: input.id, claimToken: "wrong", outcome: "sent" });
  expect((await f.t.run(ctx => ctx.db.get(input.id)))?.status).toBe("sending");
  await f.t.mutation(internal.reviews.recordRequest, { id: input.id, claimToken: claims.find(Boolean)!.claimToken, outcome: "sent" });
  await f.t.mutation(internal.reviews.recordRequest, { id: input.id, claimToken: claims.find(Boolean)!.claimToken, outcome: "failed" });
  expect((await f.t.run(ctx => ctx.db.get(input.id)))?.status).toBe("sent");
});
it.each(["pause", "fleet", "suspended", "deleted", "unsubscribed", "revoked role", "mailbox", "destination", "payload", "credential", "unpaid", "foreign approval", "legacy approval"])("rechecks %s after preview and before claiming", async fault => {
  const f = await fixture(), input = await claimInput(f);
  await f.t.run(async ctx => {
    const batch = (await ctx.db.get(f.batch.batchId))!;
    if (fault === "pause") await ctx.db.patch(f.orgId, { emergencyStop: { active: true, at: NOW, by: f.owner.userId, reason: "Pause" } });
    if (fault === "fleet") await ctx.db.insert("fleetControls", { key: "global", emergencyStop: true, circuits: [], previewDailyBudgetMicros: 0, updatedAt: NOW });
    if (fault === "suspended") await ctx.db.patch(f.orgId, { suspendedAt: 0 });
    if (fault === "deleted") await ctx.db.patch(f.orgId, { deletedAt: 0 });
    if (fault === "unsubscribed") await ctx.db.insert("suppressions", { orgId: f.orgId, emailHash: await sha256Hex(f.request.email), reason: "unsubscribe", source: "owner", createdAt: NOW });
    if (fault === "revoked role") { const m = (await ctx.db.query("memberships").withIndex("by_org_user", q => q.eq("orgId", f.orgId).eq("userId", f.owner.userId)).unique())!; await ctx.db.patch(m._id, { role: "viewer" }); }
    if (fault === "mailbox") await ctx.db.patch(batch.connectionId, { status: "revoked" });
    if (fault === "destination") { const b = (await ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", f.orgId)).first())!; await ctx.db.patch(b._id, { reviewUrl: "https://g.page/r/changed/review" }); }
    if (fault === "payload") await ctx.db.patch(f.request._id, { token: "changed-link" });
    if (fault === "credential") await ctx.db.delete(input.credentialId);
    if (fault === "unpaid") for (const sub of await ctx.db.query("subscriptions").collect()) await ctx.db.patch(sub._id, { status: "canceled", currentPeriodEnd: NOW - 1 });
    if (fault === "foreign approval") { const org = (await ctx.db.get(f.orgId))!; const { _id: _id, _creationTime: _time, ...fields } = org; const other = await ctx.db.insert("organizations", { ...fields, slug: "other-review" }); await ctx.db.patch(batch._id, { orgId: other }); }
    if (fault === "legacy approval") await ctx.db.patch(batch._id, { credentialId: undefined });
  });
  expect(await f.t.mutation(internal.reviews.claimRequest, input)).toBeNull();
  expect(fakeMailbox().sent).toEqual([]);
});
it.each(["timeout_after_send", "crash_after_send"] as const)("does not replay after %s and keeps uncertainty visible", async fault => {
  const f = await fixture(); resetFakeMailbox({ faults: [fault] });
  await f.t.action(internal.mailbox.sendReviewRequests, { ids: [f.request._id] });
  await f.t.action(internal.mailbox.sendReviewRequests, { ids: [f.request._id] });
  expect(fakeMailbox().sent).toHaveLength(1);
  const row = (await f.t.run(ctx => ctx.db.get(f.request._id)))!;
  expect(row.status).toBe(fault === "crash_after_send" ? "sending" : "uncertain");
  expect(row.error).toMatch(/confirm|unclear/);
  expect(await f.t.run(ctx => hasQueuedReviewInvitation(ctx, f.orgId, f.request.email))).toBe(true);
  await f.t.run(ctx => ctx.db.patch(f.request._id, { createdAt: NOW - 91 * 86400000 }));
  await expect(f.owner.client.mutation(api.reviews.prepareBatch, { slug: f.slug, people: [{ name: "Ana", email: f.request.email }] })).rejects.toThrow(/no confirmed result/);
});
it("keeps a known rejection separate from unknown delivery and permits a fresh owner preview", async () => {
  const f = await fixture(); resetFakeMailbox({ faults: ["reject"] });
  await f.t.action(internal.mailbox.sendReviewRequests, { ids: [f.request._id] });
  expect(fakeMailbox().sent).toEqual([]);
  expect(await f.t.run(ctx => ctx.db.get(f.request._id))).toMatchObject({ status: "failed", notSentConfirmed: true });
  const staged = await f.owner.client.mutation(api.reviews.prepareBatch, { slug: f.slug, people: [{ name: "Ana", email: f.request.email }] });
  expect(staged.count).toBe(1);
  expect(fakeMailbox().sent).toEqual([]);
});
it("does not turn unknown legacy delivery into a claim that nothing was sent", async () => {
  const f = await fixture(); await f.t.run(ctx => ctx.db.patch(f.batch.batchId, { credentialId: undefined }));
  await f.t.action(internal.mailbox.sendReviewRequests, { ids: [f.request._id] });
  expect(await f.t.run(ctx => ctx.db.get(f.request._id))).toMatchObject({ status: "uncertain" });
  expect(fakeMailbox().sent).toEqual([]);
});
it("keeps negative private feedback out of invitation eligibility and copy", async () => {
  const f = await fixture(), before = await f.t.query(internal.reviews.prepareRequest, { id: f.request._id });
  await f.t.mutation(api.reviews.privateFeedback, { slug: f.slug, t: f.request.token, text: "The delivery was late", rating: 1 });
  expect(await f.t.query(internal.reviews.prepareRequest, { id: f.request._id })).toEqual(before);
  await f.t.action(internal.mailbox.sendReviewRequests, { ids: [f.request._id] });
  expect(fakeMailbox().sent).toHaveLength(1);
  expect(fakeMailbox().sent[0].text).toContain("honest review");
});
