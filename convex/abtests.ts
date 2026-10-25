import { v } from "convex/values";
import { decide, variantFor } from "../shared/abtest";
import { cleanLanding, type LandingContent } from "../shared/landing";
import { sha256Hex } from "../shared/policy";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import { audit } from "./lib/audit";
import { appError, assertSameOrg, requireOrgAccess } from "./lib/tenancy";

/** A/B tests on landing page headlines (leads per view) and outreach subjects (reply rate). */

/** Fixed sample caps remain conservative; window defaults are operational starting points, not business-calibrated values. */
const DAY_MS = 86_400_000;
const RULES = { landing: { min: 100, max: 1000, outcomeWindowDays: 1 }, email_subject: { min: 30, max: 600, outcomeWindowDays: 7 } } as const;

export async function runningTest(ctx: { db: MutationCtx["db"] }, targetId: string) {
  return ctx.db.query("abTests").withIndex("by_target", (q) => q.eq("targetId", targetId).eq("status", "running")).first();
}

async function activeTest(ctx: { db: MutationCtx["db"] }, targetId: string) {
  return (await runningTest(ctx, targetId)) ?? await ctx.db.query("abTests").withIndex("by_target", (q) => q.eq("targetId", targetId).eq("status", "maturing")).first();
}

/** Count a trial (view / send) or a win (lead / reply), then decide. */
export async function recordAb(ctx: MutationCtx, test: Doc<"abTests">, key: string, field: "assigned" | "trials" | "wins") {
  if ((field !== "wins" && test.status !== "running") || (field === "wins" && test.status !== "running" && test.status !== "maturing") || !["A", "B"].includes(key)) return;
  const stats = test.stats.map((s) => {
    if (s.key !== key) return s;
    if (field === "assigned") return { ...s, assigned: (s.assigned ?? 0) + 1 };
    if (field === "trials") return { ...s, exposed: (s.exposed ?? s.trials) + 1, trials: s.trials + 1 };
    return { ...s, wins: s.wins + 1 };
  });
  if (field === "wins" && test.status === "maturing") {
    await ctx.db.patch(test._id, { stats });
    return;
  }
  const rule = RULES[test.kind];
  const d = decide(stats, rule.min, rule.max);
  if (field === "assigned" || !d.done) {
    await ctx.db.patch(test._id, { stats });
    return;
  }
  if (d.validity === "invalid") {
    await ctx.db.patch(test._id, { stats, status: "invalid", note: d.note, endedAt: Date.now() });
    return;
  }
  const outcomeWindowMs = test.outcomeWindowMs ?? rule.outcomeWindowDays * DAY_MS;
  const maturesAt = Date.now() + outcomeWindowMs;
  await ctx.db.patch(test._id, {
    stats,
    status: "maturing",
    outcomeWindowMs,
    maturesAt,
    note: "The planned sample is complete. Waiting for eligible outcomes before the final read.",
  });
  await ctx.scheduler.runAt(maturesAt, internal.abtests.finalize, { testId: test._id });
}

async function assignmentHash(testId: Id<"abTests">, subjectKey: string): Promise<string> {
  return sha256Hex(`abTestAssignment:v1|${testId}|${subjectKey.trim()}`);
}

export async function variantForSubject(testId: Id<"abTests">, subjectKey: string): Promise<"A" | "B"> {
  return variantFor(`${testId}:${await assignmentHash(testId, subjectKey)}`);
}

export async function subjectAssignment(ctx: { db: MutationCtx["db"] }, test: Doc<"abTests">, subjectKey: string) {
  const subjectHash = await assignmentHash(test._id, subjectKey);
  return ctx.db.query("abTestAssignments").withIndex("by_test_subject", (q) => q.eq("testId", test._id).eq("subjectHash", subjectHash)).first();
}

export async function assignSubject(ctx: MutationCtx, test: Doc<"abTests">, subjectKey: string) {
  const subjectHash = await assignmentHash(test._id, subjectKey);
  const existing = await subjectAssignment(ctx, test, subjectKey);
  if (existing) return existing;
  if (test.status !== "running") return null;
  const variant = variantFor(`${test._id}:${subjectHash}`);
  const id = await ctx.db.insert("abTestAssignments", { orgId: test.orgId, testId: test._id, subjectHash, variant, assignedAt: Date.now() });
  await recordAb(ctx, test, variant, "assigned");
  return await ctx.db.get(id);
}

export async function recordExposure(ctx: MutationCtx, assignment: NonNullable<Awaited<ReturnType<typeof assignSubject>>>, test: Doc<"abTests">) {
  if (assignment.exposedAt) return assignment.variant;
  await ctx.db.patch(assignment._id, { exposedAt: Date.now() });
  if (test.status === "running") await recordAb(ctx, test, assignment.variant, "trials");
  return assignment.variant;
}

