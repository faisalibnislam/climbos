import { v } from "convex/values";
import { can, canonicalJson, sha256Hex } from "../shared/policy";
import { progressScopeKey } from "../shared/growth/customerProgress";
import { PRODUCT_EVENT_LIMIT, PRODUCT_EVENT_MAX_AGE_MS, PRODUCT_EVENT_RETENTION_MS, PRODUCT_SOURCE_LIMIT, productEventInput, productEventName } from "../shared/growth/productTracking";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { httpAction, internalMutation, mutation, query, type QueryCtx } from "./_generated/server";
import { customerProgressStateV } from "./lib/customerProgress";
import { reconcileProgressJourneys } from "./lib/progressJourneys";
import { fleetStopped } from "./lib/access";
import { audit } from "./lib/audit";
import { appError, assertSameOrg, requireOrgAccess } from "./lib/tenancy";

const mappingV = v.object({ event: v.string(), state: customerProgressStateV, criterion: v.string() });
async function newCredential() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = `climb_events_${Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("")}`;
  return { token, tokenHash: await sha256Hex(token), prefix: token.slice(0, 20) };
}
export async function productSourceAvailable(ctx: QueryCtx, source: Doc<"productTrackingSources">, now: number) {
  if (source.revokedAt !== undefined || source.expiresAt <= now) return false;
  const org = await ctx.db.get(source.orgId);
  if (!org || org.deletedAt !== undefined || org.suspendedAt !== undefined || org.emergencyStop?.active || await fleetStopped(ctx)) return false;
  const member = await ctx.db.query("memberships").withIndex("by_org_user", q => q.eq("orgId", source.orgId).eq("userId", source.credentialOwnerId)).unique();
  return member?.status === "active" && can(member.role, "manage_connections");
}

export const list = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org, role } = await requireOrgAccess(ctx, { slug }, "view");
    const sources = await ctx.db.query("productTrackingSources").withIndex("by_org", q => q.eq("orgId", org._id)).take(PRODUCT_SOURCE_LIMIT + 1);
    const receipts = await ctx.db.query("productEvents").withIndex("by_org", q => q.eq("orgId", org._id)).order("desc").take(PRODUCT_EVENT_LIMIT + 1);
    return {
      canManage: can(role, "manage_connections"), endpoint: process.env.CONVEX_SITE_URL ? `${process.env.CONVEX_SITE_URL}/product-events` : null,
      sources: await Promise.all(sources.slice(0, PRODUCT_SOURCE_LIMIT).map(async s => ({ id: s._id, name: s.name, scope: s.scope, mappings: s.mappings, prefix: s.prefix, createdAt: s.createdAt, expiresAt: s.expiresAt, revoked: s.revokedAt !== undefined, receivingAllowed: await productSourceAvailable(ctx, s, Date.now()), lastReceivedAt: s.lastReceivedAt ?? null }))),
      canCreate: can(role, "manage_connections") && sources.length < PRODUCT_SOURCE_LIMIT,
      retainedReceipts: Math.min(receipts.length, PRODUCT_EVENT_LIMIT), receiptLimit: PRODUCT_EVENT_LIMIT,
      recent: receipts.slice(0, 10).map(r => ({ id: r._id, source: sources.find(s => s._id === r.sourceId)?.name ?? "Recorded source", event: r.event, occurredAt: r.occurredAt, receivedAt: r.receivedAt, outcome: r.outcome })),
    };
  },
});

