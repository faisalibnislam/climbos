import { v } from "convex/values";
import { syncDealFromProspect } from "./crm";
import { emitEvent } from "./webhooks";
import { recordAb, runningTest } from "./abtests";
import { variantFor } from "../shared/abtest";
import { sha256Hex } from "../shared/policy";
import { composeEmail, dailyCap, followUpAt, inSendWindow, localDayKey, nextSendWindow, SPACING_MINUTES, unsubscribeToken, verifyUnsubscribeToken } from "../shared/outbound/sending";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query, type MutationCtx } from "./_generated/server";
import { requirePaid } from "./lib/access";
import { audit } from "./lib/audit";
import { notifyOwners } from "./lib/notify";
import { appError, assertSameOrg, requireOrgAccess } from "./lib/tenancy";

/**
 * Sending outbound emails from the owner's own mailbox (owner decision: the
 * owner starts it; ClimbOS never sends without that). Warm-up caps, business
 * hours and spacing per mailbox; replies, bounces and opt-outs stop a
 * prospect's sequence. Nothing here charges credits (the owner's mailbox sends).
 */

const SECRET = () => process.env.CLIMBOS_SERVER_SECRET ?? "dev-secret";
const SITE = () => process.env.SITE_URL ?? "https://climbos.app";

async function suppressed(ctx: MutationCtx, orgId: Id<"organizations">, email: string): Promise<boolean> {
  const hash = await sha256Hex(email.trim().toLowerCase());
  return Boolean(await ctx.db.query("suppressions").withIndex("by_org_email", (q) => q.eq("orgId", orgId).eq("emailHash", hash)).first());
}

async function suppress(ctx: MutationCtx, orgId: Id<"organizations">, email: string, reason: "unsubscribe" | "bounce", source: string) {
  if (await suppressed(ctx, orgId, email)) return;
  await ctx.db.insert("suppressions", { orgId, emailHash: await sha256Hex(email.trim().toLowerCase()), reason, source, createdAt: Date.now() });
}

async function cancelQueued(ctx: MutationCtx, prospectId: Id<"prospects">) {
  for (const s of await ctx.db.query("outboundSends").withIndex("by_prospect", (q) => q.eq("prospectId", prospectId)).take(20)) {
    if (s.status === "queued") await ctx.db.patch(s._id, { status: "canceled" });
  }
}

/* ---------------- owner controls ---------------- */

export const status = query({
  args: { slug: v.string(), campaignId: v.id("outboundCampaigns") },
  handler: async (ctx, { slug, campaignId }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const c = assertSameOrg(await ctx.db.get(campaignId), org._id, "campaign");
    const mailbox = await ctx.db.query("connections").withIndex("by_org_provider", (q) => q.eq("orgId", org._id).eq("provider", "email_mailbox")).first();
    const sends = await ctx.db.query("outboundSends").withIndex("by_campaign", (q) => q.eq("campaignId", campaignId)).order("desc").take(300);
    const count = (st: Doc<"outboundSends">["status"]) => sends.filter((s) => s.status === st).length;
    const today = localDayKey(Date.now(), org.timezone);
    return {
      mailbox: mailbox && mailbox.status === "connected" ? { label: mailbox.accountLabel ?? "Your mailbox" } : null,
      sending: c.sending ?? null,
      capToday: dailyCap(c.sending?.firstSentAt ?? null, Date.now(), c.sending?.dailyCapOverride),
      sentToday: sends.filter((s) => s.status === "sent" && s.sentAt && localDayKey(s.sentAt, org.timezone) === today).length,
      counts: { queued: count("queued") + count("sending"), sent: count("sent"), failed: count("failed"), bounced: count("bounced"), canceled: count("canceled") },
      next: sends.filter((s) => s.status === "queued").sort((a, b) => a.scheduledFor - b.scheduledFor)[0]?.scheduledFor ?? null,
      recent: sends.filter((s) => s.status !== "queued").slice(0, 20).map((s) => ({ id: s._id, to: s.to, step: s.step, status: s.status, at: s.sentAt ?? s.scheduledFor, error: s.error ?? null })),
    };
  },
});

/** What the owner approves when sending starts: every email in the sequence and the sender details. */
export async function sendingHash(c: Pick<Doc<"outboundCampaigns">, "sequence">, sender: { senderName: string; company: string; address: string; bookingUrl?: string }): Promise<string> {
  return sha256Hex(JSON.stringify({ sequence: c.sequence.map((s) => ({ day: s.day, subject: s.subject, body: s.body })), sender: [sender.senderName, sender.company, sender.address, sender.bookingUrl ?? ""] }));
}

