import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";

async function fixture(provider: "google_ads" | "meta_ads" = "google_ads") {
  const t = setup();
  const owner = await asNewUser(t, "monitor-owner@example.com");
  const { slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Monitor fixture" });
  const org = (await t.run(ctx => ctx.db.query("organizations").withIndex("by_slug", q => q.eq("slug", slug)).unique()))!;
  await t.mutation(internal.connections.storeConnection, { orgId: org._id, userId: owner.userId, provider, secret: JSON.stringify({ accessToken: "synthetic-token-never-sent" }), secretKind: "oauth", scopes: provider === "meta_ads" ? ["ads_read", "ads_management"] : ["https://www.googleapis.com/auth/adwords"], externalAccountId: "1234567890" });
  const connection = (await t.run(ctx => ctx.db.query("connections").withIndex("by_org_provider", q => q.eq("orgId", org._id).eq("provider", provider)).first()))!;
  const campaignId = await t.run(ctx => ctx.db.insert("campaigns", { orgId: org._id, channel: provider === "meta_ads" ? "meta_ad" : "google_search_ad", name: "Monitor campaign", status: "active", currency: "USD", dailyBudgetMinor: 1000, budgetEnvelopeMinor: 30000, budgetUnitVersion: "currency-minor-v1", startDate: "2026-11-01", endDate: "2026-11-30", stopRules: [], externalId: "42", connectionId: connection._id, createdAt: Date.now(), updatedAt: Date.now() }));
  const view = () => owner.client.query(api.adMonitoring.view, { slug, campaignId });
  const enable = async () => owner.client.mutation(api.adMonitoring.configure, { slug, campaignId, enabled: true, expectedTermsHash: (await view()).termsHash });
  return { t, owner, org, slug, connection, campaignId, view, enable, check: () => t.action(internal.adMonitoring.checkSpend, { campaignId }), row: () => t.run(ctx => ctx.db.get(campaignId)), disable: () => owner.client.mutation(api.adMonitoring.configure, { slug, campaignId, enabled: false }) };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
type MockOptions = { spend?: string; zone?: string; currency?: string; report?: Record<string, unknown>; readStatus?: string; readId?: string; duringRead?: () => Promise<void> };
function mockProvider(provider: "google_ads" | "meta_ads", opts: MockOptions = {}) {
  const calls: Array<{ url: string; body: string; method: string }> = [];
  vi.stubGlobal("fetch", vi.fn(async (url: unknown, init?: RequestInit) => {
    const call = { url: String(url), body: String(init?.body ?? ""), method: init?.method ?? "GET" };
    calls.push(call);
    let data: unknown;
    if (provider === "google_ads") {
      if (call.url.endsWith("campaigns:mutate")) data = { results: [{}] };
      else if (call.body.includes("customer.currency_code")) data = { results: [{ customer: { currencyCode: opts.currency ?? "USD", timeZone: opts.zone ?? "Pacific/Honolulu" } }] };
      else if (call.body.includes("metrics.cost_micros")) {
        await opts.duringRead?.();
        data = opts.report ?? { results: [{ campaign: { id: "42" }, segments: { date: "2026-11-15" }, metrics: { costMicros: opts.spend ?? "300000000", clicks: "0", impressions: "0" } }] };
      } else data = { results: [{ campaign: { id: opts.readId ?? "42", status: opts.readStatus ?? "PAUSED" } }] };
    } else {
      if (call.method === "POST") data = { success: true };
      else if (call.url.includes("/insights")) {
        await opts.duringRead?.();
        data = opts.report ?? { data: [{ campaign_id: "42", date_start: "2026-11-15", spend: opts.spend ?? "300.00", clicks: "0", impressions: "0", account_currency: "USD" }] };
      } else if (call.url.includes("/act_")) data = { currency: opts.currency ?? "USD", timezone_name: opts.zone ?? "Pacific/Honolulu" };
      else data = { id: opts.readId ?? "42", status: opts.readStatus ?? "PAUSED" };
    }
    return new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } });
  }));
  return { calls, writes: () => calls.filter(c => provider === "google_ads" ? c.url.endsWith("campaigns:mutate") : c.method === "POST") };
}
async function change(f: Fixture, kind: string) {
  await f.t.run(async ctx => {
    if (kind === "account") await ctx.db.patch(f.connection._id, { externalAccountId: "9999999999" });
    if (kind === "provider") await ctx.db.patch(f.connection._id, { provider: "meta_ads" });
    if (kind === "campaign") await ctx.db.patch(f.campaignId, { externalId: "99" });
    if (kind === "content") await ctx.db.patch(f.campaignId, { name: "Changed content" });
    if (kind === "budget") await ctx.db.patch(f.campaignId, { dailyBudgetMinor: 2000, budgetEnvelopeMinor: 60000 });
    if (kind === "scope") await ctx.db.patch(f.connection._id, { scopes: [] });
    if (kind === "emergency stop") await ctx.db.patch(f.org._id, { emergencyStop: { active: true, at: Date.now(), by: f.owner.userId } });
    if (kind === "policy" || kind === "pause permission") {
      const p = (await ctx.db.query("autonomyPolicies").withIndex("by_org_active", q => q.eq("orgId", f.org._id).eq("active", true)).first())!;
      await ctx.db.patch(p._id, kind === "policy" ? { version: p.version + 1 } : { allowAdPauseRules: false });
    }
    if (kind === "role") {
      const m = (await ctx.db.query("memberships").withIndex("by_org_user", q => q.eq("orgId", f.org._id).eq("userId", f.owner.userId)).first())!;
      await ctx.db.patch(m._id, { role: "viewer" });
    }
  });
  if (kind === "expiry") vi.setSystemTime(Date.now() + 337 * 3_600_000);
  if (kind === "stale read") vi.setSystemTime(Date.now() + 6 * 60_000);
  if (kind === "disable") await f.disable();
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-16T01:00:00Z")); vi.stubEnv("GOOGLE_ADS_DEVELOPER_TOKEN", "synthetic-developer-token"); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllTimers(); vi.useRealTimers(); });

describe("explicit campaign spend-pause authority", () => {
  it("does not enroll campaigns from the legacy default policy or perform unapproved reads", async () => {
    const f = await fixture();
    const mock = mockProvider("google_ads");
    expect(await f.t.mutation(internal.adMonitoring.tick, {})).toBe(0);
    await f.check();
    expect(mock.calls).toHaveLength(0);
    expect((await f.view()).status).toBe("disabled");
  });
  it("requires the exact reviewed terms and prevents tenant and viewer approval", async () => {
    const f = await fixture();
    const terms = (await f.view()).termsHash;
    await change(f, "budget");
    await expect(f.owner.client.mutation(api.adMonitoring.configure, { slug: f.slug, campaignId: f.campaignId, enabled: true, expectedTermsHash: terms })).rejects.toThrow(/changed/);
    const stranger = await asNewUser(f.t, "stranger@example.com");
    await expect(stranger.client.query(api.adMonitoring.view, { slug: f.slug, campaignId: f.campaignId })).rejects.toThrow();
    const other = await stranger.client.mutation(api.orgs.createWorkspace, { businessName: "Other tenant" });
    await expect(stranger.client.mutation(api.adMonitoring.configure, { slug: other.slug, campaignId: f.campaignId, enabled: true, expectedTermsHash: terms })).rejects.toThrow();
    await change(f, "role");
    await expect(f.enable()).rejects.toThrow(/role/);
  });
  it.each(["google_ads", "meta_ads"] as const)("%s reads account-local spend then pauses exactly once at the approved total", async provider => {
    const f = await fixture(provider);
    const mock = mockProvider(provider);
    await f.enable();
    expect(mock.calls).toHaveLength(0);
    await f.check();
    await f.check();
    expect(mock.writes()).toHaveLength(1);
    expect(mock.writes()[0].body).toContain("PAUSED");
    expect(await f.row()).toMatchObject({ status: "paused", monitorStatus: "paused", monitorSpendMinor: 30000, monitorTimeZone: "Pacific/Honolulu", monitorWindowEnd: "2026-11-15" });
    const receipts = await f.t.run(ctx => ctx.db.query("actionReceipts").collect());
    expect(receipts).toHaveLength(1);
    expect(receipts[0]).toMatchObject({ orgId: f.org._id, campaignId: f.campaignId, status: "verified", action: "monitor_pause" });
  });
  it.each(["google_ads", "meta_ads"] as const)("%s below-limit spend and missing conversions never trigger a pause", async provider => {
    const f = await fixture(provider);
    const mock = mockProvider(provider, { spend: provider === "google_ads" ? "299999999" : "299.99" });
    await f.enable(); await f.check();
    expect(mock.writes()).toHaveLength(0);
    expect(await f.row()).toMatchObject({ status: "active", monitorStatus: "below_limit", monitorSpendMinor: 29999 });
  });
  it.each(["account", "provider", "campaign", "content", "budget", "scope", "policy", "role", "expiry", "emergency stop", "pause permission"])("stops a changed %s before reading", async kind => {
    const f = await fixture(); const mock = mockProvider("google_ads");
    await f.enable(); await change(f, kind); await f.check();
    expect(mock.calls).toHaveLength(0);
    expect(await f.row()).toMatchObject({ monitorStatus: "needs_review" });
    expect((await f.row())?.monitorNextAt).toBeUndefined();
  });
  it.each(["account", "campaign", "content", "budget", "policy", "role", "expiry", "disable", "stale read", "emergency stop", "pause permission"])("rechecks %s during the provider read before claiming a pause", async kind => {
    const f = await fixture();
    const mock = mockProvider("google_ads", { duringRead: () => change(f, kind) });
    await f.enable(); await f.check();
    expect(mock.writes()).toHaveLength(0);
    expect((await f.row())?.status).toBe("active");
  });
  it.each(["unknown timezone", "wrong currency", "empty", "truncated", "missing spend"])("keeps %s unknown without a write", async kind => {
    const f = await fixture();
    const mock = mockProvider("google_ads", kind === "unknown timezone" ? { zone: "" } : kind === "wrong currency" ? { currency: "EUR" } : { report: kind === "empty" ? { results: [] } : { results: [{ campaign: { id: "42" }, segments: { date: "2026-11-15" }, metrics: { ...(kind === "missing spend" ? {} : { costMicros: "300000000" }), clicks: 0, impressions: 0 } }], ...(kind === "truncated" ? { nextPageToken: "same" } : {}) } });
    await f.enable(); await f.check();
    expect(mock.writes()).toHaveLength(0);
    expect(await f.row()).toMatchObject({ status: "active", monitorStatus: "needs_review" });
    expect((await f.row())?.monitorSpendMinor).toBeUndefined();
  });
  it("never accesses real providers for a demo monitor", async () => {
    const f = await fixture(); const mock = mockProvider("google_ads");
    await f.t.run(ctx => ctx.db.patch(f.org._id, { kind: "demo" }));
    await f.enable(); await f.check();
    expect(mock.calls).toHaveLength(0);
    expect(await f.row()).toMatchObject({ monitorStatus: "needs_review", monitorMessage: expect.stringMatching(/Demo/) });
    expect((await f.row())?.monitorNextAt).toBeUndefined();
  });
  it("reports malformed credentials without exposing their contents", async () => {
    const f = await fixture(); await f.enable();
    await f.t.mutation(internal.connections.storeConnection, { orgId: f.org._id, userId: f.owner.userId, provider: "google_ads", secret: "private-credential-fragment", secretKind: "oauth", scopes: ["https://www.googleapis.com/auth/adwords"], externalAccountId: "1234567890" });
    const mock = mockProvider("google_ads"); await f.check();
    expect(mock.calls).toHaveLength(0);
    expect((await f.row())?.monitorMessage).toBe("The ad account credentials are unavailable. Reconnect the account.");
  });
  it("does not expose or invalidate another workspace's linked account or approval", async () => {
    const f = await fixture(); await f.enable();
    const other = await asNewUser(f.t, "other-owner@example.com");
    const workspace = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Other workspace" });
    const foreignApprovalId = await f.t.run(async ctx => {
      const org = (await ctx.db.query("organizations").withIndex("by_slug", q => q.eq("slug", workspace.slug)).unique())!;
      const c = (await ctx.db.get(f.campaignId))!;
      const { _id: _a, _creationTime: _at, ...approval } = (await ctx.db.get(c.monitorApprovalId!))!;
      const { _id: _c, _creationTime: _ct, ...connection } = f.connection;
      const aid = await ctx.db.insert("approvals", { ...approval, orgId: org._id });
      const cid = await ctx.db.insert("connections", { ...connection, orgId: org._id, externalAccountId: "private-other-account" });
      await ctx.db.patch(c._id, { monitorApprovalId: aid, connectionId: cid });
      return aid;
    });
    expect((await f.view()).accountId).toBeNull();
    const mock = mockProvider("google_ads");
    await f.check(); await f.disable();
    expect(mock.calls).toHaveLength(0);
    expect(await f.t.run(ctx => ctx.db.get(foreignApprovalId))).toMatchObject({ status: "approved" });
  });
  it("invalidates consent when the reviewed artifact version changes", async () => {
    const f = await fixture();
    const artifact = await f.t.run(async ctx => {
      const business = (await ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", f.org._id)).first())!;
      const id = await ctx.db.insert("artifacts", { orgId: f.org._id, businessId: business._id, kind: "ad", channel: "google_search_ad", title: "Ad copy", status: "draft", currentVersion: 1, createdAt: Date.now(), updatedAt: Date.now() });
      const version = await ctx.db.insert("artifactVersions", { orgId: f.org._id, artifactId: id, version: 1, body: "Reviewed copy", hashtags: [], claimFactIds: [], unsupportedClaims: [], contentHash: "first", createdAt: Date.now() });
      await ctx.db.patch(id, { currentVersionId: version });
      await ctx.db.patch(f.campaignId, { artifactId: id });
      return id;
    });
    await f.enable();
    await f.t.run(async ctx => {
      const next = await ctx.db.insert("artifactVersions", { orgId: f.org._id, artifactId: artifact, version: 2, body: "Changed copy", hashtags: [], claimFactIds: [], unsupportedClaims: [], contentHash: "second", createdAt: Date.now() });
      await ctx.db.patch(artifact, { currentVersionId: next, currentVersion: 2 });
    });
    const mock = mockProvider("google_ads"); await f.check();
    expect(mock.calls).toHaveLength(0);
    expect(await f.row()).toMatchObject({ monitorStatus: "needs_review" });
  });
  it.each(["google_ads", "meta_ads"] as const)("%s uncertain or wrong-identity read-back cannot be replayed; reconciliation is read-only", async provider => {
    const f = await fixture(provider);
    const mock = mockProvider(provider, { readId: "99" });
    await f.enable(); await f.check();
    expect(await f.row()).toMatchObject({ status: "uncertain", monitorStatus: "uncertain" });
    await expect(f.enable()).rejects.toThrow(/unresolved/);
    vi.setSystemTime(Date.now() + 16 * 60_000);
    await f.check();
    expect(mock.writes()).toHaveLength(1);
    expect(await f.owner.client.action(api.adMonitoring.reconcilePause, { slug: f.slug, campaignId: f.campaignId })).toEqual({ paused: false });
    const active = mockProvider(provider, { readStatus: "ACTIVE" });
    expect(await f.owner.client.action(api.adMonitoring.reconcilePause, { slug: f.slug, campaignId: f.campaignId })).toEqual({ paused: false });
    expect(active.writes()).toHaveLength(0);
    const paused = mockProvider(provider);
    expect(await f.owner.client.action(api.adMonitoring.reconcilePause, { slug: f.slug, campaignId: f.campaignId })).toEqual({ paused: true });
    expect(paused.writes()).toHaveLength(0);
    expect(await f.row()).toMatchObject({ status: "paused", monitorStatus: "paused" });
  });
  it("claims only one pause and blocks reconfiguration after a worker stops before recording a result", async () => {
    const f = await fixture(); await f.enable();
    const cx = await f.t.mutation(internal.adMonitoring.claimCheck, { campaignId: f.campaignId });
    const args = { campaignId: f.campaignId, approvalId: cx!.approval!._id, checkStartedAt: cx!.campaign.monitorCheckStartedAt!, spendMinor: 30000, timeZone: "UTC" };
    expect(await f.t.mutation(internal.adMonitoring.observe, args)).not.toBeNull();
    expect(await f.t.mutation(internal.adMonitoring.observe, args)).toBeNull();
    await expect(f.disable()).rejects.toThrow(/unresolved/);
    vi.setSystemTime(Date.now() + 16 * 60_000);
    expect(await f.t.mutation(internal.adMonitoring.claimCheck, { campaignId: f.campaignId })).toBeNull();
    await change(f, "role");
    await expect(f.owner.client.mutation(internal.adMonitoring.finishPause, { campaignId: f.campaignId, approvalId: args.approvalId, status: "verified", message: "Read confirmed", reconciled: true })).rejects.toThrow(/role/);
  });
});
