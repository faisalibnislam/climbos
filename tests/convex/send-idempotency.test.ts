import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { fakeMailbox, resetFakeMailbox } from "../../shared/outbound/fakeMailbox";
import { sendMessageId } from "../../shared/outbound/sending";
import { asNewUser, makePaid, setup, type T } from "./helpers";

/**
 * One cold email goes out at most once (Book 13 §7, Book 14 §11): a stable
 * key per send, leases, a Sent-folder check before any resend, and owner
 * review when that can't be checked. Fake mailbox only; nothing real is sent.
 */

const SENDER = { senderName: "Sam", company: "Seller Co", address: "1 High St, London E1 1AA" };

async function ready(t: T, opts: { prospects?: number; oneStep?: boolean } = {}) {
  const owner = await asNewUser(t, "seller@example.com");
  const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Seller Co" });
  await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", statement: "More customers", horizonDays: 90, monthlyAdBudget: 0 });
  await makePaid(t, orgId);
  await owner.client.mutation(api.outbound.start, { slug, who: "Agencies", where: "UK", count: 5 });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  const view = await owner.client.query(api.outbound.get, { slug });
  const people = view.prospects.slice(0, opts.prospects ?? 1).map((p) => p.id as Id<"prospects">);
  for (const [i, id] of people.entries()) await t.run(async (ctx) => ctx.db.patch(id, { publicEmail: `p${i}@agency${i}.example`, contact: `Pat ${i}` }));
  await owner.client.mutation(api.outbound.setStage, { slug, prospectIds: people, stage: "approved" });
  const campaignId = view.campaign!.id as Id<"outboundCampaigns">;
  if (opts.oneStep) await t.run(async (ctx) => ctx.db.patch(campaignId, { sequence: (await ctx.db.get(campaignId))!.sequence.slice(0, 1) }));
  await owner.client.action(api.mailbox.connect, { slug, preset: "gmail", email: "sam@seller.example", password: "pw" });
  await owner.client.mutation(api.outboundSending.start, { slug, campaignId, ...SENDER });
  return { owner, slug, orgId: orgId as Id<"organizations">, campaignId, people };
}

const rows = (t: T, campaignId: Id<"outboundCampaigns">) => t.run(async (ctx) => (await ctx.db.query("outboundSends").withIndex("by_campaign", (q) => q.eq("campaignId", campaignId)).collect()).sort((a, b) => a.step - b.step || a.createdAt - b.createdAt));
const at = (iso: string) => vi.setSystemTime(new Date(`2026-10-20T${iso}:00Z`));
const dispatch = (t: T) => t.mutation(internal.outboundSending.dispatch, {});
const runAll = (t: T) => t.finishAllScheduledFunctions(vi.runAllTimers);
const notices = (t: T) => t.run(async (ctx) => (await ctx.db.query("notices").collect()).map((n) => n.text));

