import { v } from "convex/values";
import { CURRENT_ENTITLEMENTS, METER_LABELS, type MeterKey, PLAN_KEYS } from "../shared/economics";
import type { PlanKey } from "../shared/economics/assumptions";
import { grantForOrder, mapPolarSubscriptionStatus, shouldApplySnapshot, subscriptionAccess } from "../shared/billing";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { action, internalAction, internalMutation, internalQuery, query, type MutationCtx } from "./_generated/server";
import { audit } from "./lib/audit";
import { chargeableAccess, latestSubscription } from "./lib/access";
import { currentPeriod, grantSubscriptionPeriod } from "./lib/periods";
import { appError, requireOrgAccess } from "./lib/tenancy";

/**
 * Polar is the only payment processor for ClimbOS subscriptions and top-ups.
 * Access is granted ONLY from verified webhook events / authoritative Polar
 * state — never from the checkout success redirect. Every event is deduped by
 * its webhook id and processed idempotently (grants keyed by Polar order id).
 */

type ProductKey = PlanKey | "boost_29";
const PRODUCT_ENV: Record<ProductKey, string> = {
  basic: "POLAR_PRODUCT_BASIC",
  starter: "POLAR_PRODUCT_STARTER",
  growth: "POLAR_PRODUCT_GROWTH",
  pro: "POLAR_PRODUCT_PRO",
  business: "POLAR_PRODUCT_BUSINESS",
  boost_29: "POLAR_PRODUCT_BOOST_29",
};

export function productKeyForId(productId: string): ProductKey | null {
  for (const [key, env] of Object.entries(PRODUCT_ENV) as [ProductKey, string][]) {
    if (process.env[env] && process.env[env] === productId) return key;
  }
  return null;
}

function polarBase(): string {
  return process.env.POLAR_SERVER === "production" ? "https://api.polar.sh" : "https://sandbox-api.polar.sh";
}

export function polarConfigured(): boolean {
  return Boolean(process.env.POLAR_ACCESS_TOKEN && process.env.POLAR_WEBHOOK_SECRET);
}

