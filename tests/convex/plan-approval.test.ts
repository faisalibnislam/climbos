import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { localWeek } from "../../shared/report/weekly";
import { asNewUser, makePaid, setup, type T } from "./helpers";

/**
 * Planning, insight and onboarding: approving a plan starts its work within
 * credits, runs are found by kind, one plan job at a time, owners hear about
 * results and failures once, and goal/approval edits follow role rules.
 */

async function workspace(t: T, email: string, budget = 300) {
  const owner = await asNewUser(t, email);
  const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Plan Co" });
  await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", statement: "More paying customers", horizonDays: 90, monthlyAdBudget: budget });
  return { ...owner, slug, orgId: orgId as Id<"organizations"> };
}

async function addMember(t: T, orgId: Id<"organizations">, email: string, role: "editor" | "reviewer" | "viewer" | "admin") {
  const u = await asNewUser(t, email);
  await t.run(async (ctx) => ctx.db.insert("memberships", { orgId, userId: u.userId, role, status: "active", createdAt: Date.now() }));
  return u;
}

async function notices(t: T, userId: Id<"users">) {
  return t.run(async (ctx) => ctx.db.query("notices").withIndex("by_user_created", (q) => q.eq("userId", userId)).collect());
}

async function latestStrategy(t: T, orgId: Id<"organizations">) {
  return t.run(async (ctx) => (await ctx.db.query("strategies").withIndex("by_org", (q) => q.eq("orgId", orgId)).order("desc").first())!);
}

/** Use up the month's credits (so the next reservation fails). */
async function exhaustCredits(t: T, orgId: Id<"organizations">) {
  await t.run(async (ctx) => {
    for (const p of await ctx.db.query("usagePeriods").collect()) if (p.orgId === orgId || p.accountId) await ctx.db.patch(p._id, { walletCapMicros: p.walletSpentMicros + p.walletReservedMicros });
  });
}