describe("cold email: one send per key", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    at("09:00"); // Tuesday
    process.env.CLIMBOS_FAKE_LLM = "ship";
    process.env.CLIMBOS_FAKE_MAILBOX = "1";
    resetFakeMailbox();
  });
  afterEach(() => {
    vi.useRealTimers();
    delete process.env.CLIMBOS_FAKE_LLM;
    delete process.env.CLIMBOS_FAKE_MAILBOX;
  });

  it("a duplicate scheduled send makes one send (duplicate row, duplicate worker, stale worker, repeated result)", async () => {
    const t = setup();
    const w = await ready(t);
    // The same email queued twice.
    const [first] = await rows(t, w.campaignId);
    await t.run(async (ctx) => {
      const { _id, _creationTime, ...copy } = first;
      void _id;
      void _creationTime;
      await ctx.db.insert("outboundSends", { ...copy, createdAt: copy.createdAt + 1 });
    });
    at("09:05");
    expect(await dispatch(t)).toBe(1);
    const handed = (await rows(t, w.campaignId)).find((r) => r.status === "sending")!;
    expect(handed.opKey).toMatch(/^[0-9a-f]{64}$/);
    // Two workers at once with the same lease, and one with an old lease: only one may send.
    await Promise.all([
      t.action(internal.mailbox.sendOne, { sendId: handed._id, lease: handed.lease }),
      t.action(internal.mailbox.sendOne, { sendId: handed._id, lease: handed.lease }),
      t.action(internal.mailbox.sendOne, { sendId: handed._id, lease: "stale" }),
    ]);
    await runAll(t);
    // The same result reported twice: one follow-up, not two.
    await t.mutation(internal.outboundSending.recordSend, { sendId: handed._id, lease: handed.lease, ok: true });
    at("09:15");
    await dispatch(t);
    await runAll(t);
    expect(fakeMailbox().sent).toHaveLength(1);
    expect(fakeMailbox().sent[0].messageId).toBe(sendMessageId(handed.opKey!, "sam@seller.example"));
    const after = await rows(t, w.campaignId);
    expect(after.map((r) => `${r.step}:${r.status}`).sort()).toEqual(["0:canceled", "0:sent", "1:queued"]);
    expect(after.find((r) => r.status === "canceled")?.error).toMatch(/Duplicate/);
    const events = await t.run(async (ctx) => ctx.db.query("outboundSendEvents").withIndex("by_campaign", (q) => q.eq("campaignId", w.campaignId)).collect());
    expect(events.map((event) => event.event)).toEqual(expect.arrayContaining(["claimed", "provider_accepted", "duplicate_blocked"]));
    expect(events.every((event) => !("to" in event) && !("body" in event))).toBe(true);
  });

  it("stops an unsent first touch when the owner marks the person contacted", async () => {
    const t = setup();
    const w = await ready(t);
    const [first] = await rows(t, w.campaignId);
    expect(first).toMatchObject({ step: 0, status: "queued" });

    await w.owner.client.mutation(api.outbound.setStage, {
      slug: w.slug,
      prospectIds: [w.people[0]],
      stage: "contacted",
    });
    expect((await rows(t, w.campaignId))[0]).toMatchObject({ step: 0, status: "canceled" });
    at("09:05");
    expect(await dispatch(t)).toBe(0);
    await runAll(t);
    expect(fakeMailbox().sent).toHaveLength(0);
  });

  it("keeps an approved sequence follow-up when the owner stage is contacted", async () => {
    const t = setup();
    const w = await ready(t);
    at("09:05");
    expect(await dispatch(t)).toBe(1);
    await runAll(t);
    expect((await rows(t, w.campaignId)).map((send) => `${send.step}:${send.status}`)).toEqual(["0:sent", "1:queued"]);

    await w.owner.client.mutation(api.outbound.setStage, {
      slug: w.slug,
      prospectIds: [w.people[0]],
      stage: "contacted",
    });
    expect((await rows(t, w.campaignId)).map((send) => `${send.step}:${send.status}`)).toEqual(["0:sent", "1:queued"]);
  });

  it("a worker crash after the mailbox took the email: the Sent folder is checked, no second send", async () => {
    const t = setup();
    const w = await ready(t);
    resetFakeMailbox({ faults: ["crash_after_send"] });
    at("09:05");
    expect(await dispatch(t)).toBe(1);
    await runAll(t);
    let [s] = await rows(t, w.campaignId);
    expect(s).toMatchObject({ status: "sending", attempts: 1 });
    expect(s.claimedAt).toBeTypeOf("number");
    expect(fakeMailbox().sent).toHaveLength(1);
    // Still leased: nothing else goes out for this mailbox meanwhile.
    at("09:12");
    expect(await dispatch(t)).toBe(0);
    // The lease runs out: uncertain, then found in Sent → sent. Never re-queued.
    at("09:30");
    await dispatch(t);
    [s] = await rows(t, w.campaignId);
    expect(s).toMatchObject({ status: "uncertain", reviewReason: "lease_expired" });
    await runAll(t);
    [s] = await rows(t, w.campaignId);
    expect(s).toMatchObject({ status: "sent", messageId: sendMessageId(s.opKey!, "sam@seller.example") });
    expect(fakeMailbox().sent).toHaveLength(1);
    const events = await t.run(async (ctx) => ctx.db.query("outboundSendEvents").withIndex("by_send", (q) => q.eq("sendId", s._id)).collect());
    expect(events.map((event) => event.event)).toEqual(expect.arrayContaining(["claimed", "outcome_uncertain", "sent_folder_confirmed"]));
  });

  it("a lost answer (timeout after the mailbox took it) is checked, not resent", async () => {
    const t = setup();
    const w = await ready(t);
    resetFakeMailbox({ faults: ["timeout_after_send"] });
    at("09:05");
    await dispatch(t);
    await runAll(t);
    const [s] = await rows(t, w.campaignId);
    expect(s.status).toBe("sent");
    expect(fakeMailbox().sent).toHaveLength(1);
  });

  it("a mailbox that can't be checked: the owner decides; it's never resent on its own", async () => {
    const t = setup();
    const w = await ready(t);
    resetFakeMailbox({ faults: ["crash_after_send"], lookup: false });
    at("09:05");
    await dispatch(t);
    await runAll(t);
    at("09:30");
    await dispatch(t);
    await runAll(t);
    let [s] = await rows(t, w.campaignId);
    expect(s).toMatchObject({ status: "uncertain", reviewReason: "unverifiable" });
    expect((await notices(t)).some((n) => /may have sent/.test(n))).toBe(true);
    at("10:30");
    await dispatch(t);
    await runAll(t);
    expect(fakeMailbox().sent).toHaveLength(1);
    const status = await w.owner.client.query(api.outboundSending.status, { slug: w.slug, campaignId: w.campaignId });
    expect(status.counts.uncertain).toBe(1);
    expect(status.review).toEqual([{ id: s._id, to: s.to, step: 0, reason: "unverifiable" }]);
    await w.owner.client.mutation(api.outboundSending.resolveUncertain, { slug: w.slug, sendId: s._id, outcome: "sent" });
    const after = await rows(t, w.campaignId);
    expect(after.map((r) => [r.step, r.status])).toEqual([[0, "sent"], [1, "queued"]]);
    await expect(w.owner.client.mutation(api.outboundSending.resolveUncertain, { slug: w.slug, sendId: s._id, outcome: "resend" })).rejects.toThrow(/Already handled/);
    [s] = after;
    expect(s.messageId).toBe(sendMessageId(s.opKey!, "sam@seller.example"));
  });

  it("an expired lease: unclaimed goes back to the queue (old worker refused); a late success still counts", async () => {
    const t = setup();
    const w = await ready(t);
    at("09:05");
    expect(await dispatch(t)).toBe(1);
    const [old] = await rows(t, w.campaignId);
    // Its worker never started. After the lease it's queued again and handed to a new worker.
    at("09:16");
    expect(await dispatch(t)).toBe(1);
    const [fresh] = await rows(t, w.campaignId);
    expect(fresh).toMatchObject({ status: "sending", attempts: 1, opKey: old.opKey });
    expect(fresh.lease).not.toBe(old.lease);
    await runAll(t); // runs the old worker (refused) and the new one
    expect(fakeMailbox().sent).toHaveLength(1);
    expect((await rows(t, w.campaignId))[0].status).toBe("sent");

    // Another workspace's email: claimed, worker crashed, can't be checked → uncertain. Then the late worker reports success.
    at("09:00");
    const t2 = setup();
    resetFakeMailbox({ faults: ["crash_after_send"], lookup: false });
    const w2 = await ready(t2);
    at("09:05");
    await dispatch(t2);
    await runAll(t2);
    at("09:30");
    await dispatch(t2);
    await runAll(t2);
    const [u] = await rows(t2, w2.campaignId);
    expect(u.status).toBe("uncertain");
    await t2.mutation(internal.outboundSending.recordSend, { sendId: u._id, lease: "someone else", ok: true });
    expect((await rows(t2, w2.campaignId))[0].status).toBe("uncertain");
    await t2.mutation(internal.outboundSending.recordSend, { sendId: u._id, lease: u.lease, ok: true, messageId: "<late@x>" });
    expect((await rows(t2, w2.campaignId))[0]).toMatchObject({ status: "sent", messageId: "<late@x>" });
  });

  it("a changed email under the same key is refused until the owner approves sending again", async () => {
    const t = setup();
    const w = await ready(t);
    resetFakeMailbox({ faults: ["reject"] });
    at("09:05");
    await dispatch(t);
    await runAll(t);
    let [s] = await rows(t, w.campaignId);
    expect(s).toMatchObject({ status: "queued", attempts: 1 });
    expect(s.payloadHash).toMatch(/^[0-9a-f]{64}$/);
    // The prospect's opener changes; the approved sequence (and so the key) doesn't.
    await t.run(async (ctx) => ctx.db.patch(w.people[0], { firstLine: "A brand new opener line." }));
    at("09:40");
    expect(await dispatch(t)).toBe(1);
    await runAll(t);
    [s] = await rows(t, w.campaignId);
    expect(s).toMatchObject({ status: "uncertain", reviewReason: "payload_changed" });
    expect(fakeMailbox().sent).toHaveLength(0);
    expect((await notices(t)).some((n) => /may have sent/.test(n))).toBe(true);
    await w.owner.client.mutation(api.outboundSending.resolveUncertain, { slug: w.slug, sendId: s._id, outcome: "resend" });
    at("09:50");
    expect(await dispatch(t)).toBe(1);
    await runAll(t);
    expect(fakeMailbox().sent).toHaveLength(1);
    expect(fakeMailbox().sent[0].text).toContain("A brand new opener line.");
  });

  it("a revoked mailbox stops sending without retrying", async () => {
    const t = setup();
    const w = await ready(t);
    at("09:05");
    expect(await dispatch(t)).toBe(1);
    await w.owner.client.mutation(api.connections.disconnect, { slug: w.slug, provider: "email_mailbox" });
    await runAll(t);
    let [s] = await rows(t, w.campaignId);
    expect(s).toMatchObject({ status: "queued", attempts: 0 });
    for (const time of ["09:15", "10:00", "11:00"]) {
      at(time);
      expect(await dispatch(t)).toBe(0);
      await runAll(t);
    }
    [s] = await rows(t, w.campaignId);
    expect(s).toMatchObject({ status: "queued", attempts: 0 });
    expect(fakeMailbox().sent).toHaveLength(0);
  });

  it("a mailbox that refuses the sign-in is marked expired; nothing is retried", async () => {
    const t = setup();
    const w = await ready(t);
    resetFakeMailbox({ faults: ["auth"] });
    at("09:05");
    await dispatch(t);
    await runAll(t);
    const [s] = await rows(t, w.campaignId);
    expect(s).toMatchObject({ status: "queued", attempts: 0, error: "Mailbox sign-in failed" });
    expect((await t.run(async (ctx) => ctx.db.query("connections").withIndex("by_org_provider", (q) => q.eq("orgId", w.orgId).eq("provider", "email_mailbox")).first()))?.status).toBe("expired");
    expect((await notices(t)).some((n) => /sign-in stopped working/.test(n))).toBe(true);
    at("10:00");
    expect(await dispatch(t)).toBe(0);
    expect(fakeMailbox().sent).toHaveLength(0);
  });

  it("batches: each recipient has its own result; one sent doesn't finish the campaign", async () => {
    const t = setup();
    const w = await ready(t, { prospects: 2, oneStep: true });
    at("09:05");
    expect(await dispatch(t)).toBe(1);
    await runAll(t);
    resetFakeMailbox({ faults: ["crash_after_send"], lookup: false });
    at("09:15");
    expect(await dispatch(t)).toBe(1);
    await runAll(t);
    at("09:40");
    await dispatch(t);
    await runAll(t);
    expect((await rows(t, w.campaignId)).map((r) => r.status).sort()).toEqual(["sent", "uncertain"]);
    at("09:50");
    await dispatch(t);
    let c = await t.run(async (ctx) => ctx.db.get(w.campaignId));
    expect(c?.sending?.status).toBe("on");
    const status = await w.owner.client.query(api.outboundSending.status, { slug: w.slug, campaignId: w.campaignId });
    expect(status.counts).toMatchObject({ sent: 1, uncertain: 1, queued: 0 });
    await w.owner.client.mutation(api.outboundSending.resolveUncertain, { slug: w.slug, sendId: status.review[0].id, outcome: "skip" });
    at("10:00");
    await dispatch(t);
    c = await t.run(async (ctx) => ctx.db.get(w.campaignId));
    expect(c?.sending?.status).toBe("done");
  });
});
