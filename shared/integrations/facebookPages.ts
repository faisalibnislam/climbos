/**
 * Facebook Pages (Graph v26.0): list managed Pages, publish text/link/photo
 * posts with a Page access token, verify by read-back, Page insights.
 * Scopes: pages_show_list, pages_manage_posts, pages_read_engagement, read_insights.
 */

import { asArray, asNumber, asString, contentFingerprint, isRecord } from "./http";
import { graphCollect, graphGet, graphPost, metaReadFailure, metaWriteFailure, type GraphCall } from "./metaGraph";
import { GRAPH_BASE } from "./registry";
import { validateResearchUrl } from "./website";
import { approvalError, type ApprovedAction, type PaginationResult, type ReadResult, type ReconcileResult, type WriteResult } from "./types";

export const FACEBOOK_POST_MAX_CHARS = 63_206;
export const PUBLISH_PAGE_POST_ACTION = "facebook_pages.publish_post";

export interface ManagedPage {
  id: string;
  name: string;
  /** Page access token returned by /me/accounts. Store encrypted; never log. */
  pageAccessToken?: string;
  tasks: string[];
  canPublish: boolean;
}

/** Pages the user manages. Requires a User access token with pages_show_list. */
export async function listManagedPages(call: GraphCall & { maxPages?: number }): Promise<ReadResult<PaginationResult<ManagedPage>>> {
  const url = new URL(`${GRAPH_BASE}/me/accounts`);
  url.searchParams.set("fields", "id,name,access_token,tasks");
  url.searchParams.set("limit", "100");
  return graphCollect(
    call,
    url,
    (raw) => {
      const id = asString(raw.id);
      if (!id) return undefined;
      const tasks = asArray(raw.tasks).filter((t): t is string => typeof t === "string");
      const page: ManagedPage = { id, name: asString(raw.name) ?? id, tasks, canPublish: tasks.includes("CREATE_CONTENT") };
      const tok = asString(raw.access_token);
      if (tok) page.pageAccessToken = tok;
      return page;
    },
    call.maxPages ?? 5,
  );
}

export interface PagePostState {
  id: string;
  message?: string;
  createdTime?: string;
  permalinkUrl?: string;
  /** Counts returned with this Page post snapshot; not account-wide Insights. */
  reactions?: number;
  comments?: number;
  shares?: number;
}

function summaryCount(value: unknown): number | undefined {
  if (!isRecord(value) || !isRecord(value.summary)) return undefined;
  const count = value.summary.total_count;
  return typeof count === "number" && Number.isSafeInteger(count) && count >= 0 ? count : undefined;
}

function parsePost(raw: Record<string, unknown>): PagePostState {
  const p: PagePostState = { id: asString(raw.id) ?? "" };
  const m = asString(raw.message);
  if (m !== undefined) p.message = m;
  const c = asString(raw.created_time);
  if (c) p.createdTime = c;
  const l = asString(raw.permalink_url);
  if (l) p.permalinkUrl = l;
  const reactions = summaryCount(raw.reactions);
  if (reactions !== undefined) p.reactions = reactions;
  const comments = summaryCount(raw.comments);
  if (comments !== undefined) p.comments = comments;
  if (isRecord(raw.shares)) {
    const shares = raw.shares.count;
    if (typeof shares === "number" && Number.isSafeInteger(shares) && shares >= 0) p.shares = shares;
  }
  return p;
}

export async function getPost(call: GraphCall & { postId: string }): Promise<ReadResult<PagePostState>> {
  if (!/^[\d_]+$/.test(call.postId)) return { ok: false, providerMessage: "Invalid post id", retryable: false };
  const url = new URL(`${GRAPH_BASE}/${call.postId}`);
  url.searchParams.set("fields", "id,message,created_time,permalink_url");
  const out = await graphGet(call, url);
  if (out.kind !== "ok") return metaReadFailure(out);
  return { ok: true, data: parsePost(isRecord(out.data) ? out.data : {}) };
}

/** Read a small, recent Page-feed sample for an owner-requested audit. */
export async function getRecentPosts(call: GraphCall & { pageId: string; limit?: number }): Promise<ReadResult<PaginationResult<PagePostState>>> {
  if (!/^\d+$/.test(call.pageId)) return { ok: false, providerMessage: "Invalid Page id", retryable: false };
  const limit = Math.max(1, Math.min(Math.floor(call.limit ?? 10), 10));
  const url = new URL(`${GRAPH_BASE}/${call.pageId}/feed`);
  url.searchParams.set("fields", "id,message,created_time,permalink_url,reactions.limit(0).summary(true),comments.limit(0).summary(true),shares");
  url.searchParams.set("limit", String(limit));
  return graphCollect(call, url, parsePost, 1);
}

export interface PagePostInput {
  pageId: string;
  message: string;
  link?: string;
  /** Publicly retrievable https image URL → photo post. */
  imageUrl?: string;
}

