import { v } from "convex/values";
import { syncDealFromProspect } from "./crm";
import { emitEvent } from "./webhooks";
import { recordAb, runningTest } from "./abtests";
import { variantFor } from "../shared/abtest";
import { can, sha256Hex } from "../shared/policy";
import { bookingLinkFor, composeEmail, dailyCap, followUpAt, inSendWindow, localDayKey, nextSendWindow, sendMessageId, sendOpKey, sendPayloadHash, SPACING_MINUTES, unsubscribeToken, verifyUnsubscribeToken } from "../shared/outbound/sending";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { fleetStopped, requirePaid } from "./lib/access";
import { audit } from "./lib/audit";
import { serverSecret } from "./lib/crypto";
import { notifyOwners } from "./lib/notify";
import { appError, assertSameOrg, requireOrgAccess } from "./lib/tenancy";
import { refuseInCopilot } from "./lib/approvals";

/**
 * Sending outbound emails from the owner's own mailbox (owner decision: the
 * owner starts it; ClimbOS never sends without that). Warm-up caps, business
 * hours and spacing per mailbox (across every campaign); replies, bounces and
 * opt-outs stop a prospect's sequence. Nothing here charges credits.
 */

const SITE = () => process.env.SITE_URL ?? "https://climbos.app";
const DAY = 86_400_000;
const STOPPED_STAGES: Doc<"prospects">["stage"][] = ["suggested", "replied", "skipped", "lost", "won", "booked"];
/** Handed to a worker: its random start delay (≤90 s) plus room to begin. Unclaimed after this, it never reached the mailbox. */
const HAND_LEASE_MS = 10 * 60_000;
/** Claimed by a worker: longer than an action can run, so a live worker never outlasts it. */
const SEND_LEASE_MS = 12 * 60_000;
const MAX_ATTEMPTS = 3;
/** Clears the worker's hold on a row. */
const RELEASE = { lease: undefined, leaseExpiresAt: undefined, claimedAt: undefined } as const;

async function isSuppressed(ctx: QueryCtx | MutationCtx, orgId: Id<"organizations">, email: string): Promise<boolean> {
  const hash = await sha256Hex(email.trim().toLowerCase());
  return Boolean(await ctx.db.query("suppressions").withIndex("by_org_email", (q) => q.eq("orgId", orgId).eq("emailHash", hash)).first());
}

export async function suppress(ctx: MutationCtx, orgId: Id<"organizations">, email: string, reason: "unsubscribe" | "bounce", source: string) {
  if (await isSuppressed(ctx, orgId, email)) return;
  await ctx.db.insert("suppressions", { orgId, emailHash: await sha256Hex(email.trim().toLowerCase()), reason, source, createdAt: Date.now() });
}

/** Stop every email still waiting for this prospect. */
export async function cancelQueued(ctx: MutationCtx, prospectId: Id<"prospects">) {
  for (const s of await ctx.db.query("outboundSends").withIndex("by_prospect", (q) => q.eq("prospectId", prospectId)).take(20)) {
    if (s.status === "queued") await ctx.db.patch(s._id, { status: "canceled" });
  }
}

async function mailboxOf(ctx: QueryCtx | MutationCtx, orgId: Id<"organizations">) {
  return ctx.db.query("connections").withIndex("by_org_provider", (q) => q.eq("orgId", orgId).eq("provider", "email_mailbox")).first();
}

/**
 * One mailbox per workspace: its warm-up cap, emails sent today and the last
 * send, across every campaign (so two campaigns can't double the daily limit).
 */
export async function mailboxDay(ctx: QueryCtx | MutationCtx, org: Doc<"organizations">, now: number) {
  const campaigns = (await ctx.db.query("outboundCampaigns").withIndex("by_org_created", (q) => q.eq("orgId", org._id)).order("desc").take(100)).filter((c) => c.sending);
  const firsts = campaigns.flatMap((c) => (c.sending?.firstSentAt ? [c.sending.firstSentAt] : []));
  const overrides = campaigns.flatMap((c) => (c.sending?.dailyCapOverride ? [c.sending.dailyCapOverride] : []));
  const cap = dailyCap(firsts.length ? Math.min(...firsts) : null, now, overrides.length ? Math.min(...overrides) : null);
  const recent = await ctx.db.query("outboundSends").withIndex("by_org_sent", (q) => q.eq("orgId", org._id).gte("sentAt", now - 2 * DAY)).take(500);
  // Handed to the mailbox but not back yet: a live lease (or, from before leases, under an hour old).
  const leased = (await ctx.db.query("outboundSends").withIndex("by_status_lease", (q) => q.eq("status", "sending").gt("leaseExpiresAt", now)).take(500)).filter((s) => s.orgId === org._id);
  const legacy = (await ctx.db.query("outboundSends").withIndex("by_status_scheduled", (q) => q.eq("status", "sending").gte("scheduledFor", now - 3_600_000)).take(500)).filter((s) => s.orgId === org._id && s.leaseExpiresAt === undefined);
  const inFlight = leased.length + legacy.length;
  const today = localDayKey(now, org.timezone);
  // An email that may have gone out counts against today's cap.
  const unclear = (await ctx.db.query("outboundSends").withIndex("by_status_lease", (q) => q.eq("status", "uncertain")).take(500)).filter((s) => s.orgId === org._id && s.claimedAt && localDayKey(s.claimedAt, org.timezone) === today).length;
  const sentToday = recent.filter((s) => s.sentAt && (s.status === "sent" || s.status === "bounced") && localDayKey(s.sentAt, org.timezone) === today).length + inFlight + unclear;
  return { cap, sentToday, inFlight, lastSent: Math.max(0, ...recent.map((s) => s.sentAt ?? 0)) };
}