/** Mappings are immutable. A changed meaning requires a new named source after revocation. */
export const create = mutation({
  args: { slug: v.string(), name: v.string(), scope: v.string(), mappings: v.array(mappingV) },
  handler: async (ctx, args) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: args.slug }, "manage_connections");
    const name = args.name.trim(), scope = args.scope.normalize("NFC").trim().replace(/\s+/g, " "), scopeKey = progressScopeKey(scope);
    const mappings = args.mappings.map(m => ({ ...m, event: m.event.trim(), criterion: m.criterion.trim() }));
    if (!name || name.length > 80 || !scope || scope.length > 80 || mappings.length < 1 || mappings.length > 8 || new Set(mappings.map(m => m.event)).size !== mappings.length || mappings.some(m => !productEventName.safeParse(m.event).success || !m.criterion || m.criterion.length > 300)) throw appError("INVALID", "Name the source and product, then define 1–8 unique events and what each means.");
    const sources = await ctx.db.query("productTrackingSources").withIndex("by_org", q => q.eq("orgId", org._id)).take(PRODUCT_SOURCE_LIMIT + 1);
    if (sources.length >= PRODUCT_SOURCE_LIMIT) throw appError("LIMIT_REACHED", "This workspace has reached its 20-source history limit.");
    if (sources.some(s => s.scopeKey === scopeKey && s.revokedAt === undefined)) throw appError("INVALID", "Revoke the previous source for this product before replacing its definitions.");
    const { token, ...credential } = await newCredential(), now = Date.now();
    const sourceId = await ctx.db.insert("productTrackingSources", { orgId: org._id, createdBy: user._id, credentialOwnerId: user._id, name, scope, scopeKey, mappings, ...credential, createdAt: now, expiresAt: now + 365 * 86_400_000 });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "product_tracking.created", subjectType: "productTrackingSource", subjectId: sourceId, summary: "Defined a server-only product event source. No consent or execution authorization granted." });
    return { sourceId, token };
  },
});
export const revoke = mutation({
  args: { slug: v.string(), sourceId: v.id("productTrackingSources") },
  handler: async (ctx, { slug, sourceId }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "manage_connections");
    const source = assertSameOrg(await ctx.db.get(sourceId), org._id, "product source");
    await ctx.db.patch(source._id, { revokedAt: Date.now() });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "product_tracking.revoked", subjectType: "productTrackingSource", subjectId: sourceId, summary: "Revoked product tracking credentials. Dated historical observations remain distinguishable." });
  },
});
export const rotate = mutation({
  args: { slug: v.string(), sourceId: v.id("productTrackingSources") },
  handler: async (ctx, { slug, sourceId }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "manage_connections");
    const source = assertSameOrg(await ctx.db.get(sourceId), org._id, "product source");
    if (source.revokedAt !== undefined) throw appError("INVALID", "A revoked source cannot restart. Create a new source.");
    const { token, ...credential } = await newCredential();
    await ctx.db.patch(source._id, { ...credential, credentialOwnerId: user._id, expiresAt: Date.now() + 365 * 86_400_000 });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "product_tracking.rotated", subjectType: "productTrackingSource", subjectId: sourceId, summary: "Replaced the product tracking key; its previous key no longer works." });
    return { token };
  },
});