/** Start sending to the approved prospects that publish an email. The owner confirms the sender details first. */
export const start = mutation({
  args: { slug: v.string(), campaignId: v.id("outboundCampaigns"), senderName: v.string(), company: v.string(), address: v.string(), bookingUrl: v.optional(v.string()) },
  handler: async (ctx, a) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: a.slug }, "approve");
    await requirePaid(ctx, org, "sending");
    const c = assertSameOrg(await ctx.db.get(a.campaignId), org._id, "campaign");
    if (!c.sequence.length) throw appError("INVALID", "This campaign has no emails yet.");
    const mailbox = await ctx.db.query("connections").withIndex("by_org_provider", (q) => q.eq("orgId", org._id).eq("provider", "email_mailbox")).first();
    if (mailbox?.status !== "connected") throw appError("INVALID", "Connect your mailbox first (Connections → Your mailbox).");
    if (a.address.trim().length < 8) throw appError("INVALID", "Add your business's postal address. The law requires it in cold emails.");
    if (!a.senderName.trim() || !a.company.trim()) throw appError("INVALID", "Add your name and company.");
    const prospects = (await ctx.db.query("prospects").withIndex("by_campaign", (q) => q.eq("campaignId", c._id)).take(200)).filter((p) => p.stage === "approved" && p.publicEmail);
    let queued = 0;
    let at = nextSendWindow(Date.now() + 60_000, org.timezone);
    for (const p of prospects) {
      if (await suppressed(ctx, org._id, p.publicEmail!)) continue;
      const existing = await ctx.db.query("outboundSends").withIndex("by_prospect", (q) => q.eq("prospectId", p._id)).first();
      if (existing) continue;
      await ctx.db.insert("outboundSends", { orgId: org._id, campaignId: c._id, prospectId: p._id, step: 0, to: p.publicEmail!, scheduledFor: at, status: "queued", attempts: 0, createdAt: Date.now() });
      at = nextSendWindow(at + SPACING_MINUTES * 60_000, org.timezone);
      queued++;
    }
    if (!queued) throw appError("INVALID", "No approved prospects with a published email to send to.");
    await ctx.db.patch(c._id, {
      sending: await (async () => {
        const sender = { senderName: a.senderName.trim().slice(0, 80), company: a.company.trim().slice(0, 80), address: a.address.trim().slice(0, 200), bookingUrl: a.bookingUrl?.trim().slice(0, 300) || undefined };
        return { status: "on" as const, startedAt: c.sending?.startedAt ?? Date.now(), startedBy: user._id, firstSentAt: c.sending?.firstSentAt, ...sender, contentHash: await sendingHash(c, sender) };
      })(),
      updatedAt: Date.now(),
    });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "outbound.sending_started", subjectType: "campaign", subjectId: c._id, summary: `Started sending to ${queued} prospect${queued === 1 ? "" : "s"} from your mailbox (warm-up limits apply).` });
    return { queued };
  },
});

export const setPaused = mutation({
  args: { slug: v.string(), campaignId: v.id("outboundCampaigns"), paused: v.boolean() },
  handler: async (ctx, { slug, campaignId, paused }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "approve");
    const c = assertSameOrg(await ctx.db.get(campaignId), org._id, "campaign");
    if (!c.sending) return;
    // Resuming approves the emails as they are now.
    const resumed = paused ? {} : { contentHash: await sendingHash(c, c.sending), pausedReason: undefined };
    await ctx.db.patch(c._id, { sending: { ...c.sending, status: paused ? "paused" : "on", ...resumed }, updatedAt: Date.now() });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: paused ? "outbound.sending_paused" : "outbound.sending_resumed", subjectType: "campaign", subjectId: c._id, summary: paused ? "Paused sending." : "Resumed sending." });
  },
});

/* ---------------- dispatch (cron) ---------------- */

