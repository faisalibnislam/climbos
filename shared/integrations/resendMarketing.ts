/**
 * Resend marketing on the customer's OWN Resend account (BYO API key).
 *
 * Resend renamed Audiences → Segments; this adapter uses /segments and the
 * global /contacts endpoints. Contacts are only synced with explicit
 * marketing-email consent, and every broadcast HTML must contain the
 * {{{RESEND_UNSUBSCRIBE_URL}}} placeholder.
 */

import { asArray, asString, collectPages, isRecord, readFailure, requestJson, writeFailure } from "./http";
import { RESEND_BASE } from "./registry";
import { approvalError, type AdapterOptions, type ApprovedAction, type PaginationResult, type ReadResult, type ReconcileResult, type WriteResult } from "./types";

export const RESEND_UNSUBSCRIBE_PLACEHOLDER = "{{{RESEND_UNSUBSCRIBE_URL}}}";
export const SEND_BROADCAST_ACTION = "resend_marketing.send_broadcast";

export interface ResendCall extends AdapterOptions {
  apiKey: string;
}

function headers(call: ResendCall): Record<string, string> {
  if (!/^re_[A-Za-z0-9_]+$/.test(call.apiKey)) throw new Error("Resend API keys start with re_");
  return { Authorization: `Bearer ${call.apiKey}` };
}

// ---------------------------------------------------------------------------
// Segments
// ---------------------------------------------------------------------------

export interface ResendSegment {
  id: string;
  name: string;
  createdAt?: string;
}

export async function listSegments(call: ResendCall & { maxPages?: number }): Promise<ReadResult<PaginationResult<ResendSegment>>> {
  return collectPages<ResendSegment>(
    async (cursor) => {
      const url = new URL(`${RESEND_BASE}/segments`);
      url.searchParams.set("limit", "100");
      if (cursor) url.searchParams.set("after", cursor);
      const out = await requestJson({ url: url.toString(), headers: headers(call), fetchImpl: call.fetchImpl, timeoutMs: call.timeoutMs });
      if (out.kind !== "ok") return readFailure(out);
      const d = isRecord(out.data) ? out.data : {};
      const items: ResendSegment[] = [];
      for (const s of asArray(d.data)) {
        if (!isRecord(s)) continue;
        const id = asString(s.id);
        if (id) items.push({ id, name: asString(s.name) ?? id, createdAt: asString(s.created_at) });
      }
      const last = items[items.length - 1];
      return { ok: true, data: { items, nextCursor: d.has_more === true && last ? last.id : undefined } };
    },
    { maxPages: call.maxPages ?? 10 },
  );
}

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

export interface MarketingConsent {
  purpose: string;
  /** Epoch ms. */
  grantedAt: number;
  /** Where consent was captured (form id, checkout checkbox, …). */
  source: string;
}

export interface MarketingContact {
  email: string;
  firstName?: string;
  lastName?: string;
  consent?: MarketingConsent;
  /** True if on ClimbOS's suppression list (bounce, complaint, manual). */
  suppressed: boolean;
  /** True if the person opted out anywhere we know about. */
  unsubscribed?: boolean;
  segmentIds?: string[];
}