/** Approved prospects with a published email who aren't queued yet (and not unsubscribed). */
async function unqueuedApproved(ctx: QueryCtx | MutationCtx, c: Doc<"outboundCampaigns">) {
  const out: Doc<"prospects">[] = [];
  for (const p of await ctx.db.query("prospects").withIndex("by_campaign", (q) => q.eq("campaignId", c._id)).take(300)) {
    if (p.stage !== "approved" || !p.publicEmail) continue;
    if (await ctx.db.query("outboundSends").withIndex("by_prospect", (q) => q.eq("prospectId", p._id)).first()) continue;
    if (await isSuppressed(ctx, c.orgId, p.publicEmail)) continue;
    out.push(p);
  }
  return out.slice(0, 200);
}

async function queueApproved(ctx: MutationCtx, org: Doc<"organizations">, c: Doc<"outboundCampaigns">): Promise<number> {
  let at = nextSendWindow(Date.now() + 60_000, org.timezone);
  let queued = 0;
  for (const p of await unqueuedApproved(ctx, c)) {
    await ctx.db.insert("outboundSends", { orgId: org._id, campaignId: c._id, prospectId: p._id, step: 0, to: p.publicEmail!, scheduledFor: at, status: "queued", attempts: 0, createdAt: Date.now() });
    at = nextSendWindow(at + SPACING_MINUTES * 60_000, org.timezone);
    queued++;
  }
  return queued;
}

/* ---------------- owner controls ---------------- */

export const status = query({
  args: { slug: v.string(), campaignId: v.id("outboundCampaigns") },
  handler: async (ctx, { slug, campaignId }) => {
    const { org, role } = await requireOrgAccess(ctx, { slug }, "view");
    const c = assertSameOrg(await ctx.db.get(campaignId), org._id, "campaign");
    const mailbox = await mailboxOf(ctx, org._id);
    const sends = await ctx.db.query("outboundSends").withIndex("by_campaign", (q) => q.eq("campaignId", campaignId)).order("desc").take(300);
    const count = (st: Doc<"outboundSends">["status"]) => sends.filter((s) => s.status === st).length;
    const now = Date.now();
    const day = await mailboxDay(ctx, org, now);
    const others = (await ctx.db.query("outboundCampaigns").withIndex("by_org_created", (q) => q.eq("orgId", org._id)).order("desc").take(50)).filter((x) => x._id !== c._id && (x.sending?.status === "on" || x.sending?.status === "paused"));
    return {
      mailbox: mailbox && mailbox.status === "connected" ? { label: mailbox.accountLabel ?? "Your mailbox" } : null,
      sending: c.sending ?? null,
      capToday: day.cap,
      sentToday: day.sentToday,
      counts: { queued: count("queued") + count("sending"), sent: count("sent"), failed: count("failed"), bounced: count("bounced"), canceled: count("canceled"), uncertain: count("uncertain") },
      // May have gone out: the owner checks their Sent folder and says.
      review: sends.filter((s) => s.status === "uncertain").slice(0, 10).map((s) => ({ id: s._id, to: s.to, step: s.step, reason: s.reviewReason ?? "unverifiable" })),
      next: sends.filter((s) => s.status === "queued").sort((a, b) => a.scheduledFor - b.scheduledFor)[0]?.scheduledFor ?? null,
      recent: sends.filter((s) => s.status !== "queued").slice(0, 20).map((s) => ({ id: s._id, to: s.to, step: s.step, status: s.status, at: s.sentAt ?? s.scheduledFor, error: s.error ?? null })),
      newlyApproved: c.sending ? (await unqueuedApproved(ctx, c)).length : 0,
      others: others.map((x) => ({ id: x._id, title: x.title, status: x.sending!.status, pausedReason: x.sending!.pausedReason ?? null })),
      can: { approve: can(role, "approve"), pause: can(role, "pause"), connect: can(role, "manage_connections") },
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
    await refuseInCopilot(ctx, org._id, "send email");
    await requirePaid(ctx, org, "sending");
    const c = assertSameOrg(await ctx.db.get(a.campaignId), org._id, "campaign");
    if (!c.sequence.length) throw appError("INVALID", "This campaign has no emails yet.");
    const mailbox = await mailboxOf(ctx, org._id);
    if (mailbox?.status !== "connected") throw appError("INVALID", "Connect your mailbox first (Connections → Your mailbox).");
    if (a.address.trim().length < 8) throw appError("INVALID", "Add your business's postal address. The law requires it in cold emails.");
    if (!a.senderName.trim() || !a.company.trim()) throw appError("INVALID", "Add your name and company.");
    const queued = await queueApproved(ctx, org, c);
    if (!queued) throw appError("INVALID", "No approved prospects with a published email to send to.");
    const sender = { senderName: a.senderName.trim().slice(0, 80), company: a.company.trim().slice(0, 80), address: a.address.trim().slice(0, 200), bookingUrl: a.bookingUrl?.trim().slice(0, 300) || undefined };
    await ctx.db.patch(c._id, {
      sending: { status: "on", startedAt: c.sending?.startedAt ?? Date.now(), startedBy: user._id, firstSentAt: c.sending?.firstSentAt, lastSentAt: c.sending?.lastSentAt, ...sender, contentHash: await sendingHash(c, sender) },
      updatedAt: Date.now(),
    });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "outbound.sending_started", subjectType: "campaign", subjectId: c._id, summary: `Started sending to ${queued} prospect${queued === 1 ? "" : "s"} from your mailbox (warm-up limits apply).` });
    return { queued };
  },
});

