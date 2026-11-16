import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";

async function fixture(provider: "google_ads" | "meta_ads") {
  const t = setup();
  const owner = await asNewUser(t, "report-owner@example.com");
  const { slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Report fixture" });
  const org = await t.run(ctx => ctx.db.query("organizations").withIndex("by_slug", q => q.eq("slug", slug)).unique());
  await t.mutation(internal.connections.storeConnection, { orgId: org!._id, userId: owner.userId, provider, secret: JSON.stringify({ accessToken: "synthetic-token-never-sent" }), secretKind: "oauth", scopes: provider === "meta_ads" ? ["ads_read"] : ["https://www.googleapis.com/auth/adwords"], externalAccountId: "1234567890" });
  const connection = await t.run(ctx => ctx.db.query("connections").withIndex("by_org_provider", q => q.eq("orgId", org!._id).eq("provider", provider)).first());
  const campaignId = await t.run(ctx => ctx.db.insert("campaigns", { orgId: org!._id, channel: provider === "meta_ads" ? "meta_ad" : "google_search_ad", name: "Report campaign", status: "active", currency: "USD", dailyBudgetMinor: 1000, budgetEnvelopeMinor: 30000, budgetUnitVersion: "currency-minor-v1", startDate: "2026-11-01", endDate: "2026-11-30", stopRules: [], externalId: "42", connectionId: connection!._id, activatedAt: Date.parse("2026-11-01T12:00:00Z"), createdAt: Date.now(), updatedAt: Date.now() }));
  return { t, owner, org: org!, slug, campaignId, connection: connection!, sync: () => owner.client.action(api.adPerformance.syncPerformance, { slug, campaignId }), snapshot: () => t.run(ctx => ctx.db.query("campaignPerformance").withIndex("by_org_campaign", q => q.eq("orgId", org!._id).eq("campaignId", campaignId)).first()) };
}

const googleRow = () => ({ campaign: { id: "42", name: "Report campaign" }, segments: { date: "2026-11-14" }, metrics: { costMicros: "1230000", clicks: "4", impressions: "100", conversions: 2, conversionsValue: 12 } });
const metaRow = () => ({ campaign_id: "42", date_start: "2026-11-14", spend: "1.23", clicks: "4", impressions: "100", account_currency: "USD", actions: [{ action_type: "lead", value: "2" }] });
function mockReports(provider: "google_ads" | "meta_ads", report: Record<string, unknown>, zone = "Pacific/Honolulu") {
  const calls: Array<{ url: string; body: string; method: string }> = [];
  vi.stubGlobal("fetch", vi.fn(async (url: unknown, init?: RequestInit) => {
    const call = { url: String(url), body: String(init?.body ?? ""), method: init?.method ?? "GET" };
    calls.push(call);
    const account = provider === "google_ads" ? call.body.includes("customer.currency_code") : !call.url.includes("/insights");
    const data = account ? provider === "google_ads" ? { results: [{ customer: { currencyCode: "USD", timeZone: zone } }] } : { currency: "USD", timezone_name: zone, spend_cap: "0", amount_spent: "0" } : report;
    return new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } });
  }));
  return calls;
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-16T01:00:00Z")); vi.stubEnv("GOOGLE_ADS_DEVELOPER_TOKEN", "synthetic-developer-token"); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllTimers(); vi.useRealTimers(); });

