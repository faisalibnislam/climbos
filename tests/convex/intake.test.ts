import { expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { setup, asNewUser } from "./helpers";
import type { IntakeField } from "../../shared/intake/interview";

const wish = "I want more customers.";
it("saves a website answer before the model runs and retains it when extraction omits it", async () => {
  const t = setup(), owner = await asNewUser(t, "website-memory-owner@example.com");
  const first = await owner.client.mutation(api.intake.start, { text: wish, requestKey: "website-memory-start" });
  const before = await owner.client.query(api.intake.view, { slug: first.slug });
  const session = (await t.run(ctx => ctx.db.get(first.conversationId)))!;
  await t.mutation(internal.intake.complete, { conversationId: session._id, runId: session.activeRunId!, replyId: before.messages[1].id, revision: session.revision, output: JSON.stringify({ reply: "What is your website?", updates: [], ready: false, choices: [] }), sources: "[]" });
  await t.mutation(internal.engine.finishRun, { runId: session.activeRunId!, status: "verified" });
  await owner.client.mutation(api.intake.send, { slug: first.slug, text: "https://business.example", requestKey: "website-memory-answer" });
  const pending = await owner.client.query(api.intake.view, { slug: first.slug });
  expect(pending.conversation?.profile.website?.value).toBe("https://business.example/");
  const working = (await t.run(ctx => ctx.db.get(first.conversationId)))!;
  await t.mutation(internal.intake.complete, { conversationId: working._id, runId: working.activeRunId!, replyId: pending.messages.at(-1)!.id, revision: working.revision, output: JSON.stringify({ reply: "Tell me what you sell.", updates: [], ready: false, choices: [] }), sources: "[]" });
  const saved = await owner.client.query(api.intake.view, { slug: first.slug });
  expect(saved.conversation?.profile.website?.value).toBe("https://business.example/");
  expect(saved.conversation?.ready).toBe(false);
});

it("starts with a saved wish and one budgeted AI reply, not a plan or staged questionnaire", async () => {
  const t = setup(), owner = await asNewUser(t, "intake-owner@example.com"), other = await asNewUser(t, "intake-other@example.com");
  const args = { text: wish, requestKey: "one-stable-request" };
  const first = await owner.client.mutation(api.intake.start, args);
  expect(await owner.client.mutation(api.intake.start, args)).toEqual(first);
  const state = await owner.client.query(api.intake.view, { slug: first.slug });
  expect(state.messages.map(m => [m.role, m.status])).toEqual([["user", "done"], ["assistant", "working"]]);
  expect(state.messages[0].text).toBe(wish);
  expect(state.conversation?.ready).toBe(false);
  expect(state.busy).toBe(true);
  await expect(owner.client.mutation(api.intake.send, { slug: first.slug, text: "Second message", requestKey: "second-stable-key" })).rejects.toThrow(/still working/);
  await expect(other.client.query(api.intake.view, { slug: first.slug })).rejects.toThrow();
  await expect(owner.client.mutation(api.intake.beginPlan, { slug: first.slug, revision: state.conversation!.revision, requestKey: "plan-pending-test" })).rejects.toThrow();
  await t.run(async ctx => {
    expect(await ctx.db.query("organizations").collect()).toHaveLength(1);
    expect(await ctx.db.query("usagePeriods").collect()).toHaveLength(1);
    const runs = await ctx.db.query("workflowRuns").collect();
    expect(runs).toHaveLength(1); expect(runs[0].kind).toBe("climb_chat");
    expect(await ctx.db.query("goals").collect()).toHaveLength(0);
    expect(await ctx.db.query("strategies").collect()).toHaveLength(0);
  });
  const session = await t.run(ctx => ctx.db.get(first.conversationId));
  expect(await t.mutation(internal.intake.claim, { conversationId: session!._id, runId: session!.activeRunId! })).toBe(true);
  expect(await t.mutation(internal.intake.claim, { conversationId: session!._id, runId: session!.activeRunId! })).toBe(false);
});

it("refuses premature readiness and saves a genuine website follow-up instead of saying the business is known", async () => {
  const t = setup(), owner = await asNewUser(t, "followup-owner@example.com");
  const first = await owner.client.mutation(api.intake.start, { text: wish, requestKey: "wish-only-followup" });
  const state = await owner.client.query(api.intake.view, { slug: first.slug });
  const session = (await t.run(ctx => ctx.db.get(first.conversationId)))!;
  const output = { reply: "Ready to plan.", ready: true, choices: [], updates: [{ key: "goal", value: wish, basis: "owner", sourceId: first.messageId, quote: wish }] };
  await t.mutation(internal.intake.complete, { conversationId: first.conversationId, runId: session.activeRunId!, revision: session.revision, replyId: state.messages[1].id, output: JSON.stringify(output), sources: "[]" });
  await t.mutation(internal.engine.finishRun, { runId: session.activeRunId!, status: "verified" });
  const saved = await owner.client.query(api.intake.view, { slug: first.slug });
  expect(saved.conversation?.ready).toBe(false);
  expect(saved.messages[1].text).toContain("website");
  expect(saved.messages[1].text).not.toContain("Ready to plan.");
  await expect(owner.client.mutation(api.intake.beginPlan, { slug: first.slug, revision: session.revision, requestKey: "stable-plan-request" })).rejects.toThrow(/business context/);
  expect((await owner.client.query(api.intake.view, { slug: first.slug })).messages).toEqual(saved.messages);
});

it("binds a completed interview snapshot to one plan, with no profile loss or duplicate plan charge", async () => {
  const t = setup(), owner = await asNewUser(t, "ready-intake@example.com");
  const text = "I want more local customers. We have no website. We sell handmade cycling belts for bicycle commuters. One-time paid purchases. We are pre-launch. I have two hours a week. I don't know my ad budget.";
  const first = await owner.client.mutation(api.intake.start, { text, requestKey: "complete-interview" });
  const state = await owner.client.query(api.intake.view, { slug: first.slug });
  const session = (await t.run(ctx => ctx.db.get(first.conversationId)))!;
  const f = (key: IntakeField["key"], value: string, quote: string): IntakeField => ({ key, value, quote, basis: "owner", sourceId: first.messageId });
  const updates = [f("goal", "I want more local customers.", "I want more local customers."), f("website", "none", "We have no website."), f("offer", "Handmade cycling belts", "We sell handmade cycling belts"), f("audience", "Bicycle commuters", "for bicycle commuters"), f("businessModel", "One-time paid purchases", "One-time paid purchases."), f("stage", "pre-launch", "We are pre-launch."), f("resources", "Two hours a week; ad budget unknown", "I have two hours a week. I don't know my ad budget.")];
  await t.mutation(internal.intake.complete, { conversationId: first.conversationId, runId: session.activeRunId!, revision: session.revision, replyId: state.messages[1].id, sources: "[]", output: JSON.stringify({ reply: "Which channel do you think your visitors will find you through first?", ready: false, choices: ["Social media"], updates }) });
  await t.mutation(internal.engine.finishRun, { runId: session.activeRunId!, status: "verified" });
  const readyView = await owner.client.query(api.intake.view, { slug: first.slug });
  expect(readyView.conversation?.ready).toBe(true);
  expect(readyView.messages.at(-1)?.text).not.toContain("Which channel");
  expect(readyView.messages.at(-1)?.text.split(/\s+/).length).toBeLessThanOrEqual(45);
  await t.run(ctx => ctx.db.patch(first.conversationId, { ready: false })); // Recover an older interview that kept asking optional questions.
  expect((await owner.client.query(api.intake.view, { slug: first.slug })).conversation?.ready).toBe(true);
  const result = await owner.client.mutation(api.intake.beginPlan, { slug: first.slug, revision: session.revision, requestKey: "stable-plan-request" });
  expect(await owner.client.mutation(api.intake.beginPlan, { slug: first.slug, revision: session.revision, requestKey: "stable-plan-request" })).toEqual(result);
  const run = (await t.run(ctx => ctx.db.get(result.runId)))!;
  const input = JSON.parse(run.input);
  expect(JSON.parse(input.intakeSnapshot).fields.offer.value).toBe("Handmade cycling belts");
  const context = await t.query(internal.jobWrites.jobContext, { runId: result.runId });
  expect(context?.intakeBrief).toContain("Bicycle commuters");
  expect(context?.intakeBrief).toContain("ad budget unknown");
  expect(context?.business?.unitEconomics?.ownerHoursPerWeek).toBe(2);
  expect(context?.goal?.monthlyAdBudgetMinor).toBe(0);
  expect((await t.run(ctx => ctx.db.query("workflowRuns").collect())).filter(run => run.kind === "strategy")).toHaveLength(1);
  await expect(owner.client.mutation(api.intake.beginPlan, { slug: first.slug, revision: session.revision + 1, requestKey: "new-plan-request" })).rejects.toThrow(/latest message/);
  await t.mutation(internal.engine.finishRun, { runId: result.runId, status: "failed", userMessage: "Isolated simulated provider failure" });
  const retry = await owner.client.mutation(api.intake.beginPlan, { slug: first.slug, revision: session.revision, requestKey: "explicit-plan-retry" });
  expect(retry.runId).not.toBe(result.runId);
  expect(await owner.client.mutation(api.intake.beginPlan, { slug: first.slug, revision: session.revision, requestKey: "explicit-plan-retry" })).toEqual(retry);
});

it("stops stale or revoked replies, and includes discovery records in export and purge", async () => {
  const t = setup(), owner = await asNewUser(t, "private-intake@example.com");
  const first = await owner.client.mutation(api.intake.start, { text: wish, requestKey: "private-interview" });
  const session = (await t.run(ctx => ctx.db.get(first.conversationId)))!;
  const view = await owner.client.query(api.intake.view, { slug: first.slug });
  const output = JSON.stringify({ reply: "What’s your website?", updates: [], choices: [], ready: false });
  const base = { conversationId: first.conversationId, runId: session.activeRunId!, replyId: view.messages[1].id, revision: session.revision, output, sources: "[]" };
  expect(await t.mutation(internal.intake.complete, { ...base, revision: session.revision + 1 })).toBe(false);
  const exported = JSON.parse(await t.query(internal.settings.exportData, { orgId: session.orgId }));
  expect(exported.discoveryConversations).toHaveLength(1);
  expect(exported.discoveryMessages).toHaveLength(2);
  await t.run(async ctx => {
    const membership = (await ctx.db.query("memberships").withIndex("by_org_user", q => q.eq("orgId", session.orgId).eq("userId", owner.userId)).unique())!;
    await ctx.db.patch(membership._id, { status: "removed" });
  });
  expect(await t.query(internal.intake.load, { conversationId: first.conversationId, runId: session.activeRunId!, revision: session.revision })).toBeNull();
  expect(await t.mutation(internal.intake.complete, base)).toBe(false);
  await t.mutation(internal.engine.finishRun, { runId: session.activeRunId!, status: "canceled" });
  await t.run(ctx => ctx.db.patch(session.orgId, { deletedAt: Date.now() }));
  await t.mutation(internal.settings.purgeWorkspaceBatch, { orgId: session.orgId });
  expect(await t.run(ctx => ctx.db.query("intakeMessages").collect())).toHaveLength(0);
  expect(await t.run(ctx => ctx.db.query("intakeConversations").collect())).toHaveLength(0);
});
