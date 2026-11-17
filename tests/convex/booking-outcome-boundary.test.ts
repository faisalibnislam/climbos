import { afterEach, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";
async function fixture() {
  const t = setup(); const owner = await asNewUser(t, "outcome-owner@example.com");
  const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Calls" });
  const data = await t.run(async ctx => {
    const now = Date.now();
    const pageId = await ctx.db.insert("bookingPages", { orgId, slug: "calls", title: "Intro", durationMin: 30, timezone: "UTC", days: [1, 2, 3, 4, 5], startHour: 9, endHour: 17, bufferMin: 0, noticeHours: 1, active: true, createdAt: now, updatedAt: now });
    const bookingId = await ctx.db.insert("bookings", { orgId, pageId, name: "Guest", emailHash: "hash", emailCiphertext: "sealed", emailIv: "iv", emailKeyId: "k1", startAt: now - 86400000, endAt: now - 86400000 + 1800000, status: "confirmed", createdAt: now - 2 * 86400000 });
    const inboxId = await ctx.db.insert("communityMessages", { orgId, channel: "booking", kind: "booking", externalId: `booking:${bookingId}`, authorName: "Guest", text: "Booked a call", receivedAt: now, status: "new", createdAt: now, updatedAt: now });
    return { pageId, bookingId, inboxId };
  });
  return { t, owner, slug, orgId, ...data };
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("records a no-show with an audit, without queuing or claiming an email", async () => {
  const f = await fixture();
  const tasks = await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
  await f.owner.client.mutation(api.bookings.setOutcome, { slug: f.slug, bookingId: f.bookingId, outcome: "no_show" });
  expect(await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect())).toEqual(tasks);
  const result = await f.owner.client.query(api.bookings.forInbox, { slug: f.slug, inboxId: f.inboxId });
  expect(result).toMatchObject({ outcome: "no_show", followUpStatus: "not_sent" });
  expect(result?.followUpDraft?.text).not.toContain("today");
  expect(result?.followUpDraft?.text).toContain("/book/calls");
  expect((await f.t.run(ctx => ctx.db.query("auditEvents").collect())).filter(e => e.action === "booking.outcome_recorded")).toHaveLength(1);
  await f.owner.client.mutation(api.bookings.setOutcome, { slug: f.slug, bookingId: f.bookingId, outcome: "no_show" });
  expect((await f.t.run(ctx => ctx.db.query("auditEvents").collect())).filter(e => e.action === "booking.outcome_recorded")).toHaveLength(1);
  for (const table of ["approvals", "actionReceipts"] as const) expect(await f.t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
});

it("neutralizes an already queued legacy no-show action without decrypting or contacting anyone", async () => {
  const f = await fixture(); const network = vi.fn(() => { throw new Error("No network allowed"); }); vi.stubGlobal("fetch", network);
  expect(await f.t.action(internal.bookings.sendNoShow, { bookingId: f.bookingId })).toMatchObject({ status: "requires_owner_review" });
  expect(network).not.toHaveBeenCalled();
  expect((await f.t.run(ctx => ctx.db.get(f.bookingId)))?.followUpSentAt).toBeUndefined();
});

it("keeps legacy send markers unverified and does not offer a blind duplicate", async () => {
  const f = await fixture(); await f.t.run(ctx => ctx.db.patch(f.bookingId, { outcome: "no_show", followUpSentAt: Date.now() }));
  expect(await f.owner.client.query(api.bookings.forInbox, { slug: f.slug, inboxId: f.inboxId })).toMatchObject({ followUpStatus: "historical_unverified", followUpDraft: null });
});

it("allows outcome correction, but rejects cancelled/future calls and unauthorized changes", async () => {
  const f = await fixture();
  const other = await asNewUser(f.t, "outside-outcome@example.com");
  await expect(other.client.mutation(api.bookings.setOutcome, { slug: f.slug, bookingId: f.bookingId, outcome: "no_show" })).rejects.toThrow();
  await f.owner.client.mutation(api.bookings.setOutcome, { slug: f.slug, bookingId: f.bookingId, outcome: "no_show" });
  await f.owner.client.mutation(api.bookings.setOutcome, { slug: f.slug, bookingId: f.bookingId, outcome: "attended" });
  expect(await f.owner.client.query(api.bookings.forInbox, { slug: f.slug, inboxId: f.inboxId })).toMatchObject({ outcome: "attended", followUpDraft: null });
  await f.t.run(ctx => ctx.db.patch(f.bookingId, { status: "cancelled" }));
  await expect(f.owner.client.mutation(api.bookings.setOutcome, { slug: f.slug, bookingId: f.bookingId, outcome: "no_show" })).rejects.toThrow(/cancelled/i);
  await f.t.run(ctx => ctx.db.patch(f.bookingId, { status: "confirmed", startAt: Date.now() + 86400000 }));
  await expect(f.owner.client.mutation(api.bookings.setOutcome, { slug: f.slug, bookingId: f.bookingId, outcome: "no_show" })).rejects.toThrow(/hasn't happened/i);
});

it("omits a rebooking link when the booking page is inactive", async () => {
  const f = await fixture(); await f.t.run(async ctx => { await ctx.db.patch(f.pageId, { active: false }); await ctx.db.patch(f.bookingId, { outcome: "no_show" }); });
  const result = await f.owner.client.query(api.bookings.forInbox, { slug: f.slug, inboxId: f.inboxId });
  expect(result?.followUpDraft?.text).toContain("reply with a time");
  expect(result?.followUpDraft?.text).not.toContain("/book/");
});

it("records attributed corrections without downgrading the deal or replacing its next step", async () => {
  const f = await fixture();
  const dealId = await f.t.run(async ctx => {
    const now = Date.now();
    const campaignId = await ctx.db.insert("outboundCampaigns", { orgId: f.orgId, title: "Introductions", brief: { who: "Owner supplied", where: "Unknown", count: 1 }, status: "review", sequence: [], ownerNotes: [], excluded: [], createdBy: f.owner.userId, createdAt: now, updatedAt: now });
    const prospectId = await ctx.db.insert("prospects", { orgId: f.orgId, campaignId, company: "Example", domain: "example.com", website: "https://example.com", location: "Unknown", sizeBand: "Unknown", why: "Owner supplied", evidence: [], trigger: "Unknown", fit: 0, timing: 0, contact: "Guest", firstLine: "Hello", stage: "booked", createdAt: now, updatedAt: now });
    await ctx.db.patch(f.bookingId, { prospectId });
    return ctx.db.insert("deals", { orgId: f.orgId, prospectId, name: "Guest", stage: "booked", source: "outbound", currency: "USD", nextStep: "Second call agreed", nextStepAt: now + 86400000, notes: Array.from({ length: 200 }, (_, i) => ({ text: `Note ${i}`, at: now - i })), createdAt: now, updatedAt: now });
  });
  const before = await f.t.run(ctx => ctx.db.get(dealId));
  for (const outcome of ["no_show", "attended"] as const) await f.owner.client.mutation(api.bookings.setOutcome, { slug: f.slug, bookingId: f.bookingId, outcome });
  const after = await f.t.run(ctx => ctx.db.get(dealId));
  expect(after).toMatchObject({ stage: "booked", nextStep: before!.nextStep, nextStepAt: before!.nextStepAt });
  expect(after!.notes).toHaveLength(200);
  expect(after!.notes.slice(-2).map(note => note.userId)).toEqual([f.owner.userId, f.owner.userId]);
  expect(after!.notes.at(-1)?.text).toMatch(/Owner corrected.*as attended.*sent no follow-up/);
  expect((await f.t.run(ctx => ctx.db.query("auditEvents").collect())).filter(e => e.action === "booking.outcome_recorded")).toHaveLength(2);
  const other = await asNewUser(f.t, "foreign-deal@example.com");
  const foreign = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Other" });
  await f.t.run(ctx => ctx.db.patch(dealId, { orgId: foreign.orgId }));
  const foreignBefore = await f.t.run(ctx => ctx.db.get(dealId));
  await f.owner.client.mutation(api.bookings.setOutcome, { slug: f.slug, bookingId: f.bookingId, outcome: "no_show" });
  expect(await f.t.run(ctx => ctx.db.get(dealId))).toEqual(foreignBefore);
});

it("denies viewers and cross-workspace ids, including forged inbox references", async () => {
  const f = await fixture(); const viewer = await asNewUser(f.t, "viewer@example.com");
  await f.t.run(ctx => ctx.db.insert("memberships", { orgId: f.orgId, userId: viewer.userId, role: "viewer", status: "active", createdAt: Date.now() }));
  expect(await viewer.client.query(api.bookings.forInbox, { slug: f.slug, inboxId: f.inboxId })).not.toBeNull();
  await expect(viewer.client.mutation(api.bookings.setOutcome, { slug: f.slug, bookingId: f.bookingId, outcome: "no_show" })).rejects.toThrow();
  const other = await asNewUser(f.t, "other-owner@example.com");
  const foreign = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Other" });
  await expect(other.client.mutation(api.bookings.setOutcome, { slug: foreign.slug, bookingId: f.bookingId, outcome: "no_show" })).rejects.toThrow();
  await expect(other.client.query(api.bookings.forInbox, { slug: foreign.slug, inboxId: f.inboxId })).rejects.toThrow();
  await f.t.run(ctx => ctx.db.patch(f.inboxId, { orgId: foreign.orgId }));
  expect(await other.client.query(api.bookings.forInbox, { slug: foreign.slug, inboxId: f.inboxId })).toBeNull();
});
