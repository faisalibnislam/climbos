import { afterEach, expect, it, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { manageToken } from "../../convex/bookings";
import { asNewUser, makePaid, setup } from "./helpers";
const NOW = Date.parse("2026-11-16T08:00:00Z");
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });
async function fixture() {
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] }); vi.setSystemTime(NOW);
  vi.stubEnv("RESEND_API_KEY", "");
  const t = setup(); const owner = await asNewUser(t, "identity-owner@example.com");
  const w = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Appointments" });
  await makePaid(t, w.orgId);
  const pageId = await t.run(ctx => ctx.db.insert("bookingPages", { orgId: w.orgId, slug: "identity-calls", title: "Intro", durationMin: 30, timezone: "UTC", days: [1, 2, 3, 4, 5], startHour: 9, endHour: 17, bufferMin: 0, noticeHours: 1, active: true, createdAt: NOW, updatedAt: NOW }));
  const slots = (await t.query(api.outbound.publicPage, { slug: "identity-calls" }))!.slots;
  const prospectId = await t.run(async ctx => {
    const campaignId = await ctx.db.insert("outboundCampaigns", { orgId: w.orgId, title: "Intro", brief: { who: "Owner supplied", where: "Unknown", count: 1 }, status: "review", sequence: [], ownerNotes: [], excluded: [], createdBy: owner.userId, createdAt: NOW, updatedAt: NOW });
    return ctx.db.insert("prospects", { orgId: w.orgId, campaignId, company: "Buyer", domain: "example.com", website: "https://example.com", location: "Unknown", sizeBand: "Unknown", why: "Owner supplied", evidence: [], trigger: "Unknown", fit: 0, timing: 0, contact: "Guest", publicEmail: "guest@example.com", firstLine: "Hello", stage: "replied", createdAt: NOW, updatedAt: NOW });
  });
  const book = (startAt: number, email = "guest@example.com", ref?: string) => t.mutation(api.outbound.book, { slug: "identity-calls", startAt, name: "Guest", email, ref });
  return { t, owner, ...w, pageId, slots, prospectId, book };
}

it("binds two appointments to one exact deal and preserves the remaining call on either cancellation order", async () => {
  for (const cancelFirst of [true, false]) {
    const f = await fixture(); const first = await f.book(f.slots[0]); const second = await f.book(f.slots[1]);
    const b1 = (await f.t.run(ctx => ctx.db.get(first.bookingId)))!;
    const b2 = (await f.t.run(ctx => ctx.db.get(second.bookingId)))!;
    expect(b1.dealId).toBeDefined(); expect(b2.dealId).toBe(b1.dealId);
    const original = (await f.t.run(ctx => ctx.db.get(b1.dealId!)))!;
    expect(original).toMatchObject({ nextStepBookingId: first.bookingId, nextStepAt: first.startAt });
    await f.owner.client.mutation(api.crm.update, { slug: f.slug, id: b1.dealId!, nextStep: "Call" });
    expect((await f.t.run(ctx => ctx.db.get(b1.dealId!)))?.nextStepBookingId).toBe(first.bookingId);
    const cancelled = cancelFirst ? first : second; const remaining = cancelFirst ? second : first;
    await f.t.mutation(api.bookings.cancelByGuest, { token: await manageToken(cancelled.bookingId) });
    expect(await f.t.run(ctx => ctx.db.get(b1.dealId!))).toMatchObject({ stage: "booked", stageChangedAt: original.stageChangedAt, nextStepBookingId: remaining.bookingId, nextStepAt: remaining.startAt });
    expect((await f.t.run(ctx => ctx.db.get(f.prospectId)))?.stage).toBe("booked");
    vi.setSystemTime(NOW + 1000);
    await f.owner.client.mutation(api.outbound.cancelBooking, { slug: f.slug, bookingId: remaining.bookingId });
    const after = (await f.t.run(ctx => ctx.db.get(b1.dealId!)))!;
    expect(after).toMatchObject({ stage: "talking", stageChangedAt: NOW + 1000 });
    expect(after.nextStepAt).toBeUndefined(); expect(after.nextStepBookingId).toBeUndefined();
    expect((await f.t.run(ctx => ctx.db.get(f.prospectId)))?.stage).toBe("replied");
  }
});

it("preserves owner-edited next steps and closed decisions when a call is cancelled", async () => {
  const f = await fixture(); const booked = await f.book(f.slots[0]);
  const b = (await f.t.run(ctx => ctx.db.get(booked.bookingId)))!;
  await f.owner.client.mutation(api.crm.update, { slug: f.slug, id: b.dealId!, nextStep: "Review their proposal", nextStepDate: "2026-12-01" });
  await f.t.mutation(api.bookings.cancelByGuest, { token: await manageToken(booked.bookingId) });
  expect(await f.t.run(ctx => ctx.db.get(b.dealId!))).toMatchObject({ stage: "booked", nextStep: "Review their proposal", nextStepDate: "2026-12-01" });
  expect((await f.t.run(ctx => ctx.db.get(b.dealId!)))?.nextStepBookingId).toBeUndefined();
  await f.owner.client.mutation(api.crm.update, { slug: f.slug, id: b.dealId!, stage: "lost" });
  const second = await f.book(f.slots[1]);
  await f.t.mutation(api.bookings.cancelByGuest, { token: await manageToken(second.bookingId) });
  expect((await f.t.run(ctx => ctx.db.get(b.dealId!)))?.stage).toBe("lost");
  expect((await f.t.run(ctx => ctx.db.get(f.prospectId)))?.stage).toBe("lost");
});

