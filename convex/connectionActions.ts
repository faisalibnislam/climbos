import { v } from "convex/values";
import { runDailyReport, listAccessibleProperties } from "../shared/integrations/ga4";
import { getAccount as getInstagramAccount } from "../shared/integrations/instagram";
import { listManagedPages } from "../shared/integrations/facebookPages";
import {
  buildCodeExchangeRequest,
  buildInstagramLongLivedExchangeRequest,
  buildRevocationRequest,
  OAUTH_PROVIDERS,
  parseTokenResponse,
} from "../shared/integrations/oauth";
import { parseRevenueCsv } from "../shared/integrations/csvRevenue";
import { classifyStripeKey, importStripeRevenue } from "../shared/integrations/stripeRevenue";
import { listSegments } from "../shared/integrations/resendMarketing";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalAction } from "./_generated/server";
import { providerValidator } from "./schema";
import { appError } from "./lib/tenancy";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

const GROUP_FOR: Record<string, "google" | "meta" | "instagram"> = {
  ga4: "google",
  search_console: "google",
  google_ads: "google",
  meta_ads: "meta",
  facebook_pages: "meta",
  instagram: "instagram",
};

const CLIENT_ENV = {
  google: ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET"],
  meta: ["META_APP_ID", "META_APP_SECRET"],
  instagram: ["INSTAGRAM_APP_ID", "INSTAGRAM_APP_SECRET"],
} as const;

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
    } else if (st.provider === "ga4") {
      const props = await listAccessibleProperties({ accessToken: token.accessToken, maxPages: 2 });
      if (props.ok && props.data.items[0]) {
        accountLabel = props.data.items[0].displayName;
        externalAccountId = props.data.items[0].property;
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
  args: { connectionId: v.id("connections") },
  handler: async (ctx, { connectionId }) => {
    const secret = await ctx.runQuery(internal.connections.getSecret, { connectionId }).catch(() => null);
    if (secret) {
      const group = GROUP_FOR[secret.provider];
      if (group) {
        try {
          const { accessToken } = JSON.parse(secret.value) as { accessToken: string };
          const req = buildRevocationRequest({ provider: OAUTH_PROVIDERS[group], token: accessToken });
          if (req) await fetch(req.url, { method: req.method, headers: req.headers, body: req.body });
        } catch {
          // Revocation is best effort; the local secret is deleted regardless.
        }
      }
    }
    await ctx.runMutation(internal.connections.deleteSecrets, { connectionId });
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
    if (provider === "stripe_revenue") await ctx.runAction(internal.connectionActions.syncStripe, { orgId: access.orgId });
    return { ok: true };
  },
});
