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
import { reviewStateFor } from "../shared/integrations/platformApprovals";
import { PROVIDERS } from "../shared/integrations/registry";
import type { ProviderId } from "../shared/integrations/types";
import { sha256Hex } from "../shared/policy";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query, type MutationCtx } from "./_generated/server";
import { providerValidator } from "./schema";
import { audit } from "./lib/audit";
import { getPlatformApprovals } from "./lib/platformApprovals";
import { decryptSecret, encryptSecret, secretAad } from "./lib/crypto";
import { appError, isOperator, requireOrgAccess } from "./lib/tenancy";

type OurProvider = Doc<"connections">["provider"];

/** Our provider keys → adapter registry ids. Manual-export platforms have no adapter. */
export const ADAPTER_ID: Partial<Record<OurProvider, ProviderId>> = {
  website: "website",
  ga4: "ga4",
  search_console: "search_console",
  google_ads: "google_ads",
  google_business_profile: "google_business_profile",
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
  google_business_profile: "google",
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
  google_business_profile: ["google_business_profile.list_locations"],
  meta_ads: ["meta_ads.read_insights", "meta_ads.create_paused_campaign", "meta_ads.set_campaign_status"],
  facebook_pages: ["facebook_pages.list_pages", "facebook_pages.publish_post", "facebook_pages.read_posts", "facebook_pages.read_insights"],
  instagram: ["instagram.publish_media", "instagram.read_posts", "instagram.read_insights"],
  linkedin: ["linkedin.read_profile", "linkedin.publish_post"],
  x: ["x.read_profile", "x.publish_post"],
};

export const CLIENT_ENV: Record<keyof typeof OAUTH_PROVIDERS, [string, string]> = {
  google: ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET"],
  meta: ["META_APP_ID", "META_APP_SECRET"],
  instagram: ["INSTAGRAM_APP_ID", "INSTAGRAM_APP_SECRET"],
  linkedin: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"],
  linkedin_pages: ["LINKEDIN_PAGES_CLIENT_ID", "LINKEDIN_PAGES_CLIENT_SECRET"],
  x: ["X_CLIENT_ID", "X_CLIENT_SECRET"],
};

export type OAuthVariant = "linkedin_pages";

/** The OAuth app and capabilities for a sign-in (LinkedIn Pages sign in through their own app). */
export function oauthPlanFor(provider: OurProvider, variant?: OAuthVariant): { group: keyof typeof OAUTH_PROVIDERS; caps: ScopedCapability[] } | null {
  if (variant === "linkedin_pages") return provider === "linkedin" ? { group: "linkedin_pages", caps: ["linkedin.list_organizations", "linkedin.publish_org_post"] } : null;
  const group = OAUTH_GROUP[provider];
  const caps = OAUTH_CAPABILITIES[provider];
  return group && caps ? { group, caps } : null;
}

/**
 * Providers where the owner picks one account, Page, organization or location
 * per business. `kind` drives the chooser wording; X and Instagram sign in as
 * exactly one account, so "Change" means signing in again.
 */
export const ACCOUNT_CHOICE: Partial<Record<OurProvider, { kind: "page" | "profile_or_page" | "location" | "property" | "account"; noun: string; selectable: boolean }>> = {
  facebook_pages: { kind: "page", noun: "Facebook Page", selectable: true },
  instagram: { kind: "account", noun: "Instagram professional account", selectable: false },
  linkedin: { kind: "profile_or_page", noun: "LinkedIn profile or Page", selectable: true },
  x: { kind: "account", noun: "X account", selectable: false },
  ga4: { kind: "property", noun: "Analytics property", selectable: true },
  google_business_profile: { kind: "location", noun: "Business Profile location", selectable: true },
};

/** accountType marker set at sign-in when the owner still has to choose. */
export const SELECTION_REQUIRED = "selection_required";

export function needsAccountChoice(conn: Pick<Doc<"connections">, "accountType" | "externalAccountId"> | null | undefined): boolean {
  return Boolean(conn && (conn.accountType === SELECTION_REQUIRED || !conn.externalAccountId));
}

