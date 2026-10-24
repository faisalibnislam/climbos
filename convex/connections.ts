import { v } from "convex/values";
import { evaluateCapabilities, type CapabilityContext } from "../shared/integrations/capabilities";
import {
  buildAuthorizationUrl,
  createPkcePair,
  generateState,
  OAUTH_PROVIDERS,
  scopesFor,
  type ScopedCapability,
} from "../shared/integrations/oauth";
import { PROVIDERS } from "../shared/integrations/registry";
import type { ProviderId } from "../shared/integrations/types";
import { sha256Hex } from "../shared/policy";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { providerValidator } from "./schema";
import { audit } from "./lib/audit";
import { decryptSecret, encryptSecret, secretAad } from "./lib/crypto";
import { appError, isOperator, requireOrgAccess } from "./lib/tenancy";

type OurProvider = Doc<"connections">["provider"];

/** Our provider keys → adapter registry ids. Manual-export platforms have no adapter. */
export const ADAPTER_ID: Partial<Record<OurProvider, ProviderId>> = {
  website: "website",
  ga4: "ga4",
  search_console: "search_console",
  google_ads: "google_ads",
  meta_ads: "meta_ads",
  facebook_pages: "facebook_pages",
  instagram: "instagram",
  linkedin: "linkedin",
  x: "x",
  email_resend: "resend_marketing",
  stripe_revenue: "stripe",
  csv_revenue: "csv_revenue",
};

const OAUTH_GROUP: Partial<Record<OurProvider, keyof typeof OAUTH_PROVIDERS>> = {
  ga4: "google",
  search_console: "google",
  google_ads: "google",
  meta_ads: "meta",
  facebook_pages: "meta",
  instagram: "instagram",
  linkedin: "linkedin",
  x: "x",
};

const OAUTH_CAPABILITIES: Partial<Record<OurProvider, ScopedCapability[]>> = {
  ga4: ["ga4.read_reports"],
  search_console: ["search_console.read_performance"],
  google_ads: ["google_ads.read_metrics", "google_ads.create_paused_campaign", "google_ads.set_campaign_status"],
  meta_ads: ["meta_ads.read_insights", "meta_ads.create_paused_campaign", "meta_ads.set_campaign_status"],
  facebook_pages: ["facebook_pages.publish_post", "facebook_pages.read_insights"],
  instagram: ["instagram.publish_media"],
  linkedin: ["linkedin.read_profile", "linkedin.publish_post"],
  x: ["x.read_profile", "x.publish_post"],
};

const CLIENT_ENV: Record<keyof typeof OAUTH_PROVIDERS, [string, string]> = {
  google: ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET"],
  meta: ["META_APP_ID", "META_APP_SECRET"],
  instagram: ["INSTAGRAM_APP_ID", "INSTAGRAM_APP_SECRET"],
  linkedin: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"],
  x: ["X_CLIENT_ID", "X_CLIENT_SECRET"],
};

/** True when ClimbOS has the OAuth app keys for this provider. */
function oauthConfigured(provider: OurProvider): boolean {
  const group = OAUTH_GROUP[provider];
  if (!group) return false;
  const [idEnv, secretEnv] = CLIENT_ENV[group];
  return Boolean(process.env[idEnv] && process.env[secretEnv]);
}

/** Drafts and export only (LinkedIn and X until their app keys are set). */
const MANUAL_ONLY: Partial<Record<OurProvider, string>> = {
  linkedin: "LinkedIn",
  x: "X (Twitter)",
  tiktok: "TikTok",
  pinterest: "Pinterest",
  youtube: "YouTube",
};

/** Display order and grouping for the Connections screen. */
export const CATALOG: { provider: OurProvider; group: "measure" | "publish" | "advertise" | "email" | "revenue" | "data" }[] = [
  { provider: "website", group: "measure" },
  { provider: "ga4", group: "measure" },
  { provider: "search_console", group: "measure" },
  { provider: "instagram", group: "publish" },
  { provider: "facebook_pages", group: "publish" },
  { provider: "linkedin", group: "publish" },
  { provider: "x", group: "publish" },
  { provider: "tiktok", group: "publish" },
  { provider: "pinterest", group: "publish" },
  { provider: "youtube", group: "publish" },
  { provider: "google_ads", group: "advertise" },
  { provider: "meta_ads", group: "advertise" },
  { provider: "email_resend", group: "email" },
  { provider: "stripe_revenue", group: "revenue" },
  { provider: "csv_revenue", group: "revenue" },
  { provider: "crm_csv", group: "data" },
  { provider: "enrichment", group: "data" },
];

