import { v } from "convex/values";
import { CALL_ROUTES } from "../shared/agents/routes";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query, type MutationCtx } from "./_generated/server";
import { createRunWithReservation } from "./engine";
import { isPaid } from "./lib/access";
import { appError, assertSameOrg, requireOrgAccess } from "./lib/tenancy";

/**
 * Competitor watch: each week we read competitors' homepage and pricing page
 * with our own fetcher (free) and only spend credits (Luna, ~1 credit) when
 * something meaningful changed.
 */

const MODEL = CALL_ROUTES.chat_intent;
const LIMIT = { free: 1, paid: 5 };

export const overview = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const watches = await ctx.db.query("competitorWatches").withIndex("by_org", (q) => q.eq("orgId", org._id)).take(20);
    const changes = await ctx.db.query("competitorChanges").withIndex("by_org_at", (q) => q.eq("orgId", org._id)).order("desc").take(30);
    const business = await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", org._id)).first();
    const watched = new Set(watches.map((w) => w.url));
    const suggested = (business?.insights?.competitors ?? []).filter((c) => c.url && !watched.has(normaliseUrl(c.url) ?? "")).map((c) => ({ name: c.name, url: c.url! }));
    return {
      limit: (await isPaid(ctx, org)) ? LIMIT.paid : LIMIT.free,
      watches: watches.map((w) => ({ id: w._id, name: w.name, url: w.url, active: w.active, lastCheckedAt: w.lastCheckedAt ?? null, lastError: w.lastError ?? null })),
      changes: changes.map((c) => ({ id: c._id, name: c.name, summary: c.summary, bullets: c.bullets, soWhat: c.soWhat ?? null, at: c.at })),
      suggested: suggested.slice(0, 6),
    };
  },
});

function normaliseUrl(input: string): string | null {
  let s = input.trim();
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return `${u.protocol}//${u.host}${u.pathname.replace(/\/$/, "")}`;
  } catch {
    return null;
  }
}

export const add = mutation({
  args: { slug: v.string(), name: v.string(), url: v.string() },
  handler: async (ctx, a) => {
    const { org } = await requireOrgAccess(ctx, { slug: a.slug }, "edit");
    const url = normaliseUrl(a.url);
    if (!url) throw appError("INVALID", "That website address doesn't look right.");
    const existing = await ctx.db.query("competitorWatches").withIndex("by_org", (q) => q.eq("orgId", org._id)).take(20);
    if (existing.some((w) => w.url === url)) throw appError("INVALID", "You're already watching that site.");
    const limit = (await isPaid(ctx, org)) ? LIMIT.paid : LIMIT.free;
    if (existing.filter((w) => w.active).length >= limit) throw appError(limit === LIMIT.free ? "PAYMENT_REQUIRED" : "LIMIT_REACHED", limit === LIMIT.free ? "Free accounts watch 1 competitor. Packages watch 5." : `You can watch up to ${limit} competitors.`);
    const id = await ctx.db.insert("competitorWatches", { orgId: org._id, name: a.name.trim().slice(0, 80) || new URL(url).hostname, url, active: true, createdAt: Date.now() });
    // First read sets the baseline (no credits).
    await ctx.scheduler.runAfter(0, internal.competitorActions.check, { orgId: org._id, watchIds: [id] });
    return id;
  },
});

export const remove = mutation({
  args: { slug: v.string(), id: v.id("competitorWatches") },
  handler: async (ctx, { slug, id }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "edit");
    assertSameOrg(await ctx.db.get(id), org._id, "competitor");
    await ctx.db.delete(id);
  },
});

/** "Check now": each competitor at most every 6 hours (a newly added one can be checked right away). */
export const checkNow = mutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "edit");
    const watches = (await ctx.db.query("competitorWatches").withIndex("by_org", (q) => q.eq("orgId", org._id)).take(20)).filter((w) => w.active);
    if (!watches.length) throw appError("INVALID", "Add a competitor first.");
    const due = watches.filter((w) => !w.lastCheckedAt || Date.now() - w.lastCheckedAt >= 6 * 3_600_000);
    if (!due.length) throw appError("RATE_LIMITED", "All checked in the last 6 hours. Sites rarely change faster than that.");
    await ctx.scheduler.runAfter(0, internal.competitorActions.check, { orgId: org._id, watchIds: due.map((w) => w._id) });
    return { checking: due.length, skipped: watches.length - due.length };
  },
});