/** After sending started: queue people approved since (same approved emails and sender). */
export const addApproved = mutation({
  args: { slug: v.string(), campaignId: v.id("outboundCampaigns") },
  handler: async (ctx, a) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: a.slug }, "approve");
    await refuseInCopilot(ctx, org._id, "send email");
    await requirePaid(ctx, org, "sending");
    const c = assertSameOrg(await ctx.db.get(a.campaignId), org._id, "campaign");
    if (!c.sending) throw appError("INVALID", "Start sending first.");
    if (c.sending.contentHash && c.sending.contentHash !== (await sendingHash(c, c.sending))) throw appError("INVALID", "The emails changed. Resume sending to approve them first.");
    if ((await mailboxOf(ctx, org._id))?.status !== "connected") throw appError("INVALID", "Connect your mailbox first (Connections → Your mailbox).");
    const queued = await queueApproved(ctx, org, c);
    if (!queued) throw appError("INVALID", "Nobody new to send to.");
    if (c.sending.status === "done") await ctx.db.patch(c._id, { sending: { ...c.sending, status: "on" }, updatedAt: Date.now() });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "outbound.sending_added", subjectType: "campaign", subjectId: c._id, summary: `Added ${queued} newly approved prospect${queued === 1 ? "" : "s"} to sending.` });
    return { queued, paused: c.sending.status === "paused" };
  },
});

export const setPaused = mutation({
  args: { slug: v.string(), campaignId: v.id("outboundCampaigns"), paused: v.boolean() },
  handler: async (ctx, { slug, campaignId, paused }) => {
    // Anyone who can pause may stop sending; resuming approves the emails, so it needs approval rights.
    const { org, user } = await requireOrgAccess(ctx, { slug }, paused ? "pause" : "approve");
    const c = assertSameOrg(await ctx.db.get(campaignId), org._id, "campaign");
    if (!c.sending || c.sending.status === "done") return;
    const resumed = paused ? {} : { contentHash: await sendingHash(c, c.sending), pausedReason: undefined };
    await ctx.db.patch(c._id, { sending: { ...c.sending, status: paused ? "paused" : "on", ...resumed }, updatedAt: Date.now() });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: paused ? "outbound.sending_paused" : "outbound.sending_resumed", subjectType: "campaign", subjectId: c._id, summary: paused ? "Paused sending." : "Resumed sending." });
  },
});

/* ---------------- dispatch (cron) ---------------- */

/** Another row already sent, sending or maybe sent under this key: this one is a duplicate. */
async function keyTaken(ctx: MutationCtx, opKey: string, self: Id<"outboundSends">) {
  const rows = await ctx.db.query("outboundSends").withIndex("by_op_key", (q) => q.eq("opKey", opKey)).take(10);
  return rows.some((r) => r._id !== self && (r.status === "sent" || r.status === "sending" || r.status === "uncertain" || r.status === "bounced"));
}