function envSnapshot(): Record<string, string | undefined> {
  const keys = [
    "GOOGLE_OAUTH_CLIENT_ID",
    "GOOGLE_OAUTH_CLIENT_SECRET",
    "GOOGLE_ADS_DEVELOPER_TOKEN",
    "GOOGLE_ADS_ACCESS_LEVEL",
    "META_APP_ID",
    "META_APP_SECRET",
    "META_ADS_ACCESS_TIER",
    "INSTAGRAM_APP_ID",
    "INSTAGRAM_APP_SECRET",
    "LINKEDIN_CLIENT_ID",
    "LINKEDIN_CLIENT_SECRET",
    "X_CLIENT_ID",
    "X_CLIENT_SECRET",
    "FIRECRAWL_API_KEY",
  ];
  // Presence only: values never leave the server.
  return Object.fromEntries(keys.map((k) => [k, process.env[k] ? "set" : undefined]));
}

export const list = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org, role } = await requireOrgAccess(ctx, { slug }, "view");
    const rows = await ctx.db
      .query("connections")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .take(100);
    const business = await ctx.db
      .query("businesses")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .first();
    const env = envSnapshot();
    const now = Date.now();
    const operator = await isOperator(ctx);
    return {
      canManage: ["owner", "admin"].includes(role),
      isDemo: org.kind === "demo",
      items: CATALOG.map(({ provider, group }) => {
        const conn = rows.find((r) => r.provider === provider && r.status !== "revoked");
        if (MANUAL_ONLY[provider] && !oauthConfigured(provider)) {
          return {
            provider,
            group,
            name: MANUAL_ONLY[provider]!,
            description: `Ready-to-post drafts and export packs for ${MANUAL_ONLY[provider]}. Automatic publishing isn't available until an official integration is verified.`,
            connection: null,
            connectMethod: "none" as const,
            capabilities: [
              {
                capability: `${provider}.manual_export`,
                label: "Drafts and export pack",
                state: "ready" as const,
                reason: "ClimbOS writes platform-ready posts you can copy or download.",
                fix: "",
              },
              {
                capability: `${provider}.publish`,
                label: "Automatic publishing",
                state: "unavailable" as const,
                reason: "No verified official integration yet. ClimbOS never uses passwords or browser bots to post for you.",
                fix: "Use the export pack for now.",
              },
            ],
          };
        }
        if (provider === "crm_csv") {
          return {
            provider,
            group,
            name: "Your customer or lead list",
            description: "Upload contacts you already have (with their permission) so ClimbOS can qualify leads and plan follow-ups.",
            connection: conn ? { status: conn.status, accountLabel: conn.accountLabel ?? null, lastSyncAt: conn.lastSyncAt ?? null, expiresAt: null, isFixture: conn.isFixture } : null,
            connectMethod: "file_upload" as const,
            capabilities: [
              {
                capability: "crm.qualify",
                label: "Lead qualification and follow-up plans",
                state: conn ? ("ready" as const) : ("setup_needed" as const),
                reason: conn ? "Using the list you uploaded." : "Upload a CSV of leads or customers you already have.",
                fix: conn ? "" : "Upload a CSV",
              },
            ],
          };
        }
        if (provider === "enrichment") {
          return {
            provider,
            group,
            name: "Licensed lead data (optional)",
            description: "ClimbOS has no contact database. Finding new prospects requires a data provider you license and connect yourself.",
            connection: null,
            connectMethod: "none" as const,
            capabilities: [
              {
                capability: "enrichment.discover",
                label: "Find new prospects",
                state: "unavailable" as const,
                reason: "Not available: ClimbOS doesn't sell or include contact data, and no licensed provider is connected.",
                fix: "Work with leads you already have, or ask us about connecting your own licensed provider.",
              },
            ],
          };
        }
        const adapterId = ADAPTER_ID[provider]!;
        const meta = PROVIDERS[adapterId];
        const capCtx: CapabilityContext = {
          env,
          connected: conn?.status === "connected" || (provider === "website" && Boolean(business?.website)),
          grantedScopes: conn?.scopes,
          tokenExpiresAt: conn?.expiresAt,
          canRefreshToken: true,
          accountType: conn?.accountType,
          lastSyncAt: conn?.lastSyncAt,
          now,
        };
        let capabilities = evaluateCapabilities(adapterId, capCtx).map((c) => ({
          capability: c.capability,
          label: c.label,
          state: c.state,
          // Platform setup details (env var names, review steps) are for operators, not owners.
          reason:
            c.state === "setup_needed" && !operator && /administrator/i.test(c.fix)
              ? "ClimbOS is still finishing this connection on our side. Nothing for you to do yet."
              : c.reason,
          fix:
            c.state === "setup_needed" && !operator && /administrator/i.test(c.fix)
              ? "Meanwhile your team prepares drafts and export packs, and you can import data from a file where available."
              : c.fix,
        }));
        if (conn?.isFixture) {
          capabilities = capabilities.map((c) => ({
            ...c,
            state: c.state === "setup_needed" ? ("ready" as const) : c.state,
            reason: `Demo connection with synthetic data. ${c.state === "setup_needed" ? "In a real workspace this needs setup first." : c.reason}`,
          }));
        }
        return {
          provider,
          group,
          name: meta.displayName,
          description: meta.description,
          connection: conn
            ? {
                status: conn.status,
                accountLabel: conn.accountLabel ?? null,
                lastSyncAt: conn.lastSyncAt ?? null,
                expiresAt: conn.expiresAt ?? null,
                isFixture: conn.isFixture,
                lastSyncError: conn.lastSyncError ?? null,
              }
            : null,
          connectMethod: meta.connection,
          capabilities,
        };
      }),
    };
  },
});

