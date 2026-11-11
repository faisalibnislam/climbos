import { expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { setup, asNewUser } from "./helpers";
import { ZERO_USAGE } from "../../shared/ai/types";
import type { IntakeField } from "../../shared/intake/interview";

const mocked = vi.hoisted(() => ({ turn: vi.fn(), research: vi.fn() }));
vi.mock("../../shared/ai/turn", () => ({ modelTurn: mocked.turn, providerOf: () => "anthropic" }));
vi.mock("../../convex/ai/research", () => ({ researchWebsite: mocked.research, normalizeWebsite: (url: string) => url }));

it("keeps validated business details across an AI repair and offers planning without collecting optional private context", async () => {
  const t = setup(), owner = await asNewUser(t, "intake-repair@example.com");
  const text = "My website is https://business.example. I want more customers.";
  const first = await owner.client.mutation(api.intake.start, { text, requestKey: "repair-memory-start" });
  const state = await owner.client.query(api.intake.view, { slug: first.slug });
  const session = (await t.run(ctx => ctx.db.get(first.conversationId)))!;
  const url = "https://business.example/";
  const websiteText = "We sell handmade cycling belts. For bicycle commuters. One-time purchase.";
  mocked.research.mockResolvedValue({ pages: [{ url, text: websiteText, status: "ok" }] });
  const field = (key: IntakeField["key"], value: string, quote: string): IntakeField => ({ key, value, quote, basis: "website", sourceId: url });
  const result = (updates: IntakeField[]) => ({ ok: true, output: { updates, reply: "How is the business doing today?", choices: [], ready: false }, text: "", costMicros: 0, usage: { ...ZERO_USAGE }, appended: [] });
  mocked.turn.mockResolvedValueOnce(result([
    field("offer", "Handmade cycling belts", "We sell handmade cycling belts."),
    field("audience", "Bicycle commuters", "For bicycle commuters."),
    { key: "goal", value: "More customers", basis: "owner", sourceId: String(first.messageId), quote: "I want more customers." },
    field("businessModel", "One-time purchase", "A fabricated quote that must be repaired"),
  ])).mockResolvedValueOnce(result([field("businessModel", "One-time purchase", "One-time purchase.")]));
  await t.action(internal.intakeActions.respond, { conversationId: session._id, runId: session.activeRunId!, messageId: first.messageId, replyId: state.messages[1].id, revision: session.revision });
  expect(mocked.turn).toHaveBeenCalledTimes(2);
  const saved = await owner.client.query(api.intake.view, { slug: first.slug });
  expect(saved.conversation?.profile).toMatchObject({ website: { value: url }, offer: { value: "Handmade cycling belts", basis: "website" }, audience: { value: "Bicycle commuters" }, businessModel: { value: "One-time purchase" }, goal: { value: "More customers", basis: "owner" } });
  expect(saved.conversation?.ready).toBe(true);
  expect(saved.messages.at(-1)?.text).toBe("I have enough to start. I’ll choose a useful first move and prepare the work.");
  expect(saved.busy).toBe(false);
  expect(mocked.turn.mock.calls[1][0].messages.at(-1).content).toContain("Already retained valid business memory");
});

it("automatically repairs omitted public facts instead of asking optional private questions", async () => {
  const t = setup(), owner = await asNewUser(t, "intake-public-memory@example.com");
  const first = await owner.client.mutation(api.intake.start, { text: "My website is https://business.example. I want more visitors.", requestKey: "public-memory-start" });
  const state = await owner.client.query(api.intake.view, { slug: first.slug });
  const session = (await t.run(ctx => ctx.db.get(first.conversationId)))!;
  const url = "https://business.example/", text = "Mac apps for everyday work. One membership covers every app.";
  mocked.research.mockResolvedValue({ pages: [{ url, text, status: "ok" }] });
  const success = { ok: true, text: "", costMicros: 0, usage: { ...ZERO_USAGE }, appended: [] };
  const goal: IntakeField = { key: "goal", value: "More website visitors", basis: "owner", sourceId: String(first.messageId), quote: "I want more visitors." };
  mocked.turn.mockResolvedValueOnce({ ...success, output: { updates: [goal], reply: "How much time can you spare each week?", choices: [], ready: false } }).mockResolvedValueOnce({ ...success, output: { updates: [
    { key: "offer", value: "Mac apps for everyday work", basis: "website", sourceId: url, quote: "Mac apps for everyday work." },
    { key: "audience", value: "Mac users doing everyday work", basis: "inferred", sourceId: url, quote: "Mac apps for everyday work." },
    { key: "businessModel", value: "An app membership", basis: "website", sourceId: url, quote: "One membership covers every app." },
  ], reply: "I can prepare your plan.", choices: [], ready: true } });
  await t.action(internal.intakeActions.respond, { conversationId: session._id, runId: session.activeRunId!, messageId: first.messageId, replyId: state.messages[1].id, revision: session.revision });
  const saved = await owner.client.query(api.intake.view, { slug: first.slug });
  expect(mocked.turn).toHaveBeenCalledTimes(2);
  expect(saved.conversation?.ready).toBe(true);
  expect(saved.conversation?.profile.resources).toBeUndefined();
  expect(saved.conversation?.profile.stage).toBeUndefined();
  expect(saved.conversation?.profile.audience?.basis).toBe("inferred");
  expect(saved.messages.at(-1)?.text).not.toContain("time");
});
