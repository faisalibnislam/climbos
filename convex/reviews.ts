import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { requirePaid } from "./lib/access";
import { audit } from "./lib/audit";
import { notifyOwners } from "./lib/notify";
import { appError, requireOrgAccess } from "./lib/tenancy";
import { sha256Hex } from "../shared/policy";
import { unsubscribeToken } from "../shared/outbound/sending";
import { serverSecret } from "./lib/crypto";
import { reviewSafetySignals } from "../shared/reviews/safety";
import { groupVoiceThemes, VOICE_THEME_LABELS, type VoiceThemeKey } from "../shared/reviews/voiceThemes";

/**
 * Reviews engine. Every invited customer gets the same public review destination,
 * regardless of sentiment or private feedback. Invitations require explicit
 * approval of the frozen recipient scope, destination and template version.
 */

const SITE = () => process.env.SITE_URL ?? "https://climbos.app";
const DAILY_LIMIT = 50;
const ASK_AGAIN_AFTER = 90 * 86_400_000;

function publicReviewUrl(raw?: string): string | undefined {
  const value = raw?.trim();
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) throw new Error("unsafe URL");
    const normalized = url.toString();
    if (normalized.length > 2000) throw new Error("URL too long");
    return normalized;
  } catch {
    throw appError("INVALID", "Use a public https:// link to the review.");
  }
}

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

/** Tentative phrase-based themes from the most recent authorized inbox records. */
export const voiceThemes = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const cutoff = Date.now() - 180 * 86_400_000;
    const messages = (await ctx.db.query("communityMessages").withIndex("by_org_received", (q) => q.eq("orgId", org._id).gte("receivedAt", cutoff)).order("desc").take(500))
      .filter((message) => !message.isFixture);
    const deals = await ctx.db.query("deals").withIndex("by_org_updated", (q) => q.eq("orgId", org._id)).order("desc").take(250);
    const crmNotes = deals.flatMap((deal) => deal.notes.filter((note) => note.at >= cutoff).map((note) => ({ id: `deal:${deal._id}:${note.at}`, kind: "owner-entered CRM note", channel: "CRM", text: note.text, receivedAt: note.at, redact: [deal.name, deal.email ?? ""] })));
    const feedback = await ctx.db.query("voiceThemeFeedback").withIndex("by_org_theme", (q) => q.eq("orgId", org._id)).collect();
    const byKey = new Map(feedback.map((row) => [row.themeKey, row]));
    const sources = [...messages.map((message) => ({ id: String(message._id), kind: message.kind, channel: message.channel, text: message.text, receivedAt: message.receivedAt, redact: [message.authorName, message.fromEmail ?? ""], ...(message.reviewSourceUrl ? { sourceUrl: message.reviewSourceUrl } : {}) })), ...crmNotes]
      .sort((a, b) => b.receivedAt - a.receivedAt).slice(0, 500);
    const themes = groupVoiceThemes(sources)
      .map((theme) => {
        const saved = byKey.get(theme.key);
        return {
          ...theme,
          status: saved?.status ?? "suggested" as const,
          label: saved?.status === "corrected" ? saved.correctedLabel ?? theme.label : theme.label,
          ownerNote: saved?.note ?? null,
        };
      })
      ;
    return { themes, sourceCount: sources.length, windowDays: 180, sampleLimit: 500, minimumRepeatedSources: 2 };
  },
});

/** Persist a workspace owner's correction or dismissal of one phrase-based theme. */
export const setVoiceThemeFeedback = mutation({
  args: {
    slug: v.string(),
    themeKey: v.string(),
    status: v.union(v.literal("dismissed"), v.literal("corrected"), v.literal("clear")),
    correctedLabel: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: args.slug }, "edit");
    if (!Object.hasOwn(VOICE_THEME_LABELS, args.themeKey)) throw appError("INVALID", "Choose a current customer theme.");
    const existing = await ctx.db.query("voiceThemeFeedback").withIndex("by_org_theme", (q) => q.eq("orgId", org._id).eq("themeKey", args.themeKey)).first();
    if (args.status === "clear") {
      if (existing) await ctx.db.delete(existing._id);
      if (existing) await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "reviews.voice_theme_feedback_cleared", subjectType: "business", summary: `Restored the suggested grouping for ${VOICE_THEME_LABELS[args.themeKey as VoiceThemeKey]}.` });
      return { cleared: Boolean(existing) };
    }
    const correctedLabel = args.correctedLabel?.trim().slice(0, 60);
    if (args.status === "corrected" && (!correctedLabel || correctedLabel === "Other" || !Object.values(VOICE_THEME_LABELS).includes(correctedLabel as typeof VOICE_THEME_LABELS[VoiceThemeKey]))) {
      throw appError("INVALID", "Choose a recognized theme label to correct this grouping.");
    }
    const note = args.note?.trim().slice(0, 240);
    if (args.status === "corrected" && (!note || note.length < 3)) throw appError("INVALID", "Add a short note explaining the correction.");
    const row = {
      orgId: org._id,
      themeKey: args.themeKey,
      status: args.status,
      ...(args.status === "corrected" ? { correctedLabel, note } : { note }),
      updatedBy: user._id,
      updatedAt: Date.now(),
    };
    if (existing) await ctx.db.replace(existing._id, row);
    else await ctx.db.insert("voiceThemeFeedback", row);
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "reviews.voice_theme_feedback", subjectType: "business", summary: `${args.status === "dismissed" ? "Dismissed" : "Corrected"} tentative customer theme: ${VOICE_THEME_LABELS[args.themeKey as VoiceThemeKey]}.` });
    return { saved: true };
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