export const startOAuth = mutation({
  args: { slug: v.string(), provider: providerValidator },
  handler: async (ctx, { slug, provider }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "manage_connections");
    if (org.kind === "demo") throw appError("FORBIDDEN", "Demo workspaces can't connect real accounts. Create your own workspace to connect.");
    const group = OAUTH_GROUP[provider];
    const caps = OAUTH_CAPABILITIES[provider];
    if (!group || !caps) throw appError("INVALID", "This connection doesn't use sign-in.");
    const [idEnv, secretEnv] = CLIENT_ENV[group];
    const clientId = process.env[idEnv];
    if (!clientId || !process.env[secretEnv]) {
      throw appError("UNAVAILABLE", "This connection isn't set up on ClimbOS yet. You can still use drafts and exports meanwhile.", { reason: "setup_needed" });
    }
    const config = OAUTH_PROVIDERS[group];
    const state = generateState();
    const pkce = config.supportsPkce ? await createPkcePair() : null;
    const stateHash = await sha256Hex(state);
    const enc = pkce ? await encryptSecret(pkce.codeVerifier, `oauth:${stateHash}`) : null;
    await ctx.db.insert("oauthStates", {
      orgId: org._id,
      userId: user._id,
      provider,
      stateHash,
      codeVerifier: enc ? JSON.stringify(enc) : undefined,
      expiresAt: Date.now() + 10 * 60_000,
    });
    const redirectUri = `${process.env.SITE_URL ?? "http://localhost:3000"}/api/oauth/callback`;
    const url = buildAuthorizationUrl({
      provider: config,
      clientId,
      redirectUri,
      scopes: scopesFor(caps),
      state,
      codeChallenge: pkce?.codeChallenge,
    });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "connection.oauth_started", subjectType: "connection", subjectId: provider, summary: `Started connecting ${provider}.` });
    return { url };
  },
});

/** Single-use state consumption (returns the PKCE verifier, decrypted). */
export const consumeOAuthState = internalMutation({
  args: { state: v.string() },
  handler: async (ctx, { state }) => {
    const stateHash = await sha256Hex(state);
    const row = await ctx.db
      .query("oauthStates")
      .withIndex("by_state", (q) => q.eq("stateHash", stateHash))
      .unique();
    if (!row) return null;
    await ctx.db.delete(row._id);
    if (row.expiresAt < Date.now()) return null;
    const org = await ctx.db.get(row.orgId);
    const verifier = row.codeVerifier ? await decryptSecret(JSON.parse(row.codeVerifier), `oauth:${stateHash}`) : undefined;
    return { orgId: row.orgId, slug: org?.slug ?? "", userId: row.userId, provider: row.provider, verifier };
  },
});

