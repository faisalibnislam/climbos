/**
 * Rate-limit parsing and bounded, jittered exponential backoff.
 *
 * `withBackoff` refuses to run unless the caller declares the operation an
 * idempotent read: writes must never be retried blindly (see WriteResult).
 */

export interface RateLimitInfo {
  /** How long the provider asked us to wait, if it said. */
  retryAfterMs?: number;
  /** 0..1 fraction of the tightest quota already consumed, if reported. */
  quotaUsedFraction?: number;
}

type HeaderSource = Headers | Record<string, string | undefined>;

function getHeader(headers: HeaderSource, name: string): string | undefined {
  if (typeof (headers as Headers).get === "function") {
    const v = (headers as Headers).get(name);
    return v === null ? undefined : v;
  }
  const rec = headers as Record<string, string | undefined>;
  const lower = name.toLowerCase();
  for (const key of Object.keys(rec)) {
    if (key.toLowerCase() === lower) return rec[key];
  }
  return undefined;
}

/** Parse an HTTP Retry-After value (delta-seconds or HTTP-date). */
export function parseRetryAfter(value: string | undefined | null, nowMs: number = Date.now()): number | undefined {
  if (value === undefined || value === null) return undefined;
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return Math.max(0, Math.round(Number(trimmed) * 1000));
  }
  const date = Date.parse(trimmed);
  if (Number.isNaN(date)) return undefined;
  return Math.max(0, date - nowMs);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function num(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return undefined;
}

function safeJson(text: string | undefined): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/** Google "30s" / "1.5s" durations (google.protobuf.Duration JSON form). */
export function parseGoogleDuration(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;
  const m = /^(\d+(?:\.\d+)?)s$/.exec(value.trim());
  return m ? Math.round(Number(m[1]) * 1000) : undefined;
}

function maxDefined(values: Array<number | undefined>): number | undefined {
  const defined = values.filter((v): v is number => v !== undefined);
  return defined.length ? Math.max(...defined) : undefined;
}

/** Meta X-App-Usage / X-Page-Usage: {"call_count":28,"total_time":25,"total_cputime":25} (percentages). */
function parseMetaAppUsage(raw: string | undefined): number | undefined {
  const parsed = safeJson(raw);
  if (!isRecord(parsed)) return undefined;
  const pct = maxDefined([num(parsed.call_count), num(parsed.total_time), num(parsed.total_cputime)]);
  return pct === undefined ? undefined : pct / 100;
}

/** Meta X-Business-Use-Case-Usage: {"<id>":[{type, call_count, total_cputime, total_time, estimated_time_to_regain_access}]} */
function parseMetaBucUsage(raw: string | undefined): RateLimitInfo {
  const parsed = safeJson(raw);
  if (!isRecord(parsed)) return {};
  const fractions: Array<number | undefined> = [];
  const waits: Array<number | undefined> = [];
  for (const value of Object.values(parsed)) {
    if (!Array.isArray(value)) continue;
    for (const entry of value) {
      if (!isRecord(entry)) continue;
      const pct = maxDefined([num(entry.call_count), num(entry.total_time), num(entry.total_cputime)]);
      fractions.push(pct === undefined ? undefined : pct / 100);
      const minutes = num(entry.estimated_time_to_regain_access);
      waits.push(minutes !== undefined && minutes > 0 ? minutes * 60_000 : undefined);
    }
  }
  return { quotaUsedFraction: maxDefined(fractions), retryAfterMs: maxDefined(waits) };
}

/** Meta X-Ad-Account-Usage: {"acc_id_util_pct":9.67,"reset_time_duration":100} */
function parseMetaAdAccountUsage(raw: string | undefined): RateLimitInfo {
  const parsed = safeJson(raw);
  if (!isRecord(parsed)) return {};
  const pct = num(parsed.acc_id_util_pct);
  const reset = num(parsed.reset_time_duration);
  return {
    quotaUsedFraction: pct === undefined ? undefined : pct / 100,
    retryAfterMs: reset !== undefined && pct !== undefined && pct >= 100 ? reset * 1000 : undefined,
  };
}

/** Google error bodies: google.rpc.RetryInfo.retryDelay or Ads quotaErrorDetails.retryDelay. */
function parseGoogleErrorBody(body: unknown): number | undefined {
  const waits: Array<number | undefined> = [];
  const visit = (node: unknown, depth: number): void => {
    if (depth > 8) return;
    if (Array.isArray(node)) {
      for (const n of node) visit(n, depth + 1);
      return;
    }
    if (!isRecord(node)) return;
    if ("retryDelay" in node) waits.push(parseGoogleDuration(node.retryDelay));
    for (const v of Object.values(node)) {
      if (typeof v === "object" && v !== null) visit(v, depth + 1);
    }
  };
  visit(body, 0);
  return maxDefined(waits);
}

