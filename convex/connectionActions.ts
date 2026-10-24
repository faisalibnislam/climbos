import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { runDailyReport, listAccessibleProperties } from "../shared/integrations/ga4";
import { getAccount as getInstagramAccount } from "../shared/integrations/instagram";
import { listManagedPages } from "../shared/integrations/facebookPages";
import { getMember as getLinkedInMember } from "../shared/integrations/linkedin";
import { getMe as getXUser } from "../shared/integrations/x";
import {
  buildCodeExchangeRequest,
  buildInstagramLongLivedExchangeRequest,
  buildRefreshRequest,
  buildRevocationRequest,
  OAUTH_PROVIDERS,
  parseTokenResponse,
  scopesFor,
} from "../shared/integrations/oauth";
import { parseRevenueCsv } from "../shared/integrations/csvRevenue";
import { classifyStripeKey, importStripeRevenue } from "../shared/integrations/stripeRevenue";
import { listSegments } from "../shared/integrations/resendMarketing";
import { listSites as listSearchConsoleSites, querySearchAnalytics } from "../shared/integrations/searchConsole";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalAction, type ActionCtx } from "./_generated/server";
import { providerValidator } from "./schema";
import { appError } from "./lib/tenancy";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

const GROUP_FOR: Record<string, keyof typeof OAUTH_PROVIDERS> = {
  ga4: "google",
  search_console: "google",
  google_ads: "google",
  meta_ads: "meta",
  facebook_pages: "meta",
  instagram: "instagram",
  linkedin: "linkedin",
  x: "x",
};

const CLIENT_ENV = {
  google: ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET"],
  meta: ["META_APP_ID", "META_APP_SECRET"],
  instagram: ["INSTAGRAM_APP_ID", "INSTAGRAM_APP_SECRET"],
  linkedin: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"],
  x: ["X_CLIENT_ID", "X_CLIENT_SECRET"],
} as const;

/** Providers whose access tokens we refresh with a stored refresh token before use (Google's last about an hour). */
export const REFRESHABLE = new Set(["linkedin", "x", "ga4", "search_console", "google_ads"]);
const REFRESH_MARGIN_MS = 5 * 60_000;
const SEARCH_CONSOLE_ROW_LIMIT = 1_000;
const SEARCH_CONSOLE_MAX_PAGES = 3;

/** Scopes we ask for, used when the token response doesn't echo them back. */
const REQUESTED_SCOPES: Record<string, string[]> = {
  linkedin: scopesFor(["linkedin.read_profile", "linkedin.publish_post"]),
  x: scopesFor(["x.read_profile", "x.publish_post"]),
};

function clientCreds(group: keyof typeof OAUTH_PROVIDERS): { clientId?: string; clientSecret?: string } {
  const [idEnv, secretEnv] = CLIENT_ENV[group];
  return { clientId: process.env[idEnv], clientSecret: process.env[secretEnv] };
}

async function googleAccessToken(ctx: ActionCtx, connectionId: Id<"connections">, expiresAt?: number): Promise<string | null> {
  if (expiresAt && expiresAt < Date.now() + REFRESH_MARGIN_MS) {
    const refreshed = await ctx.runAction(internal.connectionActions.refreshAccessToken, { connectionId });
    if (!refreshed.ok) return null;
  }
  const secret = await ctx.runQuery(internal.connections.getSecret, { connectionId });
  if (!secret) return null;
  try {
    const value = JSON.parse(secret.value) as { accessToken?: unknown };
    return typeof value.accessToken === "string" ? value.accessToken : null;
  } catch {
    return null;
  }
}

/**
 * Called only by the Next.js OAuth callback route (server secret required).
 * Exchanges the code, probes the account, stores an encrypted token.
 */