/**
 * It may have gone out. Never back to the queue from here: the Sent folder is
 * checked first (by the Message-ID derived from the key), or the owner decides.
 */
async function markUncertain(ctx: MutationCtx, s: Doc<"outboundSends">, reason: NonNullable<Doc<"outboundSends">["reviewReason"]>, error?: string) {
  await ctx.db.patch(s._id, { status: "uncertain", reviewReason: reason, leaseExpiresAt: undefined, ...(error ? { error: error.slice(0, 300) } : {}) });
  if (reason === "payload_changed") await askOwner(ctx, s);
  // A lost answer: give the Sent copy a moment to land before looking.
  else await ctx.scheduler.runAfter(reason === "no_response" ? 120_000 : 0, internal.mailbox.reconcileOne, { sendId: s._id, lease: s.lease });
}

async function askOwner(ctx: MutationCtx, s: Doc<"outboundSends">) {
  await notifyOwners(ctx, s.orgId, `An email to ${s.to} may have sent. Check your Sent folder, then mark it in Outbound.`, "outbound");
}

/** Leases that ran out: unclaimed ones never reached the mailbox (queue again); claimed ones may have sent (uncertain). */
async function sweepLeases(ctx: MutationCtx, now: number) {
  for (const s of await ctx.db.query("outboundSends").withIndex("by_status_lease", (q) => q.eq("status", "sending").lt("leaseExpiresAt", now)).take(100)) {
    // Handed over before leases existed: give its worker an hour.
    if (s.leaseExpiresAt === undefined && s.scheduledFor > now - 3_600_000) continue;
    if (s.leaseExpiresAt !== undefined && !s.claimedAt) await ctx.db.patch(s._id, { status: "queued", attempts: Math.max(0, s.attempts - 1), ...RELEASE });
    else await markUncertain(ctx, s, "lease_expired");
  }
}

/** Every 5 minutes: hand at most one due email per mailbox to the sender, within its daily cap, spacing and the send window. */
export const dispatch = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    if (await fleetStopped(ctx)) return 0;
    await sweepLeases(ctx, now);
    const byOrg = new Map<Id<"organizations">, Doc<"outboundCampaigns">[]>();
    for (const c of await ctx.db.query("outboundCampaigns").withIndex("by_sending", (q) => q.eq("sending.status", "on")).take(200)) byOrg.set(c.orgId, [...(byOrg.get(c.orgId) ?? []), c]);
    let handed = 0;
    for (const [orgId, campaigns] of byOrg) {
      const org = await ctx.db.get(orgId);
      if (!org || org.emergencyStop?.active || org.suspendedAt) continue;
      if (!inSendWindow(now, org.timezone)) continue;
      // Revoked or expired mailbox: nothing is handed over or retried until it's reconnected.
      if ((await mailboxOf(ctx, orgId))?.status !== "connected") continue;
      const due: Doc<"outboundSends">[] = [];
      const approved = new Map<Id<"outboundCampaigns">, string>();
      for (const c of campaigns) {
        // Approval is bound to the exact emails: an edit after approval pauses sending until the owner resumes.
        const hash = await sendingHash(c, c.sending!);
        if (!c.sending!.contentHash) await ctx.db.patch(c._id, { sending: { ...c.sending!, contentHash: hash } });
        else if (c.sending!.contentHash !== hash) {
          await ctx.db.patch(c._id, { sending: { ...c.sending!, status: "paused", pausedReason: "content_changed" }, updatedAt: now });
          await audit(ctx, { orgId: org._id, actorType: "system", action: "outbound.sending_paused", subjectType: "campaign", subjectId: c._id, summary: "Paused: the emails changed after sending was approved. Review them and resume." });
          await notifyOwners(ctx, org._id, `Outbound “${c.title}” paused: the emails changed after you approved them. Review and resume.`, "outbound");
          continue;
        }
        approved.set(c._id, hash);
        const sends = await ctx.db.query("outboundSends").withIndex("by_campaign", (q) => q.eq("campaignId", c._id)).order("desc").take(500);
        // Done only when every email has its own final result (one sent doesn't finish the rest).
        if (!sends.some((s) => s.status === "queued" || s.status === "sending" || s.status === "uncertain")) {
          await ctx.db.patch(c._id, { sending: { ...c.sending!, status: "done" } });
          continue;
        }
        due.push(...sends.filter((s) => s.status === "queued" && s.scheduledFor <= now));
      }
      if (!due.length) continue;
      // One mailbox: one warm-up cap and one spacing across all its campaigns.
      const day = await mailboxDay(ctx, org, now);
      if (day.inFlight || day.sentToday >= day.cap || now - day.lastSent < (SPACING_MINUTES - 2) * 60_000) continue;
      for (const s of due.sort((a, b) => a.scheduledFor - b.scheduledFor)) {
        const opKey = await sendOpKey({ orgId, prospectId: s.prospectId, step: s.step, contentHash: approved.get(s.campaignId)! });
        if (await keyTaken(ctx, opKey, s._id)) {
          await ctx.db.patch(s._id, { status: "canceled", opKey, error: "Duplicate of an email already sent or on its way." });
          continue;
        }
        const lease = `${s.attempts + 1}.${now.toString(36)}`;
        // A re-approved edit is a new email: its own key, and its payload is bound afresh.
        await ctx.db.patch(s._id, { status: "sending", attempts: s.attempts + 1, opKey, lease, leaseExpiresAt: now + HAND_LEASE_MS, claimedAt: undefined, reviewReason: undefined, ...(s.opKey !== opKey ? { payloadHash: undefined } : {}) });
        await ctx.scheduler.runAfter(Math.floor(Math.random() * 90_000), internal.mailbox.sendOne, { sendId: s._id, lease });
        handed++;
        break;
      }
    }
    return handed;
  },
});