/** Store or replace a connection with an encrypted secret. Never returns the secret. */
export const storeConnection = internalMutation({
  args: {
    orgId: v.id("organizations"),
    userId: v.id("users"),
    provider: providerValidator,
    secret: v.string(),
    secretKind: v.union(v.literal("oauth"), v.literal("api_key")),
    scopes: v.array(v.string()),
    expiresAt: v.optional(v.number()),
    accountLabel: v.optional(v.string()),
    externalAccountId: v.optional(v.string()),
    accountType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("connections")
      .withIndex("by_org_provider", (q) => q.eq("orgId", args.orgId).eq("provider", args.provider))
      .first();
    let connectionId: Id<"connections">;
    if (existing) {
      connectionId = existing._id;
      await ctx.db.patch(existing._id, {
        status: "connected",
        scopes: args.scopes,
        expiresAt: args.expiresAt,
        accountLabel: args.accountLabel,
        externalAccountId: args.externalAccountId,
        accountType: args.accountType,
        lastSyncError: undefined,
        updatedAt: now,
      });
      const old = await ctx.db
        .query("connectionSecrets")
        .withIndex("by_connection", (q) => q.eq("connectionId", existing._id))
        .take(5);
      for (const s of old) await ctx.db.delete(s._id);
    } else {
      connectionId = await ctx.db.insert("connections", {
        orgId: args.orgId,
        provider: args.provider,
        status: "connected",
        accountLabel: args.accountLabel,
        externalAccountId: args.externalAccountId,
        accountType: args.accountType,
        scopes: args.scopes,
        expiresAt: args.expiresAt,
        isFixture: false,
        createdBy: args.userId,
        createdAt: now,
        updatedAt: now,
      });
    }
    const enc = await encryptSecret(args.secret, secretAad(args.orgId, connectionId));
    await ctx.db.insert("connectionSecrets", {
      orgId: args.orgId,
      connectionId,
      kind: args.secretKind,
      keyId: enc.keyId,
      iv: enc.iv,
      ciphertext: enc.ciphertext,
      createdAt: now,
    });
    await audit(ctx, { orgId: args.orgId, actorType: "user", actorId: args.userId, action: "connection.connected", subjectType: "connection", subjectId: connectionId, summary: `Connected ${args.provider}${args.accountLabel ? ` (${args.accountLabel})` : ""}.` });
    return connectionId;
  },
});

/** Replace a connection's OAuth secret after a token refresh (refresh tokens may rotate). */
export const rotateSecret = internalMutation({
  args: { connectionId: v.id("connections"), secret: v.string(), expiresAt: v.optional(v.number()) },
  handler: async (ctx, { connectionId, secret, expiresAt }) => {
    const conn = await ctx.db.get(connectionId);
    if (!conn || conn.status !== "connected") return false;
    const now = Date.now();
    const old = await ctx.db
      .query("connectionSecrets")
      .withIndex("by_connection", (q) => q.eq("connectionId", connectionId))
      .take(5);
    for (const s of old) await ctx.db.delete(s._id);
    const enc = await encryptSecret(secret, secretAad(conn.orgId, connectionId));
    await ctx.db.insert("connectionSecrets", { orgId: conn.orgId, connectionId, kind: "oauth", keyId: enc.keyId, iv: enc.iv, ciphertext: enc.ciphertext, createdAt: now });
    await ctx.db.patch(connectionId, { expiresAt, lastSyncError: undefined, updatedAt: now });
    return true;
  },
});

/** Persist only a property returned by the connected account's sites.list response. */
export const selectSearchConsoleSite = internalMutation({
  args: { orgId: v.id("organizations"), connectionId: v.id("connections"), siteUrl: v.string(), accountLabel: v.string() },
  handler: async (ctx, { orgId, connectionId, siteUrl, accountLabel }) => {
    const connection = await ctx.db.query("connections").withIndex("by_org_provider", (q) => q.eq("orgId", orgId).eq("provider", "search_console")).first();
    if (!connection || connection._id !== connectionId || connection.status !== "connected" || connection.isFixture) return false;
    await ctx.db.patch(connection._id, { externalAccountId: siteUrl, accountLabel: accountLabel.slice(0, 200), accountType: "search_console_property", lastSyncError: undefined, updatedAt: Date.now() });
    return true;
  },
});

