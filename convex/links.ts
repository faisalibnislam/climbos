import { v } from "convex/values";
import { newLinkCode, utmFor, withUtm } from "../shared/links";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { appError, assertSameOrg, requireOrgAccess } from "./lib/tenancy";

/**
 * Tracked links: climbos.app/l/CODE redirects to the owner's page with UTM
 * tags and counts human clicks per day. Drafts get one automatically.
 */

const SITE = () => process.env.SITE_URL ?? "https://climbos.app";
const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export async function createLink(ctx: MutationCtx, p: { orgId: Id<"organizations">; url: string; label: string; channel?: string; campaign?: string; artifactId?: Id<"artifacts">; source: "auto" | "manual" }) {
  const tagged = withUtm(p.url, utmFor(p.channel ?? "link", p.campaign || "climbos"));
  if (!tagged) return null;
  let code = newLinkCode();
  while (await ctx.db.query("links").withIndex("by_code", (q) => q.eq("code", code)).first()) code = newLinkCode();
  const id = await ctx.db.insert("links", { orgId: p.orgId, code, url: tagged, label: p.label.slice(0, 120), channel: p.channel, campaign: p.campaign, artifactId: p.artifactId, source: p.source, clicks: 0, createdAt: Date.now() });
  return { id, code, shortUrl: `${SITE()}/l/${code}`, url: tagged };
}

/** Public: resolve a short link and count the click (bots excluded by the caller). */
export const click = mutation({
  args: { code: v.string(), human: v.boolean() },
  handler: async (ctx, { code, human }) => {
    if (!/^[A-Za-z0-9]{4,12}$/.test(code)) return null;
    const link = await ctx.db.query("links").withIndex("by_code", (q) => q.eq("code", code)).first();
    if (!link) return null;
    if (human) {
      const now = Date.now();
      await ctx.db.patch(link._id, { clicks: link.clicks + 1, lastClickAt: now });
      const day = dayKey(now);
      const row = await ctx.db.query("linkClickDays").withIndex("by_link_day", (q) => q.eq("linkId", link._id).eq("day", day)).first();
      if (row) await ctx.db.patch(row._id, { clicks: row.clicks + 1 });
      else await ctx.db.insert("linkClickDays", { orgId: link.orgId, linkId: link._id, day, clicks: 1 });
    }
    return link.url;
  },
});

export const list = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const links = await ctx.db.query("links").withIndex("by_org_created", (q) => q.eq("orgId", org._id)).order("desc").take(300);
    const since = dayKey(Date.now() - 6 * 86_400_000);
    const days = await ctx.db.query("linkClickDays").withIndex("by_org_day", (q) => q.eq("orgId", org._id).gte("day", since)).take(5000);
    const week = new Map<string, number>();
    for (const d of days) week.set(d.linkId, (week.get(d.linkId) ?? 0) + d.clicks);
    return {
      links: links.map((l) => ({ id: l._id, label: l.label, shortUrl: `${SITE()}/l/${l.code}`, url: l.url, channel: l.channel ?? null, source: l.source, clicks: l.clicks, week: week.get(l._id) ?? 0, lastClickAt: l.lastClickAt ?? null, createdAt: l.createdAt, artifactId: l.artifactId ?? null })),
      weekTotal: days.reduce((s, d) => s + d.clicks, 0),
      tracking: org.linkTracking !== false,
    };
  },
});

export const create = mutation({
  args: { slug: v.string(), url: v.string(), label: v.optional(v.string()), channel: v.optional(v.string()), campaign: v.optional(v.string()) },
  handler: async (ctx, a) => {
    const { org } = await requireOrgAccess(ctx, { slug: a.slug }, "edit");
    const url = /^https?:\/\//i.test(a.url.trim()) ? a.url.trim() : `https://${a.url.trim()}`;
    const count = (await ctx.db.query("links").withIndex("by_org_created", (q) => q.eq("orgId", org._id)).take(2001)).length;
    if (count >= 2000) throw appError("LIMIT_REACHED", "You have 2,000 links. Remove old ones first.");
    const campaign = a.campaign?.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").slice(0, 60) || undefined;
    const made = await createLink(ctx, { orgId: org._id, url: url.slice(0, 2000), label: a.label?.trim() || new URL(url).hostname, channel: a.channel, campaign, source: "manual" });
    if (!made) throw appError("INVALID", "That link doesn't look right.");
    return made;
  },
});

export const setTracking = mutation({
  args: { slug: v.string(), on: v.boolean() },
  handler: async (ctx, { slug, on }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "manage_policies");
    await ctx.db.patch(org._id, { linkTracking: on });
  },
});

export const remove = mutation({
  args: { slug: v.string(), id: v.id("links") },
  handler: async (ctx, { slug, id }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "edit");
    assertSameOrg(await ctx.db.get(id), org._id, "link");
    await ctx.db.delete(id);
  },
});

/** Human clicks on this org's links in [from, to). */
export async function linkClicksBetween(ctx: { db: MutationCtx["db"] } | { db: import("./_generated/server").QueryCtx["db"] }, orgId: Id<"organizations">, from: number, to: number) {
  const rows = await ctx.db.query("linkClickDays").withIndex("by_org_day", (q) => q.eq("orgId", orgId).gte("day", dayKey(from)).lt("day", dayKey(to))).take(10000);
  return rows.reduce((s, r) => s + r.clicks, 0);
}