/**
 * Everything the mailbox sender needs for one email, checked again at send
 * time: null = don't send it (stopped prospect, unsubscribed); hold = not now
 * (paused, emergency stop, content changed, mailbox gone), it goes back in the queue.
 */
export const prepareSend = internalQuery({
  args: { sendId: v.id("outboundSends") },
  handler: async (ctx, { sendId }) => {
    const s = await ctx.db.get(sendId);
    if (!s || s.status !== "sending") return null;
    const c = await ctx.db.get(s.campaignId);
    const p = await ctx.db.get(s.prospectId);
    const org = await ctx.db.get(s.orgId);
    if (!c?.sending || !p || !org) return null;
    if (STOPPED_STAGES.includes(p.stage)) return null;
    if (await isSuppressed(ctx, s.orgId, s.to)) return null;
    const step = c.sequence[s.step];
    if (!step) return null;
    const hold = { hold: true as const };
    if (c.sending.status !== "on" || org.emergencyStop?.active || org.suspendedAt || (await fleetStopped(ctx))) return hold;
    const mailbox = await mailboxOf(ctx, s.orgId);
    if (!mailbox || mailbox.status !== "connected") return hold;
    // Never send content that differs from what was approved.
    if (c.sending.contentHash && c.sending.contentHash !== (await sendingHash(c, c.sending))) return hold;
    const previous = s.step > 0 ? await ctx.db.query("outboundSends").withIndex("by_prospect", (q) => q.eq("prospectId", p._id).eq("step", 0)).first() : null;
    const token = await unsubscribeToken(p._id, serverSecret());
    const unsub = `${SITE()}/u/${token}`;
    const oneClick = process.env.CONVEX_SITE_URL ? `${process.env.CONVEX_SITE_URL}/unsubscribe?token=${encodeURIComponent(token)}` : unsub;
    // A/B subject test: half the prospects get subject B on the first email.
    const test = s.step === 0 ? await ctx.db.query("abTests").withIndex("by_target", (q) => q.eq("targetId", c._id).eq("status", "running")).first() : null;
    const b = test && variantFor(p._id) === "B" ? test.variants.find((x) => x.key === "B")?.value : undefined;
    // The booking link carries the prospect, so a booking stops their sequence and joins their deal.
    const bookingUrl = c.sending.bookingUrl ? bookingLinkFor(c.sending.bookingUrl, p._id) : undefined;
    const email = composeEmail({ step: b ? { ...step, subject: b } : step, stepIndex: s.step, firstLine: p.firstLine, contactName: p.contact, sender: { name: c.sending.senderName, company: c.sending.company, address: c.sending.address, bookingUrl }, unsubscribeUrl: unsub });
    const inReplyTo = previous?.messageId ?? null;
    return { hold: false as const, to: s.to, subject: email.subject, text: email.text, unsubscribeUrl: oneClick, connectionId: mailbox._id, inReplyTo, opKey: s.opKey ?? null, payloadHash: await sendPayloadHash({ to: s.to, subject: email.subject, text: email.text, inReplyTo }) };
  },
});

/**
 * The one moment a worker may hand this email to the mailbox: it must hold
 * the current lease, nobody may have claimed it, and the email must be the
 * one first tried under its key. True = send now.
 */
