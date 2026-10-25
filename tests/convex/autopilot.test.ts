import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { sha256Hex } from "../../shared/policy";
import { asNewUser, setup, type T, makePaid } from "./helpers";

/**
 * Social autopilot end to end on Engine v2 with the deterministic model:
 * switch on → week planned → drafts written → each draft routed (auto vs ask)
 * → approvals schedule posts → the publish executor posts through a fixture
 * Facebook Page and the calendar slot shows "published".
 */

async function workspace(t: T, email: string) {
  const owner = await asNewUser(t, email);
  const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Wire Co" });
  await makePaid(t, orgId);
  await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", statement: "More paying customers", horizonDays: 90, monthlyAdBudget: 300 });
  // Auto-posting needs Bounded Autopilot (Settings → Policies).
  await owner.client.mutation(api.orgs.setAutonomy, { slug, mode: "bounded_autopilot" });
  const oid = orgId as Id<"organizations">;
  await t.run(async (ctx) => {
    const now = Date.now();
    await ctx.db.insert("connections", {
      orgId: oid,
      provider: "facebook_pages",
      status: "connected",
      accountLabel: "Wire Co (test page)",
      externalAccountId: "page_1",
      scopes: ["pages_manage_posts"],
      isFixture: true,
      createdBy: owner.userId,
      createdAt: now,
      updatedAt: now,
    });
  });
  return { ...owner, slug, orgId: oid };
}

async function slots(t: T, orgId: Id<"organizations">) {
  return t.run(async (ctx) => (await ctx.db.query("calendarSlots").collect()).filter((s) => s.orgId === orgId));
}

async function run(t: T) {
  await t.finishAllScheduledFunctions(vi.runAllTimers);
}