export const completeOAuth = action({
  args: { serverSecret: v.string(), state: v.string(), code: v.string() },
  handler: async (ctx, args): Promise<{ ok: boolean; slug: string; provider: string; message?: string }> => {
    const expected = process.env.CLIMBOS_SERVER_SECRET;
    if (!expected || !timingSafeEqual(args.serverSecret, expected)) throw appError("FORBIDDEN", "Not allowed.");
    const st = await ctx.runMutation(internal.connections.consumeOAuthState, { state: args.state });
    if (!st) return { ok: false, slug: "", provider: "", message: "This connection link expired. Please try connecting again." };
    // Bound to the browser that started it: the signed-in caller must be the user who started the flow.
    const callerId = await getAuthUserId(ctx);
    if (!callerId || callerId !== st.userId) return { ok: false, slug: "", provider: st.provider, message: "Start connecting again from ClimbOS while signed in." };
    const group = GROUP_FOR[st.provider];
    const [idEnv, secretEnv] = CLIENT_ENV[group];
    const clientId = process.env[idEnv]!;
    const clientSecret = process.env[secretEnv]!;
    const redirectUri = `${process.env.SITE_URL ?? "http://localhost:3000"}/api/oauth/callback`;
    const req = buildCodeExchangeRequest({ provider: OAUTH_PROVIDERS[group], clientId, clientSecret, code: args.code, redirectUri, codeVerifier: st.verifier });
    const res = await fetch(req.url, { method: req.method, headers: req.headers, body: req.body });
    const parsed = parseTokenResponse(await res.json().catch(() => null));
    if (!parsed.ok) return { ok: false, slug: st.slug, provider: st.provider, message: "The provider didn't grant access. Please try again." };
    let token = parsed.token;

    let accountLabel: string | undefined;
    let externalAccountId: string | undefined;
    let accountType: string | undefined;
    if (group === "instagram") {
      const ll = buildInstagramLongLivedExchangeRequest({ clientSecret, shortLivedToken: token.accessToken });
      const llRes = await fetch(ll.url, { method: ll.method, headers: ll.headers, body: ll.body });
      const llParsed = parseTokenResponse(await llRes.json().catch(() => null));
      if (llParsed.ok) token = { ...llParsed.token, scopes: token.scopes, userId: token.userId };
      const acct = await getInstagramAccount({ accessToken: token.accessToken });
      if (acct.ok) {
        accountLabel = `@${acct.data.username}`;
        externalAccountId = acct.data.userId;
        accountType = acct.data.accountType;
      }
    } else if (group === "meta" && st.provider === "facebook_pages") {
      const pages = await listManagedPages({ accessToken: token.accessToken, maxPages: 2 });
      if (pages.ok && pages.data.items[0]) {
        const page = pages.data.items[0];
        accountLabel = page.name;
        externalAccountId = page.id;
        // Publishing uses the Page access token, not the user token.
        if (page.pageAccessToken) token = { ...token, accessToken: page.pageAccessToken };
      }
    } else if (group === "linkedin" || group === "x") {
      // Posts need the author id, so a failed profile probe means no connection.
      if (token.scopes.length === 0) token = { ...token, scopes: REQUESTED_SCOPES[group] ?? [] };
      const name = group === "linkedin" ? "LinkedIn" : "X";
      if (group === "linkedin") {
        const me = await getLinkedInMember({ accessToken: token.accessToken });
        if (!me.ok) return { ok: false, slug: st.slug, provider: st.provider, message: `We couldn't read your ${name} profile. Please try again.` };
        accountLabel = me.data.name;
        externalAccountId = me.data.personUrn;
      } else {
        const me = await getXUser({ accessToken: token.accessToken });
        if (!me.ok) return { ok: false, slug: st.slug, provider: st.provider, message: `We couldn't read your ${name} account. Please try again.` };
        accountLabel = me.data.username ? `@${me.data.username}` : me.data.name;
        externalAccountId = me.data.id;
      }
    } else if (st.provider === "ga4") {
      const props = await listAccessibleProperties({ accessToken: token.accessToken, maxPages: 2 });
      if (props.ok && props.data.items[0]) {
        accountLabel = props.data.items[0].displayName;
        externalAccountId = props.data.items[0].property;
      }
    } else if (st.provider === "search_console") {
      const properties = await listSearchConsoleSites({ accessToken: token.accessToken });
      if (properties.ok && properties.data.length === 1) {
        accountLabel = properties.data[0]!.siteUrl;
        externalAccountId = properties.data[0]!.siteUrl;
        accountType = "search_console_property";
      } else if (properties.ok && properties.data.length > 1) {
        accountLabel = `${properties.data.length} Search Console properties`;
        accountType = "search_console_property_selection_required";
      } else if (properties.ok) {
        accountLabel = "No Search Console properties available";
        accountType = "search_console_no_properties";
      }
    }

    await ctx.runMutation(internal.connections.storeConnection, {
      orgId: st.orgId as Id<"organizations">,
      userId: st.userId as Id<"users">,
      provider: st.provider,
      secret: JSON.stringify({ accessToken: token.accessToken, refreshToken: token.refreshToken }),
      secretKind: "oauth",
      scopes: token.scopes,
      expiresAt: token.expiresAt,
      accountLabel,
      externalAccountId,
      accountType,
    });
    return { ok: true, slug: st.slug, provider: st.provider };
  },
});

