import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { sha256Hex } from "../../shared/policy";
import { isAutoReply, isOptOutReply } from "../../shared/outbound/sending";
import { asNewUser, makePaid, setup, type T } from "./helpers";

/** Outbound sending safety (fake mailbox, nothing real is sent): opt-outs, booking links, per-mailbox limits, send-time checks, roles. */

const SENDER = { senderName: "Sam", company: "Seller Co", address: "1 High St, London E1 1AA", bookingUrl: "https://climbos.app/book/seller-co" };

async function ready(t: T) {
  const owner = await asNewUser(t, "seller@example.com");
  const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Seller Co" });
  await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", statement: "More customers", horizonDays: 90, monthlyAdBudget: 0 });
  await makePaid(t, orgId);
  await owner.client.mutation(api.outbound.start, { slug, who: "Agencies", where: "UK", count: 5 });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  const view = await owner.client.query(api.outbound.get, { slug });
  const p = view.prospects[0];
  await t.run(async (ctx) => ctx.db.patch(p.id as Id<"prospects">, { publicEmail: "jane@agency.example", contact: "Jane Doe" }));
  await owner.client.mutation(api.outbound.setStage, { slug, prospectIds: [p.id], stage: "approved" });
  await owner.client.action(api.mailbox.connect, { slug, preset: "gmail", email: "sam@seller.example", password: "pw" });
  return { owner, slug, orgId: orgId as Id<"organizations">, campaignId: view.campaign!.id as Id<"outboundCampaigns">, prospectId: p.id as Id<"prospects">, others: view.prospects.slice(1).map((x) => x.id as Id<"prospects">), pageSlug: view.page!.slug };
}

const sends = (t: T, campaignId: Id<"outboundCampaigns">) => t.run(async (ctx) => ctx.db.query("outboundSends").withIndex("by_campaign", (q) => q.eq("campaignId", campaignId)).collect());