describe("social autopilot", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.setSystemTime(new Date("2026-10-19T08:00:00Z")); // a Monday: plans the rest of this week
    process.env.CLIMBOS_ENGINE = "v2";
    process.env.CLIMBOS_FAKE_LLM = "ship";
  });
  afterEach(() => {
    vi.useRealTimers();
    delete process.env.CLIMBOS_ENGINE;
    delete process.env.CLIMBOS_FAKE_LLM;
  });

  it("plans, drafts and asks first for a channel's first post; approving schedules and publishes it", async () => {
    const t = setup();
    const w = await workspace(t, "ap-first@example.com");
    await w.client.mutation(api.autopilot.save, { slug: w.slug, enabled: true, mode: "auto", channels: [{ channel: "facebook", postsPerWeek: 1 }], postingHours: [], alwaysAskTopics: [], imagesPerWeek: 0 });
    await run(t);

    let s = await slots(t, w.orgId);
    expect(s).toHaveLength(1);
    expect(s[0].status).toBe("needs_approval");
    expect(s[0].routing?.decision).toBe("ask");
    expect(s[0].routing?.reasons.join(" ")).toMatch(/first post/);
    const artifactId = s[0].artifactId!;
    const plan = await t.run(async (ctx) => ctx.db.query("weekPlans").first());
    expect(plan?.weekOf).toBe("2026-10-19");

    await w.client.mutation(api.content.decide, { slug: w.slug, artifactId, decision: "approve" });
    s = await slots(t, w.orgId);
    expect(s[0].status).toBe("scheduled");
    await run(t);

    s = await slots(t, w.orgId);
    expect(s[0].status).toBe("published");
    const receipt = await t.run(async (ctx) => ctx.db.query("actionReceipts").first());
    expect(receipt?.status).toBe("fixture_verified");
    const settings = await t.run(async (ctx) => ctx.db.query("autopilotSettings").first());
    expect(settings?.trust.find((x) => x.channel === "facebook")?.streak).toBe(1);
  });

  it("shows review slots on the content calendar and follows a rescheduled artifact", async () => {
    const t = setup();
    const w = await workspace(t, "ap-calendar@example.com");
    await w.client.mutation(api.autopilot.save, { slug: w.slug, enabled: true, mode: "auto", channels: [{ channel: "facebook", postsPerWeek: 1 }], postingHours: [], alwaysAskTopics: [], imagesPerWeek: 0 });
    await run(t);

    const [slot] = await slots(t, w.orgId);
    expect(slot.status).toBe("needs_approval");
    const initial = await w.client.query(api.content.calendar, { slug: w.slug, from: slot.slotAt - 1, to: slot.slotAt + 1 });
    expect(initial).toEqual(expect.arrayContaining([
      expect.objectContaining({ artifactId: slot.artifactId, status: "in_review", autopilot: true, autopilotStatus: "needs_approval" }),
    ]));

    await w.client.mutation(api.content.decide, { slug: w.slug, artifactId: slot.artifactId!, decision: "approve" });
    const movedTo = slot.slotAt + 3 * 86_400_000;
    await w.client.mutation(api.content.schedule, { slug: w.slug, artifactId: slot.artifactId!, when: movedTo });
    const moved = await slots(t, w.orgId);
    expect(moved[0].slotAt).toBe(movedTo);
    const calendar = await w.client.query(api.content.calendar, { slug: w.slug, from: movedTo - 1, to: movedTo + 1 });
    expect(calendar).toEqual(expect.arrayContaining([
      expect.objectContaining({ artifactId: slot.artifactId, status: "scheduled", scheduledFor: movedTo, autopilot: true }),
    ]));
  });

  it("fully auto posts a clean draft on its own under an autopilot approval", async () => {
    const t = setup();
    const w = await workspace(t, "ap-auto@example.com");
    // An earlier post on the channel, so the "first post" gate doesn't apply.
    await t.run(async (ctx) => {
      const business = await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", w.orgId)).first();
      const now = Date.now();
      await ctx.db.insert("artifacts", { orgId: w.orgId, businessId: business!._id, kind: "social_post", channel: "facebook", title: "Earlier", status: "published", currentVersion: 1, createdAt: now, updatedAt: now });
    });
    await w.client.mutation(api.autopilot.save, { slug: w.slug, enabled: true, mode: "auto", channels: [{ channel: "facebook", postsPerWeek: 1 }], postingHours: [], alwaysAskTopics: [], imagesPerWeek: 0 });
    await run(t);

    const s = await slots(t, w.orgId);
    expect(s[0].routing?.decision).toBe("auto");
    expect(s[0].status).toBe("published");
    const approval = await t.run(async (ctx) => ctx.db.query("approvals").filter((q) => q.eq(q.field("subjectId"), s[0].artifactId!)).first());
    expect(approval?.decidedBy).toBeUndefined();
    expect(approval?.decisionNote).toMatch(/^Autopilot/);
    expect(approval?.scope.scheduledFor).toBe(s[0].slotAt);
  });

  it("always-ask topics and the emergency stop keep posts waiting even in fully auto", async () => {
    const t = setup();
    const w = await workspace(t, "ap-ask@example.com");
    await t.run(async (ctx) => {
      const business = await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", w.orgId)).first();
      const now = Date.now();
      await ctx.db.insert("artifacts", { orgId: w.orgId, businessId: business!._id, kind: "social_post", channel: "facebook", title: "Earlier", status: "published", currentVersion: 1, createdAt: now, updatedAt: now });
    });
    // The fake model writes bodies containing "fake-v1", so make that an always-ask topic.
    await w.client.mutation(api.autopilot.save, { slug: w.slug, enabled: true, mode: "auto", channels: [{ channel: "facebook", postsPerWeek: 1 }], postingHours: [], alwaysAskTopics: ["fake-v1"], imagesPerWeek: 0 });
    await run(t);
    const s = await slots(t, w.orgId);
    expect(s[0].status).toBe("needs_approval");
    expect(s[0].routing?.reasons.join(" ")).toMatch(/approve yourself/);
  });

  it("the owner can skip a slot and nothing posts", async () => {
    const t = setup();
    const w = await workspace(t, "ap-skip@example.com");
    await w.client.mutation(api.autopilot.save, { slug: w.slug, enabled: true, mode: "always_ask", channels: [{ channel: "facebook", postsPerWeek: 1 }], postingHours: [], alwaysAskTopics: [], imagesPerWeek: 0 });
    await run(t);
    const [slot] = await slots(t, w.orgId);
    await w.client.mutation(api.content.decide, { slug: w.slug, artifactId: slot.artifactId!, decision: "approve" });
    await w.client.mutation(api.autopilot.skipSlot, { slug: w.slug, slotId: slot._id });
    await run(t);
    const after = await slots(t, w.orgId);
    expect(after[0].status).toBe("skipped");
    const receipts = await t.run(async (ctx) => ctx.db.query("actionReceipts").collect());
    expect(receipts).toHaveLength(0);
  });

  it("the overview query shows the week, trust and connected channels", async () => {
    const t = setup();
    const w = await workspace(t, "ap-view@example.com");
    await w.client.mutation(api.autopilot.save, { slug: w.slug, enabled: true, mode: "trust_ladder", channels: [{ channel: "facebook", postsPerWeek: 1 }], postingHours: [9], alwaysAskTopics: [], imagesPerWeek: 0 });
    await run(t);
    const view = await w.client.query(api.autopilot.get, { slug: w.slug });
    expect(view.settings?.mode).toBe("trust_ladder");
    expect(view.connected).toContain("facebook");
    expect(view.weeks[0].slots).toHaveLength(1);
    expect(view.weeks[0].plan?.theme).toBeTruthy();
    expect(view.trust.find((x) => x.channel === "facebook")?.threshold).toBe(5);
  });

  it("one-tap email links approve and stop posts, once each, and never act on open", async () => {
    const t = setup();
    const w = await workspace(t, "ap-email@example.com");
    await w.client.mutation(api.autopilot.save, { slug: w.slug, enabled: true, mode: "always_ask", channels: [{ channel: "facebook", postsPerWeek: 1 }], postingHours: [], alwaysAskTopics: [], imagesPerWeek: 0 });
    await run(t);
    const [slot] = await slots(t, w.orgId);
    const artifactId = slot.artifactId!;
    const token = (c: string) => c.repeat(48);
    const store = async (tok: string, kind: "approve_post" | "stop_post") =>
      t.run(async (ctx) => {
        await ctx.db.insert("actionTokens", { tokenHash: await sha256Hex(tok), orgId: w.orgId, userId: w.userId, kind, subjectId: artifactId, expiresAt: Date.now() + 3_600_000, createdAt: Date.now() });
      });

    await store(token("a"), "approve_post");
    const before = await t.query(api.emailActions.preview, { token: token("a") });
    expect(before).toMatchObject({ state: "ready", kind: "approve_post" });
    expect((await slots(t, w.orgId))[0].status).toBe("needs_approval"); // opening changed nothing

    const approved = await t.mutation(api.emailActions.consume, { token: token("a") });
    expect(approved.ok).toBe(true);
    expect((await slots(t, w.orgId))[0].status).toBe("scheduled");
    expect((await t.mutation(api.emailActions.consume, { token: token("a") })).ok).toBe(false); // single use

    await store(token("b"), "stop_post");
    const stopped = await t.mutation(api.emailActions.consume, { token: token("b") });
    expect(stopped.ok).toBe(true);
    const after = await slots(t, w.orgId);
    expect(after[0].status).toBe("needs_approval");
    expect(after[0].routing?.reasons[0]).toMatch(/stopped it/);
    const art = await t.run(async (ctx) => ctx.db.get(artifactId));
    expect(art?.status).toBe("in_review");
    await run(t);
    expect(await t.run(async (ctx) => ctx.db.query("actionReceipts").collect())).toHaveLength(0); // nothing posted

    expect(await t.query(api.emailActions.preview, { token: "not-a-token" })).toEqual({ state: "invalid" });
  });

  it("automatic posts get a heads-up email two hours before", async () => {
    const t = setup();
    const w = await workspace(t, "ap-headsup@example.com");
    await t.run(async (ctx) => {
      const business = await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", w.orgId)).first();
      const now = Date.now();
      await ctx.db.insert("artifacts", { orgId: w.orgId, businessId: business!._id, kind: "social_post", channel: "facebook", title: "Earlier", status: "published", currentVersion: 1, createdAt: now, updatedAt: now });
    });
    await w.client.mutation(api.autopilot.save, { slug: w.slug, enabled: true, mode: "auto", channels: [{ channel: "facebook", postsPerWeek: 1 }], postingHours: [], alwaysAskTopics: [], imagesPerWeek: 0 });
    await run(t);
    const tokens = await t.run(async (ctx) => ctx.db.query("actionTokens").collect());
    expect(tokens.some((x) => x.kind === "stop_post")).toBe(true);
    const log = await t.run(async (ctx) => ctx.db.query("emailLog").collect());
    expect(log.some((l) => l.template === "autopilot_heads_up")).toBe(true);
  });
});