/** Every 5 minutes: hand due emails to the mailbox sender within each campaign's daily cap and the send window. */
export const dispatch = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    let handed = 0;
    for (const c of await ctx.db.query("outboundCampaigns").withIndex("by_sending", (q) => q.eq("sending.status", "on")).take(200)) {
      const org = await ctx.db.get(c.orgId);
      if (!org || org.emergencyStop?.active || org.suspendedAt) continue;
      if (!inSendWindow(now, org.timezone)) continue;
      // Approval is bound to the exact emails: an edit after approval pauses sending until the owner resumes.
      const hash = await sendingHash(c, c.sending!);
      if (!c.sending!.contentHash) await ctx.db.patch(c._id, { sending: { ...c.sending!, contentHash: hash } });
      else if (c.sending!.contentHash !== hash) {
        await ctx.db.patch(c._id, { sending: { ...c.sending!, status: "paused", pausedReason: "content_changed" }, updatedAt: now });
        await audit(ctx, { orgId: org._id, actorType: "system", action: "outbound.sending_paused", subjectType: "campaign", subjectId: c._id, summary: "Paused: the emails changed after sending was approved. Review them and resume." });
        await notifyOwners(ctx, org._id, `Outbound “${c.title}” paused: the emails changed after you approved them. Review and resume.`, "outbound");
        continue;
      }
      const sends = await ctx.db.query("outboundSends").withIndex("by_campaign", (q) => q.eq("campaignId", c._id)).order("desc").take(500);
      const today = localDayKey(now, org.timezone);
      const sentToday = sends.filter((s) => (s.status === "sent" || s.status === "sending") && localDayKey(s.sentAt ?? s.scheduledFor, org.timezone) === today).length;
      let room = dailyCap(c.sending?.firstSentAt ?? null, now, c.sending?.dailyCapOverride) - sentToday;
      // Spacing: at most one email per few minutes per campaign.
      const lastSent = Math.max(0, ...sends.filter((s) => s.sentAt).map((s) => s.sentAt!));
      if (now - lastSent < (SPACING_MINUTES - 2) * 60_000) continue;
      const due = sends.filter((s) => s.status === "queued" && s.scheduledFor <= now).sort((a, b) => a.scheduledFor - b.scheduledFor);
      for (const s of due.slice(0, 1)) {
        if (room <= 0) break;
        await ctx.db.patch(s._id, { status: "sending", attempts: s.attempts + 1 });
        await ctx.scheduler.runAfter(Math.floor(Math.random() * 90_000), internal.mailbox.sendOne, { sendId: s._id });
        room--;
        handed++;
      }
      if (!sends.some((s) => s.status === "queued" || s.status === "sending")) await ctx.db.patch(c._id, { sending: { ...c.sending!, status: "done" } });
    }
    return handed;
  },
});

/** Everything the mailbox sender needs for one email (or null if it shouldn't go). */
export const prepareSend = internalQuery({
  args: { sendId: v.id("outboundSends") },
  handler: async (ctx, { sendId }) => {
    const s = await ctx.db.get(sendId);
    if (!s || s.status !== "sending") return null;
    const c = await ctx.db.get(s.campaignId);
    const p = await ctx.db.get(s.prospectId);
    const mailbox = await ctx.db.query("connections").withIndex("by_org_provider", (q) => q.eq("orgId", s.orgId).eq("provider", "email_mailbox")).first();
    if (!c?.sending || c.sending.status !== "on" || !p || !mailbox || mailbox.status !== "connected") return null;
    if (p.stage === "replied" || p.stage === "skipped" || p.stage === "lost" || p.stage === "won" || p.stage === "booked") return null;
    const step = c.sequence[s.step];
    if (!step) return null;
    // Never send content that differs from what was approved.
    if (c.sending.contentHash && c.sending.contentHash !== (await sendingHash(c, c.sending))) return null;
    const previous = s.step > 0 ? await ctx.db.query("outboundSends").withIndex("by_prospect", (q) => q.eq("prospectId", p._id).eq("step", 0)).first() : null;
    const token = await unsubscribeToken(p._id, SECRET());
    const unsub = `${SITE()}/u/${token}`;
    const oneClick = process.env.CONVEX_SITE_URL ? `${process.env.CONVEX_SITE_URL}/unsubscribe?token=${encodeURIComponent(token)}` : unsub;
    // A/B subject test: half the prospects get subject B on the first email.
    const test = s.step === 0 ? await ctx.db.query("abTests").withIndex("by_target", (q) => q.eq("targetId", c._id).eq("status", "running")).first() : null;
    const b = test && variantFor(p._id) === "B" ? test.variants.find((x) => x.key === "B")?.value : undefined;
    const email = composeEmail({ step: b ? { ...step, subject: b } : step, stepIndex: s.step, firstLine: p.firstLine, contactName: p.contact, sender: { name: c.sending.senderName, company: c.sending.company, address: c.sending.address, bookingUrl: c.sending.bookingUrl }, unsubscribeUrl: unsub });
    return { to: s.to, subject: email.subject, text: email.text, unsubscribeUrl: oneClick, connectionId: mailbox._id, inReplyTo: previous?.messageId ?? null };
  },
});

