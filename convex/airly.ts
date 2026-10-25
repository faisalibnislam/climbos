import { v } from "convex/values";
import { AIRLY_APPS, isAirlyApp } from "../shared/airly";

import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, query, type MutationCtx } from "./_generated/server";
import { notifyOwners } from "./lib/notify";
import { requireOrgAccess } from "./lib/tenancy";
import { emitEvent } from "./webhooks";

/** Connected products import leads/bookings and export plans using encrypted owner tokens. */

const AAD = (orgId: string) => `climbos:${orgId}:airly`;
export { AAD as airlyAad };

export const overview = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const links = await ctx.db.query("airlyLinks").withIndex("by_org", (q) => q.eq("orgId", org._id)).take(10);
    return (Object.keys(AIRLY_APPS) as (keyof typeof AIRLY_APPS)[]).map((app) => {
      const l = links.find((x) => x.app === app);
      const meta = AIRLY_APPS[app];
      return { app, name: meta.name, what: meta.what, tokenHelp: meta.tokenHelp, needsBase: meta.base === null, link: l ? { id: l._id, label: l.label ?? null, status: l.status, error: l.error ?? null, lastSyncAt: l.lastSyncAt ?? null, imported: l.imported, settings: l.settings ? (JSON.parse(l.settings) as Record<string, string>) : {} } : null };
    });
  },
});

export const linkById = internalQuery({ args: { id: v.id("airlyLinks") }, handler: async (ctx, { id }): Promise<Doc<"airlyLinks"> | null> => ctx.db.get(id) });

export const linkFor = internalQuery({
  args: { orgId: v.id("organizations"), app: v.string() },
  handler: async (ctx, { orgId, app }) => (await ctx.db.query("airlyLinks").withIndex("by_org", (q) => q.eq("orgId", orgId)).take(10)).find((l) => l.app === app) ?? null,
});

export const saveLink = internalMutation({
  args: { orgId: v.id("organizations"), userId: v.id("users"), app: v.string(), sealed: v.object({ ciphertext: v.string(), iv: v.string(), keyId: v.string() }), label: v.optional(v.string()), settings: v.optional(v.string()) },
  handler: async (ctx, a) => {
    if (!isAirlyApp(a.app)) return;
    const existing = (await ctx.db.query("airlyLinks").withIndex("by_org", (q) => q.eq("orgId", a.orgId)).take(10)).find((l) => l.app === a.app);
    const fields = { tokenCiphertext: a.sealed.ciphertext, tokenIv: a.sealed.iv, tokenKeyId: a.sealed.keyId, label: a.label, settings: a.settings, status: "connected" as const, error: undefined, failures: 0, retryAt: undefined };
    if (existing) await ctx.db.patch(existing._id, fields);
    else await ctx.db.insert("airlyLinks", { orgId: a.orgId, app: a.app, ...fields, imported: 0, createdBy: a.userId, createdAt: Date.now() });
  },
});

export const setSettings = internalMutation({
  args: { id: v.id("airlyLinks"), settings: v.string() },
  handler: async (ctx, { id, settings }) => {
    await ctx.db.patch(id, { settings });
  },
});

/** Backoff after a transient failure: 15 min doubling, at most 12 hours. */
export function airlyBackoffMs(failures: number): number {
  return Math.min(12 * 3_600_000, 15 * 60_000 * 2 ** Math.max(0, failures - 1));
}

/**
 * Record a sync. A rejected token (fatal: 401/403) stops syncing until the owner reconnects;
 * anything else (timeouts, 5xx) keeps the link connected and retries with backoff.
 */
export const markSync = internalMutation({
  args: { id: v.id("airlyLinks"), cursor: v.optional(v.string()), error: v.optional(v.string()), fatal: v.optional(v.boolean()), added: v.optional(v.number()) },
  handler: async (ctx, { id, cursor, error, fatal, added }) => {
    const l = await ctx.db.get(id);
    if (!l) return;
    const now = Date.now();
    const base = { lastSyncAt: now, ...(cursor !== undefined ? { cursor } : {}), imported: l.imported + (added ?? 0) };
    if (!error) await ctx.db.patch(id, { ...base, status: "connected", error: undefined, failures: 0, retryAt: undefined });
    else if (fatal) await ctx.db.patch(id, { ...base, status: "error", error: error.slice(0, 200), retryAt: undefined });
    else {
      const failures = (l.failures ?? 0) + 1;
      await ctx.db.patch(id, { ...base, status: l.status, error: error.slice(0, 200), failures, retryAt: now + airlyBackoffMs(failures) });
    }
  },
});

