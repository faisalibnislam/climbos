/**
 * Step-by-step platform setup for ClimbOS staff: where to create each
 * developer app, the redirect URL, scopes, the review or approval tier, and
 * which env var names to set in the Convex dashboard. Names only: values are
 * never read back or shown.
 *
 * Checked against official docs on GUIDES_VERIFIED_AT. Re-check before relying
 * on review rules or prices; providers change them often.
 */

import type { PlatformApprovalKey } from "./platformApprovals";

export const GUIDES_VERIFIED_AT = "2026-10-26";

export interface GuideEnv {
  name: string;
  /** Where the value comes from in the provider's console. */
  from: string;
  optional?: boolean;
}

export interface GuideScope {
  scope: string;
  why: string;
  /** Review needed before businesses outside the app's own team can grant it. */
  review: string;
}

export interface SetupGuide {
  id: "meta" | "linkedin" | "x" | "google";
  title: string;
  covers: string;
  createAppUrl: string;
  /** Plain steps; "{redirectUrl}" is replaced with the live redirect URL. */
  steps: string[];
  env: GuideEnv[];
  scopes: GuideScope[];
  approvals: PlatformApprovalKey[];
  /** Known gaps or caveats, stated plainly. */
  notes: string[];
  docs: { label: string; url: string }[];
}

