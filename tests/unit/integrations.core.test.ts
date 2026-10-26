import { describe, expect, it, vi } from "vitest";
import { evaluateCapabilities, evaluateCapability, type CapabilityContext } from "../../shared/integrations/capabilities";
import { buildManualExportPack, countForPlatform, manualExportToCsv, platformsNeedingManualExport, PLATFORM_LIMITS } from "../../shared/integrations/drafts";
import { collectPages, HARD_MAX_PAGES } from "../../shared/integrations/http";
import {
  buildAuthorizationUrl,
  buildCodeExchangeRequest,
  buildRefreshRequest,
  buildRevocationRequest,
  computeS256Challenge,
  createPkcePair,
  generateState,
  OAUTH_PROVIDERS,
  CAPABILITY_SCOPES,
  parseTokenResponse,
  scopesFor,
  timingSafeEqual,
} from "../../shared/integrations/oauth";
import { parseRateLimit, parseRetryAfter, RetryableReadError, withBackoff } from "../../shared/integrations/ratelimit";
import { PROVIDERS, VERIFIED_AT } from "../../shared/integrations/registry";
import { CAPABILITY_STATES, type ProviderId } from "../../shared/integrations/types";

const NOW = Date.UTC(2026, 9, 17, 12, 0, 0);
const GOOGLE_ENV = { GOOGLE_OAUTH_CLIENT_ID: "id", GOOGLE_OAUTH_CLIENT_SECRET: "secret", GOOGLE_ADS_ACCESS_LEVEL: "basic" };
const IG_ENV = { INSTAGRAM_APP_ID: "a", INSTAGRAM_APP_SECRET: "b" };

function ctx(partial: Partial<CapabilityContext>): CapabilityContext {
  return { env: {}, connected: true, now: NOW, ...partial };
}