export const removeLink = internalMutation({
  args: { orgId: v.id("organizations"), id: v.id("airlyLinks") },
  handler: async (ctx, { orgId, id }) => {
    const l = await ctx.db.get(id);
    if (l?.orgId === orgId) await ctx.db.delete(id);
  },
});

/** Every 15 minutes: pull from the inbound apps. */
export const syncTargets = internalQuery({
  args: {},
  handler: async (ctx) => {
    const out: { id: Id<"airlyLinks">; app: string }[] = [];
    const now = Date.now();
    // Small table: scan is fine (one row per workspace per app). Links in backoff wait their turn.
    for (const l of await ctx.db.query("airlyLinks").take(5000)) {
      if ((l.app === "formkit" || l.app === "meetrao") && l.status !== "error" && !(l.retryAt && l.retryAt > now)) out.push({ id: l._id, app: l.app });
    }
    return out;
  },
});

/* ---------------- inbound: leads and bookings ---------------- */

async function currencyOf(ctx: MutationCtx, orgId: Id<"organizations">) {
  return (await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", orgId)).first())?.currency ?? "USD";
}

export const importLeads = internalMutation({
  args: {
    linkId: v.id("airlyLinks"),
    items: v.array(v.object({ externalId: v.string(), name: v.string(), email: v.optional(v.string()), company: v.optional(v.string()), text: v.string(), subject: v.string(), at: v.number(), kind: v.union(v.literal("form"), v.literal("booking")), startAt: v.optional(v.number()) })),
  },
  handler: async (ctx, { linkId, items }): Promise<number> => {
    const link = await ctx.db.get(linkId);
    if (!link) return 0;
    const orgId = link.orgId;
    const currency = await currencyOf(ctx, orgId);
    let added = 0;
    for (const it of items.slice(0, 200)) {
      const externalId = `${link.app}:${it.externalId}`;
      if (await ctx.db.query("communityMessages").withIndex("by_org_external", (q) => q.eq("orgId", orgId).eq("externalId", externalId)).first()) continue;
      const now = Date.now();
      await ctx.db.insert("communityMessages", { orgId, channel: link.app, kind: it.kind, externalId, authorName: it.name.slice(0, 80) || it.email || "Someone", fromEmail: it.email, subject: it.subject.slice(0, 200), text: it.text.slice(0, 2000), receivedAt: it.at, status: "new", createdAt: now, updatedAt: now });
      if (it.email || it.name) {
        await ctx.db.insert("deals", { orgId, name: it.name.slice(0, 120) || it.email!, company: it.company, email: it.email, stage: it.kind === "booking" ? "booked" : "lead", source: "inbox", currency, notes: [{ text: `From ${link.app === "formkit" ? "Formkit" : "Meetrao"}: ${it.subject}`, at: now }], ...(it.startAt ? { nextStep: "Call", nextStepAt: it.startAt } : {}), createdAt: now, updatedAt: now });
        await emitEvent(ctx, orgId, it.kind === "booking" ? "booking.created" : "lead.created", { name: it.name, email: it.email ?? null, source: link.app, subject: it.subject });
      }
      added++;
    }
    if (added) await notifyOwners(ctx, orgId, `${added} new ${link.app === "formkit" ? "form response" : "booking"}${added === 1 ? "" : "s"} from ${link.app === "formkit" ? "Formkit" : "Meetrao"}.`, "inbox");
    return added;
  },
});

/* ---------------- outbound: what to send ---------------- */

export const planForExport = internalQuery({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    const s = await ctx.db.query("strategies").withIndex("by_org", (q) => q.eq("orgId", orgId)).order("desc").first();
    const org = await ctx.db.get(orgId);
    if (!s || !org) return null;
    return { org: { name: org.name, slug: org.slug }, strategy: s as Doc<"strategies"> };
  },
});

