import { v } from "convex/values";
import { decide, variantFor } from "../shared/abtest";
import { cleanLanding, type LandingContent } from "../shared/landing";
import { sha256Hex } from "../shared/policy";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { appError, assertSameOrg, requireOrgAccess } from "./lib/tenancy";

/** A/B tests on landing page headlines (leads per view) and outreach subjects (reply rate). */

/** Planned end per test (total trials): the result is read once there (shared/abtest decide). Small sites can reach 1,000 views; it detects only big differences. */
const RULES = { landing: { min: 100, max: 1000 }, email_subject: { min: 30, max: 600 } } as const;

export async function runningTest(ctx: { db: MutationCtx["db"] }, targetId: string) {
  return ctx.db.query("abTests").withIndex("by_target", (q) => q.eq("targetId", targetId).eq("status", "running")).first();
}

/** Count a trial (view / send) or a win (lead / reply), then decide; apply a B win. */
export async function recordAb(ctx: MutationCtx, test: Doc<"abTests">, key: string, field: "assigned" | "trials" | "wins") {
  if ((field !== "wins" && test.status !== "running") || !["A", "B"].includes(key)) return;
  const stats = test.stats.map((s) => {
    if (s.key !== key) return s;
    if (field === "assigned") return { ...s, assigned: (s.assigned ?? 0) + 1 };
    if (field === "trials") return { ...s, exposed: (s.exposed ?? s.trials) + 1, trials: s.trials + 1 };
    return { ...s, wins: s.wins + 1 };
  });
  // Late outcomes remain on their assignment record, not in the decision snapshot.
  if (field === "wins" && test.status !== "running") return;
  const rule = RULES[test.kind];
  const d = decide(stats, rule.min, rule.max);
  if (field === "assigned" || !d.done) {
    await ctx.db.patch(test._id, { stats });
    return;
  }
  await ctx.db.patch(test._id, {
    stats,
    status: d.validity === "invalid" ? "invalid" : "done",
    ...(d.winner ? { winner: d.winner } : { winner: undefined }),
    note: d.note,
    endedAt: Date.now(),
  });
  if (d.winner === "B") await applyB(ctx, test);
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

export async function recordOutcome(ctx: MutationCtx, assignment: NonNullable<Awaited<ReturnType<typeof assignSubject>>>, test: Doc<"abTests">) {
  if (!assignment.exposedAt || assignment.outcomeAt) return false;
  await ctx.db.patch(assignment._id, { outcomeAt: Date.now() });
  await recordAb(ctx, test, assignment.variant, "wins");
  return true;
}

async function applyB(ctx: MutationCtx, test: Doc<"abTests">) {
  const b = test.variants.find((x) => x.key === "B")?.value;
  if (!b) return;
  if (test.kind === "landing") {
    const id = ctx.db.normalizeId("landingPages", test.targetId);
    const page = id ? await ctx.db.get(id) : null;
    if (page?.content) await ctx.db.patch(page._id, { content: JSON.stringify(cleanLanding({ ...(JSON.parse(page.content) as LandingContent), ...(JSON.parse(b) as Partial<LandingContent>) })), updatedAt: Date.now() });
  } else {
    const id = ctx.db.normalizeId("outboundCampaigns", test.targetId);
    const c = id ? await ctx.db.get(id) : null;
    if (c?.sequence[0]) await ctx.db.patch(c._id, { sequence: c.sequence.map((s, i) => (i === 0 ? { ...s, subject: b } : s)), updatedAt: Date.now() });
  }
}

function view(t: Doc<"abTests">) {
  const rule = RULES[t.kind];
  const d = decide(t.stats, rule.min, rule.max);
  return { id: t._id, kind: t.kind, status: t.status, winner: t.winner ?? null, note: t.note ?? d.note, variants: t.variants, stats: t.stats.map((s) => ({ ...s, assigned: s.assigned ?? 0, exposed: s.exposed ?? s.trials, rate: s.trials ? Math.round((s.wins / s.trials) * 1000) / 10 : 0 })), lift: d.lift, confidence: d.confidence, startedAt: t.startedAt };
}

export const forTarget = query({
  args: { slug: v.string(), targetId: v.string() },
  handler: async (ctx, { slug, targetId }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const rows = (await ctx.db.query("abTests").withIndex("by_org", (q) => q.eq("orgId", org._id)).order("desc").take(100)).filter((t) => t.targetId === targetId);
    return rows.slice(0, 5).map(view);
  },
});

export const startLanding = mutation({
  args: { slug: v.string(), pageId: v.id("landingPages"), headline: v.string(), subhead: v.optional(v.string()), ctaLabel: v.optional(v.string()) },
  handler: async (ctx, a) => {
    const { org } = await requireOrgAccess(ctx, { slug: a.slug }, "edit");
    const page = assertSameOrg(await ctx.db.get(a.pageId), org._id, "page");
    if (!page.content) throw appError("INVALID", "The page isn't written yet.");
    if (await runningTest(ctx, page._id)) throw appError("INVALID", "A test is already running on this page.");
    const cur = JSON.parse(page.content) as LandingContent;
    const b = { headline: a.headline.trim().slice(0, 90), ...(a.subhead?.trim() ? { subhead: a.subhead.trim().slice(0, 220) } : {}), ...(a.ctaLabel?.trim() ? { ctaLabel: a.ctaLabel.trim().slice(0, 32) } : {}) };
    if (!b.headline || b.headline === cur.headline) throw appError("INVALID", "Write a different headline to test.");
    return start(ctx, org._id, "landing", page._id, JSON.stringify({ headline: cur.headline, subhead: cur.subhead, ctaLabel: cur.ctaLabel }), JSON.stringify(b));
  },
});

export const startSubject = mutation({
  args: { slug: v.string(), campaignId: v.id("outboundCampaigns"), subject: v.string() },
  handler: async (ctx, a) => {
    const { org } = await requireOrgAccess(ctx, { slug: a.slug }, "edit");
    const c = assertSameOrg(await ctx.db.get(a.campaignId), org._id, "campaign");
    const cur = c.sequence[0]?.subject;
    const b = a.subject.trim().slice(0, 120);
    if (!cur) throw appError("INVALID", "This campaign has no emails yet.");
    if (!b || b === cur) throw appError("INVALID", "Write a different subject line to test.");
    if (await runningTest(ctx, c._id)) throw appError("INVALID", "A test is already running on this campaign.");
    return start(ctx, org._id, "email_subject", c._id, cur, b);
  },
});

async function start(ctx: MutationCtx, orgId: Id<"organizations">, kind: Doc<"abTests">["kind"], targetId: string, a: string, b: string) {
  return ctx.db.insert("abTests", { orgId, kind, targetId, variants: [{ key: "A", value: a }, { key: "B", value: b }], stats: [{ key: "A", assigned: 0, exposed: 0, trials: 0, wins: 0 }, { key: "B", assigned: 0, exposed: 0, trials: 0, wins: 0 }], status: "running", startedAt: Date.now() });
}

export const stop = mutation({
  args: { slug: v.string(), id: v.id("abTests"), keep: v.union(v.literal("A"), v.literal("B")) },
  handler: async (ctx, { slug, id, keep }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "edit");
    const t = assertSameOrg(await ctx.db.get(id), org._id, "test");
    if (t.status !== "running") return;
    await ctx.db.patch(id, { status: "stopped", winner: keep, note: `Stopped by you; kept ${keep === "A" ? "the original" : "the new version"}.`, endedAt: Date.now() });
    if (keep === "B") await applyB(ctx, t);
  },
});