describe("Plan approval starts the work", () => {
  beforeEach(() => {
    process.env.CLIMBOS_ENGINE = "v2";
    process.env.CLIMBOS_FAKE_LLM = "ship";
  });
  afterEach(() => {
    delete process.env.CLIMBOS_ENGINE;
    delete process.env.CLIMBOS_FAKE_LLM;
  });

  it("approving starts each active channel's drafts once, and owners hear when the plan and drafts are ready", async () => {
    const t = setup();
    const w = await workspace(t, "approve-owner@example.com");
    await makePaid(t, w.orgId);
    await w.client.mutation(api.orgs.generatePlan, { slug: w.slug });
    // A second click while it's building would pay twice.
    await expect(w.client.mutation(api.orgs.generatePlan, { slug: w.slug })).rejects.toThrow(/already being built/);
    await t.finishAllScheduledFunctions(() => undefined);
    const s = await latestStrategy(t, w.orgId);
    expect(s.status).toBe("needs_approval");
    expect((await notices(t, w.userId)).some((n) => n.text.includes("ready for your approval") && n.href.endsWith("/plan"))).toBe(true);

    const work = await w.client.mutation(api.workspace.decidePlan, { slug: w.slug, strategyId: s._id, decision: "approve" });
    expect(work).not.toBeNull();
    const after = await latestStrategy(t, w.orgId);
    expect(after.status).toBe("approved");
    // Every active channel with a job has its card; first-win channels (posts, email) are already drafted.
    const runnable = after.channels.filter((c) => c.status === "active" && ["seo_content", "search_ads", "meta_ads", "sales_outreach", "conversion_optimization", "retention"].includes(c.key));
    expect(runnable.length).toBeGreaterThan(0);
    expect(work!.started.length).toBe(runnable.length);
    for (const c of runnable) expect(c.cardId).toBeTruthy();
    const cards = await t.run(async (ctx) => Promise.all(runnable.map((c) => ctx.db.get(c.cardId!))));
    for (const card of cards) {
      expect(card!.status).toBe("running");
      expect(JSON.parse(card!.payload).strategyId).toBe(s._id);
    }
    await t.finishAllScheduledFunctions(() => undefined);
    const done = await t.run(async (ctx) => Promise.all(runnable.map((c) => ctx.db.get(c.cardId!))));
    expect(done.every((c) => c!.status === "done")).toBe(true);
    if (runnable.length) expect((await notices(t, w.userId)).some((n) => /new drafts? ready/.test(n.text))).toBe(true);

    // Turning a channel off and on again doesn't start its work twice.
    if (runnable.length) {
      const key = runnable[0].key;
      await w.client.mutation(api.workspace.setChannelStatus, { slug: w.slug, strategyId: s._id, key, status: "parked" });
      const again = await w.client.mutation(api.workspace.setChannelStatus, { slug: w.slug, strategyId: s._id, key, status: "active" });
      expect(again!.started).toEqual([]);
    }
  });

  it("without credits, approval keeps the work waiting, says so, and parking holds it", async () => {
    const t = setup();
    const w = await workspace(t, "approve-broke@example.com");
    await makePaid(t, w.orgId);
    await w.client.mutation(api.orgs.generatePlan, { slug: w.slug });
    await t.finishAllScheduledFunctions(() => undefined);
    const s = await latestStrategy(t, w.orgId);
    // Make sure there is one channel with a job that the first win didn't cover.
    await t.run(async (ctx) => ctx.db.patch(s._id, { channels: [{ ...s.channels[0], key: "seo_content", name: "SEO pages", status: "proposed" as const }] }));
    await exhaustCredits(t, w.orgId);
    const work = await w.client.mutation(api.workspace.decidePlan, { slug: w.slug, strategyId: s._id, decision: "approve" });
    expect(work!.started).toEqual([]);
    expect(work!.waiting).toHaveLength(1);
    expect(work!.waiting[0].reason).toMatch(/credits/i);
    const cardId = (await latestStrategy(t, w.orgId)).channels[0].cardId!;
    let card = await t.run(async (ctx) => ctx.db.get(cardId));
    expect(card!.status).toBe("proposed");
    expect(card!.blockedReason).toMatch(/credits/i);
    expect((await notices(t, w.userId)).some((n) => n.text.includes("waiting for credits"))).toBe(true);

    // Parked: the waiting card is held and can't be run.
    await w.client.mutation(api.workspace.setChannelStatus, { slug: w.slug, strategyId: s._id, key: "seo_content", status: "parked" });
    card = await t.run(async (ctx) => ctx.db.get(cardId));
    expect(card!.status).toBe("blocked");
    await expect(w.client.mutation(api.workspace.runCard, { slug: w.slug, cardId })).rejects.toThrow();
    // A parked channel's card is refused even if it's proposed again by hand.
    await t.run(async (ctx) => ctx.db.patch(cardId, { status: "proposed" }));
    await expect(w.client.mutation(api.workspace.runCard, { slug: w.slug, cardId })).rejects.toThrow(/parked/);
  });

  it("re-binds an expired plan approval to the current rules, and follows who may approve", async () => {
    const t = setup();
    const w = await workspace(t, "approve-expired@example.com");
    await makePaid(t, w.orgId);
    await w.client.mutation(api.orgs.generatePlan, { slug: w.slug });
    await t.finishAllScheduledFunctions(() => undefined);
    const s = await latestStrategy(t, w.orgId);
    const reviewer = await addMember(t, w.orgId, "approve-reviewer@example.com", "reviewer");
    // The approval rules no longer include reviewers.
    await t.run(async (ctx) => {
      const p = (await ctx.db.query("autonomyPolicies").withIndex("by_org_active", (q) => q.eq("orgId", w.orgId).eq("active", true)).first())!;
      await ctx.db.patch(p._id, { approvalRoles: ["owner", "admin"] });
      await ctx.db.patch(s.approvalId!, { expiresAt: Date.now() - 1000, policyVersion: 0 });
    });
    await expect(reviewer.client.mutation(api.workspace.decidePlan, { slug: w.slug, strategyId: s._id, decision: "approve" })).rejects.toThrow(/approval rules/);
    await w.client.mutation(api.workspace.decidePlan, { slug: w.slug, strategyId: s._id, decision: "approve" });
    const approval = await t.run(async (ctx) => ctx.db.get(s.approvalId!));
    expect(approval!.status).toBe("approved");
    expect(approval!.expiresAt).toBeGreaterThan(Date.now());
    expect(approval!.policyVersion).toBeGreaterThan(0);
  });

  it("finds plan and research runs by kind even after many chat runs; jobs use the approved plan", async () => {
    const t = setup();
    const w = await workspace(t, "by-kind@example.com");
    await makePaid(t, w.orgId);
    await w.client.mutation(api.orgs.generatePlan, { slug: w.slug });
    await t.finishAllScheduledFunctions(() => undefined);
    const s = await latestStrategy(t, w.orgId);
    await w.client.mutation(api.workspace.decidePlan, { slug: w.slug, strategyId: s._id, decision: "approve" });
    await t.finishAllScheduledFunctions(() => undefined);
    const planRun = await t.run(async (ctx) => (await ctx.db.query("workflowRuns").withIndex("by_org_created", (q) => q.eq("orgId", w.orgId)).collect()).find((r) => r.kind === "strategy")!);
    // Twelve newer Climb AI runs.
    await t.run(async (ctx) => {
      const { _id: _x, _creationTime: _y, ...rest } = planRun;
      for (let i = 0; i < 12; i++) await ctx.db.insert("workflowRuns", { ...rest, kind: "climb_chat", createdAt: Date.now() + i + 1 });
    });
    const plan = await w.client.query(api.workspace.plan, { slug: w.slug });
    expect(plan.strategyRun?.id).toBe(planRun._id);
    const state = await w.client.query(api.orgs.onboardingState, { slug: w.slug });
    expect(state.strategyRun?.id).toBe(planRun._id);

    // A newer version waiting for approval: the plan page still shows the approved one, with a banner.
    process.env.CLIMBOS_FAKE_LLM = "ship";
    await w.client.mutation(api.orgs.generatePlan, { slug: w.slug });
    await t.finishAllScheduledFunctions(() => undefined);
    const view = await w.client.query(api.workspace.plan, { slug: w.slug });
    expect(view.strategy?.id).toBe(s._id);
    expect(view.otherVersion?.status).toBe("needs_approval");
    const pending = await w.client.query(api.workspace.plan, { slug: w.slug, strategyId: view.otherVersion!.id });
    expect(pending.strategy?.status).toBe("needs_approval");
    expect(pending.otherVersion?.id).toBe(s._id);
    // Content jobs read the approved plan, not the newer draft.
    const ctxOut = await t.query(internal.jobWrites.jobContext, { runId: planRun._id });
    expect(ctxOut?.strategy?._id).toBe(s._id);
  });

  it("tells owners once when a job fails, even if a retry fails again", async () => {
    process.env.CLIMBOS_FAKE_LLM = "fail";
    const t = setup();
    const w = await workspace(t, "fail-notice@example.com");
    await w.client.mutation(api.orgs.generatePlan, { slug: w.slug });
    await t.finishAllScheduledFunctions(() => undefined);
    const failedRun = await t.run(async (ctx) => (await ctx.db.query("workflowRuns").withIndex("by_org_created", (q) => q.eq("orgId", w.orgId)).collect()).find((r) => r.kind === "strategy")!);
    expect(failedRun.status).toBe("failed");
    const fails = () => notices(t, w.userId).then((ns) => ns.filter((n) => n.text.includes("didn't finish")));
    expect(await fails()).toHaveLength(1);
    expect((await fails())[0].href).toBe(`/app/${w.slug}/work/${failedRun._id}`);
    await w.client.mutation(api.workspace.retryRun, { slug: w.slug, runId: failedRun._id });
    await t.finishAllScheduledFunctions(() => undefined);
    expect(await fails()).toHaveLength(1);
  });
});

