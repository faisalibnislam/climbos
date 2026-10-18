import { v } from "convex/values";
import { isWebhookEvent, RETRY_MS, signWebhook, WEBHOOK_EVENTS, type WebhookEvent } from "../shared/webhooks";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery, mutation, query, type MutationCtx } from "./_generated/server";
import { decryptSecret, encryptSecret } from "./lib/crypto";
import { appError, assertSameOrg, requireOrgAccess } from "./lib/tenancy";

/**
 * Outgoing webhooks: each event is POSTed as JSON with an HMAC-SHA256
 * signature header, retried with backoff. Works with Zapier and Make
 * ("Catch Hook") or the owner's own server.
 */

const AAD = (orgId: string) => `climbos:${orgId}:webhook`;

/** Queue an event for every active endpoint of the workspace that wants it. */
export async function emitEvent(ctx: MutationCtx, orgId: Id<"organizations">, event: WebhookEvent, data: Record<string, unknown>) {
  const endpoints = (await ctx.db.query("webhookEndpoints").withIndex("by_org", (q) => q.eq("orgId", orgId)).take(20)).filter((e) => e.active && e.events.includes(event));
  if (!endpoints.length) return;
  const now = Date.now();
  const payload = JSON.stringify({ event, createdAt: new Date(now).toISOString(), data });
  for (const e of endpoints) await ctx.db.insert("webhookDeliveries", { orgId, endpointId: e._id, event, payload: payload.slice(0, 20_000), status: "pending", attempts: 0, nextAt: now, createdAt: now });
  await ctx.scheduler.runAfter(0, internal.webhooks.deliverDue, {});
}

export const list = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "manage_connections");
    const eps = await ctx.db.query("webhookEndpoints").withIndex("by_org", (q) => q.eq("orgId", org._id)).take(20);
    const out = [];
    for (const e of eps) {
      const recent = await ctx.db.query("webhookDeliveries").withIndex("by_endpoint", (q) => q.eq("endpointId", e._id)).order("desc").take(5);
      out.push({ id: e._id, url: e.url, events: e.events, active: e.active, failures: e.failures, lastStatus: e.lastStatus ?? null, lastAt: e.lastAt ?? null, recent: recent.map((d) => ({ id: d._id, event: d.event, status: d.status, code: d.responseCode ?? null, at: d.createdAt })) });
    }
    return { endpoints: out, events: Object.entries(WEBHOOK_EVENTS).map(([key, label]) => ({ key, label })) };
  },
});

export const create = mutation({
  args: { slug: v.string(), url: v.string(), events: v.array(v.string()) },
  handler: async (ctx, a) => {
    const { org } = await requireOrgAccess(ctx, { slug: a.slug }, "manage_connections");
    const url = a.url.trim();
    if (!/^https:\/\/[^\s/]+\.[^\s]+$/i.test(url) || /localhost|127\.0\.0\.1|\.local\b|\.internal\b/i.test(url)) throw appError("INVALID", "Use a public https:// address.");
    const events = [...new Set(a.events.filter(isWebhookEvent))];
    if (!events.length) throw appError("INVALID", "Pick at least one event.");
    const count = (await ctx.db.query("webhookEndpoints").withIndex("by_org", (q) => q.eq("orgId", org._id)).take(11)).length;
    if (count >= 10) throw appError("LIMIT_REACHED", "Up to 10 webhooks per workspace.");
    const secret = `whsec_${Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, "0")).join("")}`;
    const sealed = await encryptSecret(secret, AAD(org._id));
    const id = await ctx.db.insert("webhookEndpoints", { orgId: org._id, url: url.slice(0, 1000), events, secretCiphertext: sealed.ciphertext, secretIv: sealed.iv, secretKeyId: sealed.keyId, active: true, failures: 0, createdAt: Date.now() });
    // The secret is shown once, here.
    return { id, secret };
  },
});

export const setActive = mutation({
  args: { slug: v.string(), id: v.id("webhookEndpoints"), active: v.boolean() },
  handler: async (ctx, { slug, id, active }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "manage_connections");
    assertSameOrg(await ctx.db.get(id), org._id, "webhook");
    await ctx.db.patch(id, { active, ...(active ? { failures: 0 } : {}) });
  },
});

