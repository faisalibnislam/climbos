import { v } from "convex/values";
import { sha256Hex } from "../shared/policy";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query, type MutationCtx } from "./_generated/server";
import { requireUser } from "./lib/tenancy";

/**
 * Web push without a push vendor: the push itself is empty (VAPID-signed, no
 * payload to encrypt); the service worker then pulls the text from ClimbOS
 * using its endpoint, which only that browser knows.
 */

export const publicKey = query({ args: {}, handler: async () => process.env.VAPID_PUBLIC_KEY ?? null });

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const subs = await ctx.db.query("pushSubscriptions").withIndex("by_user", (q) => q.eq("userId", user._id)).take(20);
    return subs.map((s) => ({ id: s._id, label: s.label ?? "Device", hash: s.endpointHash, lastOkAt: s.lastOkAt ?? null }));
  },
});

export const subscribe = mutation({
  args: { endpoint: v.string(), label: v.optional(v.string()) },
  handler: async (ctx, { endpoint, label }) => {
    const user = await requireUser(ctx);
    if (!/^https:\/\/\S+$/.test(endpoint) || endpoint.length > 1000) throw new Error("Bad endpoint");
    const endpointHash = await sha256Hex(endpoint);
    const existing = await ctx.db.query("pushSubscriptions").withIndex("by_hash", (q) => q.eq("endpointHash", endpointHash)).first();
    if (existing) {
      await ctx.db.patch(existing._id, { userId: user._id, failures: 0, label: label?.slice(0, 60) });
      return endpointHash;
    }
    const mineCount = (await ctx.db.query("pushSubscriptions").withIndex("by_user", (q) => q.eq("userId", user._id)).take(11)).length;
    if (mineCount >= 10) throw new Error("Too many devices. Remove one first.");
    await ctx.db.insert("pushSubscriptions", { userId: user._id, endpoint, endpointHash, label: label?.slice(0, 60), failures: 0, createdAt: Date.now() });
    return endpointHash;
  },
});

export const unsubscribe = mutation({
  args: { id: v.id("pushSubscriptions") },
  handler: async (ctx, { id }) => {
    const user = await requireUser(ctx);
    const s = await ctx.db.get(id);
    if (s && s.userId === user._id) await ctx.db.delete(id);
  },
});

/** Send yourself a test notification. */
export const test = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    await enqueue(ctx, user._id, { title: "ClimbOS", body: "Notifications are on. We'll tell you when something needs you.", url: "/app" });
  },
});

async function enqueue(ctx: MutationCtx, userId: Id<"users">, m: { title: string; body: string; url: string; tag?: string }) {
  await ctx.db.insert("pushOutbox", { userId, title: m.title.slice(0, 80), body: m.body.slice(0, 200), url: m.url.startsWith("/") ? m.url : "/app", tag: m.tag, createdAt: Date.now() });
  await ctx.scheduler.runAfter(0, internal.pushActions.deliver, { userId });
}

/** Every 2 minutes: bell notices become phone notifications for people who turned them on. */
export const fanout = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cfg = await ctx.db.query("appConfig").withIndex("by_key", (q) => q.eq("key", "pushCursor")).first();
    const since = cfg ? Number(cfg.value) : Date.now() - 5 * 60_000;
    const notices = await ctx.db.query("notices").withIndex("by_created", (q) => q.gt("createdAt", since)).take(500);
    if (!notices.length) return 0;
    const hasSub = new Map<string, boolean>();
    let sent = 0;
    for (const n of notices) {
      if (!hasSub.has(n.userId)) hasSub.set(n.userId, Boolean(await ctx.db.query("pushSubscriptions").withIndex("by_user", (q) => q.eq("userId", n.userId)).first()));
      if (!hasSub.get(n.userId)) continue;
      await ctx.db.insert("pushOutbox", { userId: n.userId, title: "ClimbOS", body: n.text.slice(0, 200), url: n.href.startsWith("/") ? n.href : "/app", tag: n.kind, createdAt: Date.now() });
      sent++;
    }
    for (const [userId, yes] of hasSub) if (yes) await ctx.scheduler.runAfter(0, internal.pushActions.deliver, { userId: userId as Id<"users"> });
    const last = String(notices[notices.length - 1].createdAt);
    if (cfg) await ctx.db.patch(cfg._id, { value: last, updatedAt: Date.now() });
    else await ctx.db.insert("appConfig", { key: "pushCursor", value: last, updatedAt: Date.now() });
    return sent;
  },
});

export const targets = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => (await ctx.db.query("pushSubscriptions").withIndex("by_user", (q) => q.eq("userId", userId)).take(10)).map((s) => ({ id: s._id, endpoint: s.endpoint })),
});

export const markResult = internalMutation({
  args: { id: v.id("pushSubscriptions"), ok: v.boolean(), gone: v.boolean() },
  handler: async (ctx, { id, ok, gone }) => {
    const s = await ctx.db.get(id);
    if (!s) return;
    if (gone || (!ok && s.failures >= 4)) await ctx.db.delete(id);
    else await ctx.db.patch(id, ok ? { failures: 0, lastOkAt: Date.now() } : { failures: s.failures + 1 });
  },
});

/**
 * The service worker's pull: messages this device hasn't shown yet (last 24h, newest 3).
 * Each device gets every message once, so a phone and a laptop both see it.
 */
export const pull = internalMutation({
  args: { endpoint: v.string() },
  handler: async (ctx, { endpoint }) => {
    const endpointHash = await sha256Hex(endpoint);
    const sub = await ctx.db.query("pushSubscriptions").withIndex("by_hash", (q) => q.eq("endpointHash", endpointHash)).first();
    if (!sub) return [];
    const rows = (
      await ctx.db
        .query("pushOutbox")
        .withIndex("by_user_created", (q) => q.eq("userId", sub.userId).gt("createdAt", Date.now() - 86_400_000))
        .order("desc")
        .take(50)
    ).filter((r) => !(r.deliveredTo ?? []).includes(sub._id) && !(r.deliveredAt && r.deliveredTo === undefined));
    const now = Date.now();
    for (const r of rows) await ctx.db.patch(r._id, { deliveredAt: r.deliveredAt ?? now, deliveredTo: [...(r.deliveredTo ?? []), sub._id].slice(-10) });
    // Unique tags: one notification never replaces another; same-kind ones still group.
    return rows.slice(0, 3).map((r) => ({ title: r.title, body: r.body, url: r.url, tag: `${r.tag ?? "climbos"}-${r._id}` }));
  },
});

/** Daily: drop push messages older than two days (each device pulls within 24h). */
export const cleanupOutbox = internalMutation({
  args: {},
  handler: async (ctx) => {
    const old = await ctx.db
      .query("pushOutbox")
      .withIndex("by_created", (q) => q.lt("createdAt", Date.now() - 2 * 86_400_000))
      .take(1000);
    for (const r of old) await ctx.db.delete(r._id);
    if (old.length === 1000) await ctx.scheduler.runAfter(0, internal.push.cleanupOutbox, {});
    return old.length;
  },
});
