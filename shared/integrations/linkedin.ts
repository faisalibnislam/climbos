/**
 * LinkedIn member posts (versioned REST Posts API + Images API).
 * Scopes: openid, profile (who you are), w_member_social (post as you).
 *
 * Read-back (GET /rest/posts/{urn}) needs r_member_social, which LinkedIn
 * restricts to approved apps. Without it the post is created but we can't
 * confirm it, so the outcome is "uncertain" rather than "verified".
 */

import { asArray, asString, contentFingerprint, isRecord, readFailure, requestJson, resolveFetch, writeFailure, type HttpOutcome } from "./http";
import { LINKEDIN_API_VERSION, LINKEDIN_REST_BASE, LINKEDIN_USERINFO_URL } from "./registry";
import { validateResearchUrl } from "./website";
import { approvalError, type AdapterOptions, type ApprovedAction, type ReadResult, type ReconcileResult, type WriteResult } from "./types";

export const LINKEDIN_POST_MAX_CHARS = 3000;
export const LINKEDIN_ALT_TEXT_MAX_CHARS = 4086;
export const LINKEDIN_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const PUBLISH_LINKEDIN_ACTION = "linkedin.publish_post";
const PERSON_URN_RE = /^urn:li:person:[A-Za-z0-9_-]+$/;
const ORGANIZATION_URN_RE = /^urn:li:organization:\d+$/;

/** A post author: the member themself, or a LinkedIn Page (organization) they administer. */
export function isLinkedInAuthorUrn(urn: string): boolean {
  return PERSON_URN_RE.test(urn) || ORGANIZATION_URN_RE.test(urn);
}
const POST_URN_RE = /^urn:li:(share|ugcPost):\d+$/;

export interface LinkedInCall extends AdapterOptions {
  accessToken: string;
}

export function linkedInHeaders(call: LinkedInCall): Record<string, string> {
  return { Authorization: `Bearer ${call.accessToken}`, "LinkedIn-Version": LINKEDIN_API_VERSION, "X-Restli-Protocol-Version": "2.0.0" };
}

function reconnectMessage(): string {
  return "LinkedIn sign-in expired or was revoked. Reconnect LinkedIn.";
}

export function linkedInWriteFailure<T = undefined>(outcome: Exclude<HttpOutcome, { kind: "ok" }>): WriteResult<T> {
  if (outcome.kind === "http_error" && outcome.status === 401) return { status: "failed", retryable: false, providerMessage: reconnectMessage() };
  return writeFailure<T>(outcome);
}

export interface LinkedInMember {
  /** OIDC subject = LinkedIn member id. */
  id: string;
  personUrn: string;
  name: string;
}

/** OIDC userinfo: who signed in. Needs openid + profile. */
export async function getMember(call: LinkedInCall): Promise<ReadResult<LinkedInMember>> {
  const out = await requestJson({ url: LINKEDIN_USERINFO_URL, headers: { Authorization: `Bearer ${call.accessToken}` }, fetchImpl: call.fetchImpl, timeoutMs: call.timeoutMs });
  if (out.kind !== "ok") return readFailure(out);
  const d = isRecord(out.data) ? out.data : {};
  const sub = asString(d.sub);
  if (!sub) return { ok: false, providerMessage: "LinkedIn returned no member id", retryable: false };
  const name = asString(d.name) ?? [asString(d.given_name), asString(d.family_name)].filter(Boolean).join(" ");
  return { ok: true, data: { id: sub, personUrn: `urn:li:person:${sub}`, name: name || "LinkedIn member" } };
}

export interface LinkedInOrganization {
  id: string;
  urn: string;
  name: string;
  vanityName?: string;
}

/**
 * LinkedIn Pages the member administers: organizationAcls (approved ADMINISTRATOR
 * roles), then one organization lookup each for the Page name. Needs
 * rw_organization_admin (Community Management API product).
 */