export const watchesFor = internalQuery({
  args: { watchIds: v.array(v.id("competitorWatches")) },
  handler: async (ctx, { watchIds }) => (await Promise.all(watchIds.map((id) => ctx.db.get(id)))).filter((w): w is Doc<"competitorWatches"> => Boolean(w?.active)),
});

export const saveCheck = internalMutation({
  args: { watchId: v.id("competitorWatches"), hash: v.optional(v.string()), text: v.optional(v.string()), error: v.optional(v.string()) },
  handler: async (ctx, { watchId, hash, text, error }) => {
    if (!(await ctx.db.get(watchId))) return;
    await ctx.db.patch(watchId, error ? { lastCheckedAt: Date.now(), lastError: error.slice(0, 200) } : { lastCheckedAt: Date.now(), lastHash: hash, lastText: text?.slice(0, 60_000), lastError: undefined });
  },
});

/** Reserve credits for summarising changes (skips quietly when the account can't pay). */
export const startSummaryRun = internalMutation({
  args: { orgId: v.id("organizations"), count: v.number() },
  handler: async (ctx, { orgId, count }): Promise<Id<"workflowRuns"> | null> => {
    const org = await ctx.db.get(orgId);
    if (!org) return null;
    try {
      return await createRunWithReservation(ctx, { org, kind: "competitor_watch", title: "Competitor watch", roles: ["data_analyst"], input: { count }, steps: Array.from({ length: Math.min(5, count) }, () => ({ kind: "model" as const, role: "data_analyst" as const, modelKey: MODEL, inputBudget: 5_000, outputBudget: 700 })), meters: {}, isFixture: org.kind === "demo" });
    } catch {
      return null;
    }
  },
});

export const recordChange = internalMutation({
  args: { orgId: v.id("organizations"), watchId: v.id("competitorWatches"), name: v.string(), summary: v.string(), bullets: v.array(v.string()), soWhat: v.optional(v.string()) },
  handler: async (ctx, a) => {
    const now = Date.now();
    await ctx.db.insert("competitorChanges", { ...a, summary: a.summary.slice(0, 300), bullets: a.bullets.slice(0, 4).map((b) => b.slice(0, 300)), soWhat: a.soWhat?.slice(0, 300), at: now });
    await notifyOwners(ctx, a.orgId, `${a.name}: ${a.summary}`.slice(0, 240));
  },
});

async function notifyOwners(ctx: MutationCtx, orgId: Id<"organizations">, text: string) {
  const org = await ctx.db.get(orgId);
  if (!org) return;
  for (const m of await ctx.db.query("memberships").withIndex("by_org", (q) => q.eq("orgId", orgId)).take(50)) {
    if (m.status === "active" && m.userId && ["owner", "admin"].includes(m.role)) await ctx.db.insert("notices", { userId: m.userId, orgId, kind: "system", text, href: `/app/${org.slug}/competitors`, createdAt: Date.now() });
  }
}

/** Mondays: check every active watch, one action per workspace. */
export const weekly = internalMutation({
  args: {},
  handler: async (ctx) => {
    const byOrg = new Map<Id<"organizations">, Id<"competitorWatches">[]>();
    for (const w of await ctx.db.query("competitorWatches").withIndex("by_active", (q) => q.eq("active", true)).take(5000)) byOrg.set(w.orgId, [...(byOrg.get(w.orgId) ?? []), w._id]);
    let i = 0;
    for (const [orgId, watchIds] of byOrg) await ctx.scheduler.runAfter((i++ % 60) * 5_000, internal.competitorActions.check, { orgId, watchIds });
    return byOrg.size;
  },
});