export const claimSend = internalMutation({
  args: { sendId: v.id("outboundSends"), lease: v.optional(v.string()), payloadHash: v.string() },
  handler: async (ctx, { sendId, lease, payloadHash }) => {
    const s = await ctx.db.get(sendId);
    const now = Date.now();
    if (!s || s.status !== "sending" || s.lease !== lease || s.claimedAt) return false;
    if (s.leaseExpiresAt !== undefined && s.leaseExpiresAt <= now) return false;
    if (s.opKey && (await keyTaken(ctx, s.opKey, s._id))) {
      await ctx.db.patch(s._id, { status: "canceled", error: "Duplicate of an email already sent or on its way.", ...RELEASE });
      return false;
    }
    if (s.payloadHash && s.payloadHash !== payloadHash) {
      // Same key, different email: an earlier try may have sent the first one.
      await markUncertain(ctx, s, "payload_changed", "The email changed since the first try.");
      return false;
    }
    await ctx.db.patch(s._id, { claimedAt: now, leaseExpiresAt: now + SEND_LEASE_MS, payloadHash });
    return true;
  },
});

/** Sent: record it, then queue the next step once (or stop). */
async function markSent(ctx: MutationCtx, s: Doc<"outboundSends">, messageId: string | undefined, now: number) {
  await ctx.db.patch(s._id, { status: "sent", sentAt: now, messageId, leaseExpiresAt: undefined, reviewReason: undefined, error: undefined });
  if (s.step === 0) {
    const test = await runningTest(ctx, s.campaignId);
    if (test) await recordAb(ctx, test, variantFor(s.prospectId), "trials");
  }
  const c = await ctx.db.get(s.campaignId);
  const p = await ctx.db.get(s.prospectId);
  const org = await ctx.db.get(s.orgId);
  if (c?.sending) await ctx.db.patch(c._id, { sending: { ...c.sending, firstSentAt: c.sending.firstSentAt ?? now, lastSentAt: now } });
  if (p && p.stage === "approved") await ctx.db.patch(p._id, { stage: "contacted", updatedAt: now });
  const next = c?.sequence[s.step + 1];
  if (!c || !next || !org) return;
  if (await ctx.db.query("outboundSends").withIndex("by_prospect", (q) => q.eq("prospectId", s.prospectId).eq("step", s.step + 1)).first()) return;
  const gap = next.day - (c.sequence[s.step]?.day ?? 0);
  await ctx.db.insert("outboundSends", { orgId: s.orgId, campaignId: s.campaignId, prospectId: s.prospectId, step: s.step + 1, to: s.to, scheduledFor: followUpAt(now, gap, org.timezone), status: "queued", attempts: 0, createdAt: now });
}

/**
 * Record a worker's result, only from the worker holding the lease. A
 * success always counts (even after its lease ran out); "unclear" (timeout,
 * dropped connection) goes to uncertain, never straight back to the queue.
 */
export const recordSend = internalMutation({
  args: {
    sendId: v.id("outboundSends"),
    lease: v.optional(v.string()),
    ok: v.boolean(),
    messageId: v.optional(v.string()),
    error: v.optional(v.string()),
    skip: v.optional(v.boolean()),
    hold: v.optional(v.boolean()),
    outcome: v.optional(v.union(v.literal("rejected"), v.literal("auth"), v.literal("unclear"))),
  },
  handler: async (ctx, { sendId, lease, ok, messageId, error, skip, hold, outcome }) => {
    const s = await ctx.db.get(sendId);
    if (!s || s.lease !== lease) return;
    const now = Date.now();
    if (ok) {
      if (s.status === "sending" || s.status === "uncertain") await markSent(ctx, s, messageId, now);
      return;
    }
    if (s.status !== "sending") return;
    if (hold || skip) {
      // Only before the mailbox was reached.
      if (s.claimedAt) return;
      // Back in the queue for when sending resumes (this attempt doesn't count).
      if (hold) await ctx.db.patch(s._id, { status: "queued", attempts: Math.max(0, s.attempts - 1), ...RELEASE });
      else await ctx.db.patch(s._id, { status: "canceled", ...RELEASE });
      return;
    }
    if (outcome === "unclear") {
      await markUncertain(ctx, s, "no_response", error);
      return;
    }
    if (outcome === "auth") {
      // The mailbox refused the sign-in (its connection is now marked expired): wait in the queue, no retry.
      await ctx.db.patch(s._id, { status: "queued", attempts: Math.max(0, s.attempts - 1), error: "Mailbox sign-in failed", ...RELEASE });
      await notifyOwners(ctx, s.orgId, "Your mailbox sign-in stopped working. Reconnect it in Connections to keep sending.", "connections");
      return;
    }
    // The server said no: one retry after 30 minutes, then give up on this email.
    if (s.attempts < 2) await ctx.db.patch(s._id, { status: "queued", scheduledFor: now + 30 * 60_000, error: error?.slice(0, 300), ...RELEASE });
    else await ctx.db.patch(s._id, { status: "failed", error: error?.slice(0, 300), ...RELEASE });
  },
});