describe("campaign report integrity before performance decisions", () => {
  it.each(["empty", "missing spend", "duplicate day", "truncated", "malformed row"])("rejects a Google %s report rather than saving a usable total", async kind => {
    const f = await fixture("google_ads");
    const row = googleRow();
    if (kind === "missing spend") delete (row.metrics as Record<string, unknown>).costMicros;
    mockReports("google_ads", { results: kind === "empty" ? [] : kind === "duplicate day" ? [row, row] : kind === "malformed row" ? [row, null] : [row], ...(kind === "truncated" ? { nextPageToken: "repeated" } : {}) });
    await expect(f.sync()).rejects.toThrow();
    expect(await f.snapshot()).toBeNull();
  });

  it.each(["missing row currency", "duplicate day", "negative spend", "truncated", "missing cursor", "malformed row"])("rejects a Meta %s report", async kind => {
    const f = await fixture("meta_ads");
    const row = metaRow();
    if (kind === "missing row currency") delete (row as Record<string, unknown>).account_currency;
    if (kind === "negative spend") row.spend = "-1";
    const other = { ...metaRow(), date_start: "2026-11-13" };
    mockReports("meta_ads", { data: kind === "duplicate day" ? [row, row] : kind === "malformed row" ? [row, null] : [row, other], ...(["truncated", "missing cursor"].includes(kind) ? { paging: { next: "https://graph.facebook.com/next", ...(kind === "truncated" ? { cursors: { after: "repeated" } } : {}) } } : {}) });
    await expect(f.sync()).rejects.toThrow();
    expect(await f.snapshot()).toBeNull();
  });

  it.each(["google_ads", "meta_ads"] as const)("uses %s account-local completed dates and preserves source identity without external writes", async provider => {
    const f = await fixture(provider);
    const calls = mockReports(provider, provider === "google_ads" ? { results: [googleRow()] } : { data: [metaRow()] });
    const result = await f.sync();
    expect(result.endDate).toBe("2026-11-14");
    expect(await f.snapshot()).toMatchObject({ spendMinor: 123, timeZone: "Pacific/Honolulu", externalAccountId: "1234567890", externalCampaignId: "42", validationVersion: 1, rowCount: 1 });
    expect(calls.every(c => provider === "meta_ads" ? c.method === "GET" : c.url.endsWith("googleAds:search"))).toBe(true);
    expect(await f.t.run(ctx => ctx.db.query("actionReceipts").collect())).toHaveLength(0);
    expect(await f.t.run(ctx => ctx.db.query("approvals").collect())).toHaveLength(0);
    expect(await f.t.run(ctx => ctx.db.get(f.campaignId))).toMatchObject({ status: "active" });
  });

  it.each(["google_ads", "meta_ads"] as const)("refuses an unknown %s timezone instead of inventing UTC", async provider => {
    const f = await fixture(provider);
    mockReports(provider, provider === "google_ads" ? { results: [googleRow()] } : { data: [metaRow()] }, "");
    await expect(f.sync()).rejects.toThrow(/timezone|time zone/i);
    expect(await f.snapshot()).toBeNull();
  });

  it("retains unavailable conversions as unknown instead of a zero-efficiency signal", async () => {
    const f = await fixture("google_ads");
    const row = googleRow();
    delete (row.metrics as Record<string, unknown>).conversions;
    delete (row.metrics as Record<string, unknown>).conversionsValue;
    mockReports("google_ads", { results: [row] });
    await f.sync();
    expect(await f.snapshot()).toMatchObject({ spendMinor: 123 });
    expect((await f.snapshot())?.conversions).toBeUndefined();
    expect((await f.snapshot())?.conversionValueMinor).toBeUndefined();
  });

  it("preserves the previous report after a failed read and withholds it after an account change", async () => {
    const f = await fixture("google_ads");
    mockReports("google_ads", { results: [googleRow()] });
    await f.sync();
    const before = await f.snapshot();
    mockReports("google_ads", { results: [] });
    await expect(f.sync()).rejects.toThrow();
    expect(await f.snapshot()).toEqual(before);
    await f.t.run(ctx => ctx.db.patch(f.connection._id, { externalAccountId: "9999999999" }));
    const listed = await f.owner.client.query(api.ads.list, { slug: f.slug });
    expect(listed.campaigns[0]).toMatchObject({ performance: null, performanceReviewReason: expect.stringMatching(/account changed/) });
    expect(await f.snapshot()).toEqual(before);
  });

  it.each(["account", "campaign", "membership"] as const)("rejects a changed %s during retrieval before saving the report", async changed => {
    const f = await fixture("google_ads");
    vi.stubGlobal("fetch", vi.fn(async (_url: unknown, init?: RequestInit) => {
      const account = String(init?.body).includes("customer.currency_code");
      if (!account) await f.t.run(async ctx => {
        if (changed === "account") await ctx.db.patch(f.connection._id, { externalAccountId: "9999999999" });
        else if (changed === "campaign") await ctx.db.patch(f.campaignId, { externalId: "99" });
        else {
          const member = (await ctx.db.query("memberships").withIndex("by_org_user", q => q.eq("orgId", f.org._id).eq("userId", f.owner.userId)).first())!;
          await ctx.db.delete(member._id);
        }
      });
      return new Response(JSON.stringify(account ? { results: [{ customer: { currencyCode: "USD", timeZone: "UTC" } }] } : { results: [googleRow()] }), { status: 200 });
    }));
    await expect(f.sync()).rejects.toThrow(changed === "membership" ? /couldn't find|access|member/i : /account changed/);
    expect(await f.snapshot()).toBeNull();
  });

  it("does not let a slower earlier request overwrite a newer report", async () => {
    const f = await fixture("google_ads");
    mockReports("google_ads", { results: [googleRow()] });
    await f.sync();
    const before = (await f.snapshot())!;
    await expect(f.owner.client.mutation(internal.ads.recordPerformanceSnapshot, { slug: f.slug, campaignId: f.campaignId, connectionId: f.connection._id, source: "google_ads", status: "ready", startDate: before.startDate, endDate: before.endDate, currency: "USD", requestedAt: before.requestedAt! - 100, timeZone: before.timeZone!, externalAccountId: "1234567890", externalCampaignId: "42", rowCount: 1, spendMinor: 1, clicks: 1, impressions: 1 })).rejects.toThrow(/newer report/);
    expect(await f.snapshot()).toEqual(before);
  });

  it("requires a refresh of pre-validation reports without rewriting their stored amounts", async () => {
    const f = await fixture("google_ads");
    mockReports("google_ads", { results: [googleRow()] });
    await f.sync();
    const saved = (await f.snapshot())!;
    await f.t.run(ctx => ctx.db.patch(saved._id, { validationVersion: undefined }));
    const listed = await f.owner.client.query(api.ads.list, { slug: f.slug });
    expect(listed.campaigns[0]).toMatchObject({ performance: null, performanceReviewReason: expect.stringMatching(/older report/) });
    expect((await f.snapshot())?.spendMinor).toBe(123);
  });
});
