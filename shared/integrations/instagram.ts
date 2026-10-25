/**
 * Instagram API with Instagram Login (graph.instagram.com, v26.0).
 * Scopes: instagram_business_basic, instagram_business_content_publish,
 * instagram_business_manage_insights for optional organic post analytics.
 *
 * Flow: account type check → content_publishing_limit → create container →
 * bounded status polling → media_publish → read the media back.
 */

import { asArray, asNumber, asString, contentFingerprint, isRecord, sleepMs } from "./http";
import { graphGet, graphPost, metaReadFailure, metaWriteFailure, type GraphCall } from "./metaGraph";
import { INSTAGRAM_GRAPH_BASE } from "./registry";
import { validateResearchUrl } from "./website";
import { approvalError, type ApprovedAction, type ReadResult, type ReconcileResult, type WriteResult } from "./types";

export const INSTAGRAM_CAPTION_MAX_CHARS = 2200;
export const INSTAGRAM_MAX_HASHTAGS = 30;
export const INSTAGRAM_MAX_MENTIONS = 20;
export const INSTAGRAM_ALT_TEXT_MAX_CHARS = 1000;
export const INSTAGRAM_CAROUSEL_MAX_ITEMS = 10;
export const PUBLISH_INSTAGRAM_ACTION = "instagram.publish_media";

export type ContainerStatus = "FINISHED" | "IN_PROGRESS" | "ERROR" | "EXPIRED" | "PUBLISHED";

export interface InstagramAccount {
  userId: string;
  username: string;
  accountType: string;
  /** Business or Media_Creator. */
  isProfessional: boolean;
}

export function isProfessionalAccountType(t: string | undefined): boolean {
  const s = (t ?? "").trim().toLowerCase();
  return s === "business" || s === "media_creator" || s === "creator";
}

export async function getAccount(call: GraphCall): Promise<ReadResult<InstagramAccount>> {
  const url = new URL(`${INSTAGRAM_GRAPH_BASE}/me`);
  url.searchParams.set("fields", "user_id,username,account_type");
  const out = await graphGet(call, url);
  if (out.kind !== "ok") return metaReadFailure(out);
  const d = isRecord(out.data) ? out.data : {};
  const accountType = asString(d.account_type) ?? "";
  return {
    ok: true,
    data: { userId: asString(d.user_id) ?? asString(d.id) ?? "", username: asString(d.username) ?? "", accountType, isProfessional: isProfessionalAccountType(accountType) },
  };
}

export interface PublishingLimit {
  quotaUsage: number;
  quotaTotal?: number;
  quotaDurationSec?: number;
  remaining?: number;
}

/** Reads the live publishing limit; we never hardcode a daily number. */
export async function getPublishingLimit(call: GraphCall & { igUserId: string }): Promise<ReadResult<PublishingLimit>> {
  const url = new URL(`${INSTAGRAM_GRAPH_BASE}/${call.igUserId}/content_publishing_limit`);
  url.searchParams.set("fields", "quota_usage,config");
  const out = await graphGet(call, url);
  if (out.kind !== "ok") return metaReadFailure(out);
  const first = isRecord(out.data) ? asArray(out.data.data).find(isRecord) : undefined;
  if (!first) return { ok: false, providerMessage: "No publishing limit returned", retryable: true };
  const cfg = isRecord(first.config) ? first.config : {};
  const limit: PublishingLimit = { quotaUsage: asNumber(first.quota_usage) };
  if (cfg.quota_total !== undefined) {
    limit.quotaTotal = asNumber(cfg.quota_total);
    limit.remaining = Math.max(0, limit.quotaTotal - limit.quotaUsage);
  }
  if (cfg.quota_duration !== undefined) limit.quotaDurationSec = asNumber(cfg.quota_duration);
  return { ok: true, data: limit };
}

