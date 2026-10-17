/**
 * Minimal HTTP + pagination helpers shared by every adapter.
 */

import { parseRateLimit, RetryableReadError, type RateLimitInfo } from "./ratelimit";
import type { FetchLike, PaginationResult, ReadResult, WriteResult } from "./types";

export const DEFAULT_TIMEOUT_MS = 20_000;

export type HttpOutcome =
  | { kind: "ok"; status: number; data: unknown; headers: Headers; rate: RateLimitInfo }
  | { kind: "http_error"; status: number; data: unknown; headers: Headers; rate: RateLimitInfo; message: string }
  | { kind: "network_error"; timedOut: boolean; message: string };

export interface HttpRequest {
  url: string;
  method?: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
  headers?: Record<string, string>;
  /** Object → JSON body; string → sent as-is (set Content-Type yourself); URLSearchParams → form body. */
  body?: unknown;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}

export function resolveFetch(fetchImpl?: FetchLike): FetchLike {
  if (fetchImpl) return fetchImpl;
  if (typeof fetch !== "function") throw new Error("No global fetch available; pass fetchImpl");
  return (input, init) => fetch(input, init);
}

function isAbortError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const name = (err as { name?: unknown }).name;
  return name === "AbortError" || name === "TimeoutError";
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/** Extract a human-readable provider message from common error envelopes. */
export function extractProviderMessage(data: unknown, fallback: string): string {
  if (typeof data === "string" && data.trim()) return data.slice(0, 500);
  if (typeof data !== "object" || data === null) return fallback;
  const rec = data as Record<string, unknown>;
  const err = rec.error;
  if (typeof err === "object" && err !== null) {
    const e = err as Record<string, unknown>;
    // Meta: error.error_user_msg / error.message ; Google: error.message ; Stripe: error.message
    const msg = e.error_user_msg ?? e.message;
    if (typeof msg === "string") return msg.slice(0, 500);
  }
  if (typeof err === "string") return err.slice(0, 500);
  if (typeof rec.message === "string") return rec.message.slice(0, 500);
  return fallback;
}

export async function requestJson(req: HttpRequest): Promise<HttpOutcome> {
  const doFetch = resolveFetch(req.fetchImpl);
  const controller = typeof AbortController === "function" ? new AbortController() : undefined;
  const timeoutMs = req.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let timedOut = false;
  const timer = controller
    ? setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs)
    : undefined;

  const headers: Record<string, string> = { Accept: "application/json", ...(req.headers ?? {}) };
  let body: string | undefined;
  if (req.body instanceof URLSearchParams) {
    body = req.body.toString();
    headers["Content-Type"] ??= "application/x-www-form-urlencoded";
  } else if (typeof req.body === "string") {
    body = req.body;
  } else if (req.body !== undefined) {
    body = JSON.stringify(req.body);
    headers["Content-Type"] ??= "application/json";
  }

  let response: Response;
  try {
    response = await doFetch(req.url, {
      method: req.method ?? "GET",
      headers,
      body,
      signal: controller?.signal,
      redirect: "follow",
    });
  } catch (err) {
    if (timer) clearTimeout(timer);
    return { kind: "network_error", timedOut: timedOut || isAbortError(err), message: errorMessage(err) };
  }

  let text = "";
  try {
    text = await response.text();
  } catch (err) {
    if (timer) clearTimeout(timer);
    return { kind: "network_error", timedOut: timedOut || isAbortError(err), message: errorMessage(err) };
  }
  if (timer) clearTimeout(timer);

  let data: unknown = text;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = text;
    }
  } else {
    data = undefined;
  }
  const rate = parseRateLimit(response.headers, data);
  if (response.ok) return { kind: "ok", status: response.status, data, headers: response.headers, rate };
  return {
    kind: "http_error",
    status: response.status,
    data,
    headers: response.headers,
    rate,
    message: extractProviderMessage(data, `HTTP ${response.status}`),
  };
}

