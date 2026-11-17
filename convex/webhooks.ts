import { fleetStopped } from "./lib/access";
import { audit } from "./lib/audit";
import { sha256Hex } from "../shared/policy";
import { eventMayTrigger, isSpecialistEvent } from "../shared/agents/specialistEvents";
import { v } from "convex/values";
import { isWebhookEvent, RETRY_MS, WEBHOOK_EVENTS, type WebhookEvent } from "../shared/webhooks";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction, internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import { safePublicUrl } from "../shared/net/safeUrl";
import { encryptSecret } from "./lib/crypto";
import { appError, assertSameOrg, requireOrgAccess } from "./lib/tenancy";

/**
 * Outgoing webhooks: each event is POSTed as JSON with an HMAC-SHA256
 * signature header, retried with backoff. Works with Zapier and Make
 * ("Catch Hook") or the owner's own server.
 */

const AAD = (orgId: string) => `climbos:${orgId}:webhook`;
const MAX_WEBHOOK_PAYLOAD_CHARS = 60_000;

/** Queue an event for every active endpoint of the workspace that wants it. */
export async function emitEvent(ctx: MutationCtx, orgId: Id<"organizations">, event: WebhookEvent, data: Record<string, unknown>) {
  await queueEventSpecialists(ctx, orgId, event);
  const endpoints = (await ctx.db.query("webhookEndpoints").withIndex("by_org", (q) => q.eq("orgId", orgId)).take(20)).filter((e) => e.active && e.events.includes(event));
  if (!endpoints.length) return;
  const now = Date.now();
  const payload = JSON.stringify({ event, createdAt: new Date(now).toISOString(), data });
  if (payload.length > MAX_WEBHOOK_PAYLOAD_CHARS) throw new Error(`Webhook event ${event} exceeded the ${MAX_WEBHOOK_PAYLOAD_CHARS}-character payload limit.`);
  for (const e of endpoints) await ctx.db.insert("webhookDeliveries", { orgId, endpointId: e._id, event, payload, status: "pending", attempts: 0, nextAt: now, createdAt: now });
  await ctx.scheduler.runAfter(0, internal.webhooks.deliverDue, {});
}

/**
 * Start event-triggered specialists for this workspace. The cooldown is claimed here so a burst of events starts
 * at most one run; the run itself goes through the scheduled path (draft-only, metered, pause-aware).
 */
async function queueEventSpecialists(ctx: MutationCtx, orgId: Id<"organizations">, event: WebhookEvent) {
  if (!isSpecialistEvent(event)) return;
  const org = await ctx.db.get(orgId);
  if (!org || org.deletedAt || org.kind === "demo" || org.scheduledSpecialistsEnabled === false || org.emergencyStop?.active) return;
  const now = Date.now();
  const agents = (await ctx.db.query("customAgents").withIndex("by_org_updated", (q) => q.eq("orgId", orgId)).take(30)).filter((agent) => eventMayTrigger(agent, event, now));
  for (const agent of agents.slice(0, 5)) {
    await ctx.db.patch(agent._id, { lastEventRunAt: now });
    await ctx.scheduler.runAfter(0, internal.workspace.runScheduledCustomAgent, { agentId: agent._id, triggerEvent: event });
  }
}

export const list = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "manage_connections");
    const eps = await ctx.db.query("webhookEndpoints").withIndex("by_org", (q) => q.eq("orgId", org._id)).take(20);
    const out = [];
    for (const e of eps) {
      const recent = await ctx.db.query("webhookDeliveries").withIndex("by_endpoint", (q) => q.eq("endpointId", e._id)).order("desc").take(5);
      out.push({ id: e._id, url: e.url, events: e.events, active: e.active, failures: e.failures, lastStatus: e.lastStatus ?? null, lastAt: e.lastAt ?? null, recent: recent.filter(d => d.orgId === org._id).map((d) => ({ id: d._id, event: d.event, status: d.status, code: d.responseCode ?? null, error: d.lastError ?? null, at: d.createdAt })) });
    }
    return { endpoints: out, events: Object.entries(WEBHOOK_EVENTS).map(([key, label]) => ({ key, label })) };
  },
});

