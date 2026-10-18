import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { asNewUser, setup, type T } from "./helpers";

/** Credits: shared per account, monthly first then top-ups, optional workspace caps, free = one workspace. */

async function workspace(t: T, email: string) {
  const owner = await asNewUser(t, email);
  const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Credit Co" });
  await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", statement: "More customers", horizonDays: 90, monthlyAdBudget: 0 });
  const accountId = (await t.run(async (ctx) => (await ctx.db.get(orgId as Id<"organizations">))!.accountId))!;
  return { ...owner, slug, orgId: orgId as Id<"organizations">, accountId };
}

async function freePeriod(t: T, accountId: Id<"accounts">) {
  return t.run(async (ctx) => (await ctx.db.query("usagePeriods").withIndex("by_account_period", (q) => q.eq("accountId", accountId).eq("periodKey", "onboarding")).first())!);
}

describe("credits", () => {
  beforeEach(() => {
    process.env.CLIMBOS_FAKE_LLM = "ship";
  });
  afterEach(() => {
    delete process.env.CLIMBOS_FAKE_LLM;
  });

  it("a new account gets 50 free credits once; free accounts have one workspace", async () => {
    const t = setup();
    const w = await workspace(t, "free@example.com");
    const bal = await w.client.query(api.workspace.credits, { slug: w.slug });
    expect(bal.available).toBe(50);
    expect(bal.paid).toBe(false);
    await expect(w.client.mutation(api.orgs.createWorkspace, { businessName: "Second" })).rejects.toThrow(/one workspace/);
  });

  it("uses the month's credits first, then top-ups (oldest expiry first), and charges what was used", async () => {
    const t = setup();
    const w = await workspace(t, "topup@example.com");
    const est = await w.client.query(api.content.estimate, { slug: w.slug, job: "content_email" });
    // Month nearly empty; a top-up lot holds the rest.
    await t.run(async (ctx) => {
      const p = (await ctx.db.query("usagePeriods").withIndex("by_account_period", (q) => q.eq("accountId", w.accountId).eq("periodKey", "onboarding")).first())!;
      await ctx.db.patch(p._id, { walletCapMicros: Math.floor(est.maxCostMicros / 2), walletSpentMicros: 0 });
      await ctx.db.insert("creditPurchases", { orgId: w.orgId, accountId: w.accountId, polarOrderId: "ord_t", topupKey: "credits_10", deliveryCostMicros: 7_000_000, creditsMicros: 7_000_000, remainingMicros: 7_000_000, expiresAt: Date.now() + 300 * 86_400_000, status: "active", createdAt: Date.now() });
    });
    const { runId } = await w.client.mutation(api.content.generate, { slug: w.slug, job: "content_email" });
    const held = await t.run(async (ctx) => ctx.db.get((await ctx.db.get(runId))!.reservationId!));
    expect(held).toMatchObject({ walletMicros: 0, topupMicros: est.maxCostMicros });
    await t.finishAllScheduledFunctions(() => undefined);
    const run = await t.run(async (ctx) => ctx.db.get(runId));
    const lot = await t.run(async (ctx) => (await ctx.db.query("creditPurchases").collect())[0]);
    expect(lot.remainingMicros).toBe(7_000_000 - run!.actualMicros);
    const account = await t.run(async (ctx) => ctx.db.query("creditAccounts").collect());
    expect(account[0].topupReservedMicros).toBe(0);
  });

  it("a workspace cap stops one workspace from using more than its share", async () => {
    const t = setup();
    const w = await workspace(t, "cap@example.com");
    await t.run(async (ctx) => ctx.db.patch(w.orgId, { monthlyCreditCap: 1 }));
    await expect(w.client.mutation(api.content.generate, { slug: w.slug, job: "content_seo" })).rejects.toThrow(/monthly cap is 1 credits/);
    const p = await freePeriod(t, w.accountId);
    expect(p.walletReservedMicros).toBe(0);
  });

  it("explains in credits when a job doesn't fit", async () => {
    const t = setup();
    const w = await workspace(t, "short@example.com");
    await t.run(async (ctx) => {
      const p = (await ctx.db.query("usagePeriods").withIndex("by_account_period", (q) => q.eq("accountId", w.accountId).eq("periodKey", "onboarding")).first())!;
      await ctx.db.patch(p._id, { walletSpentMicros: p.walletCapMicros });
    });
    await expect(w.client.mutation(api.content.generate, { slug: w.slug, job: "content_seo" })).rejects.toThrow(/needs up to \d+ credits and you have 0/);
  });
});
