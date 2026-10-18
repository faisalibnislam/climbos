import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { featureAllowed } from "./lib/access";
import { notifyOwners } from "./lib/notify";
import { appError, requireOrgAccess } from "./lib/tenancy";
import { createLink } from "./links";

/** Link in bio: a simple page for Instagram/TikTok bios; links are tracked, sign-ups go to the Pipeline. */

const SITE = () => process.env.SITE_URL ?? "https://climbos.app";

export const get = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const p = await ctx.db.query("bioPages").withIndex("by_org", (q) => q.eq("orgId", org._id)).first();
    if (!p) return null;
    const clicks = await Promise.all(p.links.map(async (l) => (l.linkId ? ((await ctx.db.get(l.linkId))?.clicks ?? 0) : 0)));
    return { slug: p.slug, url: `${SITE()}/bio/${p.slug}`, title: p.title, bio: p.bio, color: p.color, links: p.links.map((l, i) => ({ label: l.label, url: l.url, clicks: clicks[i] })), collectEmails: p.collectEmails, live: p.live, views: p.views };
  },
});

export const save = mutation({
  args: { slug: v.string(), title: v.string(), bio: v.string(), color: v.string(), links: v.array(v.object({ label: v.string(), url: v.string() })), collectEmails: v.boolean(), live: v.boolean() },
  handler: async (ctx, a) => {
    const { org } = await requireOrgAccess(ctx, { slug: a.slug }, "edit");
    if (a.links.length > 12) throw appError("INVALID", "Up to 12 links.");
    const clean = a.links.map((l) => ({ label: l.label.trim().slice(0, 60), url: /^https?:\/\//i.test(l.url.trim()) ? l.url.trim() : `https://${l.url.trim()}` })).filter((l) => l.label && l.url.length > 10);
    for (const l of clean) if (!/^https:\/\/[^\s]+\.[^\s]+/i.test(l.url)) throw appError("INVALID", `“${l.label}” needs a full https:// link.`);
    const existing = await ctx.db.query("bioPages").withIndex("by_org", (q) => q.eq("orgId", org._id)).first();
    // Keep tracked links for unchanged URLs; make new ones for new URLs.
    const links = [];
    for (const l of clean) {
      const prev = existing?.links.find((x) => x.url === l.url && x.linkId);
      if (prev) links.push({ ...l, linkId: prev.linkId });
      else {
        const made = await createLink(ctx, { orgId: org._id, url: l.url, label: `Bio: ${l.label}`, channel: "instagram", campaign: "link-in-bio", source: "auto" });
        links.push({ ...l, linkId: made?.id });
      }
    }
    const now = Date.now();
    const fields = { title: a.title.trim().slice(0, 60) || org.name, bio: a.bio.trim().slice(0, 300), color: /^#[0-9a-f]{6}$/i.test(a.color) ? a.color : "#0b5d46", links, collectEmails: a.collectEmails, live: a.live, updatedAt: now };
    if (existing) {
      await ctx.db.patch(existing._id, fields);
      return existing.slug;
    }
    let pageSlug = org.slug.replace(/-[a-z0-9]{4,6}$/, "").slice(0, 40) || "page";
    if (await ctx.db.query("bioPages").withIndex("by_slug", (q) => q.eq("slug", pageSlug)).first()) pageSlug = org.slug;
    await ctx.db.insert("bioPages", { orgId: org._id, slug: pageSlug, ...fields, views: 0, createdAt: now });
    return pageSlug;
  },
});

export const publicPage = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const p = await ctx.db.query("bioPages").withIndex("by_slug", (q) => q.eq("slug", slug)).first();
    if (!p || !p.live) return null;
    const org = await ctx.db.get(p.orgId);
    if (!org || org.deletedAt || org.suspendedAt) return null;
    const codes = await Promise.all(p.links.map(async (l) => (l.linkId ? (await ctx.db.get(l.linkId))?.code : undefined)));
    return { title: p.title, bio: p.bio, color: p.color, collectEmails: p.collectEmails, links: p.links.map((l, i) => ({ label: l.label, href: codes[i] ? `/l/${codes[i]}` : l.url })), badge: !(await featureAllowed(ctx, org, "no_badge")) };
  },
});

export const viewed = mutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const p = await ctx.db.query("bioPages").withIndex("by_slug", (q) => q.eq("slug", slug)).first();
    if (p?.live) await ctx.db.patch(p._id, { views: p.views + 1 });
  },
});

export const signup = mutation({
  args: { slug: v.string(), email: v.string() },
  handler: async (ctx, { slug, email }) => {
    const p = await ctx.db.query("bioPages").withIndex("by_slug", (q) => q.eq("slug", slug)).first();
    if (!p?.live || !p.collectEmails) throw appError("NOT_FOUND", "This page isn't available.");
    const e = email.trim().toLowerCase().slice(0, 200);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw appError("INVALID", "Please add a valid email.");
    const now = Date.now();
    const recent = await ctx.db.query("communityMessages").withIndex("by_org_received", (q) => q.eq("orgId", p.orgId).gte("receivedAt", now - 3_600_000)).take(200);
    if (recent.filter((m) => m.kind === "form").length >= 60) throw appError("RATE_LIMITED", "Thanks! Please try again shortly.");
    const currency = (await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", p.orgId)).first())?.currency ?? "USD";
    await ctx.db.insert("deals", { orgId: p.orgId, name: e, email: e, stage: "lead", source: "inbox", currency, notes: [{ text: "Signed up on your link-in-bio page.", at: now }], createdAt: now, updatedAt: now });
    await ctx.db.insert("communityMessages", { orgId: p.orgId, channel: "link_in_bio", kind: "form", externalId: `bio:${p._id}:${now}`, authorName: e, fromEmail: e, subject: "Link in bio sign-up", text: "Signed up on your link-in-bio page.", receivedAt: now, status: "new", createdAt: now, updatedAt: now });
    await notifyOwners(ctx, p.orgId, `New sign-up from your link in bio: ${e}`, "pipeline");
  },
});
