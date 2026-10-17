import { v } from "convex/values";
import { sha256Hex } from "../shared/policy";
import { label } from "../shared/autopilot";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { audit } from "./lib/audit";
import { applyTrustEvent, onOwnerDecision, settingsFor } from "./lib/autopilot";
import { invalidateApprovals, recordArtifactDecision } from "./lib/approvals";
import { approvalsEmail, headsUpEmail } from "./lib/emailTemplates";

/**
 * One-tap email actions. Links carry a random single-use token (only its
 * hash is stored). Opening a link never changes anything (mail scanners
 * pre-fetch links); the owner confirms on the page, which calls `consume`.
 */

const SITE = () => process.env.SITE_URL ?? "https://climbos.app";
const HEADS_UP_MS = 2 * 3_600_000;

function newToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const storeToken = internalMutation({
  args: { tokenHash: v.string(), orgId: v.id("organizations"), userId: v.id("users"), kind: v.union(v.literal("stop_post"), v.literal("approve_post")), subjectId: v.string(), expiresAt: v.number() },
  handler: async (ctx, args) => {
    await ctx.db.insert("actionTokens", { ...args, createdAt: Date.now() });
  },
});

/** Owners and admins who should hear about posts (with their user ids, for token binding). */
export const approvers = internalQuery({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    const members = await ctx.db
      .query("memberships")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .take(50);
    const out: { userId: Id<"users">; email: string }[] = [];
    for (const m of members) {
      if (m.status !== "active" || !m.userId || !["owner", "admin", "reviewer"].includes(m.role)) continue;
      const user = await ctx.db.get(m.userId);
      if (!user?.email || user.isAnonymous) continue;
      const prefs = await ctx.db
        .query("userPreferences")
        .withIndex("by_user", (q) => q.eq("userId", m.userId!))
        .unique();
      if (prefs?.digest === "off") continue;
      out.push({ userId: m.userId, email: user.email });
    }
    return out;
  },
});

/* ---------------- Safety window ---------------- */

export const headsUpContext = internalQuery({
  args: { artifactId: v.id("artifacts"), expectedScheduledFor: v.number() },
  handler: async (ctx, { artifactId, expectedScheduledFor }) => {
    const a = await ctx.db.get(artifactId);
    if (!a || a.status !== "scheduled" || a.scheduledFor !== expectedScheduledFor) return null;
    const org = await ctx.db.get(a.orgId);
    const ver = a.currentVersionId ? await ctx.db.get(a.currentVersionId) : null;
    if (!org || !ver) return null;
    return { org, artifact: a, preview: ver.body.slice(0, 280) };
  },
});

/** Two hours before an automatic post: tell the approvers, with a one-tap Stop. */
export const headsUp = internalAction({
  args: { artifactId: v.id("artifacts"), expectedScheduledFor: v.number() },
  handler: async (ctx, args) => {
    const c = await ctx.runQuery(internal.emailActions.headsUpContext, args);
    if (!c) return; // edited, unscheduled or already handled
    const recipients = await ctx.runQuery(internal.emailActions.approvers, { orgId: c.org._id });
    const when = new Date(args.expectedScheduledFor).toLocaleString("en-US", { timeZone: c.org.timezone, weekday: "short", hour: "numeric", minute: "2-digit" });
    for (const r of recipients) {
      const token = newToken();
      await ctx.runMutation(internal.emailActions.storeToken, { tokenHash: await sha256Hex(token), orgId: c.org._id, userId: r.userId, kind: "stop_post", subjectId: c.artifact._id, expiresAt: args.expectedScheduledFor });
      const mail = headsUpEmail({
        orgName: c.org.name,
        channel: label(c.artifact.channel),
        when,
        title: c.artifact.title,
        preview: c.preview,
        stopUrl: `${SITE()}/a/${token}`,
        openUrl: `${SITE()}/app/${c.org.slug}/content/${c.artifact._id}`,
      });
      await ctx.runAction(internal.notifications.sendPlatformEmail, { orgId: c.org._id, to: r.email, template: "autopilot_heads_up", ...mail });
    }
  },
});

/** Schedule the heads-up for an automatic post (call right after scheduling it). */
export async function scheduleHeadsUp(ctx: { scheduler: { runAt: (t: number, f: typeof internal.emailActions.headsUp, a: { artifactId: Id<"artifacts">; expectedScheduledFor: number }) => Promise<unknown> } }, artifactId: Id<"artifacts">, when: number) {
  await ctx.scheduler.runAt(Math.max(Date.now() + 5_000, when - HEADS_UP_MS), internal.emailActions.headsUp, { artifactId, expectedScheduledFor: when });
}

/* ---------------- Daily approvals email ---------------- */

export const approvalCandidates = internalQuery({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 2 * 3_600_000;
    const orgs = await ctx.db.query("organizations").take(1000);
    const out: { orgId: Id<"organizations">; slug: string; name: string; items: { id: Id<"artifacts">; title: string; channel: string; preview: string }[] }[] = [];
    for (const org of orgs) {
      if (org.kind === "demo") continue;
      const waiting = await ctx.db
        .query("artifacts")
        .withIndex("by_org_status", (q) => q.eq("orgId", org._id).eq("status", "in_review"))
        .take(20);
      const ripe = waiting.filter((a) => a.updatedAt < cutoff).slice(0, 5);
      if (!ripe.length) continue;
      const items = [];
      for (const a of ripe) {
        const ver = a.currentVersionId ? await ctx.db.get(a.currentVersionId) : null;
        items.push({ id: a._id, title: a.title, channel: a.channel, preview: (ver?.body ?? "").slice(0, 180) });
      }
      out.push({ orgId: org._id, slug: org.slug, name: org.name, items });
    }
    return out;
  },
});