describe("Onboarding and goal rules", () => {
  it("rejects a bad website before creating anything", async () => {
    const t = setup();
    const u = await asNewUser(t, "bad-site@example.com");
    await expect(u.client.mutation(api.orgs.createWorkspace, { businessName: "Typo Co", website: "mybiz" })).rejects.toThrow(/website address/);
    const orgs = await t.run(async (ctx) => ctx.db.query("organizations").collect());
    expect(orgs.filter((o) => o.name === "Typo Co")).toHaveLength(0);
  });

  it("research runs one at a time, and a refresh after setup doesn't reopen onboarding", async () => {
    const t = setup();
    const w = await workspace(t, "refresh-research@example.com");
    await t.run(async (ctx) => ctx.db.patch(w.orgId, { onboardingStep: "done" }));
    await w.client.mutation(api.orgs.startResearch, { slug: w.slug, ownerText: "We sell handmade candles to gift shops." });
    await expect(w.client.mutation(api.orgs.startResearch, { slug: w.slug, ownerText: "Again" })).rejects.toThrow(/already researching/);
    const org = await t.run(async (ctx) => ctx.db.get(w.orgId));
    expect(org!.onboardingStep).toBe("done");
    // Goal edits after setup keep it done too.
    await w.client.mutation(api.orgs.setGoal, { slug: w.slug, kind: "more_sales", statement: "Sell more candles", horizonDays: 60, monthlyAdBudget: 100 });
    expect((await t.run(async (ctx) => ctx.db.get(w.orgId)))!.onboardingStep).toBe("done");
  });

  it("editors may lower the ad budget but not raise it, and can't change approval rules", async () => {
    const t = setup();
    const w = await workspace(t, "goal-roles@example.com", 300);
    const editor = await addMember(t, w.orgId, "goal-editor@example.com", "editor");
    await expect(editor.client.mutation(api.orgs.setGoal, { slug: w.slug, kind: "more_customers", statement: "More customers", horizonDays: 90, monthlyAdBudget: 500 })).rejects.toThrow(/raise the ad budget/);
    await editor.client.mutation(api.orgs.setGoal, { slug: w.slug, kind: "more_customers", statement: "More customers", horizonDays: 90, monthlyAdBudget: 200 });
    const policy = await t.run(async (ctx) => ctx.db.query("autonomyPolicies").withIndex("by_org_active", (q) => q.eq("orgId", w.orgId).eq("active", true)).first());
    expect(policy!.maxMonthlyAdSpendMinor).toBe(20_000);
    await expect(editor.client.mutation(api.orgs.setAutonomy, { slug: w.slug, mode: "copilot" })).rejects.toThrow(/owner or admin/);
    // Bounded Autopilot needs a paid plan, even for the owner.
    await expect(w.client.mutation(api.orgs.setAutonomy, { slug: w.slug, mode: "bounded_autopilot" })).rejects.toThrow(/paid plan/);
    await makePaid(t, w.orgId);
    await w.client.mutation(api.orgs.setAutonomy, { slug: w.slug, mode: "bounded_autopilot" });
    expect(await w.client.query(api.orgs.onboardingState, { slug: w.slug }).then((s) => s.autonomy)).toBe("bounded_autopilot");
  });
});

