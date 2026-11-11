import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { asNewUser, makePaid, setup } from "./helpers";
const asked = vi.hoisted(() => ({ enabled: false }));
vi.mock("../../shared/agents/fake", async (original) => {
  const actual = await original<typeof import("../../shared/agents/fake")>();
  return { ...actual, fakeTurn: async (...args: Parameters<typeof actual.fakeTurn>) => {
    const result = await actual.fakeTurn(...args);
    if (!asked.enabled || !result.ok || !args[0].customTools?.some((tool) => tool.name === "ask_owner")) return result;
    const tools = [{ type: "tool_use" as const, id: "choice-1", name: "ask_owner", input: { title: "How much time is available?", reason: "We need a limit before proposing interviews.", kind: "single", options: [{ id: "small", label: "One hour" }, { id: "more", label: "Three hours" }], allowOther: true } }, { type: "tool_use" as const, id: "should-wait", name: "create_posts", input: { channel: "linkedin", quantity: 2, brief: "This must wait for the answer." } }];
    return { ...result, text: "", appended: [{ role: "assistant" as const, content: tools }], toolUses: tools, stopReason: "tool_use" as const };
  } };
});
afterEach(() => { asked.enabled = false; delete process.env.CLIMBOS_FAKE_LLM; });
describe("owner question answers", () => {
  it("binds the question to its member, validates choices, reserves one turn and rejects replay", async () => {
    const t = setup(); const owner = await asNewUser(t, "question-owner@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Question Co" }); await makePaid(t, orgId);
    const id = await t.mutation(internal.climb.write, { orgId, userId: owner.userId, role: "assistant", status: "done", text: "One quick choice", question: { title: "How much owner time is available?", reason: "We need a limit before planning interviews.", kind: "single", options: [{ id: "small", label: "One hour" }, { id: "more", label: "Three hours" }], allowOther: true, status: "pending" } });
    const screen = { path: `/app/${slug}/today`, title: "Home" };
    await expect(owner.client.mutation(api.climb.send, { slug, text: "ignored", screen, questionResponse: { messageId: id, optionIds: ["alien"], notSure: false } })).rejects.toThrow();
    const stranger = await asNewUser(t, "question-stranger@example.com");
    await expect(stranger.client.mutation(api.climb.send, { slug, text: "ignored", screen, questionResponse: { messageId: id, optionIds: [], notSure: true } })).rejects.toThrow();
    await t.run((ctx) => ctx.db.insert("memberships", { orgId, userId: stranger.userId, role: "editor", status: "active", createdAt: Date.now() }));
    await expect(stranger.client.mutation(api.climb.send, { slug, text: "ignored", screen, questionResponse: { messageId: id, optionIds: [], notSure: true } })).rejects.toThrow(/another conversation/i);
    const result = await owner.client.mutation(api.climb.send, { slug, text: "malicious replacement text", screen, questionResponse: { messageId: id, optionIds: [], notSure: true } });
    const saved = await t.run((ctx) => ctx.db.get(result.messageId));
    expect(saved?.text).toContain("remains unknown"); expect(saved?.text).not.toContain("malicious");
    expect((await t.run((ctx) => ctx.db.get(id)))?.question).toMatchObject({ status: "answered", answerText: "I’m not sure yet" });
    await expect(owner.client.mutation(api.climb.send, { slug, text: "ignored", screen, questionResponse: { messageId: id, optionIds: ["small"], notSure: false } })).rejects.toThrow(/already/i);
  });
  it("shows the question and stops the tool loop before dependent work", async () => {
    process.env.CLIMBOS_FAKE_LLM = "ship"; asked.enabled = true;
    const t = setup(); const owner = await asNewUser(t, "question-loop@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Question Loop" }); await makePaid(t, orgId);
    const sent = await owner.client.mutation(api.climb.send, { slug, text: "Help me prepare the next move", screen: { path: `/app/${slug}/today`, title: "Home" } });
    await owner.client.action(api.climb.respond, { slug, ...sent });
    const thread = await owner.client.query(api.climb.thread, { slug });
    expect(thread.find((message) => message.question)?.question).toMatchObject({ status: "pending", kind: "single" });
    expect(await t.run((ctx) => ctx.db.query("artifacts").collect())).toEqual([]);
    expect((await t.run((ctx) => ctx.db.query("workflowRuns").collect())).map((run) => run.kind)).toEqual(["climb_chat"]);
  });

});
