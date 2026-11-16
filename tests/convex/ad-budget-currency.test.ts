import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";

async function fixture(currency = "USD") {
  const t = setup();
  const owner = await asNewUser(t, "budget-owner@example.com", { anonymous: true });
  const { slug } = await owner.client.mutation(api.demo.createDemoWorkspace, {});
  const data = await t.run(async ctx => {
    const org = (await ctx.db.query("organizations").withIndex("by_slug", q => q.eq("slug", slug)).unique())!;
    const policy = (await ctx.db.query("autonomyPolicies").withIndex("by_org_active", q => q.eq("orgId", org._id).eq("active", true)).first())!;
    const business = (await ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", org._id)).first())!;
    const goal = (await ctx.db.query("goals").withIndex("by_org_status", q => q.eq("orgId", org._id).eq("status", "active")).first())!;
    await ctx.db.patch(org._id, { currency });
    await ctx.db.patch(business._id, { currency });
    await ctx.db.patch(goal._id, { currency });
    await ctx.db.patch(policy._id, { currency });
    for (const c of await ctx.db.query("campaigns").withIndex("by_org", q => q.eq("orgId", org._id)).collect()) await ctx.db.delete(c._id);
    const ad = (await ctx.db.query("artifacts").withIndex("by_org_updated", q => q.eq("orgId", org._id)).collect()).find(a => a.kind === "ad" && a.status === "approved")!;
    return { orgId: org._id, policyId: policy._id, goalId: goal._id, businessId: business._id, artifactId: ad._id };
  });
  const update = (amount: number) => owner.client.mutation(api.settings.updatePolicy, { slug, mode: "review", allowAdPauseRules: true, maxMonthlyAdSpend: amount, approvalTtlHours: 24 });
  const prepare = (dailyBudget: number) => owner.client.mutation(api.ads.prepareCampaign, { slug, artifactId: data.artifactId, dailyBudget, startDate: "2026-11-17", endDate: "2026-11-18", reviewAfterDays: 7 });
  const policy = () => t.run(ctx => ctx.db.query("autonomyPolicies").withIndex("by_org_active", q => q.eq("orgId", data.orgId).eq("active", true)).first());
  return { t, owner, slug, ...data, update, prepare, policy };
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-16T12:00:00Z")); });
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllTimers(); vi.useRealTimers(); });

