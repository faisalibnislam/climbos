/**
 * Provider approvals ClimbOS (the platform) needs before a capability works for
 * every business: Meta App Review, LinkedIn Community Management API, an X API
 * plan that allows posting, Google OAuth verification and Business Profile API
 * access. Staff record each status in the Console; nothing here is a secret.
 *
 * Statuses feed capability evaluation as per-scope review states, so a
 * connected account shows "Connected, but posting needs Meta App Review"
 * instead of a misleading "Ready".
 */

import type { ReviewStatus } from "./capabilities";
import type { ProviderId } from "./types";

export type PlatformApprovalKey =
  | "meta_app_review"
  | "linkedin_community_management"
  | "x_posting_access"
  | "google_oauth_verification"
  | "google_business_profile_api";

/** not_submitted: not started. pending: submitted, or in a provider's testing tier. approved: granted. */
export type PlatformApprovalStatus = Extract<ReviewStatus, "not_submitted" | "pending" | "approved">;

export const APPROVAL_STATUSES: readonly PlatformApprovalStatus[] = ["not_submitted", "pending", "approved"];

export interface PlatformApprovalDefinition {
  key: PlatformApprovalKey;
  /** What the owner and staff read, e.g. "Meta App Review". */
  label: string;
  /** Plain words for each status in the Console. */
  statusLabels: Record<PlatformApprovalStatus, string>;
  /** What "pending" still allows, so status text stays honest. */
  pendingNote: string;
  /** OAuth scopes / permissions this approval unlocks, per provider. */
  scopes: Partial<Record<ProviderId, readonly string[]>>;
}

export const PLATFORM_APPROVALS: Record<PlatformApprovalKey, PlatformApprovalDefinition> = {
  meta_app_review: {
    key: "meta_app_review",
    label: "Meta App Review",
    statusLabels: { not_submitted: "Not submitted", pending: "Submitted, in review", approved: "Approved (Advanced Access)" },
    pendingNote: "Until Meta approves, only people with a role on the ClimbOS Meta app can connect and publish.",
    scopes: {
      facebook_pages: ["pages_show_list", "business_management", "pages_manage_posts", "pages_read_engagement", "read_insights"],
      instagram: ["instagram_business_basic", "instagram_business_content_publish", "instagram_business_manage_insights"],
    },
  },
  linkedin_community_management: {
    key: "linkedin_community_management",
    label: "LinkedIn Community Management API access",
    statusLabels: { not_submitted: "Not requested", pending: "Development tier (testing)", approved: "Standard tier" },
    pendingNote: "In the development tier only the app's own admins can post to Pages, with low daily limits.",
    scopes: { linkedin: ["rw_organization_admin", "w_organization_social"] },
  },
  x_posting_access: {
    key: "x_posting_access",
    label: "X API posting access (prepaid credits)",
    statusLabels: { not_submitted: "No posting plan", pending: "Plan requested", approved: "Posting plan active" },
    pendingNote: "Posts are refused until the X developer account is on a plan with write access.",
    scopes: { x: ["tweet.write"] },
  },
  google_oauth_verification: {
    key: "google_oauth_verification",
    label: "Google OAuth verification",
    statusLabels: { not_submitted: "Not submitted", pending: "Submitted, in review", approved: "Verified" },
    pendingNote: "Until Google verifies the app, people see an 'unverified app' warning and only listed test users can connect.",
    scopes: {
      ga4: ["https://www.googleapis.com/auth/analytics.readonly"],
      search_console: ["https://www.googleapis.com/auth/webmasters.readonly"],
      google_ads: ["https://www.googleapis.com/auth/adwords"],
      google_business_profile: ["https://www.googleapis.com/auth/business.manage"],
    },
  },
  google_business_profile_api: {
    key: "google_business_profile_api",
    label: "Google Business Profile API access",
    statusLabels: { not_submitted: "Not requested", pending: "Requested", approved: "Approved (quota granted)" },
    pendingNote: "Google keeps the API quota at 0 until the access request is approved, so locations can't be listed.",
    scopes: { google_business_profile: ["https://www.googleapis.com/auth/business.manage"] },
  },
};

export type PlatformApprovals = Partial<Record<PlatformApprovalKey, PlatformApprovalStatus>>;

/** Parse the stored JSON defensively: unknown keys and values are dropped (= not submitted). */
export function parsePlatformApprovals(raw: unknown): PlatformApprovals {
  const out: PlatformApprovals = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (k in PLATFORM_APPROVALS && typeof v === "string" && (APPROVAL_STATUSES as readonly string[]).includes(v)) {
      out[k as PlatformApprovalKey] = v as PlatformApprovalStatus;
    }
  }
  return out;
}

export function approvalStatus(approvals: PlatformApprovals, key: PlatformApprovalKey): PlatformApprovalStatus {
  return approvals[key] ?? "not_submitted";
}

/**
 * Per-scope review status for one provider, plus the approval name per scope
 * for owner-facing text. When two approvals cover a scope, the least advanced wins.
 */
export function reviewStateFor(provider: ProviderId, approvals: PlatformApprovals): { appReview: Record<string, ReviewStatus>; approvalLabels: Record<string, string> } {
  const rank: Record<PlatformApprovalStatus, number> = { not_submitted: 0, pending: 1, approved: 2 };
  const appReview: Record<string, ReviewStatus> = {};
  const approvalLabels: Record<string, string> = {};
  for (const def of Object.values(PLATFORM_APPROVALS)) {
    const status = approvalStatus(approvals, def.key);
    for (const scope of def.scopes[provider] ?? []) {
      const current = appReview[scope] as PlatformApprovalStatus | undefined;
      if (current === undefined || rank[status] < rank[current]) {
        appReview[scope] = status;
        approvalLabels[scope] = def.label;
      }
    }
  }
  return { appReview, approvalLabels };
}

/** LinkedIn Page scopes are only requested once the Community Management product is on the app (testing or approved). */
export function linkedInOrganizationsEnabled(approvals: PlatformApprovals): boolean {
  return approvalStatus(approvals, "linkedin_community_management") !== "not_submitted";
}