/** Internal only: decrypt a connection's secret for an action. Verifies tenant binding via AAD. */
export const getSecret = internalQuery({
  /** forRevocation: disconnect marks the row revoked before the revoke action runs. */
  args: { connectionId: v.id("connections"), forRevocation: v.optional(v.boolean()) },
  handler: async (ctx, { connectionId, forRevocation }) => {
    const conn = await ctx.db.get(connectionId);
    if (!conn || (conn.status !== "connected" && !(forRevocation && conn.status === "revoked"))) return null;
    const secret = await ctx.db
      .query("connectionSecrets")
      .withIndex("by_connection", (q) => q.eq("connectionId", connectionId))
      .first();
    if (!secret) return null;
    return {
      provider: conn.provider,
      orgId: conn.orgId,
      externalAccountId: conn.externalAccountId ?? null,
      value: await decryptSecret(secret, secretAad(conn.orgId, connectionId)),
    };
  },
});

export const connectionFor = internalQuery({
  args: { orgId: v.id("organizations"), provider: providerValidator },
  handler: async (ctx, { orgId, provider }) =>
    ctx.db
      .query("connections")
      .withIndex("by_org_provider", (q) => q.eq("orgId", orgId).eq("provider", provider))
      .first(),
});

export const disconnect = mutation({
  args: { slug: v.string(), provider: providerValidator },
  handler: async (ctx, { slug, provider }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "manage_connections");
    const conn = await ctx.db
      .query("connections")
      .withIndex("by_org_provider", (q) => q.eq("orgId", org._id).eq("provider", provider))
      .first();
    if (!conn) return;
    const secrets = await ctx.db
      .query("connectionSecrets")
      .withIndex("by_connection", (q) => q.eq("connectionId", conn._id))
      .take(5);
    // Best-effort provider-side revocation happens before the secret is deleted. Bound to these secret
    // rows, so a quick reconnect's new token is never the one revoked.
    if (secrets.length && !conn.isFixture) {
      await ctx.scheduler.runAfter(0, internal.connectionActions.revokeProviderToken, { connectionId: conn._id, secretIds: secrets.map((s) => s._id) });
    } else {
      for (const s of secrets) await ctx.db.delete(s._id);
    }
    await ctx.db.patch(conn._id, { status: "revoked", updatedAt: Date.now() });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "connection.revoked", subjectType: "connection", subjectId: conn._id, summary: `Disconnected ${provider}.` });
  },
});

export const deleteSecrets = internalMutation({
  args: { connectionId: v.id("connections"), secretIds: v.optional(v.array(v.id("connectionSecrets"))) },
  handler: async (ctx, { connectionId, secretIds }) => {
    const secrets = await ctx.db
      .query("connectionSecrets")
      .withIndex("by_connection", (q) => q.eq("connectionId", connectionId))
      .take(5);
    for (const s of secrets) if (!secretIds || secretIds.includes(s._id)) await ctx.db.delete(s._id);
  },
});

/** Decrypt specific secret rows for revocation (whatever the connection's status is now). */
export const secretsForRevocation = internalQuery({
  args: { connectionId: v.id("connections"), secretIds: v.array(v.id("connectionSecrets")) },
  handler: async (ctx, { connectionId, secretIds }) => {
    const conn = await ctx.db.get(connectionId);
    if (!conn) return [];
    const out: { provider: typeof conn.provider; value: string }[] = [];
    for (const id of secretIds) {
      const s = await ctx.db.get(id);
      if (!s || s.connectionId !== connectionId) continue;
      out.push({ provider: conn.provider, value: await decryptSecret(s, secretAad(conn.orgId, connectionId)) });
    }
    return out;
  },
});

export const markSync = internalMutation({
  args: { connectionId: v.id("connections"), ok: v.boolean(), error: v.optional(v.string()), expired: v.optional(v.boolean()) },
  handler: async (ctx, { connectionId, ok, error, expired }) => {
    const conn = await ctx.db.get(connectionId);
    if (!conn) return;
    await ctx.db.patch(
      connectionId,
      ok
        ? { lastSyncAt: Date.now(), lastSyncError: undefined, updatedAt: Date.now() }
        : { lastSyncError: error?.slice(0, 300), updatedAt: Date.now(), ...(expired && conn.status === "connected" ? { status: "expired" as const } : {}) },
    );
  },
});

export const expiringConnections = internalQuery({
  args: {},
  handler: async (ctx) =>
    ctx.db
      .query("connections")
      .withIndex("by_expires", (q) => q.gt("expiresAt", 0).lt("expiresAt", Date.now() + 7 * 86_400_000))
      .take(100),
});
