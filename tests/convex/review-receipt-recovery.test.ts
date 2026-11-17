import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Readable } from "node:stream";
import { api, internal } from "../../convex/_generated/api";
import { fakeMailbox, resetFakeMailbox } from "../../shared/outbound/fakeMailbox";
import { asNewUser, makePaid, setup } from "./helpers";
const imap = vi.hoisted(() => ({ connect: vi.fn(), list: vi.fn(), getMailboxLock: vi.fn(), search: vi.fn(), fetchOne: vi.fn(), download: vi.fn(), close: vi.fn() }));
vi.mock("imapflow", () => ({ ImapFlow: class { constructor() { return imap; } } }));
const NOW = Date.UTC(2026, 10, 17, 12);
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); vi.stubEnv("CLIMBOS_FAKE_MAILBOX", "1"); resetFakeMailbox(); Object.values(imap).forEach(mock => mock.mockReset()); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });
async function fixture(fault: "timeout_after_send" | "crash_after_send" = "timeout_after_send") {
  const t = setup(), owner = await asNewUser(t, "recovery-owner@example.com");
  const w = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Receipt Co" });
  await makePaid(t, w.orgId);
  await owner.client.mutation(api.reviews.setReviewUrl, { slug: w.slug, url: "https://g.page/r/receipt/review" });
  await owner.client.action(api.mailbox.connect, { slug: w.slug, preset: "gmail", email: "owner@example.com", password: "synthetic" });
  const batch = await owner.client.mutation(api.reviews.prepareBatch, { slug: w.slug, people: [{ name: "Ana", email: "ana@example.com" }] });
  await owner.client.mutation(api.reviews.approveBatch, { slug: w.slug, batchId: batch.batchId, contentHash: batch.contentHash, scopeHash: batch.scopeHash, confirmEligibleRecipients: true });
  const row = await t.run(async ctx => (await ctx.db.query("reviewRequests").first())!);
  resetFakeMailbox({ faults: [fault] });
  await t.action(internal.mailbox.sendReviewRequests, { ids: [row._id] });
  const request = (await t.run(ctx => ctx.db.get(row._id)))!;
  const args = { slug: w.slug, id: row._id, revision: 0 };
  return { t, owner, ...w, batch, request, args, check: () => owner.client.action(api.mailbox.checkReviewReceipt, args) };
}
it("finds the original complete sent copy after a timeout without sending again", async () => {
  const f = await fixture();
  await f.t.run(async ctx => { const b = (await ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", f.orgId)).first())!; await ctx.db.patch(b._id, { name: "Changed name", reviewUrl: "https://g.page/r/new/review" }); });
  expect((await f.check()).matched).toBe(true);
  const result = (await f.t.run(ctx => ctx.db.get(f.request._id)))!;
  expect(result).toMatchObject({ status: "sent", recoveryRevision: 1, recovery: { source: "sent_folder", outcome: "sent", originalStatus: "uncertain" } });
  expect(result.sentAt).toBeUndefined(); // The check time is not an invented send time.
  expect(result.dispatch).toEqual(f.request.dispatch);
  expect(fakeMailbox().sent).toHaveLength(1);
  await f.t.action(internal.mailbox.sendReviewRequests, { ids: [f.request._id] });
  expect(fakeMailbox().sent).toHaveLength(1);
});
it.each(["not found", "unavailable", "recipient", "subject", "text", "duplicate", "tampered snapshot", "new mailbox"])("keeps %s unknown and never queues another message", async fault => {
  const f = await fixture();
  if (fault === "not found") fakeMailbox().sent = [];
  if (fault === "unavailable") fakeMailbox().lookup = false;
  if (fault === "recipient") fakeMailbox().sent[0].to = "other@example.com";
  if (fault === "subject") fakeMailbox().sent[0].subject = "Changed";
  if (fault === "text") fakeMailbox().sent[0].text += " Changed offer";
  if (fault === "duplicate") fakeMailbox().sent.push({ ...fakeMailbox().sent[0] });
  if (fault === "tampered snapshot") await f.t.run(ctx => ctx.db.patch(f.request._id, { dispatch: { ...f.request.dispatch!, to: "other@example.com" } }));
  if (fault === "new mailbox") await f.owner.client.action(api.mailbox.connect, { slug: f.slug, preset: "gmail", email: "new@example.com", password: "new-synthetic" });
  const before = fakeMailbox().sent.length;
  expect((await f.check()).matched).toBe(false);
  expect(await f.t.run(ctx => ctx.db.get(f.request._id))).toMatchObject({ status: "uncertain", recovery: { outcome: "unknown" } });
  expect(fakeMailbox().sent).toHaveLength(before);
});
it("allows a crashed worker to be checked after the waiting period, without replay", async () => {
  const f = await fixture("crash_after_send");
  await expect(f.check()).rejects.toThrow(/still in progress/);
  vi.setSystemTime(NOW + 120_000);
  expect((await f.check()).matched).toBe(true);
  expect(fakeMailbox().sent).toHaveLength(1);
});
it.each(["sent", "not_sent", "unknown"] as const)("records owner-reported %s separately from provider evidence and preserves original uncertainty", async outcome => {
  const f = await fixture();
  await f.owner.client.mutation(api.reviews.recordReceiptObservation, { ...f.args, outcome, note: "Checked the original mailbox and its delivery records." });
  const r = (await f.t.run(ctx => ctx.db.get(f.request._id)))!;
  expect(r.recovery).toMatchObject({ source: "owner_reported", outcome, by: f.owner.userId, originalStatus: "uncertain", originalError: f.request.error });
  expect(r.sentAt).toBeUndefined(); expect(r.notSentConfirmed).toBeUndefined();
  expect(fakeMailbox().sent).toHaveLength(1);
  await expect(f.check()).rejects.toThrow(/changed|in progress/);
  if (outcome === "not_sent") {
    const fresh = await f.owner.client.mutation(api.reviews.prepareBatch, { slug: f.slug, people: [{ name: "Ana", email: f.request.email }] });
    expect(fresh.count).toBe(1); expect(fakeMailbox().sent).toHaveLength(1);
  }
});
it("rejects stale checks after an owner records the result and retains the original late-response boundary", async () => {
  const f = await fixture("crash_after_send"); vi.setSystemTime(NOW + 120_000);
  const c = await f.owner.client.query(internal.reviews.receiptContext, f.args);
  await f.owner.client.mutation(api.reviews.recordReceiptObservation, { ...f.args, outcome: "not_sent", note: "Owner checked original delivery records." });
  await expect(f.owner.client.mutation(internal.reviews.recordReceiptCheck, { ...f.args, fingerprint: c.fingerprint, matches: true, note: "Found" })).rejects.toThrow(/changed/);
  await f.t.mutation(internal.reviews.recordRequest, { id: f.request._id, claimToken: f.request.claimToken!, outcome: "sent" });
  expect(await f.t.run(ctx => ctx.db.get(f.request._id))).toMatchObject({ status: "failed", recovery: { source: "owner_reported", outcome: "not_sent" } });
});
it("denies unauthenticated, viewer and foreign-tenant recovery", async () => {
  const f = await fixture(), other = await asNewUser(f.t, "other-recovery@example.com");
  const w = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Other" });
  const viewer = await asNewUser(f.t, "viewer-recovery@example.com");
  await f.t.run(ctx => ctx.db.insert("memberships", { orgId: f.orgId, userId: viewer.userId, role: "viewer", status: "active", createdAt: NOW }));
  for (const client of [f.t, viewer.client, other.client]) {
    await expect(client.action(api.mailbox.checkReviewReceipt, f.args)).rejects.toThrow();
    await expect(client.mutation(api.reviews.recordReceiptObservation, { ...f.args, outcome: "sent", note: "Claimed sent" })).rejects.toThrow();
  }
  await expect(other.client.action(api.mailbox.checkReviewReceipt, { ...f.args, slug: w.slug })).rejects.toThrow();
  expect(fakeMailbox().sent).toHaveLength(1);
});
it("supports an attributed manual observation for legacy attempts without guessing original content", async () => {
  const f = await fixture(); await f.t.run(ctx => ctx.db.patch(f.request._id, { dispatch: undefined, claimToken: undefined }));
  expect((await f.check()).matched).toBe(false);
  await f.owner.client.mutation(api.reviews.recordReceiptObservation, { ...f.args, revision: 1, outcome: "unknown", note: "The original sent copy is unavailable." });
  expect((await f.t.run(ctx => ctx.db.get(f.request._id)))?.recovery?.source).toBe("owner_reported");
});

it.each(["match", "changed text", "changed sender", "duplicate id", "multipart", "missing folder", "oversized body", "credential changed during read"])("checks actual IMAP adapter with %s", async mode => {
  const f = await fixture(), d = f.request.dispatch!;
  vi.stubEnv("CLIMBOS_FAKE_MAILBOX", "");
  imap.connect.mockResolvedValue(undefined);
  imap.list.mockResolvedValue(mode === "missing folder" ? [] : [{ path: "Sent", specialUse: "\\Sent" }]);
  const release = vi.fn(); imap.getMailboxLock.mockResolvedValue({ release });
  imap.search.mockResolvedValue(mode === "duplicate id" ? [11, 12] : [11]);
  imap.fetchOne.mockResolvedValue({ envelope: { messageId: d.messageId, from: [{ address: mode === "changed sender" ? "other@example.com" : d.sender }], to: [{ address: d.to }], subject: d.subject }, bodyStructure: { type: mode === "multipart" ? "multipart/mixed" : "text/plain", part: "1" } });
  if (mode === "credential changed during read") imap.search.mockImplementationOnce(async () => { await f.t.run(ctx => ctx.db.delete(d.credentialId)); return [11]; });
  imap.download.mockResolvedValue({ meta: { contentType: "text/plain" }, content: Readable.from([Buffer.from(mode === "oversized body" ? "x".repeat(32768) : mode === "changed text" ? "Changed message" : d.text.replace(/\n/g, "\r\n") + "\r\n")]) });
  expect((await f.check()).matched).toBe(mode === "match");
  if (mode !== "missing folder") expect(imap.getMailboxLock).toHaveBeenCalledWith("Sent", { readOnly: true });
  expect(imap.close).toHaveBeenCalled();
  expect(fakeMailbox().sent).toHaveLength(1);
});

it("retains an unknown owner observation when the original worker later confirms acceptance", async () => {
  const f = await fixture("crash_after_send"); vi.setSystemTime(NOW + 120_000);
  await f.owner.client.mutation(api.reviews.recordReceiptObservation, { ...f.args, outcome: "unknown", note: "The original mailbox has not shown a result yet." });
  await f.t.mutation(internal.reviews.recordRequest, { id: f.request._id, claimToken: f.request.claimToken!, outcome: "sent", messageId: f.request.dispatch!.messageId });
  expect(await f.t.run(ctx => ctx.db.get(f.request._id))).toMatchObject({ status: "sent", recovery: { source: "owner_reported", outcome: "unknown", originalStatus: "sending" } });
  expect(fakeMailbox().sent).toHaveLength(1);
});

it("exports original review snapshots and recovery evidence and purges their approval scopes", async () => {
  const f = await fixture(); await f.check();
  const exported = JSON.parse(await f.t.query(internal.settings.exportData, { orgId: f.orgId }));
  expect(exported.reviewInvitations[0]).toMatchObject({ recovery: { source: "sent_folder" }, dispatch: { subject: f.request.dispatch!.subject } });
  expect(exported.reviewInvitations[0]).not.toHaveProperty("claimToken");
  expect(exported.reviewInvitations[0]).not.toHaveProperty("token");
  expect(exported.reviewInvitationHistoryLimited).toBe(false);
  expect(exported.reviewInvitationApprovals[0]._id).toBe(f.batch.batchId);
  await f.t.run(ctx => ctx.db.patch(f.orgId, { deletedAt: NOW }));
  await f.t.mutation(internal.settings.purgeWorkspaceBatch, { orgId: f.orgId });
  expect(await f.t.run(ctx => ctx.db.get(f.request._id))).toBeNull();
  expect(await f.t.run(ctx => ctx.db.get(f.batch.batchId))).toBeNull();
});