/** True when ClimbOS has the OAuth app keys for this provider. */
function oauthConfigured(provider: OurProvider): boolean {
  const group = OAUTH_GROUP[provider];
  if (!group) return false;
  if (provider === "linkedin" && process.env.LINKEDIN_PAGES_CLIENT_ID && process.env.LINKEDIN_PAGES_CLIENT_SECRET) return true;
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
  { provider: "google_business_profile", group: "measure" },
  { provider: "instagram", group: "publish" },
  { provider: "facebook_pages", group: "publish" },
  { provider: "linkedin", group: "publish" },
  { provider: "x", group: "publish" },
  { provider: "tiktok", group: "publish" },
  { provider: "pinterest", group: "publish" },
  { provider: "youtube", group: "publish" },
  { provider: "wordpress", group: "publish" },
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
    "LINKEDIN_PAGES_CLIENT_ID",
    "LINKEDIN_PAGES_CLIENT_SECRET",
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
    const approvals = await getPlatformApprovals(ctx);
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
        if (provider === "wordpress") {
          return {
            provider,
            group,
            name: "WordPress",
            description: "Connect a WordPress user with a revocable Application Password. ClimbOS can send separately confirmed articles as private drafts and verify the saved status.",
            connection: conn
              ? { status: conn.status, accountLabel: conn.accountLabel ?? null, externalAccountId: conn.externalAccountId ?? null, lastSyncAt: conn.lastSyncAt ?? null, expiresAt: null, isFixture: conn.isFixture, lastSyncError: conn.lastSyncError ?? null }
              : null,
            connectMethod: "wordpress_app_password" as const,
            capabilities: [
              { capability: "wordpress.manual_export", label: "Article draft and export", state: "ready" as const, reason: "You can always review and export an approved ClimbOS article.", fix: "" },
              { capability: "wordpress.authenticate", label: "Secure WordPress connection", state: conn?.status === "connected" ? "ready" as const : "setup_needed" as const, reason: conn?.status === "connected" ? "The stored Application Password was accepted and the account can edit posts." : "No WordPress account is connected.", fix: conn?.status === "connected" ? "" : "Connect using a revocable Application Password over HTTPS." },
              { capability: "wordpress.create_draft", label: "Create a WordPress draft", state: conn?.status === "connected" ? "ready" as const : "setup_needed" as const, reason: conn?.status === "connected" ? "Approved blog articles can be sent as private WordPress drafts after a separate confirmation." : "Connect WordPress to create a private draft from an approved article.", fix: conn?.status === "connected" ? "" : "Connect using a revocable Application Password over HTTPS." },
            ],
          };
        }
        const adapterId = ADAPTER_ID[provider]!;
        const meta = PROVIDERS[adapterId];
        const review = reviewStateFor(adapterId, approvals);
        const capCtx: CapabilityContext = {
          appReview: review.appReview,
          approvalLabels: review.approvalLabels,
          env,
          connected: conn?.status === "connected" || (provider === "website" && Boolean(business?.website)),
          grantedScopes: conn?.scopes,
          tokenExpiresAt: conn?.expiresAt,
          canRefreshToken: true,
          accountType: conn?.accountType,
          lastSyncAt: conn?.lastSyncAt,
          lastSyncError: conn?.lastSyncError,
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
        const choice = ACCOUNT_CHOICE[provider];
        const choiceNeeded = Boolean(choice && conn?.status === "connected" && !conn.isFixture && needsAccountChoice(conn));
        if (choice && choiceNeeded) {
          capabilities = capabilities.map((c) => ({
            ...c,
            state: c.state === "ready" ? ("action_required" as const) : c.state,
            reason: c.state === "ready" ? `Signed in, but no ${choice.noun} is chosen for this business yet.` : c.reason,
            fix: c.state === "ready" ? `Choose the ${choice.noun} below.` : c.fix,
          }));
        }
        if (provider === "linkedin" && !(env.LINKEDIN_PAGES_CLIENT_ID && env.LINKEDIN_PAGES_CLIENT_SECRET)) {
          capabilities = capabilities.map((c) =>
            c.capability === "linkedin.list_organizations" || c.capability === "linkedin.publish_org_post"
              ? {
                  ...c,
                  state: "setup_needed" as const,
                  reason: operator ? "Company Page posting signs in through a second LinkedIn app (Community Management API), which isn't set up." : "ClimbOS is still finishing LinkedIn Page posting on our side. Nothing for you to do yet.",
                  fix: operator ? "Add LINKEDIN_PAGES_CLIENT_ID and LINKEDIN_PAGES_CLIENT_SECRET (Console → Platform setup → LinkedIn)." : "Meanwhile you can post to your personal profile, or use drafts and export.",
                }
              : c,
          );
        }
        if (provider === "linkedin" && conn?.status === "connected" && !conn.isFixture && !choiceNeeded) {
          // Only the capability that matches the chosen author applies.
          const asPage = conn.accountType === "linkedin_organization";
          capabilities = capabilities.map((c) =>
            c.state !== "setup_needed" && (asPage ? c.capability === "linkedin.publish_post" || c.capability === "linkedin.read_profile" : c.capability === "linkedin.publish_org_post" || c.capability === "linkedin.list_organizations")
              ? { ...c, state: "unavailable" as const, reason: asPage ? "Posts go to your LinkedIn Page, not your personal profile." : "Posts go to your personal profile. Choose a Page to post as your company.", fix: asPage ? "To post as yourself instead, use Change and sign in with your profile." : "To post as your company, use Change and sign in with a LinkedIn Page." }
              : c,
          );
        }
        if (provider === "google_ads" && conn?.status === "connected" && !conn.isFixture && !conn.externalAccountId) {
          capabilities = capabilities.map((c) => ({
            ...c,
            state: c.state === "ready" ? ("setup_needed" as const) : c.state,
            reason: c.reason || "Choose the advertiser account this workspace should use.",
            fix: c.fix || "Select a directly accessible advertiser account below. Manager accounts are not supported in this connection flow.",
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
                externalAccountId: conn.externalAccountId ?? null,
                accountType: conn.accountType ?? null,
                lastSyncAt: conn.lastSyncAt ?? null,
                expiresAt: conn.expiresAt ?? null,
                isFixture: conn.isFixture,
                lastSyncError: conn.lastSyncError ?? null,
              }
            : null,
          connectMethod: meta.connection,
          choice: choice ? { ...choice, needed: choiceNeeded } : null,
          /** LinkedIn company Pages sign in through a second LinkedIn app (Community Management API). */
          pagesSignIn: provider === "linkedin" ? Boolean(env.LINKEDIN_PAGES_CLIENT_ID && env.LINKEDIN_PAGES_CLIENT_SECRET) : undefined,
          capabilities,
        };
      }),
    };
  },
});

