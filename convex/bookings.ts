import { v } from "convex/values";
import { sha256Hex } from "../shared/policy";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { bookingCancelled } from "./crm";
import { decryptSecret, serverSecret } from "./lib/crypto";
import { bookingCancelledEmail, bookingReminderEmail, noShowEmail } from "./lib/emailTemplates";
import { appError, assertSameOrg, requireOrgAccess } from "./lib/tenancy";

/**
 * Booked calls after booking: a reminder the day before (with a private link
 * to cancel or rebook), and a no-show follow-up when the owner marks one.
 */

const SITE = () => process.env.SITE_URL ?? "https://climbos.app";
const HOUR = 3_600_000;

/** The guest's private manage link token: derived from the server secret, so every email shares one link; only its hash is stored. */
export async function manageToken(bookingId: string): Promise<string> {
  return (await sha256Hex(`${serverSecret()}:manage:${bookingId}`)).slice(0, 32);
}

/* ---------------- guest: manage via private link ---------------- */

export const manageView = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    if (!/^[0-9a-f]{32}$/.test(token)) return null;
    const hash = await sha256Hex(token);
    const b = await ctx.db.query("bookings").withIndex("by_manage", (q) => q.eq("manageTokenHash", hash)).first();
    if (!b) return null;
    const page = await ctx.db.get(b.pageId);
    const org = await ctx.db.get(b.orgId);
    if (!page || !org) return null;
    return { title: page.title, withName: org.name, startAt: b.startAt, minutes: page.durationMin, timezone: page.timezone, status: b.status, rebookUrl: `${SITE()}/book/${page.slug}`, past: b.startAt < Date.now() };
  },
});

export const cancelByGuest = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    if (!/^[0-9a-f]{32}$/.test(token)) throw appError("NOT_FOUND", "This link isn't valid.");
    const hash = await sha256Hex(token);
    const b = await ctx.db.query("bookings").withIndex("by_manage", (q) => q.eq("manageTokenHash", hash)).first();
    if (!b) throw appError("NOT_FOUND", "This link isn't valid.");
    if (b.status === "cancelled") return;
    if (b.startAt < Date.now()) throw appError("INVALID", "This call has already started.");
    await ctx.db.patch(b._id, { status: "cancelled" });
    await bookingCancelled(ctx, b, "They cancelled the call.");
    const org = await ctx.db.get(b.orgId);
    const now = Date.now();
    await ctx.db.insert("communityMessages", { orgId: b.orgId, channel: "booking", kind: "booking", externalId: `booking-cancel:${b._id}`, authorName: b.company ? `${b.name} (${b.company})` : b.name, text: `Cancelled their call for ${new Date(b.startAt).toUTCString().slice(0, 22)} UTC. The time is free again.`, receivedAt: now, status: "new", createdAt: now, updatedAt: now });
    if (org) {
      for (const m of await ctx.db.query("memberships").withIndex("by_org", (q) => q.eq("orgId", org._id)).take(50)) {
        if (m.status === "active" && m.userId && ["owner", "admin"].includes(m.role)) await ctx.db.insert("notices", { userId: m.userId, orgId: org._id, kind: "system", text: `${b.name} cancelled their call.`, href: `/app/${org.slug}/inbox`, createdAt: now });
      }
    }
  },
});

/* ---------------- owner: outcome ---------------- */

/** The booking behind an Inbox booking item (for the "Did they show up?" buttons). */
export const forInbox = query({
  args: { slug: v.string(), inboxId: v.id("communityMessages") },
  handler: async (ctx, { slug, inboxId }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const m = assertSameOrg(await ctx.db.get(inboxId), org._id, "message");
    const id = m.externalId.startsWith("booking:") ? ctx.db.normalizeId("bookings", m.externalId.slice(8)) : null;
    const b = id ? await ctx.db.get(id) : null;
    if (!b || b.orgId !== org._id) return null;
    return { id: b._id, startAt: b.startAt, endAt: b.endAt, past: b.startAt <= Date.now(), status: b.status, outcome: b.outcome ?? null, followUpSent: Boolean(b.followUpSentAt) };
  },
});

export const setOutcome = mutation({
  args: { slug: v.string(), bookingId: v.id("bookings"), outcome: v.union(v.literal("attended"), v.literal("no_show")) },
  handler: async (ctx, { slug, bookingId, outcome }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "edit");
    const b = assertSameOrg(await ctx.db.get(bookingId), org._id, "booking");
    if (b.startAt > Date.now()) throw appError("INVALID", "The call hasn't happened yet.");
    await ctx.db.patch(b._id, { outcome });
    if (outcome === "no_show" && !b.followUpSentAt && org.kind !== "demo") await ctx.scheduler.runAfter(0, internal.bookings.sendNoShow, { bookingId });
    if (b.prospectId && outcome === "no_show") {
      const deal = await ctx.db.query("deals").withIndex("by_prospect", (q) => q.eq("prospectId", b.prospectId)).first();
      if (deal && deal.stage === "booked") await ctx.db.patch(deal._id, { stage: "talking", notes: [...deal.notes, { text: "Missed the call; follow-up sent.", at: Date.now() }], updatedAt: Date.now() });
    }
  },
});