/** Connect an API-key based provider (customer's own Resend, Stripe restricted key). Probes before storing. */
export const connectApiKey = action({
  args: { slug: v.string(), provider: v.union(v.literal("email_resend"), v.literal("stripe_revenue")), apiKey: v.string() },
  handler: async (ctx, { slug, provider, apiKey }): Promise<{ ok: boolean; message: string }> => {
    const access = await ctx.runQuery(internal.access.orgAccessForAction, { slug, permission: "manage_connections" });
    if (!access) throw appError("NOT_FOUND", "We couldn't find that workspace.");
    if (access.kind === "demo") return { ok: false, message: "Demo workspaces can't connect real accounts." };
    const key = apiKey.trim();
    let accountLabel = "";
    if (provider === "stripe_revenue") {
      if (classifyStripeKey(key) !== "restricted") {
        return { ok: false, message: "Please use a read-only restricted key (it starts with rk_). Never share your secret key." };
      }
      const probe = await importStripeRevenue({ restrictedKey: key, createdGte: Math.floor(Date.now() / 1000) - 86_400, maxPages: 1 });
      if (!probe.ok) return { ok: false, message: "Stripe rejected this key or it lacks read access to charges and refunds." };
      accountLabel = key.startsWith("rk_test_") ? "Stripe (test mode)" : "Stripe";
    } else {
      if (!key.startsWith("re_")) return { ok: false, message: "That doesn't look like a Resend API key (they start with re_)." };
      const probe = await listSegments({ apiKey: key, maxPages: 1 });
      if (!probe.ok) return { ok: false, message: "Resend rejected this key. It needs full access to manage contacts and broadcasts." };
      accountLabel = "Your Resend account";
    }
    await ctx.runMutation(internal.connections.storeConnection, {
      orgId: access.orgId,
      userId: access.userId,
      provider,
      secret: JSON.stringify({ apiKey: key }),
      secretKind: "api_key",
      scopes: [],
      accountLabel,
    });
    if (provider === "stripe_revenue") await ctx.scheduler.runAfter(0, internal.connectionActions.syncStripe, { orgId: access.orgId });
    return { ok: true, message: "Connected." };
  },
});

export const revokeProviderToken = internalAction({
  args: { connectionId: v.id("connections"), secretIds: v.optional(v.array(v.id("connectionSecrets"))) },
  handler: async (ctx, { connectionId, secretIds }) => {
    // Revoke exactly the secrets that were live at disconnect (older scheduled jobs: whatever is stored).
    const secrets = secretIds
      ? await ctx.runQuery(internal.connections.secretsForRevocation, { connectionId, secretIds }).catch(() => [])
      : [await ctx.runQuery(internal.connections.getSecret, { connectionId, forRevocation: true }).catch(() => null)].filter((s) => s !== null);
    for (const secret of secrets) {
      const group = GROUP_FOR[secret.provider];
      if (group) {
        try {
          const { accessToken, refreshToken } = JSON.parse(secret.value) as { accessToken: string; refreshToken?: string };
          // X keeps refresh tokens alive separately, so revoke both.
          const tokens = group === "x" && refreshToken ? [accessToken, refreshToken] : [accessToken];
          for (const token of tokens) {
            const req = buildRevocationRequest({ provider: OAUTH_PROVIDERS[group], token, ...clientCreds(group) });
            if (req) await fetch(req.url, { method: req.method, headers: req.headers, body: req.body });
          }
        } catch {
          // Revocation is best effort; the local secret is deleted regardless.
        }
      }
    }
    await ctx.runMutation(internal.connections.deleteSecrets, { connectionId, secretIds });
  },
});

/**
 * Refresh a LinkedIn/X access token with the stored refresh token and store
 * the result (X rotates refresh tokens, so the new one replaces the old).
 */