/** What the Sent-folder check needs for one uncertain email (bound to its lease). */
export const reconcileJob = internalQuery({
  args: { sendId: v.id("outboundSends"), lease: v.optional(v.string()) },
  handler: async (ctx, { sendId, lease }) => {
    const s = await ctx.db.get(sendId);
    if (!s || s.status !== "uncertain" || s.lease !== lease) return null;
    const mailbox = await mailboxOf(ctx, s.orgId);
    return { opKey: s.opKey ?? null, connectionId: mailbox?.status === "connected" ? mailbox._id : null };
  },
});

/** The Sent folder's answer: found = sent; not found = send again (same key); null = can't tell, the owner decides. */
export const recordReconcile = internalMutation({
  args: { sendId: v.id("outboundSends"), lease: v.optional(v.string()), found: v.union(v.boolean(), v.null()), messageId: v.optional(v.string()) },
  handler: async (ctx, { sendId, lease, found, messageId }) => {
    const s = await ctx.db.get(sendId);
    if (!s || s.status !== "uncertain" || s.lease !== lease) return;
    const now = Date.now();
    if (found) await markSent(ctx, s, messageId, now);
    else if (found === false && s.attempts >= MAX_ATTEMPTS) await ctx.db.patch(s._id, { status: "failed", reviewReason: undefined, error: `Not sent after ${MAX_ATTEMPTS} tries.`, ...RELEASE });
    else if (found === false) await ctx.db.patch(s._id, { status: "queued", scheduledFor: now, reviewReason: undefined, error: "Not in your Sent folder; sending again.", ...RELEASE });
    else {
      await ctx.db.patch(s._id, { reviewReason: "unverifiable" });
      await askOwner(ctx, s);
    }
  },
});

/** The owner checked their Sent folder: it went out, send it again, or skip it. */
export const resolveUncertain = mutation({
  args: { slug: v.string(), sendId: v.id("outboundSends"), outcome: v.union(v.literal("sent"), v.literal("resend"), v.literal("skip")) },
  handler: async (ctx, { slug, sendId, outcome }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "approve");
    const s = assertSameOrg(await ctx.db.get(sendId), org._id, "email");
    if (s.status !== "uncertain") throw appError("INVALID", "Already handled.");
    const now = Date.now();
    if (outcome === "sent") {
      const mailbox = await mailboxOf(ctx, org._id);
      await markSent(ctx, s, s.opKey && mailbox?.accountLabel ? sendMessageId(s.opKey, mailbox.accountLabel) : undefined, now);
    } else if (outcome === "resend") {
      await refuseInCopilot(ctx, org._id, "send email");
      // The owner confirmed it didn't go out: the current approved email is bound afresh.
      await ctx.db.patch(s._id, { status: "queued", scheduledFor: now, payloadHash: undefined, reviewReason: undefined, error: undefined, ...RELEASE });
    } else await ctx.db.patch(s._id, { status: "canceled", reviewReason: undefined, ...RELEASE });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "outbound.send_resolved", subjectType: "campaign", subjectId: s.campaignId, summary: `Unclear email to ${s.to}: ${outcome === "sent" ? "marked sent" : outcome === "resend" ? "sending again" : "skipped"}.` });
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
      const found = byEmail.get(r.from.toLowerCase());
      if (!found) continue;
      const p = (await ctx.db.get(found._id)) ?? found;
      // Unified inbox: every reply once (deduped by Message-ID), with the text to answer.
      const externalId = `email:${r.messageId ?? `${r.from}:${r.at ?? 0}`}`;
      if (r.messageId && (await ctx.db.query("communityMessages").withIndex("by_org_external", (q) => q.eq("orgId", c.orgId).eq("externalId", externalId)).first())) continue;
      if (r.text) await ctx.db.insert("communityMessages", { orgId: c.orgId, channel: "email", kind: "email", externalId, prospectId: p._id, campaignId, fromEmail: r.from.toLowerCase(), subject: r.subject, messageRef: r.messageId, authorName: p.company, text: r.text, receivedAt: r.at ?? now, status: r.optOut ? "dismissed" : "new", createdAt: now, updatedAt: now });
      if (r.optOut) {
        // An opt-out always stops everything, even after an earlier reply.
        await cancelQueued(ctx, p._id);
        await suppress(ctx, c.orgId, r.from, "unsubscribe", "reply");
        if (p.stage !== "booked" && p.stage !== "won" && p.stage !== "lost") await ctx.db.patch(p._id, { stage: "lost", updatedAt: now });
        continue;
      }
      const already = p.stage === "replied" || p.stage === "booked" || p.stage === "won";
      await syncDealFromProspect(ctx, p, "talking", "outbound", r.text ? `Replied: “${r.text.slice(0, 160)}”` : "Replied to your email.");
      if (!already && r.text) await emitEvent(ctx, c.orgId, "reply.received", { company: p.company, email: r.from, subject: r.subject ?? null, text: r.text.slice(0, 1000) });
      if (!already) {
        const test = await runningTest(ctx, campaignId);
        if (test) await recordAb(ctx, test, variantFor(p._id), "wins");
      }
      if (already || p.stage === "lost") continue;
      await ctx.db.patch(p._id, { stage: "replied", updatedAt: now });
      await cancelQueued(ctx, p._id);
      await ctx.db.insert("notices", { userId: c.sending.startedBy, orgId: c.orgId, kind: "system", text: `${p.company} replied to your email. Their sequence is stopped so you can answer personally.`, href: `/app/${(await ctx.db.get(c.orgId))?.slug ?? ""}/outbound`, createdAt: now });
    }
    for (const email of bounced) {
      const p = byEmail.get(email.toLowerCase());
      if (!p) continue;
      await cancelQueued(ctx, p._id);
      for (const s of await ctx.db.query("outboundSends").withIndex("by_prospect", (q) => q.eq("prospectId", p._id)).take(20)) if (s.status === "sent") await ctx.db.patch(s._id, { status: "bounced" });
      await suppress(ctx, c.orgId, email, "bounce", "mailbox");
    }
    const fresh = await ctx.db.get(c._id);
    if (fresh?.sending) await ctx.db.patch(c._id, { sending: { ...fresh.sending, lastReplyCheckAt: checkedAt } });
  },
});

