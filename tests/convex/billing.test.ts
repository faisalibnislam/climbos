import { describe, expect, it } from "vitest";
import { signStandardWebhook, webhookKeyCandidates } from "../../shared/billing";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { asNewUser, setup, type T } from "./helpers";

const DAY = 86_400_000;

async function paidWorkspace(t: T) {
  const owner = await asNewUser(t, "owner@example.com");
  const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Paid Co" });
  // Authenticated checkout created the customer mapping (server-side binding).
  await t.mutation(internal.billing.recordCheckout, { orgId, userId: owner.userId, polarCheckoutId: "chk_1", productKey: "growth" });
  return { owner, slug, orgId };
}

function subPayload(orgId: string, overrides: Record<string, unknown> = {}) {
  const start = Date.UTC(2026, 9, 1);
  return {
    id: "sub_1",
    status: "active",
    current_period_start: new Date(start).toISOString(),
    current_period_end: new Date(start + 31 * DAY).toISOString(),
    cancel_at_period_end: false,
    ended_at: null,
    created_at: new Date(start).toISOString(),
    modified_at: new Date(start + 1000).toISOString(),
    product_id: "prod_growth",
    customer_id: "cus_1",
    customer: { id: "cus_1", external_id: orgId },
    ...overrides,
  };
}

