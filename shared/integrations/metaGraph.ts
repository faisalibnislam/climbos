/**
 * Shared helpers for Meta Graph API adapters (Marketing API, Pages, Instagram).
 */

import { asArray, asString, collectPages, isRecord, readFailure, requestJson, writeFailure, type HttpOutcome } from "./http";
import type { AdapterOptions, PaginationResult, ReadResult, WriteResult } from "./types";

/** Platform + BUC throttling codes: the request was rejected, not applied. */
export const META_THROTTLE_CODES = new Set([4, 17, 32, 613, 80000, 80001, 80002, 80003, 80004, 80005, 80006, 80008, 80009, 80014]);

export interface MetaError {
  code?: number;
  subcode?: number;
  message: string;
  isTransient?: boolean;
}

export function parseMetaError(data: unknown): MetaError | undefined {
  if (!isRecord(data) || !isRecord(data.error)) return undefined;
  const e = data.error;
  return {
    code: typeof e.code === "number" ? e.code : undefined,
    subcode: typeof e.error_subcode === "number" ? e.error_subcode : undefined,
    message: asString(e.error_user_msg) ?? asString(e.message) ?? "Meta API error",
    isTransient: e.is_transient === true,
  };
}

export function metaWriteFailure<T = undefined>(outcome: Exclude<HttpOutcome, { kind: "ok" }>): WriteResult<T> {
  if (outcome.kind === "http_error") {
    const err = parseMetaError(outcome.data);
    if (err?.code !== undefined && META_THROTTLE_CODES.has(err.code)) {
      const r: WriteResult<T> = { status: "failed", retryable: true, providerMessage: `Rate limited by Meta (code ${err.code}): ${err.message}` };
      if (outcome.rate.retryAfterMs !== undefined) r.retryAfterMs = outcome.rate.retryAfterMs;
      return r;
    }
    // Meta code 2 / is_transient = "unexpected error, retry" → we don't know if applied.
    if (err && (err.code === 1 || err.code === 2 || err.isTransient)) {
      return { status: "uncertain", retryable: false, providerMessage: `Meta reported a temporary error (${err.message}); reconcile before retrying.` };
    }
  }
  return writeFailure<T>(outcome);
}

export function metaReadFailure<T>(outcome: Exclude<HttpOutcome, { kind: "ok" }>): ReadResult<T> {
  const base = readFailure<T>(outcome);
  if (outcome.kind === "http_error" && !base.ok) {
    const err = parseMetaError(outcome.data);
    if (err?.code !== undefined && (META_THROTTLE_CODES.has(err.code) || err.isTransient)) return { ...base, retryable: true };
  }
  return base;
}

export interface GraphCall extends AdapterOptions {
  accessToken: string;
  /** Optional appsecret_proof (HMAC-SHA256(token, appSecret) hex). */
  appSecretProof?: string;
}

export function withProof(url: URL, call: GraphCall): string {
  if (call.appSecretProof) url.searchParams.set("appsecret_proof", call.appSecretProof);
  return url.toString();
}

export function graphHeaders(call: GraphCall): Record<string, string> {
  return { Authorization: `Bearer ${call.accessToken}` };
}

export async function graphGet(call: GraphCall, url: URL): Promise<HttpOutcome> {
  return requestJson({ url: withProof(url, call), headers: graphHeaders(call), fetchImpl: call.fetchImpl, timeoutMs: call.timeoutMs });
}

export async function graphPost(call: GraphCall, url: URL, params: Record<string, string>): Promise<HttpOutcome> {
  return requestJson({
    url: withProof(url, call),
    method: "POST",
    headers: graphHeaders(call),
    body: new URLSearchParams(params),
    fetchImpl: call.fetchImpl,
    timeoutMs: call.timeoutMs,
  });
}

/** Follow Graph cursor pagination (paging.cursors.after) up to maxPages. */
export async function graphCollect<T>(
  call: GraphCall,
  firstUrl: URL,
  mapItem: (raw: Record<string, unknown>) => T | undefined,
  maxPages = 10,
): Promise<ReadResult<PaginationResult<T>>> {
  return collectPages<T>(
    async (cursor) => {
      const url = new URL(firstUrl.toString());
      if (cursor) url.searchParams.set("after", cursor);
      const out = await graphGet(call, url);
      if (out.kind !== "ok") return metaReadFailure(out);
      const data = isRecord(out.data) ? out.data : {};
      const items: T[] = [];
      for (const raw of asArray(data.data)) {
        if (!isRecord(raw)) continue;
        const mapped = mapItem(raw);
        if (mapped !== undefined) items.push(mapped);
      }
      const paging = isRecord(data.paging) ? data.paging : {};
      const cursors = isRecord(paging.cursors) ? paging.cursors : {};
      // Only continue when Graph signals a next page.
      const next = typeof paging.next === "string" ? asString(cursors.after) : undefined;
      return { ok: true, data: { items, nextCursor: next } };
    },
    { maxPages },
  );
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** appsecret_proof = HMAC-SHA256(accessToken, appSecret) as hex. */
export async function computeAppSecretProof(accessToken: string, appSecret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(appSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", key, enc.encode(accessToken)));
}
