import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../convex/_generated/api";
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