it("records attendance on the exact direct-booking deal even after names and next steps change", async () => {
  const f = await fixture(); const booked = await f.book(f.slots[0], "direct@example.com");
  const b = (await f.t.run(ctx => ctx.db.get(booked.bookingId)))!;
  expect(b.prospectId).toBeUndefined(); expect(b.dealId).toBeDefined();
  await f.owner.client.mutation(api.crm.update, { slug: f.slug, id: b.dealId!, name: "Corrected name", nextStep: "Send a brief" });
  vi.setSystemTime(booked.endAt + 1);
  await f.owner.client.mutation(api.bookings.setOutcome, { slug: f.slug, bookingId: booked.bookingId, outcome: "attended" });
  const deal = (await f.t.run(ctx => ctx.db.get(b.dealId!)))!;
  expect(deal.notes.at(-1)).toMatchObject({ userId: f.owner.userId, text: expect.stringMatching(/as attended/) });
  expect(deal).toMatchObject({ name: "Corrected name", nextStep: "Send a brief", stage: "booked" });
});

it("does not let an unrelated or forwarded reference mutate a different prospect", async () => {
  const f = await fixture(); const before = await f.t.run(ctx => ctx.db.get(f.prospectId));
  const booked = await f.book(f.slots[0], "different@example.com", f.prospectId);
  const b = (await f.t.run(ctx => ctx.db.get(booked.bookingId)))!;
  expect(b.prospectId).toBeUndefined(); expect(b.dealId).toBeDefined();
  expect(await f.t.run(ctx => ctx.db.get(f.prospectId))).toEqual(before);
});

it("does not name-match unlinked historical bookings or follow foreign explicit links", async () => {
  const f = await fixture(); const booked = await f.book(f.slots[0], "direct@example.com");
  const b = (await f.t.run(ctx => ctx.db.get(booked.bookingId)))!;
  const before = await f.t.run(ctx => ctx.db.get(b.dealId!));
  await f.t.run(ctx => ctx.db.patch(b._id, { dealId: undefined }));
  await f.t.mutation(api.bookings.cancelByGuest, { token: await manageToken(b._id) });
  expect(await f.t.run(ctx => ctx.db.get(b.dealId!))).toEqual(before);
  const other = await asNewUser(f.t, "foreign-identity@example.com");
  const w = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Foreign" });
  await f.t.run(async ctx => { await ctx.db.patch(b._id, { status: "confirmed", dealId: b.dealId, startAt: NOW - 1000 }); await ctx.db.patch(b.dealId!, { orgId: w.orgId }); });
  const foreignBefore = await f.t.run(ctx => ctx.db.get(b.dealId!));
  await f.owner.client.mutation(api.bookings.setOutcome, { slug: f.slug, bookingId: b._id, outcome: "no_show" });
  expect(await f.t.run(ctx => ctx.db.get(b.dealId!))).toEqual(foreignBefore);
});

it("keeps a legacy upcoming prospect appointment from falsely clearing the booked stage", async () => {
  const f = await fixture(); const first = await f.book(f.slots[0]); const second = await f.book(f.slots[1]);
  const b = (await f.t.run(ctx => ctx.db.get(first.bookingId)))!;
  await f.t.run(ctx => ctx.db.patch(second.bookingId, { dealId: undefined }));
  await f.t.mutation(api.bookings.cancelByGuest, { token: await manageToken(first.bookingId) });
  expect((await f.t.run(ctx => ctx.db.get(b.dealId!)))?.stage).toBe("booked");
  expect((await f.t.run(ctx => ctx.db.get(f.prospectId)))?.stage).toBe("booked");
});

it("leaves ambiguous legacy links untouched and accepts a new booking as a separate record", async () => {
  const f = await fixture(); const first = await f.book(f.slots[0]);
  const b = (await f.t.run(ctx => ctx.db.get(first.bookingId)))!;
  await f.t.run(async ctx => {
    const deal = (await ctx.db.get(b.dealId!))!;
    const { _id, _creationTime, ...data } = deal;
    await ctx.db.insert("deals", data);
    await ctx.db.patch(first.bookingId, { dealId: undefined, startAt: NOW - 1000 });
  });
  const before = await f.t.run(ctx => ctx.db.query("deals").collect());
  await f.owner.client.mutation(api.bookings.setOutcome, { slug: f.slug, bookingId: first.bookingId, outcome: "no_show" });
  expect(await f.t.run(ctx => ctx.db.query("deals").collect())).toEqual(before);
  const next = await f.book(f.slots[1]);
  const nextBooking = (await f.t.run(ctx => ctx.db.get(next.bookingId)))!;
  expect(nextBooking.prospectId).toBeUndefined();
  expect(nextBooking.dealId).toBeDefined();
  expect(nextBooking.dealId).not.toBe(b.dealId);
  expect((await f.t.run(ctx => ctx.db.query("deals").collect())).filter(d => d._id !== nextBooking.dealId)).toEqual(before);
});