export async function listAdministeredOrganizations(call: LinkedInCall & { max?: number }): Promise<ReadResult<{ items: LinkedInOrganization[]; truncated: boolean }>> {
  const max = Math.max(1, Math.min(call.max ?? 25, 50));
  const url = `${LINKEDIN_REST_BASE}/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED&count=${max}`;
  const out = await requestJson({ url, headers: linkedInHeaders(call), fetchImpl: call.fetchImpl, timeoutMs: call.timeoutMs });
  if (out.kind !== "ok") return readFailure(out);
  const d = isRecord(out.data) ? out.data : {};
  const ids: string[] = [];
  for (const el of asArray(d.elements)) {
    if (!isRecord(el)) continue;
    const id = (asString(el.organization) ?? asString(el.organizationTarget))?.match(/^urn:li:organization:(\d+)$/)?.[1];
    if (id && !ids.includes(id)) ids.push(id);
  }
  const items = await Promise.all(
    ids.slice(0, max).map(async (id): Promise<LinkedInOrganization> => {
      const org: LinkedInOrganization = { id, urn: `urn:li:organization:${id}`, name: `LinkedIn Page ${id}` };
      const res = await requestJson({ url: `${LINKEDIN_REST_BASE}/organizations/${id}`, headers: linkedInHeaders(call), fetchImpl: call.fetchImpl, timeoutMs: call.timeoutMs });
      if (res.kind === "ok" && isRecord(res.data)) {
        const name = asString(res.data.localizedName);
        if (name) org.name = name;
        const vanity = asString(res.data.vanityName);
        if (vanity) org.vanityName = vanity;
      }
      return org;
    }),
  );
  const paging = isRecord(d.paging) ? d.paging : {};
  const total = typeof paging.total === "number" ? paging.total : ids.length;
  return { ok: true, data: { items, truncated: total > items.length } };
}

