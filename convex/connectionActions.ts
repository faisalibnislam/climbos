"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { v } from "convex/values";
import { aiReferralAttribution, runDailyReport, listAccessibleProperties } from "../shared/integrations/ga4";
import { getAccount as getInstagramAccount } from "../shared/integrations/instagram";
import { listManagedPages } from "../shared/integrations/facebookPages";
import { listGrantedPermissions } from "../shared/integrations/metaGraph";
import { getMember as getLinkedInMember, listAdministeredOrganizations } from "../shared/integrations/linkedin";
import { listAllLocations as listBusinessProfileLocations } from "../shared/integrations/googleBusinessProfile";
import {
  businessProfileOptions,
  choicePendingLabel,
  facebookPageOptions,
  ga4PropertyOptions,
  linkedInOptions,
  soleChoice,
  type AccountOption,
} from "../shared/integrations/accountChoice";
import { getMe as getXUser } from "../shared/integrations/x";
import { getCustomerSettings, listAccessibleCustomers, GOOGLE_ADS_SCOPE } from "../shared/integrations/googleAds";
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
import { inspectSearchUrl, listSites as listSearchConsoleSites, querySearchAnalytics, searchConsolePropertyMatchesWebsite, type SearchUrlInspection } from "../shared/integrations/searchConsole";
import { probeWordPressCredentials } from "../shared/integrations/wordpress";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
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
  google_business_profile: "google",
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
  linkedin_pages: ["LINKEDIN_PAGES_CLIENT_ID", "LINKEDIN_PAGES_CLIENT_SECRET"],
  x: ["X_CLIENT_ID", "X_CLIENT_SECRET"],
} as const;

/** Stored OAuth secret. `app` marks tokens from the LinkedIn Pages app; `userAccessToken` is Meta's user token behind a Page token. */
interface StoredOAuth {
  accessToken: string;
  refreshToken?: string;
  userAccessToken?: string;
  app?: "linkedin_pages";
}

function parseStored(value: string): StoredOAuth | null {
  try {
    const v = JSON.parse(value) as Partial<StoredOAuth>;
    return typeof v.accessToken === "string" ? (v as StoredOAuth) : null;
  } catch {
    return null;
  }
}

/** The OAuth app a stored token belongs to. */
function groupForSecret(provider: string, stored: StoredOAuth | null): keyof typeof OAUTH_PROVIDERS | undefined {
  return stored?.app === "linkedin_pages" ? "linkedin_pages" : GROUP_FOR[provider];
}

const SELECTION_REQUIRED = "selection_required";

/** Providers whose access tokens we refresh with a stored refresh token before use (Google's last about an hour). */
export const REFRESHABLE = new Set(["linkedin", "x", "ga4", "search_console", "google_ads", "google_business_profile"]);
const REFRESH_MARGIN_MS = 5 * 60_000;
const SEARCH_CONSOLE_ROW_LIMIT = 1_000;
const SEARCH_CONSOLE_MAX_PAGES = 3;

/** Pin authenticated WordPress requests to the public address validated immediately beforehand. */
function wordpressPinnedFetch(url: string, init: RequestInit | undefined, addresses: string[]): Promise<Response> {
  const parsed = new URL(url);
  const address = addresses[0];
  const family = address ? isIP(address) : 0;
  if (parsed.protocol !== "https:" || !address || !family) return Promise.reject(new Error("WordPress requests require a validated public HTTPS address."));
  const headers: Record<string, string> = {};
  new Headers(init?.headers).forEach((value, key) => { headers[key] = value; });
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    const req = httpsRequest(parsed, {
      method: init?.method ?? "GET",
      headers,
      signal: init?.signal ?? undefined,
      timeout: 8_000,
      lookup: (_hostname, options, callback) => {
        if (options.all) callback(null, [{ address, family }]);
        else callback(null, address, family);
      },
    }, (res) => {
      res.on("data", (chunk: Buffer | string) => {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += bytes.length;
        if (size > 100_000) {
          req.destroy(new Error("WordPress response exceeded its size limit."));
          return;
        }
        chunks.push(bytes);
      });
      res.on("end", () => {
        const headers = new Headers();
        for (const [key, value] of Object.entries(res.headers)) {
          if (Array.isArray(value)) value.forEach((part) => headers.append(key, part));
          else if (typeof value === "string") headers.set(key, value);
        }
        resolve(new Response(Buffer.concat(chunks), { status: res.statusCode ?? 502, headers }));
      });
      res.on("error", reject);
    });
    req.on("error", reject);
    req.end();
  });
}