export const refreshAccessToken = internalAction({
  args: { connectionId: v.id("connections") },
  handler: async (ctx, { connectionId }): Promise<{ ok: boolean; message?: string }> => {
    const secret = await ctx.runQuery(internal.connections.getSecret, { connectionId });
    if (!secret || !REFRESHABLE.has(secret.provider)) return { ok: false, message: "Nothing to refresh." };
    const group = GROUP_FOR[secret.provider];
    const { clientId, clientSecret } = clientCreds(group);
    const stored = JSON.parse(secret.value) as { accessToken: string; refreshToken?: string };
    if (!stored.refreshToken) return { ok: false, message: "No refresh token; reconnect the account." };
    if (!clientId || !clientSecret) return { ok: false, message: "Integration keys aren't set." };
    const req = buildRefreshRequest({ provider: OAUTH_PROVIDERS[group], clientId, clientSecret, refreshToken: stored.refreshToken });
    let parsed: ReturnType<typeof parseTokenResponse>;
    try {
      const res = await fetch(req.url, { method: req.method, headers: req.headers, body: req.body });
      parsed = parseTokenResponse(await res.json().catch(() => null));
    } catch {
      return { ok: false, message: "Couldn't reach the provider to renew access." };
    }
    if (!parsed.ok) {
      // The provider refused the refresh token (revoked or expired): the owner has to reconnect.
      await ctx.runMutation(internal.connections.markSync, { connectionId, ok: false, error: "Sign-in expired. Reconnect this account.", expired: true });
      return { ok: false, message: parsed.description ?? parsed.error };
    }
    const t = parsed.token;
    await ctx.runMutation(internal.connections.rotateSecret, {
      connectionId,
      secret: JSON.stringify({ accessToken: t.accessToken, refreshToken: t.refreshToken ?? stored.refreshToken }),
      expiresAt: t.expiresAt,
    });
    return { ok: true };
  },
});

function isoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export const syncGa4 = internalAction({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    const conn = await ctx.runQuery(internal.connections.connectionFor, { orgId, provider: "ga4" });
    if (!conn || conn.status !== "connected" || conn.isFixture || !conn.externalAccountId) return;
    // Google access tokens expire after about an hour: renew with the stored refresh token first.
    if (conn.expiresAt && conn.expiresAt < Date.now() + REFRESH_MARGIN_MS) {
      const r = await ctx.runAction(internal.connectionActions.refreshAccessToken, { connectionId: conn._id });
      if (!r.ok) {
        await ctx.runMutation(internal.connections.markSync, { connectionId: conn._id, ok: false, error: r.message ?? "Couldn't renew Google access." });
        return;
      }
    }
    const secret = await ctx.runQuery(internal.connections.getSecret, { connectionId: conn._id });
    if (!secret) return;
    const { accessToken } = JSON.parse(secret.value) as { accessToken: string };
    const end = isoDay(Date.now() - 86_400_000);
    const start = isoDay(Date.now() - 90 * 86_400_000);
    const report = await runDailyReport({ accessToken, propertyId: conn.externalAccountId, startDate: start, endDate: end, maxPages: 20 });
    if (!report.ok) {
      await ctx.runMutation(internal.connections.markSync, { connectionId: conn._id, ok: false, error: report.providerMessage });
      return;
    }
    const byDay = new Map<string, { sessions: number; users: number; keyEvents: number }>();
    for (const r of report.data.items) {
      const d = byDay.get(r.date) ?? { sessions: 0, users: 0, keyEvents: 0 };
      d.sessions += r.sessions;
      d.users += r.totalUsers;
      d.keyEvents += r.keyEvents;
      byDay.set(r.date, d);
    }
    const rows = [...byDay.entries()].flatMap(([date, d]) => [
      { metricKey: "visits", date, value: d.sessions },
      { metricKey: "signups", date, value: d.keyEvents },
    ]);
    await ctx.runMutation(internal.analytics.upsertDaily, { orgId, source: "ga4", kind: "observed", rows });
    await ctx.runMutation(internal.connections.markSync, { connectionId: conn._id, ok: true });
  },
});

/** Read available Search Console properties for an owner/admin to select explicitly. */
export const availableSearchConsoleSites = action({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const access = await ctx.runQuery(internal.access.orgAccessForAction, { slug, permission: "manage_connections" });
    if (!access) throw appError("NOT_FOUND", "We couldn't find that workspace.");
    const connection = await ctx.runQuery(internal.connections.connectionFor, { orgId: access.orgId, provider: "search_console" });
    if (!connection || connection.status !== "connected" || connection.isFixture) return { ok: false as const, sites: [], message: "Connect Search Console first." };
    const accessToken = await googleAccessToken(ctx, connection._id, connection.expiresAt);
    if (!accessToken) return { ok: false as const, sites: [], message: "Search Console access expired. Reconnect the account." };
    const result = await listSearchConsoleSites({ accessToken });
    return result.ok
      ? { ok: true as const, sites: result.data, message: "Choose the Search Console property for this business." }
      : { ok: false as const, sites: [], message: "Couldn't load Search Console properties. Try again or reconnect the account." };
  },
});

