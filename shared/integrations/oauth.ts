/**
 * OAuth 2.0 helpers: state, PKCE (S256 via crypto.subtle), authorization URL,
 * and request builders/parsers for code exchange, refresh and revocation.
 *
 * Builders return plain request descriptions so they can be executed by any
 * fetch (and asserted in tests) without side effects.
 */

import { asNumber, asString, isRecord } from "./http";
import { GRAPH_API_VERSION } from "./registry";

export interface OAuthProviderConfig {
  id: "google" | "meta" | "instagram" | "linkedin" | "x";
  authorizationEndpoint: string;
  tokenEndpoint: string;
  revocationEndpoint?: string;
  /** Whether we send PKCE parameters. Only enabled where the provider documents support. */
  supportsPkce: boolean;
  scopeSeparator: " " | ",";
  /** Extra fixed authorization params (e.g. Google offline access). */
  extraAuthParams?: Record<string, string>;
  /** How the token endpoint authenticates us: secret in the form body (default) or HTTP Basic. */
  clientAuth?: "body" | "basic";
}

export const OAUTH_PROVIDERS: Record<OAuthProviderConfig["id"], OAuthProviderConfig> = {
  google: {
    id: "google",
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    revocationEndpoint: "https://oauth2.googleapis.com/revoke",
    supportsPkce: true,
    scopeSeparator: " ",
    extraAuthParams: { access_type: "offline", include_granted_scopes: "true", prompt: "consent" },
  },
  meta: {
    id: "meta",
    authorizationEndpoint: `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth`,
    tokenEndpoint: `https://graph.facebook.com/${GRAPH_API_VERSION}/oauth/access_token`,
    // Revocation is DELETE /me/permissions with the user token (see buildRevocationRequest).
    revocationEndpoint: `https://graph.facebook.com/${GRAPH_API_VERSION}/me/permissions`,
    // The manual-flow doc does not document code_challenge; we rely on state + server-side secret.
    supportsPkce: false,
    scopeSeparator: ",",
  },
  instagram: {
    id: "instagram",
    authorizationEndpoint: "https://www.instagram.com/oauth/authorize",
    tokenEndpoint: "https://api.instagram.com/oauth/access_token",
    supportsPkce: false,
    scopeSeparator: ",",
    extraAuthParams: { enable_fb_login: "false" },
  },
  linkedin: {
    id: "linkedin",
    authorizationEndpoint: "https://www.linkedin.com/oauth/v2/authorization",
    tokenEndpoint: "https://www.linkedin.com/oauth/v2/accessToken",
    revocationEndpoint: "https://www.linkedin.com/oauth/v2/revoke",
    supportsPkce: false,
    scopeSeparator: " ",
  },
  x: {
    id: "x",
    authorizationEndpoint: "https://x.com/i/oauth2/authorize",
    tokenEndpoint: "https://api.x.com/2/oauth2/token",
    revocationEndpoint: "https://api.x.com/2/oauth2/revoke",
    // X requires PKCE for every OAuth 2.0 client.
    supportsPkce: true,
    scopeSeparator: " ",
    clientAuth: "basic",
  },
};

/** Least-privilege OAuth scopes per capability. */
export const CAPABILITY_SCOPES = {
  "ga4.read_reports": ["https://www.googleapis.com/auth/analytics.readonly"],
  "search_console.read_performance": ["https://www.googleapis.com/auth/webmasters.readonly"],
  "search_console.inspect_url": ["https://www.googleapis.com/auth/webmasters.readonly"],
  // Google Ads has a single scope for both read and write.
  "google_ads.read_metrics": ["https://www.googleapis.com/auth/adwords"],
  "google_ads.create_paused_campaign": ["https://www.googleapis.com/auth/adwords"],
  "google_ads.set_campaign_status": ["https://www.googleapis.com/auth/adwords"],
  "meta_ads.read_insights": ["ads_read"],
  "meta_ads.create_paused_campaign": ["ads_management"],
  "meta_ads.set_campaign_status": ["ads_management"],
  "facebook_pages.list_pages": ["pages_show_list"],
  "facebook_pages.publish_post": ["pages_show_list", "pages_manage_posts", "pages_read_engagement"],
  "facebook_pages.read_posts": ["pages_show_list", "pages_read_engagement"],
  "facebook_pages.read_insights": ["pages_show_list", "read_insights", "pages_read_engagement"],
  "instagram.read_profile": ["instagram_business_basic"],
  "instagram.read_posts": ["instagram_business_basic"],
  "instagram.publish_media": ["instagram_business_basic", "instagram_business_content_publish"],
  "linkedin.read_profile": ["openid", "profile"],
  "linkedin.publish_post": ["w_member_social"],
  "x.read_profile": ["users.read", "tweet.read"],
  // offline.access → refresh token (X access tokens are short-lived).
  "x.publish_post": ["tweet.read", "tweet.write", "users.read", "offline.access"],
} as const satisfies Record<string, readonly string[]>;

export type ScopedCapability = keyof typeof CAPABILITY_SCOPES;