describe("Wishes and Today", () => {
  it("each answer names the wish it replies to, and Today counts real jobs", async () => {
    const t = setup();
    const u = await asNewUser(t, "wish-pair@example.com", { anonymous: true });
    const { slug } = await u.client.mutation(api.demo.createDemoWorkspace, {});
    await t.finishAllScheduledFunctions(() => undefined);
    const a = await u.client.mutation(api.workspace.sendChat, { slug, text: "Write two Instagram posts about our spring sale" });
    const b = await u.client.mutation(api.workspace.sendChat, { slug, text: "Draft a welcome email for new subscribers" });
    await t.finishAllScheduledFunctions(() => undefined);
    const today = await u.client.query(api.workspace.today, { slug });
    const replyA = today.chat.find((m) => m.replyTo === a.messageId);
    const replyB = today.chat.find((m) => m.replyTo === b.messageId);
    expect(replyA).toBeTruthy();
    expect(replyB).toBeTruthy();
    expect(replyA!.id).not.toBe(replyB!.id);
    const verified = await t.run(async (ctx) => {
      const org = (await ctx.db.query("organizations").withIndex("by_slug", (q) => q.eq("slug", slug)).unique())!;
      return (await ctx.db.query("workflowRuns").withIndex("by_org_created", (q) => q.eq("orgId", org._id)).collect()).filter((r) => r.status === "verified" && r.kind !== "chat_intent" && r.kind !== "climb_chat").length;
    });
    expect(today.counts.doneThisWeek).toBe(verified);
    expect(today.counts.workingNow).toBe(0);
  });
});