/** Verify the selected property against the user's live sites.list result before storing it. */
export const selectSearchConsoleSite = action({
  args: { slug: v.string(), siteUrl: v.string() },
  handler: async (ctx, { slug, siteUrl }) => {
    const access = await ctx.runQuery(internal.access.orgAccessForAction, { slug, permission: "manage_connections" });
    if (!access) throw appError("NOT_FOUND", "We couldn't find that workspace.");
    if (access.kind === "demo") throw appError("FORBIDDEN", "Demo workspaces can't connect real accounts.");
    const connection = await ctx.runQuery(internal.connections.connectionFor, { orgId: access.orgId, provider: "search_console" });
    if (!connection || connection.status !== "connected" || connection.isFixture) throw appError("INVALID", "Connect Search Console first.");
    const accessToken = await googleAccessToken(ctx, connection._id, connection.expiresAt);
    if (!accessToken) throw appError("INVALID", "Search Console access expired. Reconnect the account.");
    const result = await listSearchConsoleSites({ accessToken });
    const site = result.ok ? result.data.find((item) => item.siteUrl === siteUrl) : undefined;
    if (!site) throw appError("INVALID", "Choose a property returned by the connected Search Console account.");
    const selected = await ctx.runMutation(internal.connections.selectSearchConsoleSite, { orgId: access.orgId, connectionId: connection._id, siteUrl: site.siteUrl, accountLabel: site.siteUrl });
    if (!selected) throw appError("INVALID", "Reconnect Search Console and choose the property again.");
    await ctx.scheduler.runAfter(0, internal.connectionActions.syncSearchConsole, { orgId: access.orgId });
    return { ok: true, siteUrl: site.siteUrl };
  },
});

export const syncSearchConsole = internalAction({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    const connection = await ctx.runQuery(internal.connections.connectionFor, { orgId, provider: "search_console" });
    if (!connection || connection.status !== "connected" || connection.isFixture) return;
    if (!connection.externalAccountId) {
      await ctx.runMutation(internal.connections.markSync, { connectionId: connection._id, ok: false, error: "Choose a Search Console property before syncing." });
      return;
    }
    const accessToken = await googleAccessToken(ctx, connection._id, connection.expiresAt);
    if (!accessToken) {
      await ctx.runMutation(internal.connections.markSync, { connectionId: connection._id, ok: false, error: "Search Console access expired. Reconnect the account.", expired: true });
      return;
    }
    const endDate = isoDay(Date.now() - 3 * 86_400_000);
    const startDate = isoDay(Date.now() - 93 * 86_400_000);
    const snapshotId = await ctx.runMutation(internal.searchConsole.startSnapshot, {
      orgId, connectionId: connection._id, property: connection.externalAccountId, startDate, endDate,
    });
    const report = await querySearchAnalytics({
      accessToken,
      siteUrl: connection.externalAccountId,
      startDate,
      endDate,
      dimensions: ["query", "page"],
      rowLimit: SEARCH_CONSOLE_ROW_LIMIT,
      maxPages: SEARCH_CONSOLE_MAX_PAGES,
      dataState: "final",
    });
    if (!report.ok) {
      await ctx.runMutation(internal.searchConsole.finishSnapshot, { snapshotId, status: "failed", rowCount: 0, truncated: false, error: report.providerMessage });
      await ctx.runMutation(internal.connections.markSync, { connectionId: connection._id, ok: false, error: "Search Console couldn't return performance data. Check property access and try again." });
      return;
    }
    const uniqueRows = new Map<string, { query: string; page: string; clicks: number; impressions: number; ctr: number; position: number }>();
    for (const row of report.data.items) {
      const [query, page] = row.keys;
      if (!query || !page || query.length > 2_000 || page.length > 2_000) continue;
      uniqueRows.set(`${query}\u0000${page}`, { query, page, clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position });
    }
    const rows = [...uniqueRows.values()];
    for (let i = 0; i < rows.length; i += 250) {
      await ctx.runMutation(internal.searchConsole.writeSnapshotRows, { snapshotId, rows: rows.slice(i, i + 250) });
    }
    await ctx.runMutation(internal.searchConsole.finishSnapshot, {
      snapshotId,
      status: "complete",
      rowCount: rows.length,
      truncated: report.data.truncated || report.data.items.length >= SEARCH_CONSOLE_ROW_LIMIT * SEARCH_CONSOLE_MAX_PAGES,
    });
    await ctx.runMutation(internal.connections.markSync, { connectionId: connection._id, ok: true });
  },
});