const RESERVED = /[\\|{}@[\]()<>#*_~]/g;

/**
 * Plain text → LinkedIn "little" commentary: every reserved character is
 * backslash-escaped, except a # that starts a hashtag (kept so it links).
 */
export function toLittleText(text: string): string {
  return text.replace(RESERVED, (ch, offset: number, whole: string) => {
    if (ch === "#" && /[\p{L}\p{N}_]/u.test(whole.charAt(offset + 1)) && (offset === 0 || /\s/.test(whole.charAt(offset - 1)))) return ch;
    return `\\${ch}`;
  });
}

/** Read-back commentary → plain text: hashtag templates and escapes undone. */
export function fromLittleText(commentary: string): string {
  return commentary.replace(/\{hashtag\|\\?([#＃])\|([^}]*)\}/g, "$1$2").replace(/\\([\\|{}@[\]()<>#*_~])/g, "$1");
}

export interface LinkedInPostInput {
  authorUrn: string;
  text: string;
  /** Publicly reachable https image (JPG/PNG/GIF) → image post. */
  imageUrl?: string;
  altText?: string;
}

export function validateLinkedInPost(p: LinkedInPostInput): string[] {
  const errors: string[] = [];
  if (!isLinkedInAuthorUrn(p.authorUrn)) errors.push("Invalid LinkedIn profile or Page id. Reconnect LinkedIn.");
  if (!p.text.trim() && !p.imageUrl) errors.push("A post needs text or an image.");
  if ([...p.text].length > LINKEDIN_POST_MAX_CHARS) errors.push(`LinkedIn posts can be at most ${LINKEDIN_POST_MAX_CHARS} characters.`);
  if (p.altText !== undefined && [...p.altText].length > LINKEDIN_ALT_TEXT_MAX_CHARS) errors.push(`Alt text is longer than ${LINKEDIN_ALT_TEXT_MAX_CHARS} characters.`);
  if (p.imageUrl) {
    const v = validateResearchUrl(p.imageUrl);
    if (!v.ok) errors.push(`Image URL is not a safe public URL: ${v.reason}`);
    else if (!v.url.startsWith("https://")) errors.push("Image URL must use https.");
  }
  return errors;
}

export function linkedInApprovalValue(p: LinkedInPostInput): Promise<string> {
  return contentFingerprint(p.authorUrn, p.text, p.imageUrl, p.altText);
}

/** Exact Posts API body (commentary in little format). */
export function buildPostBody(p: LinkedInPostInput, imageUrn?: string): Record<string, unknown> {
  const body: Record<string, unknown> = {
    author: p.authorUrn,
    commentary: toLittleText(p.text),
    visibility: "PUBLIC",
    distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };
  if (imageUrn) body.content = { media: { id: imageUrn, ...(p.altText ? { altText: p.altText } : {}) } };
  return body;
}

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif"]);

async function fetchBytes(call: AdapterOptions, url: string, init: RequestInit): Promise<Response | { error: string; timedOut: boolean }> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, call.timeoutMs ?? 30_000);
  try {
    return await resolveFetch(call.fetchImpl)(url, { ...init, signal: controller.signal });
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err), timedOut };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Upload an image for a member: download it, initializeUpload, PUT the bytes.
 * Nothing is visible on LinkedIn until a post references the image, so any
 * failure here means nothing was posted.
 */
export async function uploadImage(call: LinkedInCall & { ownerUrn: string; imageUrl: string }): Promise<ReadResult<{ imageUrn: string }>> {
  const v = validateResearchUrl(call.imageUrl);
  if (!v.ok || !v.url.startsWith("https://")) return { ok: false, providerMessage: "Image URL must be a public https URL.", retryable: false };
  const img = await fetchBytes(call, v.url, { method: "GET", redirect: "follow" });
  if (!(img instanceof Response)) return { ok: false, providerMessage: `Couldn't download the image: ${img.error}`, retryable: true };
  if (!img.ok) return { ok: false, providerMessage: `Couldn't download the image (HTTP ${img.status}).`, retryable: img.status >= 500 };
  const type = (img.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (!IMAGE_TYPES.has(type)) return { ok: false, providerMessage: "LinkedIn accepts JPG, PNG or GIF images only.", retryable: false };
  const bytes = new Uint8Array(await img.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > LINKEDIN_IMAGE_MAX_BYTES) return { ok: false, providerMessage: "The image is empty or larger than 10 MB.", retryable: false };

  const init = await requestJson({
    url: `${LINKEDIN_REST_BASE}/images?action=initializeUpload`,
    method: "POST",
    headers: linkedInHeaders(call),
    body: { initializeUploadRequest: { owner: call.ownerUrn } },
    fetchImpl: call.fetchImpl,
    timeoutMs: call.timeoutMs,
  });
  if (init.kind !== "ok") return readFailure(init);
  const value = isRecord(init.data) && isRecord(init.data.value) ? init.data.value : {};
  const uploadUrl = asString(value.uploadUrl);
  const imageUrn = asString(value.image);
  if (!uploadUrl || !imageUrn || !uploadUrl.startsWith("https://")) return { ok: false, providerMessage: "LinkedIn didn't return an upload URL.", retryable: true };

  const put = await fetchBytes(call, uploadUrl, { method: "PUT", headers: { Authorization: `Bearer ${call.accessToken}`, "Content-Type": type }, body: bytes });
  if (!(put instanceof Response)) return { ok: false, providerMessage: `Image upload to LinkedIn failed: ${put.error}`, retryable: true };
  if (!put.ok) return { ok: false, status: put.status, providerMessage: `Image upload to LinkedIn failed (HTTP ${put.status}).`, retryable: put.status === 429 || put.status >= 500 };
  return { ok: true, data: { imageUrn } };
}

export interface LinkedInPostState {
  id: string;
  /** Read-back commentary converted to plain text. */
  text: string;
  lifecycleState?: string;
  author?: string;
}

function parsePost(d: Record<string, unknown>): LinkedInPostState {
  const p: LinkedInPostState = { id: asString(d.id) ?? "", text: fromLittleText(asString(d.commentary) ?? "") };
  const ls = asString(d.lifecycleState);
  if (ls) p.lifecycleState = ls;
  const a = asString(d.author);
  if (a) p.author = a;
  return p;
}

export async function getPost(call: LinkedInCall & { postUrn: string }): Promise<ReadResult<LinkedInPostState>> {
  if (!POST_URN_RE.test(call.postUrn)) return { ok: false, providerMessage: "Invalid post id", retryable: false };
  const out = await requestJson({
    url: `${LINKEDIN_REST_BASE}/posts/${encodeURIComponent(call.postUrn)}?viewContext=AUTHOR`,
    headers: linkedInHeaders(call),
    fetchImpl: call.fetchImpl,
    timeoutMs: call.timeoutMs,
  });
  if (out.kind !== "ok") return readFailure(out);
  return { ok: true, data: parsePost(isRecord(out.data) ? out.data : {}) };
}

function sameText(a: string, b: string): boolean {
  return a.normalize("NFC").trim() === b.normalize("NFC").trim();
}

/**
 * Publish a member post, then read it back. "verified" only when the read-back
 * text matches. Read-back 404/403 → "uncertain" (the post id is kept).
 */
export async function publishPost(call: LinkedInCall & { post: LinkedInPostInput; approval: ApprovedAction | undefined; now?: number }): Promise<WriteResult<LinkedInPostState>> {
  const errors = validateLinkedInPost(call.post);
  if (errors.length) return { status: "failed", retryable: false, providerMessage: errors.join(" ") };
  const refusal = approvalError(call.approval, { kind: PUBLISH_LINKEDIN_ACTION, targetId: call.post.authorUrn, value: await linkedInApprovalValue(call.post) }, call.now);
  if (refusal) return { status: "failed", retryable: false, providerMessage: refusal };

  let imageUrn: string | undefined;
  if (call.post.imageUrl) {
    const up = await uploadImage({ ...call, ownerUrn: call.post.authorUrn, imageUrl: call.post.imageUrl });
    if (!up.ok) {
      if (up.status === 401) return { status: "failed", retryable: false, providerMessage: reconnectMessage() };
      return { status: "failed", retryable: up.retryable, providerMessage: `Nothing was posted: ${up.providerMessage}` };
    }
    imageUrn = up.data.imageUrn;
  }

  const out = await requestJson({
    url: `${LINKEDIN_REST_BASE}/posts`,
    method: "POST",
    headers: linkedInHeaders(call),
    body: buildPostBody(call.post, imageUrn),
    fetchImpl: call.fetchImpl,
    timeoutMs: call.timeoutMs,
  });
  if (out.kind !== "ok") return linkedInWriteFailure(out);
  const postUrn = out.headers.get("x-restli-id") ?? out.headers.get("x-linkedin-id") ?? undefined;
  if (!postUrn) return { status: "uncertain", retryable: false, providerMessage: "LinkedIn accepted the post but returned no id; check your profile before retrying." };

  const read = await getPost({ ...call, postUrn });
  if (!read.ok) {
    const why = read.status === 403 ? "LinkedIn doesn't let ClimbOS read member posts back" : read.status === 404 ? "LinkedIn couldn't find it yet" : read.providerMessage;
    return { status: "uncertain", externalId: postUrn, retryable: false, providerMessage: `Accepted by LinkedIn (${postUrn}) but not confirmed: ${why}. Check your profile.` };
  }
  if (!sameText(read.data.text, call.post.text)) {
    return { status: "uncertain", externalId: postUrn, retryable: false, providerMessage: "Read-back text differs from what was sent.", data: read.data };
  }
  return { status: "verified", externalId: postUrn, retryable: false, data: read.data };
}

/**
 * Reconcile after "uncertain": read the known post id, else look for a recent
 * post by the author with the same text (both need r_member_social).
 */
export async function reconcilePost(
  call: LinkedInCall & { authorUrn: string; text: string; postUrn?: string },
): Promise<ReconcileResult<LinkedInPostState>> {
  if (call.postUrn) {
    const read = await getPost({ ...call, postUrn: call.postUrn });
    if (read.ok) return { outcome: "found", externalId: call.postUrn, data: read.data };
    // LinkedIn gave us an id on create, so a 404 isn't proof it wasn't posted.
    return { outcome: "unknown", providerMessage: read.providerMessage };
  }
  const url = new URL(`${LINKEDIN_REST_BASE}/posts`);
  url.searchParams.set("author", call.authorUrn);
  url.searchParams.set("q", "author");
  url.searchParams.set("count", "20");
  url.searchParams.set("sortBy", "CREATED");
  const out = await requestJson({ url: url.toString(), headers: { ...linkedInHeaders(call), "X-RestLi-Method": "FINDER" }, fetchImpl: call.fetchImpl, timeoutMs: call.timeoutMs });
  if (out.kind !== "ok") return { outcome: "unknown", providerMessage: out.message };
  const posts = (isRecord(out.data) ? asArray(out.data.elements) : []).filter(isRecord).map(parsePost);
  const match = posts.find((p) => sameText(p.text, call.text));
  return match ? { outcome: "found", externalId: match.id, data: match } : { outcome: "not_found" };
}