const EMAIL_RE = /^[^\s@<>()[\],;:"]+@[^\s@<>()[\],;:"]+\.[^\s@<>()[\],;:"]{2,}$/;

/** Returns a refusal reason, or undefined when the contact may be synced. */
export function contactRefusalReason(c: MarketingContact): string | undefined {
  if (!EMAIL_RE.test(c.email.trim())) return "Email address is not valid.";
  if (!c.consent || c.consent.purpose !== "marketing_email") return "No marketing-email consent recorded for this contact.";
  if (!c.consent.source || !Number.isFinite(c.consent.grantedAt) || c.consent.grantedAt <= 0) return "Consent record is incomplete (source and time are required).";
  if (c.suppressed) return "Contact is on the suppression list.";
  if (c.unsubscribed) return "Contact has unsubscribed.";
  return undefined;
}

export interface ResendContactState {
  id: string;
  email: string;
  unsubscribed: boolean;
}

export async function getContact(call: ResendCall & { idOrEmail: string }): Promise<ReadResult<ResendContactState | null>> {
  const out = await requestJson({ url: `${RESEND_BASE}/contacts/${encodeURIComponent(call.idOrEmail)}`, headers: headers(call), fetchImpl: call.fetchImpl, timeoutMs: call.timeoutMs });
  if (out.kind === "http_error" && out.status === 404) return { ok: true, data: null };
  if (out.kind !== "ok") return readFailure(out);
  const d = isRecord(out.data) ? out.data : {};
  return { ok: true, data: { id: asString(d.id) ?? "", email: (asString(d.email) ?? "").toLowerCase(), unsubscribed: d.unsubscribed === true } };
}

/** Read the complete provider segment before send; a partial result is unsafe for audience reconciliation. */
export async function listSegmentContacts(call: ResendCall & { segmentId: string; maxPages?: number }): Promise<ReadResult<PaginationResult<ResendContactState>>> {
  if (!call.segmentId.trim()) return { ok: false, providerMessage: "A provider segment is required.", retryable: false };
  return collectPages<ResendContactState>(
    async (cursor) => {
      const url = new URL(`${RESEND_BASE}/segments/${encodeURIComponent(call.segmentId)}/contacts`);
      url.searchParams.set("limit", "100");
      if (cursor) url.searchParams.set("after", cursor);
      const out = await requestJson({ url: url.toString(), headers: headers(call), fetchImpl: call.fetchImpl, timeoutMs: call.timeoutMs });
      if (out.kind !== "ok") return readFailure(out);
      const d = isRecord(out.data) ? out.data : {};
      const items: ResendContactState[] = [];
      for (const entry of asArray(d.data)) {
        if (!isRecord(entry)) return { ok: false, providerMessage: "The email provider returned an unreadable segment member.", retryable: true };
        const id = asString(entry.id);
        const email = asString(entry.email)?.trim().toLowerCase();
        if (!id || !email || typeof entry.unsubscribed !== "boolean") {
          return { ok: false, providerMessage: "The email provider returned incomplete segment member details.", retryable: true };
        }
        items.push({ id, email, unsubscribed: entry.unsubscribed });
      }
      const last = items[items.length - 1];
      if (d.has_more === true && !last) return { ok: false, providerMessage: "The email provider reported another segment page without a usable cursor.", retryable: true };
      return { ok: true, data: { items, nextCursor: d.has_more === true ? last!.id : undefined } };
    },
    { maxPages: call.maxPages ?? 100 },
  );
}

/** Compare the approved local audience with active members of the provider segment, without returning addresses. */
export function compareSegmentRecipients(expectedEmails: Iterable<string>, segmentContacts: Iterable<ResendContactState>) {
  const expected = new Set([...expectedEmails].map((email) => email.trim().toLowerCase()).filter(Boolean));
  const actual = new Set([...segmentContacts].filter((contact) => !contact.unsubscribed).map((contact) => contact.email.trim().toLowerCase()).filter(Boolean));
  let missing = 0;
  let additional = 0;
  for (const email of expected) if (!actual.has(email)) missing++;
  for (const email of actual) if (!expected.has(email)) additional++;
  return { matches: missing === 0 && additional === 0, expectedCount: expected.size, actualCount: actual.size, missing, additional };
}

/**
 * Create or update a consented contact, add it to segments, then read it back.
 * Never sends `unsubscribed: false` — an opt-out made in Resend is never reversed.
 */
export async function upsertMarketingContact(call: ResendCall & { contact: MarketingContact }): Promise<WriteResult<ResendContactState>> {
  const refusal = contactRefusalReason(call.contact);
  if (refusal) return { status: "failed", retryable: false, providerMessage: `Refused: ${refusal}` };
  const email = call.contact.email.trim().toLowerCase();
  const segmentIds = call.contact.segmentIds ?? [];

  const existing = await getContact({ ...call, idOrEmail: email });
  if (!existing.ok) return { status: "failed", retryable: existing.retryable, providerMessage: `Could not check for an existing contact: ${existing.providerMessage}` };

  const nameFields: Record<string, string> = {};
  if (call.contact.firstName) nameFields.first_name = call.contact.firstName;
  if (call.contact.lastName) nameFields.last_name = call.contact.lastName;

  if (existing.data === null) {
    const out = await requestJson({
      url: `${RESEND_BASE}/contacts`,
      method: "POST",
      headers: headers(call),
      body: { email, ...nameFields, segments: segmentIds.map((id) => ({ id })) },
      fetchImpl: call.fetchImpl,
      timeoutMs: call.timeoutMs,
    });
    if (out.kind !== "ok") return writeFailure(out);
  } else {
    if (Object.keys(nameFields).length) {
      const out = await requestJson({
        url: `${RESEND_BASE}/contacts/${encodeURIComponent(email)}`,
        method: "PATCH",
        headers: headers(call),
        body: nameFields,
        fetchImpl: call.fetchImpl,
        timeoutMs: call.timeoutMs,
      });
      if (out.kind !== "ok") return writeFailure(out);
    }
    for (const segmentId of segmentIds) {
      const out = await requestJson({
        url: `${RESEND_BASE}/contacts/${encodeURIComponent(email)}/segments/${encodeURIComponent(segmentId)}`,
        method: "POST",
        headers: headers(call),
        fetchImpl: call.fetchImpl,
        timeoutMs: call.timeoutMs,
      });
      if (out.kind !== "ok") return writeFailure(out);
    }
  }

  const read = await getContact({ ...call, idOrEmail: email });
  if (!read.ok || read.data === null) {
    return { status: "uncertain", retryable: false, providerMessage: "Contact write sent but read-back did not find it; reconcile with getContact." };
  }
  const result: WriteResult<ResendContactState> = { status: "verified", externalId: read.data.id, retryable: false, data: read.data };
  if (read.data.unsubscribed) result.providerMessage = "Contact exists but has unsubscribed in Resend; they will not receive broadcasts.";
  return result;
}

// ---------------------------------------------------------------------------
// Broadcasts
// ---------------------------------------------------------------------------

/** Marketing HTML must link to the Resend unsubscribe placeholder. */
export function validateMarketingHtml(html: string): string[] {
  const errors: string[] = [];
  if (!html.trim()) errors.push("Email HTML is empty.");
  if (!html.includes(RESEND_UNSUBSCRIBE_PLACEHOLDER)) {
    errors.push(`Marketing email HTML must include an unsubscribe link using ${RESEND_UNSUBSCRIBE_PLACEHOLDER}.`);
  } else if (!/href\s*=\s*["']\s*\{\{\{RESEND_UNSUBSCRIBE_URL\}\}\}\s*["']/i.test(html)) {
    errors.push(`The ${RESEND_UNSUBSCRIBE_PLACEHOLDER} placeholder must be used as a link href.`);
  }
  return errors;
}

export interface BroadcastDraft {
  segmentId: string;
  from: string;
  subject: string;
  html: string;
  text?: string;
  /** Unique client-provided name; used as the reconcile key. */
  name: string;
  replyTo?: string;
  topicId?: string;
}

export interface BroadcastState {
  id: string;
  name?: string;
  status: string;
  segmentId?: string;
  scheduledAt?: string | null;
  sentAt?: string | null;
  html?: string;
}

function parseBroadcast(d: Record<string, unknown>): BroadcastState {
  const b: BroadcastState = { id: asString(d.id) ?? "", status: asString(d.status) ?? "" };
  const name = asString(d.name);
  if (name !== undefined) b.name = name;
  const seg = asString(d.segment_id) ?? asString(d.audience_id);
  if (seg) b.segmentId = seg;
  if (d.scheduled_at !== undefined) b.scheduledAt = asString(d.scheduled_at) ?? null;
  if (d.sent_at !== undefined) b.sentAt = asString(d.sent_at) ?? null;
  const html = asString(d.html);
  if (html !== undefined) b.html = html;
  return b;
}

export async function getBroadcast(call: ResendCall & { broadcastId: string }): Promise<ReadResult<BroadcastState>> {
  const out = await requestJson({ url: `${RESEND_BASE}/broadcasts/${encodeURIComponent(call.broadcastId)}`, headers: headers(call), fetchImpl: call.fetchImpl, timeoutMs: call.timeoutMs });
  if (out.kind !== "ok") return readFailure(out);
  return { ok: true, data: parseBroadcast(isRecord(out.data) ? out.data : {}) };
}

/** Create a DRAFT broadcast (send: false) and verify it reads back as draft. */
export async function createDraftBroadcast(call: ResendCall & { draft: BroadcastDraft }): Promise<WriteResult<BroadcastState>> {
  const d = call.draft;
  const errors = validateMarketingHtml(d.html);
  if (!d.segmentId) errors.push("A segment is required.");
  if (!d.from.trim()) errors.push("A from address is required.");
  if (!d.subject.trim()) errors.push("A subject is required.");
  if (!d.name.trim()) errors.push("A unique broadcast name is required.");
  if (errors.length) return { status: "failed", retryable: false, providerMessage: errors.join(" ") };
  const body: Record<string, unknown> = { segment_id: d.segmentId, from: d.from, subject: d.subject, html: d.html, name: d.name, send: false };
  if (d.text !== undefined) body.text = d.text;
  if (d.replyTo) body.reply_to = d.replyTo;
  if (d.topicId) body.topic_id = d.topicId;
  const out = await requestJson({ url: `${RESEND_BASE}/broadcasts`, method: "POST", headers: headers(call), body, fetchImpl: call.fetchImpl, timeoutMs: call.timeoutMs });
  if (out.kind !== "ok") return writeFailure(out);
  const id = isRecord(out.data) ? asString(out.data.id) : undefined;
  if (!id) return { status: "uncertain", retryable: false, providerMessage: "No broadcast id returned; reconcile by name." };
  const read = await getBroadcast({ ...call, broadcastId: id });
  if (!read.ok) return { status: "uncertain", externalId: id, retryable: false, providerMessage: `Created but read-back failed: ${read.providerMessage}` };
  if (read.data.status !== "draft") return { status: "uncertain", externalId: id, retryable: false, providerMessage: `Expected draft, read-back shows ${read.data.status}.`, data: read.data };
  return { status: "verified", externalId: id, retryable: false, data: read.data };
}

export async function reconcileBroadcastByName(call: ResendCall & { name: string; maxPages?: number }): Promise<ReconcileResult<BroadcastState>> {
  const res = await collectPages<BroadcastState>(
    async (cursor) => {
      const url = new URL(`${RESEND_BASE}/broadcasts`);
      url.searchParams.set("limit", "100");
      if (cursor) url.searchParams.set("after", cursor);
      const out = await requestJson({ url: url.toString(), headers: headers(call), fetchImpl: call.fetchImpl, timeoutMs: call.timeoutMs });
      if (out.kind !== "ok") return readFailure(out);
      const d = isRecord(out.data) ? out.data : {};
      const items = asArray(d.data).filter(isRecord).map(parseBroadcast);
      const last = items[items.length - 1];
      return { ok: true, data: { items, nextCursor: d.has_more === true && last ? last.id : undefined } };
    },
    { maxPages: call.maxPages ?? 5 },
  );
  if (!res.ok) return { outcome: "unknown", providerMessage: res.providerMessage };
  const match = res.data.items.find((b) => b.name === call.name);
  if (match) return { outcome: "found", externalId: match.id, data: match };
  return res.data.truncated ? { outcome: "unknown", providerMessage: "Not found in the pages checked." } : { outcome: "not_found" };
}

const SENT_STATES = new Set(["scheduled", "queued", "sending", "sent"]);

/**
 * Send now (scheduledAt undefined) or schedule a draft broadcast. Requires an
 * approval for exactly this broadcast and timing ("now" or the scheduledAt string).
 * Refuses if the broadcast is not a draft (prevents double sends).
 */
export async function sendBroadcast(
  call: ResendCall & { broadcastId: string; scheduledAt?: string; approval: ApprovedAction | undefined; now?: number },
): Promise<WriteResult<BroadcastState>> {
  const refusal = approvalError(call.approval, { kind: SEND_BROADCAST_ACTION, targetId: call.broadcastId, value: call.scheduledAt ?? "now" }, call.now);
  if (refusal) return { status: "failed", retryable: false, providerMessage: refusal };

  const before = await getBroadcast(call);
  if (!before.ok) return { status: "failed", retryable: before.retryable, providerMessage: `Could not read the broadcast: ${before.providerMessage}` };
  if (before.data.status !== "draft") {
    return { status: "failed", retryable: false, externalId: call.broadcastId, providerMessage: `Broadcast is already ${before.data.status}; not sending again.`, data: before.data };
  }
  if (before.data.html !== undefined) {
    const htmlErrors = validateMarketingHtml(before.data.html);
    if (htmlErrors.length) return { status: "failed", retryable: false, providerMessage: htmlErrors.join(" ") };
  }

  const body: Record<string, unknown> = {};
  if (call.scheduledAt) body.scheduled_at = call.scheduledAt;
  const out = await requestJson({
    url: `${RESEND_BASE}/broadcasts/${encodeURIComponent(call.broadcastId)}/send`,
    method: "POST",
    headers: headers(call),
    body,
    fetchImpl: call.fetchImpl,
    timeoutMs: call.timeoutMs,
  });
  if (out.kind !== "ok") {
    const failure = writeFailure<BroadcastState>(out);
    return { ...failure, externalId: call.broadcastId };
  }
  return reconcileBroadcastSend(call);
}

/** Read the broadcast status: anything past "draft" means the send was accepted. */
export async function reconcileBroadcastSend(call: ResendCall & { broadcastId: string }): Promise<WriteResult<BroadcastState>> {
  const read = await getBroadcast(call);
  if (!read.ok) return { status: "uncertain", externalId: call.broadcastId, retryable: false, providerMessage: `Read-back failed: ${read.providerMessage}` };
  if (SENT_STATES.has(read.data.status)) return { status: "verified", externalId: call.broadcastId, retryable: false, data: read.data };
  return { status: "uncertain", externalId: call.broadcastId, retryable: false, providerMessage: `Broadcast status is ${read.data.status}.`, data: read.data };
}