export const create = mutation({
  args: { slug: v.string(), url: v.string(), events: v.array(v.string()) },
  handler: async (ctx, a) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: a.slug }, "manage_connections");
    const url = a.url.trim();
    if (url.length > 1000 || !publicHttpsUrl(url)) throw appError("INVALID", "Use a public https:// address.");
    const events = [...new Set(a.events.filter(isWebhookEvent))];
    if (!events.length) throw appError("INVALID", "Pick at least one event.");
    const count = (await ctx.db.query("webhookEndpoints").withIndex("by_org", (q) => q.eq("orgId", org._id)).take(11)).length;
    if (count >= 10) throw appError("LIMIT_REACHED", "Up to 10 webhooks per workspace.");
    const secret = `whsec_${Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, "0")).join("")}`;
    const sealed = await encryptSecret(secret, AAD(org._id));
    const id = await ctx.db.insert("webhookEndpoints", { orgId: org._id, url, events, secretCiphertext: sealed.ciphertext, secretIv: sealed.iv, secretKeyId: sealed.keyId, active: true, failures: 0, createdAt: Date.now() });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "webhook.created", subjectType: "webhook", subjectId: id, summary: `Configured ${events.length} event subscriptions for an exact destination. Signing secret omitted.` });
    // The secret is shown once, here.
    return { id, secret };
  },
});

export const setActive = mutation({
  args: { slug: v.string(), id: v.id("webhookEndpoints"), active: v.boolean() },
  handler: async (ctx, { slug, id, active }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "manage_connections");
    assertSameOrg(await ctx.db.get(id), org._id, "webhook");
    await ctx.db.patch(id, { active, ...(active ? { failures: 0 } : {}) });
    if (!active) await dropPending(ctx, id);
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "webhook.status_changed", subjectType: "webhook", subjectId: id, summary: active ? "Owner enabled this webhook." : "Owner disabled this webhook." });
  },
});

export const remove = mutation({
  args: { slug: v.string(), id: v.id("webhookEndpoints") },
  handler: async (ctx, { slug, id }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "manage_connections");
    assertSameOrg(await ctx.db.get(id), org._id, "webhook");
    for (const d of await ctx.db.query("webhookDeliveries").withIndex("by_endpoint", (q) => q.eq("endpointId", id)).take(500)) await ctx.db.delete(d._id);
    await ctx.db.delete(id);
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "webhook.removed", subjectType: "webhook", subjectId: id, summary: "Owner removed this destination." });
  },
});

/** Send a test event to one endpoint. */
export const test = mutation({
  args: { slug: v.string(), id: v.id("webhookEndpoints") },
  handler: async (ctx, { slug, id }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "manage_connections");
    const e = assertSameOrg(await ctx.db.get(id), org._id, "webhook");
    if (!e.active || org.emergencyStop?.active || org.suspendedAt !== undefined || await fleetStopped(ctx)) throw appError("INVALID", "Enable the destination and resume this workspace before sending a test.");
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "webhook.test_requested", subjectType: "webhook", subjectId: id, summary: "Owner requested a synthetic test event for this destination." });
    const now = Date.now();
    await ctx.db.insert("webhookDeliveries", { orgId: org._id, endpointId: e._id, event: "test", payload: JSON.stringify({ event: "test", createdAt: new Date(now).toISOString(), data: { workspace: org.name, message: "Hello from ClimbOS" } }), status: "pending", attempts: 0, nextAt: now, createdAt: now });
    await ctx.scheduler.runAfter(0, internal.webhooks.deliverDue, {});
  },
});

/** A public https URL with a real hostname (no private or IPv6-literal hosts, localhost or internal names). */
export function publicHttpsUrl(raw: string): boolean {
  const u = safePublicUrl(raw);
  return Boolean(u && u.protocol === "https:" && u.hostname.includes(".") && !u.hostname.startsWith("[") && !/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(u.hostname));
}

