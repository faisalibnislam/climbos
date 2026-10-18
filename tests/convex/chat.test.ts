import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { asNewUser, makePaid, setup } from "./helpers";

const VID = "visitor-0001-abcd";
/** What the /api/chat route adds: the server secret and a salted IP hash. */
const SERVER = { serverSecret: "test-server-secret", ipHash: "a".repeat(64) };

describe("website chat", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    process.env.CLIMBOS_FAKE_LLM = "ship";
  });
  afterEach(() => {
    vi.useRealTimers();
    delete process.env.CLIMBOS_FAKE_LLM;
  });

  it("free: messages reach the Inbox, no AI; emails become leads", async () => {
    const t = setup();
    const owner = await asNewUser(t, "chat@example.com");
    const { slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Chat Co" });
    const key = await owner.client.mutation(api.chat.setup, { slug });
    await t.mutation(api.chat.send, { ...SERVER, key, visitorId: VID, text: "Do you ship to Spain?" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    let w = await t.query(api.chat.widget, { key, visitorId: VID });
    expect(w?.messages.map((m) => m.role)).toEqual(["visitor"]);
    await t.mutation(api.chat.send, { ...SERVER, key, visitorId: VID, text: "I'm ana@shop.example" });
    const inbox = await owner.client.query(api.inbox.list, { slug, box: "open" });
    expect(inbox).toHaveLength(1);
    expect(inbox[0]).toMatchObject({ kind: "chat", from: "ana@shop.example", canReply: true });
    expect((await owner.client.query(api.crm.list, { slug })).deals[0]).toMatchObject({ email: "ana@shop.example", stage: "lead" });
    w = await t.query(api.chat.widget, { key, visitorId: VID });
    expect(w?.hasEmail).toBe(true);
  });

  it("only the server route can post, and limits count per IP across made-up visitor ids", async () => {
    const t = setup();
    const owner = await asNewUser(t, "chat3@example.com");
    const { slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Chat Co" });
    const key = await owner.client.mutation(api.chat.setup, { slug });
    await expect(t.mutation(api.chat.send, { serverSecret: "guess", ipHash: SERVER.ipHash, key, visitorId: VID, text: "hi" })).rejects.toThrow(/Not allowed/);
    // A new visitor id per message doesn't get around the per-IP limits.
    const vid = (i: number) => `visitor-spam-${String(i).padStart(4, "0")}`;
    for (let i = 0; i < 8; i++) await t.mutation(api.chat.send, { ...SERVER, key, visitorId: vid(i), text: `hello ${i}` });
    await expect(t.mutation(api.chat.send, { ...SERVER, key, visitorId: vid(8), text: "again" })).rejects.toThrow(/Slow down/);
    // A few minutes later: at most 10 new chats a day from one IP.
    vi.setSystemTime(Date.now() + 5 * 60_000);
    await t.mutation(api.chat.send, { ...SERVER, key, visitorId: vid(8), text: "hello 8" });
    await t.mutation(api.chat.send, { ...SERVER, key, visitorId: vid(9), text: "hello 9" });
    await expect(t.mutation(api.chat.send, { ...SERVER, key, visitorId: vid(10), text: "hello 10" })).rejects.toThrow(/busy/);
    // Someone else (another IP) still gets through.
    await t.mutation(api.chat.send, { ...SERVER, ipHash: "b".repeat(64), key, visitorId: VID, text: "Do you ship to Spain?" });
  });

  it("packages: Climb AI answers until the owner takes over", async () => {
    const t = setup();
    const owner = await asNewUser(t, "chat2@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Chat Co" });
    await makePaid(t, orgId);
    const key = await owner.client.mutation(api.chat.setup, { slug });
    await t.mutation(api.chat.send, { ...SERVER, key, visitorId: VID, text: "What does it cost?" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    let w = await t.query(api.chat.widget, { key, visitorId: VID });
    expect(w?.messages.map((m) => m.role)).toEqual(["visitor", "ai"]);
    expect(w?.waitingSince).toBeNull();
    const [item] = await owner.client.query(api.inbox.list, { slug, box: "open" });
    const thread = (await owner.client.query(api.chat.thread, { slug, inboxId: item.id }))!;
    await owner.client.mutation(api.chat.ownerReply, { slug, threadId: thread.threadId, text: "Hi! It's $15 a month." });
    await t.mutation(api.chat.send, { ...SERVER, key, visitorId: VID, text: "Great, thanks" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    w = await t.query(api.chat.widget, { key, visitorId: VID });
    expect(w?.messages.map((m) => m.role)).toEqual(["visitor", "ai", "owner", "visitor"]);
    // Another workspace can't answer this chat.
    const other = await asNewUser(t, "intruder@example.com");
    const o = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Other" });
    await expect(other.client.mutation(api.chat.ownerReply, { slug: o.slug, threadId: thread.threadId, text: "hi" })).rejects.toThrow();
  });
});