/** One atomic authenticated observation transaction. No external calls, scheduling, consent writes or approvals. */
export const ingest = internalMutation({
  args: { tokenHash: v.string(), emailHash: v.string(), eventIdHash: v.string(), event: v.string(), occurredAt: v.number(), accountHash: v.optional(v.string()) },
  handler: async (ctx, a) => {
    const now = Date.now();
    const source = await ctx.db.query("productTrackingSources").withIndex("by_hash", q => q.eq("tokenHash", a.tokenHash)).unique();
    if (!source || !await productSourceAvailable(ctx, source, now)) return { status: 401, result: "unauthorized" };
    const minute = Math.floor(now / 60_000), count = source.rateMinute === minute ? source.rateCount ?? 0 : 0;
    if (count >= 120) return { status: 429, result: "rate_limited" };
    await ctx.db.patch(source._id, { rateMinute: minute, rateCount: count + 1 });
    if (![a.emailHash, a.eventIdHash, ...(a.accountHash ? [a.accountHash] : [])].every(h => /^[a-f0-9]{64}$/.test(h)) || !Number.isSafeInteger(a.occurredAt)) return { status: 400, result: "invalid_event" };
    const payloadHash = await sha256Hex(canonicalJson({ emailHash: a.emailHash, event: a.event, occurredAt: a.occurredAt, ...(a.accountHash ? { accountHash: a.accountHash } : {}) }));
    const prior = await ctx.db.query("productEvents").withIndex("by_source_event", q => q.eq("sourceId", source._id).eq("eventIdHash", a.eventIdHash)).unique();
    if (prior) return prior.payloadHash === payloadHash ? { status: 200, result: prior.outcome, duplicate: true } : { status: 409, result: "event_id_conflict" };
    const mapping = source.mappings.find(m => m.event === a.event);
    if (!mapping || a.occurredAt > now || a.occurredAt < now - PRODUCT_EVENT_MAX_AGE_MS) return { status: 400, result: "unmapped_or_outside_7_day_window" };
    const contacts = await ctx.db.query("contacts").withIndex("by_org_email", q => q.eq("orgId", source.orgId).eq("emailHash", a.emailHash)).take(2);
    const suppression = await ctx.db.query("suppressions").withIndex("by_org_email", q => q.eq("orgId", source.orgId).eq("emailHash", a.emailHash)).first();
    if (contacts.length !== 1 || contacts[0].deletedAt !== undefined || suppression?.reason === "deletion") return { status: 422, result: "contact_unavailable" };
    const receipts = await ctx.db.query("productEvents").withIndex("by_org", q => q.eq("orgId", source.orgId)).take(PRODUCT_EVENT_LIMIT);
    if (receipts.length >= PRODUCT_EVENT_LIMIT) return { status: 429, result: "workspace_receipt_limit" };
    const contact = contacts[0];
    const record = await ctx.db.query("contactProgress").withIndex("by_org_contact", q => q.eq("orgId", source.orgId).eq("contactId", contact._id)).unique();
    const previous = record?.progress ?? { current: [], history: [], revision: 0 };
    const existing = previous.current.find(r => progressScopeKey(r.scope) === source.scopeKey);
    if (!existing && previous.current.length >= 20) return { status: 409, result: "contact_scope_limit" };
    let outcome: "applied" | "owner_override" | "older" | "conflict" = "applied";
    if (existing && !existing.source) {
      if (existing.tracking?.sourceId !== source._id) outcome = "owner_override";
      else if (a.occurredAt <= existing.tracking.after) outcome = "older";
    }
    else if (existing?.source && existing.source.occurredAt > a.occurredAt) outcome = "older";
    else if (existing?.source && existing.source.occurredAt === a.occurredAt && (existing.source.conflict || existing.state !== mapping.state || existing.criterion !== mapping.criterion)) outcome = "conflict";
    if (outcome === "applied" || outcome === "conflict") {
      const revision = previous.revision + 1;
      const report = { scope: source.scope, state: outcome === "conflict" ? "unknown" as const : mapping.state, criterion: outcome === "conflict" ? "Resolve conflicting milestones at the same event time" : mapping.criterion, evidence: outcome === "conflict" ? `Source ${source.name} reported incompatible milestones at the same time. Current progress is unknown.` : `Authenticated source ${source.name} reported event ${a.event}. Its meaning is owner-defined; delivery is not independent verification.`, observedOn: new Date(a.occurredAt).toISOString().slice(0, 10), recordedAt: now, recordedBy: source.createdBy, revision, ...(existing?.tracking ? { tracking: existing.tracking } : {}), source: { id: source._id, name: source.name, event: a.event, occurredAt: a.occurredAt, ...(outcome === "conflict" ? { conflict: true } : {}) } };
      const progress = { current: [...previous.current.filter(r => progressScopeKey(r.scope) !== source.scopeKey), report], history: [...previous.history, report].slice(-20), revision };
      if (record) await ctx.db.patch(record._id, { progress });
      else await ctx.db.insert("contactProgress", { orgId: source.orgId, contactId: contact._id, progress });
      await reconcileProgressJourneys(ctx, source.orgId, contact._id, progress);
    }
    await ctx.db.insert("productEvents", { orgId: source.orgId, sourceId: source._id, contactId: contact._id, eventIdHash: a.eventIdHash, payloadHash, event: a.event, occurredAt: a.occurredAt, receivedAt: now, outcome, ...(a.accountHash ? { accountHash: a.accountHash } : {}) });
    await ctx.db.patch(source._id, { lastReceivedAt: now });
    return { status: 200, result: outcome, duplicate: false };
  },
});