const INVITE_TEMPLATE_VERSION = "neutral-review-invitation-v1";
const INVITE_SUBJECT = (businessName: string) => `A quick review for ${businessName}`;
const inviteContentHash = (businessName: string, destination: string, reviewPageUrl: string) => sha256Hex(JSON.stringify({ templateVersion: INVITE_TEMPLATE_VERSION, businessName, destination, reviewPageUrl, subject: INVITE_SUBJECT(businessName), bodyTemplate: "Thank you for choosing {business}. If you have a moment, you can share an honest review here: {tenant_review_page}?t={recipient_token}", action: "send_review_invitation" }));
const inviteScopeHash = (recipients: { name: string; email: string; dealId?: Id<"deals"> }[]) => sha256Hex(JSON.stringify(recipients.map((r) => [r.email, r.name, r.dealId ?? null]).sort((a, b) => String(a[0]).localeCompare(String(b[0])))));
const INVITE_BODY = (businessName: string, firstName: string, link: string, unsubscribe: string) =>
  `Hi ${firstName},\n\nThank you for choosing ${businessName}. If you have a moment, you can share an honest review here:\n\n${link}\n\nThank you,\n${businessName}\n\nDon't want these emails? Unsubscribe: ${unsubscribe}`;

/** Stage the exact customer list and destination for owner review. This does not send. */
export const prepareBatch = mutation({
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
    const recipients: { name: string; email: string; dealId?: Id<"deals"> }[] = [];
    const seen = new Set<string>();
    let recentlyAsked = 0;
    const now = Date.now();
    for (const p of people.slice(0, room)) {
      const email = p.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || seen.has(email)) continue;
      seen.add(email);
      if (p.dealId) {
        const deal = await ctx.db.get(p.dealId);
        if (!deal || deal.orgId !== org._id || deal.stage !== "won" || deal.email?.trim().toLowerCase() !== email) continue;
      }
      const emailHash = await sha256Hex(email);
      if (await ctx.db.query("suppressions").withIndex("by_org_email", (q) => q.eq("orgId", org._id).eq("emailHash", emailHash)).first()) continue;
      // Ask each customer at most once every 90 days.
      if (await ctx.db.query("reviewRequests").withIndex("by_org_email", (q) => q.eq("orgId", org._id).eq("email", email).gte("createdAt", now - ASK_AGAIN_AFTER)).first()) {
        recentlyAsked++;
        continue;
      }
      recipients.push({ name: p.name.trim().slice(0, 80) || email, email, ...(p.dealId ? { dealId: p.dealId } : {}) });
    }
    if (!recipients.length) throw appError("INVALID", recentlyAsked ? "Everyone here was asked in the last 90 days." : "No eligible email addresses to review.");
    const destination = publicReviewUrl(business.reviewUrl)!;
    const scopeHash = await inviteScopeHash(recipients);
    const reviewPageUrl = `${SITE()}/review/${org.slug}`;
    const contentHash = await inviteContentHash(business.name, destination, reviewPageUrl);
    const batchId = await ctx.db.insert("reviewInvitationBatches", { orgId: org._id, createdBy: user._id, connectionId: mailbox._id, destination, templateVersion: INVITE_TEMPLATE_VERSION, contentHash, scopeHash, recipients, status: "pending", createdAt: now, expiresAt: now + 30 * 60_000 });
    return { batchId, count: recipients.length, skipped: people.length - recipients.length, recentlyAsked, destination, templateVersion: INVITE_TEMPLATE_VERSION, contentHash, scopeHash, businessName: business.name, recipients, preview: INVITE_BODY(business.name, recipients[0].name.split(/\s+/)[0], `${reviewPageUrl}?t={recipient_token}`, "your personal unsubscribe link") };
  },
});