export function validatePagePost(input: PagePostInput): string[] {
  const errors: string[] = [];
  if (!/^\d+$/.test(input.pageId)) errors.push("Invalid Page id.");
  if (!input.message.trim() && !input.imageUrl && !input.link) errors.push("A post needs a message, link or photo.");
  if (input.message.length > FACEBOOK_POST_MAX_CHARS) errors.push(`Message is longer than ${FACEBOOK_POST_MAX_CHARS} characters.`);
  if (input.link && input.imageUrl) errors.push("Choose either a link post or a photo post, not both.");
  for (const [label, u] of [["Link", input.link], ["Image URL", input.imageUrl]] as const) {
    if (!u) continue;
    const v = validateResearchUrl(u);
    if (!v.ok) errors.push(`${label} is not a safe public URL: ${v.reason}`);
    else if (label === "Image URL" && !v.url.startsWith("https://")) errors.push("Image URL must use https.");
  }
  return errors;
}

/** Approval value for a post: fingerprint of the exact content. */
export function pagePostApprovalValue(input: PagePostInput): Promise<string> {
  return contentFingerprint(input.pageId, input.message, input.link, input.imageUrl);
}

/**
 * Publish a text/link post (/feed) or photo post (/photos) using a Page access
 * token, then read the post back. "verified" only when the read-back message matches.
 * On "uncertain", call reconcilePagePost before any retry.
 */
export async function publishPagePost(
  call: GraphCall & { post: PagePostInput; approval: ApprovedAction | undefined; now?: number },
): Promise<WriteResult<PagePostState>> {
  const errors = validatePagePost(call.post);
  if (errors.length) return { status: "failed", retryable: false, providerMessage: errors.join(" ") };
  const refusal = approvalError(call.approval, { kind: PUBLISH_PAGE_POST_ACTION, targetId: call.post.pageId, value: await pagePostApprovalValue(call.post) }, call.now);
  if (refusal) return { status: "failed", retryable: false, providerMessage: refusal };

  const isPhoto = Boolean(call.post.imageUrl);
  const url = new URL(`${GRAPH_BASE}/${call.post.pageId}/${isPhoto ? "photos" : "feed"}`);
  const params: Record<string, string> = isPhoto
    ? { url: call.post.imageUrl ?? "", caption: call.post.message, published: "true" }
    : { message: call.post.message, published: "true" };
  if (!isPhoto && call.post.link) params.link = call.post.link;

  const out = await graphPost(call, url, params);
  if (out.kind !== "ok") return metaWriteFailure(out);
  const data = isRecord(out.data) ? out.data : {};
  const postId = isPhoto ? asString(data.post_id) : asString(data.id);
  if (!postId) return { status: "uncertain", retryable: false, providerMessage: "Publish returned no post id; reconcile before retrying." };

  const read = await getPost({ ...call, postId });
  if (!read.ok) return { status: "uncertain", externalId: postId, retryable: false, providerMessage: `Published but read-back failed: ${read.providerMessage}` };
  if (call.post.message && (read.data.message ?? "") !== call.post.message) {
    return { status: "uncertain", externalId: postId, retryable: false, providerMessage: "Read-back message differs from what was sent.", data: read.data };
  }
  return { status: "verified", externalId: postId, retryable: false, data: read.data };
}

/** Find a recent Page post with exactly this message (reconcile after "uncertain"). */
export async function reconcilePagePost(
  call: GraphCall & { pageId: string; message: string; sinceUnix: number },
): Promise<ReconcileResult<PagePostState>> {
  const url = new URL(`${GRAPH_BASE}/${call.pageId}/feed`);
  url.searchParams.set("fields", "id,message,created_time,permalink_url");
  url.searchParams.set("since", String(Math.floor(call.sinceUnix)));
  url.searchParams.set("limit", "50");
  const res = await graphCollect(call, url, parsePost, 3);
  if (!res.ok) return { outcome: "unknown", providerMessage: res.providerMessage };
  const match = res.data.items.find((p) => p.message === call.message);
  return match ? { outcome: "found", externalId: match.id, data: match } : { outcome: "not_found" };
}

export interface PageInsightValue {
  metric: string;
  period: string;
  endTime?: string;
  value: number;
}

/**
 * Page insights. Meta frequently deprecates Page metrics, so metric names are
 * caller-supplied and unknown metrics surface as a provider error.
 */
export async function getPageInsights(
  call: GraphCall & { pageId: string; metrics: string[]; period?: "day" | "week" | "days_28"; since?: string; until?: string },
): Promise<ReadResult<PageInsightValue[]>> {
  if (call.metrics.length === 0) return { ok: false, providerMessage: "At least one metric is required", retryable: false };
  const url = new URL(`${GRAPH_BASE}/${call.pageId}/insights`);
  url.searchParams.set("metric", call.metrics.join(","));
  url.searchParams.set("period", call.period ?? "day");
  if (call.since) url.searchParams.set("since", call.since);
  if (call.until) url.searchParams.set("until", call.until);
  const out = await graphGet(call, url);
  if (out.kind !== "ok") return metaReadFailure(out);
  const values: PageInsightValue[] = [];
  const data = isRecord(out.data) ? out.data : {};
  for (const m of asArray(data.data)) {
    if (!isRecord(m)) continue;
    for (const v of asArray(m.values)) {
      if (!isRecord(v)) continue;
      values.push({ metric: asString(m.name) ?? "", period: asString(m.period) ?? "", endTime: asString(v.end_time), value: asNumber(v.value) });
    }
  }
  return { ok: true, data: values };
}
