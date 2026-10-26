/**
 * Capability evaluation: turns platform config, provider access level, granted
 * scopes, token state, account type and sync freshness into one of the exact
 * capability states, with a plain-English reason and fix for business owners.
 */

import { CAPABILITY_SCOPES, type ScopedCapability } from "./oauth";
import { PROVIDERS, type CapabilityDefinition } from "./registry";
import type { CapabilityState, ProviderId } from "./types";

export const STALE_SYNC_MS = 48 * 60 * 60 * 1000;

const HOUR = 60 * 60 * 1000;
/**
 * When a read connection's last successful sync counts as delayed. ClimbOS defaults, not provider guarantees:
 * sources that report with a lag or refresh weekly get more room, and owner uploads never go stale on their own.
 */
const STALE_SYNC_BY_PROVIDER: Partial<Record<ProviderId, number | null>> = {
  search_console: 96 * HOUR,
  ga4: 72 * HOUR,
  website: 8 * 24 * HOUR,
  csv_revenue: null,
};

export function staleSyncMsFor(provider: ProviderId): number | null {
  return provider in STALE_SYNC_BY_PROVIDER ? STALE_SYNC_BY_PROVIDER[provider]! : STALE_SYNC_MS;
}

export type GoogleAdsAccessLevel = "test" | "explorer" | "basic" | "standard";
export type MetaAdsAccessTier = "limited" | "full";
export type ReviewStatus = "approved" | "pending" | "not_submitted" | "rejected";

export interface CapabilityContext {
  /** Platform env (values only checked for presence). */
  env: Record<string, string | undefined>;
  /** Whether the business has connected this provider (token / key stored). */
  connected: boolean;
  grantedScopes?: readonly string[];
  /** Access token expiry, epoch ms. */
  tokenExpiresAt?: number;
  /** True when we hold a refresh token (or Meta/IG long-lived token still refreshable). */
  canRefreshToken?: boolean;
  /** Google Ads developer token access level (falls back to env GOOGLE_ADS_ACCESS_LEVEL). */
  googleAdsAccessLevel?: GoogleAdsAccessLevel;
  /** True when the connected Google Ads customer is a test account. */
  googleAdsAccountIsTest?: boolean;
  /** Meta Marketing API tier (falls back to env META_ADS_ACCESS_TIER). */
  metaAdsAccessTier?: MetaAdsAccessTier;
  /** App review status per permission/scope name. Missing entries are treated as approved. */
  appReview?: Readonly<Record<string, ReviewStatus>>;
  /** Owner-facing name of the approval behind each reviewed scope (e.g. "Meta App Review"). */
  approvalLabels?: Readonly<Record<string, string>>;
  /** Provider-reported account type (e.g. Instagram "Business" | "Media_Creator" | "Personal"). */
  accountType?: string;
  /** Resend API key permission. */
  resendKeyPermission?: "full_access" | "sending_access";
  /** Stripe key prefix kind. */
  stripeKeyKind?: "restricted" | "secret" | "publishable";
  /** Last successful sync, epoch ms. */
  lastSyncAt?: number;
  /** Most recent sync attempt failed; the last successful snapshot may still be older. */
  lastSyncError?: string;
  /** Known provider outage. */
  providerStatus?: "operational" | "degraded" | "down";
  now?: number;
}

export interface CapabilityEvaluation {
  capability: string;
  label: string;
  kind: CapabilityDefinition["kind"];
  state: CapabilityState;
  /** Plain-English explanation for a non-technical business owner. */
  reason: string;
  /** What to do next. */
  fix: string;
}

function isPresent(v: string | undefined): boolean {
  return typeof v === "string" && v.trim() !== "";
}

function parseAccessLevel(v: string | undefined): GoogleAdsAccessLevel | undefined {
  const s = v?.trim().toLowerCase();
  return s === "test" || s === "explorer" || s === "basic" || s === "standard" ? s : undefined;
}

function parseMetaTier(v: string | undefined): MetaAdsAccessTier | undefined {
  const s = v?.trim().toLowerCase();
  return s === "limited" || s === "full" ? s : undefined;
}

const PROVIDER_NAMES: Record<ProviderId, string> = Object.fromEntries(
  Object.values(PROVIDERS).map((p) => [p.id, p.displayName]),
) as Record<ProviderId, string>;