describe("evaluateCapabilities", () => {
  it("requests the least scopes needed for optional Instagram post insights", () => {
    expect(CAPABILITY_SCOPES["instagram.read_insights"]).toEqual(["instagram_business_basic", "instagram_business_manage_insights"]);
  });
  it("returns only the exact state strings with reason and fix", () => {
    for (const id of Object.keys(PROVIDERS) as ProviderId[]) {
      for (const e of evaluateCapabilities(id, ctx({}))) {
        expect(CAPABILITY_STATES).toContain(e.state);
        expect(e.reason.length).toBeGreaterThan(5);
        expect(e.fix.length).toBeGreaterThan(5);
      }
    }
  });

  it("missing env → setup_needed", () => {
    const evals = evaluateCapabilities("google_ads", ctx({ env: {} }));
    expect(evals.every((e) => e.state === "setup_needed")).toBe(true);
    expect(evals[0]?.fix).toContain("GOOGLE_OAUTH_CLIENT_ID");
    expect(evals[0]?.fix).not.toContain("GOOGLE_ADS_DEVELOPER_TOKEN");
  });

  it("Google Ads no longer needs a developer token env var", () => {
    const scopes = ["https://www.googleapis.com/auth/adwords"];
    expect(PROVIDERS.google_ads.requiredEnv).not.toContain("GOOGLE_ADS_DEVELOPER_TOKEN");
    expect(PROVIDERS.google_ads.requiredEnv).toContain("GOOGLE_ADS_ACCESS_LEVEL");
    expect(evaluateCapability("google_ads", "google_ads.read_metrics", ctx({ env: GOOGLE_ENV, grantedScopes: scopes })).state).toBe("ready");
  });

  it("not connected → setup_needed", () => {
    expect(evaluateCapability("ga4", "ga4.read_reports", ctx({ env: GOOGLE_ENV, connected: false })).state).toBe("setup_needed");
  });

  it("Google Ads test access on a production account → provider_review_pending", () => {
    const scopes = ["https://www.googleapis.com/auth/adwords"];
    const e = evaluateCapability("google_ads", "google_ads.read_metrics", ctx({ env: { ...GOOGLE_ENV, GOOGLE_ADS_ACCESS_LEVEL: "test" }, grantedScopes: scopes, googleAdsAccountIsTest: false }));
    expect(e.state).toBe("provider_review_pending");
    expect(e.reason).toMatch(/test accounts/);
    // Test access on a test account is fine.
    expect(evaluateCapability("google_ads", "google_ads.read_metrics", ctx({ env: { ...GOOGLE_ENV, GOOGLE_ADS_ACCESS_LEVEL: "test" }, grantedScopes: scopes, googleAdsAccountIsTest: true })).state).toBe("ready");
    expect(evaluateCapability("google_ads", "google_ads.set_campaign_status", ctx({ env: GOOGLE_ENV, grantedScopes: scopes })).state).toBe("ready");
  });

  it("Instagram personal account → unsupported_account_type", () => {
    const scopes = ["instagram_business_basic", "instagram_business_content_publish"];
    expect(evaluateCapability("instagram", "instagram.publish_media", ctx({ env: IG_ENV, grantedScopes: scopes, accountType: "PERSONAL" })).state).toBe("unsupported_account_type");
    expect(evaluateCapability("instagram", "instagram.publish_media", ctx({ env: IG_ENV, grantedScopes: scopes, accountType: "Media_Creator" })).state).toBe("ready");
    expect(evaluateCapability("instagram", "instagram.publish_media", ctx({ env: IG_ENV, grantedScopes: ["instagram_business_basic"], accountType: "Business" })).state).toBe("action_required");
  });

  it("expired token without refresh → action_required; with refresh → ready", () => {
    const base = { env: GOOGLE_ENV, grantedScopes: ["https://www.googleapis.com/auth/analytics.readonly"], tokenExpiresAt: NOW - 1000 };
    expect(evaluateCapability("ga4", "ga4.read_reports", ctx(base)).state).toBe("action_required");
    expect(evaluateCapability("ga4", "ga4.read_reports", ctx({ ...base, canRefreshToken: true })).state).toBe("ready");
  });

  it("stale sync (> 48h) → sync_delayed for reads only", () => {
    const scopes = ["https://www.googleapis.com/auth/adwords"];
    const stale = ctx({ env: GOOGLE_ENV, grantedScopes: scopes, lastSyncAt: NOW - 49 * 3_600_000 });
    expect(evaluateCapability("google_ads", "google_ads.read_metrics", stale).state).toBe("sync_delayed");
    expect(evaluateCapability("google_ads", "google_ads.create_paused_campaign", stale).state).toBe("ready");
    expect(evaluateCapability("google_ads", "google_ads.read_metrics", ctx({ env: GOOGLE_ENV, grantedScopes: scopes, lastSyncAt: NOW - 47 * 3_600_000 })).state).toBe("ready");
  });

  it("marks reads delayed after the latest sync fails while keeping writes available", () => {
    const scopes = ["https://www.googleapis.com/auth/adwords"];
    const failedSync = ctx({
      env: GOOGLE_ENV,
      grantedScopes: scopes,
      lastSyncAt: NOW - 60_000,
      lastSyncError: "Temporary provider error",
    });
    const read = evaluateCapability("google_ads", "google_ads.read_metrics", failedSync);
    expect(read.state).toBe("sync_delayed");
    expect(read.reason).toMatch(/did not sync successfully/);
    expect(evaluateCapability("google_ads", "google_ads.create_paused_campaign", failedSync).state).toBe("ready");
  });

  it("Meta limited tier → approval_needed for writes; pending review → provider_review_pending", () => {
    const env = { META_APP_ID: "a", META_APP_SECRET: "b", META_ADS_ACCESS_TIER: "limited" };
    const scopes = ["ads_read", "ads_management"];
    expect(evaluateCapability("meta_ads", "meta_ads.create_paused_campaign", ctx({ env, grantedScopes: scopes })).state).toBe("approval_needed");
    expect(evaluateCapability("meta_ads", "meta_ads.create_paused_campaign", ctx({ env, grantedScopes: scopes, appReview: { ads_management: "pending" } })).state).toBe("provider_review_pending");
    expect(evaluateCapability("meta_ads", "meta_ads.read_insights", ctx({ env, grantedScopes: scopes })).state).toBe("ready");
  });

  it("outage → unavailable; Stripe secret key → action_required; Resend sending key → action_required", () => {
    expect(evaluateCapabilities("ga4", ctx({ env: GOOGLE_ENV, providerStatus: "down" }))[0]?.state).toBe("unavailable");
    expect(evaluateCapability("stripe", "stripe.import_revenue", ctx({ stripeKeyKind: "secret" })).state).toBe("action_required");
    expect(evaluateCapability("resend_marketing", "resend_marketing.send_broadcast", ctx({ resendKeyPermission: "sending_access" })).state).toBe("action_required");
  });
});