async function polarFetch<T>(path: string, init: RequestInit = {}): Promise<{ ok: true; data: T } | { ok: false; status: number; message: string }> {
  const token = process.env.POLAR_ACCESS_TOKEN;
  if (!token) return { ok: false, status: 0, message: "Billing isn't configured yet." };
  const res = await fetch(`${polarBase()}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json", ...(init.headers ?? {}) },
  });
  const json = (await res.json().catch(() => null)) as T | null;
  if (!res.ok || json === null) return { ok: false, status: res.status, message: `Polar responded with ${res.status}` };
  return { ok: true, data: json };
}

/* ------------------------------------------------------------------ */
/* Read model for Settings → Billing                                    */
/* ------------------------------------------------------------------ */

export const overview = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org, role } = await requireOrgAccess(ctx, { slug }, "view");
    const sub = await latestSubscription(ctx, org._id);
    const period = await currentPeriod(ctx, org._id);
    const access = await chargeableAccess(ctx, org);
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .order("desc")
      .take(12);
    const topups = await ctx.db
      .query("creditPurchases")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .order("desc")
      .take(12);
    const meters = period
      ? (Object.keys(METER_LABELS) as MeterKey[])
          .filter((k) => period.meterCaps[k] > 0)
          .map((k) => ({ key: k, label: METER_LABELS[k], used: period.meterUsed[k], reserved: period.meterReserved[k], cap: period.meterCaps[k] }))
      : [];
    return {
      canManage: ["owner", "admin"].includes(role),
      isDemo: org.kind === "demo",
      billingConfigured: polarConfigured(),
      environment: process.env.POLAR_SERVER === "production" ? "production" : "sandbox",
      plans: PLAN_KEYS.map((k) => {
        const p = CURRENT_ENTITLEMENTS.plans[k];
        return {
          key: k,
          name: p.name,
          priceUsd: p.priceUsd,
          tagline: p.tagline,
          highlights: p.highlights,
          available: Boolean(process.env[PRODUCT_ENV[k]]),
          caps: { socialPosts: p.socialPosts, deliveredImages: p.deliveredImages, imageAttempts: p.imageAttempts, scrapeCredits: p.scrapeCredits, searchCalls: p.searchCalls, seats: p.seats, brands: p.brands, connections: p.connections, supportMinutes: p.supportMinutes },
        };
      }),
      topupProducts: CURRENT_ENTITLEMENTS.topups.map((t) => ({ key: t.key, name: t.name, priceUsd: t.priceUsd, description: t.description, available: Boolean(process.env[PRODUCT_ENV[t.key as ProductKey]]) })),
      subscription: sub
        ? {
            planKey: sub.planKey,
            status: sub.status,
            access: subscriptionAccess(sub, Date.now()),
            cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
            currentPeriodEnd: sub.currentPeriodEnd,
            entitlementVersionId: sub.entitlementVersionId,
          }
        : null,
      period: period
        ? {
            source: period.source,
            planKey: period.planKey ?? null,
            startsAt: period.startsAt,
            endsAt: period.endsAt,
            walletFraction: period.walletCapMicros > 0 ? (period.walletSpentMicros + period.walletReservedMicros) / period.walletCapMicros : 1,
            topupFraction: period.topupCapMicros > 0 ? (period.topupSpentMicros + period.topupReservedMicros) / period.topupCapMicros : null,
            meters,
          }
        : null,
      orders: orders.map((o) => ({ id: o._id, productKey: o.productKey, status: o.status, amountMinor: o.amountMinor, currency: o.currency, createdAt: o.createdAt, billingReason: o.billingReason })),
      topups: topups.map((t) => ({ id: t._id, status: t.status, createdAt: t.createdAt })),
      canRunAi: access.allowed,
      accessMessage: access.allowed ? null : access.message,
    };
  },
});

/* ------------------------------------------------------------------ */
/* Checkout and portal                                                  */
/* ------------------------------------------------------------------ */

export const recordCheckout = internalMutation({
  args: { orgId: v.id("organizations"), userId: v.id("users"), polarCheckoutId: v.string(), productKey: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.insert("checkoutSessions", { ...args, status: "open", createdAt: Date.now() });
    const existing = await ctx.db
      .query("polarCustomers")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .first();
    if (!existing) await ctx.db.insert("polarCustomers", { orgId: args.orgId, createdAt: Date.now() });
    await audit(ctx, { orgId: args.orgId, actorType: "user", actorId: args.userId, action: "billing.checkout_started", summary: `Checkout started for ${args.productKey}.` });
  },
});

export const createCheckout = action({
  args: { slug: v.string(), productKey: v.union(v.literal("basic"), v.literal("starter"), v.literal("growth"), v.literal("pro"), v.literal("business"), v.literal("boost_29")) },
  handler: async (ctx, { slug, productKey }): Promise<{ url: string }> => {
    const access = await ctx.runQuery(internal.access.orgAccessForAction, { slug, permission: "manage_billing" });
    if (!access) throw appError("NOT_FOUND", "We couldn't find that workspace.");
    if (access.kind === "demo") throw appError("FORBIDDEN", "Demo workspaces can't buy plans. Create your own workspace first.");
    const productId = process.env[PRODUCT_ENV[productKey]];
    if (!productId || !polarConfigured()) throw appError("UNAVAILABLE", "Billing isn't set up yet. Please try again soon.");
    if (productKey === "boost_29") {
      const state = await ctx.runQuery(internal.billing.subscriptionState, { orgId: access.orgId });
      if (state !== "full") throw appError("INVALID", "Extra capacity packs are for active plans. Choose a plan first.");
    }
    const site = process.env.SITE_URL ?? "http://localhost:3000";
    const res = await polarFetch<{ id: string; url: string }>("/v1/checkouts/", {
      method: "POST",
      body: JSON.stringify({
        products: [productId],
        // Binds the purchase to this workspace server-side (never trusted from the browser).
        external_customer_id: access.orgId,
        customer_email: access.email ?? undefined,
        metadata: { orgId: access.orgId, productKey, requestedBy: access.userId },
        success_url: `${site}/app/${slug}/settings/billing?checkout=returned&checkout_id={CHECKOUT_ID}`,
        return_url: `${site}/app/${slug}/settings/billing`,
      }),
    });
    if (!res.ok) throw appError("UNAVAILABLE", "We couldn't open checkout right now. Please try again in a minute.");
    await ctx.runMutation(internal.billing.recordCheckout, { orgId: access.orgId, userId: access.userId, polarCheckoutId: res.data.id, productKey });
    return { url: res.data.url };
  },
});

export const customerPortal = action({
  args: { slug: v.string() },
  handler: async (ctx, { slug }): Promise<{ url: string }> => {
    const access = await ctx.runQuery(internal.access.orgAccessForAction, { slug, permission: "manage_billing" });
    if (!access) throw appError("NOT_FOUND", "We couldn't find that workspace.");
    const res = await polarFetch<{ customer_portal_url: string }>("/v1/customer-sessions/", {
      method: "POST",
      body: JSON.stringify({ external_customer_id: access.orgId, return_url: `${process.env.SITE_URL ?? "http://localhost:3000"}/app/${slug}/settings/billing` }),
    });
    if (!res.ok) throw appError("UNAVAILABLE", "We couldn't open the billing portal. If you haven't subscribed yet, choose a plan first.");
    return { url: res.data.customer_portal_url };
  },
});

export const subscriptionState = internalQuery({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    const sub = await latestSubscription(ctx, orgId);
    return sub ? subscriptionAccess(sub, Date.now()) : "none";
  },
});

/* ------------------------------------------------------------------ */
/* Webhooks                                                             */
/* ------------------------------------------------------------------ */

/** Store a verified event once; duplicates are acknowledged and ignored. */
export const storeWebhookEvent = internalMutation({
  args: { source: v.union(v.literal("polar"), v.literal("resend")), eventId: v.string(), type: v.string(), payload: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("webhookEvents")
      .withIndex("by_source_event", (q) => q.eq("source", args.source).eq("eventId", args.eventId))
      .first();
    if (existing) return { duplicate: true as const, id: existing._id };
    const id = await ctx.db.insert("webhookEvents", { ...args, payload: args.payload.slice(0, 900_000), status: "received", attempts: 0, receivedAt: Date.now() });
    return { duplicate: false as const, id };
  },
});

export const getWebhookEvent = internalQuery({
  args: { id: v.id("webhookEvents") },
  handler: async (ctx, { id }) => ctx.db.get(id),
});

export const markWebhook = internalMutation({
  args: { id: v.id("webhookEvents"), status: v.union(v.literal("processed"), v.literal("ignored"), v.literal("failed")), error: v.optional(v.string()) },
  handler: async (ctx, { id, status, error }) => {
    const e = await ctx.db.get(id);
    if (!e) return;
    await ctx.db.patch(id, { status, error: error?.slice(0, 500), attempts: e.attempts + 1, processedAt: Date.now() });
  },
});

interface PolarSubscription {
  id: string;
  status: string;
  current_period_start: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  ended_at?: string | null;
  modified_at?: string | null;
  created_at: string;
  product_id: string;
  customer_id: string;
  customer?: { id: string; external_id?: string | null };
  metadata?: Record<string, unknown>;
}

interface PolarOrder {
  id: string;
  status: string;
  paid: boolean;
  billing_reason: string;
  product_id?: string;
  product?: { id: string };
  subscription_id?: string | null;
  customer_id: string;
  customer?: { id: string; external_id?: string | null };
  total_amount: number;
  tax_amount: number;
  refunded_amount: number;
  currency: string;
  created_at: string;
  modified_at?: string | null;
  metadata?: Record<string, unknown>;
}

const subValidator = v.object({
  id: v.string(),
  status: v.string(),
  currentPeriodStart: v.number(),
  currentPeriodEnd: v.number(),
  cancelAtPeriodEnd: v.boolean(),
  endedAt: v.optional(v.number()),
  modifiedAt: v.number(),
  productId: v.string(),
  customerId: v.string(),
  externalCustomerId: v.optional(v.string()),
});

function toSub(s: PolarSubscription) {
  return {
    id: s.id,
    status: s.status,
    currentPeriodStart: Date.parse(s.current_period_start),
    currentPeriodEnd: s.current_period_end ? Date.parse(s.current_period_end) : Date.parse(s.current_period_start) + 31 * 86_400_000,
    cancelAtPeriodEnd: Boolean(s.cancel_at_period_end),
    endedAt: s.ended_at ? Date.parse(s.ended_at) : undefined,
    modifiedAt: Date.parse(s.modified_at ?? s.created_at),
    productId: s.product_id,
    customerId: s.customer_id,
    externalCustomerId: s.customer?.external_id ?? undefined,
  };
}

/** Resolve and authorize the workspace a Polar customer belongs to. */
async function resolveOrg(ctx: MutationCtx, externalId: string | undefined, polarCustomerId: string): Promise<Id<"organizations"> | null> {
  if (!externalId) return null;
  const orgId = ctx.db.normalizeId("organizations", externalId);
  if (!orgId) return null;
  const org = await ctx.db.get(orgId);
  if (!org || org.kind === "demo") return null;
  const mapping = await ctx.db
    .query("polarCustomers")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .first();
  // A purchase binds only to a workspace that started a checkout from an authenticated session.
  if (!mapping) return null;
  if (mapping.polarCustomerId && mapping.polarCustomerId !== polarCustomerId) return null;
  if (!mapping.polarCustomerId) await ctx.db.patch(mapping._id, { polarCustomerId });
  return orgId;
}

async function applySubscription(ctx: MutationCtx, eventType: string, s: { id: string; status: string; currentPeriodStart: number; currentPeriodEnd: number; cancelAtPeriodEnd: boolean; endedAt?: number; modifiedAt: number; productId: string; customerId: string; externalCustomerId?: string }) {
  const orgId = await resolveOrg(ctx, s.externalCustomerId, s.customerId);
  if (!orgId) return { applied: false, reason: "unbound customer" };
  const planKey = productKeyForId(s.productId);
  if (!planKey || planKey === "boost_29") return { applied: false, reason: "unknown product" };
  const existing = await ctx.db
    .query("subscriptions")
    .withIndex("by_polar", (q) => q.eq("polarSubscriptionId", s.id))
    .first();
  if (existing && !shouldApplySnapshot(existing.sourceModifiedAt, s.modifiedAt) && eventType !== "subscription.revoked") {
    return { applied: false, reason: "stale event" };
  }
  const status = mapPolarSubscriptionStatus(eventType, s.status);
  const doc = {
    orgId,
    polarSubscriptionId: s.id,
    polarCustomerId: s.customerId,
    productId: s.productId,
    planKey,
    status,
    cancelAtPeriodEnd: s.cancelAtPeriodEnd,
    currentPeriodStart: s.currentPeriodStart,
    currentPeriodEnd: s.currentPeriodEnd,
    endedAt: s.endedAt,
    entitlementVersionId: existing?.entitlementVersionId ?? CURRENT_ENTITLEMENTS.id,
    rateVersionId: existing?.rateVersionId ?? CURRENT_ENTITLEMENTS.rateVersionId,
    sourceModifiedAt: Math.max(s.modifiedAt, existing?.sourceModifiedAt ?? 0),
    updatedAt: Date.now(),
  };
  if (existing) await ctx.db.patch(existing._id, doc);
  else await ctx.db.insert("subscriptions", doc);
  if (status === "revoked" || (status === "canceled" && !s.cancelAtPeriodEnd)) {
    // Revocation: stop the current period now (reading and export stay available).
    const period = await currentPeriod(ctx, orgId);
    if (period?.source === "subscription") await ctx.db.patch(period._id, { endsAt: Date.now(), updatedAt: Date.now() });
  }
  await audit(ctx, { orgId, actorType: "system", action: `billing.${eventType}`, summary: `Subscription ${planKey} is now ${status}${s.cancelAtPeriodEnd ? " (ends at period end)" : ""}.` });
  return { applied: true, orgId };
}

/** Process one stored event. Deterministic and idempotent; grants keyed by order id. */
export const applyPolarEvent = internalMutation({
  args: {
    webhookId: v.id("webhookEvents"),
    subscription: v.optional(subValidator),
  },
  handler: async (ctx, { webhookId, subscription }) => {
    const ev = await ctx.db.get(webhookId);
    if (!ev || ev.status === "processed") return { status: "skipped" };
    const payload = JSON.parse(ev.payload) as { type: string; data: Record<string, unknown> };
    const type = payload.type;
    const now = Date.now();
    const finish = async (status: "processed" | "ignored", error?: string) => {
      await ctx.db.patch(webhookId, { status, error, attempts: ev.attempts + 1, processedAt: now });
      return { status };
    };

    if (type.startsWith("subscription.")) {
      const res = await applySubscription(ctx, type, subscription ?? toSub(payload.data as unknown as PolarSubscription));
      return finish(res.applied ? "processed" : "ignored", res.applied ? undefined : res.reason);
    }

    if (type.startsWith("order.")) {
      const o = payload.data as unknown as PolarOrder;
      const orgId = await resolveOrg(ctx, o.customer?.external_id ?? undefined, o.customer_id);
      if (!orgId) return finish("ignored", "unbound customer");
      const productId = o.product_id ?? o.product?.id ?? "";
      const productKey = productKeyForId(productId);
      if (!productKey) return finish("ignored", "unknown product");
      let order = await ctx.db
        .query("orders")
        .withIndex("by_polar", (q) => q.eq("polarOrderId", o.id))
        .first();
      const orderStatus = (["pending", "paid", "refunded", "partially_refunded"].includes(o.status) ? o.status : "pending") as Doc<"orders">["status"];
      if (!order) {
        const id = await ctx.db.insert("orders", {
          orgId,
          polarOrderId: o.id,
          polarSubscriptionId: o.subscription_id ?? undefined,
          productId,
          productKey,
          billingReason: o.billing_reason,
          status: orderStatus,
          amountMinor: o.total_amount,
          taxMinor: o.tax_amount,
          currency: o.currency.toUpperCase(),
          refundedMinor: o.refunded_amount ?? 0,
          createdAt: Date.parse(o.created_at),
          updatedAt: now,
        });
        order = (await ctx.db.get(id))!;
      } else {
        await ctx.db.patch(order._id, { status: orderStatus, refundedMinor: o.refunded_amount ?? order.refundedMinor, updatedAt: now });
        order = (await ctx.db.get(order._id))!;
      }

      // Refunds: revoke unused top-up capacity; subscription access follows subscription state.
      if (type === "order.refunded" || orderStatus === "refunded") {
        if (productKey === "boost_29") {
          const credit = await ctx.db
            .query("creditPurchases")
            .withIndex("by_order", (q) => q.eq("polarOrderId", o.id))
            .first();
          if (credit && credit.status === "active") {
            await ctx.db.patch(credit._id, { status: "revoked" });
            const period = credit.periodId ? await ctx.db.get(credit.periodId) : null;
            if (period) {
              const remaining = Math.max(0, period.topupCapMicros - credit.deliveryCostMicros);
              await ctx.db.patch(period._id, { topupCapMicros: Math.max(remaining, period.topupSpentMicros + period.topupReservedMicros), updatedAt: now });
            }
          }
        }
        await audit(ctx, { orgId, actorType: "system", action: "billing.refund", summary: `Order for ${productKey} refunded.` });
        return finish("processed");
      }

      const grant = grantForOrder({
        eventType: type,
        orderStatus,
        paid: Boolean(o.paid) || orderStatus === "paid",
        billingReason: o.billing_reason,
        productKind: productKey === "boost_29" ? "topup" : "plan",
      });
      if (grant === "none" || order.grantedAt) return finish(order.grantedAt ? "processed" : "ignored", order.grantedAt ? undefined : "no grant for this event");

      if (grant === "topup") {
        const period = await currentPeriod(ctx, orgId);
        if (!period || period.source !== "subscription") return finish("ignored", "no active paid period for top-up");
        const pack = CURRENT_ENTITLEMENTS.topups.find((t) => t.key === "boost_29")!;
        await ctx.db.insert("creditPurchases", { orgId, polarOrderId: o.id, topupKey: pack.key, deliveryCostMicros: pack.deliveryCostMicros, periodId: period._id, status: "active", createdAt: now });
        await ctx.db.patch(period._id, { topupCapMicros: period.topupCapMicros + pack.deliveryCostMicros, updatedAt: now });
        await ctx.db.patch(order._id, { grantedAt: now });
        await audit(ctx, { orgId, actorType: "system", action: "billing.topup_granted", summary: "Extra capacity pack added for this period." });
        return finish("processed");
      }

      // Subscription period grant needs authoritative subscription state (fetched by the action).
      if (subscription) await applySubscription(ctx, "subscription.updated", subscription);
      const sub = o.subscription_id
        ? await ctx.db
            .query("subscriptions")
            .withIndex("by_polar", (q) => q.eq("polarSubscriptionId", o.subscription_id!))
            .first()
        : null;
      if (!sub) return finish("ignored", "subscription state unavailable; will reconcile");
      const planKey = productKey as PlanKey;
      await grantSubscriptionPeriod(ctx, {
        orgId,
        planKey,
        entitlementVersionId: sub.entitlementVersionId,
        periodStart: sub.currentPeriodStart,
        periodEnd: sub.currentPeriodEnd,
        polarOrderId: o.id,
        polarSubscriptionId: sub.polarSubscriptionId,
      });
      await ctx.db.patch(order._id, { grantedAt: now, periodStart: sub.currentPeriodStart, periodEnd: sub.currentPeriodEnd });
      await audit(ctx, { orgId, actorType: "system", action: "billing.period_granted", summary: `${CURRENT_ENTITLEMENTS.plans[planKey].name} allowance granted for the current period.` });
      return finish("processed");
    }

    if (type === "checkout.updated" || type === "checkout.created") {
      const data = payload.data as { id: string; status: string };
      const session = await ctx.db
        .query("checkoutSessions")
        .withIndex("by_polar", (q) => q.eq("polarCheckoutId", data.id))
        .first();
      if (session && (data.status === "succeeded" || data.status === "confirmed")) await ctx.db.patch(session._id, { status: "completed" });
      if (session && data.status === "expired") await ctx.db.patch(session._id, { status: "expired" });
      return finish("processed");
    }
    return finish("ignored", "event type not used");
  },
});

/** Async processor: fetches authoritative subscription state when an order needs it. */
export const processPolarEvent = internalAction({
  args: { webhookId: v.id("webhookEvents") },
  handler: async (ctx, { webhookId }) => {
    const ev = await ctx.runQuery(internal.billing.getWebhookEvent, { id: webhookId });
    if (!ev || ev.status === "processed") return;
    const payload = JSON.parse(ev.payload) as { type: string; data: Record<string, unknown> };
    let subscription: ReturnType<typeof toSub> | undefined;
    const subId =
      payload.type.startsWith("order.") ? (payload.data.subscription_id as string | null | undefined) : payload.type.startsWith("subscription.") ? (payload.data.id as string) : undefined;
    if (subId && polarConfigured()) {
      const res = await polarFetch<PolarSubscription>(`/v1/subscriptions/${encodeURIComponent(subId)}`);
      if (res.ok) subscription = toSub(res.data);
    }
    try {
      await ctx.runMutation(internal.billing.applyPolarEvent, { webhookId, subscription });
    } catch (e) {
      await ctx.runMutation(internal.billing.markWebhook, { id: webhookId, status: "failed", error: (e as Error).message });
    }
  },
});

/** Daily (and on demand): reconcile subscriptions with Polar's authoritative state. */
export const reconcileAll = internalAction({
  args: {},
  handler: async (ctx) => {
    if (!polarConfigured()) return { reconciled: 0 };
    const orgIds = await ctx.runQuery(internal.billing.billedOrgs, {});
    let reconciled = 0;
    for (const orgId of orgIds) {
      const res = await polarFetch<{ items: PolarSubscription[] }>(`/v1/subscriptions/?external_customer_id=${encodeURIComponent(orgId)}&limit=10`);
      if (!res.ok) continue;
      for (const s of res.data.items) {
        await ctx.runMutation(internal.billing.applyReconciledSubscription, { subscription: toSub(s) });
        reconciled++;
      }
    }
    return { reconciled };
  },
});

export const billedOrgs = internalQuery({
  args: {},
  handler: async (ctx) => (await ctx.db.query("polarCustomers").take(1000)).map((p) => p.orgId),
});

export const applyReconciledSubscription = internalMutation({
  args: { subscription: subValidator },
  handler: async (ctx, { subscription }) => {
    const type = subscription.status === "canceled" && !subscription.cancelAtPeriodEnd ? "subscription.revoked" : "subscription.updated";
    await applySubscription(ctx, type, subscription);
  },
});

export const retryFailedWebhooks = internalMutation({
  args: {},
  handler: async (ctx) => {
    const failed = await ctx.db
      .query("webhookEvents")
      .withIndex("by_status_received", (q) => q.eq("status", "failed").gt("receivedAt", Date.now() - 3 * 86_400_000))
      .take(50);
    for (const e of failed) {
      if (e.attempts >= 5 || e.source !== "polar") continue;
      await ctx.scheduler.runAfter(0, internal.billing.processPolarEvent, { webhookId: e._id });
    }
    return failed.length;
  },
});