export const startOAuth = mutation({
  args: { slug: v.string(), provider: providerValidator, variant: v.optional(v.literal("linkedin_pages")) },
  handler: async (ctx, { slug, provider, variant }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "manage_connections");
    if (org.kind === "demo") throw appError("FORBIDDEN", "Demo workspaces can't connect real accounts. Create your own workspace to connect.");
    const plan = oauthPlanFor(provider, variant);
    if (!plan) throw appError("INVALID", "This connection doesn't use sign-in.");
    const { group, caps } = plan;
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
      variant,
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
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "connection.oauth_started", subjectType: "connection", subjectId: provider, summary: `Started connecting ${provider}${variant === "linkedin_pages" ? " (company Page)" : ""}.` });
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
    return { orgId: row.orgId, slug: org?.slug ?? "", userId: row.userId, provider: row.provider, variant: row.variant, verifier };
  },
});

/**
 * Approvals are bound to a connection, not to the Page or profile behind it, so
 * when the destination changes (or the account is disconnected) every pending or
 * approved publish through that connection must be re-approved.
 */
async function invalidateConnectionApprovals(ctx: MutationCtx, orgId: Id<"organizations">, connectionId: Id<"connections">, reason: string): Promise<number> {
  let count = 0;
  for (const status of ["pending", "approved"] as const) {
    const rows = await ctx.db
      .query("approvals")
      .withIndex("by_org_status", (q) => q.eq("orgId", orgId).eq("status", status))
      .take(500);
    for (const ap of rows) {
      if (ap.scope.connectionId !== connectionId) continue;
      await ctx.db.patch(ap._id, { status: "invalidated", invalidatedReason: reason });
      count++;
    }
  }
  return count;
}

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
      if (existing.externalAccountId && existing.externalAccountId !== args.externalAccountId) {
        await invalidateConnectionApprovals(ctx, args.orgId, existing._id, "The connected account changed. Approve the post again for the new destination.");
      }
      await ctx.db.patch(existing._id, {
        status: "connected",
        scopes: args.scopes,
        expiresAt: args.expiresAt,
        accountLabel: args.accountLabel,
        externalAccountId: args.externalAccountId,
        accountType: args.accountType,
        lastSyncError: undefined,
        ...(args.provider === "stripe_revenue" ? { stripeOpenInvoiceSnapshot: undefined, lastSyncAt: undefined } : {}),
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

/** Save only a Google Ads advertiser ID verified against the connected user's live access list. */
export const selectGoogleAdsAccount = internalMutation({
  args: {
    orgId: v.id("organizations"),
    userId: v.id("users"),
    connectionId: v.id("connections"),
    customerId: v.string(),
    accountLabel: v.string(),
  },
  handler: async (ctx, { orgId, userId, connectionId, customerId, accountLabel }) => {
    const connection = await ctx.db.query("connections").withIndex("by_org_provider", (q) => q.eq("orgId", orgId).eq("provider", "google_ads")).first();
    if (!connection || connection._id !== connectionId || connection.status !== "connected" || connection.isFixture) return false;
    await ctx.db.patch(connection._id, {
      externalAccountId: customerId,
      accountLabel: accountLabel.slice(0, 200),
      accountType: "google_ads_advertiser",
      lastSyncError: undefined,
      updatedAt: Date.now(),
    });
    await audit(ctx, { orgId, actorType: "user", actorId: userId, action: "connection.google_ads_account_selected", subjectType: "connection", subjectId: connection._id, summary: `Selected Google Ads advertiser account ${customerId}.` });
    return true;
  },
});

/**
 * Bind one account (Facebook Page, LinkedIn profile or Page, Analytics property,
 * Business Profile location) to this business. The caller (an action) has already
 * verified `externalAccountId` against the provider's live list for the stored token.
 * Optionally replaces the stored secret (a Facebook Page access token).
 */
export const chooseAccount = internalMutation({
  args: {
    orgId: v.id("organizations"),
    userId: v.id("users"),
    connectionId: v.id("connections"),
    provider: providerValidator,
    externalAccountId: v.string(),
    accountLabel: v.string(),
    accountType: v.string(),
    secret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const connection = await ctx.db
      .query("connections")
      .withIndex("by_org_provider", (q) => q.eq("orgId", args.orgId).eq("provider", args.provider))
      .first();
    // Tenant binding: the connection must be this workspace's live connection for this provider.
    if (!connection || connection._id !== args.connectionId || connection.status !== "connected" || connection.isFixture) return false;
    const changed = connection.externalAccountId !== args.externalAccountId;
    const now = Date.now();
    if (args.secret !== undefined) {
      const old = await ctx.db
        .query("connectionSecrets")
        .withIndex("by_connection", (q) => q.eq("connectionId", connection._id))
        .take(5);
      for (const s of old) await ctx.db.delete(s._id);
      const enc = await encryptSecret(args.secret, secretAad(args.orgId, connection._id));
      await ctx.db.insert("connectionSecrets", { orgId: args.orgId, connectionId: connection._id, kind: "oauth", keyId: enc.keyId, iv: enc.iv, ciphertext: enc.ciphertext, createdAt: now });
    }
    await ctx.db.patch(connection._id, {
      externalAccountId: args.externalAccountId,
      accountLabel: args.accountLabel.slice(0, 200),
      accountType: args.accountType,
      lastSyncError: undefined,
      ...(changed ? { lastSyncAt: undefined } : {}),
      updatedAt: now,
    });
    const invalidated = changed && connection.externalAccountId
      ? await invalidateConnectionApprovals(ctx, args.orgId, connection._id, "The connected account changed. Approve the post again for the new destination.")
      : 0;
    await audit(ctx, {
      orgId: args.orgId,
      actorType: "user",
      actorId: args.userId,
      action: "connection.account_selected",
      subjectType: "connection",
      subjectId: connection._id,
      summary: `Chose ${args.accountLabel.slice(0, 120)} for ${args.provider}${invalidated ? `; ${invalidated} approval${invalidated === 1 ? "" : "s"} need re-approval` : ""}.`,
    });
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

/** Providers with a documented token-revocation endpoint (Instagram has none). */
const REVOCABLE = new Set<OurProvider>(["ga4", "search_console", "google_ads", "google_business_profile", "meta_ads", "facebook_pages", "x"]);

/** Where the owner removes ClimbOS when the provider gives apps no revoke call. */
const MANUAL_REVOKE: Partial<Record<OurProvider, string>> = {
  instagram: "Instagram has no way for apps to revoke access. To remove ClimbOS fully, open Instagram → Settings → Website permissions → Apps and websites.",
  linkedin: "LinkedIn has no way for apps to revoke access. To remove ClimbOS fully, open LinkedIn → Settings → Data privacy → Permitted services.",
};

export const disconnect = mutation({
  args: { slug: v.string(), provider: providerValidator },
  handler: async (ctx, { slug, provider }): Promise<{ revokedAtProvider: boolean; manualStep: string | null }> => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "manage_connections");
    const conn = await ctx.db
      .query("connections")
      .withIndex("by_org_provider", (q) => q.eq("orgId", org._id).eq("provider", provider))
      .first();
    if (!conn || conn.status === "revoked") return { revokedAtProvider: false, manualStep: null };
    const secrets = await ctx.db
      .query("connectionSecrets")
      .withIndex("by_connection", (q) => q.eq("connectionId", conn._id))
      .take(5);
    const revocable = REVOCABLE.has(provider) && !conn.isFixture && secrets.length > 0;
    // Best-effort provider-side revocation happens before the secret is deleted. Bound to these secret
    // rows, so a quick reconnect's new token is never the one revoked.
    if (revocable) {
      await ctx.scheduler.runAfter(0, internal.connectionActions.revokeProviderToken, { connectionId: conn._id, secretIds: secrets.map((s) => s._id) });
    } else {
      for (const s of secrets) await ctx.db.delete(s._id);
    }
    const label = conn.accountLabel;
    await ctx.db.patch(conn._id, { status: "revoked", accountLabel: undefined, externalAccountId: undefined, accountType: undefined, expiresAt: undefined, lastSyncError: undefined, updatedAt: Date.now() });
    const invalidated = await invalidateConnectionApprovals(ctx, org._id, conn._id, "The account was disconnected. Reconnect it and approve the post again.");
    await audit(ctx, {
      orgId: org._id,
      actorType: "user",
      actorId: user._id,
      action: "connection.revoked",
      subjectType: "connection",
      subjectId: conn._id,
      summary: `Disconnected ${provider}${label ? ` (${label.slice(0, 120)})` : ""}${invalidated ? `; ${invalidated} approval${invalidated === 1 ? "" : "s"} withdrawn` : ""}.`,
    });
    const manualStep = !conn.isFixture ? (MANUAL_REVOKE[provider] ?? null) : null;
    return { revokedAtProvider: revocable, manualStep };
  },
});

export const deleteSecrets = internalMutation({
  args: {
    connectionId: v.id("connections"),
    secretIds: v.optional(v.array(v.id("connectionSecrets"))),
    /** Revocation outcome to audit (omitted by older scheduled jobs). */
    revocation: v.optional(v.union(v.literal("revoked"), v.literal("failed"), v.literal("unsupported"))),
  },
  handler: async (ctx, { connectionId, secretIds, revocation }) => {
    const secrets = await ctx.db
      .query("connectionSecrets")
      .withIndex("by_connection", (q) => q.eq("connectionId", connectionId))
      .take(5);
    let deleted = 0;
    for (const s of secrets) {
      if (!secretIds || secretIds.includes(s._id)) {
        await ctx.db.delete(s._id);
        deleted++;
      }
    }
    const conn = await ctx.db.get(connectionId);
    if (conn && revocation) {
      await audit(ctx, {
        orgId: conn.orgId,
        actorType: "system",
        action: "connection.token_revoked",
        subjectType: "connection",
        subjectId: connectionId,
        summary: `${conn.provider}: ${revocation === "revoked" ? "provider revoked the access token" : revocation === "failed" ? "provider revocation failed; token deleted locally" : "provider has no revocation endpoint; token deleted locally"} (${deleted} stored secret${deleted === 1 ? "" : "s"} deleted).`,
      });
    }
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
  args: {
    connectionId: v.id("connections"),
    ok: v.boolean(),
    error: v.optional(v.string()),
    expired: v.optional(v.boolean()),
    stripeOpenInvoiceSnapshot: v.optional(v.object({
      asOf: v.number(),
      partial: v.boolean(),
      byCurrency: v.array(v.object({
        currency: v.string(),
        invoiceCount: v.number(),
        remainingMinor: v.number(),
        pastDueInvoiceCount: v.number(),
        pastDueRemainingMinor: v.number(),
        dueDateUnknownCount: v.number(),
      })),
    })),
  },
  handler: async (ctx, { connectionId, ok, error, expired, stripeOpenInvoiceSnapshot }) => {
    const conn = await ctx.db.get(connectionId);
    if (!conn) return;
    await ctx.db.patch(
      connectionId,
      ok
        ? { lastSyncAt: Date.now(), lastSyncError: undefined, updatedAt: Date.now(), ...(stripeOpenInvoiceSnapshot ? { stripeOpenInvoiceSnapshot } : {}) }
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