describe("registry", () => {
  it("every provider records verifiedAt and docs", () => {
    for (const p of Object.values(PROVIDERS)) {
      expect(p.verifiedAt).toBe(VERIFIED_AT);
      expect(p.docs.length).toBeGreaterThan(0);
      for (const d of p.docs) expect(d.docsUrl).toMatch(/^https:\/\//);
    }
    expect(VERIFIED_AT).toBe("2026-10-17");
  });
});

describe("OAuth + PKCE", () => {
  // RFC 7636 Appendix B (the task brief quoted a different, incorrect challenge string).
  it("matches the RFC 7636 Appendix B vector", async () => {
    expect(await computeS256Challenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("creates valid random PKCE pairs and states", async () => {
    const pair = await createPkcePair();
    expect(pair.codeVerifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    expect(pair.codeChallenge).toBe(await computeS256Challenge(pair.codeVerifier));
    expect(generateState()).not.toBe(generateState());
    await expect(computeS256Challenge("short")).rejects.toThrow();
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    expect(timingSafeEqual("abc", "abd")).toBe(false);
  });

  it("builds a Google authorization URL with state, PKCE S256 and least-privilege scopes", () => {
    const url = new URL(
      buildAuthorizationUrl({
        provider: OAUTH_PROVIDERS.google,
        clientId: "cid",
        redirectUri: "https://app.climbos.app/oauth/google",
        scopes: scopesFor(["ga4.read_reports", "search_console.read_performance"]),
        state: "s".repeat(32),
        codeChallenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
      }),
    );
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("scope")).toBe("https://www.googleapis.com/auth/analytics.readonly https://www.googleapis.com/auth/webmasters.readonly");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("state")).toBe("s".repeat(32));
  });

  it("refuses PKCE providers without a challenge, short states and non-https redirects", () => {
    const base = { provider: OAUTH_PROVIDERS.google, clientId: "c", redirectUri: "https://x.example/cb", scopes: ["a"], state: "s".repeat(32) };
    expect(() => buildAuthorizationUrl(base)).toThrow(/codeChallenge/);
    expect(() => buildAuthorizationUrl({ ...base, codeChallenge: "c", state: "short" })).toThrow(/state/);
    expect(() => buildAuthorizationUrl({ ...base, codeChallenge: "c", redirectUri: "http://x.example/cb" })).toThrow(/https/);
  });

  it("Instagram URL uses comma-separated business scopes without PKCE", () => {
    const url = new URL(
      buildAuthorizationUrl({ provider: OAUTH_PROVIDERS.instagram, clientId: "c", redirectUri: "https://x.example/cb", scopes: scopesFor(["instagram.publish_media"]), state: "s".repeat(20) }),
    );
    expect(url.hostname).toBe("www.instagram.com");
    expect(url.searchParams.get("scope")).toBe("instagram_business_basic,instagram_business_content_publish");
    expect(url.searchParams.has("code_challenge")).toBe(false);
  });

  it("builds exchange/refresh/revocation requests and parses tokens", () => {
    const ex = buildCodeExchangeRequest({ provider: OAUTH_PROVIDERS.google, clientId: "c", clientSecret: "s", code: "abc", redirectUri: "https://x/cb", codeVerifier: "v" });
    expect(new URLSearchParams(ex.body).get("code_verifier")).toBe("v");
    expect(new URLSearchParams(ex.body).get("grant_type")).toBe("authorization_code");
    const rf = buildRefreshRequest({ provider: OAUTH_PROVIDERS.google, clientId: "c", clientSecret: "s", refreshToken: "r" });
    expect(new URLSearchParams(rf.body).get("grant_type")).toBe("refresh_token");
    expect(buildRefreshRequest({ provider: OAUTH_PROVIDERS.instagram, clientId: "c", clientSecret: "s", refreshToken: "r" }).url).toContain("grant_type=ig_refresh_token");
    expect(buildRevocationRequest({ provider: OAUTH_PROVIDERS.google, token: "t" })?.url).toBe("https://oauth2.googleapis.com/revoke");
    expect(buildRevocationRequest({ provider: OAUTH_PROVIDERS.meta, token: "t" })?.method).toBe("DELETE");
    expect(buildRevocationRequest({ provider: OAUTH_PROVIDERS.instagram, token: "t" })).toBeNull();
    const parsed = parseTokenResponse({ access_token: "a", refresh_token: "r", expires_in: 3600, scope: "x y" }, 1000);
    expect(parsed).toEqual({ ok: true, token: { accessToken: "a", refreshToken: "r", expiresAt: 3_601_000, scopes: ["x", "y"] } });
    expect(parseTokenResponse({ error: "invalid_grant", error_description: "bad" })).toEqual({ ok: false, error: "invalid_grant", description: "bad" });
  });
});

describe("rate limits", () => {
  it("parses Retry-After seconds and HTTP dates", () => {
    expect(parseRetryAfter("120")).toBe(120_000);
    expect(parseRetryAfter("Sat, 17 Oct 2026 12:01:00 GMT", Date.parse("Sat, 17 Oct 2026 12:00:00 GMT"))).toBe(60_000);
    expect(parseRetryAfter("garbage")).toBeUndefined();
    expect(parseRetryAfter(undefined)).toBeUndefined();
  });

  it("parses Meta usage headers", () => {
    const h = new Headers({
      "x-app-usage": JSON.stringify({ call_count: 28, total_time: 25, total_cputime: 25 }),
      "x-business-use-case-usage": JSON.stringify({ "123": [{ type: "ads_management", call_count: 97, total_cputime: 10, total_time: 10, estimated_time_to_regain_access: 5 }] }),
    });
    expect(parseRateLimit(h)).toEqual({ quotaUsedFraction: 0.97, retryAfterMs: 300_000 });
  });

  it("parses Google RetryInfo in error bodies and IETF ratelimit headers", () => {
    const body = { error: { code: 429, status: "RESOURCE_EXHAUSTED", details: [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "30s" }] } };
    expect(parseRateLimit(new Headers(), body)).toEqual({ retryAfterMs: 30_000 });
    expect(parseRateLimit({ "RateLimit-Limit": "10", "RateLimit-Remaining": "0", "RateLimit-Reset": "1" })).toEqual({ quotaUsedFraction: 1, retryAfterMs: 1000 });
  });

  it("withBackoff retries idempotent reads with bounded jittered delays", async () => {
    const sleep = vi.fn(async () => undefined);
    let n = 0;
    const result = await withBackoff(
      async () => {
        n++;
        if (n < 3) throw new RetryableReadError("busy");
        return "ok";
      },
      { idempotent: true, sleep, random: () => 1, baseDelayMs: 100, maxDelayMs: 150 },
    );
    expect(result).toBe("ok");
    expect(sleep.mock.calls.map((c) => (c as unknown[])[0])).toEqual([100, 150]);
  });

  it("withBackoff refuses non-idempotent use and stops on non-retryable errors", async () => {
    // @ts-expect-error writes must not opt in
    await expect(withBackoff(async () => 1, { idempotent: false })).rejects.toThrow(/idempotent/);
    const fn = vi.fn(async () => {
      throw new Error("fatal");
    });
    await expect(withBackoff(fn, { idempotent: true, sleep: async () => undefined })).rejects.toThrow("fatal");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("pagination", () => {
  it("stops at maxPages and reports truncation", async () => {
    const res = await collectPages<number>(async (cursor) => ({ ok: true, data: { items: [Number(cursor ?? 0)], nextCursor: String(Number(cursor ?? 0) + 1) } }), { maxPages: 3 });
    expect(res).toEqual({ ok: true, data: { items: [0, 1, 2], pages: 3, truncated: true, nextCursor: "3" } });
    const capped = await collectPages<number>(async (cursor) => ({ ok: true, data: { items: [1], nextCursor: String(Number(cursor ?? 0) + 1) } }), { maxPages: 10_000 });
    expect(capped.ok && capped.data.pages).toBe(HARD_MAX_PAGES);
  });
});

describe("manual export drafts", () => {
  const longText = "Climb higher with our new shoes. ".repeat(200);

  it("labels everything manual_export and respects every platform limit", () => {
    const pack = buildManualExportPack(
      { text: longText, title: "T".repeat(150), hashtags: Array.from({ length: 40 }, (_, i) => `#tag${i}`), altText: "A".repeat(2000), mediaUrls: ["https://cdn.example.com/a.jpg"] },
      ["x", "linkedin", "tiktok", "pinterest", "youtube", "instagram", "facebook"],
      new Date(NOW),
    );
    expect(pack.kind).toBe("manual_export");
    for (const item of pack.items) {
      const limits = PLATFORM_LIMITS[item.platform];
      expect(item.kind).toBe("manual_export");
      expect(item.withinLimit).toBe(true);
      expect(countForPlatform(item.text, limits.countMode)).toBeLessThanOrEqual(limits.textMax);
      if (limits.titleMax && item.title) expect([...item.title].length).toBeLessThanOrEqual(limits.titleMax);
      if (limits.altTextMax && item.altText) expect([...item.altText].length).toBeLessThanOrEqual(limits.altTextMax);
      if (limits.hashtagMax) expect(item.hashtags.length).toBeLessThanOrEqual(limits.hashtagMax);
    }
    const csv = manualExportToCsv(pack);
    expect(csv.split("\r\n")[0]).toContain("platform");
    expect(csv).toContain("manual_export,x,");
  });

  it("X counts URLs as 23 and keeps short posts intact", () => {
    expect(countForPlatform(`hi https://example.com/${"a".repeat(100)}`, "x_weighted")).toBe(3 + 23);
    expect(countForPlatform("日本", "x_weighted")).toBe(4);
    const pack = buildManualExportPack({ text: "Short post", hashtags: ["climbing", "#gear!"] }, ["x"]);
    expect(pack.items[0]?.text).toBe("Short post\n\n#climbing #gear");
    expect(pack.items[0]?.truncated).toBe(false);
  });

  it("adds Instagram/Facebook when their publish capability is not ready", () => {
    const platforms = platformsNeedingManualExport({
      instagram: [{ capability: "instagram.publish_media", label: "", kind: "write", state: "unsupported_account_type", reason: "", fix: "" }],
      facebook_pages: [{ capability: "facebook_pages.publish_post", label: "", kind: "write", state: "ready", reason: "", fix: "" }],
    });
    expect(platforms).toContain("instagram");
    expect(platforms).not.toContain("facebook");
    expect(platforms).toEqual(expect.arrayContaining(["linkedin", "x", "tiktok", "pinterest", "youtube"]));
  });
});