describe("ad budget currency contract", () => {
  it.each([["JPY", 1200, 1200, 12000], ["KWD", 12.345, 12345, 123.45], ["CLF", 1.2345, 12345, 12.345]] as const)("preserves %s policy and daily amounts without rounding", async (currency, amount, minor, cap) => {
    const f = await fixture(currency);
    await f.update(cap);
    expect(await f.policy()).toMatchObject({ maxMonthlyAdSpendMinor: minor * 10 });
    expect((await f.owner.client.query(api.settings.policies, { slug: f.slug })).policy?.maxMonthlyAdSpend).toBe(cap);
    const id = await f.prepare(amount);
    expect(await f.t.run(ctx => ctx.db.get(id))).toMatchObject({ dailyBudgetMinor: minor, budgetEnvelopeMinor: minor * 2 });
    expect(await f.t.run(async ctx => (await ctx.db.query("actionReceipts").collect()).filter(r => r.campaignId === id))).toHaveLength(0);
  });

  it("rejects precision the currency cannot represent", async () => {
    const f = await fixture("JPY");
    await expect(f.update(12.5)).rejects.toThrow(/decimal|precision/i);
    await f.update(10000);
    await expect(f.prepare(12.5)).rejects.toThrow(/decimal|precision/i);
  });

  it("keeps legacy non-two-decimal policy limits unknown until owner confirmation", async () => {
    const f = await fixture("KWD");
    const before = await f.policy();
    const view = await f.owner.client.query(api.settings.policies, { slug: f.slug });
    expect(view.policy?.maxMonthlyAdSpend).toBeNull();
    await expect(f.prepare(1)).rejects.toThrow(/confirm|review/i);
    expect(await f.policy()).toEqual(before);
    await f.update(60);
    const next = await f.policy();
    expect(next).toMatchObject({ maxMonthlyAdSpendMinor: 60000, budgetUnitVersion: "currency-minor-v1" });
    expect(next!.version).toBe(before!.version + 1);
  });

  it("does not silently round goal budgets or leave their cap in a different currency", async () => {
    const f = await fixture("KWD");
    await expect(f.owner.client.mutation(api.orgs.setAdBudget, { slug: f.slug, monthlyAdBudget: 1.2345 })).rejects.toThrow(/decimal|precision/i);
    await f.t.run(ctx => ctx.db.patch(f.policyId, { currency: "USD" }));
    await f.owner.client.mutation(api.orgs.setAdBudget, { slug: f.slug, monthlyAdBudget: 60 });
    expect(await f.policy()).toMatchObject({ currency: "KWD", maxMonthlyAdSpendMinor: 60000 });
  });

  it("rejects a stale displayed currency for settings, goal and campaign entry", async () => {
    const f = await fixture("KWD");
    await expect(f.owner.client.mutation(api.settings.updatePolicy, { slug: f.slug, mode: "review", allowAdPauseRules: true, maxMonthlyAdSpend: 100, expectedCurrency: "USD", approvalTtlHours: 24 })).rejects.toThrow(/currency changed/i);
    await expect(f.owner.client.mutation(api.orgs.setAdBudget, { slug: f.slug, monthlyAdBudget: 100, expectedCurrency: "USD" })).rejects.toThrow(/currency changed/i);
    await f.update(100);
    await expect(f.owner.client.mutation(api.ads.prepareCampaign, { slug: f.slug, artifactId: f.artifactId, dailyBudget: 1, expectedCurrency: "USD", startDate: "2026-11-17", endDate: "2026-11-18", reviewAfterDays: 7 })).rejects.toThrow(/currency changed/i);
  });

  it.each(["setAdBudget", "setGoal"] as const)("requires an owner to confirm unknown or cross-currency caps through %s", async route => {
    const f = await fixture("KWD");
    const editor = await asNewUser(f.t, "editor@example.com");
    await f.t.run(ctx => ctx.db.insert("memberships", { orgId: f.orgId, userId: editor.userId, role: "editor", status: "active", createdAt: Date.now() }));
    const save = () => route === "setAdBudget"
      ? editor.client.mutation(api.orgs.setAdBudget, { slug: f.slug, monthlyAdBudget: 1 })
      : editor.client.mutation(api.orgs.setGoal, { slug: f.slug, kind: "more_customers", statement: "Grow", horizonDays: 90, monthlyAdBudget: 1 });
    await expect(save()).rejects.toThrow(/owner or admin/i);
    await f.t.run(ctx => ctx.db.patch(f.policyId, { currency: "USD" }));
    await expect(save()).rejects.toThrow(/owner or admin/i);
    await f.update(100); // USD cap is now explicit, but still a different currency.
    await expect(save()).rejects.toThrow(/owner or admin/i);
    await f.owner.client.mutation(api.orgs.setAdBudget, { slug: f.slug, monthlyAdBudget: 10 });
    await expect(save()).resolves.toBeDefined();
    expect(await f.policy()).toMatchObject({ currency: "KWD", maxMonthlyAdSpendMinor: 1000 });
  });

  it("blocks ambiguous legacy campaigns without changing their stored amounts", async () => {
    const f = await fixture("KWD");
    await f.update(100);
    const id = await f.prepare(1.234);
    await f.t.run(ctx => ctx.db.patch(id, { budgetUnitVersion: undefined }));
    const before = await f.t.run(ctx => ctx.db.get(id));
    await expect(f.owner.client.mutation(api.ads.decide, { slug: f.slug, campaignId: id, action: "create_paused" })).rejects.toThrow(/units need owner review/i);
    const view = await f.owner.client.query(api.ads.list, { slug: f.slug });
    expect(view.campaigns.find(c => c.id === id)?.budgetReviewReason).toMatch(/units need owner review/i);
    expect(await f.t.run(ctx => ctx.db.get(id))).toEqual(before);
    await f.owner.client.mutation(api.ads.decide, { slug: f.slug, campaignId: id, action: "reject" });
    expect(await f.t.run(ctx => ctx.db.get(id))).toMatchObject({ status: "draft", dailyBudgetMinor: 1234, budgetEnvelopeMinor: 2468 });
    await expect(f.prepare(1.234)).resolves.toBeTruthy();
  });

  it("rechecks the shared spending limit before both approval and queued execution", async () => {
    const f = await fixture();
    await f.update(100);
    const id = await f.prepare(10);
    await f.update(15);
    await expect(f.owner.client.mutation(api.ads.decide, { slug: f.slug, campaignId: id, action: "create_paused" })).rejects.toThrow(/exceed.*monthly ad budget/i);
    await f.update(100);
    await f.owner.client.mutation(api.ads.decide, { slug: f.slug, campaignId: id, action: "create_paused" });
    const a = await f.t.run(ctx => ctx.db.query("approvals").withIndex("by_subject", q => q.eq("subjectType", "campaign_activation").eq("subjectId", id)).first());
    // Keep the version unchanged to prove amount revalidation independently of policy-version hashing.
    await f.t.run(async ctx => {
      const p = (await ctx.db.query("autonomyPolicies").withIndex("by_org_active", q => q.eq("orgId", f.orgId).eq("active", true)).first())!;
      await ctx.db.patch(p._id, { maxMonthlyAdSpendMinor: 1500 });
    });
    await f.t.action(internal.ads.executeCampaignWrite, { campaignId: id, approvalId: a!._id });
    expect(await f.t.run(ctx => ctx.db.get(id))).toMatchObject({ status: "needs_approval" });
    const receipts = await f.t.run(async ctx => (await ctx.db.query("actionReceipts").collect()).filter(r => r.campaignId === id));
    expect(receipts).toMatchObject([{ status: "failed" }]);
  });

  it("binds the monetary representation to approval and rejects a later ambiguous legacy value", async () => {
    const f = await fixture("KWD");
    await f.update(100);
    const id = await f.prepare(1.234);
    await f.owner.client.mutation(api.ads.decide, { slug: f.slug, campaignId: id, action: "create_paused" });
    const a = await f.t.run(ctx => ctx.db.query("approvals").withIndex("by_subject", q => q.eq("subjectType", "campaign_activation").eq("subjectId", id)).first());
    expect(a?.scope).toMatchObject({ budgetUnitVersion: "currency-minor-v1", spendLimitMinor: 1234, totalSpendLimitMinor: 2468 });
    await f.t.run(ctx => ctx.db.patch(id, { budgetUnitVersion: undefined }));
    await f.t.action(internal.ads.executeCampaignWrite, { campaignId: id, approvalId: a!._id });
    expect(await f.t.run(ctx => ctx.db.get(id))).toMatchObject({ status: "needs_approval", dailyBudgetMinor: 1234 });
  });

  it.each(["KWD", "USD", "unknown"])("checks Meta's reported %s currency before any campaign write", async reported => {
    const f = await fixture("KWD");
    await f.update(100);
    await f.t.run(ctx => ctx.db.patch(f.artifactId, { channel: "meta_ad" }));
    await f.t.mutation(internal.connections.storeConnection, { orgId: f.orgId, userId: f.owner.userId, provider: "meta_ads", secret: JSON.stringify({ accessToken: "synthetic-token-never-sent" }), secretKind: "oauth", scopes: ["ads_management"], externalAccountId: "12345678" });
    const requests: Array<{ method: string; body: string }> = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: unknown, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      requests.push({ method, body: String(init?.body ?? "") });
      const payload = requests.length === 1 ? { currency: reported === "unknown" ? undefined : reported, amount_spent: "0", spend_cap: "0" }
        : method === "POST" ? { id: "88888" } : { id: "88888", status: "PAUSED", spend_cap: "2468" };
      return new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });
    }));
    const id = await f.prepare(1.234);
    await f.owner.client.mutation(api.ads.decide, { slug: f.slug, campaignId: id, action: "create_paused" });
    const a = await f.t.run(ctx => ctx.db.query("approvals").withIndex("by_subject", q => q.eq("subjectType", "campaign_activation").eq("subjectId", id)).first());
    await f.t.action(internal.ads.executeCampaignWrite, { campaignId: id, approvalId: a!._id });
    if (reported === "KWD") {
      expect(requests.filter(r => r.method === "POST")).toHaveLength(1);
      expect(new URLSearchParams(requests.find(r => r.method === "POST")!.body).get("spend_cap")).toBe("2468");
      expect(await f.t.run(ctx => ctx.db.get(id))).toMatchObject({ status: "created_paused" });
    } else {
      expect(requests).toHaveLength(1);
      expect(requests[0].method).toBe("GET");
      expect(await f.t.run(ctx => ctx.db.get(id))).toMatchObject({ status: "needs_approval" });
    }
  });
});