/* ---------------- email jobs ---------------- */

export const emailContext = internalQuery({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, { bookingId }) => {
    const b = await ctx.db.get(bookingId);
    if (!b) return null;
    const page = await ctx.db.get(b.pageId);
    const org = await ctx.db.get(b.orgId);
    return page && org ? { b, page, org } : null;
  },
});

export const markSent = internalMutation({
  args: { bookingId: v.id("bookings"), field: v.union(v.literal("reminderSentAt"), v.literal("followUpSentAt")), manageTokenHash: v.optional(v.string()) },
  handler: async (ctx, { bookingId, field, manageTokenHash }) => {
    await ctx.db.patch(bookingId, { [field]: Date.now(), ...(manageTokenHash ? { manageTokenHash } : {}) });
  },
});

export const dueReminders = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const rows = await ctx.db.query("bookings").withIndex("by_status_start", (q) => q.eq("status", "confirmed").gte("startAt", now + 2 * HOUR).lte("startAt", now + 26 * HOUR)).take(500);
    return rows.filter((b) => !b.reminderSentAt && b.startAt - b.createdAt > 6 * HOUR).map((b) => b._id as Id<"bookings">);
  },
});

/** Every 15 minutes: reminders for calls in the next 2–26 hours (booked more than 6 hours ahead). */
export const sendReminders = internalAction({
  args: {},
  handler: async (ctx) => {
    let sent = 0;
    for (const bookingId of await ctx.runQuery(internal.bookings.dueReminders, {})) {
      const c = await ctx.runQuery(internal.bookings.emailContext, { bookingId });
      if (!c || c.org.kind === "demo") continue;
      const token = await manageToken(bookingId);
      const email = await decryptSecret({ keyId: c.b.emailKeyId, iv: c.b.emailIv, ciphertext: c.b.emailCiphertext }, `climbos:${c.org._id}:booking`);
      const when = new Date(c.b.startAt).toLocaleString("en-US", { timeZone: c.page.timezone, weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
      const mail = bookingReminderEmail({ title: c.page.title, when, minutes: c.page.durationMin, withName: c.org.name, manageUrl: `${SITE()}/book/manage/${token}` });
      await ctx.runMutation(internal.bookings.markSent, { bookingId, field: "reminderSentAt" });
      await ctx.runAction(internal.notifications.sendPlatformEmail, { orgId: c.org._id, to: email, template: "booking_reminder", ...mail });
      sent++;
    }
    return sent;
  },
});

/** The owner cancelled: tell the guest, with a link to pick another time. */
export const sendCancelled = internalAction({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, { bookingId }) => {
    const c = await ctx.runQuery(internal.bookings.emailContext, { bookingId });
    if (!c || c.org.kind === "demo" || c.b.status !== "cancelled") return;
    const email = await decryptSecret({ keyId: c.b.emailKeyId, iv: c.b.emailIv, ciphertext: c.b.emailCiphertext }, `climbos:${c.org._id}:booking`);
    const when = new Date(c.b.startAt).toLocaleString("en-US", { timeZone: c.page.timezone, weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
    const mail = bookingCancelledEmail({ title: c.page.title, when, withName: c.org.name, rebookUrl: `${SITE()}/book/${c.page.slug}` });
    await ctx.runAction(internal.notifications.sendPlatformEmail, { orgId: c.org._id, to: email, template: "booking_cancelled", ...mail });
  },
});

export const sendNoShow = internalAction({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, { bookingId }) => {
    const c = await ctx.runQuery(internal.bookings.emailContext, { bookingId });
    if (!c || c.b.followUpSentAt) return;
    const email = await decryptSecret({ keyId: c.b.emailKeyId, iv: c.b.emailIv, ciphertext: c.b.emailCiphertext }, `climbos:${c.org._id}:booking`);
    const mail = noShowEmail({ withName: c.org.name, rebookUrl: `${SITE()}/book/${c.page.slug}` });
    await ctx.runMutation(internal.bookings.markSent, { bookingId, field: "followUpSentAt" });
    await ctx.runAction(internal.notifications.sendPlatformEmail, { orgId: c.org._id, to: email, template: "booking_no_show", ...mail });
  },
});