/**
 * Campaigns whose mailbox should be checked (sending on, or the last email
 * went out in the last 21 days), and the moment to read from: the last check,
 * so each run only reads new mail.
 */
export const replyCheckTargets = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const out: { campaignId: Id<"outboundCampaigns">; connectionId: Id<"connections">; since: number; emails: string[] }[] = [];
    for (const st of ["on", "done", "paused"] as const) {
      for (const c of await ctx.db.query("outboundCampaigns").withIndex("by_sending", (q) => q.eq("sending.status", st)).take(200)) {
        if (!c.sending) continue;
        const lastSent = c.sending.lastSentAt ?? c.sending.firstSentAt ?? c.sending.startedAt;
        if (st !== "on" && now - lastSent > 21 * DAY) continue;
        const mailbox = await mailboxOf(ctx, c.orgId);
        if (mailbox?.status !== "connected") continue;
        const contacted = (await ctx.db.query("prospects").withIndex("by_campaign", (q) => q.eq("campaignId", c._id)).take(300)).filter((p) => p.publicEmail && ["contacted", "approved", "replied", "booked"].includes(p.stage));
        // A small overlap with the last check; replies are deduped by Message-ID.
        const since = Math.max(c.sending.startedAt, (c.sending.lastReplyCheckAt ?? 0) - 10 * 60_000);
        if (contacted.length) out.push({ campaignId: c._id, connectionId: mailbox._id, since, emails: contacted.map((p) => p.publicEmail!) });
      }
    }
    return out;
  },
});

/* ---------------- unsubscribe (public, from the email footer) ---------------- */

export const unsubscribe = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const id = await verifyUnsubscribeToken(token, serverSecret());
    const prospectId = id ? ctx.db.normalizeId("prospects", id) : null;
    const p = prospectId ? await ctx.db.get(prospectId) : null;
    if (p) {
      await cancelQueued(ctx, p._id);
      if (p.publicEmail) await suppress(ctx, p.orgId, p.publicEmail, "unsubscribe", "link");
      if (p.stage !== "won" && p.stage !== "booked") await ctx.db.patch(p._id, { stage: "lost", updatedAt: Date.now() });
      return { company: (await ctx.db.get(p.orgId))?.name ?? "the sender" };
    }
    // Review requests carry the same signed link.
    const requestId = id ? ctx.db.normalizeId("reviewRequests", id) : null;
    const r = requestId ? await ctx.db.get(requestId) : null;
    if (!r) throw appError("NOT_FOUND", "This link isn't valid.");
    await suppress(ctx, r.orgId, r.email, "unsubscribe", "review_link");
    return { company: (await ctx.db.get(r.orgId))?.name ?? "the sender" };
  },
});

/** Mailbox connection status for the Connections page. */
export const mailbox = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org, role } = await requireOrgAccess(ctx, { slug }, "view");
    const m = await mailboxOf(ctx, org._id);
    return { connected: m?.status === "connected", label: m?.accountLabel ?? null, canManage: can(role, "manage_connections"), isDemo: org.kind === "demo" };
  },
});
