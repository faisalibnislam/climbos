/**
 * X API v2 posts (OAuth 2.0 user context).
 * Scopes: tweet.read, tweet.write, users.read, offline.access.
 * Text only: media upload needs media.write, which we don't request yet.
 */

import { countForPlatform } from "./drafts";
import { asArray, asString, contentFingerprint, isRecord, requestJson, writeFailure, type HttpOutcome } from "./http";
import { X_API_BASE } from "./registry";
import { approvalError, type AdapterOptions, type ApprovedAction, type ReadResult, type ReconcileResult, type WriteResult } from "./types";

export const X_POST_MAX_WEIGHTED = 280;
export const PUBLISH_X_ACTION = "x.publish_post";

export interface XCall extends AdapterOptions {
  accessToken: string;
}

function headers(call: XCall): Record<string, string> {
  return { Authorization: `Bearer ${call.accessToken}` };
}

/** X error bodies: problem+json {title, detail} or {errors:[{message}]} or {message}. */
export function xErrorMessage(data: unknown, fallback: string): string {
  if (!isRecord(data)) return typeof data === "string" && data.trim() ? data.slice(0, 500) : fallback;
  const first = asArray(data.errors).find(isRecord);
  const msg = asString(data.detail) ?? asString(data.title) ?? (first ? (asString(first.detail) ?? asString(first.message)) : undefined) ?? asString(data.message);
  return (msg ?? fallback).slice(0, 500);
}

/** x-rate-limit-reset is epoch seconds. */
function resetWaitMs(h: Headers, nowMs: number): number | undefined {
  const reset = Number(h.get("x-rate-limit-reset"));
  if (!Number.isFinite(reset) || reset <= 0) return undefined;
  return Math.max(0, reset * 1000 - nowMs);
}

/**
 * 401 → reconnect; 429 → retryable (definitely not applied); 403 → failed with
 * X's reason; 5xx / network → uncertain (X may have posted it; reconcile first).
 */
export function xWriteFailure<T = undefined>(outcome: Exclude<HttpOutcome, { kind: "ok" }>, nowMs: number = Date.now()): WriteResult<T> {
  if (outcome.kind === "network_error") return writeFailure<T>(outcome);
  const msg = xErrorMessage(outcome.data, outcome.message);
  if (outcome.status === 401) return { status: "failed", retryable: false, providerMessage: "X sign-in expired or was revoked. Reconnect X." };
  if (outcome.status === 429) {
    const r: WriteResult<T> = { status: "failed", retryable: true, providerMessage: `X rate limit reached: ${msg}` };
    const wait = outcome.rate.retryAfterMs ?? resetWaitMs(outcome.headers, nowMs);
    if (wait !== undefined) r.retryAfterMs = wait;
    return r;
  }
  if (outcome.status >= 500 || outcome.status === 408) return writeFailure<T>(outcome);
  return { status: "failed", retryable: false, providerMessage: outcome.status === 403 ? `X refused the post: ${msg}` : msg };
}

function xReadFailure<T>(outcome: Exclude<HttpOutcome, { kind: "ok" }>, nowMs: number = Date.now()): ReadResult<T> {
  if (outcome.kind === "network_error") return { ok: false, providerMessage: outcome.message, retryable: true };
  const out: ReadResult<T> = { ok: false, status: outcome.status, providerMessage: xErrorMessage(outcome.data, outcome.message), retryable: outcome.status === 429 || outcome.status >= 500 };
  const wait = outcome.rate.retryAfterMs ?? (outcome.status === 429 ? resetWaitMs(outcome.headers, nowMs) : undefined);
  if (wait !== undefined) out.retryAfterMs = wait;
  return out;
}

export interface XUser {
  id: string;
  username: string;
  name: string;
}

export async function getMe(call: XCall): Promise<ReadResult<XUser>> {
  const out = await requestJson({ url: `${X_API_BASE}/users/me`, headers: headers(call), fetchImpl: call.fetchImpl, timeoutMs: call.timeoutMs });
  if (out.kind !== "ok") return xReadFailure(out);
  const d = isRecord(out.data) && isRecord(out.data.data) ? out.data.data : {};
  const id = asString(d.id);
  if (!id) return { ok: false, providerMessage: "X returned no user id", retryable: false };
  return { ok: true, data: { id, username: asString(d.username) ?? "", name: asString(d.name) ?? "" } };
}

/** X weighted length (URLs = 23, CJK/emoji = 2), after NFC like X does. */
export function xWeightedLength(text: string): number {
  return countForPlatform(text.normalize("NFC"), "x_weighted");
}

export interface XPostInput {
  userId: string;
  text: string;
}

export function validateXPost(p: XPostInput): string[] {
  const errors: string[] = [];
  if (!/^\d+$/.test(p.userId)) errors.push("Invalid X user id. Reconnect X.");
  if (!p.text.trim()) errors.push("An X post needs text.");
  const n = xWeightedLength(p.text);
  if (n > X_POST_MAX_WEIGHTED) errors.push(`This post is ${n}/${X_POST_MAX_WEIGHTED} characters on X (links count as 23, emoji as 2). Shorten it and approve again.`);
  return errors;
}