/** Explicitly approve and queue the exact staged invitation batch. */
export const approveBatch = mutation({
  args: { slug: v.string(), batchId: v.id("reviewInvitationBatches"), contentHash: v.string(), scopeHash: v.string(), confirmEligibleRecipients: v.boolean() },
  handler: async (ctx, args) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: args.slug }, "edit");
    if (!args.confirmEligibleRecipients) throw appError("FORBIDDEN", "Confirm that every selected recipient is an eligible customer before sending.");
    const batch = await ctx.db.get(args.batchId);
    if (!batch || batch.orgId !== org._id) throw appError("NOT_FOUND", "Review invitation approval not found.");
    if (batch.status !== "pending" || batch.expiresAt <= Date.now()) throw appError("INVALID", "This preview expired. Prepare the recipients again.");
    if (batch.contentHash !== args.contentHash || batch.scopeHash !== args.scopeHash) throw appError("INVALID", "The invitation content or recipient scope changed. Review a fresh preview.");
    if (org.kind === "demo") throw appError("INVALID", "Demo workspaces can't send email.");
    await requirePaid(ctx, org, "sending");
    const business = await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", org._id)).first();
    const mailbox = await ctx.db.get(batch.connectionId);
    if (!business || publicReviewUrl(business.reviewUrl) !== batch.destination || mailbox?.orgId !== org._id || mailbox.provider !== "email_mailbox" || mailbox.status !== "connected") throw appError("INVALID", "The review destination or mailbox changed. Prepare a fresh preview.");
    if (batch.templateVersion !== INVITE_TEMPLATE_VERSION || batch.contentHash !== await inviteContentHash(business.name, batch.destination, `${SITE()}/review/${org.slug}`) || batch.scopeHash !== await inviteScopeHash(batch.recipients)) throw appError("INVALID", "The invitation content or recipient scope changed. Review a fresh preview.");
    const today = await ctx.db.query("reviewRequests").withIndex("by_org_created", (q) => q.eq("orgId", org._id).gte("createdAt", Date.now() - 86_400_000)).take(DAILY_LIMIT + 1);
    if (today.length + batch.recipients.length > DAILY_LIMIT) throw appError("RATE_LIMITED", "The daily review invitation limit changed. Prepare a smaller batch.");
    const ids: Id<"reviewRequests">[] = [];
    for (const person of batch.recipients) {
      const emailHash = await sha256Hex(person.email);
      if (await ctx.db.query("suppressions").withIndex("by_org_email", (q) => q.eq("orgId", org._id).eq("emailHash", emailHash)).first()) continue;
      if (await ctx.db.query("reviewRequests").withIndex("by_org_email", (q) => q.eq("orgId", org._id).eq("email", person.email).gte("createdAt", Date.now() - ASK_AGAIN_AFTER)).first()) continue;
      ids.push(await ctx.db.insert("reviewRequests", { orgId: org._id, dealId: person.dealId, name: person.name, email: person.email, token: token(), status: "queued", approvalBatchId: batch._id, createdAt: Date.now() }));
    }
    if (!ids.length) throw appError("INVALID", "No recipients remain eligible. Prepare a fresh preview.");
    await ctx.db.patch(batch._id, { status: "queued", approvedBy: user._id, approvedAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.mailbox.sendReviewRequests, { ids });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "reviews.requested", subjectType: "review_invitation_batch", subjectId: batch._id, summary: `Approved and queued ${ids.length} neutral review invitation${ids.length === 1 ? "" : "s"}; destination and recipient scope were frozen.` });
    return { queued: ids.length, skipped: batch.recipients.length - ids.length };
  },
});

