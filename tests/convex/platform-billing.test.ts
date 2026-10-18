import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { asNewUser, makePaid, setup, type T } from "./helpers";

/** Billing fixes: no second subscription, account-owner only, retries that never lose a Polar event. */

const DAY = 86_400_000;

async function owned(t: T, email = "owner@example.com") {
  const owner = await asNewUser(t, email);
  const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Billing Co" });
  const accountId = (await t.run(async (ctx) => (await ctx.db.get(orgId as Id<"organizations">))!.accountId))!;
  await t.mutation(internal.billing.recordCheckout, { orgId, accountId, userId: owner.userId, polarCheckoutId: "chk_1", productKey: "starter" });
  return { ...owner, slug, orgId: orgId as Id<"organizations">, accountId };
}

function polarSub(id: string, externalId: string, overrides: Record<string, unknown> = {}) {
  const start = Date.now() - DAY;
  return {
    id,
    status: "active",
    current_period_start: new Date(start).toISOString(),
    current_period_end: new Date(start + 30 * DAY).toISOString(),
    cancel_at_period_end: false,
    created_at: new Date(start).toISOString(),
    modified_at: new Date(Date.now() + 5_000).toISOString(),
    product_id: "prod_pro",
    customer_id: "cus_1",
    customer: { id: "cus_1", external_id: externalId },
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.POLAR_ACCESS_TOKEN;
});

