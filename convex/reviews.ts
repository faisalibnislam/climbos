import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { requirePaid } from "./lib/access";
import { audit } from "./lib/audit";
import { appError, requireOrgAccess } from "./lib/tenancy";
import { sha256Hex } from "../shared/policy";

/**
 * Reviews engine. Every customer is sent to the public review site (no
 * "review gating": Google forbids filtering out unhappy customers); the page
 * also offers a private note, which lands in the Inbox. Pasted public reviews
 * land there too so Climb AI can draft the reply.
 */

const SITE = () => process.env.SITE_URL ?? "https://climbos.app";
const DAILY_LIMIT = 50;

function token(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, "0")).join("");
}

export const overview = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const business = await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", org._id)).first();
    const requests = await ctx.db.query("reviewRequests").withIndex("by_org_created", (q) => q.eq("orgId", org._id)).order("desc").take(500);
    const asked = new Set(requests.map((r) => r.email));
    const won = await ctx.db.query("deals").withIndex("by_org_stage", (q) => q.eq("orgId", org._id).eq("stage", "won")).take(500);
    return {
      reviewUrl: business?.reviewUrl ?? null,
      pageUrl: `${SITE()}/review/${org.slug}`,
      stats: { sent: requests.filter((r) => r.status === "sent").length, clicked: requests.filter((r) => r.clickedAt).length, feedback: requests.filter((r) => r.feedbackAt).length },
      recent: requests.slice(0, 30).map((r) => ({ id: r._id, name: r.name, email: r.email, status: r.status, sentAt: r.sentAt ?? null, clicked: Boolean(r.clickedAt), feedback: Boolean(r.feedbackAt), error: r.error ?? null })),
      candidates: won.filter((d) => d.email && !asked.has(d.email)).map((d) => ({ dealId: d._id, name: d.name, email: d.email! })),
    };
  },
});

export const setReviewUrl = mutation({
  args: { slug: v.string(), url: v.string() },
  handler: async (ctx, { slug, url }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "edit");
    const clean = url.trim();
    if (clean && !/^https:\/\/[^\s]+$/i.test(clean)) throw appError("INVALID", "Paste the full https:// link to your review page.");
    const business = await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", org._id)).first();
    if (!business) throw appError("NOT_FOUND", "Finish setting up your business first.");
    await ctx.db.patch(business._id, { reviewUrl: clean.slice(0, 1000) || undefined });
  },
});

/** Ask customers for a review, from the owner's mailbox (paid; at most 50 a day). */
export const request = mutation({
  args: { slug: v.string(), people: v.array(v.object({ name: v.string(), email: v.string(), dealId: v.optional(v.id("deals")) })) },
  handler: async (ctx, { slug, people }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "edit");
    if (org.kind === "demo") throw appError("INVALID", "Demo workspaces can't send email.");
    await requirePaid(ctx, org, "sending");
    const business = await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", org._id)).first();
    if (!business?.reviewUrl) throw appError("INVALID", "Add your review link first (for example your Google review link).");
    const mailbox = await ctx.db.query("connections").withIndex("by_org_provider", (q) => q.eq("orgId", org._id).eq("provider", "email_mailbox")).first();
    if (mailbox?.status !== "connected") throw appError("INVALID", "Connect your mailbox in Connections first.");
    const today = await ctx.db.query("reviewRequests").withIndex("by_org_created", (q) => q.eq("orgId", org._id).gte("createdAt", Date.now() - 86_400_000)).take(DAILY_LIMIT + 1);
    const room = DAILY_LIMIT - today.length;
    if (room <= 0) throw appError("RATE_LIMITED", `You've asked ${DAILY_LIMIT} people today. Try again tomorrow.`);
    const ids: Id<"reviewRequests">[] = [];
    for (const p of people.slice(0, room)) {
      const email = p.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
      const emailHash = await sha256Hex(email);
      if (await ctx.db.query("suppressions").withIndex("by_org_email", (q) => q.eq("orgId", org._id).eq("emailHash", emailHash)).first()) continue;
      ids.push(await ctx.db.insert("reviewRequests", { orgId: org._id, dealId: p.dealId, name: p.name.trim().slice(0, 80) || email, email, token: token(), status: "queued", createdAt: Date.now() }));
    }
    if (!ids.length) throw appError("INVALID", "No valid emails to ask.");
    await ctx.scheduler.runAfter(0, internal.mailbox.sendReviewRequests, { ids });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "reviews.requested", summary: `Asked ${ids.length} customer${ids.length === 1 ? "" : "s"} for a review.` });
    return { queued: ids.length, skipped: people.length - ids.length };
  },
});