function scopesForCapability(id: string): readonly string[] {
  return id in CAPABILITY_SCOPES ? CAPABILITY_SCOPES[id as ScopedCapability] : [];
}

type Verdict = { state: CapabilityState; reason: string; fix: string };

function evaluateOne(provider: ProviderId, cap: CapabilityDefinition, ctx: CapabilityContext): Verdict {
  const name = PROVIDER_NAMES[provider];
  const now = ctx.now ?? Date.now();

  if (ctx.providerStatus === "down") {
    return {
      state: "unavailable",
      reason: `${name} is having an outage right now, so ClimbOS can't reach it.`,
      fix: "Nothing to do on your side. ClimbOS will try again automatically once it's back.",
    };
  }

  const missingEnv = PROVIDERS[provider].requiredEnv.filter((k) => !isPresent(ctx.env[k]));
  if (missingEnv.length > 0) {
    return {
      state: "setup_needed",
      reason: `ClimbOS hasn't finished setting up its ${name} connection yet.`,
      fix: `Your ClimbOS administrator needs to add: ${missingEnv.join(", ")}.`,
    };
  }

  if (!ctx.connected) {
    return {
      state: "setup_needed",
      reason: `You haven't connected ${name} yet.`,
      fix: `Click "Connect ${name}" and sign in with the account that manages your business.`,
    };
  }

  // Account type.
  if (provider === "instagram" && ctx.accountType !== undefined) {
    const t = ctx.accountType.trim().toLowerCase();
    if (t !== "business" && t !== "media_creator" && t !== "creator") {
      return {
        state: "unsupported_account_type",
        reason: "This Instagram account is a personal account. Instagram only lets apps publish to Business or Creator accounts.",
        fix: "In the Instagram app, go to Settings → Account type and tools → Switch to professional account, then reconnect.",
      };
    }
  }

  // Provider access level / tier.
  if (provider === "google_ads") {
    const level = ctx.googleAdsAccessLevel ?? parseAccessLevel(ctx.env.GOOGLE_ADS_ACCESS_LEVEL);
    if (!level) {
      return {
        state: "setup_needed",
        reason: "ClimbOS doesn't know its Google Ads API access level yet.",
        fix: "Your ClimbOS administrator needs to set GOOGLE_ADS_ACCESS_LEVEL (test, explorer, basic or standard).",
      };
    }
    if (level === "test" && ctx.googleAdsAccountIsTest !== true) {
      return {
        state: "provider_review_pending",
        reason: "Google hasn't approved ClimbOS to work with real Google Ads accounts yet. Right now it can only use test accounts.",
        fix: "No action needed from you. ClimbOS is waiting on Google's review; until then, you can still make changes directly in Google Ads.",
      };
    }
  }
  if (provider === "meta_ads" && cap.kind === "write") {
    const tier = ctx.metaAdsAccessTier ?? parseMetaTier(ctx.env.META_ADS_ACCESS_TIER);
    if (tier !== "full") {
      const pending = ctx.appReview?.ads_management === "pending";
      return pending
        ? {
            state: "provider_review_pending",
            reason: "Meta is still reviewing ClimbOS's request to manage ad campaigns.",
            fix: "No action needed. Until Meta approves, you can make campaign changes in Meta Ads Manager.",
          }
        : {
            state: "approval_needed",
            reason: "ClimbOS doesn't have Meta's full approval to create or change ad campaigns yet.",
            fix: "Your ClimbOS administrator needs to request full Marketing API access and ads_management approval from Meta.",
          };
    }
  }

  const required = scopesForCapability(cap.id);

  // Token.
  if (ctx.tokenExpiresAt !== undefined && ctx.tokenExpiresAt <= now && ctx.canRefreshToken !== true) {
    return {
      state: "action_required",
      reason: `Your ${name} sign-in has expired, so ClimbOS can't reach your account.`,
      fix: `Click "Reconnect ${name}" and sign in again.`,
    };
  }

  // Scopes.
  if (required.length > 0) {
    const granted = new Set(ctx.grantedScopes ?? []);
    const missing = required.filter((s) => !granted.has(s));
    if (missing.length > 0) {
      return {
        state: "action_required",
        reason: `When you connected ${name}, the permission ClimbOS needs for "${cap.label}" wasn't granted.`,
        fix: `Click "Reconnect ${name}" and leave every requested permission ticked.`,
      };
    }
  }

  // API key kinds.
  if (provider === "resend_marketing" && cap.kind === "write" && ctx.resendKeyPermission === "sending_access") {
    return {
      state: "action_required",
      reason: "Your Resend API key can only send single emails; it can't manage contacts or broadcasts.",
      fix: "In Resend, create a key with Full access and paste it into ClimbOS.",
    };
  }
  if (provider === "stripe" && ctx.stripeKeyKind !== undefined && ctx.stripeKeyKind !== "restricted") {
    return {
      state: "action_required",
      reason: "For your safety ClimbOS only accepts a read-only Stripe restricted key, not a full secret key.",
      fix: "In Stripe → Developers → API keys, create a restricted key with Read access to Charges, Invoices and Refunds, then paste it here.",
    };
  }

  // A failed latest sync means the connection is currently unhealthy for reads,
  // even if an earlier successful snapshot is still within the normal freshness
  // window. Keep write capabilities independent of a read-only sync failure.
  if (cap.kind === "read" && ctx.lastSyncError) {
    return {
      state: "sync_delayed",
      reason: `${name} did not sync successfully, so the latest numbers may be incomplete or out of date.`,
      fix: "Try syncing again. If it keeps failing, reconnect the account and check its access.",
    };
  }

  // Sync freshness (reads only).
  const staleAfter = staleSyncMsFor(provider);
  if (cap.kind === "read" && ctx.lastSyncAt !== undefined && staleAfter !== null && now - ctx.lastSyncAt > staleAfter) {
    const hours = Math.floor((now - ctx.lastSyncAt) / 3_600_000);
    return {
      state: "sync_delayed",
      reason: `ClimbOS last got fresh ${name} data ${hours} hours ago, so recent numbers may be missing.`,
      fix: "ClimbOS keeps retrying. If this lasts another day, try reconnecting.",
    };
  }

  if (ctx.providerStatus === "degraded" && cap.kind === "read") {
    return {
      state: "sync_delayed",
      reason: `${name} is responding slowly, so data may arrive late.`,
      fix: "No action needed; ClimbOS will catch up automatically.",
    };
  }

  // Provider approvals ClimbOS still needs come last: problems with this business's own
  // account (expired sign-in, missing permission, failed sync) are more useful to show first.
  for (const scope of required) {
    const status = ctx.appReview?.[scope];
    const approval = ctx.approvalLabels?.[scope];
    if (status === "pending") {
      return {
        state: "provider_review_pending",
        reason: approval
          ? `${cap.label} needs ${approval}, which is still in progress for ClimbOS.`
          : `${name} is still reviewing ClimbOS's request for this feature.`,
        fix: "No action needed. We'll switch this on automatically once approved.",
      };
    }
    if (status === "not_submitted" || status === "rejected") {
      return {
        state: "approval_needed",
        reason: approval
          ? `${cap.label} needs ${approval}, which ClimbOS doesn't have yet${status === "rejected" ? " (the last request was declined)" : ""}.`
          : `${name} hasn't approved ClimbOS for this feature${status === "rejected" ? " (the last request was declined)" : ""}.`,
        fix: approval
          ? `No action needed from you. ClimbOS staff are completing ${approval}; until then, use drafts and export.`
          : `Your ClimbOS administrator needs to submit the "${scope}" permission for ${name} review.`,
      };
    }
  }

  return { state: "ready", reason: `${cap.label} is working.`, fix: "Nothing to do." };
}

/** Evaluate every capability for a provider. */
export function evaluateCapabilities(provider: ProviderId, ctx: CapabilityContext): CapabilityEvaluation[] {
  return PROVIDERS[provider].capabilities.map((cap) => ({
    capability: cap.id,
    label: cap.label,
    kind: cap.kind,
    ...evaluateOne(provider, cap, ctx),
  }));
}

/** Evaluate a single capability by id. */
export function evaluateCapability(provider: ProviderId, capabilityId: string, ctx: CapabilityContext): CapabilityEvaluation {
  const found = evaluateCapabilities(provider, ctx).find((c) => c.capability === capabilityId);
  if (!found) throw new Error(`Unknown capability ${capabilityId} for ${provider}`);
  return found;
}