export const syncStripe = internalAction({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    const conn = await ctx.runQuery(internal.connections.connectionFor, { orgId, provider: "stripe_revenue" });
    if (!conn || conn.status !== "connected" || conn.isFixture) return;
    const secret = await ctx.runQuery(internal.connections.getSecret, { connectionId: conn._id });
    if (!secret) return;
    const { apiKey } = JSON.parse(secret.value) as { apiKey: string };
    const since = Math.floor((conn.lastSyncAt ?? Date.now() - 180 * 86_400_000) / 1000) - 86_400;
    const res = await importStripeRevenue({ restrictedKey: apiKey, createdGte: since, maxPages: 20 });
    if (!res.ok) {
      await ctx.runMutation(internal.connections.markSync, { connectionId: conn._id, ok: false, error: res.providerMessage });
      return;
    }
    await ctx.runMutation(internal.analytics.ingestRevenue, {
      orgId,
      events: res.data.events.slice(0, 5000).map((e) => ({
        source: e.source,
        sourceEventId: e.sourceEventId,
        occurredAt: e.occurredAt,
        customerRef: e.customerRef,
        orderRef: e.orderRef,
        currency: e.currency,
        amountMinor: e.amountMinor,
        refundedMinor: e.refundedMinor,
        kind: e.kind,
      })),
    });
    await ctx.runMutation(internal.connections.markSync, { connectionId: conn._id, ok: true });
  },
});

/** Owner uploads a revenue CSV. Validated row by row; duplicates and bad rows are reported, not guessed. */
export const importRevenueCsv = action({
  args: { slug: v.string(), csv: v.string() },
  handler: async (ctx, { slug, csv }): Promise<{ imported: number; errors: { row: number; message: string }[]; fatal?: string; duplicates: number }> => {
    const access = await ctx.runQuery(internal.access.orgAccessForAction, { slug, permission: "manage_connections" });
    if (!access) throw appError("NOT_FOUND", "We couldn't find that workspace.");
    if (csv.length > 10_000_000) return { imported: 0, errors: [], fatal: "File is larger than 10 MB. Split it into smaller files.", duplicates: 0 };
    const parsed = parseRevenueCsv(csv, { source: "csv", maxRows: 50_000 });
    if (parsed.fatal) return { imported: 0, errors: [], fatal: parsed.fatal, duplicates: 0 };
    const events = parsed.rows.map((r) => ({
      source: "csv",
      sourceEventId: r.event.sourceEventId,
      occurredAt: r.event.occurredAt,
      customerRef: r.event.customerRef,
      orderRef: r.event.orderRef,
      currency: r.event.currency,
      amountMinor: r.event.amountMinor,
      refundedMinor: r.event.refundedMinor,
      kind: r.event.kind,
      utmSource: r.utm.source,
      utmMedium: r.utm.medium,
      utmCampaign: r.utm.campaign,
    }));
    let imported = 0;
    for (let i = 0; i < events.length; i += 500) {
      imported += await ctx.runMutation(internal.analytics.ingestRevenue, { orgId: access.orgId, events: events.slice(i, i + 500) });
    }
    await ctx.runMutation(internal.analytics.markCsvConnected, { orgId: access.orgId, userId: access.userId });
    return {
      imported,
      errors: parsed.errors.slice(0, 50).map((e) => ({ row: e.row, message: e.message })),
      duplicates: parsed.duplicateEventIds.length + (events.length - imported),
    };
  },
});

export const syncNow = action({
  args: { slug: v.string(), provider: providerValidator },
  handler: async (ctx, { slug, provider }) => {
    const access = await ctx.runQuery(internal.access.orgAccessForAction, { slug, permission: "manage_connections" });
    if (!access) throw appError("NOT_FOUND", "We couldn't find that workspace.");
    if (provider === "ga4") await ctx.runAction(internal.connectionActions.syncGa4, { orgId: access.orgId });
    if (provider === "search_console") await ctx.runAction(internal.connectionActions.syncSearchConsole, { orgId: access.orgId });
    if (provider === "stripe_revenue") await ctx.runAction(internal.connectionActions.syncStripe, { orgId: access.orgId });
    return { ok: true };
  },
});
