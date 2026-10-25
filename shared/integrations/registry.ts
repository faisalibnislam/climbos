/**
 * Provider registry: API versions, docs URLs and verification status.
 *
 * Every entry records when its endpoints/versions/scopes were last checked
 * against the provider's official docs. Anything we could not confirm on that
 * date is marked `verified: false` and should be re-checked before relying on it.
 */

import type { ProviderId } from "./types";

export const VERIFIED_AT = "2026-10-17";

/** Google Ads API: v26 released 2026-10-14 (release notes). */
export const GOOGLE_ADS_API_VERSION = "v26";
/** Meta Graph API + Marketing API: v26.0 introduced 2026-07-29 (changelog). */
export const GRAPH_API_VERSION = "v26.0";
/** Google Analytics Data API (runReport) and Admin API (accountSummaries). */
export const GA4_DATA_API_VERSION = "v1beta";
export const GA4_ADMIN_API_VERSION = "v1beta";
/** Search Console API is served under the legacy webmasters/v3 path. */
export const SEARCH_CONSOLE_API_PATH = "webmasters/v3";
/** Stripe "current version" per the versioning page on the verification date. */
export const STRIPE_API_VERSION = "2026-09-30.endive";
export const FIRECRAWL_API_VERSION = "v2";
/**
 * LinkedIn versioned REST API, sent as the LinkedIn-Version header. Each
 * monthly version lives about a year (202511 sunsets 2026-11-16 per the Posts
 * API page, checked 2026-10-18), so bump this at least yearly.
 */
export const LINKEDIN_API_VERSION = "202609";

export const GOOGLE_ADS_BASE = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`;
export const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
export const INSTAGRAM_GRAPH_BASE = `https://graph.instagram.com/${GRAPH_API_VERSION}`;
export const GA4_DATA_BASE = `https://analyticsdata.googleapis.com/${GA4_DATA_API_VERSION}`;
export const GA4_ADMIN_BASE = `https://analyticsadmin.googleapis.com/${GA4_ADMIN_API_VERSION}`;
export const SEARCH_CONSOLE_BASE = `https://www.googleapis.com/${SEARCH_CONSOLE_API_PATH}`;
export const RESEND_BASE = "https://api.resend.com";
export const STRIPE_BASE = "https://api.stripe.com/v1";
export const FIRECRAWL_SCRAPE_URL = `https://api.firecrawl.dev/${FIRECRAWL_API_VERSION}/scrape`;
export const LINKEDIN_REST_BASE = "https://api.linkedin.com/rest";
export const LINKEDIN_USERINFO_URL = "https://api.linkedin.com/v2/userinfo";
export const X_API_BASE = "https://api.x.com/2";

export interface VerifiedFact {
  fact: string;
  value: string;
  docsUrl: string;
  verified: boolean;
  verifiedAt: string;
  note?: string;
}

export type CapabilityKind = "read" | "write";

export interface CapabilityDefinition {
  id: string;
  kind: CapabilityKind;
  label: string;
  /** Plain-language description for a business owner. */
  description: string;
}

export interface ProviderMetadata {
  id: ProviderId;
  displayName: string;
  description: string;
  connection: "oauth_google" | "oauth_meta" | "oauth_instagram" | "oauth_linkedin" | "oauth_x" | "api_key" | "file_upload" | "none";
  apiVersion: string;
  verified: boolean;
  verifiedAt: string;
  capabilities: CapabilityDefinition[];
  /** Platform-level env vars that must be set by the ClimbOS operator. */
  requiredEnv: string[];
  /** Provider review/approval steps needed before production use. */
  requiredReviewSteps: string[];
  docs: VerifiedFact[];
}

const fact = (f: Omit<VerifiedFact, "verifiedAt"> & { verifiedAt?: string }): VerifiedFact => ({ ...f, verifiedAt: f.verifiedAt ?? VERIFIED_AT });

