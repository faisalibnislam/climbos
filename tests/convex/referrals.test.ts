import { describe, expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { asNewUser, setup, type T } from "./helpers";

const DAY = 86_400_000;

async function payFirstPackage(t: T, orgId: Id<"organizations">, accountId: Id<"accounts">, userId: Id<"users">) {
  await t.mutation(internal.billing.recordCheckout, { orgId, accountId, userId, polarCheckoutId: "chk_r", productKey: "starter" });
  const start = Date.UTC(2026, 9, 1);
  const deliver = async (eventId: string, type: string, data: unknown, subscription?: unknown) => {
    const stored = await t.mutation(internal.billing.storeWebhookEvent, { source: "polar", eventId, type, payload: JSON.stringify({ type, data }) });
    return t.mutation(internal.billing.applyPolarEvent, { webhookId: stored.id, subscription: subscription as never });
  };
  const customer = { id: "cus_r", external_id: orgId };
  await deliver("evt_s", "subscription.created", { id: "sub_r", status: "active", current_period_start: new Date(start).toISOString(), current_period_end: new Date(start + 31 * DAY).toISOString(), cancel_at_period_end: false, ended_at: null, created_at: new Date(start).toISOString(), modified_at: new Date(start + 1000).toISOString(), product_id: "prod_starter", customer_id: "cus_r", customer });
  const snap = { id: "sub_r", status: "active", currentPeriodStart: start, currentPeriodEnd: Date.now() + 20 * DAY, cancelAtPeriodEnd: false, modifiedAt: start + 1000, productId: "prod_starter", customerId: "cus_r", externalCustomerId: orgId };
  return deliver("evt_o", "order.paid", { id: "ord_r", status: "paid", paid: true, billing_reason: "subscription_create", product_id: "prod_starter", subscription_id: "sub_r", customer_id: "cus_r", customer, total_amount: 1500, tax_amount: 0, refunded_amount: 0, currency: "usd", created_at: new Date().toISOString() }, snap);
}

const lots = (t: T) => t.run(async (ctx) => (await ctx.db.query("creditPurchases").collect()).filter((p) => p.topupKey === "referral"));

describe("Referrals", () => {
  it("links a new account to the share code and rewards both sides once, on the first package", async () => {
    const t = setup();
    const a = await asNewUser(t, "referrer@example.com");
    const { slug } = await a.client.mutation(api.orgs.createWorkspace, { businessName: "Referrer Co" });
    const code = (await a.client.mutation(api.referrals.ensureCode, { slug }))!;
    expect(await a.client.mutation(api.referrals.ensureCode, { slug })).toBe(code);

    const b = await asNewUser(t, "friend@example.com");
    const friend = await b.client.mutation(api.orgs.createWorkspace, { businessName: "Friend Co", referralCode: code.toUpperCase() });
    expect((await a.client.query(api.referrals.mine, { slug }))).toMatchObject({ signedUp: 1, rewarded: 0, earned: 0 });
    expect(await lots(t)).toHaveLength(0);

    const accountId = (await t.run(async (ctx) => (await ctx.db.get(friend.orgId as Id<"organizations">))!.accountId))!;
    await payFirstPackage(t, friend.orgId as Id<"organizations">, accountId, b.userId as Id<"users">);
    const granted = await lots(t);
    expect(granted).toHaveLength(2);
    expect(granted.every((l) => l.creditsMicros === 2_000_000)).toBe(true);
    expect(await a.client.query(api.referrals.mine, { slug })).toMatchObject({ signedUp: 1, rewarded: 1, earned: 200 });
  });

  it("ignores own codes, unknown codes and second workspaces", async () => {
    const t = setup();
    const a = await asNewUser(t, "solo@example.com");
    const { slug } = await a.client.mutation(api.orgs.createWorkspace, { businessName: "Solo Co" });
    const code = (await a.client.mutation(api.referrals.ensureCode, { slug }))!;
    const b = await asNewUser(t, "other@example.com");
    await b.client.mutation(api.orgs.createWorkspace, { businessName: "Other Co", referralCode: "nosuchcode" });
    expect(await t.run(async (ctx) => (await ctx.db.query("referrals").collect()).length)).toBe(0);
    expect(code).toMatch(/^[a-z0-9]{8}$/);
  });
});