/** Record a send result; queue the next step (or stop). */
export const recordSend = internalMutation({
  args: { sendId: v.id("outboundSends"), ok: v.boolean(), messageId: v.optional(v.string()), error: v.optional(v.string()), skip: v.optional(v.boolean()) },
  handler: async (ctx, { sendId, ok, messageId, error, skip }) => {
    const s = await ctx.db.get(sendId);
    if (!s) return;
    const now = Date.now();
    if (skip) {
      await ctx.db.patch(s._id, { status: "canceled" });
      return;
    }
    if (!ok) {
      // One retry after 30 minutes, then give up on this email.
      if (s.attempts < 2) await ctx.db.patch(s._id, { status: "queued", scheduledFor: now + 30 * 60_000, error: error?.slice(0, 300) });
      else await ctx.db.patch(s._id, { status: "failed", error: error?.slice(0, 300) });
      return;
    }
    await ctx.db.patch(s._id, { status: "sent", sentAt: now, messageId });
    if (s.step === 0) {
      const test = await runningTest(ctx, s.campaignId);
      if (test) await recordAb(ctx, test, variantFor(s.prospectId), "trials");
    }
    const c = await ctx.db.get(s.campaignId);
    const p = await ctx.db.get(s.prospectId);
    const org = await ctx.db.get(s.orgId);
    if (c?.sending && !c.sending.firstSentAt) await ctx.db.patch(c._id, { sending: { ...c.sending, firstSentAt: now } });
    if (p && p.stage === "approved") await ctx.db.patch(p._id, { stage: "contacted", updatedAt: now });
    const next = c?.sequence[s.step + 1];
    if (c && next && org) {
      const gap = next.day - (c.sequence[s.step]?.day ?? 0);
      await ctx.db.insert("outboundSends", { orgId: s.orgId, campaignId: s.campaignId, prospectId: s.prospectId, step: s.step + 1, to: s.to, scheduledFor: followUpAt(now, gap, org.timezone), status: "queued", attempts: 0, createdAt: now });
    }
  },
});

/** Replies, bounces and "no" answers found in the mailbox. */
export const applyInbox = internalMutation({
  args: { campaignId: v.id("outboundCampaigns"), replies: v.array(v.object({ from: v.string(), optOut: v.boolean(), subject: v.optional(v.string()), messageId: v.optional(v.string()), text: v.optional(v.string()), at: v.optional(v.number()) })), bounced: v.array(v.string()), checkedAt: v.number() },
  handler: async (ctx, { campaignId, replies, bounced, checkedAt }) => {
    const c = await ctx.db.get(campaignId);
    if (!c?.sending) return;
    const prospects = await ctx.db.query("prospects").withIndex("by_campaign", (q) => q.eq("campaignId", campaignId)).take(300);
    const byEmail = new Map(prospects.filter((p) => p.publicEmail).map((p) => [p.publicEmail!.toLowerCase(), p]));
    const now = Date.now();
    for (const r of replies) {
      const p = byEmail.get(r.from.toLowerCase());
      if (!p) continue;
      // Unified inbox: every reply once (deduped by Message-ID), with the text to answer.
      const externalId = `email:${r.messageId ?? `${r.from}:${r.at ?? 0}`}`;
      if (r.text && !(await ctx.db.query("communityMessages").withIndex("by_org_external", (q) => q.eq("orgId", c.orgId).eq("externalId", externalId)).first())) {
        await ctx.db.insert("communityMessages", { orgId: c.orgId, channel: "email", kind: "email", externalId, prospectId: p._id, campaignId, fromEmail: r.from.toLowerCase(), subject: r.subject, messageRef: r.messageId, authorName: p.company, text: r.text, receivedAt: r.at ?? now, status: r.optOut ? "dismissed" : "new", createdAt: now, updatedAt: now });
      }
      if (!r.optOut) await syncDealFromProspect(ctx, p, "talking", "outbound", r.text ? `Replied: “${r.text.slice(0, 160)}”` : "Replied to your email.");
      if (!r.optOut && r.text && !(p.stage === "replied" || p.stage === "booked" || p.stage === "won")) await emitEvent(ctx, c.orgId, "reply.received", { company: p.company, email: r.from, subject: r.subject ?? null, text: r.text.slice(0, 1000) });
      if (!r.optOut && p.stage !== "replied" && p.stage !== "booked" && p.stage !== "won") {
        const test = await runningTest(ctx, campaignId);
        if (test) await recordAb(ctx, test, variantFor(p._id), "wins");
      }
      if (p.stage === "replied" || p.stage === "booked" || p.stage === "won" || p.stage === "lost") continue;
      await ctx.db.patch(p._id, { stage: r.optOut ? "lost" : "replied", updatedAt: now });
      await cancelQueued(ctx, p._id);
      if (r.optOut) await suppress(ctx, c.orgId, r.from, "unsubscribe", "reply");
      else {
        const owner = c.sending.startedBy;
        await ctx.db.insert("notices", { userId: owner, orgId: c.orgId, kind: "system", text: `${p.company} replied to your email. Their sequence is stopped so you can answer personally.`, href: `/app/${(await ctx.db.get(c.orgId))?.slug ?? ""}/outbound`, createdAt: now });
      }
    }
    for (const email of bounced) {
      const p = byEmail.get(email.toLowerCase());
      if (!p) continue;
      await cancelQueued(ctx, p._id);
      for (const s of await ctx.db.query("outboundSends").withIndex("by_prospect", (q) => q.eq("prospectId", p._id)).take(20)) if (s.status === "sent") await ctx.db.patch(s._id, { status: "bounced" });
      await suppress(ctx, c.orgId, email, "bounce", "mailbox");
    }
    await ctx.db.patch(c._id, { sending: { ...c.sending, lastReplyCheckAt: checkedAt } });
  },
});