function orderPayload(orgId: string, overrides: Record<string, unknown> = {}) {
  return {
    id: "ord_1",
    status: "paid",
    paid: true,
    billing_reason: "subscription_create",
    product_id: "prod_growth",
    subscription_id: "sub_1",
    customer_id: "cus_1",
    customer: { id: "cus_1", external_id: orgId },
    total_amount: 49390,
    tax_amount: 4490,
    refunded_amount: 0,
    currency: "usd",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

async function deliver(t: T, eventId: string, type: string, data: unknown, subscription?: ReturnType<typeof subSnapshot>) {
  const stored = await t.mutation(internal.billing.storeWebhookEvent, { source: "polar", eventId, type, payload: JSON.stringify({ type, data }) });
  if (stored.duplicate) return { duplicate: true };
  const res = await t.mutation(internal.billing.applyPolarEvent, { webhookId: stored.id, subscription });
  return { duplicate: false, ...res };
}

function subSnapshot(orgId: string, overrides: Partial<{ status: string; cancelAtPeriodEnd: boolean; modifiedAt: number; currentPeriodStart: number; currentPeriodEnd: number; productId: string; endedAt: number }> = {}) {
  const start = Date.UTC(2026, 9, 1);
  return {
    id: "sub_1",
    status: "active",
    currentPeriodStart: start,
    currentPeriodEnd: Date.now() + 20 * DAY,
    cancelAtPeriodEnd: false,
    modifiedAt: start + 1000,
    productId: "prod_growth",
    customerId: "cus_1",
    externalCustomerId: orgId,
    ...overrides,
  };
}

async function periods(t: T, orgId: Id<"organizations">) {
  return t.run(async (ctx) => ctx.db.query("usagePeriods").withIndex("by_org_period", (q) => q.eq("orgId", orgId)).collect());
}

describe("Polar billing lifecycle", () => {
  it("grants the paid period once; duplicate and replayed events never double-grant", async () => {
    const t = setup();
    const { orgId } = await paidWorkspace(t);
    const snap = subSnapshot(orgId);
    await deliver(t, "evt_sub_created", "subscription.created", subPayload(orgId));
    // Active subscription but no paid order yet: no paid allowance.
    expect((await periods(t, orgId)).filter((p) => p.source === "subscription")).toHaveLength(0);

    const first = await deliver(t, "evt_order_paid", "order.paid", orderPayload(orgId), snap);
    expect(first).toMatchObject({ status: "processed" });
    const dup = await deliver(t, "evt_order_paid", "order.paid", orderPayload(orgId), snap);
    expect(dup.duplicate).toBe(true);
    // Same order delivered under a different webhook id (provider replay) must not double-grant.
    await deliver(t, "evt_order_paid_replay", "order.paid", orderPayload(orgId), snap);
    const subPeriods = (await periods(t, orgId)).filter((p) => p.source === "subscription");
    expect(subPeriods).toHaveLength(1);
    expect(subPeriods[0].walletCapMicros).toBe(58_000_000);
    expect(subPeriods[0].meterCaps.socialPosts).toBe(120);
    const access = await t.run(async (ctx) => {
      const { chargeableAccess } = await import("../../convex/lib/access");
      return chargeableAccess(ctx, (await ctx.db.get(orgId))!);
    });
    expect(access.allowed).toBe(true);
  });

  it("ignores stale out-of-order subscription events and never grants on subscription.cycled alone", async () => {
    const t = setup();
    const { orgId } = await paidWorkspace(t);
    const later = Date.UTC(2026, 9, 1) + 5000;
    await deliver(t, "e1", "subscription.updated", subPayload(orgId, { modified_at: new Date(later).toISOString(), cancel_at_period_end: true, status: "active" }));
    // Older snapshot arrives late: must not undo the cancellation flag.
    await deliver(t, "e0", "subscription.updated", subPayload(orgId, { modified_at: new Date(later - 4000).toISOString(), cancel_at_period_end: false }));
    const sub = await t.run(async (ctx) => ctx.db.query("subscriptions").withIndex("by_polar", (q) => q.eq("polarSubscriptionId", "sub_1")).first());
    expect(sub?.cancelAtPeriodEnd).toBe(true);
    await deliver(t, "e2", "subscription.cycled", subPayload(orgId, { modified_at: new Date(later + 1000).toISOString() }));
    expect((await periods(t, orgId)).filter((p) => p.source === "subscription")).toHaveLength(0);
  });

  it("unpaid renewal blocks new chargeable work but keeps read access; a paid renewal grants the new period exactly once", async () => {
    const t = setup();
    const { orgId, owner, slug } = await paidWorkspace(t);
    await deliver(t, "o1", "order.paid", orderPayload(orgId), subSnapshot(orgId));
    // Payment fails at renewal.
    await deliver(t, "pd", "subscription.past_due", subPayload(orgId, { status: "past_due", modified_at: new Date(Date.now()).toISOString() }));
    await expect(owner.client.mutation(api.workspace.sendChat, { slug, text: "make posts" })).rejects.toThrow(/couldn't take your last payment/);
    await expect(owner.client.query(api.workspace.today, { slug })).resolves.toBeTruthy();
    // Recovery: paid renewal order for the next cycle.
    const nextStart = Date.now() - DAY;
    const renewed = subSnapshot(orgId, { status: "active", currentPeriodStart: nextStart, currentPeriodEnd: nextStart + 31 * DAY, modifiedAt: Date.now() + 1 });
    await deliver(t, "o2", "order.paid", orderPayload(orgId, { id: "ord_2", billing_reason: "subscription_cycle" }), renewed);
    await deliver(t, "o2-replay", "order.paid", orderPayload(orgId, { id: "ord_2", billing_reason: "subscription_cycle" }), renewed);
    const subPeriods = (await periods(t, orgId)).filter((p) => p.source === "subscription");
    expect(subPeriods).toHaveLength(2);
    await expect(owner.client.mutation(api.workspace.sendChat, { slug, text: "make posts" })).resolves.toBeTruthy();
  });

  it("cancel at period end keeps access until the end; revocation stops new paid work immediately", async () => {
    const t = setup();
    const { orgId, owner, slug } = await paidWorkspace(t);
    await deliver(t, "o1", "order.paid", orderPayload(orgId), subSnapshot(orgId));
    await deliver(t, "c1", "subscription.canceled", subPayload(orgId, { status: "canceled", cancel_at_period_end: true, current_period_end: new Date(Date.now() + 10 * DAY).toISOString(), modified_at: new Date(Date.now()).toISOString() }));
    await expect(owner.client.mutation(api.workspace.sendChat, { slug, text: "still allowed" })).resolves.toBeTruthy();
    await deliver(t, "r1", "subscription.revoked", subPayload(orgId, { status: "canceled", cancel_at_period_end: false, modified_at: new Date(Date.now() + 5).toISOString() }));
    await expect(owner.client.mutation(api.workspace.sendChat, { slug, text: "not allowed" })).rejects.toThrow(/plan has ended/);
    // Revocation never re-opens the free onboarding allowance.
    await expect(owner.client.mutation(api.workspace.sendChat, { slug, text: "still not" })).rejects.toThrow(/plan has ended/);
  });

  it("upgrades raise caps once; top-ups grant once and refunds revoke unused capacity", async () => {
    const t = setup();
    const { orgId } = await paidWorkspace(t);
    await deliver(t, "o1", "order.paid", orderPayload(orgId), subSnapshot(orgId));
    const upgraded = subSnapshot(orgId, { productId: "prod_pro", modifiedAt: Date.now() + 10 });
    await deliver(t, "up", "order.paid", orderPayload(orgId, { id: "ord_up", billing_reason: "subscription_update", product_id: "prod_pro" }), upgraded);
    let p = (await periods(t, orgId)).filter((x) => x.source === "subscription");
    expect(p).toHaveLength(1);
    expect(p[0].walletCapMicros).toBe(145_000_000);
    expect(p[0].meterCaps.socialPosts).toBe(300);

    await deliver(t, "tu", "order.paid", orderPayload(orgId, { id: "ord_topup", billing_reason: "purchase", product_id: "prod_boost", subscription_id: null }));
    await deliver(t, "tu2", "order.paid", orderPayload(orgId, { id: "ord_topup", billing_reason: "purchase", product_id: "prod_boost", subscription_id: null }));
    p = (await periods(t, orgId)).filter((x) => x.source === "subscription");
    expect(p[0].topupCapMicros).toBe(10_000_000);
    await deliver(t, "rf", "order.refunded", orderPayload(orgId, { id: "ord_topup", status: "refunded", billing_reason: "purchase", product_id: "prod_boost", subscription_id: null, refunded_amount: 2900 }));
    p = (await periods(t, orgId)).filter((x) => x.source === "subscription");
    expect(p[0].topupCapMicros).toBe(0);
  });

  it("refuses to bind purchases to a workspace that never started an authenticated checkout", async () => {
    const t = setup();
    const owner = await asNewUser(t, "o@example.com");
    const { orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "No Checkout" });
    const res = await deliver(t, "x1", "order.paid", orderPayload(orgId), subSnapshot(orgId));
    expect(res).toMatchObject({ status: "ignored" });
    expect((await periods(t, orgId)).filter((p) => p.source === "subscription")).toHaveLength(0);
  });

  it("the webhook endpoint rejects forged signatures and accepts valid ones once", async () => {
    const t = setup();
    const { orgId } = await paidWorkspace(t);
    const body = JSON.stringify({ type: "subscription.created", data: subPayload(orgId) });
    const ts = Math.floor(Date.now() / 1000);
    const forged = await signStandardWebhook(new TextEncoder().encode("wrong"), "wh_1", ts, body);
    const bad = await t.fetch("/webhooks/polar", { method: "POST", headers: { "webhook-id": "wh_1", "webhook-timestamp": String(ts), "webhook-signature": forged }, body });
    expect(bad.status).toBe(403);
    const sig = await signStandardWebhook(webhookKeyCandidates("polar_test_secret")[0], "wh_1", ts, body);
    const good = await t.fetch("/webhooks/polar", { method: "POST", headers: { "webhook-id": "wh_1", "webhook-timestamp": String(ts), "webhook-signature": sig }, body });
    expect(good.status).toBe(202);
    const again = await t.fetch("/webhooks/polar", { method: "POST", headers: { "webhook-id": "wh_1", "webhook-timestamp": String(ts), "webhook-signature": sig }, body });
    expect(again.status).toBe(202);
    const stored = await t.run(async (ctx) => ctx.db.query("webhookEvents").collect());
    expect(stored).toHaveLength(1);
  });
});