export const sendApprovalEmails = internalAction({
  args: {},
  handler: async (ctx) => {
    for (const c of await ctx.runQuery(internal.emailActions.approvalCandidates, {})) {
      const recipients = await ctx.runQuery(internal.emailActions.approvers, { orgId: c.orgId });
      for (const r of recipients) {
        const items = [];
        for (const it of c.items) {
          const token = newToken();
          await ctx.runMutation(internal.emailActions.storeToken, { tokenHash: await sha256Hex(token), orgId: c.orgId, userId: r.userId, kind: "approve_post", subjectId: it.id, expiresAt: Date.now() + 72 * 3_600_000 });
          items.push({ title: it.title, channel: label(it.channel), preview: it.preview, approveUrl: `${SITE()}/a/${token}`, openUrl: `${SITE()}/app/${c.slug}/content/${it.id}` });
        }
        const mail = approvalsEmail({ orgName: c.name, items, allUrl: `${SITE()}/app/${c.slug}/content?status=in_review` });
        await ctx.runAction(internal.notifications.sendPlatformEmail, { orgId: c.orgId, to: r.email, template: "approvals_waiting", ...mail });
      }
    }
  },
});

/* ---------------- The link page ---------------- */

async function lookup(ctx: { db: { query: (t: "actionTokens") => { withIndex: (i: "by_hash", f: (q: { eq: (f: "tokenHash", v: string) => unknown }) => unknown) => { first: () => Promise<Doc<"actionTokens"> | null> } } } }, token: string) {
  if (!/^[0-9a-f]{48}$/.test(token)) return null;
  const hash = await sha256Hex(token);
  return ctx.db
    .query("actionTokens")
    .withIndex("by_hash", (q) => q.eq("tokenHash", hash))
    .first();
}

/** What a link would do, without doing it (safe for link scanners). */
export const preview = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const t = await lookup(ctx as never, token);
    if (!t) return { state: "invalid" as const };
    const a = await ctx.db.get(t.subjectId as Id<"artifacts">);
    const org = await ctx.db.get(t.orgId);
    if (!a || !org) return { state: "invalid" as const };
    const state = t.usedAt ? "used" : t.expiresAt < Date.now() ? "expired" : t.kind === "stop_post" && a.status !== "scheduled" ? "moot" : t.kind === "approve_post" && a.status !== "in_review" ? "moot" : "ready";
    return {
      state,
      kind: t.kind,
      orgName: org.name,
      slug: org.slug,
      artifactId: a._id,
      title: a.title,
      channel: label(a.channel),
      when: a.scheduledFor ? new Date(a.scheduledFor).toLocaleString("en-US", { timeZone: org.timezone, weekday: "long", hour: "numeric", minute: "2-digit" }) : null,
      status: a.status,
    };
  },
});

export const consume = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const t = await lookup(ctx as never, token);
    if (!t || t.usedAt || t.expiresAt < Date.now()) return { ok: false as const, message: "This link has expired or was already used. Open ClimbOS to make changes." };
    const a = await ctx.db.get(t.subjectId as Id<"artifacts">);
    const org = await ctx.db.get(t.orgId);
    if (!a || !org) return { ok: false as const, message: "That post no longer exists." };
    await ctx.db.patch(t._id, { usedAt: Date.now() });

    if (t.kind === "stop_post") {
      if (a.status !== "scheduled") return { ok: false as const, message: a.status === "published" ? "It has already been posted." : "It isn't scheduled any more." };
      await invalidateApprovals(ctx, a._id, "Stopped from email");
      await ctx.db.patch(a._id, { status: "in_review", scheduledFor: undefined, updatedAt: Date.now() });
      const slot = await ctx.db
        .query("calendarSlots")
        .withIndex("by_artifact", (q) => q.eq("artifactId", a._id))
        .first();
      if (slot) {
        await ctx.db.patch(slot._id, { status: "needs_approval", routing: { decision: "ask", reasons: ["You stopped it from the email."] }, updatedAt: Date.now() });
        const settings = await settingsFor(ctx, org._id);
        if (settings) await applyTrustEvent(ctx, settings, slot.channel, "rejected");
      }
      await audit(ctx, { orgId: org._id, actorType: "user", actorId: t.userId, action: "autopilot.stopped", subjectType: "artifact", subjectId: a._id, summary: `Stopped "${a.title}" from the heads-up email. It's back in review.` });
      return { ok: true as const, message: "Stopped. It's back in your review list and won't post." };
    }

    // approve_post
    if (a.status !== "in_review") return { ok: false as const, message: "This one has already been handled." };
    const ver = a.currentVersionId ? await ctx.db.get(a.currentVersionId) : null;
    if (!ver) return { ok: false as const, message: "Nothing to approve yet." };
    await recordArtifactDecision(ctx, { org, artifact: a, version: ver, decision: "approve", decidedBy: t.userId, note: "Approved from email" });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: t.userId, action: "content.approved", subjectType: "artifact", subjectId: a._id, summary: `Approved "${a.title}" from email (v${ver.version}).` });
    await onOwnerDecision(ctx, { org, artifactId: a._id, decision: "approve", edited: ver.version > 1 && Boolean(ver.editedByUser), userId: t.userId });
    const fresh = await ctx.db.get(a._id);
    return { ok: true as const, message: fresh?.status === "scheduled" ? "Approved. It goes out at its planned time." : "Approved. You'll find it ready to post or schedule in ClimbOS." };
  },
});
