import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { asNewUser, makePaid, setup } from "./helpers";

async function fixture(provider: "google_ads" | "meta_ads" = "google_ads", currency = "USD", daily = 1000) {
  const t = setup(); const owner = await asNewUser(t, "activation@example.com");
  const { slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Activation fixture" });
  const org = (await t.run(ctx => ctx.db.query("organizations").withIndex("by_slug", q => q.eq("slug", slug)).unique()))!;
  await makePaid(t, org._id);
  await t.run(async ctx => {
    const p = (await ctx.db.query("autonomyPolicies").withIndex("by_org_active", q => q.eq("orgId", org._id).eq("active", true)).first())!;
    await ctx.db.patch(p._id, { currency, mode: "review", budgetUnitVersion: "currency-minor-v1", maxMonthlyAdSpendMinor: 1000000 });
  });
  await t.mutation(internal.connections.storeConnection, { orgId: org._id, userId: owner.userId, provider, secret: JSON.stringify({ accessToken: "synthetic-token" }), secretKind: "oauth", scopes: provider === "google_ads" ? ["https://www.googleapis.com/auth/adwords"] : ["ads_read", "ads_management"], externalAccountId: "1234567890" });
  const connection = (await t.run(ctx => ctx.db.query("connections").withIndex("by_org_provider", q => q.eq("orgId", org._id).eq("provider", provider)).first()))!;
  const campaignId = await t.run(ctx => ctx.db.insert("campaigns", { orgId: org._id, name: "Reviewed campaign", channel: provider === "google_ads" ? "google_search_ad" : "meta_ad", status: "created_paused", currency, budgetUnitVersion: "currency-minor-v1", dailyBudgetMinor: daily, budgetEnvelopeMinor: daily * 5, startDate: "2026-11-16", endDate: "2026-11-20", stopRules: [], externalId: "42", connectionId: connection._id, createdAt: Date.now(), updatedAt: Date.now() }));
  await owner.client.mutation(api.ads.decide, { slug, campaignId, action: "activate" });
  const approval = (await t.run(ctx => ctx.db.query("approvals").withIndex("by_subject", q => q.eq("subjectType", "campaign_activation").eq("subjectId", campaignId)).first()))!;
  return { t, owner, slug, org, connection, campaignId, approvalId: approval._id, provider, currency, daily,
    run: () => t.action(internal.ads.executeCampaignWrite, { campaignId, approvalId: approval._id }),
    row: () => t.run(ctx => ctx.db.get(campaignId)), request: () => t.run(ctx => ctx.db.get(approval._id)),
    receipts: () => t.run(ctx => ctx.db.query("actionReceipts").withIndex("by_org_created", q => q.eq("orgId", org._id)).collect()),
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
function mock(f: Fixture, options: { campaign?: Record<string, unknown>; account?: Record<string, unknown>; budget?: Record<string, unknown>; empty?: boolean; duplicate?: boolean; truncated?: boolean; fail?: boolean; duringRead?: () => Promise<void> } = {}) {
  const calls: Array<{ url: string; method: string; body: string }> = [];
  let written = false;
  vi.stubGlobal("fetch", vi.fn(async (url: unknown, init?: RequestInit) => {
    const call = { url: String(url), method: init?.method ?? "GET", body: String(init?.body ?? "") }; calls.push(call);
    const isWrite = f.provider === "google_ads" ? call.url.endsWith("campaigns:mutate") : call.method === "POST";
    if (isWrite) { written = true; return new Response(JSON.stringify({ success: true })); }
    if (written) return new Response(JSON.stringify(f.provider === "google_ads" ? { results: [{ campaign: { id: "42", status: "ENABLED" } }] } : { id: "42", status: "ACTIVE" }));
    await options.duringRead?.();
    if (options.fail) return new Response("{}", { status: 403 });
    if (f.provider === "google_ads") {
      const factor = f.currency === "JPY" ? 1000000 : f.currency === "KWD" ? 1000 : 10000;
      const row = { customer: { id: "1234567890", currencyCode: f.currency, timeZone: "UTC", ...options.account }, campaign: { id: "42", status: "PAUSED", advertisingChannelType: "SEARCH", startDateTime: "2026-11-16 00:00:00", endDateTime: "2026-11-20 23:59:59", ...options.campaign }, campaignBudget: { amountMicros: String(f.daily * factor), period: "DAILY", explicitlyShared: false, ...options.budget } };
      return new Response(JSON.stringify({ results: options.empty ? [] : options.duplicate ? [row, row] : [row], ...(options.truncated ? { nextPageToken: "repeat" } : {}) }));
    }
    return new Response(JSON.stringify(call.url.includes("/act_") ? { currency: f.currency, timezone_name: "UTC", ...options.account }
      : { id: "42", account_id: "1234567890", status: "PAUSED", objective: "OUTCOME_TRAFFIC", spend_cap: String(f.daily * 5), ...options.campaign }));
  }));
  return { calls, writes: () => calls.filter(c => f.provider === "google_ads" ? c.url.endsWith("campaigns:mutate") : c.method === "POST") };
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-16T12:00Z")); vi.stubEnv("GOOGLE_ADS_DEVELOPER_TOKEN", "synthetic-developer-token"); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllTimers(); vi.useRealTimers(); });

describe("campaign activation settings", () => {
  it.each(["google_ads", "meta_ads"] as const)("reads %s settings, retains evidence and sends exactly one approved activation", async provider => {
    const f = await fixture(provider); const m = mock(f);
    await Promise.all([f.run(), f.run()]); await f.run();
    expect(m.writes()).toHaveLength(1);
    expect((await f.row())?.status).toBe("active");
    expect(await f.request()).toMatchObject({ status: "consumed", campaignActivationDispatchedAt: Date.now(), campaignActivationCheck: { checkedAt: Date.now(), observation: { provider, accountId: "1234567890", campaignId: "42", currency: "USD" } } });
    expect(await f.receipts()).toMatchObject([{ action: "activate", status: "verified" }]);
    expect(m.calls[0]).not.toEqual(m.writes()[0]);
  });
  it.each(["JPY", "KWD"])("compares %s budgets without assuming two decimal places", async currency => {
    const f = await fixture("google_ads", currency, 1234); const m = mock(f); await f.run();
    expect(m.writes()).toHaveLength(1); expect((await f.row())?.status).toBe("active");
  });
  it.each([
    { label: "increased budget", budget: { amountMicros: "20000000" } },
    { label: "lower budget still unapproved", budget: { amountMicros: "9000000" } },
    { label: "fractional minor unit", budget: { amountMicros: "10000001" } },
    { label: "missing budget", budget: { amountMicros: undefined } },
    { label: "shared budget", budget: { explicitlyShared: true } },
    { label: "unknown sharing", budget: { explicitlyShared: undefined } },
    { label: "lifetime period", budget: { period: "CUSTOM_PERIOD" } },
    { label: "changed start", campaign: { startDateTime: "2026-11-15 00:00:00" } },
    { label: "changed end", campaign: { endDateTime: "2026-11-21 23:59:59" } },
    { label: "unbounded end", campaign: { endDateTime: undefined } },
    { label: "changed channel", campaign: { advertisingChannelType: "DISPLAY" } },
    { label: "wrong campaign", campaign: { id: "99" } },
    { label: "already active", campaign: { status: "ENABLED" } },
    { label: "wrong account", account: { id: "9999999999" } },
    { label: "wrong currency", account: { currencyCode: "EUR" } },
    { label: "unknown timezone", account: { timeZone: undefined } },
    { label: "empty response", empty: true }, { label: "duplicate response", duplicate: true },
    { label: "truncated response", truncated: true }, { label: "provider refusal", fail: true },
  ])("blocks Google $label without changing settings", async options => {
    const f = await fixture(); const m = mock(f, options); await f.run();
    expect(m.writes()).toHaveLength(0);
    expect((await f.row())?.status).toBe("created_paused");
    expect(await f.request()).toMatchObject({ executionOutcome: "failed", status: "invalidated" });
    expect((await f.request())?.campaignActivationDispatchedAt).toBeUndefined();
    const list = await f.owner.client.query(api.ads.list, { slug: f.slug });
    expect(list.campaigns[0].lastWriteProblem).toBeTruthy();
    expect(list.campaigns[0].writeState).toBeNull();
  });
  it.each([
    { label: "changed cap", campaign: { spend_cap: "6000" } },
    { label: "missing cap", campaign: { spend_cap: undefined } },
    { label: "unlimited cap", campaign: { spend_cap: "0" } },
    { label: "rounded cap", campaign: { spend_cap: "5000.1" } },
    { label: "wrong account", campaign: { account_id: "9999999999" } },
    { label: "missing account", campaign: { account_id: undefined } },
    { label: "wrong campaign", campaign: { id: "99" } },
    { label: "wrong objective", campaign: { objective: "OUTCOME_SALES" } },
    { label: "already active", campaign: { status: "ACTIVE" } },
    { label: "currency conflict", account: { currency: "EUR" } },
    { label: "timezone unknown", account: { timezone_name: undefined } },
    { label: "not yet local start day", account: { timezone_name: "Etc/GMT+12" } },
  ])("blocks Meta $label before any status write", async options => {
    if (options.label === "not yet local start day") vi.setSystemTime(new Date("2026-11-16T01:00Z"));
    const f = await fixture("meta_ads"); const m = mock(f, options); await f.run();
    expect(m.writes()).toHaveLength(0); expect((await f.row())?.status).toBe("created_paused");
    expect((await f.request())?.executionOutcome).toBe("failed");
  });
  it.each(["permission", "account", "terms", "policy", "emergency", "expiry", "stale"])("rechecks %s after reading provider settings", async kind => {
    const f = await fixture(); const m = mock(f, { duringRead: async () => {
      if (kind === "stale") { vi.setSystemTime(Date.now() + 61_000); return; }
      if (kind === "expiry") { vi.setSystemTime(Date.now() + 25 * 3600_000); return; }
      await f.t.run(async ctx => {
        if (kind === "account") await ctx.db.patch(f.connection._id, { externalAccountId: "9999999999" });
        if (kind === "terms") await ctx.db.patch(f.campaignId, { name: "Changed" });
        if (kind === "emergency") await ctx.db.patch(f.org._id, { emergencyStop: { active: true, at: Date.now(), by: f.owner.userId } });
        if (kind === "policy") {
          const p = (await ctx.db.query("autonomyPolicies").withIndex("by_org_active", q => q.eq("orgId", f.org._id).eq("active", true)).first())!;
          await ctx.db.patch(p._id, { maxMonthlyAdSpendMinor: 1 });
        }
        if (kind === "permission") {
          const member = (await ctx.db.query("memberships").withIndex("by_org_user", q => q.eq("orgId", f.org._id).eq("userId", f.owner.userId)).first())!;
          await ctx.db.patch(member._id, { role: "viewer" });
        }
      });
    } });
    await f.run(); expect(m.writes()).toHaveLength(0);
    expect((await f.request())?.executionOutcome).toBe("failed");
    expect((await f.row())?.status).toBe("created_paused");
  });
  it("uses account-local end date instead of allowing an extra UTC day", async () => {
    vi.setSystemTime(new Date("2026-11-20T18:00Z"));
    const f = await fixture(); const m = mock(f, { account: { timeZone: "Asia/Dhaka" } }); await f.run();
    expect(m.writes()).toHaveLength(0); expect((await f.request())?.invalidatedReason).toMatch(/ended/);
  });
  it("claims final dispatch once and cannot relabel it as never sent", async () => {
    const f = await fixture();
    await f.t.mutation(internal.ads.claimCampaignWrite, { campaignId: f.campaignId, approvalId: f.approvalId });
    const args = { campaignId: f.campaignId, approvalId: f.approvalId, startedAt: Date.now(), checkedAt: Date.now(), observation: { provider: "google_ads" as const, accountId: "1234567890", campaignId: "42", currency: "USD", timeZone: "UTC", status: "PAUSED", kind: "SEARCH", budgetAmount: "10000000", budgetPeriod: "DAILY", budgetShared: false, startDateTime: "2026-11-16 00:00:00", endDateTime: "2026-11-20 23:59:59" } };
    const outcomes = await Promise.all([f.t.mutation(internal.ads.authorizeCampaignActivation, args), f.t.mutation(internal.ads.authorizeCampaignActivation, args)]);
    expect(outcomes.filter(r => r.ok)).toHaveLength(1);
    await f.t.mutation(internal.ads.recordCampaignResult, { campaignId: f.campaignId, approvalId: f.approvalId, action: "activate", status: "failed", activationNotDispatched: true, summary: "Must not clear a claimed provider write" });
    expect(await f.receipts()).toHaveLength(0);
    expect((await f.request())?.executionFinishedAt).toBeUndefined();
  });
  it("does not let a different tenant's approval authorize the final dispatch", async () => {
    const f = await fixture();
    const { slug: otherSlug } = await f.owner.client.mutation(api.orgs.createWorkspace, { businessName: "Other tenant" });
    const otherOrg = (await f.t.run(ctx => ctx.db.query("organizations").withIndex("by_slug", q => q.eq("slug", otherSlug)).unique()))!;
    await f.t.mutation(internal.ads.claimCampaignWrite, { campaignId: f.campaignId, approvalId: f.approvalId });
    const observation = { provider: "google_ads" as const, accountId: "1234567890", campaignId: "42", currency: "USD", timeZone: "UTC", status: "PAUSED", kind: "SEARCH", budgetAmount: "10000000" };
    await f.t.run(ctx => ctx.db.patch(f.approvalId, { orgId: otherOrg._id }));
    const result = await f.t.mutation(internal.ads.authorizeCampaignActivation, { campaignId: f.campaignId, approvalId: f.approvalId, startedAt: Date.now(), checkedAt: Date.now(), observation });
    expect(result.ok).toBe(false);
  });
});
