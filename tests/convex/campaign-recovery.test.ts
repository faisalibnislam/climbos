import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { asNewUser, makePaid, setup } from "./helpers";

type Provider = "google_ads" | "meta_ads";
async function fixture(provider: Provider = "google_ads", action: "create_paused" | "activate" = "create_paused", claim = true) {
  const t = setup(); const owner = await asNewUser(t, "recovery@example.com");
  const { slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Recovery fixture" });
  const org = (await t.run(ctx => ctx.db.query("organizations").withIndex("by_slug", q => q.eq("slug", slug)).unique()))!;
  await makePaid(t, org._id);
  await t.run(async ctx => {
    const policy = (await ctx.db.query("autonomyPolicies").withIndex("by_org_active", q => q.eq("orgId", org._id).eq("active", true)).first())!;
    await ctx.db.patch(policy._id, { mode: "review", maxMonthlyAdSpendMinor: 100000 });
  });
  await t.mutation(internal.connections.storeConnection, { orgId: org._id, userId: owner.userId, provider, secret: JSON.stringify({ accessToken: "synthetic-token" }), secretKind: "oauth", scopes: provider === "google_ads" ? ["https://www.googleapis.com/auth/adwords"] : ["ads_read", "ads_management"], externalAccountId: "1234567890" });
  const connection = (await t.run(ctx => ctx.db.query("connections").withIndex("by_org_provider", q => q.eq("orgId", org._id).eq("provider", provider)).first()))!;
  const campaignId = await t.run(ctx => ctx.db.insert("campaigns", { orgId: org._id, channel: provider === "google_ads" ? "google_search_ad" : "meta_ad", name: "Reviewed campaign", status: action === "activate" ? "created_paused" : "needs_approval", currency: "USD", budgetUnitVersion: "currency-minor-v1", dailyBudgetMinor: 1000, budgetEnvelopeMinor: 5000, startDate: "2026-11-16", endDate: "2026-11-20", stopRules: [], connectionId: connection._id, ...(action === "activate" ? { externalId: "42" } : {}), createdAt: Date.now(), updatedAt: Date.now() }));
  await owner.client.mutation(api.ads.decide, { slug, campaignId, action });
  const approval = (await t.run(ctx => ctx.db.query("approvals").withIndex("by_subject", q => q.eq("subjectType", "campaign_activation").eq("subjectId", campaignId)).first()))!;
  if (claim) await t.mutation(internal.ads.claimCampaignWrite, { campaignId, approvalId: approval._id });
  return { t, owner, org, slug, provider, connection, campaignId, approvalId: approval._id, action,
    recover: () => owner.client.action(api.ads.checkProviderResult, { slug, campaignId, approvalId: approval._id }),
    row: () => t.run(ctx => ctx.db.get(campaignId)), request: () => t.run(ctx => ctx.db.get(approval._id)),
    receipts: () => t.run(ctx => ctx.db.query("actionReceipts").withIndex("by_org_created", q => q.eq("orgId", org._id)).collect()),
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
function later() { vi.setSystemTime(Date.now() + 6 * 60_000); }
function mock(f: Fixture, options: { status?: string; id?: string; empty?: boolean; duplicate?: boolean; truncated?: boolean; duringRead?: () => Promise<void> } = {}) {
  const calls: Array<{ url: string; body: string; method: string }> = [];
  vi.stubGlobal("fetch", vi.fn(async (url: unknown, init?: RequestInit) => {
    const call = { url: String(url), body: String(init?.body ?? ""), method: init?.method ?? "GET" }; calls.push(call);
    const name = (await f.request())?.campaignProviderName ?? "Reviewed campaign";
    const state = { id: options.id ?? "42", name, status: options.status ?? (f.action === "create_paused" ? "PAUSED" : f.provider === "google_ads" ? "ENABLED" : "ACTIVE") };
    await options.duringRead?.();
    let data: unknown;
    if (f.provider === "google_ads") {
      if (call.body.includes("customer.currency_code")) data = { results: [{ customer: { currencyCode: "USD", timeZone: "UTC" } }] };
      else if (call.url.endsWith("googleAds:mutate")) data = { mutateOperationResponses: [{ campaignResult: { resourceName: "customers/1234567890/campaigns/42" } }] };
      else if (call.url.endsWith("campaigns:mutate")) data = {};
      else data = { results: options.empty ? [] : options.duplicate ? [{ campaign: state }, { campaign: state }] : [{ campaign: state }], ...(options.truncated ? { nextPageToken: "repeat" } : {}) };
    } else {
      if (call.method === "POST") data = { id: "42", success: true };
      else if (call.url.includes("/campaigns?")) data = { data: options.empty ? [] : options.duplicate ? [state, { ...state, id: "43" }] : [state], ...(options.truncated ? { paging: { next: "https://graph.facebook.com/next", cursors: { after: "repeat" } } } : {}) };
      else if (call.url.includes("/act_")) data = { currency: "USD", timezone_name: "UTC" };
      else data = options.empty ? {} : state;
    }
    return new Response(JSON.stringify(data), { status: 200 });
  }));
  return { calls, writes: () => calls.filter(c => f.provider === "google_ads" ? c.url.endsWith(":mutate") : c.method === "POST") };
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-16T12:00Z")); vi.stubEnv("GOOGLE_ADS_DEVELOPER_TOKEN", "synthetic-developer-token"); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllTimers(); vi.useRealTimers(); });

describe("read-only interrupted campaign recovery", () => {
  it.each(["google_ads", "meta_ads"] as const)("persists a unique request reference before creating on %s", async provider => {
    const f = await fixture(provider, "create_paused", false); const m = mock(f);
    await f.t.action(internal.ads.executeCampaignWrite, { campaignId: f.campaignId, approvalId: f.approvalId });
    const request = (await f.request())!;
    expect(request.campaignProviderName).toBe(`Reviewed campaign [ClimbOS ${f.approvalId}]`);
    expect(request.executionOutcome).toBe("verified");
    expect(m.writes()).toHaveLength(1);
    expect(decodeURIComponent(m.writes()[0].body).replaceAll("+", " ")).toContain(request.campaignProviderName);
    expect(await f.row()).toMatchObject({ status: "created_paused", externalId: "42" });
  });
  it.each(["google_ads", "meta_ads"] as const)("recovers %s creation after a worker disappears, without any write", async provider => {
    const f = await fixture(provider); const m = mock(f); later();
    expect((await f.recover()).confirmed).toBe(true);
    expect(m.writes()).toHaveLength(0);
    expect(await f.row()).toMatchObject({ status: "created_paused", externalId: "42" });
    expect(await f.request()).toMatchObject({ status: "consumed", executionReconciledAt: Date.now() });
    expect(await f.receipts()).toMatchObject([{ action: "reconcile_create_paused", status: "verified" }]);
    // Late original responses cannot undo the recovered state or add another receipt.
    await f.t.mutation(internal.ads.recordCampaignResult, { campaignId: f.campaignId, approvalId: f.approvalId, action: "create_paused", status: "uncertain", newStatus: "uncertain", summary: "Late response" });
    expect((await f.row())?.status).toBe("created_paused");
    expect(await f.receipts()).toHaveLength(1);
    await f.t.action(internal.ads.executeCampaignWrite, { campaignId: f.campaignId, approvalId: f.approvalId });
    expect(m.writes()).toHaveLength(0);
  });
  it.each(["google_ads", "meta_ads"] as const)("recovers %s activation by the approved ID without inventing its start time", async provider => {
    const f = await fixture(provider, "activate"); const m = mock(f); later();
    expect((await f.recover()).confirmed).toBe(true);
    expect(m.writes()).toHaveLength(0);
    expect((await f.row())?.status).toBe("active");
    expect((await f.row())?.activatedAt).toBeUndefined();
  });
  it.each(["google_ads", "meta_ads"] as const)("preserves %s empty, ambiguous and truncated results as unresolved", async provider => {
    for (const kind of ["empty", "duplicate", "truncated"] as const) {
      const f = await fixture(provider); const m = mock(f, { [kind]: true }); later();
      expect((await f.recover()).confirmed).toBe(false);
      expect(m.writes()).toHaveLength(0);
      expect((await f.request())?.executionFinishedAt).toBeUndefined();
      expect((await f.row())?.externalId).toBeUndefined();
      await expect(f.owner.client.mutation(api.ads.decide, { slug: f.slug, campaignId: f.campaignId, action: "create_paused" })).rejects.toThrow(/already started/);
    }
  });
  it.each(["google_ads", "meta_ads"] as const)("does not clear a %s start request from a paused or wrong-identity observation", async provider => {
    const f = await fixture(provider, "activate"); later();
    let m = mock(f, { status: "PAUSED" });
    expect((await f.recover()).confirmed).toBe(false); expect(m.writes()).toHaveLength(0);
    m = mock(f, { id: "99" });
    expect((await f.recover()).confirmed).toBe(false); expect(m.writes()).toHaveLength(0);
    expect((await f.request())?.executionFinishedAt).toBeUndefined();
  });
  it("does not guess an older creation identity from its reusable title", async () => {
    const f = await fixture(); await f.t.run(ctx => ctx.db.patch(f.approvalId, { campaignProviderName: undefined }));
    const m = mock(f); later();
    expect(await f.recover()).toMatchObject({ confirmed: false, message: expect.stringMatching(/older request/) });
    expect(m.calls).toHaveLength(0);
  });
  it("can recover a legacy uncertain response with a recorded exact provider ID while keeping its original receipt", async () => {
    const f = await fixture();
    await f.t.mutation(internal.ads.recordCampaignResult, { campaignId: f.campaignId, approvalId: f.approvalId, action: "create_paused", status: "uncertain", newStatus: "uncertain", externalId: "42", summary: "Response unknown" });
    await f.t.run(ctx => ctx.db.patch(f.approvalId, { campaignProviderName: undefined, executionExternalId: undefined, executionOutcome: undefined }));
    const m = mock(f); later(); expect((await f.recover()).confirmed).toBe(true);
    expect(m.writes()).toHaveLength(0);
    expect((await f.receipts()).map(r => r.status)).toEqual(["uncertain", "verified"]);
  });
  it("records an original result once and requires a separate read to resolve uncertainty", async () => {
    const f = await fixture();
    const args = { campaignId: f.campaignId, approvalId: f.approvalId, action: "create_paused" };
    await f.t.mutation(internal.ads.recordCampaignResult, { ...args, status: "uncertain", newStatus: "uncertain", externalId: "42", summary: "Initial uncertainty" });
    const original = await f.request();
    await f.t.mutation(internal.ads.recordCampaignResult, { ...args, status: "verified", newStatus: "created_paused", externalId: "42", summary: "Duplicate callback" });
    expect(await f.request()).toEqual(original);
    expect(await f.receipts()).toHaveLength(1);
    expect((await f.row())?.status).toBe("uncertain");
  });
  it.each(["account", "terms"])("does not apply a late successful result after changed %s", async kind => {
    const f = await fixture();
    await f.t.run(async ctx => {
      if (kind === "account") await ctx.db.patch(f.connection._id, { externalAccountId: "9999999999" });
      else await ctx.db.patch(f.campaignId, { name: "Changed campaign" });
    });
    await f.t.mutation(internal.ads.recordCampaignResult, { campaignId: f.campaignId, approvalId: f.approvalId, action: "create_paused", status: "verified", newStatus: "created_paused", externalId: "42", summary: "Created" });
    expect(await f.request()).toMatchObject({ status: "invalidated", executionOutcome: "uncertain", executionExternalId: "42" });
    expect(await f.row()).toMatchObject({ status: "uncertain" });
    expect((await f.row())?.externalId).toBeUndefined();
    expect(await f.receipts()).toMatchObject([{ status: "uncertain", provider: "google_ads", externalId: "42", summary: expect.stringMatching(/changed while/) }]);
  });
  it("waits five minutes, requires current permission and refuses another tenant", async () => {
    const f = await fixture(); const m = mock(f);
    await expect(f.recover()).rejects.toThrow(/five minutes/);
    const stranger = await asNewUser(f.t, "stranger@example.com");
    await expect(stranger.client.action(api.ads.checkProviderResult, { slug: f.slug, campaignId: f.campaignId, approvalId: f.approvalId })).rejects.toThrow();
    later(); await f.t.run(async ctx => {
      const member = (await ctx.db.query("memberships").withIndex("by_org_user", q => q.eq("orgId", f.org._id).eq("userId", f.owner.userId)).first())!;
      await ctx.db.patch(member._id, { role: "viewer" });
    });
    await expect(f.recover()).rejects.toThrow(/role/); expect(m.calls).toHaveLength(0);
  });
  it.each(["account", "terms", "permission", "stale"])("rechecks %s after the provider read", async kind => {
    const f = await fixture(); later();
    mock(f, { duringRead: async () => {
      if (kind === "stale") { later(); return; }
      await f.t.run(async ctx => {
        if (kind === "account") await ctx.db.patch(f.connection._id, { externalAccountId: "9999999999" });
        if (kind === "terms") await ctx.db.patch(f.campaignId, { name: "Changed" });
        if (kind === "permission") {
          const member = (await ctx.db.query("memberships").withIndex("by_org_user", q => q.eq("orgId", f.org._id).eq("userId", f.owner.userId)).first())!;
          await ctx.db.patch(member._id, { role: "viewer" });
        }
      });
    } });
    await expect(f.recover()).rejects.toThrow();
    expect((await f.request())?.executionReconciledAt).toBeUndefined();
    expect((await f.row())?.status).toBe("needs_approval");
  });
  it("allows a read after approval expiry or emergency stop without authorizing another action", async () => {
    const f = await fixture();
    await f.t.run(ctx => ctx.db.patch(f.org._id, { emergencyStop: { active: true, at: Date.now(), by: f.owner.userId } }));
    vi.setSystemTime(Date.now() + 25 * 3_600_000);
    const m = mock(f); expect((await f.recover()).confirmed).toBe(true); expect(m.writes()).toHaveLength(0);
  });
  it("refuses provider reads for demo campaigns", async () => {
    const f = await fixture(); await f.t.run(ctx => ctx.db.patch(f.org._id, { kind: "demo" }));
    const m = mock(f); later(); await expect(f.recover()).rejects.toThrow(/Demo/); expect(m.calls).toHaveLength(0);
  });
});