export const prepareRequest = internalQuery({
  args: { id: v.id("reviewRequests") },
  handler: async (ctx, { id }) => {
    const r = await ctx.db.get(id);
    if (!r || r.status !== "queued") return null;
    const org = await ctx.db.get(r.orgId);
    const business = await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", r.orgId)).first();
    const mailbox = await ctx.db.query("connections").withIndex("by_org_provider", (q) => q.eq("orgId", r.orgId).eq("provider", "email_mailbox")).first();
    if (!org || !business || mailbox?.status !== "connected") return null;
    const link = `${SITE()}/review/${org.slug}?t=${r.token}`;
    const first = r.name.split(/\s+/)[0];
    return {
      connectionId: mailbox._id,
      to: r.email,
      subject: `Quick favour from ${business.name}?`,
      text: `Hi ${first},\n\nThanks for choosing ${business.name}. Would you share a quick review? It takes a minute and helps others find us:\n\n${link}\n\nThank you!\n${business.name}\n\nReply "stop" and we won't ask again.`,
    };
  },
});

export const recordRequest = internalMutation({
  args: { id: v.id("reviewRequests"), ok: v.boolean(), error: v.optional(v.string()) },
  handler: async (ctx, { id, ok, error }) => {
    await ctx.db.patch(id, ok ? { status: "sent", sentAt: Date.now() } : { status: "failed", error: error?.slice(0, 200) });
  },
});

/* ---------------- public review page ---------------- */

export const publicPage = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const org = await ctx.db.query("organizations").withIndex("by_slug", (q) => q.eq("slug", slug)).first();
    if (!org || org.deletedAt || org.kind !== "customer") return null;
    const business = await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", org._id)).first();
    if (!business?.reviewUrl) return null;
    return { name: business.name, reviewUrl: business.reviewUrl };
  },
});

/** The customer tapped "Leave a review" (counts the click for their request, if any). */
export const opened = mutation({
  args: { slug: v.string(), t: v.optional(v.string()) },
  handler: async (ctx, { slug, t }) => {
    if (!t) return;
    const r = await ctx.db.query("reviewRequests").withIndex("by_token", (q) => q.eq("token", t)).first();
    const org = await ctx.db.query("organizations").withIndex("by_slug", (q) => q.eq("slug", slug)).first();
    if (r && org && r.orgId === org._id && !r.clickedAt) await ctx.db.patch(r._id, { clickedAt: Date.now() });
  },
});

/** A private note from the review page: lands in the owner's Inbox. */
export const privateFeedback = mutation({
  args: { slug: v.string(), t: v.optional(v.string()), name: v.optional(v.string()), text: v.string(), rating: v.optional(v.number()) },
  handler: async (ctx, a) => {
    const org = await ctx.db.query("organizations").withIndex("by_slug", (q) => q.eq("slug", a.slug)).first();
    if (!org || org.kind !== "customer") throw appError("NOT_FOUND", "This page isn't available.");
    const text = a.text.trim().slice(0, 2000);
    if (text.length < 3) throw appError("INVALID", "Please write a few words.");
    const now = Date.now();
    const recent = await ctx.db.query("communityMessages").withIndex("by_org_received", (q) => q.eq("orgId", org._id).gte("receivedAt", now - 3_600_000)).take(60);
    if (recent.filter((m) => m.channel === "feedback").length >= 20) throw appError("RATE_LIMITED", "Thanks! We've had a lot of notes this hour. Please try again later.");
    const r = a.t ? await ctx.db.query("reviewRequests").withIndex("by_token", (q) => q.eq("token", a.t!)).first() : null;
    const req = r && r.orgId === org._id ? r : null;
    if (req) await ctx.db.patch(req._id, { feedbackAt: now });
    const rating = a.rating ? Math.max(1, Math.min(5, Math.round(a.rating))) : null;
    await ctx.db.insert("communityMessages", { orgId: org._id, channel: "feedback", kind: "review", externalId: `feedback:${now}:${Math.random().toString(36).slice(2, 8)}`, authorName: req?.name ?? (a.name?.trim().slice(0, 80) || "A customer"), fromEmail: req?.email, text: `${rating ? `${"★".repeat(rating)}${"☆".repeat(5 - rating)}\n\n` : ""}${text}`, receivedAt: now, status: "new", createdAt: now, updatedAt: now });
  },
});

/** Paste a public review (Google, Facebook…) into the Inbox so Climb AI can draft a reply. */
export const addReview = mutation({
  args: { slug: v.string(), author: v.string(), text: v.string(), rating: v.optional(v.number()), source: v.string() },
  handler: async (ctx, a) => {
    const { org } = await requireOrgAccess(ctx, { slug: a.slug }, "edit");
    const text = a.text.trim().slice(0, 4000);
    if (!text) throw appError("INVALID", "Paste the review text.");
    const now = Date.now();
    const rating = a.rating ? Math.max(1, Math.min(5, Math.round(a.rating))) : null;
    return ctx.db.insert("communityMessages", { orgId: org._id, channel: a.source.slice(0, 30) || "google", kind: "review", externalId: `review:${now}`, authorName: a.author.trim().slice(0, 80) || "Reviewer", text: `${rating ? `${"★".repeat(rating)}${"☆".repeat(5 - rating)}\n\n` : ""}${text}`, receivedAt: now, status: "new", createdAt: now, updatedAt: now });
  },
});