/** Explicitly release a manual override; old/queued events must never resurrect the corrected state. */
export const useFutureEvents = mutation({
  args: { slug: v.string(), contactId: v.id("contacts"), sourceId: v.id("productTrackingSources"), expectedRevision: v.number() },
  handler: async (ctx, { slug, contactId, sourceId, expectedRevision }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "manage_connections");
    const contact = assertSameOrg(await ctx.db.get(contactId), org._id, "contact");
    const source = assertSameOrg(await ctx.db.get(sourceId), org._id, "product source");
    const now = Date.now();
    if (contact.deletedAt !== undefined || !await productSourceAvailable(ctx, source, now)) throw appError("INVALID", "This contact or product source is unavailable. Review the connection first.");
    const record = await ctx.db.query("contactProgress").withIndex("by_org_contact", q => q.eq("orgId", org._id).eq("contactId", contactId)).unique();
    if (!record || record.progress.revision !== expectedRevision) throw appError("INVALID", "Progress changed. Look up the contact again before choosing future events.");
    const previous = record.progress, existing = previous.current.find(r => progressScopeKey(r.scope) === source.scopeKey);
    if (!existing || existing.source || existing.tracking?.sourceId === sourceId) throw appError("INVALID", "Choose a current manual observation that is not already waiting for this source.");
    const revision = previous.revision + 1;
    const report = { scope: existing.scope, state: "unknown" as const, criterion: "Waiting for a new product milestone", evidence: `Owner chose future reports from ${source.name}. No newer event has been observed yet.`, observedOn: new Date(now).toISOString().slice(0, 10), recordedAt: now, recordedBy: user._id, revision, tracking: { sourceId, after: now } };
    const progress = { current: [...previous.current.filter(r => progressScopeKey(r.scope) !== source.scopeKey), report], history: [...previous.history, report].slice(-20), revision };
    await ctx.db.patch(record._id, { progress });
    await reconcileProgressJourneys(ctx, org._id, contactId, progress);
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "contact.future_events_selected", subjectType: "contact", subjectId: contactId, summary: `Owner selected future product events, revision ${revision}; progress remains unknown pending a newer event. No consent or send authorization.` });
    return progress;
  },
});

const headers = { "content-type": "application/json", "cache-control": "no-store" };
export const receive = httpAction(async (ctx, request) => {
  const respond = (status: number, result: string) => new Response(JSON.stringify({ result }), { status, headers });
  const token = request.headers.get("authorization")?.match(/^Bearer (climb_events_[a-f0-9]{64})$/)?.[1];
  if (!token) return respond(401, "unauthorized");
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return respond(415, "use_application_json");
  const reader = request.body?.getReader();
  if (!reader) return respond(400, "invalid_event");
  // Enforce the limit on the actual stream, including requests without Content-Length.
  let size = 0, body = ""; const decoder = new TextDecoder();
  try {
    while (true) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > 4096) { await reader.cancel(); return respond(413, "event_too_large"); } body += decoder.decode(value, { stream: true }); }
    body += decoder.decode();
    let raw: unknown;
    try { raw = JSON.parse(body); } catch { return respond(400, "invalid_event"); }
    const parsed = productEventInput.safeParse(raw);
    if (!parsed.success) return respond(400, "invalid_event");
    const e = parsed.data;
    const result = await ctx.runMutation(internal.productTracking.ingest, { tokenHash: await sha256Hex(token), emailHash: await sha256Hex(e.email), eventIdHash: await sha256Hex(e.eventId), event: e.event, occurredAt: Date.parse(e.occurredAt), ...(e.accountRef ? { accountHash: await sha256Hex(e.accountRef) } : {}) });
    return new Response(JSON.stringify({ result: result.result, ...(result.duplicate !== undefined ? { duplicate: result.duplicate } : {}) }), { status: result.status, headers: { ...headers, ...(result.status === 429 ? { "retry-after": "60" } : {}) } });
  } catch { return respond(503, "event_not_recorded_retry_same_id"); }
  finally { reader.releaseLock(); }
});

export const cleanup = internalMutation({
  args: {}, handler: async ctx => {
    const old = await ctx.db.query("productEvents").withIndex("by_received", q => q.lt("receivedAt", Date.now() - PRODUCT_EVENT_RETENTION_MS)).take(500);
    for (const r of old) await ctx.db.delete(r._id);
    if (old.length === 500) await ctx.scheduler.runAfter(1000, internal.productTracking.cleanup, {});
  },
});