export async function recordOutcome(ctx: MutationCtx, assignment: NonNullable<Awaited<ReturnType<typeof assignSubject>>>, test: Doc<"abTests">, eventAt = Date.now()) {
  if (!assignment.exposedAt || assignment.outcomeAt) return false;
  await ctx.db.patch(assignment._id, { outcomeAt: eventAt });
  if (test.status === "running" || (test.status === "maturing" && test.maturesAt !== undefined && eventAt <= test.maturesAt)) {
    await recordAb(ctx, test, assignment.variant, "wins");
  }
  return true;
}

async function applyB(ctx: MutationCtx, test: Doc<"abTests">) {
  const b = test.variants.find((x) => x.key === "B")?.value;
  if (!b || !test.baselineHash) throw appError("INVALID", "This experiment has no saved approved baseline, so its result cannot be applied safely.");
  if (test.kind === "landing") {
    const id = ctx.db.normalizeId("landingPages", test.targetId);
    const page = id ? await ctx.db.get(id) : null;
    if (!page?.content || await sha256Hex(page.content) !== test.baselineHash) throw appError("INVALID", "The landing page changed after this test began. Review the current page and create a fresh test.");
    await ctx.db.patch(page._id, { content: JSON.stringify(cleanLanding({ ...(JSON.parse(page.content) as LandingContent), ...(JSON.parse(b) as Partial<LandingContent>) })), updatedAt: Date.now() });
  } else {
    const id = ctx.db.normalizeId("outboundCampaigns", test.targetId);
    const c = id ? await ctx.db.get(id) : null;
    if (!c?.sequence[0] || await sha256Hex(c.sequence[0].subject) !== test.baselineHash) throw appError("INVALID", "The campaign subject changed after this test began. Review the current campaign and create a fresh test.");
    await ctx.db.patch(c._id, { sequence: c.sequence.map((s, i) => (i === 0 ? { ...s, subject: b } : s)), updatedAt: Date.now() });
  }
}

function view(t: Doc<"abTests">) {
  const rule = RULES[t.kind];
  const d = decide(t.stats, rule.min, rule.max);
  return { id: t._id, kind: t.kind, status: t.status, winner: t.winner ?? null, appliedAt: t.appliedAt ?? null, note: t.note ?? d.note, variants: t.variants, stats: t.stats.map((s) => ({ ...s, assigned: s.assigned ?? 0, exposed: s.exposed ?? s.trials, rate: s.trials ? Math.round((s.wins / s.trials) * 1000) / 10 : 0 })), lift: d.lift, confidence: t.status === "maturing" ? 0 : d.confidence, outcomeWindowDays: Math.round((t.outcomeWindowMs ?? rule.outcomeWindowDays * DAY_MS) / DAY_MS), maturesAt: t.maturesAt ?? null, startedAt: t.startedAt };
}

export const finalize = internalMutation({
  args: { testId: v.id("abTests") },
  handler: async (ctx, { testId }) => {
    const test = await ctx.db.get(testId);
    if (!test || test.status !== "maturing" || test.maturesAt === undefined) return;
    if (test.maturesAt > Date.now()) {
      await ctx.scheduler.runAt(test.maturesAt, internal.abtests.finalize, { testId });
      return;
    }
    const rule = RULES[test.kind];
    const d = decide(test.stats, rule.min, rule.max);
    if (!d.done) return;
    await ctx.db.patch(test._id, {
      status: d.validity === "invalid" ? "invalid" : "done",
      ...(d.winner ? { winner: d.winner } : { winner: undefined }),
      note: d.note,
      endedAt: Date.now(),
    });
  },
});

export const forTarget = query({
  args: { slug: v.string(), targetId: v.string() },
  handler: async (ctx, { slug, targetId }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const rows = (await ctx.db.query("abTests").withIndex("by_org", (q) => q.eq("orgId", org._id)).order("desc").take(100)).filter((t) => t.targetId === targetId);
    return rows.slice(0, 5).map(view);
  },
});