/** Campaigns whose mailbox should be checked for replies (sending on, or finished in the last 21 days). */
export const replyCheckTargets = internalQuery({
  args: {},
  handler: async (ctx) => {
    const out: { campaignId: Id<"outboundCampaigns">; connectionId: Id<"connections">; since: number; emails: string[] }[] = [];
    for (const st of ["on", "done", "paused"] as const) {
      for (const c of await ctx.db.query("outboundCampaigns").withIndex("by_sending", (q) => q.eq("sending.status", st)).take(200)) {
        if (!c.sending || (st !== "on" && Date.now() - (c.sending.lastReplyCheckAt ?? 0) > 21 * 86_400_000)) continue;
        const mailbox = await ctx.db.query("connections").withIndex("by_org_provider", (q) => q.eq("orgId", c.orgId).eq("provider", "email_mailbox")).first();
        if (mailbox?.status !== "connected") continue;
        const contacted = (await ctx.db.query("prospects").withIndex("by_campaign", (q) => q.eq("campaignId", c._id)).take(300)).filter((p) => p.publicEmail && ["contacted", "approved", "replied", "booked"].includes(p.stage));
        if (contacted.length) out.push({ campaignId: c._id, connectionId: mailbox._id, since: c.sending.startedAt, emails: contacted.map((p) => p.publicEmail!) });
      }
    }
    return out;
  },
});

/* ---------------- unsubscribe (public, from the email footer) ---------------- */

export const unsubscribe = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const id = await verifyUnsubscribeToken(token, SECRET());
    const prospectId = id ? ctx.db.normalizeId("prospects", id) : null;
    const p = prospectId ? await ctx.db.get(prospectId) : null;
    if (!p) throw appError("NOT_FOUND", "This link isn't valid.");
    await cancelQueued(ctx, p._id);
    if (p.publicEmail) await suppress(ctx, p.orgId, p.publicEmail, "unsubscribe", "link");
    if (p.stage !== "won" && p.stage !== "booked") await ctx.db.patch(p._id, { stage: "lost", updatedAt: Date.now() });
    const org = await ctx.db.get(p.orgId);
    return { company: org?.name ?? "the sender" };
  },
});

/** Mailbox connection status for the Connections page. */
export const mailbox = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org, role } = await requireOrgAccess(ctx, { slug }, "view");
    const m = await ctx.db.query("connections").withIndex("by_org_provider", (q) => q.eq("orgId", org._id).eq("provider", "email_mailbox")).first();
    return { connected: m?.status === "connected", label: m?.accountLabel ?? null, canManage: role === "owner" || role === "admin", isDemo: org.kind === "demo" };
  },
});
