/**
 * ClimbOS integration adapter layer.
 *
 * Core helpers are exported flat; provider adapters are exported as namespaces
 * (e.g. `googleAds.setCampaignStatus`) so identically named functions such as
 * `setCampaignStatus` / `reconcileCampaignByName` never collide.
 */

export * from "./types";
export * from "./ratelimit";
export * from "./capabilities";
export * from "./registry";
export * from "./currency";
export {
  buildAuthorizationUrl,
  buildCodeExchangeRequest,
  buildInstagramLongLivedExchangeRequest,
  buildRefreshRequest,
  buildRevocationRequest,
  CAPABILITY_SCOPES,
  computeS256Challenge,
  createPkcePair,
  generateState,
  OAUTH_PROVIDERS,
  parseTokenResponse,
  scopesFor,
  timingSafeEqual,
  type AuthorizationUrlInput,
  type OAuthProviderConfig,
  type ParsedToken,
  type PkcePair,
  type ScopedCapability,
  type TokenHttpRequest,
  type TokenParseResult,
} from "./oauth";
export { collectPages, contentFingerprint, HARD_MAX_PAGES, requestJson, type HttpOutcome, type PageFetchResult } from "./http";
export { computeAppSecretProof } from "./metaGraph";

export * as ga4 from "./ga4";
export * as searchConsole from "./searchConsole";
export * as googleAds from "./googleAds";
export * as metaAds from "./metaAds";
export * as facebookPages from "./facebookPages";
export * as instagram from "./instagram";
export * as resendMarketing from "./resendMarketing";
export * as stripeRevenue from "./stripeRevenue";
export * as csvRevenue from "./csvRevenue";
export * as website from "./website";
export * as drafts from "./drafts";