/** Scopes we ask for, used when the token response doesn't echo them back. */
const REQUESTED_SCOPES: Record<string, string[]> = {
  linkedin: scopesFor(["linkedin.read_profile", "linkedin.publish_post"]),
  linkedin_pages: scopesFor(["linkedin.list_organizations", "linkedin.publish_org_post"]),
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
    const group = st.variant === "linkedin_pages" ? "linkedin_pages" : GROUP_FOR[st.provider];
    const [idEnv, secretEnv] = CLIENT_ENV[group];
    const clientId = process.env[idEnv];
    const clientSecret = process.env[secretEnv];
    if (!clientId || !clientSecret) return { ok: false, slug: st.slug, provider: st.provider, message: "This connection isn't set up on ClimbOS yet." };
    const redirectUri = `${process.env.SITE_URL ?? "http://localhost:3000"}/api/oauth/callback`;
    const req = buildCodeExchangeRequest({ provider: OAUTH_PROVIDERS[group], clientId, clientSecret, code: args.code, redirectUri, codeVerifier: st.verifier });
    const res = await fetch(req.url, { method: req.method, headers: req.headers, body: req.body });
    const parsed = parseTokenResponse(await res.json().catch(() => null));
    if (!parsed.ok) return { ok: false, slug: st.slug, provider: st.provider, message: "The provider didn't grant access. Please try again." };
    let token = parsed.token;

    let accountLabel: string | undefined;
    let externalAccountId: string | undefined;
    let accountType: string | undefined;
    const extra: Partial<StoredOAuth> = group === "linkedin_pages" ? { app: "linkedin_pages" } : {};
    /** Bind the only usable option straight away; otherwise the owner chooses on the Connections page. */
    const choose = (options: AccountOption[], noun: string, plural: string): AccountOption | undefined => {
      const sole = soleChoice(options);
      if (sole) {
        accountLabel = sole.label;
        externalAccountId = sole.id;
        accountType = sole.accountType;
      } else {
        accountLabel = choicePendingLabel(options.length, noun, plural);
        accountType = SELECTION_REQUIRED;
      }
      return sole;
    };
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
    } else if (group === "meta") {
      // Swap the short-lived user token for a long-lived (~60 day) one; Page tokens made from it don't expire.
      const ll = buildRefreshRequest({ provider: OAUTH_PROVIDERS.meta, clientId, clientSecret, refreshToken: token.accessToken });
      const llParsed = parseTokenResponse(await (await fetch(ll.url, { method: ll.method, headers: ll.headers })).json().catch(() => null));
      if (llParsed.ok) token = { ...llParsed.token, scopes: token.scopes };
      // Meta's token response doesn't list what was granted: ask, so missing permissions show honestly.
      const granted = await listGrantedPermissions({ accessToken: token.accessToken });
      if (granted.ok) token = { ...token, scopes: granted.data };
      if (st.provider === "facebook_pages") {
        extra.userAccessToken = token.accessToken;
        const pages = await listManagedPages({ accessToken: token.accessToken, maxPages: 5 });
        const sole = choose(pages.ok ? facebookPageOptions(pages.data.items) : [], "Facebook Page", "Facebook Pages");
        const page = sole && pages.ok ? pages.data.items.find((p) => p.id === sole.id) : undefined;
        // Publishing uses the Page access token, not the user token.
        if (page?.pageAccessToken) token = { ...token, accessToken: page.pageAccessToken, expiresAt: undefined };
        if (!pages.ok) accountLabel = "Facebook Pages couldn't be loaded · try Choose again";
      }
    } else if (st.provider === "google_ads") {
      accountType = "google_ads_account_selection_required";
      accountLabel = "Choose a Google Ads advertiser account";
      const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
      if (developerToken) {
        const accessible = await listAccessibleCustomers({ accessToken: token.accessToken, developerToken });
        if (accessible.ok && accessible.data.length === 1) {
          const customerId = accessible.data[0]!;
          const settings = await getCustomerSettings({ accessToken: token.accessToken, developerToken, customerId });
          if (settings.ok && !settings.data.managerAccount) {
            externalAccountId = customerId;
            accountLabel = `Google Ads · ${customerId}`;
            accountType = "google_ads_advertiser";
          }
        } else if (!accessible.ok) {
          accountLabel = "Google Ads connected · account selection needs retry";
        } else if (accessible.data.length === 0) {
          accountLabel = "No directly accessible Google Ads accounts";
        }
      } else {
        accountType = "google_ads_setup_needed";
        accountLabel = "Google Ads connected · ClimbOS setup needed";
      }
    } else if (group === "linkedin" || group === "linkedin_pages" || group === "x") {
      // Posts need the author id, so a failed profile probe means no connection.
      if (token.scopes.length === 0) token = { ...token, scopes: REQUESTED_SCOPES[group] ?? [] };
      if (group === "linkedin") {
        const me = await getLinkedInMember({ accessToken: token.accessToken });
        if (!me.ok) return { ok: false, slug: st.slug, provider: st.provider, message: "We couldn't read your LinkedIn profile. Please try again." };
        choose(linkedInOptions(me.data, []), "LinkedIn profile", "LinkedIn profiles");
      } else if (group === "linkedin_pages") {
        const orgs = await listAdministeredOrganizations({ accessToken: token.accessToken });
        if (!orgs.ok) return { ok: false, slug: st.slug, provider: st.provider, message: "We couldn't read the LinkedIn Pages you administer. Please try again." };
        choose(linkedInOptions(null, orgs.data.items), "LinkedIn Page", "LinkedIn Pages");
      } else {
        const me = await getXUser({ accessToken: token.accessToken });
        if (!me.ok) return { ok: false, slug: st.slug, provider: st.provider, message: "We couldn't read your X account. Please try again." };
        accountLabel = me.data.username ? `@${me.data.username}` : me.data.name;
        externalAccountId = me.data.id;
        accountType = me.data.verifiedType === "business" ? "x_business" : "x_account";
      }
    } else if (st.provider === "ga4") {
      const props = await listAccessibleProperties({ accessToken: token.accessToken, maxPages: 2 });
      choose(props.ok ? ga4PropertyOptions(props.data.items) : [], "Analytics property", "Analytics properties");
      if (!props.ok) accountLabel = "Analytics properties couldn't be loaded · try Choose again";
    } else if (st.provider === "google_business_profile") {
      const locations = await listBusinessProfileLocations({ accessToken: token.accessToken });
      choose(locations.ok ? businessProfileOptions(locations.data.items) : [], "Business Profile location", "Business Profile locations");
      if (!locations.ok) accountLabel = "Locations couldn't be loaded · Google may not have approved API access yet";
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
      secret: JSON.stringify({ accessToken: token.accessToken, refreshToken: token.refreshToken, ...extra }),
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
      if (!probe.ok) return { ok: false, message: "Stripe rejected this key or it lacks read access to charges, refunds and invoices." };
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

/** Verify a revocable WordPress Application Password before storing it encrypted. */
export const connectWordPress = action({
  args: { slug: v.string(), siteUrl: v.string(), username: v.string(), applicationPassword: v.string() },
  handler: async (ctx, { slug, siteUrl, username, applicationPassword }): Promise<{ ok: boolean; message: string }> => {
    const access = await ctx.runQuery(internal.access.orgAccessForAction, { slug, permission: "manage_connections" });
    if (!access) throw appError("NOT_FOUND", "We couldn't find that workspace.");
    if (access.kind === "demo") return { ok: false, message: "Demo workspaces can't connect real accounts." };
    let validatedAddresses: string[] = [];
    const probe = await probeWordPressCredentials({ siteUrl, username, applicationPassword }, {
      resolveHost: async (hostname) => {
        validatedAddresses = (await lookup(hostname, { all: true, verbatim: true })).map((entry) => entry.address);
        return validatedAddresses;
      },
      fetchImpl: (url, init) => wordpressPinnedFetch(url, init, validatedAddresses),
    });
    if (!probe.ok) {
      const message = probe.reason === "credentials" ? "WordPress rejected the username or Application Password. Check it and try again."
        : probe.reason === "permission" ? "This WordPress user needs permission to edit posts. Use an account with the edit_posts capability."
          : probe.reason === "unsafe_host" ? "That site resolves to a private or reserved network address, so ClimbOS will not send credentials there."
            : probe.reason === "invalid_site" ? "Enter the public HTTPS address of your WordPress site, without a query or fragment."
              : probe.reason === "unsupported" ? "The site did not return the expected WordPress REST API response, or redirected the request. Check that its REST API is enabled."
                : "ClimbOS couldn't reach the site's WordPress REST API. Check the address and try again.";
      return { ok: false, message };
    }
    await ctx.runMutation(internal.connections.storeConnection, {
      orgId: access.orgId,
      userId: access.userId,
      provider: "wordpress",
      secret: JSON.stringify({ siteUrl: probe.siteUrl, username: username.trim(), applicationPassword: applicationPassword.replace(/\s+/gu, "") }),
      secretKind: "api_key",
      scopes: ["wordpress.users.read_self", "wordpress.posts.edit"],
      accountLabel: `${probe.accountName} · ${new URL(probe.siteUrl).host}`.slice(0, 200),
      externalAccountId: probe.siteUrl,
      accountType: "wordpress_application_password",
    });
    return { ok: true, message: "WordPress access verified and the credential stored encrypted." };
  },
});


export const revokeProviderToken = internalAction({
  args: { connectionId: v.id("connections"), secretIds: v.optional(v.array(v.id("connectionSecrets"))) },
  handler: async (ctx, { connectionId, secretIds }) => {
    // Revoke exactly the secrets that were live at disconnect (older scheduled jobs: whatever is stored).
    const secrets = secretIds
      ? await ctx.runQuery(internal.connections.secretsForRevocation, { connectionId, secretIds }).catch(() => [])
      : [await ctx.runQuery(internal.connections.getSecret, { connectionId, forRevocation: true }).catch(() => null)].filter((s) => s !== null);
    let attempted = false;
    let failed = false;
    for (const secret of secrets) {
      const stored = parseStored(secret.value);
      const group = groupForSecret(secret.provider, stored);
      if (!group || !stored) continue;
      // Meta revokes with the user token (DELETE /me/permissions); a Page token can't deauthorize the app.
      // X keeps refresh tokens alive separately, so revoke both.
      const tokens = group === "meta" ? [stored.userAccessToken ?? stored.accessToken] : group === "x" && stored.refreshToken ? [stored.accessToken, stored.refreshToken] : [stored.accessToken];
      for (const token of tokens) {
        const req = buildRevocationRequest({ provider: OAUTH_PROVIDERS[group], token, ...clientCreds(group) });
        if (!req) continue;
        attempted = true;
        try {
          const res = await fetch(req.url, { method: req.method, headers: req.headers, body: req.body });
          if (!res.ok) failed = true;
        } catch {
          // Revocation is best effort; the local secret is deleted regardless.
          failed = true;
        }
      }
    }
    await ctx.runMutation(internal.connections.deleteSecrets, { connectionId, secretIds, revocation: !attempted ? "unsupported" : failed ? "failed" : "revoked" });
  },
});

type LiveOptions = { ok: true; options: AccountOption[]; truncated: boolean; pageTokens: Map<string, string>; userAccessToken?: string; stored: StoredOAuth } | { ok: false; message: string };

const CHOOSABLE = new Set(["facebook_pages", "linkedin", "ga4", "google_business_profile"]);

/** Re-read the provider's live list with this workspace's stored token. Tokens stay server-side. */
async function liveAccountOptions(ctx: ActionCtx, connection: Doc<"connections">): Promise<LiveOptions> {
  const google = GROUP_FOR[connection.provider] === "google";
  if (google) {
    const accessToken = await googleAccessToken(ctx, connection._id, connection.expiresAt);
    if (!accessToken) return { ok: false, message: "Google access expired. Reconnect the account." };
    if (connection.provider === "ga4") {
      const props = await listAccessibleProperties({ accessToken, maxPages: 2 });
      return props.ok ? { ok: true, options: ga4PropertyOptions(props.data.items), truncated: props.data.truncated, pageTokens: new Map(), stored: { accessToken } } : { ok: false, message: "Couldn't load your Analytics properties. Try again or reconnect." };
    }
    const locations = await listBusinessProfileLocations({ accessToken });
    return locations.ok
      ? { ok: true, options: businessProfileOptions(locations.data.items), truncated: locations.data.truncated, pageTokens: new Map(), stored: { accessToken } }
      : { ok: false, message: "Couldn't load your Business Profile locations. If ClimbOS's Google Business Profile API access is still pending, Google returns no data yet." };
  }
  const secret = await ctx.runQuery(internal.connections.getSecret, { connectionId: connection._id });
  const stored = secret ? parseStored(secret.value) : null;
  if (!stored) return { ok: false, message: "This connection's access was removed. Reconnect the account." };
  if (connection.provider === "facebook_pages") {
    const userAccessToken = stored.userAccessToken ?? stored.accessToken;
    const pages = await listManagedPages({ accessToken: userAccessToken, maxPages: 5 });
    if (!pages.ok) return { ok: false, message: "Couldn't load your Facebook Pages. Reconnect Facebook and allow Page access." };
    const pageTokens = new Map(pages.data.items.filter((p) => p.pageAccessToken).map((p) => [p.id, p.pageAccessToken!]));
    return { ok: true, options: facebookPageOptions(pages.data.items), truncated: pages.data.truncated, pageTokens, userAccessToken, stored };
  }
  if (stored.app === "linkedin_pages") {
    const orgs = await listAdministeredOrganizations({ accessToken: stored.accessToken });
    return orgs.ok ? { ok: true, options: linkedInOptions(null, orgs.data.items), truncated: orgs.data.truncated, pageTokens: new Map(), stored } : { ok: false, message: "Couldn't load the LinkedIn Pages you administer. Try again or reconnect." };
  }
  const me = await getLinkedInMember({ accessToken: stored.accessToken });
  return me.ok ? { ok: true, options: linkedInOptions(me.data, []), truncated: false, pageTokens: new Map(), stored } : { ok: false, message: "Couldn't read your LinkedIn profile. Reconnect LinkedIn." };
}

/** List the Pages, profiles, properties or locations an owner/admin can choose for this business. */
export const availableAccounts = action({
  args: { slug: v.string(), provider: providerValidator },
  handler: async (ctx, { slug, provider }): Promise<{ ok: boolean; options: AccountOption[]; truncated: boolean; selected: string | null; message: string }> => {
    const access = await ctx.runQuery(internal.access.orgAccessForAction, { slug, permission: "manage_connections" });
    if (!access) throw appError("NOT_FOUND", "We couldn't find that workspace.");
    if (access.kind === "demo") return { ok: false, options: [], truncated: false, selected: null, message: "Demo workspaces don't connect real accounts." };
    if (!CHOOSABLE.has(provider)) return { ok: false, options: [], truncated: false, selected: null, message: "This platform signs in as one account. To change it, connect again with the other account." };
    const connection = await ctx.runQuery(internal.connections.connectionFor, { orgId: access.orgId, provider });
    if (!connection || connection.status !== "connected" || connection.isFixture) return { ok: false, options: [], truncated: false, selected: null, message: "Connect the account first." };
    const live = await liveAccountOptions(ctx, connection);
    if (!live.ok) return { ok: false, options: [], truncated: false, selected: connection.externalAccountId ?? null, message: live.message };
    return {
      ok: true,
      options: live.options,
      truncated: live.truncated,
      selected: connection.externalAccountId ?? null,
      message: live.options.length ? "Choose the one for this business." : "Nothing to choose: this sign-in has no accounts of this kind.",
    };
  },
});

/** Bind one option to this business after re-checking it against the provider's live list. */
export const chooseAccount = action({
  args: { slug: v.string(), provider: providerValidator, accountId: v.string() },
  handler: async (ctx, { slug, provider, accountId }): Promise<{ ok: true; accountLabel: string }> => {
    const access = await ctx.runQuery(internal.access.orgAccessForAction, { slug, permission: "manage_connections" });
    if (!access) throw appError("NOT_FOUND", "We couldn't find that workspace.");
    if (access.kind === "demo") throw appError("FORBIDDEN", "Demo workspaces can't connect real accounts.");
    if (!CHOOSABLE.has(provider)) throw appError("INVALID", "This platform signs in as one account. Connect again to change it.");
    const connection = await ctx.runQuery(internal.connections.connectionFor, { orgId: access.orgId, provider });
    if (!connection || connection.status !== "connected" || connection.isFixture) throw appError("INVALID", "Connect the account first.");
    const live = await liveAccountOptions(ctx, connection);
    if (!live.ok) throw appError("UNAVAILABLE", live.message);
    const option = live.options.find((o) => o.id === accountId);
    if (!option) throw appError("FORBIDDEN", "Choose one of the accounts returned by your connected sign-in.");
    if (!option.canPublish && option.warning) throw appError("INVALID", option.warning);
    let secret: string | undefined;
    if (provider === "facebook_pages") {
      const pageToken = live.pageTokens.get(option.id);
      if (!pageToken) throw appError("INVALID", "Facebook didn't return access for this Page. Reconnect Facebook and allow it.");
      secret = JSON.stringify({ accessToken: pageToken, userAccessToken: live.userAccessToken });
    }
    const saved = await ctx.runMutation(internal.connections.chooseAccount, {
      orgId: access.orgId,
      userId: access.userId,
      connectionId: connection._id,
      provider,
      externalAccountId: option.id,
      accountLabel: option.label,
      accountType: option.accountType,
      secret,
    });
    if (!saved) throw appError("INVALID", "Reconnect the account and choose again.");
    if (provider === "ga4") await ctx.scheduler.runAfter(0, internal.connectionActions.syncGa4, { orgId: access.orgId });
    return { ok: true, accountLabel: option.label };
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
    const stored = parseStored(secret.value);
    const group = groupForSecret(secret.provider, stored);
    if (!stored || !group) return { ok: false, message: "Nothing to refresh." };
    const { clientId, clientSecret } = clientCreds(group);
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
      secret: JSON.stringify({ ...stored, accessToken: t.accessToken, refreshToken: t.refreshToken ?? stored.refreshToken }),
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
    const aiByDayProvider = new Map<string, { date: string; provider: string; sessions: number; keyEvents: number }>();
    for (const r of report.data.items) {
      const d = byDay.get(r.date) ?? { sessions: 0, users: 0, keyEvents: 0 };
      d.sessions += r.sessions;
      d.users += r.totalUsers;
      d.keyEvents += r.keyEvents;
      byDay.set(r.date, d);
      const provider = aiReferralAttribution(r.sessionSource, r.sessionMedium);
      if (provider) {
        const key = `${r.date}\u0000${provider}`;
        const traffic = aiByDayProvider.get(key) ?? { date: r.date, provider, sessions: 0, keyEvents: 0 };
        traffic.sessions += r.sessions;
        traffic.keyEvents += r.keyEvents;
        aiByDayProvider.set(key, traffic);
      }
    }
    const rows = [...byDay.entries()].flatMap(([date, d]) => [
      { metricKey: "visits", date, value: d.sessions },
      { metricKey: "signups", date, value: d.keyEvents },
    ]);
    rows.push(...[...aiByDayProvider.values()].flatMap(({ date, provider, sessions, keyEvents }) => [
      { metricKey: "ai_referral_sessions", date, value: sessions, channel: `AI referral / ${provider}` },
      { metricKey: "ai_referral_key_events", date, value: keyEvents, channel: `AI referral / ${provider}` },
    ]));
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

/** List directly accessible Google Ads accounts for an owner/admin to select. */
export const availableGoogleAdsAccounts = action({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const access = await ctx.runQuery(internal.access.orgAccessForAction, { slug, permission: "manage_connections" });
    if (access.kind === "demo") return { ok: false as const, customerIds: [], truncated: false, message: "Demo workspaces do not connect real accounts." };
    const connection = await ctx.runQuery(internal.connections.connectionFor, { orgId: access.orgId, provider: "google_ads" });
    if (!connection || connection.status !== "connected" || connection.isFixture) return { ok: false as const, customerIds: [], truncated: false, message: "Connect Google Ads first." };
    if (!connection.scopes.includes(GOOGLE_ADS_SCOPE)) return { ok: false as const, customerIds: [], truncated: false, message: "Reconnect Google Ads and grant Ads reporting access." };
    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    if (!developerToken) return { ok: false as const, customerIds: [], truncated: false, message: "Google Ads account selection needs ClimbOS developer-token setup." };
    const accessToken = await googleAccessToken(ctx, connection._id, connection.expiresAt);
    if (!accessToken) return { ok: false as const, customerIds: [], truncated: false, message: "Google Ads access expired. Reconnect the account." };
    const result = await listAccessibleCustomers({ accessToken, developerToken });
    if (!result.ok) return { ok: false as const, customerIds: [], truncated: false, message: `Google Ads accounts could not be loaded: ${result.providerMessage}` };
    return {
      ok: true as const,
      customerIds: result.data.slice(0, 100),
      truncated: result.data.length > 100,
      message: "Choose the business's advertiser account. Manager accounts cannot be selected in this setup.",
    };
  },
});

/** Validate the selected account against Google's live access list before binding it to this workspace. */
export const selectGoogleAdsAccount = action({
  args: { slug: v.string(), customerId: v.string() },
  handler: async (ctx, { slug, customerId }) => {
    const access = await ctx.runQuery(internal.access.orgAccessForAction, { slug, permission: "manage_connections" });
    if (access.kind === "demo") throw appError("FORBIDDEN", "Demo workspaces can't connect real accounts.");
    if (!/^\d{10}$/.test(customerId)) throw appError("INVALID", "Choose a valid Google Ads customer ID from the connected account.");
    const connection = await ctx.runQuery(internal.connections.connectionFor, { orgId: access.orgId, provider: "google_ads" });
    if (!connection || connection.status !== "connected" || connection.isFixture) throw appError("INVALID", "Connect Google Ads first.");
    if (!connection.scopes.includes(GOOGLE_ADS_SCOPE)) throw appError("FORBIDDEN", "Reconnect Google Ads and grant Ads reporting access.");
    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    if (!developerToken) throw appError("UNAVAILABLE", "Google Ads account selection needs ClimbOS developer-token setup.");
    const accessToken = await googleAccessToken(ctx, connection._id, connection.expiresAt);
    if (!accessToken) throw appError("UNAVAILABLE", "Google Ads access expired. Reconnect the account.");
    const accessible = await listAccessibleCustomers({ accessToken, developerToken });
    if (!accessible.ok || !accessible.data.includes(customerId)) throw appError("FORBIDDEN", "Choose an advertiser account returned by the connected Google sign-in.");
    const settings = await getCustomerSettings({ accessToken, developerToken, customerId });
    if (!settings.ok) throw appError("UNAVAILABLE", `Google Ads account details could not be read: ${settings.providerMessage}`);
    if (settings.data.managerAccount) throw appError("UNAVAILABLE", "This ClimbOS connection supports advertiser accounts. Google Ads manager accounts and their child-account selection are not supported yet.");
    const accountLabel = `${customerId} · ${settings.data.currencyCode}`;
    const saved = await ctx.runMutation(internal.connections.selectGoogleAdsAccount, {
      orgId: access.orgId,
      userId: access.userId,
      connectionId: connection._id,
      customerId,
      accountLabel,
    });
    if (!saved) throw appError("INVALID", "Reconnect Google Ads and select the account again.");
    return { ok: true as const, customerId, accountLabel, currency: settings.data.currencyCode };
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

/** Owner-triggered, single-URL read of Google's indexed snapshot for the selected property. */
export const inspectSearchConsoleUrl = action({
  args: { slug: v.string(), pageUrl: v.string() },
  handler: async (ctx: ActionCtx, { slug, pageUrl }): Promise<SearchUrlInspection & { inspectedAt: number; property: string }> => {
    const access = await ctx.runQuery(internal.access.orgAccessForAction, { slug, permission: "manage_connections" });
    if (!access) throw appError("NOT_FOUND", "We couldn't find that workspace.");
    if (access.kind === "demo") throw appError("FORBIDDEN", "Demo workspaces can't inspect a live Search Console property.");
    const connection = await ctx.runQuery(internal.connections.connectionFor, { orgId: access.orgId, provider: "search_console" });
    if (!connection || connection.status !== "connected" || connection.isFixture || !connection.externalAccountId) {
      throw appError("INVALID", "Connect Search Console and select a property before checking a page.");
    }
    const page = pageUrl.trim();
    if (!searchConsolePropertyMatchesWebsite(connection.externalAccountId, page)) {
      throw appError("INVALID", "Enter a page inside the Search Console property selected for this business.");
    }
    const accessToken = await googleAccessToken(ctx, connection._id, connection.expiresAt);
    if (!accessToken) throw appError("INVALID", "Search Console access expired. Reconnect the account.");
    const result = await inspectSearchUrl({ accessToken, siteUrl: connection.externalAccountId, inspectionUrl: page });
    if (!result.ok) throw appError("INVALID", "Google Search Console couldn't inspect that page. Check the URL and property access, then try again.");
    return { ...result.data, inspectedAt: Date.now(), property: connection.externalAccountId };
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
    await ctx.runMutation(internal.connections.markSync, {
      connectionId: conn._id,
      ok: true,
      stripeOpenInvoiceSnapshot: {
        asOf: Date.now(),
        partial: res.data.openInvoicesPartial,
        byCurrency: res.data.openInvoiceExposure,
      },
    });
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