/**
 * Parse rate-limit signals from response headers (and optionally the decoded
 * error body for Google quota errors). Returns the most conservative values.
 */
export function parseRateLimit(headers: HeaderSource, body?: unknown, nowMs: number = Date.now()): RateLimitInfo {
  const retryAfter = parseRetryAfter(getHeader(headers, "retry-after"), nowMs);

  const appUsage = parseMetaAppUsage(getHeader(headers, "x-app-usage"));
  const pageUsage = parseMetaAppUsage(getHeader(headers, "x-page-usage"));
  const buc = parseMetaBucUsage(getHeader(headers, "x-business-use-case-usage"));
  const adAcct = parseMetaAdAccountUsage(getHeader(headers, "x-ad-account-usage"));

  // IETF draft ratelimit headers (Resend and others).
  const limit = num(getHeader(headers, "ratelimit-limit") ?? getHeader(headers, "x-ratelimit-limit"));
  const remaining = num(getHeader(headers, "ratelimit-remaining") ?? getHeader(headers, "x-ratelimit-remaining"));
  const reset = num(getHeader(headers, "ratelimit-reset"));
  const ietfFraction = limit !== undefined && limit > 0 && remaining !== undefined ? (limit - remaining) / limit : undefined;
  const ietfWait = remaining === 0 && reset !== undefined ? reset * 1000 : undefined;

  const googleWait = body === undefined ? undefined : parseGoogleErrorBody(body);

  const quotaUsedFraction = maxDefined([appUsage, pageUsage, buc.quotaUsedFraction, adAcct.quotaUsedFraction, ietfFraction]);
  const retryAfterMs = maxDefined([retryAfter, buc.retryAfterMs, adAcct.retryAfterMs, ietfWait, googleWait]);
  const out: RateLimitInfo = {};
  if (retryAfterMs !== undefined) out.retryAfterMs = retryAfterMs;
  if (quotaUsedFraction !== undefined) out.quotaUsedFraction = Math.min(1, Math.max(0, quotaUsedFraction));
  return out;
}

/** Error type used by adapters so withBackoff can decide whether to retry a read. */
export class RetryableReadError extends Error {
  constructor(
    message: string,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "RetryableReadError";
  }
}

export interface BackoffOptions {
  /** Must be literally true. Writes are never retried by this helper. */
  idempotent: true;
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Upper bound on any single provider-requested wait we will honor. */
  maxRetryAfterMs?: number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  isRetryable?: (err: unknown) => boolean;
}

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Full-jitter exponential delay, bounded by maxDelayMs. */
export function backoffDelayMs(attempt: number, baseDelayMs: number, maxDelayMs: number, random: () => number): number {
  const cap = Math.min(maxDelayMs, baseDelayMs * 2 ** Math.max(0, attempt - 1));
  return Math.round(random() * cap);
}

/**
 * Retry an idempotent read with jittered, bounded exponential backoff.
 * Only RetryableReadError (or errors accepted by `isRetryable`) are retried.
 */
export async function withBackoff<T>(fn: (attempt: number) => Promise<T>, options: BackoffOptions): Promise<T> {
  if (options.idempotent !== true) {
    throw new Error("withBackoff only retries idempotent reads; writes must be reconciled instead");
  }
  const maxAttempts = Math.max(1, Math.min(options.maxAttempts ?? 4, 10));
  const base = options.baseDelayMs ?? 500;
  const maxDelay = options.maxDelayMs ?? 30_000;
  const maxRetryAfter = options.maxRetryAfterMs ?? 120_000;
  const sleep = options.sleep ?? defaultSleep;
  const random = options.random ?? Math.random;
  const isRetryable = options.isRetryable ?? ((err: unknown) => err instanceof RetryableReadError);

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      if (attempt === maxAttempts || !isRetryable(err)) throw err;
      const hinted = err instanceof RetryableReadError ? err.retryAfterMs : undefined;
      if (hinted !== undefined && hinted > maxRetryAfter) throw err;
      const delay = Math.max(hinted ?? 0, backoffDelayMs(attempt, base, maxDelay, random));
      await sleep(delay);
    }
  }
  throw lastError;
}