describe("outbound sending safety", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.setSystemTime(new Date("2026-10-20T09:00:00Z")); // Tuesday, 09:00 UTC
    process.env.CLIMBOS_FAKE_LLM = "ship";
    process.env.CLIMBOS_FAKE_MAILBOX = "1";
  });
  afterEach(() => {
    vi.useRealTimers();
    delete process.env.CLIMBOS_FAKE_LLM;
    delete process.env.CLIMBOS_FAKE_MAILBOX;
  });

  it("opt-out and auto-reply detection: only clear opt-outs stop as unsubscribes", () => {
    for (const no of ["No", "No.", "nope", "STOP", "Unsubscribe", "No thanks", "No, thank you!", "Not interested, thanks.", "Please remove me from your list", "Hi, take me off this list please"]) expect(isOptOutReply(no), no).toBe(true);
    for (const yes of ["No problem, Tuesday works", "No worries! Call me Thursday", "Nope, not yet, but send the deck", "Sounds interesting, call me Tuesday", "Stop by our office any time", "No rush"]) expect(isOptOutReply(yes), yes).toBe(false);
    expect(isAutoReply("From: a@b.c\r\nAuto-Submitted: auto-replied\r\n", "Re: hello")).toBe(true);
    expect(isAutoReply("Auto-Submitted: no\r\n", "Re: hello")).toBe(false);
    expect(isAutoReply("X-Autoreply: yes\n", "")).toBe(true);
    expect(isAutoReply("", "Automatic reply: Quick question")).toBe(true);
    expect(isAutoReply("", "Out of Office: back Monday")).toBe(true);
    expect(isAutoReply("", "Re: Quick question")).toBe(false);
  });

  it("cold emails carry the prospect on the booking link; a booking by email stops follow-ups and joins their deal", async () => {
    const t = setup();
    const w = await ready(t);
    await w.owner.client.mutation(api.outboundSending.start, { slug: w.slug, campaignId: w.campaignId, ...SENDER });
    vi.setSystemTime(new Date("2026-10-20T09:05:00Z"));
    expect(await t.mutation(internal.outboundSending.dispatch, {})).toBe(1);
    const [s] = await sends(t, w.campaignId);
    const job = await t.query(internal.outboundSending.prepareSend, { sendId: s._id });
    expect(job && !job.hold && job.text).toContain(`${SENDER.bookingUrl}?ref=${w.prospectId}`);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await sends(t, w.campaignId)).map((x) => x.status).sort()).toEqual(["queued", "sent"]);
    // They book from a forwarded link without ?ref: matched by their email.
    const page = (await t.query(api.outbound.publicPage, { slug: w.pageSlug }))!;
    await t.mutation(api.outbound.book, { slug: w.pageSlug, startAt: page.slots[0], name: "Jane", email: "Jane@Agency.example" });
    expect((await t.run(async (ctx) => ctx.db.get(w.prospectId)))?.stage).toBe("booked");
    expect((await sends(t, w.campaignId)).map((x) => x.status).sort()).toEqual(["canceled", "sent"]);
    const deals = await t.run(async (ctx) => ctx.db.query("deals").collect());
    expect(deals).toHaveLength(1);
    expect(deals[0]).toMatchObject({ prospectId: w.prospectId, stage: "booked" });
    // The owner cancels: the deal goes back to talking.
    const booking = (await t.run(async (ctx) => ctx.db.query("bookings").first()))!;
    await w.owner.client.mutation(api.outbound.cancelBooking, { slug: w.slug, bookingId: booking._id });
    expect((await t.run(async (ctx) => ctx.db.query("deals").first()))?.stage).toBe("talking");
    expect((await t.run(async (ctx) => ctx.db.get(w.prospectId)))?.stage).toBe("replied");
  });

  it("an opt-out after an earlier reply still suppresses; replies are processed once", async () => {
    const t = setup();
    const w = await ready(t);
    await w.owner.client.mutation(api.outboundSending.start, { slug: w.slug, campaignId: w.campaignId, ...SENDER });
    const reply = { from: "jane@agency.example", optOut: false, messageId: "<m1@agency>", text: "Sounds good, tell me more", at: Date.now() };
    await t.mutation(internal.outboundSending.applyInbox, { campaignId: w.campaignId, replies: [reply], bounced: [], checkedAt: Date.now() });
    await t.mutation(internal.outboundSending.applyInbox, { campaignId: w.campaignId, replies: [reply], bounced: [], checkedAt: Date.now() });
    expect(await t.run(async (ctx) => (await ctx.db.query("communityMessages").collect()).filter((m) => m.kind === "email").length)).toBe(1);
    expect((await t.run(async (ctx) => ctx.db.get(w.prospectId)))?.stage).toBe("replied");
    await t.mutation(internal.outboundSending.applyInbox, { campaignId: w.campaignId, replies: [{ from: "jane@agency.example", optOut: true, messageId: "<m2@agency>", text: "Actually, please remove me", at: Date.now() }], bounced: [], checkedAt: Date.now() });
    const hash = await sha256Hex("jane@agency.example");
    expect(await t.run(async (ctx) => ctx.db.query("suppressions").withIndex("by_org_email", (q) => q.eq("orgId", w.orgId).eq("emailHash", hash)).first())).not.toBeNull();
    expect((await t.run(async (ctx) => ctx.db.get(w.prospectId)))?.stage).toBe("lost");
    expect((await sends(t, w.campaignId)).every((x) => x.status !== "queued")).toBe(true);
  });

  it("send-time checks: an emergency stop holds the email in the queue; an unsubscribe since queueing cancels it", async () => {
    const t = setup();
    const w = await ready(t);
    await w.owner.client.mutation(api.outboundSending.start, { slug: w.slug, campaignId: w.campaignId, ...SENDER });
    vi.setSystemTime(new Date("2026-10-20T09:05:00Z"));
    expect(await t.mutation(internal.outboundSending.dispatch, {})).toBe(1);
    await t.run(async (ctx) => ctx.db.patch(w.orgId, { emergencyStop: { active: true, at: Date.now(), by: w.owner.userId } }));
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await sends(t, w.campaignId)).map((x) => [x.status, x.attempts])).toEqual([["queued", 0]]);
    await t.run(async (ctx) => ctx.db.patch(w.orgId, { emergencyStop: undefined }));
    await t.run(async (ctx) => ctx.db.insert("suppressions", { orgId: w.orgId, emailHash: await sha256Hex("jane@agency.example"), reason: "unsubscribe", source: "test", createdAt: Date.now() }));
    vi.setSystemTime(new Date("2026-10-20T09:15:00Z"));
    expect(await t.mutation(internal.outboundSending.dispatch, {})).toBe(1);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await sends(t, w.campaignId)).map((x) => x.status)).toEqual(["canceled"]);
  });

  it("Find more pauses the old campaign's sending (shown under Send); one warm-up cap and spacing per mailbox across campaigns", async () => {
    const t = setup();
    const w = await ready(t);
    await w.owner.client.mutation(api.outboundSending.start, { slug: w.slug, campaignId: w.campaignId, ...SENDER });
    const r = await w.owner.client.mutation(api.outbound.start, { slug: w.slug, who: "Shops", where: "UK", count: 5 });
    expect(r.pausedSending).toBe(true);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const a = (await t.run(async (ctx) => ctx.db.get(w.campaignId)))!;
    expect(a).toMatchObject({ status: "archived", sending: { status: "paused", pausedReason: "archived" } });
    // Campaign B gets its own prospect and starts sending.
    const bId = r.campaignId as Id<"outboundCampaigns">;
    const pB = await t.run(async (ctx) => {
      const p = (await ctx.db.get(w.prospectId))!;
      const { _id, _creationTime, ...rest } = p;
      void _id;
      void _creationTime;
      return ctx.db.insert("prospects", { ...rest, campaignId: bId, company: "Bee Co", domain: "bee.example", website: "https://bee.example", publicEmail: "hi@bee.example", stage: "approved" });
    });
    await w.owner.client.mutation(api.outboundSending.start, { slug: w.slug, campaignId: bId, ...SENDER });
    let status = await w.owner.client.query(api.outboundSending.status, { slug: w.slug, campaignId: bId });
    expect(status.others).toEqual([{ id: w.campaignId, title: a.title, status: "paused", pausedReason: "archived" }]);
    // The owner resumes A: now two campaigns share one mailbox.
    await w.owner.client.mutation(api.outboundSending.setPaused, { slug: w.slug, campaignId: w.campaignId, paused: false });
    vi.setSystemTime(new Date("2026-10-20T09:05:00Z"));
    expect(await t.mutation(internal.outboundSending.dispatch, {})).toBe(1); // not one per campaign
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.mutation(internal.outboundSending.dispatch, {})).toBe(0); // spacing applies across campaigns
    // A cap of 1 a day for the mailbox: the other campaign's email waits for tomorrow.
    await t.run(async (ctx) => {
      const c = (await ctx.db.get(bId))!;
      await ctx.db.patch(bId, { sending: { ...c.sending!, dailyCapOverride: 1 } });
    });
    vi.setSystemTime(new Date("2026-10-20T09:20:00Z"));
    expect(await t.mutation(internal.outboundSending.dispatch, {})).toBe(0);
    status = await w.owner.client.query(api.outboundSending.status, { slug: w.slug, campaignId: bId });
    expect(status).toMatchObject({ sentToday: 1, capToday: 1 });
    vi.setSystemTime(new Date("2026-10-21T09:00:00Z"));
    expect(await t.mutation(internal.outboundSending.dispatch, {})).toBe(1);
    void pB;
  });

  it("people approved after sending started can be added; the reply watch reads only new mail and stops 21 days after the last email", async () => {
    const t = setup();
    const w = await ready(t);
    await w.owner.client.mutation(api.outboundSending.start, { slug: w.slug, campaignId: w.campaignId, ...SENDER });
    await t.run(async (ctx) => ctx.db.patch(w.others[0], { publicEmail: "max@second.example" }));
    await w.owner.client.mutation(api.outbound.setStage, { slug: w.slug, prospectIds: [w.others[0]], stage: "approved" });
    let status = await w.owner.client.query(api.outboundSending.status, { slug: w.slug, campaignId: w.campaignId });
    expect(status.newlyApproved).toBe(1);
    expect(await w.owner.client.mutation(api.outboundSending.addApproved, { slug: w.slug, campaignId: w.campaignId })).toEqual({ queued: 1, paused: false });
    status = await w.owner.client.query(api.outboundSending.status, { slug: w.slug, campaignId: w.campaignId });
    expect(status.newlyApproved).toBe(0);
    await expect(w.owner.client.mutation(api.outboundSending.addApproved, { slug: w.slug, campaignId: w.campaignId })).rejects.toThrow(/Nobody new/);

    vi.setSystemTime(new Date("2026-10-20T09:05:00Z"));
    await t.mutation(internal.outboundSending.dispatch, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const checkedAt = Date.parse("2026-10-20T10:00:00Z");
    await t.mutation(internal.outboundSending.applyInbox, { campaignId: w.campaignId, replies: [], bounced: [], checkedAt });
    let targets = await t.query(internal.outboundSending.replyCheckTargets, {});
    expect(targets[0].since).toBe(checkedAt - 10 * 60_000);
    // Finished, last email 22 days ago: no more reading.
    await t.run(async (ctx) => {
      const c = (await ctx.db.get(w.campaignId))!;
      await ctx.db.patch(w.campaignId, { sending: { ...c.sending!, status: "done", lastSentAt: Date.now() - 22 * 86_400_000, lastReplyCheckAt: Date.now() } });
    });
    targets = await t.query(internal.outboundSending.replyCheckTargets, {});
    expect(targets).toHaveLength(0);
  });

  it("roles: editors can't approve who gets emailed; reviewers approve but can't edit the pipeline; anyone who can pause can pause", async () => {
    const t = setup();
    const w = await ready(t);
    const member = async (email: string, role: "editor" | "reviewer") => {
      const u = await asNewUser(t, email);
      await t.run(async (ctx) => ctx.db.insert("memberships", { orgId: w.orgId, userId: u.userId, role, status: "active", createdAt: Date.now() }));
      return u.client;
    };
    const editor = await member("ed@example.com", "editor");
    const reviewer = await member("rev@example.com", "reviewer");
    await expect(editor.mutation(api.outbound.setStage, { slug: w.slug, prospectIds: [w.others[0]], stage: "approved" })).rejects.toThrow(/can't do this/);
    await editor.mutation(api.outbound.setStage, { slug: w.slug, prospectIds: [w.others[0]], stage: "won" });
    await reviewer.mutation(api.outbound.setStage, { slug: w.slug, prospectIds: [w.others[1]], stage: "skipped" });
    await expect(reviewer.mutation(api.outbound.setStage, { slug: w.slug, prospectIds: [w.others[1]], stage: "lost" })).rejects.toThrow(/can't do this/);
    const view = await editor.query(api.outbound.get, { slug: w.slug });
    expect(view).toMatchObject({ canApprove: false, canEdit: true, canExport: false });
    await w.owner.client.mutation(api.outboundSending.start, { slug: w.slug, campaignId: w.campaignId, ...SENDER });
    await editor.mutation(api.outboundSending.setPaused, { slug: w.slug, campaignId: w.campaignId, paused: true });
    await expect(editor.mutation(api.outboundSending.setPaused, { slug: w.slug, campaignId: w.campaignId, paused: false })).rejects.toThrow(/can't do this/);
    expect((await editor.query(api.outboundSending.status, { slug: w.slug, campaignId: w.campaignId })).can).toEqual({ approve: false, pause: true, connect: false });
  });
});