/** True when the provider may have applied the write anyway. */
export function isAmbiguousWriteOutcome(outcome: HttpOutcome): boolean {
  if (outcome.kind === "network_error") return true;
  if (outcome.kind === "http_error") return outcome.status >= 500 || outcome.status === 408;
  return false;
}

/**
 * Map a non-ok write outcome to a WriteResult. Timeouts / 5xx are "uncertain"
 * and NOT retryable (reconcile first). 429 is a definite rejection → retryable.
 */
export function writeFailure<T = undefined>(outcome: Exclude<HttpOutcome, { kind: "ok" }>): WriteResult<T> {
  if (isAmbiguousWriteOutcome(outcome)) {
    return {
      status: "uncertain",
      retryable: false,
      providerMessage:
        outcome.kind === "network_error"
          ? `${outcome.timedOut ? "Timed out" : "Network error"} before the provider confirmed: ${outcome.message}. Run reconcile before retrying.`
          : `Provider returned ${outcome.status}: ${outcome.message}. The change may have been applied; run reconcile before retrying.`,
    };
  }
  const http = outcome as Extract<HttpOutcome, { kind: "http_error" }>;
  const retryable = http.status === 429;
  const result: WriteResult<T> = { status: "failed", retryable, providerMessage: http.message };
  if (retryable && http.rate.retryAfterMs !== undefined) result.retryAfterMs = http.rate.retryAfterMs;
  return result;
}

export function readFailure<T>(outcome: Exclude<HttpOutcome, { kind: "ok" }>): ReadResult<T> {
  if (outcome.kind === "network_error") {
    return { ok: false, providerMessage: outcome.message, retryable: true };
  }
  const retryable = outcome.status === 429 || outcome.status >= 500;
  const out: ReadResult<T> = { ok: false, status: outcome.status, providerMessage: outcome.message, retryable };
  if (outcome.rate.retryAfterMs !== undefined) out.retryAfterMs = outcome.rate.retryAfterMs;
  return out;
}

/** Throws RetryableReadError for retryable read failures so withBackoff can retry. */
export function throwIfRetryable(result: ReadResult<unknown>): void {
  if (!result.ok && result.retryable) throw new RetryableReadError(result.providerMessage, result.retryAfterMs);
}

export const HARD_MAX_PAGES = 100;

export interface PageFetchResult<T> {
  items: T[];
  nextCursor?: string;
}

/**
 * Collect pages until the provider runs out or `maxPages` (capped at
 * HARD_MAX_PAGES) is reached. A failing page stops collection and is returned.
 */
export async function collectPages<T>(
  fetchPage: (cursor: string | undefined, pageIndex: number) => Promise<ReadResult<PageFetchResult<T>>>,
  options: { maxPages?: number; startCursor?: string } = {},
): Promise<ReadResult<PaginationResult<T>>> {
  const maxPages = Math.max(1, Math.min(options.maxPages ?? 10, HARD_MAX_PAGES));
  const items: T[] = [];
  let cursor = options.startCursor;
  let pages = 0;
  const seen = new Set<string>();
  while (pages < maxPages) {
    const page = await fetchPage(cursor, pages);
    if (!page.ok) return page;
    pages++;
    items.push(...page.data.items);
    cursor = page.data.nextCursor;
    if (!cursor) return { ok: true, data: { items, pages, truncated: false } };
    if (seen.has(cursor)) return { ok: true, data: { items, pages, truncated: false } }; // provider loop guard
    seen.add(cursor);
  }
  return { ok: true, data: { items, pages, truncated: true, nextCursor: cursor } };
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function asString(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return undefined;
}

export function asNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return 0;
}

export function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

export const sleepMs = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** SHA-256 hex fingerprint of content, used to bind approvals to exact text. */
export async function contentFingerprint(...parts: Array<string | undefined>): Promise<string> {
  const joined = parts.map((p) => p ?? "").join("\u001f");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(joined));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