describe("plan changes never double-charge", () => {
  it("refuses a second package checkout and switches the existing subscription instead", async () => {
    const t = setup();
    process.env.POLAR_ACCESS_TOKEN = "polar_test_token";
    const o = await owned(t);
    await makePaid(t, o.orgId);
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(String(url)).toContain(`/v1/subscriptions/sub_${o.orgId}`);
      expect(init?.method).toBe("PATCH");
      expect(JSON.parse(String(init?.body))).toMatchObject({ product_id: "prod_pro" });
      return new Response(JSON.stringify(polarSub(`sub_${o.orgId}`, o.accountId)), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(o.client.action(api.billing.createCheckout, { slug: o.slug, productKey: "pro" })).rejects.toThrow(/already have a package/);
    expect(fetchMock).not.toHaveBeenCalled();

    await o.client.action(api.billing.changePlan, { slug: o.slug, planKey: "pro" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const subs = await t.run(async (ctx) => ctx.db.query("subscriptions").collect());
    expect(subs).toHaveLength(1);
    expect(subs[0].planKey).toBe("pro");
  });

  it("only the account owner can buy, switch or open the portal (not a client workspace's admin)", async () => {
    const t = setup();
    process.env.POLAR_ACCESS_TOKEN = "polar_test_token";
    const fetchMock = vi.fn(async () => new Response("{}", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    const o = await owned(t);
    const admin = await asNewUser(t, "client-admin@example.com");
    await t.run(async (ctx) => {
      await ctx.db.insert("memberships", { orgId: o.orgId, userId: admin.userId, role: "admin", status: "active", createdAt: Date.now() });
    });
    await expect(admin.client.action(api.billing.createCheckout, { slug: o.slug, productKey: "starter" })).rejects.toThrow(/account owner/);
    await expect(admin.client.action(api.billing.customerPortal, { slug: o.slug })).rejects.toThrow(/account owner/);
    await expect(admin.client.action(api.billing.changePlan, { slug: o.slug, planKey: "pro" })).rejects.toThrow(/account owner/);
    expect((await admin.client.query(api.billing.overview, { slug: o.slug })).canManage).toBe(false);
    expect((await o.client.query(api.billing.overview, { slug: o.slug })).canManage).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("Polar events are never lost", () => {
  it("a network error while processing marks the event failed, and stuck events are retried", async () => {
    const t = setup();
    process.env.POLAR_ACCESS_TOKEN = "polar_test_token";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    const o = await owned(t);
    const payload = JSON.stringify({ type: "order.paid", data: { id: "ord_1", status: "paid", paid: true, billing_reason: "subscription_create", product_id: "prod_starter", subscription_id: "sub_1", customer_id: "cus_1", customer: { id: "cus_1", external_id: o.orgId }, total_amount: 1500, tax_amount: 0, refunded_amount: 0, currency: "usd", created_at: new Date().toISOString() } });
    const stored = await t.mutation(internal.billing.storeWebhookEvent, { source: "polar", eventId: "evt_net", type: "order.paid", payload });
    await t.action(internal.billing.processPolarEvent, { webhookId: stored.id });
    const ev = await t.run(async (ctx) => ctx.db.get(stored.id));
    expect(ev).toMatchObject({ status: "failed", attempts: 1 });
    // An event whose processor died stays "received": the retry cron picks it up after 10 minutes.
    await t.run(async (ctx) => {
      await ctx.db.insert("webhookEvents", { source: "polar", eventId: "evt_stuck", type: "subscription.updated", payload: "{}", status: "received", attempts: 0, receivedAt: Date.now() - 20 * 60_000 });
      await ctx.db.insert("webhookEvents", { source: "polar", eventId: "evt_fresh", type: "subscription.updated", payload: "{}", status: "received", attempts: 0, receivedAt: Date.now() });
    });
    expect(await t.mutation(internal.billing.retryFailedWebhooks, {})).toBe(2);
  });

  it("a package order without fresh subscription state fails for retry; reconciliation grants the missing month", async () => {
    const t = setup();
    const o = await owned(t);
    const order = { id: "ord_9", status: "paid", paid: true, billing_reason: "subscription_cycle", product_id: "prod_starter", subscription_id: "sub_9", customer_id: "cus_1", customer: { id: "cus_1", external_id: o.orgId }, total_amount: 1500, tax_amount: 0, refunded_amount: 0, currency: "usd", created_at: new Date().toISOString() };
    const stored = await t.mutation(internal.billing.storeWebhookEvent, { source: "polar", eventId: "evt_o9", type: "order.paid", payload: JSON.stringify({ type: "order.paid", data: order }) });
    expect(await t.mutation(internal.billing.applyPolarEvent, { webhookId: stored.id })).toMatchObject({ status: "failed" });
    const subPeriods = async () => (await t.run(async (ctx) => ctx.db.query("usagePeriods").collect())).filter((p) => p.source === "subscription");
    expect(await subPeriods()).toHaveLength(0);

    const start = Date.now() - DAY;
    await t.mutation(internal.billing.applyReconciledSubscription, {
      subscription: { id: "sub_9", status: "active", currentPeriodStart: start, currentPeriodEnd: start + 30 * DAY, cancelAtPeriodEnd: false, modifiedAt: Date.now(), productId: "prod_starter", customerId: "cus_1", externalCustomerId: o.orgId },
    });
    const granted = await subPeriods();
    expect(granted).toHaveLength(1);
    expect(granted[0].startsAt).toBe(start);
    const ord = await t.run(async (ctx) => ctx.db.query("orders").withIndex("by_polar", (q) => q.eq("polarOrderId", "ord_9")).first());
    expect(ord?.grantedAt).toBeTruthy();
    // Running reconciliation again changes nothing.
    await t.mutation(internal.billing.applyReconciledSubscription, {
      subscription: { id: "sub_9", status: "active", currentPeriodStart: start, currentPeriodEnd: start + 30 * DAY, cancelAtPeriodEnd: false, modifiedAt: Date.now(), productId: "prod_starter", customerId: "cus_1", externalCustomerId: o.orgId },
    });
    expect(await subPeriods()).toHaveLength(1);
  });

  it("reconciliation looks subscriptions up by the bound Polar customer", async () => {
    const t = setup();
    process.env.POLAR_ACCESS_TOKEN = "polar_test_token";
    const o = await owned(t);
    await t.run(async (ctx) => {
      const m = (await ctx.db.query("polarCustomers").first())!;
      await ctx.db.patch(m._id, { polarCustomerId: "cus_1" });
    });
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        urls.push(String(url));
        return new Response(JSON.stringify({ items: [polarSub("sub_r", o.accountId, { product_id: "prod_starter" })] }), { status: 200 });
      }),
    );
    expect(await t.action(internal.billing.reconcileAll, {})).toMatchObject({ reconciled: 1 });
    expect(urls[0]).toContain("customer_id=cus_1");
    const sub = await t.run(async (ctx) => ctx.db.query("subscriptions").withIndex("by_polar", (q) => q.eq("polarSubscriptionId", "sub_r")).first());
    expect(sub?.accountId).toBe(o.accountId);
  });

  it("a failed Resend event is kept and re-applied by the retry", async () => {
    const t = setup();
    const stored = await t.mutation(internal.billing.storeWebhookEvent, { source: "resend", eventId: "svix_1", type: "email.bounced", payload: JSON.stringify({ type: "email.bounced", toHashes: ["hash_a"] }) });
    await t.mutation(internal.billing.markWebhook, { id: stored.id, status: "failed", error: "boom" });
    expect(await t.mutation(internal.billing.retryFailedWebhooks, {})).toBe(1);
    await t.action(internal.notifications.reprocessResendEvent, { webhookId: stored.id });
    const ev = await t.run(async (ctx) => ctx.db.get(stored.id));
    expect(ev?.status).toBe("processed");
    const sup = await t.run(async (ctx) => ctx.db.query("platformSuppressions").collect());
    expect(sup.map((s) => s.emailHash)).toEqual(["hash_a"]);
  });
});

describe("which subscription counts", () => {
  it("the one granting access wins over a more recently touched ended one", async () => {
    const t = setup();
    const o = await owned(t);
    await makePaid(t, o.orgId);
    await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert("subscriptions", { orgId: o.orgId, accountId: o.accountId, polarSubscriptionId: "sub_old", productId: "prod_pro", planKey: "pro", status: "canceled", cancelAtPeriodEnd: false, currentPeriodStart: now - 60 * DAY, currentPeriodEnd: now - 30 * DAY, endedAt: now - 30 * DAY, entitlementVersionId: "ent-credits-2026-10-18", rateVersionId: "verified-2026-10-17", sourceModifiedAt: now, updatedAt: now + 10_000 });
    });
    const sub = await t.run(async (ctx) => {
      const { latestSubscription } = await import("../../convex/lib/access");
      return latestSubscription(ctx, (await ctx.db.get(o.orgId))!);
    });
    expect(sub?.polarSubscriptionId).toBe(`sub_${o.orgId}`);
  });
});

describe("staff tools", () => {
  it("resolving an uncertain job settles through the credit ledger", async () => {
    const t = setup();
    const o = await owned(t);
    const ops = await asNewUser(t, "ops@example.com");
    const runId = await t.run(async (ctx) => {
      const period = (await ctx.db.query("usagePeriods").collect()).find((p) => p.accountId === o.accountId)!;
      await ctx.db.patch(period._id, { walletReservedMicros: 3_000_000 });
      const reservationId = await ctx.db.insert("usageReservations", { orgId: o.orgId, periodId: period._id, purpose: "test", walletMicros: 3_000_000, topupMicros: 0, meters: {}, status: "unresolved", createdAt: Date.now() });
      const now = Date.now();
      return ctx.db.insert("workflowRuns", { orgId: o.orgId, kind: "test", title: "Post to Instagram", status: "uncertain", input: "{}", roles: [], estimateMicros: 3_000_000, actualMicros: 1_000_000, reservationId, rateVersionId: "verified-2026-10-17", entitlementVersionId: "ent-credits-2026-10-18", routingVersionId: "r1", budget: { modelSteps: 1, researchTools: 0, repairs: 0 }, used: { modelSteps: 1, researchTools: 0, repairs: 0 }, isFixture: false, createdAt: now, updatedAt: now });
    });
    await ops.client.mutation(api.ops.resolveUncertain, { runId, outcome: "verified", note: "checked on Instagram" });
    const period = await t.run(async (ctx) => (await ctx.db.query("usagePeriods").collect()).find((p) => p.accountId === o.accountId)!);
    expect(period.walletReservedMicros).toBe(0);
    expect(period.walletSpentMicros).toBe(1_000_000);
    const usage = await t.run(async (ctx) => ctx.db.query("workspaceUsage").collect());
    expect(usage[0]?.spentMicros).toBe(1_000_000);
  });

  it("comps renew just before the month ends, so there's no gap", async () => {
    const t = setup();
    const o = await owned(t);
    const ops = await asNewUser(t, "ops@example.com");
    await ops.client.mutation(api.admin.compPackage, { accountId: o.accountId, planKey: "starter", months: 3, reason: "partner" });
    await t.run(async (ctx) => {
      const s = (await ctx.db.query("subscriptions").collect())[0];
      await ctx.db.patch(s._id, { currentPeriodEnd: Date.now() + 60 * 60_000 });
    });
    expect(await t.mutation(internal.admin.renewComps, {})).toBe(1);
    // A comp whose last month is running keeps access until that month ends.
    await t.run(async (ctx) => {
      const s = (await ctx.db.query("subscriptions").collect())[0];
      await ctx.db.patch(s._id, { comp: { ...s.comp!, until: Date.now() + 30 * 60_000 }, currentPeriodEnd: Date.now() + 60 * 60_000 });
    });
    expect(await t.mutation(internal.admin.renewComps, {})).toBe(0);
    expect((await t.run(async (ctx) => ctx.db.query("subscriptions").collect()))[0].status).toBe("active");
  });

  it("the staff dashboard reads a paged snapshot; reconciliation reads a month in pages", async () => {
    const t = setup();
    const o = await owned(t);
    await makePaid(t, o.orgId);
    const ops = await asNewUser(t, "ops@example.com");
    expect((await ops.client.query(api.admin.dashboard, {})).updatedAt).toBeNull();
    await t.run(async (ctx) => {
      const now = Date.now();
      for (let i = 0; i < 4_100; i++) {
        await ctx.db.insert("usageEvents", { orgId: o.orgId, type: "model_call", provider: "openai", model: "luna", inputTokens: 1, outputTokens: 1, reasoningTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, quantity: 1, costMicros: 10, estimated: false, createdAt: now - 1000 });
      }
    });
    await t.action(internal.admin.refreshDashboard, {});
    const d = await ops.client.query(api.admin.dashboard, {});
    expect(d.updatedAt).not.toBeNull();
    expect(d).toMatchObject({ users: 2, accounts: 1, paying: 1, aiCost30dUsd: 0.041 });
    const month = new Date().toISOString().slice(0, 7);
    const r = await ops.client.action(api.ops.reconciliation, { month });
    expect(r.plans.find((p) => p.plan === "starter")?.variableCostUsd).toBeCloseTo(0.041);
    // Workspace usage sums every event (no 3,000 cap).
    const u = await o.client.action(api.settings.usage, { slug: o.slug });
    expect(u.events).toBe(4_100);
    expect(u.totalCostMicros).toBe(41_000);
  });
});
