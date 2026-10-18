import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { featureAllowed } from "./lib/access";
import { appError, assertSameOrg, requireOrgAccess } from "./lib/tenancy";
import { reportBetween } from "./reports";

/**
 * White-label client reports: a read-only results page an agency shares with
 * its client, in the agency's name and colours (packages hide the ClimbOS
 * mark). Outcomes only; no credits or internal to-dos.
 */

const SITE = () => process.env.SITE_URL ?? "https://climbos.app";
const DAY = 86_400_000;
const INTERNAL = new Set(["creditsUsed", "jobsDone"]);

function token(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
}

export const branding = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const account = org.accountId ? await ctx.db.get(org.accountId) : null;
    const shares = await ctx.db.query("reportShares").withIndex("by_org", (q) => q.eq("orgId", org._id)).take(20);
    return {
      brandName: account?.brandName ?? "",
      brandColor: account?.brandColor ?? "#0b5d46",
      brandLogoUrl: account?.brandLogoUrl ?? "",
      whiteLabel: await featureAllowed(ctx, org, "no_badge"),
      links: shares.filter((s) => !s.revokedAt).map((s) => ({ id: s._id, url: `${SITE()}/report/${s.token}`, views: s.views, createdAt: s.createdAt })),
    };
  },
});

export const setBranding = mutation({
  args: { slug: v.string(), brandName: v.string(), brandColor: v.string(), brandLogoUrl: v.string() },
  handler: async (ctx, a) => {
    const { org } = await requireOrgAccess(ctx, { slug: a.slug }, "manage_team");
    if (!org.accountId) throw appError("NOT_FOUND", "No account.");
    const logo = a.brandLogoUrl.trim();
    if (logo && !/^https:\/\/\S+$/i.test(logo)) throw appError("INVALID", "The logo link must start with https://");
    await ctx.db.patch(org.accountId, { brandName: a.brandName.trim().slice(0, 60) || undefined, brandColor: /^#[0-9a-f]{6}$/i.test(a.brandColor) ? a.brandColor : undefined, brandLogoUrl: logo.slice(0, 500) || undefined });
  },
});

export const createLink = mutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "export");
    const live = (await ctx.db.query("reportShares").withIndex("by_org", (q) => q.eq("orgId", org._id)).take(20)).filter((s) => !s.revokedAt);
    if (live.length >= 5) throw appError("LIMIT_REACHED", "You have 5 live links. Turn one off first.");
    const t = token();
    await ctx.db.insert("reportShares", { orgId: org._id, token: t, views: 0, createdBy: user._id, createdAt: Date.now() });
    return `${SITE()}/report/${t}`;
  },
});

export const revoke = mutation({
  args: { slug: v.string(), id: v.id("reportShares") },
  handler: async (ctx, { slug, id }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "export");
    assertSameOrg(await ctx.db.get(id), org._id, "link");
    await ctx.db.patch(id, { revokedAt: Date.now() });
  },
});

async function shareFor(ctx: { db: import("./_generated/server").QueryCtx["db"] }, t: string): Promise<Doc<"reportShares"> | null> {
  if (!/^[0-9a-f]{32}$/.test(t)) return null;
  const s = await ctx.db.query("reportShares").withIndex("by_token", (q) => q.eq("token", t)).first();
  return s && !s.revokedAt ? s : null;
}

/** Public: the client's view. */
export const shared = query({
  args: { token: v.string(), days: v.optional(v.number()) },
  handler: async (ctx, { token: t, days }) => {
    const s = await shareFor(ctx, t);
    if (!s) return null;
    const org = await ctx.db.get(s.orgId);
    if (!org || org.deletedAt) return null;
    const account = org.accountId ? await ctx.db.get(org.accountId) : null;
    const business = await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", org._id)).first();
    const span = (days === 7 || days === 90 ? days : 30) * DAY;
    const now = Date.now();
    const r = await reportBetween(ctx, org, now - span, now + 1, span, now);
    const whiteLabel = await featureAllowed(ctx, org, "no_badge");
    return {
      client: business?.name ?? org.name,
      agency: account?.brandName || null,
      color: account?.brandColor ?? "#0b5d46",
      logoUrl: account?.brandLogoUrl ?? null,
      poweredBy: !whiteLabel,
      from: now - span,
      to: now,
      headline: r.headline.replace("this week", span === 7 * DAY ? "this week" : `in the last ${span / DAY} days`).replace("A quiet week", "A quiet stretch"),
      lines: r.lines.filter((l) => !INTERNAL.has(l.key)),
      competitors: r.competitors ?? [],
    };
  },
});

export const viewed = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token: t }) => {
    const s = await shareFor(ctx, t);
    if (s) await ctx.db.patch(s._id, { views: s.views + 1 });
  },
});