describe("Weekly report", () => {
  it("compares the week so far with the same stretch of last week", async () => {
    const t = setup();
    const u = await asNewUser(t, "week-so-far@example.com", { anonymous: true });
    const { slug } = await u.client.mutation(api.demo.createDemoWorkspace, {});
    await t.finishAllScheduledFunctions(() => undefined);
    const now = Date.now();
    const w = localWeek(now, "UTC", 0);
    const elapsed = now - w.start;
    await t.run(async (ctx) => {
      const org = (await ctx.db.query("organizations").withIndex("by_slug", (q) => q.eq("slug", slug)).unique())!;
      await ctx.db.patch(org._id, { timezone: "UTC" });
      for (const r of await ctx.db.query("workflowRuns").withIndex("by_org_created", (q) => q.eq("orgId", org._id)).collect()) await ctx.db.delete(r._id);
      const rest = {
        orgId: org._id,
        title: "Posts",
        input: "{}",
        roles: [],
        estimateMicros: 0,
        actualMicros: 0,
        rateVersionId: "r",
        entitlementVersionId: "e",
        routingVersionId: "x",
        budget: { modelSteps: 1, researchTools: 0, repairs: 0 },
        used: { modelSteps: 0, researchTools: 0, repairs: 0 },
        isFixture: false,
        updatedAt: now,
      };
      // One finished job earlier in the same stretch of last week, one later in last week (not comparable yet).
      await ctx.db.insert("workflowRuns", { ...rest, kind: "content_social", status: "verified", createdAt: w.prevStart + Math.floor(elapsed / 2) });
      await ctx.db.insert("workflowRuns", { ...rest, kind: "content_social", status: "verified", createdAt: w.prevStart + elapsed + 60_000 });
      await ctx.db.insert("workflowRuns", { ...rest, kind: "content_social", status: "verified", createdAt: now - 1 });
    });
    const r = await u.client.query(api.reports.weekly, { slug });
    const jobs = r.lines.find((l) => l.key === "jobsDone");
    expect(jobs?.value).toBe(1);
    // Last week's comparable stretch had one job, so no change (the later one doesn't count).
    expect(jobs?.change ?? 0).toBe(0);
  });
});

describe("Climb AI reserves turn by turn", () => {
  afterEach(() => {
    delete process.env.CLIMBOS_FAKE_LLM;
  });

  it("a message reserves one turn, keeps room for more, and answers within what it used", async () => {
    process.env.CLIMBOS_FAKE_LLM = "ship";
    const t = setup();
    const u = await asNewUser(t, "climb-turns@example.com", { anonymous: true });
    const { slug } = await u.client.mutation(api.demo.createDemoWorkspace, {});
    await t.finishAllScheduledFunctions(() => undefined);
    const { messageId, runId } = await u.client.mutation(api.climb.send, { slug, text: "What's on my plan?", screen: { path: `/app/${slug}/plan`, title: "Plan" } });
    const run = await t.run(async (ctx) => ctx.db.get(runId));
    expect(run!.budget.modelSteps).toBeGreaterThanOrEqual(9);
    const one = run!.estimateMicros;
    await u.client.action(api.climb.respond, { slug, messageId, runId });
    const done = await t.run(async (ctx) => ctx.db.get(runId));
    expect(done!.status).toBe("verified");
    // Each extra turn reserved its own cost; a one-turn answer reserved nothing more.
    const turns = (await t.run(async (ctx) => ctx.db.query("workflowSteps").withIndex("by_run", (q) => q.eq("runId", runId)).collect())).length;
    if (turns === 1) expect(done!.estimateMicros).toBe(one);
    else expect(done!.estimateMicros).toBeGreaterThan(one);
  });
});

describe("Push reaches every device", () => {
  it("each device pulls each message once, with unique tags; old messages are cleaned up", async () => {
    const t = setup();
    const owner = await asNewUser(t, "push-devices@example.com");
    await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Push Two" });
    const phone = "https://push.example.com/sub/phone";
    const laptop = "https://push.example.com/sub/laptop";
    await owner.client.mutation(api.push.subscribe, { endpoint: phone });
    await owner.client.mutation(api.push.subscribe, { endpoint: laptop });
    await owner.client.mutation(api.push.test, {});
    await owner.client.mutation(api.push.test, {});
    const p1 = await t.mutation(internal.push.pull, { endpoint: phone });
    const l1 = await t.mutation(internal.push.pull, { endpoint: laptop });
    expect(p1).toHaveLength(2);
    expect(l1).toHaveLength(2);
    expect(new Set(p1.map((x) => x.tag)).size).toBe(2);
    expect(await t.mutation(internal.push.pull, { endpoint: phone })).toHaveLength(0);
    await t.run(async (ctx) => {
      for (const r of await ctx.db.query("pushOutbox").collect()) await ctx.db.patch(r._id, { createdAt: Date.now() - 3 * 86_400_000 });
    });
    expect(await t.mutation(internal.push.cleanupOutbox, {})).toBe(2);
  });
});