export const PROVIDERS: Record<ProviderId, ProviderMetadata> = {
  ga4: {
    id: "ga4",
    displayName: "Google Analytics 4",
    description: "Reads website visits, users, key events and purchase revenue by day and traffic source. Read-only.",
    connection: "oauth_google",
    apiVersion: GA4_DATA_API_VERSION,
    verified: true,
    verifiedAt: VERIFIED_AT,
    capabilities: [
      { id: "ga4.list_properties", kind: "read", label: "See your Analytics properties", description: "Lists the Google Analytics properties you can access so you can pick one." },
      { id: "ga4.read_reports", kind: "read", label: "Read traffic and sales reports", description: "Daily sessions, users, key events and revenue by source/medium." },
    ],
    requiredEnv: ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET"],
    requiredReviewSteps: ["Google OAuth consent screen verification for analytics.readonly (sensitive scope)"],
    docs: [
      fact({ fact: "runReport endpoint", value: "POST https://analyticsdata.googleapis.com/v1beta/{property}:runReport (max 250,000 rows/request)", docsUrl: "https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/runReport", verified: true }),
      fact({ fact: "accountSummaries.list", value: "GET https://analyticsadmin.googleapis.com/v1beta/accountSummaries (pageSize ≤ 200)", docsUrl: "https://developers.google.com/analytics/devguides/config/admin/v1/rest/v1beta/accountSummaries/list", verified: true }),
      fact({ fact: "OAuth scope", value: "https://www.googleapis.com/auth/analytics.readonly", docsUrl: "https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/runReport", verified: true }),
      fact({ fact: "Metric names keyEvents / purchaseRevenue / sessionSourceMedium", value: "keyEvents, purchaseRevenue, sessions, totalUsers; dimensions date, sessionSource, sessionMedium", docsUrl: "https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema", verified: false, note: "Schema page not re-fetched on verification date." }),
    ],
  },
  search_console: {
    id: "search_console",
    displayName: "Google Search Console",
    description: "Reads which Google searches and pages bring people to your site. Read-only.",
    connection: "oauth_google",
    apiVersion: SEARCH_CONSOLE_API_PATH,
    verified: true,
    verifiedAt: VERIFIED_AT,
    capabilities: [
      { id: "search_console.list_sites", kind: "read", label: "See your Search Console sites", description: "Lists the sites you have verified in Search Console." },
      { id: "search_console.read_performance", kind: "read", label: "Read search performance", description: "Clicks, impressions, CTR and position by date, query and page." },
      { id: "search_console.inspect_url", kind: "read", label: "Inspect one page's indexed status", description: "Owner-triggered read of Google's indexed URL state for one page inside the selected property." },
    ],
    requiredEnv: ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET"],
    requiredReviewSteps: ["Google OAuth consent screen verification for webmasters.readonly (sensitive scope)"],
    docs: [
      fact({ fact: "searchAnalytics.query", value: "POST https://www.googleapis.com/webmasters/v3/sites/{siteUrl}/searchAnalytics/query (rowLimit 1..25,000, startRow)", docsUrl: "https://developers.google.com/webmaster-tools/v1/searchanalytics/query", verified: true }),
      fact({ fact: "urlInspection.index.inspect", value: "POST https://searchconsole.googleapis.com/v1/urlInspection/index:inspect; inspect one URL inside the exact selected property", docsUrl: "https://developers.google.com/webmaster-tools/v1/urlInspection.index/inspect", verified: true }),
      fact({ fact: "sites.list", value: "GET https://www.googleapis.com/webmasters/v3/sites", docsUrl: "https://developers.google.com/webmaster-tools/v1/sites/list", verified: true }),
      fact({ fact: "OAuth scope", value: "https://www.googleapis.com/auth/webmasters.readonly", docsUrl: "https://developers.google.com/webmaster-tools/v1/searchanalytics/query", verified: true }),
    ],
  },
  google_ads: {
    id: "google_ads",
    displayName: "Google Ads",
    description: "Reads campaign spend and results, creates new Search campaigns switched off (paused), and turns campaigns on or off only when you approve.",
    connection: "oauth_google",
    apiVersion: GOOGLE_ADS_API_VERSION,
    verified: true,
    verifiedAt: VERIFIED_AT,
    capabilities: [
      { id: "google_ads.read_metrics", kind: "read", label: "Read campaign results", description: "Daily cost, clicks, impressions, conversions and conversion value per campaign." },
      { id: "google_ads.create_paused_campaign", kind: "write", label: "Create paused Search campaigns", description: "Creates a budget and a Search campaign that stays paused until you approve turning it on." },
      { id: "google_ads.set_campaign_status", kind: "write", label: "Turn campaigns on or off", description: "Switches a campaign between running and paused after your explicit approval." },
    ],
    requiredEnv: ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET", "GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_ACCESS_LEVEL"],
    requiredReviewSteps: [
      "Apply for Basic or Standard developer token access (Test access cannot touch real ad accounts)",
      "Google OAuth consent screen verification for the adwords scope",
    ],
    docs: [
      fact({ fact: "API version", value: "v26 (released 2026-10-14)", docsUrl: "https://developers.google.com/google-ads/api/docs/release-notes", verified: true }),
      fact({ fact: "search / searchStream", value: "POST https://googleads.googleapis.com/v26/customers/{id}/googleAds:search | :searchStream (10,000 rows/page, pageToken)", docsUrl: "https://developers.google.com/google-ads/api/rest/common/search", verified: true }),
      fact({ fact: "Campaign create fields", value: "advertisingChannelType SEARCH, status PAUSED, campaignBudget, manualCpc, networkSettings, startDateTime/endDateTime 'yyyy-MM-dd HH:mm:ss', containsEuPoliticalAdvertising (required)", docsUrl: "https://developers.google.com/google-ads/api/docs/campaigns/create-campaigns", verified: true }),
      fact({ fact: "Developer token access levels", value: "test (test accounts only), explorer, basic, standard", docsUrl: "https://developers.google.com/google-ads/api/docs/api-policy/access-levels", verified: true }),
      fact({ fact: "developer-token / login-customer-id headers", value: "developer-token, login-customer-id (manager id, digits only)", docsUrl: "https://developers.google.com/google-ads/api/rest/auth", verified: false, note: "Header page not re-fetched; values are long-standing." }),
    ],
  },
  meta_ads: {
    id: "meta_ads",
    displayName: "Meta Ads (Facebook & Instagram ads)",
    description: "Reads ad spend and results, creates campaigns switched off (paused), and turns them on or off only when you approve.",
    connection: "oauth_meta",
    apiVersion: GRAPH_API_VERSION,
    verified: true,
    verifiedAt: VERIFIED_AT,
    capabilities: [
      { id: "meta_ads.read_insights", kind: "read", label: "Read ad results", description: "Daily spend, impressions, clicks and actions." },
      { id: "meta_ads.create_paused_campaign", kind: "write", label: "Create paused campaigns", description: "Creates a campaign that stays paused until you approve it." },
      { id: "meta_ads.set_campaign_status", kind: "write", label: "Turn campaigns on or off", description: "Switches a campaign between active and paused after your approval." },
    ],
    requiredEnv: ["META_APP_ID", "META_APP_SECRET", "META_ADS_ACCESS_TIER"],
    requiredReviewSteps: ["Meta App Review: Advanced Access for ads_read and ads_management", "Business verification", "Marketing API Standard (full) access tier"],
    docs: [
      fact({ fact: "Graph/Marketing API version", value: "v26.0 (introduced 2026-07-29)", docsUrl: "https://developers.facebook.com/docs/graph-api/changelog", verified: true }),
      fact({ fact: "Create campaign", value: "POST /act_{id}/campaigns: special_ad_categories required; objective OUTCOME_*; status ACTIVE|PAUSED; spend_cap in currency subunits (min ≈ $100)", docsUrl: "https://developers.facebook.com/docs/marketing-api/reference/ad-account/campaigns/", verified: true }),
      fact({ fact: "Rate-limit headers", value: "X-App-Usage, X-Business-Use-Case-Usage (estimated_time_to_regain_access in minutes), X-Ad-Account-Usage", docsUrl: "https://developers.facebook.com/docs/graph-api/overview/rate-limiting", verified: true }),
      fact({ fact: "Insights fields", value: "Meta's official Marketing API collection shows ad-account and campaign Insights requests with spend, impressions, clicks, actions, date ranges, and daily time_increment=1; the app requires an access token and the access tier depends on whose ad accounts it manages.", docsUrl: "https://www.postman.com/meta/facebook-marketing-api/request/5wdl62t/attributionsetting", verified: true, verifiedAt: "2026-10-25", note: "Meta developer documentation returned HTTP 429 on this check; verified against Meta's official Postman API collection." }),
    ],
  },
  facebook_pages: {
    id: "facebook_pages",
    displayName: "Facebook Pages",
    description: "Publishes posts and photos to Pages you manage, and reads Page results where Meta allows it.",
    connection: "oauth_meta",
    apiVersion: GRAPH_API_VERSION,
    verified: true,
    verifiedAt: VERIFIED_AT,
    capabilities: [
      { id: "facebook_pages.list_pages", kind: "read", label: "See your Pages", description: "Lists the Facebook Pages you manage." },
      { id: "facebook_pages.read_posts", kind: "read", label: "Review recent Page posts", description: "Reads a small sample of recent Page post text for a content audit." },
      { id: "facebook_pages.publish_post", kind: "write", label: "Publish Page posts", description: "Publishes a text, link or photo post to your Page after your approval." },
      { id: "facebook_pages.read_insights", kind: "read", label: "Read Page results", description: "Reads Page-level metrics where Meta still provides them." },
    ],
    requiredEnv: ["META_APP_ID", "META_APP_SECRET"],
    requiredReviewSteps: ["Meta App Review: pages_manage_posts, pages_read_engagement, pages_show_list (Advanced Access)", "Business verification"],
    docs: [
      fact({ fact: "Publish post", value: "POST /{page-id}/feed (message, link, published, scheduled_publish_time) with a Page access token; POST /{page-id}/photos (url) → id, post_id", docsUrl: "https://developers.facebook.com/docs/pages-api/posts", verified: true }),
      fact({ fact: "Permissions", value: "pages_manage_posts, pages_read_engagement; task CREATE_CONTENT", docsUrl: "https://developers.facebook.com/docs/pages-api/posts", verified: true }),
      fact({ fact: "Page insights metrics", value: "Caller-specified metric names; Meta has deprecated many Page metrics", docsUrl: "https://developers.facebook.com/docs/graph-api/reference/insights", verified: false, note: "Metric availability changes often; treat as best-effort." }),
    ],
  },
  instagram: {
    id: "instagram",
    displayName: "Instagram (Business or Creator)",
    description: "Reviews a small sample of recent captions, publishes photos to an Instagram professional account, and checks Instagram's daily posting allowance.",
    connection: "oauth_instagram",
    apiVersion: GRAPH_API_VERSION,
    verified: true,
    verifiedAt: VERIFIED_AT,
    capabilities: [
      { id: "instagram.read_profile", kind: "read", label: "Check your Instagram account", description: "Confirms the account is a Business or Creator account." },
      { id: "instagram.read_posts", kind: "read", label: "Review recent Instagram posts", description: "Reads a small sample of recent post captions for a content audit." },
      { id: "instagram.read_insights", kind: "read", label: "Read Instagram post results", description: "Reads lifetime views, reach, likes, comments, saves and shares for sampled posts when Meta provides them." },
      { id: "instagram.publish_media", kind: "write", label: "Publish Instagram posts", description: "Publishes approved photo posts and verifies they are live." },
    ],
    requiredEnv: ["INSTAGRAM_APP_ID", "INSTAGRAM_APP_SECRET"],
    requiredReviewSteps: ["Meta App Review: Advanced Access for instagram_business_basic and instagram_business_content_publish", "Business verification"],
    docs: [
      fact({ fact: "Content publishing", value: "graph.instagram.com: POST /{ig-id}/media, GET /{container}?fields=status_code (EXPIRED|ERROR|FINISHED|IN_PROGRESS|PUBLISHED), POST /{ig-id}/media_publish, GET /{ig-id}/content_publishing_limit", docsUrl: "https://developers.facebook.com/docs/instagram-platform/content-publishing", verified: true, note: "Docs examples use v25.0; v26.0 is the current Graph version." }),
      fact({ fact: "Business Login", value: "https://www.instagram.com/oauth/authorize; token POST https://api.instagram.com/oauth/access_token; long-lived GET graph.instagram.com/access_token (ig_exchange_token); refresh GET graph.instagram.com/refresh_access_token. No PKCE documented.", docsUrl: "https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login", verified: true }),
      fact({ fact: "Caption/image limits", value: "caption ≤ 2,200 chars, ≤ 30 hashtags, ≤ 20 @mentions; JPEG only, ≤ 8 MB; alt_text ≤ 1,000 chars", docsUrl: "https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media", verified: true }),
      fact({ fact: "account_type", value: "Business | Media_Creator via GET /me?fields=user_id,username,account_type", docsUrl: "https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/get-started", verified: true }),
      fact({ fact: "Publishing limit", value: "Read live from content_publishing_limit (docs state both 100 and 50 per 24h; not hardcoded)", docsUrl: "https://developers.facebook.com/docs/instagram-platform/content-publishing", verified: true }),
    ],
  },
  linkedin: {
    id: "linkedin",
    displayName: "LinkedIn",
    description: "Publishes approved posts, with an optional image, to your personal LinkedIn profile.",
    connection: "oauth_linkedin",
    apiVersion: LINKEDIN_API_VERSION,
    verified: true,
    verifiedAt: VERIFIED_AT,
    capabilities: [
      { id: "linkedin.read_profile", kind: "read", label: "Check your LinkedIn profile", description: "Reads your name and member id so posts go to the right profile." },
      { id: "linkedin.publish_post", kind: "write", label: "Publish LinkedIn posts", description: "Publishes approved text and image posts to your profile." },
    ],
    requiredEnv: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"],
    requiredReviewSteps: ['Add the "Sign In with LinkedIn using OpenID Connect" and "Share on LinkedIn" products to the LinkedIn app'],
    docs: [
      fact({ fact: "Create post", value: "POST https://api.linkedin.com/rest/posts (author, commentary, visibility, distribution, lifecycleState PUBLISHED) → 201, id in x-restli-id; headers LinkedIn-Version YYYYMM + X-Restli-Protocol-Version 2.0.0", docsUrl: "https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api", verified: true, note: "Checked 2026-10-18." }),
      fact({ fact: "Read post", value: "GET /rest/posts/{encoded urn}; reading member posts needs r_member_social, which LinkedIn restricts to approved apps", docsUrl: "https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api", verified: true, note: "Without r_member_social, read-back is refused and publishes stay uncertain." }),
      fact({ fact: "Commentary format", value: "little text: escape \\ | { } @ [ ] ( ) < > # * _ ~ with a backslash; #word is a hashtag", docsUrl: "https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/little-text-format", verified: true }),
      fact({ fact: "Images", value: "POST /rest/images?action=initializeUpload {initializeUploadRequest:{owner}} → value.uploadUrl, value.image; PUT bytes; content.media {id, altText ≤ 4086}; JPG/GIF/PNG", docsUrl: "https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/images-api", verified: true }),
      fact({ fact: "OAuth + OIDC", value: "authorize https://www.linkedin.com/oauth/v2/authorization; token https://www.linkedin.com/oauth/v2/accessToken; GET https://api.linkedin.com/v2/userinfo → sub; scopes openid profile w_member_social", docsUrl: "https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2", verified: false, note: "Long-standing; not re-fetched. Refresh tokens are only issued to approved partners (access tokens last ~60 days)." }),
    ],
  },
  x: {
    id: "x",
    displayName: "X",
    description: "Publishes approved text posts to your X account. Images aren't attached yet.",
    connection: "oauth_x",
    apiVersion: "2",
    verified: true,
    verifiedAt: VERIFIED_AT,
    capabilities: [
      { id: "x.read_profile", kind: "read", label: "Check your X account", description: "Reads your @handle so posts go to the right account." },
      { id: "x.publish_post", kind: "write", label: "Publish X posts", description: "Publishes approved posts up to 280 characters." },
    ],
    requiredEnv: ["X_CLIENT_ID", "X_CLIENT_SECRET"],
    requiredReviewSteps: ["X app with OAuth 2.0 on, type Web App (confidential client), Read and write permissions", "An X API plan that allows posting and reading posts"],
    docs: [
      fact({ fact: "OAuth 2.0 PKCE", value: "authorize https://x.com/i/oauth2/authorize; token/refresh POST https://api.x.com/2/oauth2/token; revoke POST https://api.x.com/2/oauth2/revoke; confidential clients use HTTP Basic", docsUrl: "https://docs.x.com/resources/fundamentals/authentication/oauth-2-0/user-access-token", verified: true, note: "Checked 2026-10-18. Docs don't state token lifetime (~2h) or refresh-token rotation; both handled defensively." }),
      fact({ fact: "Create post", value: "POST https://api.x.com/2/tweets {text} → 201 {data:{id,text}}; scopes tweet.read tweet.write users.read", docsUrl: "https://docs.x.com/x-api/posts/create-post", verified: true, note: "Checked 2026-10-18." }),
      fact({ fact: "Character counting", value: "280 weighted; URLs = 23; CJK/emoji = 2; NFC first", docsUrl: "https://docs.x.com/resources/fundamentals/counting-characters", verified: true, note: "Checked 2026-10-18." }),
      fact({ fact: "Read post / user", value: "GET /2/tweets/{id}; GET /2/users/me; GET /2/users/{id}/tweets", docsUrl: "https://docs.x.com/x-api/posts/get-post-by-id", verified: false, note: "Not re-fetched; read access depends on the X API plan." }),
    ],
  },
  resend_marketing: {
    id: "resend_marketing",
    displayName: "Resend (your own account)",
    description: "Uses your own Resend account to keep consented contacts in sync and send marketing broadcasts you approve.",
    connection: "api_key",
    apiVersion: "unversioned",
    verified: true,
    verifiedAt: VERIFIED_AT,
    capabilities: [
      { id: "resend_marketing.list_segments", kind: "read", label: "See your segments", description: "Lists your Resend segments (formerly called audiences)." },
      { id: "resend_marketing.upsert_contacts", kind: "write", label: "Sync consented contacts", description: "Adds or updates only contacts who agreed to marketing email." },
      { id: "resend_marketing.send_broadcast", kind: "write", label: "Send email broadcasts", description: "Creates a draft broadcast and sends or schedules it after your approval." },
    ],
    requiredEnv: [],
    requiredReviewSteps: ["Verify a sending domain in your Resend account", "Use a Full access API key (sending-only keys cannot manage contacts or broadcasts)"],
    docs: [
      fact({ fact: "Segments (audiences renamed)", value: "GET /segments (limit ≤ 100, after/before) — 'Audiences are now called Segments'", docsUrl: "https://resend.com/docs/api-reference/segments/list-segments", verified: true }),
      fact({ fact: "Contacts", value: "POST /contacts; PATCH /contacts/{id|email}; POST /contacts/{id|email}/segments/{segment_id}", docsUrl: "https://resend.com/docs/api-reference/contacts/create-contact", verified: true }),
      fact({ fact: "Broadcasts", value: "POST /broadcasts (segment_id, from, subject, html, name, send=false); POST /broadcasts/{id}/send (scheduled_at); GET /broadcasts/{id} (status)", docsUrl: "https://resend.com/docs/api-reference/broadcasts/create-broadcast", verified: true }),
      fact({ fact: "Unsubscribe placeholder", value: "{{{RESEND_UNSUBSCRIBE_URL}}}", docsUrl: "https://resend.com/docs/dashboard/broadcasts/editor", verified: true }),
      fact({ fact: "Rate limit", value: "10 req/s per team; ratelimit-* and retry-after headers", docsUrl: "https://resend.com/docs/api-reference/rate-limit", verified: true }),
      fact({ fact: "Broadcast status values", value: "draft | scheduled | queued | sending | sent (assumed)", docsUrl: "https://resend.com/docs/api-reference/broadcasts/get-broadcast", verified: false, note: "Only 'draft' shown in docs example." }),
    ],
  },
  stripe: {
    id: "stripe",
    displayName: "Stripe",
    description: "Imports payment and refund history, and reads open invoice balances for owner review using a read-only restricted key.",
    connection: "api_key",
    apiVersion: STRIPE_API_VERSION,
    verified: true,
    verifiedAt: VERIFIED_AT,
    capabilities: [{ id: "stripe.import_revenue", kind: "read", label: "Read payments, refunds and open invoices", description: "Imports payment/refund history and reads open invoice balances without attempting payment or contacting customers." }],
    requiredEnv: [],
    requiredReviewSteps: ["Create a restricted key (rk_…) with Read access to Charges, Invoices and Refunds only"],
    docs: [
      fact({ fact: "API version", value: STRIPE_API_VERSION, docsUrl: "https://docs.stripe.com/api/versioning", verified: true }),
      fact({ fact: "List endpoints", value: "GET /v1/charges | /v1/invoices | /v1/refunds with created[gte], limit ≤ 100, starting_after", docsUrl: "https://docs.stripe.com/api/charges/list", verified: false, note: "List params are long-standing; not re-fetched." }),
    ],
  },
  csv_revenue: {
    id: "csv_revenue",
    displayName: "Revenue CSV upload",
    description: "Upload a spreadsheet of orders when your checkout isn't connected.",
    connection: "file_upload",
    apiVersion: "n/a",
    verified: true,
    verifiedAt: VERIFIED_AT,
    capabilities: [{ id: "csv_revenue.import", kind: "read", label: "Import revenue CSV", description: "Checks every row and imports valid orders." }],
    requiredEnv: [],
    requiredReviewSteps: [],
    docs: [fact({ fact: "CSV format", value: "RFC 4180", docsUrl: "https://www.rfc-editor.org/rfc/rfc4180", verified: true })],
  },
  website: {
    id: "website",
    displayName: "Website research",
    description: "Reads public pages of your site and competitors' sites, respecting robots.txt.",
    connection: "none",
    apiVersion: "n/a",
    verified: true,
    verifiedAt: VERIFIED_AT,
    capabilities: [{ id: "website.research_fetch", kind: "read", label: "Read public web pages", description: "Fetches public pages safely and extracts the useful text." }],
    requiredEnv: [],
    requiredReviewSteps: [],
    docs: [fact({ fact: "robots.txt", value: "RFC 9309 longest-match, Allow wins ties", docsUrl: "https://www.rfc-editor.org/rfc/rfc9309", verified: true })],
  },
  firecrawl: {
    id: "firecrawl",
    displayName: "Firecrawl",
    description: "Optional rendering service for pages that need JavaScript to load.",
    connection: "api_key",
    apiVersion: FIRECRAWL_API_VERSION,
    verified: true,
    verifiedAt: VERIFIED_AT,
    capabilities: [{ id: "firecrawl.scrape", kind: "read", label: "Render complex pages", description: "Uses Firecrawl to read pages that need a browser." }],
    requiredEnv: ["FIRECRAWL_API_KEY"],
    requiredReviewSteps: [],
    docs: [fact({ fact: "Scrape", value: "POST https://api.firecrawl.dev/v2/scrape (Bearer; url, formats ['markdown'], onlyMainContent, timeout 1000..300000, maxAge)", docsUrl: "https://docs.firecrawl.dev/api-reference/endpoint/scrape", verified: true })],
  },
};

export function getProvider(id: ProviderId): ProviderMetadata {
  return PROVIDERS[id];
}

export function findCapability(capabilityId: string): { provider: ProviderMetadata; capability: CapabilityDefinition } | undefined {
  for (const provider of Object.values(PROVIDERS)) {
    const capability = provider.capabilities.find((c) => c.id === capabilityId);
    if (capability) return { provider, capability };
  }
  return undefined;
}