export const remove = mutation({
  args: { slug: v.string(), id: v.id("webhookEndpoints") },
  handler: async (ctx, { slug, id }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "manage_connections");
    assertSameOrg(await ctx.db.get(id), org._id, "webhook");
    for (const d of await ctx.db.query("webhookDeliveries").withIndex("by_endpoint", (q) => q.eq("endpointId", id)).take(500)) await ctx.db.delete(d._id);
    await ctx.db.delete(id);
  },
});

/** Send a test event to one endpoint. */
export const test = mutation({
  args: { slug: v.string(), id: v.id("webhookEndpoints") },
  handler: async (ctx, { slug, id }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "manage_connections");
    const e = assertSameOrg(await ctx.db.get(id), org._id, "webhook");
    const now = Date.now();
    await ctx.db.insert("webhookDeliveries", { orgId: org._id, endpointId: e._id, event: "test", payload: JSON.stringify({ event: "test", createdAt: new Date(now).toISOString(), data: { workspace: org.name, message: "Hello from ClimbOS" } }), status: "pending", attempts: 0, nextAt: now, createdAt: now });
    await ctx.scheduler.runAfter(0, internal.webhooks.deliverDue, {});
  },
});

export const due = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("webhookDeliveries").withIndex("by_status_next", (q) => q.eq("status", "pending").lte("nextAt", Date.now())).take(50);
    const out = [];
    for (const d of rows) {
      const e = await ctx.db.get(d.endpointId);
      if (!e || !e.active) continue;
      out.push({ id: d._id, orgId: d.orgId, url: e.url, payload: d.payload, secret: { keyId: e.secretKeyId, iv: e.secretIv, ciphertext: e.secretCiphertext } });
    }
    return out;
  },
});

export const record = internalMutation({
  args: { id: v.id("webhookDeliveries"), code: v.optional(v.number()), ok: v.boolean() },
  handler: async (ctx, { id, code, ok }) => {
    const d = await ctx.db.get(id);
    if (!d) return;
    const e = await ctx.db.get(d.endpointId);
    const attempts = d.attempts + 1;
    if (ok) await ctx.db.patch(id, { status: "delivered", attempts, responseCode: code });
    else if (attempts > RETRY_MS.length) await ctx.db.patch(id, { status: "failed", attempts, responseCode: code });
    else await ctx.db.patch(id, { attempts, responseCode: code, nextAt: Date.now() + RETRY_MS[attempts - 1] });
    if (e) {
      const failures = ok ? 0 : e.failures + 1;
      // 20 failures in a row: switch it off and keep the owner informed in the Activity log.
      await ctx.db.patch(e._id, { failures, lastStatus: code, lastAt: Date.now(), ...(failures >= 20 ? { active: false } : {}) });
    }
  },
});

/** Deliver what's due (also runs every minute from a cron). */
export const deliverDue = internalAction({
  args: {},
  handler: async (ctx) => {
    let n = 0;
    for (const d of await ctx.runQuery(internal.webhooks.due, {})) {
      let code: number | undefined;
      let ok = false;
      try {
        if (process.env.CLIMBOS_FAKE_WEBHOOKS) {
          code = 200;
          ok = true;
        } else {
          const secret = await decryptSecret(d.secret, AAD(d.orgId));
          const ts = Math.floor(Date.now() / 1000);
          const res = await fetch(d.url, { method: "POST", headers: { "Content-Type": "application/json", "User-Agent": "ClimbOS-Webhooks/1.0", "X-ClimbOS-Timestamp": String(ts), "X-ClimbOS-Signature": `v1=${await signWebhook(secret, ts, d.payload)}` }, body: d.payload, signal: AbortSignal.timeout(10_000), redirect: "manual" });
          code = res.status;
          ok = res.status >= 200 && res.status < 300;
        }
      } catch {
        ok = false;
      }
      await ctx.runMutation(internal.webhooks.record, { id: d.id, code, ok });
      n++;
    }
    return n;
  },
});
