import { afterEach, expect, it, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { dealFromBooking, syncDealFromProspect } from "../../convex/crm";
import { asNewUser, setup } from "./helpers";
const NOW = Date.parse("2026-11-17T00:30:00Z");
afterEach(() => vi.useRealTimers());
async function fixture() {
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(NOW);
  const t = setup(); const owner = await asNewUser(t, "date-owner@example.com");
  const w = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Dates" });
  await t.run(ctx => ctx.db.patch(w.orgId, { timezone: "Asia/Dhaka" }));
  const id = await owner.client.mutation(api.crm.create, { slug: w.slug, name: "Buyer", stage: "talking" });
  return { t, owner, ...w, id };
}

it("keeps date-only input consistent across the board, Today and selected-record review", async () => {
  const f = await fixture();
  const before = await f.t.run(ctx => ctx.db.get(f.id));
  await f.owner.client.mutation(api.crm.update, { slug: f.slug, id: f.id, nextStepDate: "2026-11-16" });
  const board = await f.owner.client.query(api.crm.list, { slug: f.slug });
  expect(board).toMatchObject({ timezone: "Asia/Dhaka", observedAt: NOW });
  expect(board.deals[0]).toMatchObject({ nextStepDate: "2026-11-16", nextStepAt: null, dueDate: "2026-11-16", attention: { overdue: true } });
  expect((await f.owner.client.query(api.crm.detail, { slug: f.slug, id: f.id })).deal).toMatchObject({ nextStepDate: "2026-11-16", timezone: "Asia/Dhaka", attention: { overdue: true } });
  expect(await f.owner.client.query(api.inbox.attention, { slug: f.slug })).toMatchObject({ overdueDeals: 1, dealTimingUnknown: 0 });
  await f.t.run(ctx => ctx.db.patch(f.orgId, { timezone: "America/Los_Angeles" }));
  expect((await f.owner.client.query(api.crm.list, { slug: f.slug })).deals[0].attention.overdue).toBe(false);
  expect(await f.owner.client.query(api.inbox.attention, { slug: f.slug })).toMatchObject({ overdueDeals: 0 });
  await f.t.run(ctx => ctx.db.patch(f.orgId, { timezone: "Unconfirmed" }));
  expect((await f.owner.client.query(api.crm.list, { slug: f.slug })).deals[0].attention).toMatchObject({ overdue: false, nextStepTimingUnknown: true });
  expect(await f.owner.client.query(api.inbox.attention, { slug: f.slug })).toMatchObject({ overdueDeals: 0, dealTimingUnknown: 1 });
  expect((await f.t.run(ctx => ctx.db.get(f.id)))?.stageChangedAt).toBe(before?.stageChangedAt);
  for (const table of ["approvals", "actionReceipts"] as const) expect(await f.t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
});

it("rejects invalid/conflicting dates and lets an owner explicitly replace or clear a due date", async () => {
  const f = await fixture();
  for (const nextStepDate of ["2026-02-29", "2026-11-31", "tomorrow"]) await expect(f.owner.client.mutation(api.crm.update, { slug: f.slug, id: f.id, nextStepDate })).rejects.toThrow(/valid calendar date/);
  await expect(f.owner.client.mutation(api.crm.update, { slug: f.slug, id: f.id, nextStepDate: "2026-11-16", nextStepAt: NOW })).rejects.toThrow(/not both/);
  await f.owner.client.mutation(api.crm.update, { slug: f.slug, id: f.id, nextStepAt: NOW });
  await f.owner.client.mutation(api.crm.update, { slug: f.slug, id: f.id, nextStepDate: "2026-11-18" });
  expect(await f.t.run(ctx => ctx.db.get(f.id))).toMatchObject({ nextStepDate: "2026-11-18" });
  expect((await f.t.run(ctx => ctx.db.get(f.id)))?.nextStepAt).toBeUndefined();
  await f.owner.client.mutation(api.crm.update, { slug: f.slug, id: f.id, nextStepDate: null });
  expect((await f.owner.client.query(api.crm.list, { slug: f.slug })).deals[0]).toMatchObject({ nextStepDate: null, nextStepAt: null, dueDate: null });
  const viewer = await asNewUser(f.t, "date-viewer@example.com");
  await f.t.run(ctx => ctx.db.insert("memberships", { orgId: f.orgId, userId: viewer.userId, role: "viewer", status: "active", createdAt: NOW }));
  await expect(viewer.client.mutation(api.crm.update, { slug: f.slug, id: f.id, nextStepDate: "2026-11-16" })).rejects.toThrow();
});

it("dates automatic deal creation and only genuine stage transitions, without backfilling unknown history", async () => {
  const f = await fixture();
  const prospectId = await f.t.run(async ctx => {
    const campaignId = await ctx.db.insert("outboundCampaigns", { orgId: f.orgId, title: "Intro", brief: { who: "Owner supplied", where: "Unknown", count: 1 }, status: "review", sequence: [], ownerNotes: [], excluded: [], createdBy: f.owner.userId, createdAt: NOW, updatedAt: NOW });
    return ctx.db.insert("prospects", { orgId: f.orgId, campaignId, company: "Example", domain: "example.com", website: "https://example.com", location: "Unknown", sizeBand: "Unknown", why: "Owner supplied", evidence: [], trigger: "Unknown", fit: 0, timing: 0, contact: "Guest", firstLine: "Hello", stage: "replied", createdAt: NOW, updatedAt: NOW });
  });
  const id = await f.t.run(async ctx => syncDealFromProspect(ctx, (await ctx.db.get(prospectId))!, "talking", "outbound"));
  expect((await f.t.run(ctx => ctx.db.get(id)))?.stageChangedAt).toBe(NOW);
  vi.setSystemTime(NOW + 1000);
  await f.t.run(async ctx => syncDealFromProspect(ctx, (await ctx.db.get(prospectId))!, "talking", "outbound"));
  expect((await f.t.run(ctx => ctx.db.get(id)))?.stageChangedAt).toBe(NOW);
  await f.t.run(async ctx => syncDealFromProspect(ctx, (await ctx.db.get(prospectId))!, "booked", "outbound"));
  expect((await f.t.run(ctx => ctx.db.get(id)))?.stageChangedAt).toBe(NOW + 1000);
  await f.t.run(ctx => dealFromBooking(ctx, f.orgId, "Direct guest", undefined, NOW + 86400000));
  expect((await f.owner.client.query(api.crm.list, { slug: f.slug })).deals.find(d => d.name === "Direct guest")?.stageChangedAt).toBe(NOW + 1000);
  await f.t.run(ctx => ctx.db.patch(f.id, { stageChangedAt: undefined }));
  await f.owner.client.mutation(api.crm.update, { slug: f.slug, id: f.id, note: "A new note is not a stage change" });
  expect((await f.owner.client.query(api.crm.list, { slug: f.slug })).deals.find(d => d.id === f.id)?.attention.stageAgeKnown).toBe(false);
});

it("uses the same newest bounded records for Today and the board, with incomplete totals explicit", async () => {
  const f = await fixture();
  await f.t.run(async ctx => {
    for (let i = 0; i < 501; i++) await ctx.db.insert("deals", { orgId: f.orgId, name: `Loaded ${i}`, stage: "talking", source: "manual", currency: "USD", notes: [], nextStepDate: i === 500 ? "2026-11-16" : "2026-11-18", createdAt: NOW, updatedAt: NOW + i + 1 });
  });
  const board = await f.owner.client.query(api.crm.list, { slug: f.slug });
  expect(board.hasMore).toBe(true);
  expect(board.deals.filter(d => d.attention.overdue)).toHaveLength(1);
  expect(await f.owner.client.query(api.inbox.attention, { slug: f.slug })).toMatchObject({ dealAttentionPartial: true, overdueDeals: 1, openDeals: 500 });
});
