/**
 * Shared types for the ClimbOS integration adapter layer.
 *
 * Everything here is dependency-free and runs in Node and the Convex V8
 * runtime (global fetch / URL / crypto.subtle / TextEncoder only).
 */

import type { RevenueEvent } from "../attribution/types";

/** Minimal fetch signature so tests (and Convex) can inject an implementation. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type ProviderId =
  | "ga4"
  | "search_console"
  | "google_ads"
  | "google_business_profile"
  | "meta_ads"
  | "facebook_pages"
  | "instagram"
  | "linkedin"
  | "x"
  | "resend_marketing"
  | "stripe"
  | "csv_revenue"
  | "website"
  | "firecrawl";

/** Exact capability state strings shown in the product. */
export type CapabilityState =
  | "ready"
  /** Works for ClimbOS testers while a platform approval is unfinished; other businesses see approval_needed. */
  | "testing_access"
  | "approval_needed"
  | "provider_review_pending"
  | "unsupported_account_type"
  | "sync_delayed"
  | "action_required"
  | "setup_needed"
  | "unavailable";

export const CAPABILITY_STATES: readonly CapabilityState[] = [
  "ready",
  "testing_access",
  "approval_needed",
  "provider_review_pending",
  "unsupported_account_type",
  "sync_delayed",
  "action_required",
  "setup_needed",
  "unavailable",
] as const;

/**
 * Result of every write. "verified" is only returned after the provider
 * confirmed the change on a separate read-back.
 *
 * "uncertain" means the request may or may not have been applied (timeout,
 * network error, 5xx). It is never retryable: the caller must run the adapter's
 * reconcile/lookup function before deciding whether to try again.
 */
export type WriteStatus = "verified" | "failed" | "uncertain";

export interface WriteResult<TData = undefined> {
  status: WriteStatus;
  externalId?: string;
  providerMessage?: string;
  /** True only for definite non-application (e.g. 429 rate limit) where a later retry is safe. */
  retryable: boolean;
  /** Suggested wait before a retry, when the provider told us. */
  retryAfterMs?: number;
  data?: TData;
}

/** Result of a reconcile lookup after an "uncertain" write. */
export type ReconcileResult<TData = undefined> =
  | { outcome: "found"; externalId: string; data?: TData }
  | { outcome: "not_found" }
  | { outcome: "unknown"; providerMessage: string };

/** Result of a read. */
export type ReadResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      status?: number;
      providerMessage: string;
      retryable: boolean;
      retryAfterMs?: number;
    };

/** Normalized revenue event (compatible with attribution's RevenueEvent minus internal id). */
export type ImportedRevenueEvent = Omit<RevenueEvent, "id">;

export interface PaginationResult<T> {
  items: T[];
  pages: number;
  /** True when maxPages stopped us before the provider ran out of pages. */
  truncated: boolean;
  nextCursor?: string;
}

/**
 * A business owner's explicit approval for one exact action. Adapters refuse
 * to act unless the approval matches the requested action field-for-field.
 */
export interface ApprovedAction {
  kind: string;
  /** Provider id of the object being changed (campaign id, page id, …). */
  targetId: string;
  /** Exact target value (e.g. "ENABLED"). */
  value: string;
  approvedBy: string;
  /** Epoch ms. */
  approvedAt: number;
}

/** Returns a refusal message unless `approval` authorizes exactly this action and is fresh. */
export function approvalError(
  approval: ApprovedAction | undefined,
  expected: { kind: string; targetId: string; value: string },
  nowMs: number = Date.now(),
  maxAgeMs: number = 24 * 60 * 60 * 1000,
): string | undefined {
  if (!approval) return `Refusing ${expected.kind}: no approval provided`;
  if (approval.kind !== expected.kind || approval.targetId !== expected.targetId || approval.value !== expected.value) {
    return `Refusing ${expected.kind}: approval is for ${approval.kind} ${approval.targetId}=${approval.value}, not ${expected.targetId}=${expected.value}`;
  }
  if (!approval.approvedBy) return `Refusing ${expected.kind}: approval has no approver`;
  if (nowMs - approval.approvedAt > maxAgeMs || approval.approvedAt > nowMs + 60_000) {
    return `Refusing ${expected.kind}: approval is expired or from the future`;
  }
  return undefined;
}

export interface AdapterOptions {
  fetchImpl?: FetchLike;
  /** Per-request timeout. Defaults to 20s. */
  timeoutMs?: number;
}
