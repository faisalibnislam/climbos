import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { replyText } from "../../shared/outbound/sending";
import { asNewUser, makePaid, setup, type T } from "./helpers";

/** Unified inbox: replies land once, AI drafts an answer, the owner sends it from their mailbox (fake transport). */

async function ready(t: T) {
  const owner = await asNewUser(t, "inbox@example.com");
  const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Inbox Co" });
  await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", statement: "More customers", horizonDays: 90, monthlyAdBudget: 0 });
  await makePaid(t, orgId);
  await owner.client.mutation(api.outbound.start, { slug, who: "Agencies", where: "UK", count: 5 });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  const view = await owner.client.query(api.outbound.get, { slug });
  const p = view.prospects[0];
  await t.run(async (ctx) => ctx.db.patch(p.id as Id<"prospects">, { publicEmail: "jane@agency.example" }));
  await owner.client.mutation(api.outbound.setStage, { slug, prospectIds: [p.id], stage: "approved" });
  await owner.client.action(api.mailbox.connect, { slug, preset: "gmail", email: "sam@inbox.example", password: "pw" });
  await owner.client.mutation(api.outboundSending.start, { slug, campaignId: view.campaign!.id as Id<"outboundCampaigns">, senderName: "Sam", company: "Inbox Co", address: "1 High St, London E1 1AA" });
  return { owner, slug, orgId: orgId as Id<"organizations">, campaignId: view.campaign!.id as Id<"outboundCampaigns"> };
}

describe("unified inbox", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.setSystemTime(new Date("2026-10-20T09:00:00Z"));
    process.env.CLIMBOS_FAKE_LLM = "ship";
    process.env.CLIMBOS_FAKE_MAILBOX = "1";
  });
  afterEach(() => {
    vi.useRealTimers();
    delete process.env.CLIMBOS_FAKE_LLM;
    delete process.env.CLIMBOS_FAKE_MAILBOX;
  });

  it("strips quoted history from replies", () => {
    expect(replyText("Sounds good, Tuesday?\n\nOn Mon, 19 Oct 2026, Sam wrote:\n> Hi Jane")).toBe("Sounds good, Tuesday?");
    expect(replyText("Yes please\n> quoted\nThanks")).toBe("Yes please\nThanks");
  });

  it("stores each reply once, drafts an answer and sends it threaded", async () => {
    const t = setup();
    const w = await ready(t);
    const reply = { from: "jane@agency.example", optOut: false, subject: "Quick idea", messageId: "<m1@agency.example>", text: "Interested. What does it cost?", at: Date.now() };
    await t.mutation(internal.outboundSending.applyInbox, { campaignId: w.campaignId, replies: [reply], bounced: [], checkedAt: Date.now() });
    await t.mutation(internal.outboundSending.applyInbox, { campaignId: w.campaignId, replies: [reply], bounced: [], checkedAt: Date.now() });
    let open = await w.owner.client.query(api.inbox.list, { slug: w.slug, box: "open" });
    expect(open).toHaveLength(1);
    expect(open[0]).toMatchObject({ kind: "email", fromEmail: "jane@agency.example", canReply: true });
    expect(await w.owner.client.query(api.inbox.unread, { slug: w.slug })).toBe(1);

    await w.owner.client.mutation(api.inbox.draftReply, { slug: w.slug, id: open[0].id });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    open = await w.owner.client.query(api.inbox.list, { slug: w.slug, box: "open" });
    expect(open[0].status).toBe("suggested");
    expect(open[0].suggestedReply).toBeTruthy();

    const sent = await w.owner.client.action(api.mailbox.reply, { slug: w.slug, id: open[0].id, text: "Hi Jane, it's $15 a month. Want a quick call?" });
    expect(sent).toMatchObject({ ok: true });
    expect(await w.owner.client.query(api.inbox.list, { slug: w.slug, box: "open" })).toHaveLength(0);
    const done = await w.owner.client.query(api.inbox.list, { slug: w.slug, box: "done" });
    expect(done[0]).toMatchObject({ status: "replied" });
  });

  it("won't email people who unsubscribed", async () => {
    const t = setup();
    const w = await ready(t);
    await t.mutation(internal.outboundSending.applyInbox, { campaignId: w.campaignId, replies: [{ from: "jane@agency.example", optOut: false, messageId: "<m2@x>", text: "Tell me more" }], bounced: [], checkedAt: Date.now() });
    const [m] = await w.owner.client.query(api.inbox.list, { slug: w.slug, box: "open" });
    await t.run(async (ctx) => {
      const { sha256Hex } = await import("../../shared/policy");
      await ctx.db.insert("suppressions", { orgId: w.orgId, emailHash: await sha256Hex("jane@agency.example"), reason: "unsubscribe", source: "test", createdAt: Date.now() });
    });
    await expect(w.owner.client.action(api.mailbox.reply, { slug: w.slug, id: m.id, text: "Hello again" })).rejects.toThrow(/unsubscribed/);
  });
});