export const startLanding = mutation({
  args: { slug: v.string(), pageId: v.id("landingPages"), headline: v.string(), subhead: v.optional(v.string()), ctaLabel: v.optional(v.string()), outcomeWindowDays: v.optional(v.number()) },
  handler: async (ctx, a) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: a.slug }, "approve");
    const page = assertSameOrg(await ctx.db.get(a.pageId), org._id, "page");
    if (!page.content) throw appError("INVALID", "The page isn't written yet.");
    if (await activeTest(ctx, page._id)) throw appError("INVALID", "A test is already active on this page.");
    const cur = JSON.parse(page.content) as LandingContent;
    const b = { headline: a.headline.trim().slice(0, 90), ...(a.subhead?.trim() ? { subhead: a.subhead.trim().slice(0, 220) } : {}), ...(a.ctaLabel?.trim() ? { ctaLabel: a.ctaLabel.trim().slice(0, 32) } : {}) };
    if (!b.headline || b.headline === cur.headline) throw appError("INVALID", "Write a different headline to test.");
    const baseline = await sha256Hex(page.content);
    const challenger = JSON.stringify(b);
    const id = await start(ctx, org._id, "landing", page._id, JSON.stringify({ headline: cur.headline, subhead: cur.subhead, ctaLabel: cur.ctaLabel }), challenger, a.outcomeWindowDays, baseline);
    const challengerHash = await sha256Hex(challenger);
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "ab_test.approved_and_started", subjectType: "abTest", subjectId: id, summary: `Approved landing page test ${id}; baseline hash ${baseline}; challenger hash ${challengerHash}.` });
    return id;
  },
});

export const startSubject = mutation({
  args: { slug: v.string(), campaignId: v.id("outboundCampaigns"), subject: v.string(), outcomeWindowDays: v.optional(v.number()) },
  handler: async (ctx, a) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: a.slug }, "approve");
    const c = assertSameOrg(await ctx.db.get(a.campaignId), org._id, "campaign");
    const cur = c.sequence[0]?.subject;
    const b = a.subject.trim().slice(0, 120);
    if (!cur) throw appError("INVALID", "This campaign has no emails yet.");
    if (!b || b === cur) throw appError("INVALID", "Write a different subject line to test.");
    if (await activeTest(ctx, c._id)) throw appError("INVALID", "A test is already active on this campaign.");
    const baseline = await sha256Hex(cur);
    const id = await start(ctx, org._id, "email_subject", c._id, cur, b, a.outcomeWindowDays, baseline);
    const challengerHash = await sha256Hex(b);
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "ab_test.approved_and_started", subjectType: "abTest", subjectId: id, summary: `Approved email subject test ${id}; baseline hash ${baseline}; challenger hash ${challengerHash}.` });
    return id;
  },
});

async function start(ctx: MutationCtx, orgId: Id<"organizations">, kind: Doc<"abTests">["kind"], targetId: string, a: string, b: string, requestedWindowDays: number | undefined, baselineHash: string) {
  const outcomeWindowDays = requestedWindowDays ?? RULES[kind].outcomeWindowDays;
  if (!Number.isInteger(outcomeWindowDays) || outcomeWindowDays < 0 || outcomeWindowDays > 30) throw appError("INVALID", "Choose an outcome window from 0 to 30 whole days.");
  return ctx.db.insert("abTests", { orgId, kind, targetId, baselineHash, variants: [{ key: "A", value: a }, { key: "B", value: b }], stats: [{ key: "A", assigned: 0, exposed: 0, trials: 0, wins: 0 }, { key: "B", assigned: 0, exposed: 0, trials: 0, wins: 0 }], status: "running", outcomeWindowMs: outcomeWindowDays * DAY_MS, startedAt: Date.now() });
}

export const stop = mutation({
  args: { slug: v.string(), id: v.id("abTests") },
  handler: async (ctx, { slug, id }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "pause");
    const t = assertSameOrg(await ctx.db.get(id), org._id, "test");
    if (t.status !== "running" && t.status !== "maturing") return;
    await ctx.db.patch(id, { status: "stopped", winner: undefined, note: "Stopped by an authorized workspace member. No version was applied.", endedAt: Date.now() });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "ab_test.stopped", subjectType: "abTest", subjectId: id, summary: `Stopped experiment ${id}; no variant was applied.` });
  },
});

/** Apply an exact, measured B variant only after a reviewer explicitly approves it. */
export const applyWinner = mutation({
  args: { slug: v.string(), id: v.id("abTests") },
  handler: async (ctx, { slug, id }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "approve");
    const test = assertSameOrg(await ctx.db.get(id), org._id, "test");
    if (test.status !== "done" || test.winner !== "B") throw appError("INVALID", "Only a completed test with B recorded as the winner can be applied.");
    if (test.appliedAt) throw appError("INVALID", "This version has already been applied.");
    await applyB(ctx, test);
    const appliedAt = Date.now();
    await ctx.db.patch(id, { appliedAt });
    const versionHash = await sha256Hex(test.variants.find((variant) => variant.key === "B")?.value ?? "");
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "ab_test.winner_applied", subjectType: test.kind === "landing" ? "landingPage" : "outboundCampaign", subjectId: test.targetId, summary: `Approved variant B from experiment ${id}; approved content hash ${versionHash}.` });
    return { appliedAt };
  },
});
