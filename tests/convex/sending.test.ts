import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { dailyCap, inSendWindow, isOptOutReply, unsubscribeToken } from "../../shared/outbound/sending";
import { asNewUser, makePaid, setup, type T } from "./helpers";

/** Sending from the owner's mailbox (fake transport): warm-up, follow-ups, replies stop, unsubscribe. Nothing real is sent. */

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
  return { owner, slug, orgId: orgId as Id<"organizations">, campaignId: view.campaign!.id as Id<"outboundCampaigns">, prospectId: p.id as Id<"prospects"> };
}

describe("mailbox sending", () => {
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

  it("pure rules: warm-up ramps 10 → 50 a day, weekdays 8–17 only, 'no' replies opt out", () => {
    const day = 86_400_000;
    expect(dailyCap(null, 0)).toBe(10);
    expect(dailyCap(1, 2 * day + 1)).toBe(20);
    expect(dailyCap(1, 30 * day)).toBe(50);
    expect(inSendWindow(Date.parse("2026-10-20T09:00:00Z"), "UTC")).toBe(true);
    expect(inSendWindow(Date.parse("2026-10-24T09:00:00Z"), "UTC")).toBe(false); // Saturday
    expect(inSendWindow(Date.parse("2026-10-20T19:00:00Z"), "UTC")).toBe(false);
    expect(isOptOutReply("No thanks\n\n> earlier")).toBe(true);
    expect(isOptOutReply("Sounds interesting, call me Tuesday")).toBe(false);
  });

  it("needs a connected mailbox and a postal address; sends step 1, queues the follow-up, and a reply stops it", async () => {
    const t = setup();
    const w = await ready(t);
    const args = { slug: w.slug, campaignId: w.campaignId, senderName: "Sam", company: "Seller Co", address: "1 High St, London E1 1AA" };
    await expect(w.owner.client.mutation(api.outboundSending.start, args)).rejects.toThrow(/Connect your mailbox/);
    await expect(w.owner.client.action(api.mailbox.connect, { slug: w.slug, preset: "gmail", email: "sam@seller.example", password: "abcd efgh ijkl mnop" })).resolves.toMatchObject({ ok: true });
    await expect(w.owner.client.mutation(api.outboundSending.start, { ...args, address: "x" })).rejects.toThrow(/postal address/);
    expect(await w.owner.client.mutation(api.outboundSending.start, args)).toEqual({ queued: 1, skippedActiveAddresses: 0 });
    vi.setSystemTime(new Date("2026-10-20T09:05:00Z"));
    expect(await t.mutation(internal.outboundSending.dispatch, {})).toBe(1);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    let s = await w.owner.client.query(api.outboundSending.status, { slug: w.slug, campaignId: w.campaignId });
    expect(s.counts).toMatchObject({ sent: 1, queued: 1 });
    expect(s.mailbox?.label).toBe("sam@seller.example");
    const prospect = await t.run(async (ctx) => ctx.db.get(w.prospectId));
    expect(prospect?.stage).toBe("contacted");
    // They reply: the follow-up is canceled and the owner is told.
    await t.mutation(internal.outboundSending.applyInbox, { campaignId: w.campaignId, replies: [{ from: "jane@agency.example", optOut: false }], bounced: [], checkedAt: Date.now() });
    s = await w.owner.client.query(api.outboundSending.status, { slug: w.slug, campaignId: w.campaignId });
    expect(s.counts).toMatchObject({ sent: 1, queued: 0, canceled: 1 });
    expect((await w.owner.client.query(api.team.myNotices, {})).items[0].text).toMatch(/replied/);
  });

  it("does not start a prospect sequence while a review invitation to the same address is queued", async () => {
    const t = setup();
    const w = await ready(t);
    await w.owner.client.action(api.mailbox.connect, { slug: w.slug, preset: "gmail", email: "sam@seller.example", password: "pw" });
    await t.run(async (ctx) => ctx.db.insert("reviewRequests", {
      orgId: w.orgId,
      name: "Jane Doe",
      email: "jane@agency.example",
      token: "review-pressure-token",
      status: "queued",
      createdAt: Date.now(),
    }));

    await expect(w.owner.client.mutation(api.outboundSending.start, {
      slug: w.slug,
      campaignId: w.campaignId,
      senderName: "Sam",
      company: "Seller Co",
      address: "1 High St, London E1 1AA",
    })).rejects.toThrow(/another ClimbOS email is already queued/);
    expect(await t.run(async (ctx) => ctx.db.query("outboundSends").collect())).toHaveLength(0);
  });

  it("stops a queued prospect email if a review invitation appears before mailbox handoff", async () => {
    const t = setup();
    const w = await ready(t);
    await w.owner.client.action(api.mailbox.connect, { slug: w.slug, preset: "gmail", email: "sam@seller.example", password: "pw" });
    await w.owner.client.mutation(api.outboundSending.start, {
      slug: w.slug,
      campaignId: w.campaignId,
      senderName: "Sam",
      company: "Seller Co",
      address: "1 High St, London E1 1AA",
    });
    await t.run(async (ctx) => ctx.db.insert("reviewRequests", {
      orgId: w.orgId,
      name: "Jane Doe",
      email: "jane@agency.example",
      token: "review-pressure-before-send",
      status: "queued",
      createdAt: Date.now(),
    }));

    vi.setSystemTime(new Date("2026-10-20T09:05:00Z"));
    expect(await t.mutation(internal.outboundSending.dispatch, {})).toBe(1);
    const send = await t.run(async (ctx) => ctx.db.query("outboundSends").withIndex("by_campaign", (q) => q.eq("campaignId", w.campaignId)).first());
    const job = await t.query(internal.outboundSending.prepareSend, { sendId: send!._id });
    if (!job || job.hold) throw new Error("Expected the queued prospect email to reach its pre-send check.");
    expect(await t.mutation(internal.outboundSending.claimSend, {
      sendId: send!._id,
      lease: send!.lease,
      payloadHash: job.payloadHash,
      ...(job.abTestId ? { abTestId: job.abTestId } : {}),
    })).toBe(false);
    expect((await t.run((ctx) => ctx.db.get(send!._id)))).toMatchObject({ status: "canceled", error: expect.stringContaining("active ClimbOS email") });
  });

  it("an edit to the emails after approval pauses sending; resuming approves the new version", async () => {
    const t = setup();
    const w = await ready(t);
    await w.owner.client.action(api.mailbox.connect, { slug: w.slug, preset: "gmail", email: "sam@seller.example", password: "pw" });
    await w.owner.client.mutation(api.outboundSending.start, { slug: w.slug, campaignId: w.campaignId, senderName: "Sam", company: "Seller Co", address: "1 High St, London E1 1AA" });
    await t.run(async (ctx) => {
      const c = (await ctx.db.get(w.campaignId))!;
      await ctx.db.patch(c._id, { sequence: c.sequence.map((x, i) => (i === 0 ? { ...x, body: `${x.body}\nP.S. unapproved line` } : x)) });
    });
    vi.setSystemTime(new Date("2026-10-20T09:05:00Z"));
    expect(await t.mutation(internal.outboundSending.dispatch, {})).toBe(0);
    let s = await w.owner.client.query(api.outboundSending.status, { slug: w.slug, campaignId: w.campaignId });
    expect(s.sending).toMatchObject({ status: "paused", pausedReason: "content_changed" });
    expect(s.counts.sent ?? 0).toBe(0);
    expect((await w.owner.client.query(api.team.myNotices, {})).items[0].text).toMatch(/changed after you approved/);
    await w.owner.client.mutation(api.outboundSending.setPaused, { slug: w.slug, campaignId: w.campaignId, paused: false });
    expect(await t.mutation(internal.outboundSending.dispatch, {})).toBe(1);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    s = await w.owner.client.query(api.outboundSending.status, { slug: w.slug, campaignId: w.campaignId });
    expect(s.counts.sent).toBe(1);
  });

  it("the unsubscribe link stops the sequence and suppresses the address", async () => {
    const t = setup();
    const w = await ready(t);
    await w.owner.client.action(api.mailbox.connect, { slug: w.slug, preset: "gmail", email: "sam@seller.example", password: "pw" });
    await w.owner.client.mutation(api.outboundSending.start, { slug: w.slug, campaignId: w.campaignId, senderName: "Sam", company: "Seller Co", address: "1 High St, London E1 1AA" });
    const token = await unsubscribeToken(w.prospectId, "test-server-secret");
    await expect(t.mutation(api.outboundSending.unsubscribe, { token: `${w.prospectId}.bad` })).rejects.toThrow(/isn't valid/);
    await t.mutation(api.outboundSending.unsubscribe, { token });
    const s = await w.owner.client.query(api.outboundSending.status, { slug: w.slug, campaignId: w.campaignId });
    expect(s.counts.queued).toBe(0);
    const sup = await t.run(async (ctx) => ctx.db.query("suppressions").collect());
    expect(sup).toHaveLength(1);
  });
});