/** Pending rows of a switched-off endpoint are closed so they never clog the queue. */
async function dropPending(ctx: MutationCtx, endpointId: Id<"webhookEndpoints">) {
  const rows = await ctx.db.query("webhookDeliveries").withIndex("by_endpoint", (q) => q.eq("endpointId", endpointId)).order("desc").take(500);
  for (const d of rows) if (d.status === "pending" || d.status === "sending") await ctx.db.patch(d._id, { status: "failed", ...clearClaim, lastError: "Destination disabled. Future attempts canceled; earlier receipt may be unknown." });
}

/** Lease on a claimed delivery: if the deliverer dies, the row is due again after this. */
const CLAIM_MS = 2 * 60_000;

/** Invalid subscriptions and orphan/cross-tenant references never authorize a delivery. */
function endpointMatches(d: Doc<"webhookDeliveries">, e: Doc<"webhookEndpoints"> | null): e is Doc<"webhookEndpoints"> {
  return Boolean(e && e.orgId === d.orgId && e.active && publicHttpsUrl(e.url) && (d.event === "test" || (isWebhookEvent(d.event) && e.events.includes(d.event))));
}
const clearClaim = { claimToken: undefined, claimUrl: undefined, claimPayloadHash: undefined, dispatchStartedAt: undefined };

/** Bounded claims; every retry gets a different token and consumes an attempt even if its worker disappears. */
export const claimDue = internalMutation({
  args: {},
  handler: async (ctx) => {
    if (await fleetStopped(ctx)) return [];
    const now = Date.now();
    const rows = [
      ...(await ctx.db.query("webhookDeliveries").withIndex("by_status_next", q => q.eq("status", "pending").lte("nextAt", now)).take(25)),
      ...(await ctx.db.query("webhookDeliveries").withIndex("by_status_next", q => q.eq("status", "sending").lte("nextAt", now)).take(10)),
    ];
    const out = [];
    for (const d of rows) {
      const e = await ctx.db.get(d.endpointId), org = await ctx.db.get(d.orgId);
      if (!endpointMatches(d, e) || !org || org.deletedAt !== undefined) {
        await ctx.db.patch(d._id, { status: "failed", ...clearClaim, lastError: "The workspace or subscribed destination is unavailable." }); continue;
      }
      if (org.emergencyStop?.active || org.suspendedAt !== undefined) {
        await ctx.db.patch(d._id, { nextAt: now + 60_000, lastError: "Waiting while this workspace is paused or suspended." }); continue;
      }
      if (!Number.isSafeInteger(d.attempts) || d.attempts < 0 || d.attempts >= RETRY_MS.length + 1) {
        await ctx.db.patch(d._id, { status: "failed", ...clearClaim, lastError: "Delivery attempt limit reached; remote receipt may be unknown." }); continue;
      }
      if (d.status === "sending" && !d.claimToken) {
        await ctx.db.patch(d._id, { status: "failed", ...clearClaim, lastError: "Legacy attempt has no stable delivery identity. Check the destination; receipt is unknown. No automatic replay." }); continue;
      }
      let payload: string;
      try {
        const body = JSON.parse(d.payload);
        if (!body || typeof body !== "object" || Array.isArray(body) || body.event !== d.event || (body.deliveryId !== undefined && body.deliveryId !== String(d._id))) throw new Error("Invalid payload");
        if (d.attempts > 0 && body.deliveryId === undefined) {
          await ctx.db.patch(d._id, { status: "failed", ...clearClaim, lastError: "Earlier attempts lack a stable delivery identity. Check the destination; receipt is unknown. No automatic replay." }); continue;
        }
        payload = JSON.stringify({ ...body, deliveryId: String(d._id) });
        if (payload.length > MAX_WEBHOOK_PAYLOAD_CHARS + 200) throw new Error("Oversized payload");
      } catch { await ctx.db.patch(d._id, { status: "failed", ...clearClaim, lastError: "The saved event payload is invalid." }); continue; }
      const claimToken = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, "0")).join("");
      await ctx.db.patch(d._id, { status: "sending", nextAt: now + CLAIM_MS, attempts: d.attempts + 1, payload, claimToken, claimUrl: e.url, claimPayloadHash: await sha256Hex(payload), dispatchStartedAt: undefined, lastError: undefined });
      out.push({ id: d._id, claimToken, url: e.url });
    }
    return out;
  },
});