export function countHashtags(caption: string): number {
  return (caption.match(/(^|\s)#[\p{L}\p{N}_]+/gu) ?? []).length;
}

export function countMentions(caption: string): number {
  return (caption.match(/(^|\s)@[A-Za-z0-9._]+/g) ?? []).length;
}

export function validateCaption(caption: string): string[] {
  const errors: string[] = [];
  if ([...caption].length > INSTAGRAM_CAPTION_MAX_CHARS) errors.push(`Caption is longer than ${INSTAGRAM_CAPTION_MAX_CHARS} characters.`);
  if (countHashtags(caption) > INSTAGRAM_MAX_HASHTAGS) errors.push(`Caption has more than ${INSTAGRAM_MAX_HASHTAGS} hashtags.`);
  if (countMentions(caption) > INSTAGRAM_MAX_MENTIONS) errors.push(`Caption has more than ${INSTAGRAM_MAX_MENTIONS} @mentions.`);
  return errors;
}

/** image_url must be https and publicly retrievable (no private/internal hosts). Instagram accepts JPEG only. */
export function validateImageUrl(imageUrl: string): string[] {
  const v = validateResearchUrl(imageUrl);
  if (!v.ok) return [`Image URL is not publicly reachable: ${v.reason}`];
  if (!v.url.startsWith("https://")) return ["Image URL must use https."];
  return [];
}

export interface ImagePostInput {
  igUserId: string;
  imageUrl: string;
  caption: string;
  altText?: string;
}

export function validateImagePost(p: ImagePostInput): string[] {
  const errors = [...validateImageUrl(p.imageUrl), ...validateCaption(p.caption)];
  if (!/^\d+$/.test(p.igUserId)) errors.push("Invalid Instagram user id.");
  if (p.altText !== undefined && [...p.altText].length > INSTAGRAM_ALT_TEXT_MAX_CHARS) errors.push(`Alt text is longer than ${INSTAGRAM_ALT_TEXT_MAX_CHARS} characters.`);
  return errors;
}

export function instagramApprovalValue(p: ImagePostInput): Promise<string> {
  return contentFingerprint(p.igUserId, p.imageUrl, p.caption, p.altText);
}

export async function createImageContainer(call: GraphCall & { post: ImagePostInput; isCarouselItem?: boolean }): Promise<WriteResult> {
  const errors = call.isCarouselItem ? validateImageUrl(call.post.imageUrl) : validateImagePost(call.post);
  if (errors.length) return { status: "failed", retryable: false, providerMessage: errors.join(" ") };
  const params: Record<string, string> = { image_url: call.post.imageUrl };
  if (call.isCarouselItem) params.is_carousel_item = "true";
  else params.caption = call.post.caption;
  if (call.post.altText) params.alt_text = call.post.altText;
  const out = await graphPost(call, new URL(`${INSTAGRAM_GRAPH_BASE}/${call.post.igUserId}/media`), params);
  if (out.kind !== "ok") return metaWriteFailure(out);
  const id = isRecord(out.data) ? asString(out.data.id) : undefined;
  // A container is not visible to anyone until media_publish, so an id is proof enough here.
  return id ? { status: "verified", externalId: id, retryable: false } : { status: "uncertain", retryable: false, providerMessage: "No container id returned" };
}

export async function createCarouselContainer(call: GraphCall & { igUserId: string; childContainerIds: string[]; caption: string }): Promise<WriteResult> {
  const errors = validateCaption(call.caption);
  if (call.childContainerIds.length < 2 || call.childContainerIds.length > INSTAGRAM_CAROUSEL_MAX_ITEMS) errors.push(`A carousel needs 2–${INSTAGRAM_CAROUSEL_MAX_ITEMS} items.`);
  if (errors.length) return { status: "failed", retryable: false, providerMessage: errors.join(" ") };
  const out = await graphPost(call, new URL(`${INSTAGRAM_GRAPH_BASE}/${call.igUserId}/media`), {
    media_type: "CAROUSEL",
    children: call.childContainerIds.join(","),
    caption: call.caption,
  });
  if (out.kind !== "ok") return metaWriteFailure(out);
  const id = isRecord(out.data) ? asString(out.data.id) : undefined;
  return id ? { status: "verified", externalId: id, retryable: false } : { status: "uncertain", retryable: false, providerMessage: "No container id returned" };
}

export async function getContainerStatus(call: GraphCall & { containerId: string }): Promise<ReadResult<{ statusCode: ContainerStatus | string; status?: string }>> {
  const url = new URL(`${INSTAGRAM_GRAPH_BASE}/${call.containerId}`);
  url.searchParams.set("fields", "status_code,status");
  const out = await graphGet(call, url);
  if (out.kind !== "ok") return metaReadFailure(out);
  const d = isRecord(out.data) ? out.data : {};
  return { ok: true, data: { statusCode: asString(d.status_code) ?? "", status: asString(d.status) } };
}

export type PollOutcome = { outcome: "ready" | "error" | "expired" | "published" | "timeout" | "read_failed"; polls: number; detail?: string };

/** Poll container status with a hard bound on attempts (Meta suggests ≤ 1/min for ≤ 5 min). */
export async function pollContainerUntilReady(
  call: GraphCall & { containerId: string; maxPolls?: number; intervalMs?: number; sleep?: (ms: number) => Promise<void> },
): Promise<PollOutcome> {
  const maxPolls = Math.max(1, Math.min(call.maxPolls ?? 5, 10));
  const interval = call.intervalMs ?? 60_000;
  const sleep = call.sleep ?? sleepMs;
  for (let i = 1; i <= maxPolls; i++) {
    const res = await getContainerStatus(call);
    if (!res.ok) {
      if (!res.retryable || i === maxPolls) return { outcome: "read_failed", polls: i, detail: res.providerMessage };
    } else {
      switch (res.data.statusCode) {
        case "FINISHED":
          return { outcome: "ready", polls: i };
        case "PUBLISHED":
          return { outcome: "published", polls: i };
        case "ERROR":
          return { outcome: "error", polls: i, detail: res.data.status };
        case "EXPIRED":
          return { outcome: "expired", polls: i };
        default:
          break; // IN_PROGRESS
      }
    }
    if (i < maxPolls) await sleep(interval);
  }
  return { outcome: "timeout", polls: maxPolls };
}

export interface InstagramMedia {
  id: string;
  permalink?: string;
  timestamp?: string;
  mediaType?: string;
  mediaProductType?: string;
  caption?: string;
  /** Temporary Meta CDN URL; callers must not persist or log it. */
  mediaUrl?: string;
}

/** Temporary Instagram media URLs may be sent to the model only from Meta CDN hosts. */
export function isMetaMediaImageUrl(value?: string): value is string {
  if (!value || value.length > 4_096) return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && !url.username && !url.password && !url.port &&
      ["cdninstagram.com", "fbcdn.net"].some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

function parseMedia(d: Record<string, unknown>): InstagramMedia {
  const m: InstagramMedia = { id: asString(d.id) ?? "" };
  const p = asString(d.permalink);
  if (p) m.permalink = p;
  const t = asString(d.timestamp);
  if (t) m.timestamp = t;
  const mt = asString(d.media_type);
  if (mt) m.mediaType = mt;
  const productType = asString(d.media_product_type);
  if (productType) m.mediaProductType = productType;
  const c = asString(d.caption);
  if (c !== undefined) m.caption = c;
  const mediaUrl = asString(d.media_url);
  if (mediaUrl) m.mediaUrl = mediaUrl;
  return m;
}

export async function getMedia(call: GraphCall & { mediaId: string }): Promise<ReadResult<InstagramMedia>> {
  const url = new URL(`${INSTAGRAM_GRAPH_BASE}/${call.mediaId}`);
  url.searchParams.set("fields", "id,permalink,timestamp,media_type,caption");
  const out = await graphGet(call, url);
  if (out.kind !== "ok") return metaReadFailure(out);
  return { ok: true, data: parseMedia(isRecord(out.data) ? out.data : {}) };
}

/** Optional media-asset read used by visual audits; failures must not block caption review. */
export async function getMediaAsset(call: GraphCall & { mediaId: string }): Promise<ReadResult<InstagramMedia>> {
  if (!/^\d+$/.test(call.mediaId)) return { ok: false, providerMessage: "Invalid media id", retryable: false };
  const url = new URL(`${INSTAGRAM_GRAPH_BASE}/${call.mediaId}`);
  url.searchParams.set("fields", "id,media_type,media_url");
  const out = await graphGet(call, url);
  if (out.kind !== "ok") return metaReadFailure(out);
  return { ok: true, data: parseMedia(isRecord(out.data) ? out.data : {}) };
}

/** Read a small, recent media sample for an owner-requested account audit. */
export async function getRecentMedia(call: GraphCall & { igUserId: string; limit?: number }): Promise<ReadResult<{ items: InstagramMedia[]; truncated: boolean }>> {
  if (!/^\d+$/.test(call.igUserId)) return { ok: false, providerMessage: "Invalid Instagram user id", retryable: false };
  const limit = Math.max(1, Math.min(Math.floor(call.limit ?? 10), 10));
  const url = new URL(`${INSTAGRAM_GRAPH_BASE}/${call.igUserId}/media`);
  url.searchParams.set("fields", "id,permalink,timestamp,media_type,caption");
  url.searchParams.set("limit", String(limit));
  const out = await graphGet(call, url);
  if (out.kind !== "ok") return metaReadFailure(out);
  const data = isRecord(out.data) ? out.data : {};
  const items = asArray(data.data).filter(isRecord).map(parseMedia).filter((media) => Boolean(media.id)).slice(0, limit);
  const paging = isRecord(data.paging) ? data.paging : {};
  return { ok: true, data: { items, truncated: typeof paging.next === "string" } };
}

export interface InstagramMediaInsight {
  metric: string;
  value: number;
}

/** Reads lifetime metrics for one owned professional-account media item. */
export async function getMediaInsights(
  call: GraphCall & { mediaId: string; metrics?: readonly string[] },
): Promise<ReadResult<InstagramMediaInsight[]>> {
  if (!/^\d+$/.test(call.mediaId)) return { ok: false, providerMessage: "Invalid Instagram media id", retryable: false };
  const metrics = call.metrics ?? ["views", "reach", "likes", "comments", "saved", "shares"];
  const url = new URL(`${INSTAGRAM_GRAPH_BASE}/${call.mediaId}/insights`);
  url.searchParams.set("metric", metrics.join(","));
  const out = await graphGet(call, url);
  if (out.kind !== "ok") return metaReadFailure(out);
  const data = isRecord(out.data) ? asArray(out.data.data) : [];
  const values: InstagramMediaInsight[] = [];
  for (const item of data) {
    if (!isRecord(item)) continue;
    const metric = asString(item.name);
    const valueRows = asArray(item.values).filter(isRecord);
    const rawValue = valueRows[0]?.value ?? item.value;
    const value = typeof rawValue === "number" ? rawValue : typeof rawValue === "string" && rawValue.trim() ? Number(rawValue) : NaN;
    if (metric && Number.isFinite(value) && value >= 0) values.push({ metric, value });
  }
  return { ok: true, data: values };
}

/** media_publish + verification read of the returned media id. */
export async function publishContainer(call: GraphCall & { igUserId: string; containerId: string }): Promise<WriteResult<InstagramMedia>> {
  const out = await graphPost(call, new URL(`${INSTAGRAM_GRAPH_BASE}/${call.igUserId}/media_publish`), { creation_id: call.containerId });
  if (out.kind !== "ok") return metaWriteFailure(out);
  const mediaId = isRecord(out.data) ? asString(out.data.id) : undefined;
  if (!mediaId) return { status: "uncertain", retryable: false, providerMessage: "media_publish returned no id; reconcile with the container id." };
  const read = await getMedia({ ...call, mediaId });
  if (!read.ok || read.data.id !== mediaId) {
    return { status: "uncertain", externalId: mediaId, retryable: false, providerMessage: `Published but read-back failed${read.ok ? "" : `: ${read.providerMessage}`}` };
  }
  return { status: "verified", externalId: mediaId, retryable: false, data: read.data };
}

/**
 * Reconcile after an uncertain publish: a container whose status is PUBLISHED
 * was published; FINISHED means it was not (safe to publish that container).
 */
export async function reconcilePublish(
  call: GraphCall & { igUserId: string; containerId: string; caption: string },
): Promise<ReconcileResult<InstagramMedia>> {
  const status = await getContainerStatus(call);
  if (!status.ok) return { outcome: "unknown", providerMessage: status.providerMessage };
  if (status.data.statusCode === "FINISHED") return { outcome: "not_found" };
  if (status.data.statusCode !== "PUBLISHED") return { outcome: "unknown", providerMessage: `Container status ${status.data.statusCode}` };
  const url = new URL(`${INSTAGRAM_GRAPH_BASE}/${call.igUserId}/media`);
  url.searchParams.set("fields", "id,permalink,timestamp,media_type,caption");
  url.searchParams.set("limit", "25");
  const out = await graphGet(call, url);
  if (out.kind !== "ok") return { outcome: "unknown", providerMessage: "Container is PUBLISHED but recent media could not be listed." };
  const media = (isRecord(out.data) ? asArray(out.data.data) : []).filter(isRecord).map(parseMedia);
  const match = media.find((m) => m.caption === call.caption);
  return match ? { outcome: "found", externalId: match.id, data: match } : { outcome: "unknown", providerMessage: "Container is PUBLISHED but the media id could not be matched." };
}

export interface PublishImageResult extends WriteResult<InstagramMedia> {
  containerId?: string;
}

/** Full single-image publish. Requires an approval bound to the exact content. */
export async function publishImage(
  call: GraphCall & {
    post: ImagePostInput;
    approval: ApprovedAction | undefined;
    now?: number;
    maxPolls?: number;
    pollIntervalMs?: number;
    sleep?: (ms: number) => Promise<void>;
  },
): Promise<PublishImageResult> {
  const errors = validateImagePost(call.post);
  if (errors.length) return { status: "failed", retryable: false, providerMessage: errors.join(" ") };
  const refusal = approvalError(call.approval, { kind: PUBLISH_INSTAGRAM_ACTION, targetId: call.post.igUserId, value: await instagramApprovalValue(call.post) }, call.now);
  if (refusal) return { status: "failed", retryable: false, providerMessage: refusal };

  const account = await getAccount(call);
  if (!account.ok) return { status: "failed", retryable: account.retryable, providerMessage: `Could not check the Instagram account: ${account.providerMessage}` };
  if (!account.data.isProfessional) {
    return { status: "failed", retryable: false, providerMessage: "Instagram only allows publishing to Business or Creator accounts." };
  }

  const limit = await getPublishingLimit({ ...call, igUserId: call.post.igUserId });
  if (!limit.ok) return { status: "failed", retryable: limit.retryable, providerMessage: `Could not check the publishing limit: ${limit.providerMessage}` };
  if (limit.data.remaining !== undefined && limit.data.remaining <= 0) {
    return { status: "failed", retryable: true, providerMessage: "Instagram's publishing limit for this account has been reached; try again later." };
  }

  const container = await createImageContainer(call);
  if (container.status !== "verified" || !container.externalId) return container as PublishImageResult;
  const containerId = container.externalId;

  const poll = await pollContainerUntilReady({ ...call, containerId, maxPolls: call.maxPolls, intervalMs: call.pollIntervalMs, sleep: call.sleep });
  if (poll.outcome === "error" || poll.outcome === "expired") {
    return { status: "failed", containerId, retryable: false, providerMessage: `Instagram could not process the image (${poll.outcome}${poll.detail ? `: ${poll.detail}` : ""}).` };
  }
  if (poll.outcome === "timeout" || poll.outcome === "read_failed") {
    return { status: "failed", containerId, retryable: true, providerMessage: "Instagram is still processing the image; nothing was published. Check the container again later." };
  }
  if (poll.outcome === "published") {
    return { status: "uncertain", containerId, retryable: false, providerMessage: "Container already published; run reconcilePublish." };
  }
  const published = await publishContainer({ ...call, igUserId: call.post.igUserId, containerId });
  return { ...published, containerId };
}