export const SETUP_GUIDES: SetupGuide[] = [
  {
    id: "meta",
    title: "Meta: Facebook Page + Instagram",
    covers: "Facebook Pages (publish, read) and Instagram professional accounts (publish, read). Both live in one Meta app.",
    createAppUrl: "https://developers.facebook.com/apps/creation/",
    steps: [
      "Create a business portfolio for ClimbOS in Meta Business Suite if you don't have one. Meta needs it to grant access to Pages you don't own.",
      "Open developers.facebook.com/apps/creation, choose app type Business, and add the use case \"Manage everything on your Page\".",
      "In the same app, add Instagram so the menu shows \"Instagram → API setup with Instagram login\".",
      "Facebook Login for Business → Settings → Client OAuth Settings → Valid OAuth Redirect URIs: add {redirectUrl}.",
      "Instagram → API setup with Instagram login → Set up Instagram business login → Business login settings: add {redirectUrl} under OAuth redirect URIs. The dashboard may add a trailing slash; remove it so the URLs match exactly.",
      "App settings → Basic: copy the App ID and App secret into META_APP_ID and META_APP_SECRET.",
      "Instagram → Business login settings: copy the Instagram app ID and Instagram app secret into INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET. They are shown separately from the Meta app ID, so copy both.",
      "While the app is in development, add yourself (and any test business owners) under App roles. They can connect and publish before review.",
      "Complete Business Verification, then submit App Review for Advanced Access to every permission listed below. Record the status under Approvals here.",
    ],
    env: [
      { name: "META_APP_ID", from: "App settings → Basic → App ID" },
      { name: "META_APP_SECRET", from: "App settings → Basic → App secret" },
      { name: "INSTAGRAM_APP_ID", from: "Instagram → API setup with Instagram login → Business login settings" },
      { name: "INSTAGRAM_APP_SECRET", from: "Instagram → API setup with Instagram login → Business login settings" },
    ],
    scopes: [
      { scope: "pages_show_list", why: "List the Pages the owner manages so they can pick one.", review: "App Review (Advanced Access)" },
      { scope: "business_management", why: "See Pages that belong to a business portfolio. The Page use case always includes it.", review: "App Review (Advanced Access)" },
      { scope: "pages_manage_posts", why: "Publish approved posts to the chosen Page.", review: "App Review (Advanced Access)" },
      { scope: "pages_read_engagement", why: "Read back posts to confirm they're live.", review: "App Review (Advanced Access)" },
      { scope: "read_insights", why: "Read Page results.", review: "App Review (Advanced Access)" },
      { scope: "instagram_business_basic", why: "Read the account's @handle and type.", review: "App Review (Advanced Access)" },
      { scope: "instagram_business_content_publish", why: "Publish approved photo posts.", review: "App Review (Advanced Access)" },
      { scope: "instagram_business_manage_insights", why: "Read post results.", review: "App Review (Advanced Access)" },
    ],
    approvals: ["meta_app_review"],
    notes: [
      "Advanced Access needs Business Verification first. Until approved, only people with a role on the app can connect.",
      "Instagram uses Instagram Login: the owner signs in to the Instagram professional account itself, so no linked Facebook Page is needed. That sign-in is the account choice; to switch, connect again.",
      "Page access tokens made from a long-lived user token don't expire, but a password change or role removal ends them. The owner then reconnects.",
      "Meta Ads uses the same META_APP_ID and META_APP_SECRET, plus META_ADS_ACCESS_TIER and Marketing API access.",
    ],
    docs: [
      { label: "Create an app", url: "https://developers.facebook.com/docs/development/create-an-app" },
      { label: "Pages API getting started", url: "https://developers.facebook.com/docs/pages-api/getting-started" },
      { label: "Long-lived tokens", url: "https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived" },
      { label: "Instagram business login", url: "https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login" },
      { label: "Permissions reference", url: "https://developers.facebook.com/docs/permissions" },
    ],
  },
  {
    id: "linkedin",
    title: "LinkedIn: profile and company Page",
    covers: "Posting to a member's own profile (one app) and to a company Page they administer (a second app).",
    createAppUrl: "https://www.linkedin.com/developers/apps/new",
    steps: [
      "Create app 1 (profile posting) at linkedin.com/developers/apps/new and link it to the ClimbOS company Page. A super admin of that Page must verify the app.",
      "App 1 → Products: add \"Sign In with LinkedIn using OpenID Connect\" and \"Share on LinkedIn\" (both self-serve).",
      "App 1 → Auth → Authorized redirect URLs: add {redirectUrl}. Copy the Client ID and Client Secret into LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET.",
      "Create app 2 (company Page posting) the same way. LinkedIn requires the Community Management API to be the only product on its app, so it can't share app 1.",
      "App 2 → Products: request \"Community Management API\" and finish the vetting form within 21 days. It needs a registered business, a business email, a website and a privacy policy.",
      "App 2 → Auth: add {redirectUrl}. Copy its Client ID and Client Secret into LINKEDIN_PAGES_CLIENT_ID and LINKEDIN_PAGES_CLIENT_SECRET.",
      "When LinkedIn grants the Development tier, set the approval below to \"Development tier\". For Standard, LinkedIn needs a screencast of the full flow. Set \"Standard tier\" once granted.",
    ],
    env: [
      { name: "LINKEDIN_CLIENT_ID", from: "App 1 → Auth → Client ID" },
      { name: "LINKEDIN_CLIENT_SECRET", from: "App 1 → Auth → Primary Client Secret" },
      { name: "LINKEDIN_PAGES_CLIENT_ID", from: "App 2 (Community Management) → Auth → Client ID", optional: true },
      { name: "LINKEDIN_PAGES_CLIENT_SECRET", from: "App 2 (Community Management) → Auth → Primary Client Secret", optional: true },
    ],
    scopes: [
      { scope: "openid profile", why: "Know which member signed in (app 1).", review: "Self-serve product" },
      { scope: "w_member_social", why: "Post to the member's own profile (app 1).", review: "Self-serve product (Share on LinkedIn)" },
      { scope: "rw_organization_admin", why: "List the Pages the member administers (app 2).", review: "Community Management API vetting" },
      { scope: "w_organization_social", why: "Post as the chosen company Page (app 2).", review: "Community Management API vetting" },
    ],
    approvals: ["linkedin_community_management"],
    notes: [
      "The Development tier allows 500 calls per app and 100 per member a day, with no batch calls. ClimbOS reads Page names one at a time for this reason.",
      "Access tokens last 60 days. LinkedIn issues refresh tokens only to some partners, so owners reconnect when access expires.",
      "LinkedIn documents no token-revoke endpoint. Disconnect deletes the stored token and tells the owner where to remove ClimbOS in LinkedIn settings.",
    ],
    docs: [
      { label: "Authorization code flow", url: "https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow" },
      { label: "Share on LinkedIn", url: "https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin" },
      { label: "Community Management review", url: "https://learn.microsoft.com/en-us/linkedin/marketing/community-management-app-review" },
      { label: "Access tiers", url: "https://learn.microsoft.com/en-us/linkedin/marketing/increasing-access" },
      { label: "Only product on the app", url: "https://learn.microsoft.com/en-us/linkedin/shared/linkedin-api-partner-support-guide" },
      { label: "Organization access by role", url: "https://learn.microsoft.com/en-us/linkedin/marketing/community-management/organizations/organization-access-control-by-role" },
    ],
  },
  {
    id: "x",
    title: "X",
    covers: "Posting to the X account the owner signs in with (personal or business).",
    createAppUrl: "https://console.x.com",
    steps: [
      "Open the Developer Console at console.x.com and create a project and app.",
      "User authentication settings: turn on OAuth 2.0, type \"Web App, Automated App or Bot\" (a confidential client), permissions \"Read and write\".",
      "Callback URI: add {redirectUrl} exactly, with no trailing slash.",
      "Copy the OAuth 2.0 Client ID and Client Secret into X_CLIENT_ID and X_CLIENT_SECRET. X shows the secret once.",
      "Billing: X API access is pay-per-use from prepaid credits. Add credits (and auto-recharge if you want) so posting doesn't stop, then set the approval below to \"Posting plan active\".",
    ],
    env: [
      { name: "X_CLIENT_ID", from: "App → Keys and tokens → OAuth 2.0 Client ID" },
      { name: "X_CLIENT_SECRET", from: "App → Keys and tokens → OAuth 2.0 Client Secret" },
    ],
    scopes: [
      { scope: "users.read tweet.read", why: "Read the signed-in @handle and confirm posts.", review: "None (paid per read)" },
      { scope: "tweet.write", why: "Publish approved posts.", review: "Prepaid API credits" },
      { scope: "offline.access", why: "Refresh tokens (access tokens last 2 hours).", review: "None" },
    ],
    approvals: ["x_posting_access"],
    notes: [
      "Prices on the check date: a post costs $0.015, a post with a link costs $0.20, a post read $0.005, a user read $0.010. Check docs.x.com pricing before relying on these.",
      "X signs in as exactly one account. To change it, the owner disconnects and connects again while signed in to the other account on x.com.",
      "X expects the authorization code to be exchanged within 30 seconds. ClimbOS does this immediately in the callback.",
    ],
    docs: [
      { label: "Developer apps", url: "https://docs.x.com/fundamentals/developer-apps" },
      { label: "OAuth 2.0 authorization code", url: "https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code" },
      { label: "Pricing", url: "https://docs.x.com/x-api/getting-started/pricing" },
    ],
  },
  {
    id: "google",
    title: "Google: Analytics, Search Console, Business Profile, Ads",
    covers: "All four Google connections share one OAuth client; each asks only for its own permission.",
    createAppUrl: "https://console.cloud.google.com/auth/clients",
    steps: [
      "Create (or pick) a Google Cloud project for ClimbOS.",
      "APIs & Services → Library: enable Google Analytics Data API, Google Analytics Admin API, Google Search Console API, My Business Account Management API, My Business Business Information API and Google Ads API.",
      "Google Auth Platform → Branding: set the app name, support email, homepage and privacy policy (on a domain verified in Search Console).",
      "Google Auth Platform → Clients → Create client → Web application. Authorized redirect URIs: add {redirectUrl}. Copy the Client ID and Client secret into GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET.",
      "Google Auth Platform → Data access: add the scopes below. Submit verification (brand first, then the scopes, with a demo video) and record the status under Approvals.",
      "Business Profile: submit the API access request (support.google.com/business/contact/api_default) with the Cloud project number. Quota stays at 0 until Google approves.",
      "Google Ads: in Cloud Console → Google Ads API → Overview, use \"Upgrade access level\" to get Explorer (production accounts), then Basic or Standard. Set GOOGLE_ADS_ACCESS_LEVEL to match.",
    ],
    env: [
      { name: "GOOGLE_OAUTH_CLIENT_ID", from: "Google Auth Platform → Clients → your Web client" },
      { name: "GOOGLE_OAUTH_CLIENT_SECRET", from: "Google Auth Platform → Clients → your Web client (shown once)" },
      { name: "GOOGLE_ADS_ACCESS_LEVEL", from: "Google Ads API → Overview → access level (test, explorer, basic or standard)" },
      { name: "GOOGLE_ADS_DEVELOPER_TOKEN", from: "Legacy: Google retired developer tokens on 9 Sep 2026, but this ClimbOS version still checks the name exists" },
    ],
    scopes: [
      { scope: "analytics.readonly", why: "Read Analytics traffic and sales reports.", review: "OAuth verification" },
      { scope: "webmasters.readonly", why: "Read Search Console performance.", review: "OAuth verification" },
      { scope: "business.manage", why: "List Business Profile locations so the owner picks theirs.", review: "OAuth verification + Business Profile API access request" },
      { scope: "adwords", why: "Read results and create paused campaigns.", review: "OAuth verification + Google Ads API access level" },
    ],
    approvals: ["google_oauth_verification", "google_business_profile_api"],
    notes: [
      "While the project is in Testing, refresh tokens expire after 7 days and only listed test users can connect. Publish the app to Production to avoid weekly reconnects.",
      "Google's docs don't list which of these scopes count as sensitive. Check the Data access page in your project.",
      "Google Ads: developer tokens were retired on 9 Sep 2026 and access now belongs to the Cloud project. ClimbOS still requires GOOGLE_ADS_DEVELOPER_TOKEN for Ads account selection; removing that requirement is a separate change.",
    ],
    docs: [
      { label: "OAuth for web server apps", url: "https://developers.google.com/identity/protocols/oauth2/web-server" },
      { label: "Unverified apps", url: "https://support.google.com/cloud/answer/7454865" },
      { label: "Business Profile prerequisites", url: "https://developers.google.com/my-business/content/prereqs" },
      { label: "Google Ads access levels", url: "https://developers.google.com/google-ads/api/docs/api-policy/access-levels" },
      { label: "Google Ads developer token change", url: "https://developers.google.com/google-ads/api/docs/get-started/dev-token" },
    ],
  },
];

export function redirectUrlFor(siteUrl: string | undefined): string {
  return `${(siteUrl ?? "http://localhost:3000").replace(/\/$/, "")}/api/oauth/callback`;
}