/** One dispatch per current lease, after DNS inspection and immediately before the external call. */
export const authorizeDispatch = internalMutation({
  args: { id: v.id("webhookDeliveries"), claimToken: v.string(), url: v.string() },
  handler: async (ctx, args) => {
    const d = await ctx.db.get(args.id);
    if (!d || d.status !== "sending" || d.claimToken !== args.claimToken || d.dispatchStartedAt !== undefined || d.nextAt <= Date.now()) return null;
    const e = await ctx.db.get(d.endpointId), org = await ctx.db.get(d.orgId);
    if (!endpointMatches(d, e) || !org || org.deletedAt !== undefined || d.claimUrl !== e.url || args.url !== e.url || d.claimPayloadHash !== await sha256Hex(d.payload)) {
      await ctx.db.patch(d._id, { status: "failed", ...clearClaim, lastError: "The event or destination changed before dispatch." }); return null;
    }
    if (org.emergencyStop?.active || org.suspendedAt !== undefined || await fleetStopped(ctx)) {
      await ctx.db.patch(d._id, { status: "pending", ...clearClaim, attempts: Math.max(0, d.attempts - 1), nextAt: Date.now() + 60_000, lastError: "Paused before dispatch; no request started." }); return null;
    }
    await ctx.db.patch(d._id, { dispatchStartedAt: Date.now() });
    await audit(ctx, { orgId: d.orgId, actorType: "system", action: "webhook.dispatch_started", subjectType: "webhook_delivery", subjectId: d._id, summary: `Authorized attempt ${d.attempts} for subscribed endpoint ${e._id}. Payload hash ${d.claimPayloadHash}. Remote receipt is not yet known.` });
    return { orgId: d.orgId, payload: d.payload, url: e.url, secret: { keyId: e.secretKeyId, iv: e.secretIv, ciphertext: e.secretCiphertext } };
  },
});

/** A late response cannot complete a newer attempt or increment endpoint failure counters. */
export const record = internalMutation({
  args: { id: v.id("webhookDeliveries"), claimToken: v.string(), code: v.optional(v.number()), ok: v.boolean(), error: v.optional(v.string()) },
  handler: async (ctx, { id, claimToken, code, ok, error }) => {
    const d = await ctx.db.get(id);
    if (!d || d.status !== "sending" || d.claimToken !== claimToken || (ok && d.dispatchStartedAt === undefined) || d.claimPayloadHash !== await sha256Hex(d.payload)) return;
    if (ok && (code === undefined || !Number.isInteger(code) || code < 200 || code >= 300)) return;
    const e = await ctx.db.get(d.endpointId);
    const attempts = d.attempts;
    const lastError = ok ? undefined : error?.slice(0, 200) || "The destination did not confirm receipt. It may have received the event.";
    if (ok) await ctx.db.patch(id, { status: "delivered", ...clearClaim, responseCode: code, lastError });
    else if (attempts > RETRY_MS.length) await ctx.db.patch(id, { status: "failed", ...clearClaim, responseCode: code, lastError });
    else await ctx.db.patch(id, { status: "pending", ...clearClaim, responseCode: code, lastError, nextAt: Date.now() + RETRY_MS[Math.max(0, attempts - 1)] });
    if (e?.orgId === d.orgId) {
      const failures = ok ? 0 : e.failures + 1;
      await ctx.db.patch(e._id, { failures, lastStatus: code, lastAt: Date.now(), ...(failures >= 20 ? { active: false } : {}) });
      if (failures >= 20 && e.active) await dropPending(ctx, e._id);
    }
    await audit(ctx, { orgId: d.orgId, actorType: "system", action: "webhook.delivery_result", subjectType: "webhook_delivery", subjectId: id, summary: `Attempt ${attempts}: ${ok ? "destination accepted" : "receipt not confirmed"}${code !== undefined ? ` (HTTP ${code})` : ""}. Receiver-side effects are not verified.` });
  },
});

/** Compatibility entry point for existing cron and queued jobs; network work runs in Node. */
export const deliverDue = internalAction({
  args: {},
  handler: async (ctx): Promise<number> => ctx.runAction(internal.webhookActions.deliverDue, {}),
});