describe("autopilot guards", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.setSystemTime(new Date("2026-10-19T08:00:00Z")); // Monday
    process.env.CLIMBOS_ENGINE = "v2";
    process.env.CLIMBOS_FAKE_LLM = "ship";
  });
  afterEach(() => {
    vi.useRealTimers();
    delete process.env.CLIMBOS_ENGINE;
    delete process.env.CLIMBOS_FAKE_LLM;
  });

  const save = (w: Awaited<ReturnType<typeof workspace>>, enabled = true) =>
    w.client.mutation(api.autopilot.save, { slug: w.slug, enabled, mode: "always_ask", channels: [{ channel: "facebook", postsPerWeek: 1 }], postingHours: [], alwaysAskTopics: [], imagesPerWeek: 0 });

  it("a free preview week plans ideas only: nothing is drafted or charged for drafting", async () => {
    const t = setup();
    const owner = await asNewUser(t, "ap-preview@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Free Co" });
    await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", statement: "More", horizonDays: 90, monthlyAdBudget: 0 });
    await owner.client.mutation(api.autopilot.save, { slug, enabled: false, mode: "always_ask", channels: [{ channel: "facebook", postsPerWeek: 2 }], postingHours: [], alwaysAskTopics: [], imagesPerWeek: 0 });
    await owner.client.mutation(api.autopilot.previewWeek, { slug });
    await run(t);
    const s = await slots(t, orgId as Id<"organizations">);
    expect(s.length).toBeGreaterThan(0);
    expect(s.every((x) => x.status === "planned" && !x.artifactId)).toBe(true);
    const runs = await t.run(async (ctx) => ctx.db.query("workflowRuns").collect());
    expect(runs.filter((r) => r.kind === "content_social")).toHaveLength(0);
    const view = await owner.client.query(api.autopilot.get, { slug });
    expect(view.weeks[0].slots.length).toBe(s.length);
    expect(view.directChannels).toEqual(expect.arrayContaining(["instagram", "facebook", "linkedin", "x"]));
  });

  it("Plan now mid-week doesn't double the week", async () => {
    const t = setup();
    const w = await workspace(t, "ap-double@example.com");
    await save(w);
    await run(t);
    expect(await slots(t, w.orgId)).toHaveLength(1);
    await expect(w.client.mutation(api.autopilot.planNow, { slug: w.slug })).rejects.toThrow(/already planned/);
    expect(await slots(t, w.orgId)).toHaveLength(1);
  });

  it("skipping invalidates the approval, and approving a skipped post doesn't revive the slot", async () => {
    const t = setup();
    const w = await workspace(t, "ap-skip2@example.com");
    await save(w);
    await run(t);
    const [slot] = await slots(t, w.orgId);
    await w.client.mutation(api.content.decide, { slug: w.slug, artifactId: slot.artifactId!, decision: "approve" });
    await w.client.mutation(api.autopilot.skipSlot, { slug: w.slug, slotId: slot._id });
    const approvals = await t.run(async (ctx) => ctx.db.query("approvals").collect());
    expect(approvals.some((a) => a.status === "approved")).toBe(false);
    await w.client.mutation(api.content.decide, { slug: w.slug, artifactId: slot.artifactId!, decision: "approve" });
    expect((await slots(t, w.orgId))[0].status).toBe("skipped");
    expect((await t.run(async (ctx) => ctx.db.get(slot.artifactId!)))?.status).toBe("approved");
    await run(t);
    expect(await t.run(async (ctx) => ctx.db.query("actionReceipts").collect())).toHaveLength(0);
  });

  it("approving after the planned time asks for a new time instead of posting late", async () => {
    const t = setup();
    const w = await workspace(t, "ap-late@example.com");
    await save(w);
    await run(t);
    const [slot] = await slots(t, w.orgId);
    vi.setSystemTime(new Date(slot.slotAt + 3_600_000));
    const res = await w.client.mutation(api.content.decide, { slug: w.slug, artifactId: slot.artifactId!, decision: "approve" });
    expect(res.slot).toBe("needs_time");
    expect((await t.run(async (ctx) => ctx.db.get(slot.artifactId!)))?.status).toBe("approved");
    expect((await slots(t, w.orgId))[0].routing?.reasons[0]).toMatch(/pick a new time/);
  });

  it("with autopilot off, approving a planned post doesn't schedule it and drafting stops", async () => {
    const t = setup();
    const w = await workspace(t, "ap-off@example.com");
    await save(w);
    await run(t);
    const [slot] = await slots(t, w.orgId);
    await save(w, false);
    await w.client.mutation(api.content.decide, { slug: w.slug, artifactId: slot.artifactId!, decision: "approve" });
    expect((await slots(t, w.orgId))[0].status).toBe("ready_to_post");
    const before = (await t.run(async (ctx) => ctx.db.query("workflowRuns").collect())).length;
    await t.mutation(internal.autopilot.startDrafts, { orgId: w.orgId, weekOf: slot.weekOf, createdBy: w.userId });
    expect((await t.run(async (ctx) => ctx.db.query("workflowRuns").collect())).length).toBe(before);
  });

  it("a slot that didn't finish drafting can be drafted again", async () => {
    const t = setup();
    const w = await workspace(t, "ap-redraft@example.com");
    await save(w);
    await run(t);
    const slotId = await t.run(async (ctx) => {
      const s = (await ctx.db.query("calendarSlots").first())!;
      return ctx.db.insert("calendarSlots", {
        orgId: s.orgId,
        weekOf: s.weekOf,
        channel: s.channel,
        day: s.day,
        slotAt: s.slotAt + 3_600_000,
        pillar: s.pillar,
        purpose: s.purpose,
        format: s.format,
        idea: s.idea,
        angle: s.angle,
        hookDraft: s.hookDraft,
        callToAction: s.callToAction,
        needsOwner: false,
        status: "failed",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
    await w.client.mutation(api.autopilot.redraftSlot, { slug: w.slug, slotId });
    await run(t);
    const redone = await t.run(async (ctx) => ctx.db.get(slotId));
    expect(redone?.artifactId).toBeTruthy();
    expect(redone?.status).toBe("needs_approval");
  });

  it("the hourly tick doesn't plan for a workspace whose package lapsed", async () => {
    const t = setup();
    const w = await workspace(t, "ap-lapsed@example.com");
    await save(w);
    await run(t);
    await t.run(async (ctx) => {
      for (const s of await ctx.db.query("subscriptions").collect()) await ctx.db.patch(s._id, { status: "canceled", currentPeriodEnd: Date.now() - 1000 });
    });
    vi.setSystemTime(new Date("2026-10-22T12:00:00Z")); // Thursday noon
    await t.mutation(internal.autopilot.tick, {});
    const settings = await t.run(async (ctx) => ctx.db.query("autopilotSettings").first());
    expect(settings?.lastPlannedWeek).toBe("2026-10-19");
    expect(settings?.pausedReason).toMatch(/package/);
  });
});
