import { v } from "convex/values";
import { getLiveConfig } from "./lib/config";
import { rewardReferral } from "./referrals";
import { CREDIT_TOPUPS, creditsToMicros, CURRENT_ENTITLEMENTS, packageOf, salePlanKeys, TOPUP_VALID_DAYS, type TopupKey } from "../shared/economics";
import type { PlanKey } from "../shared/economics/assumptions";
import { grantForOrder, mapPolarSubscriptionStatus, shouldApplySnapshot, subscriptionAccess } from "../shared/billing";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { action, internalAction, internalMutation, internalQuery, query, type MutationCtx } from "./_generated/server";
import { audit } from "./lib/audit";
import { chargeableAccess, latestSubscription } from "./lib/access";
import { currentPeriod, grantSubscriptionPeriod } from "./lib/periods";
import { creditBalance } from "./lib/credits";
import { appError, requireOrgAccess } from "./lib/tenancy";

/**
 * Polar is the only payment processor for ClimbOS subscriptions and top-ups.
 * Access is granted ONLY from verified webhook events / authoritative Polar
 * state — never from the checkout success redirect. Every event is deduped by
 * its webhook id and processed idempotently (grants keyed by Polar order id).
 */

type ProductKey = PlanKey | "boost_29" | TopupKey;
const PRODUCT_ENV: Record<ProductKey, string> = {
  starter: "POLAR_PRODUCT_STARTER",
  pro: "POLAR_PRODUCT_PRO",
  credits_10: "POLAR_PRODUCT_CREDITS_10",
  credits_25: "POLAR_PRODUCT_CREDITS_25",
  credits_50: "POLAR_PRODUCT_CREDITS_50",
  // Retired products (kept so old orders and subscriptions still resolve).
  basic: "POLAR_PRODUCT_BASIC",
  growth: "POLAR_PRODUCT_GROWTH",
  business: "POLAR_PRODUCT_BUSINESS",
  boost_29: "POLAR_PRODUCT_BOOST_29",
};
const isTopupKey = (k: string): k is TopupKey => k.startsWith("credits_");

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
  let res: Response;
  try {
    res = await fetch(`${polarBase()}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json", ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    // Network errors and timeouts are a failed call, never an uncaught throw (callers mark the event for retry).
    return { ok: false, status: 0, message: "Couldn't reach Polar." };
  }
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
    const { org, role, user } = await requireOrgAccess(ctx, { slug }, "view");
    const sub = await latestSubscription(ctx, org);
    const period = await currentPeriod(ctx, org);
    const access = await chargeableAccess(ctx, org);
    const orders = org.accountId
      ? await ctx.db
          .query("orders")
          .withIndex("by_account", (q) => q.eq("accountId", org.accountId))
          .order("desc")
          .take(12)
      : [];
    const paid = Boolean(sub && subscriptionAccess(sub, Date.now()) === "full");
    const account = org.accountId ? await ctx.db.get(org.accountId) : null;
    const config = await getLiveConfig(ctx);
    return {
      // Packages, top-ups and the Polar portal are account-level: only the account owner manages them.
      canManage: ["owner", "admin"].includes(role) && Boolean(account && account.ownerUserId === user._id),
      isDemo: org.kind === "demo",
      billingConfigured: polarConfigured(),
      environment: process.env.POLAR_SERVER === "production" ? "production" : "sandbox",
      packages: salePlanKeys().map((k) => {
        const p = CURRENT_ENTITLEMENTS.plans[k];
        const pk = packageOf(k);
        return { key: k, name: p.name, priceUsd: p.priceUsd, credits: config.packageCredits[pk], tagline: p.tagline, seats: config.seats[pk], available: Boolean(process.env[PRODUCT_ENV[k]]) };
      }),
      topups: CREDIT_TOPUPS.map((t) => ({ key: t.key, priceUsd: t.priceUsd, credits: config.topupCredits[t.key], available: Boolean(process.env[PRODUCT_ENV[t.key]]) && paid })),
      freeCredits: config.freeCredits,
      paid,
      subscription: sub
        ? {
            planKey: sub.planKey,
            name: CURRENT_ENTITLEMENTS.plans[sub.planKey].name,
            status: sub.status,
            access: subscriptionAccess(sub, Date.now()),
            cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
            currentPeriodEnd: sub.currentPeriodEnd,
            comp: Boolean(sub.comp),
          }
        : null,
      balance: await creditBalance(ctx, org, period),
      isAccountOwner: Boolean(account && account.ownerUserId === user._id),
      orders: orders.map((o) => ({ id: o._id, productKey: o.productKey, status: o.status, amountMinor: o.amountMinor, currency: o.currency, createdAt: o.createdAt, billingReason: o.billingReason })),
      canRunAi: access.allowed,
      accessMessage: access.allowed ? null : access.message,
    };
  },
});

/* ------------------------------------------------------------------ */
/* Checkout and portal                                                  */
/* ------------------------------------------------------------------ */

export const recordCheckout = internalMutation({
  args: { orgId: v.id("organizations"), accountId: v.id("accounts"), userId: v.id("users"), polarCheckoutId: v.string(), productKey: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.insert("checkoutSessions", { orgId: args.orgId, userId: args.userId, polarCheckoutId: args.polarCheckoutId, productKey: args.productKey, status: "open", createdAt: Date.now() });
    const existing = await ctx.db
      .query("polarCustomers")
      .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
      .first();
    if (!existing) await ctx.db.insert("polarCustomers", { orgId: args.orgId, accountId: args.accountId, createdAt: Date.now() });
    await audit(ctx, { orgId: args.orgId, actorType: "user", actorId: args.userId, action: "billing.checkout_started", summary: `Checkout started for ${args.productKey}.` });
  },
});

/** Who is asking, for billing actions: workspace access plus account ownership and the account's package. */
export const billingActor = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "manage_billing");
    const account = org.accountId ? await ctx.db.get(org.accountId) : null;
    const sub = await latestSubscription(ctx, org);
    const mapping = org.accountId
      ? await ctx.db
          .query("polarCustomers")
          .withIndex("by_account", (q) => q.eq("accountId", org.accountId))
          .first()
      : null;
    return {
      orgId: org._id,
      kind: org.kind,
      userId: user._id,
      email: user.email ?? null,
      accountId: org.accountId ?? null,
      isAccountOwner: Boolean(account && account.ownerUserId === user._id),
      polarCustomerId: mapping?.polarCustomerId ?? null,
      subscription: sub ? { polarSubscriptionId: sub.polarSubscriptionId, planKey: sub.planKey, access: subscriptionAccess(sub, Date.now()), comp: Boolean(sub.comp) } : null,
    };
  },
});

type BillingActor = {
  orgId: Id<"organizations">;
  kind: Doc<"organizations">["kind"];
  userId: Id<"users">;
  email: string | null;
  accountId: Id<"accounts"> | null;
  isAccountOwner: boolean;
  polarCustomerId: string | null;
  subscription: { polarSubscriptionId: string; planKey: PlanKey; access: ReturnType<typeof subscriptionAccess>; comp: boolean } | null;
};

/** Billing is account-level: an agency client's admin can't buy or change the agency's package. */
function ownerAccount(actor: BillingActor): Id<"accounts"> {
  if (actor.kind === "demo") throw appError("FORBIDDEN", "Demo workspaces can't buy packages. Create your own workspace first.");
  if (!actor.accountId) throw appError("INVALID", "This workspace has no billing account yet.");
  if (!actor.isAccountOwner) throw appError("FORBIDDEN", "Only the account owner can manage billing.");
  return actor.accountId;
}

export const createCheckout = action({
  args: { slug: v.string(), productKey: v.union(v.literal("starter"), v.literal("pro"), v.literal("credits_10"), v.literal("credits_25"), v.literal("credits_50")) },
  handler: async (ctx, { slug, productKey }): Promise<{ url: string }> => {
    const actor: BillingActor = await ctx.runQuery(internal.billing.billingActor, { slug });
    const accountId = ownerAccount(actor);
    const productId = process.env[PRODUCT_ENV[productKey]];
    if (!productId || !polarConfigured()) throw appError("UNAVAILABLE", "Billing isn't set up yet. Please try again soon.");
    const state = actor.subscription?.access ?? "none";
    if (isTopupKey(productKey)) {
      if (state !== "full") throw appError("INVALID", "Top-ups add to a monthly package. Choose a package first.");
    } else if (state === "full" || state === "grace_read_only" || state === "pending") {
      // A second checkout would start a second subscription (double charge). Switching goes through changePlan.
      throw appError("INVALID", "You already have a package. Use Switch to change it.", { reason: "has_subscription" });
    }
    const site = process.env.SITE_URL ?? "http://localhost:3000";
    const res = await polarFetch<{ id: string; url: string }>("/v1/checkouts/", {
      method: "POST",
      body: JSON.stringify({
        products: [productId],
        // Binds the purchase to this account server-side (never trusted from the browser).
        external_customer_id: accountId,
        customer_email: actor.email ?? undefined,
        metadata: { accountId, orgId: actor.orgId, productKey, requestedBy: actor.userId },
        success_url: `${site}/app/${slug}/settings/billing?checkout=returned&checkout_id={CHECKOUT_ID}`,
        return_url: `${site}/app/${slug}/settings/billing`,
      }),
    });
    if (!res.ok) throw appError("UNAVAILABLE", "We couldn't open checkout right now. Please try again in a minute.");
    await ctx.runMutation(internal.billing.recordCheckout, { orgId: actor.orgId, accountId, userId: actor.userId, polarCheckoutId: res.data.id, productKey });
    return { url: res.data.url };
  },
});

/** Switch the account's existing Polar subscription to another package (never a second subscription; Polar prorates). */
export const changePlan = action({
  args: { slug: v.string(), planKey: v.union(v.literal("starter"), v.literal("pro")) },
  handler: async (ctx, { slug, planKey }): Promise<{ ok: true }> => {
    const actor: BillingActor = await ctx.runQuery(internal.billing.billingActor, { slug });
    ownerAccount(actor);
    const sub = actor.subscription;
    if (!sub || sub.access !== "full") throw appError("INVALID", "Choose a package first.");
    if (sub.comp) throw appError("INVALID", "Your package was given by ClimbOS. Contact support to change it.");
    if (sub.planKey === planKey) return { ok: true };
    const productId = process.env[PRODUCT_ENV[planKey]];
    if (!productId || !polarConfigured()) throw appError("UNAVAILABLE", "Billing isn't set up yet. Please try again soon.");
    const res = await polarFetch<PolarSubscription>(`/v1/subscriptions/${encodeURIComponent(sub.polarSubscriptionId)}`, {
      method: "PATCH",
      body: JSON.stringify({ product_id: productId, proration_behavior: "prorate" }),
    });
    if (!res.ok) throw appError("UNAVAILABLE", "We couldn't change your package right now. Please try again in a minute.");
    // Polar's answer is authoritative; the paid order webhook grants the new month's credits.
    await ctx.runMutation(internal.billing.applyReconciledSubscription, { subscription: toSub(res.data) });
    await ctx.runMutation(internal.billing.auditPlanChange, { orgId: actor.orgId, userId: actor.userId, planKey });
    return { ok: true };
  },
});

/** The account's last workspace was deleted: end the Polar package at the end of the period (retried if Polar is down). */
export const cancelAtPeriodEnd = internalAction({
  args: { polarSubscriptionId: v.string(), attempt: v.optional(v.number()) },
  handler: async (ctx, { polarSubscriptionId, attempt = 0 }) => {
    if (!polarConfigured() || polarSubscriptionId.startsWith("comp:")) return { ok: false };
    const res = await polarFetch<PolarSubscription>(`/v1/subscriptions/${encodeURIComponent(polarSubscriptionId)}`, { method: "PATCH", body: JSON.stringify({ cancel_at_period_end: true }) });
    if (res.ok) {
      await ctx.runMutation(internal.billing.applyReconciledSubscription, { subscription: toSub(res.data) });
      return { ok: true };
    }
    if (attempt < 5) await ctx.scheduler.runAfter(3_600_000 * (attempt + 1), internal.billing.cancelAtPeriodEnd, { polarSubscriptionId, attempt: attempt + 1 });
    return { ok: false };
  },
});

export const auditPlanChange = internalMutation({
  args: { orgId: v.id("organizations"), userId: v.id("users"), planKey: v.string() },
  handler: async (ctx, { orgId, userId, planKey }) => {
    await audit(ctx, { orgId, actorType: "user", actorId: userId, action: "billing.plan_change_requested", summary: `Package switch to ${planKey} requested.` });
  },
});

export const customerPortal = action({
  args: { slug: v.string() },
  handler: async (ctx, { slug }): Promise<{ url: string }> => {
    const actor: BillingActor = await ctx.runQuery(internal.billing.billingActor, { slug });
    const accountId = ownerAccount(actor);
    const res = await polarFetch<{ customer_portal_url: string }>("/v1/customer-sessions/", {
      method: "POST",
      body: JSON.stringify({
        ...(actor.polarCustomerId ? { customer_id: actor.polarCustomerId } : { external_customer_id: accountId }),
        return_url: `${process.env.SITE_URL ?? "http://localhost:3000"}/app/${slug}/settings/billing`,
      }),
    });
    if (!res.ok) throw appError("UNAVAILABLE", "We couldn't open the billing portal. If you haven't subscribed yet, choose a plan first.");
    return { url: res.data.customer_portal_url };
  },
});

export const subscriptionState = internalQuery({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    const org = await ctx.db.get(orgId);
    const sub = org ? await latestSubscription(ctx, org) : null;
    return sub ? subscriptionAccess(sub, Date.now()) : "none";
  },
});

export const accountOf = internalQuery({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => (await ctx.db.get(orgId))?.accountId ?? null,
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

/**
 * Resolve and authorize the account (and a workspace of it) a Polar customer
 * belongs to. New checkouts bind the account id; older ones bound a workspace id.
 */
async function resolveBilling(ctx: MutationCtx, externalId: string | undefined, polarCustomerId: string): Promise<{ orgId: Id<"organizations">; accountId?: Id<"accounts"> } | null> {
  if (!externalId) return null;
  let accountId = ctx.db.normalizeId("accounts", externalId) ?? undefined;
  let orgId: Id<"organizations"> | null = null;
  if (accountId) {
    const orgs = (await ctx.db.query("organizations").withIndex("by_account", (q) => q.eq("accountId", accountId)).take(50)).filter((o) => !o.deletedAt && o.kind !== "demo");
    orgId = orgs[0]?._id ?? null;
  } else {
    orgId = ctx.db.normalizeId("organizations", externalId);
    const org = orgId ? await ctx.db.get(orgId) : null;
    if (!org || org.kind === "demo") return null;
    accountId = org.accountId;
  }
  if (!orgId) return null;
  const mapping = accountId
    ? await ctx.db
        .query("polarCustomers")
        .withIndex("by_account", (q) => q.eq("accountId", accountId))
        .first()
    : await ctx.db
        .query("polarCustomers")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .first();
  // A purchase binds only to an account that started a checkout from an authenticated session.
  if (!mapping) return null;
  if (mapping.polarCustomerId && mapping.polarCustomerId !== polarCustomerId) return null;
  if (!mapping.polarCustomerId) await ctx.db.patch(mapping._id, { polarCustomerId });
  return { orgId, accountId };
}

async function applySubscription(ctx: MutationCtx, eventType: string, s: { id: string; status: string; currentPeriodStart: number; currentPeriodEnd: number; cancelAtPeriodEnd: boolean; endedAt?: number; modifiedAt: number; productId: string; customerId: string; externalCustomerId?: string }) {
  const scope = await resolveBilling(ctx, s.externalCustomerId, s.customerId);
  if (!scope) return { applied: false, reason: "unbound customer" };
  const { orgId, accountId } = scope;
  const productKey = productKeyForId(s.productId);
  if (!productKey || productKey === "boost_29" || isTopupKey(productKey)) return { applied: false, reason: "unknown product" };
  const planKey: PlanKey = productKey;
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
    ...(accountId ? { accountId } : {}),
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
    const period = await currentPeriod(ctx, { _id: orgId, accountId });
    if (period?.source === "subscription") await ctx.db.patch(period._id, { endsAt: Date.now(), updatedAt: Date.now() });
  }
  await audit(ctx, { orgId, actorType: "system", action: `billing.${eventType}`, summary: `Subscription ${planKey} is now ${status}${s.cancelAtPeriodEnd ? " (ends at period end)" : ""}.` });
  return { applied: true, orgId, accountId };
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
    const finish = async (status: "processed" | "ignored" | "failed", error?: string) => {
      await ctx.db.patch(webhookId, { status, error, attempts: ev.attempts + 1, processedAt: now });
      return { status };
    };

    if (type.startsWith("subscription.")) {
      const res = await applySubscription(ctx, type, subscription ?? toSub(payload.data as unknown as PolarSubscription));
      return finish(res.applied ? "processed" : "ignored", res.applied ? undefined : res.reason);
    }

    if (type.startsWith("order.")) {
      const o = payload.data as unknown as PolarOrder;
      const scope = await resolveBilling(ctx, o.customer?.external_id ?? undefined, o.customer_id);
      if (!scope) return finish("ignored", "unbound customer");
      const { orgId, accountId } = scope;
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
          ...(accountId ? { accountId } : {}),
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
        if (productKey === "boost_29" || isTopupKey(productKey)) {
          const credit = await ctx.db
            .query("creditPurchases")
            .withIndex("by_order", (q) => q.eq("polarOrderId", o.id))
            .first();
          if (credit && credit.status === "active") {
            // Unused top-up credits are removed; what was already spent stays spent.
            await ctx.db.patch(credit._id, { status: "revoked", remainingMicros: 0 });
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
        productKind: productKey === "boost_29" || isTopupKey(productKey) ? "topup" : "plan",
      });
      if (grant === "none" || order.grantedAt) return finish(order.grantedAt ? "processed" : "ignored", order.grantedAt ? undefined : "no grant for this event");

      if (grant === "topup") {
        const pack = CREDIT_TOPUPS.find((t) => t.key === productKey);
        if (!pack || !accountId) return finish("ignored", "unknown top-up or no account");
        // Top-up credits belong to the account and last 12 months (paid for, so granted even if the package lapsed).
        const credits = (await getLiveConfig(ctx)).topupCredits[pack.key];
        const micros = creditsToMicros(credits);
        await ctx.db.insert("creditPurchases", { orgId, accountId, polarOrderId: o.id, topupKey: pack.key, deliveryCostMicros: micros, creditsMicros: micros, remainingMicros: micros, expiresAt: now + TOPUP_VALID_DAYS * 86_400_000, status: "active", createdAt: now });
        await ctx.db.patch(order._id, { grantedAt: now });
        await audit(ctx, { orgId, actorType: "system", action: "billing.topup_granted", summary: `${credits.toLocaleString("en-US")} credits added (valid 12 months).` });
        return finish("processed");
      }

      if (isTopupKey(productKey) || productKey === "boost_29") return finish("ignored", "not a package");
      // Subscription period grant needs fresh, authoritative subscription state (fetched by the action).
      // Without it we'd grant the stored (possibly previous) period's dates, so fail and retry instead.
      if (!subscription || !o.subscription_id || subscription.id !== o.subscription_id) return finish("failed", "subscription state unavailable; will retry");
      await applySubscription(ctx, "subscription.updated", subscription);
      const sub = await ctx.db
        .query("subscriptions")
        .withIndex("by_polar", (q) => q.eq("polarSubscriptionId", o.subscription_id!))
        .first();
      if (!sub) return finish("ignored", "subscription not bound to an account");
      const planKey: PlanKey = productKey;
      await grantSubscriptionPeriod(ctx, {
        orgId,
        accountId,
        planKey,
        entitlementVersionId: sub.entitlementVersionId,
        periodStart: sub.currentPeriodStart,
        periodEnd: sub.currentPeriodEnd,
        polarOrderId: o.id,
        polarSubscriptionId: sub.polarSubscriptionId,
      });
      await ctx.db.patch(order._id, { grantedAt: now, periodStart: sub.currentPeriodStart, periodEnd: sub.currentPeriodEnd });
      // Referral reward on the account's first paid package (both sides, once).
      if (accountId) await rewardReferral(ctx, accountId);
      await audit(ctx, { orgId, actorType: "system", action: "billing.period_granted", summary: `${CURRENT_ENTITLEMENTS.plans[planKey].name}: ${(CURRENT_ENTITLEMENTS.plans[planKey].credits ?? 0).toLocaleString("en-US")} credits for this month.` });
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
    // Any throw here (network, bad payload) marks the event failed so the retry cron picks it up;
    // Polar's own redelivery is deduped by webhook id, so we must never leave an event "received".
    try {
      const ev = await ctx.runQuery(internal.billing.getWebhookEvent, { id: webhookId });
      if (!ev || ev.status === "processed") return;
      const payload = JSON.parse(ev.payload) as { type: string; data: Record<string, unknown> };
      let subscription: ReturnType<typeof toSub> | undefined;
      const isOrder = payload.type.startsWith("order.");
      const subId = isOrder ? (payload.data.subscription_id as string | null | undefined) : payload.type.startsWith("subscription.") ? (payload.data.id as string) : undefined;
      if (subId) {
        const res = polarConfigured() ? await polarFetch<PolarSubscription>(`/v1/subscriptions/${encodeURIComponent(subId)}`) : null;
        if (res?.ok) subscription = toSub(res.data);
        else if (isOrder) {
          // A package order can't be granted without fresh period dates: retry later.
          await ctx.runMutation(internal.billing.markWebhook, { id: webhookId, status: "failed", error: `subscription fetch failed: ${res ? res.message : "billing not configured"}` });
          return;
        }
      }
      await ctx.runMutation(internal.billing.applyPolarEvent, { webhookId, subscription });
    } catch (e) {
      await ctx.runMutation(internal.billing.markWebhook, { id: webhookId, status: "failed", error: (e as Error).message });
    }
  },
});

/** Daily (and on demand): reconcile subscriptions with Polar's authoritative state, by the customer each checkout bound. */
export const reconcileAll = internalAction({
  args: {},
  handler: async (ctx) => {
    if (!polarConfigured()) return { reconciled: 0 };
    const customers = await ctx.runQuery(internal.billing.billedCustomers, {});
    let reconciled = 0;
    for (const c of customers) {
      // Polar's customer id when we know it; otherwise the external id the checkout bound (account id; older ones a workspace id).
      const filter = c.polarCustomerId ? `customer_id=${encodeURIComponent(c.polarCustomerId)}` : `external_customer_id=${encodeURIComponent(c.accountId ?? c.orgId)}`;
      const res = await polarFetch<{ items: PolarSubscription[] }>(`/v1/subscriptions/?${filter}&limit=10`);
      if (!res.ok) continue;
      for (const s of res.data.items) {
        await ctx.runMutation(internal.billing.applyReconciledSubscription, { subscription: toSub(s) });
        reconciled++;
      }
    }
    return { reconciled };
  },
});

export const billedCustomers = internalQuery({
  args: {},
  handler: async (ctx) =>
    (await ctx.db.query("polarCustomers").take(2000)).map((p) => ({ orgId: p.orgId, accountId: p.accountId ?? null, polarCustomerId: p.polarCustomerId ?? null })),
});

export const applyReconciledSubscription = internalMutation({
  args: { subscription: subValidator },
  handler: async (ctx, { subscription }) => {
    const type = subscription.status === "canceled" && !subscription.cancelAtPeriodEnd ? "subscription.revoked" : "subscription.updated";
    await applySubscription(ctx, type, subscription);
    await grantMissingPeriod(ctx, subscription.id);
  },
});

/**
 * Reconciliation safety net: a paid package order whose grant never happened (for
 * example its webhook ran out of retries) gets the subscription's current period.
 * Idempotent: periods are keyed by subscription + period start and never summed.
 */
async function grantMissingPeriod(ctx: MutationCtx, polarSubscriptionId: string) {
  const sub = await ctx.db
    .query("subscriptions")
    .withIndex("by_polar", (q) => q.eq("polarSubscriptionId", polarSubscriptionId))
    .first();
  if (!sub || sub.comp || subscriptionAccess(sub, Date.now()) !== "full") return;
  const orders = await ctx.db
    .query("orders")
    .withIndex("by_subscription", (q) => q.eq("polarSubscriptionId", polarSubscriptionId))
    .take(50);
  const ungranted = orders.filter((o) => o.status === "paid" && !o.grantedAt && !isTopupKey(o.productKey) && o.productKey !== "boost_29").sort((a, b) => b.createdAt - a.createdAt);
  if (!ungranted.length) return;
  const now = Date.now();
  await grantSubscriptionPeriod(ctx, {
    orgId: sub.orgId,
    accountId: sub.accountId,
    planKey: sub.planKey,
    entitlementVersionId: sub.entitlementVersionId,
    periodStart: sub.currentPeriodStart,
    periodEnd: sub.currentPeriodEnd,
    polarOrderId: ungranted[0].polarOrderId,
    polarSubscriptionId,
  });
  for (const o of ungranted) await ctx.db.patch(o._id, { grantedAt: now, periodStart: sub.currentPeriodStart, periodEnd: sub.currentPeriodEnd });
  await audit(ctx, { orgId: sub.orgId, actorType: "system", action: "billing.period_reconciled", summary: `${CURRENT_ENTITLEMENTS.plans[sub.planKey].name}: this month's credits granted by reconciliation.` });
}

/** Every 15 minutes: retry failed events and events stuck in "received" (the processor died), bounded attempts. */
export const retryFailedWebhooks = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const failed = await ctx.db
      .query("webhookEvents")
      .withIndex("by_status_received", (q) => q.eq("status", "failed").gt("receivedAt", now - 3 * 86_400_000))
      .take(50);
    const stale = await ctx.db
      .query("webhookEvents")
      .withIndex("by_status_received", (q) => q.eq("status", "received").gt("receivedAt", now - 3 * 86_400_000).lt("receivedAt", now - 10 * 60_000))
      .take(50);
    let scheduled = 0;
    for (const e of [...failed, ...stale]) {
      if (e.attempts >= 5) continue;
      if (e.source === "polar") await ctx.scheduler.runAfter(0, internal.billing.processPolarEvent, { webhookId: e._id });
      else if (e.source === "resend") await ctx.scheduler.runAfter(0, internal.notifications.reprocessResendEvent, { webhookId: e._id });
      else continue;
      scheduled++;
    }
    return scheduled;
  },
});