/** Union of scopes needed for a set of capabilities (deduplicated, stable order). */
export function scopesFor(capabilities: readonly ScopedCapability[]): string[] {
  const out: string[] = [];
  for (const cap of capabilities) {
    for (const s of CAPABILITY_SCOPES[cap]) if (!out.includes(s)) out.push(s);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Random + PKCE
// ---------------------------------------------------------------------------

function getCrypto(): Crypto {
  if (typeof crypto === "undefined" || !crypto.subtle) throw new Error("Web Crypto (crypto.subtle) is required");
  return crypto;
}

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomUrlSafeString(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  getCrypto().getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

/** CSRF state value; store server-side and compare with timingSafeEqual on callback. */
export function generateState(): string {
  return randomUrlSafeString(32);
}

const VERIFIER_RE = /^[A-Za-z0-9\-._~]{43,128}$/;

export async function computeS256Challenge(verifier: string): Promise<string> {
  if (!VERIFIER_RE.test(verifier)) throw new Error("PKCE code_verifier must be 43-128 unreserved characters (RFC 7636 §4.1)");
  const digest = await getCrypto().subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64UrlEncode(new Uint8Array(digest));
}

export interface PkcePair {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
}

export async function createPkcePair(): Promise<PkcePair> {
  const codeVerifier = randomUrlSafeString(32); // 43 chars
  return { codeVerifier, codeChallenge: await computeS256Challenge(codeVerifier), codeChallengeMethod: "S256" };
}

/** Constant-time string comparison for state checks. */
export function timingSafeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  const len = Math.max(ea.length, eb.length);
  for (let i = 0; i < len; i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

// ---------------------------------------------------------------------------
// Authorization URL
// ---------------------------------------------------------------------------

export interface AuthorizationUrlInput {
  provider: OAuthProviderConfig;
  clientId: string;
  redirectUri: string;
  scopes: readonly string[];
  state: string;
  /** Required when provider.supportsPkce. */
  codeChallenge?: string;
  extraParams?: Record<string, string>;
}

export function buildAuthorizationUrl(input: AuthorizationUrlInput): string {
  if (!input.clientId) throw new Error("clientId is required");
  if (!input.state || input.state.length < 16) throw new Error("state must be a random value of at least 16 characters");
  const redirect = new URL(input.redirectUri);
  if (redirect.protocol !== "https:" && !(redirect.protocol === "http:" && (redirect.hostname === "localhost" || redirect.hostname === "127.0.0.1"))) {
    throw new Error("redirectUri must be https (http allowed only for localhost development)");
  }
  if (input.scopes.length === 0) throw new Error("At least one scope is required");
  const url = new URL(input.provider.authorizationEndpoint);
  const p = url.searchParams;
  p.set("client_id", input.clientId);
  p.set("redirect_uri", input.redirectUri);
  p.set("response_type", "code");
  p.set("scope", input.scopes.join(input.provider.scopeSeparator));
  p.set("state", input.state);
  if (input.provider.supportsPkce) {
    if (!input.codeChallenge) throw new Error(`${input.provider.id} supports PKCE; codeChallenge is required`);
    p.set("code_challenge", input.codeChallenge);
    p.set("code_challenge_method", "S256");
  }
  for (const [k, v] of Object.entries(input.provider.extraAuthParams ?? {})) p.set(k, v);
  for (const [k, v] of Object.entries(input.extraParams ?? {})) p.set(k, v);
  return url.toString();
}

// ---------------------------------------------------------------------------
// Token requests
// ---------------------------------------------------------------------------

export interface TokenHttpRequest {
  url: string;
  method: "POST" | "GET" | "DELETE";
  headers: Record<string, string>;
  body?: string;
}

const FORM = { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" };

/** HTTP Basic credentials (RFC 6749 §2.3.1). */
export function basicAuthHeader(clientId: string, clientSecret: string): string {
  const bytes = new TextEncoder().encode(`${clientId}:${clientSecret}`);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return `Basic ${btoa(binary)}`;
}

/** Form fields + headers for client authentication, per provider.clientAuth. */
function clientCredentials(provider: OAuthProviderConfig, clientId: string, clientSecret: string): { fields: Record<string, string>; headers: Record<string, string> } {
  if (provider.clientAuth === "basic") return { fields: {}, headers: { ...FORM, Authorization: basicAuthHeader(clientId, clientSecret) } };
  return { fields: { client_id: clientId, client_secret: clientSecret }, headers: { ...FORM } };
}

export function buildCodeExchangeRequest(input: {
  provider: OAuthProviderConfig;
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
  codeVerifier?: string;
}): TokenHttpRequest {
  const auth = clientCredentials(input.provider, input.clientId, input.clientSecret);
  const body = new URLSearchParams({
    ...auth.fields,
    code: input.code,
    redirect_uri: input.redirectUri,
    grant_type: "authorization_code",
  });
  if (input.provider.supportsPkce) {
    if (!input.codeVerifier) throw new Error("codeVerifier is required for PKCE providers");
    body.set("code_verifier", input.codeVerifier);
  }
  return { url: input.provider.tokenEndpoint, method: "POST", headers: auth.headers, body: body.toString() };
}

export function buildRefreshRequest(input: {
  provider: OAuthProviderConfig;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): TokenHttpRequest {
  if (input.provider.id === "instagram") {
    // Instagram long-lived tokens refresh via GET graph.instagram.com/refresh_access_token.
    const url = new URL("https://graph.instagram.com/refresh_access_token");
    url.searchParams.set("grant_type", "ig_refresh_token");
    url.searchParams.set("access_token", input.refreshToken);
    return { url: url.toString(), method: "GET", headers: { Accept: "application/json" } };
  }
  if (input.provider.id === "meta") {
    // Meta has no refresh tokens; re-exchange a still-valid long-lived token.
    const url = new URL(input.provider.tokenEndpoint);
    url.searchParams.set("grant_type", "fb_exchange_token");
    url.searchParams.set("client_id", input.clientId);
    url.searchParams.set("client_secret", input.clientSecret);
    url.searchParams.set("fb_exchange_token", input.refreshToken);
    return { url: url.toString(), method: "GET", headers: { Accept: "application/json" } };
  }
  const auth = clientCredentials(input.provider, input.clientId, input.clientSecret);
  const body = new URLSearchParams({
    ...auth.fields,
    refresh_token: input.refreshToken,
    grant_type: "refresh_token",
  });
  return { url: input.provider.tokenEndpoint, method: "POST", headers: auth.headers, body: body.toString() };
}

/** Instagram: exchange a short-lived token for a 60-day long-lived token. */
export function buildInstagramLongLivedExchangeRequest(input: { clientSecret: string; shortLivedToken: string }): TokenHttpRequest {
  const url = new URL("https://graph.instagram.com/access_token");
  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_secret", input.clientSecret);
  url.searchParams.set("access_token", input.shortLivedToken);
  return { url: url.toString(), method: "GET", headers: { Accept: "application/json" } };
}

/**
 * Revocation where the provider offers it. Instagram has no documented revoke
 * endpoint. LinkedIn and X authenticate the client, so they need its credentials.
 */
export function buildRevocationRequest(input: { provider: OAuthProviderConfig; token: string; clientId?: string; clientSecret?: string }): TokenHttpRequest | null {
  const endpoint = input.provider.revocationEndpoint;
  if (!endpoint) return null;
  if (input.provider.id === "meta") {
    const url = new URL(endpoint);
    url.searchParams.set("access_token", input.token);
    return { url: url.toString(), method: "DELETE", headers: { Accept: "application/json" } };
  }
  if (input.provider.id === "linkedin" || input.provider.id === "x") {
    if (!input.clientId || !input.clientSecret) return null;
    const auth = clientCredentials(input.provider, input.clientId, input.clientSecret);
    const body = new URLSearchParams({ ...auth.fields, token: input.token });
    if (input.provider.id === "x") body.set("token_type_hint", "access_token");
    return { url: endpoint, method: "POST", headers: auth.headers, body: body.toString() };
  }
  return {
    url: endpoint,
    method: "POST",
    headers: { ...FORM },
    body: new URLSearchParams({ token: input.token }).toString(),
  };
}

export interface ParsedToken {
  accessToken: string;
  refreshToken?: string;
  /** Epoch ms. */
  expiresAt?: number;
  scopes: string[];
  tokenType?: string;
  /** Instagram returns the IG user id on code exchange. */
  userId?: string;
}

export type TokenParseResult = { ok: true; token: ParsedToken } | { ok: false; error: string; description?: string };

export function parseTokenResponse(json: unknown, nowMs: number = Date.now()): TokenParseResult {
  if (!isRecord(json)) return { ok: false, error: "invalid_response" };
  if (json.error !== undefined) {
    const err = json.error;
    if (isRecord(err)) return { ok: false, error: asString(err.type) ?? "error", description: asString(err.message) };
    return { ok: false, error: asString(err) ?? "error", description: asString(json.error_description) };
  }
  // Instagram short-lived exchange may wrap in { data: [ {...} ] } in some versions.
  const src = Array.isArray(json.data) && isRecord(json.data[0]) ? json.data[0] : json;
  const accessToken = asString(src.access_token);
  if (!accessToken) return { ok: false, error: "missing_access_token" };
  const expiresIn = asNumber(src.expires_in);
  let scopes: string[] = [];
  const rawScope = src.scope ?? src.permissions;
  if (typeof rawScope === "string") scopes = rawScope.split(/[ ,]+/).filter(Boolean);
  else if (Array.isArray(rawScope)) scopes = rawScope.filter((s): s is string => typeof s === "string");
  const token: ParsedToken = { accessToken, scopes };
  const refresh = asString(src.refresh_token);
  if (refresh) token.refreshToken = refresh;
  if (expiresIn > 0) token.expiresAt = nowMs + expiresIn * 1000;
  const tokenType = asString(src.token_type);
  if (tokenType) token.tokenType = tokenType;
  const userId = asString(src.user_id);
  if (userId) token.userId = userId;
  return { ok: true, token };
}