export function xApprovalValue(p: XPostInput): Promise<string> {
  return contentFingerprint(p.userId, p.text);
}

export interface XPostState {
  id: string;
  text: string;
  authorId?: string;
}

function parseTweet(d: Record<string, unknown>): XPostState {
  const t: XPostState = { id: asString(d.id) ?? "", text: asString(d.text) ?? "" };
  const a = asString(d.author_id);
  if (a) t.authorId = a;
  return t;
}

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };

/** X returns links as t.co and HTML-escapes &, <, >: compare with links masked. */
export function sameXText(sent: string, got: string): boolean {
  const norm = (s: string) =>
    s
      .replace(/&(amp|lt|gt|quot|#39);/g, (m) => ENTITIES[m] ?? m)
      .replace(/https?:\/\/\S+/g, "<url>")
      .normalize("NFC")
      .replace(/\s+/g, " ")
      .trim();
  return norm(sent) === norm(got);
}

export async function getTweet(call: XCall & { tweetId: string }): Promise<ReadResult<XPostState>> {
  if (!/^\d+$/.test(call.tweetId)) return { ok: false, providerMessage: "Invalid post id", retryable: false };
  const out = await requestJson({ url: `${X_API_BASE}/tweets/${call.tweetId}?tweet.fields=author_id,text`, headers: headers(call), fetchImpl: call.fetchImpl, timeoutMs: call.timeoutMs });
  if (out.kind !== "ok") return xReadFailure(out);
  const d = isRecord(out.data) && isRecord(out.data.data) ? out.data.data : undefined;
  if (!d) return { ok: false, status: 404, providerMessage: xErrorMessage(out.data, "Post not found"), retryable: false };
  return { ok: true, data: parseTweet(d) };
}

/** Publish a text post, then read it back. Over-length text is refused before any call. */
export async function publishTweet(call: XCall & { post: XPostInput; approval: ApprovedAction | undefined; now?: number }): Promise<WriteResult<XPostState>> {
  const errors = validateXPost(call.post);
  if (errors.length) return { status: "failed", retryable: false, providerMessage: errors.join(" ") };
  const refusal = approvalError(call.approval, { kind: PUBLISH_X_ACTION, targetId: call.post.userId, value: await xApprovalValue(call.post) }, call.now);
  if (refusal) return { status: "failed", retryable: false, providerMessage: refusal };

  const out = await requestJson({ url: `${X_API_BASE}/tweets`, method: "POST", headers: headers(call), body: { text: call.post.text }, fetchImpl: call.fetchImpl, timeoutMs: call.timeoutMs });
  if (out.kind !== "ok") return xWriteFailure(out, call.now);
  const id = isRecord(out.data) && isRecord(out.data.data) ? asString(out.data.data.id) : undefined;
  if (!id) return { status: "uncertain", retryable: false, providerMessage: "X returned no post id; reconcile before retrying." };

  const read = await getTweet({ ...call, tweetId: id });
  if (!read.ok) return { status: "uncertain", externalId: id, retryable: false, providerMessage: `Accepted by X (${id}) but read-back failed: ${read.providerMessage}` };
  if (!sameXText(call.post.text, read.data.text)) return { status: "uncertain", externalId: id, retryable: false, providerMessage: "Read-back text differs from what was sent.", data: read.data };
  return { status: "verified", externalId: id, retryable: false, data: read.data };
}

/** Reconcile after "uncertain": read the known id, else search the user's recent posts. */
export async function reconcileTweet(
  call: XCall & { userId: string; text: string; tweetId?: string; sinceMs: number },
): Promise<ReconcileResult<XPostState>> {
  if (call.tweetId) {
    const read = await getTweet({ ...call, tweetId: call.tweetId });
    if (read.ok) return { outcome: "found", externalId: read.data.id, data: read.data };
    return { outcome: "unknown", providerMessage: read.providerMessage };
  }
  if (!/^\d+$/.test(call.userId)) return { outcome: "unknown", providerMessage: "Invalid X user id" };
  const url = new URL(`${X_API_BASE}/users/${call.userId}/tweets`);
  url.searchParams.set("max_results", "20");
  url.searchParams.set("start_time", new Date(call.sinceMs).toISOString().replace(/\.\d{3}Z$/, "Z"));
  url.searchParams.set("tweet.fields", "author_id,text");
  const out = await requestJson({ url: url.toString(), headers: headers(call), fetchImpl: call.fetchImpl, timeoutMs: call.timeoutMs });
  if (out.kind !== "ok") return { outcome: "unknown", providerMessage: xErrorMessage(out.kind === "http_error" ? out.data : undefined, out.message) };
  const tweets = (isRecord(out.data) ? asArray(out.data.data) : []).filter(isRecord).map(parseTweet);
  const match = tweets.find((t) => sameXText(call.text, t.text));
  return match ? { outcome: "found", externalId: match.id, data: match } : { outcome: "not_found" };
}