export const prepareRequest = internalQuery({
  args: { id: v.id("reviewRequests") },
  handler: async (ctx, { id }) => {
    const r = await ctx.db.get(id);
    if (!r || r.status !== "queued") return null;
    const batch = r.approvalBatchId ? await ctx.db.get(r.approvalBatchId) : null;
    if (!batch || batch.orgId !== r.orgId || batch.status !== "queued") return null;
    const org = await ctx.db.get(r.orgId);
    const business = await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", r.orgId)).first();
    const mailbox = await ctx.db.get(batch.connectionId);
    if (!org || !business || mailbox?.orgId !== r.orgId || mailbox.provider !== "email_mailbox" || mailbox.status !== "connected" || !batch.approvedBy || !batch.approvedAt || batch.templateVersion !== INVITE_TEMPLATE_VERSION) return null;
    const reviewPageUrl = `${SITE()}/review/${org.slug}`;
    const expectedContentHash = await inviteContentHash(business.name, batch.destination, reviewPageUrl);
    const expectedScopeHash = await inviteScopeHash(batch.recipients);
    const isApprovedRecipient = batch.recipients.some((person) => person.email === r.email && person.name === r.name && person.dealId === r.dealId);
    if (!isApprovedRecipient || expectedContentHash !== batch.contentHash || expectedScopeHash !== batch.scopeHash) return null;
    const hashOf = await sha256Hex(r.email);
    // Unsubscribed since it was queued: don't send.
    if (await ctx.db.query("suppressions").withIndex("by_org_email", (q) => q.eq("orgId", r.orgId).eq("emailHash", hashOf)).first()) return null;
    if (publicReviewUrl(business.reviewUrl) !== batch.destination) return null;
    const link = `${SITE()}/review/${org.slug}?t=${r.token}`;
    const first = r.name.split(/\s+/)[0];
    const unsub = await unsubscribeToken(r._id, serverSecret());
    return {
      connectionId: mailbox._id,
      to: r.email,
      subject: INVITE_SUBJECT(business.name),
      text: INVITE_BODY(business.name, first, link, `${SITE()}/u/${unsub}`),
      unsubscribeUrl: process.env.CONVEX_SITE_URL ? `${process.env.CONVEX_SITE_URL}/unsubscribe?token=${encodeURIComponent(unsub)}` : `${SITE()}/u/${unsub}`,
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
    await notifyOwners(ctx, org._id, `Private feedback${rating ? ` (${rating}★)` : ""}: “${text.slice(0, 120)}”`, "inbox");
    await ctx.db.insert("communityMessages", { orgId: org._id, channel: "feedback", kind: "review", externalId: `feedback:${now}:${Math.random().toString(36).slice(2, 8)}`, authorName: req?.name ?? (a.name?.trim().slice(0, 80) || "A customer"), fromEmail: req?.email, text: `${rating ? `${"★".repeat(rating)}${"☆".repeat(5 - rating)}\n\n` : ""}${text}`, receivedAt: now, status: "new", createdAt: now, updatedAt: now });
  },
});

/** Paste a public review (Google, Facebook…) into the Inbox so Climb AI can draft a reply. */
export const addReview = mutation({
  args: { slug: v.string(), author: v.string(), text: v.string(), rating: v.optional(v.number()), source: v.string(), sourceUrl: v.optional(v.string()) },
  handler: async (ctx, a) => {
    const { org } = await requireOrgAccess(ctx, { slug: a.slug }, "edit");
    const text = a.text.trim().slice(0, 4000);
    const now = Date.now();
    if (a.rating !== undefined && (!Number.isInteger(a.rating) || a.rating < 1 || a.rating > 5)) throw appError("INVALID", "Rating must be a whole number from 1 to 5.");
    const rating = a.rating ?? null;
    if (!text && !rating) throw appError("INVALID", "Paste review text or enter its 1–5 star rating.");
    const reviewSourceUrl = publicReviewUrl(a.sourceUrl);
    const channel = a.source.slice(0, 30) || "google";
    const externalId = reviewSourceUrl ? `review-url:${await sha256Hex(`${channel.toLowerCase()}\n${reviewSourceUrl}`)}` : `review:${token()}`;
    if (reviewSourceUrl) {
      const existing = await ctx.db.query("communityMessages").withIndex("by_org_external", (q) => q.eq("orgId", org._id).eq("externalId", externalId)).first();
      if (existing) return { id: existing._id, duplicate: true };
    }
    const safetyCategories = reviewSafetySignals(text);
    const lowRatingWithoutText = Boolean(rating && rating <= 3 && !text);
    const ownerReviewReason = safetyCategories.length ? "sensitive_topic" as const : lowRatingWithoutText ? "low_rating_without_text" as const : null;
    const id = await ctx.db.insert("communityMessages", { orgId: org._id, channel, kind: "review", externalId, authorName: a.author.trim().slice(0, 80) || "Reviewer", text, ...(rating ? { reviewRating: rating } : {}), ...(reviewSourceUrl ? { reviewSourceUrl } : {}), receivedAt: now, status: ownerReviewReason ? "escalated" : "new", ...(ownerReviewReason ? { reviewSafety: { categories: safetyCategories, reason: ownerReviewReason, detectedAt: now } } : {}), createdAt: now, updatedAt: now });
    return { id, duplicate: false };
  },
});
