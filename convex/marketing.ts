import { reconcileProgressJourneys } from "./lib/progressJourneys";
import { checkedJourneyStep, journeyRecipientEvidence, journeyStepRefV, recordJourneyAcceptance, type JourneyStepRef } from "./lib/customerJourneys";
import { customerProgressStateV, customerProgressRuleV } from "./lib/customerProgress";
import { progressScopeKey, validProgressDate, normalizeProgressRule, progressEligibility, type CustomerProgressRule } from "../shared/growth/customerProgress";
import { emailReadinessValidator, recordedEmailReadiness } from "./lib/emailReadiness";
import { emailSenderDomain, type EmailSenderReadiness } from "../shared/growth/emailReadiness";
import { checkContactFrequency, frequencyBlockMessage, type ContactHistory } from "../shared/growth/contactFrequency";
import { outreachHistoryByHash, pendingMarketingRecipients, reviewContactHistory } from "./lib/contactPressure";
import { marketingContactRows, recordedMarketingConsent, MAX_MARKETING_CONTACTS } from "./lib/marketingAudience";
import { v } from "convex/values";
import { requirePaid } from "./lib/access";
import { parseCsv } from "../shared/integrations/csvRevenue";
import {
  checkSenderDomain,
  contactRefusalReason,
  compareSegmentRecipients,
  createDraftBroadcast,
  getBroadcast,
  broadcastPayload,
  type BroadcastDraft,
  listSegmentContacts,
  listSegments,
  RESEND_UNSUBSCRIBE_PLACEHOLDER,
  SEND_BROADCAST_ACTION,
  sendBroadcast,
  upsertMarketingContact,
} from "../shared/integrations/resendMarketing";
import { approvalHash, can, canonicalJson, checkApprovalForExecution, sha256Hex } from "../shared/policy";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { action, internalAction, internalMutation, internalQuery, mutation, query, type QueryCtx, type MutationCtx } from "./_generated/server";
import { decideReservation, releaseReservation } from "../shared/economics/ledger";
import { activePolicyVersion } from "./jobWrites";
import { audit } from "./lib/audit";
import { chargeableAccess } from "./lib/access";
import { decryptSecret, encryptSecret } from "./lib/crypto";
import { ledgerOf, ledgerPatch } from "./lib/periods";
import { appError, assertSameOrg, requireOrgAccess } from "./lib/tenancy";

/**
 * Customer email marketing through the customer's OWN email provider (Resend,
 * BYO key). ClimbOS never infers consent: only contacts imported with an
 * explicit marketing consent record (source + time) can be sent to, suppressed
 * addresses are always excluded, every send needs an approval bound to the
 * exact email, segment and recipient count, and the unsubscribe link is mandatory.
 */

const MAX_CONTACT_ROWS = MAX_MARKETING_CONTACTS;
const EMAIL_RE = /^[^\s@<>()[\],;:"]+@[^\s@<>()[\],;:"]+\.[^\s@<>()[\],;:"]{2,}$/;

function contactAad(orgId: string) {
  return `contact:${orgId}`;
}

const contactRowValidator = v.object({
  emailHash: v.string(),
  emailCiphertext: v.string(),
  emailIv: v.string(),
  emailDomain: v.string(),
  displayName: v.optional(v.string()),
  segment: v.string(),
  consent: v.optional(v.object({ source: v.string(), capturedAt: v.number() })),
});

export const insertContacts = internalMutation({
  args: { orgId: v.id("organizations"), rows: v.array(contactRowValidator) },
  handler: async (ctx, { orgId, rows }) => {
    let inserted = 0;
    let updated = 0;
    for (const r of rows) {
      const existing = await ctx.db
        .query("contacts")
        .withIndex("by_org_email", (q) => q.eq("orgId", orgId).eq("emailHash", r.emailHash))
        .first();
      let contactId: Id<"contacts">;
      if (existing) {
        contactId = existing._id;
        const segments = existing.segments.includes(r.segment) ? existing.segments : [...existing.segments, r.segment].slice(0, 20);
        await ctx.db.patch(existing._id, { segments, displayName: existing.displayName ?? r.displayName, deletedAt: undefined });
        updated++;
      } else {
        contactId = await ctx.db.insert("contacts", {
          orgId,
          emailHash: r.emailHash,
          emailCiphertext: r.emailCiphertext,
          emailIv: r.emailIv,
          emailDomain: r.emailDomain,
          displayName: r.displayName,
          source: "csv_import",
          segments: [r.segment],
          createdAt: Date.now(),
        });
        inserted++;
      }
      if (r.consent) {
        const prior = await ctx.db
          .query("consentRecords")
          .withIndex("by_org_contact", (q) => q.eq("orgId", orgId).eq("contactId", contactId))
          .take(10);
        if (!prior.some((p) => p.purpose === "marketing_email" && !p.withdrawnAt)) {
          await ctx.db.insert("consentRecords", {
            orgId,
            contactId,
            purpose: "marketing_email",
            basis: "opt_in",
            source: r.consent.source.slice(0, 200),
            evidence: "Imported by the workspace owner with a recorded opt-in source and date.",
            capturedAt: r.consent.capturedAt,
          });
        }
      }
    }
    return { inserted, updated };
  },
});

/** Look up one known contact; never expose the tenant's raw contact list. */
export const contactProgress = query({
  args: { slug: v.string(), email: v.string() },
  handler: async (ctx, { slug, email }) => {
    const { org, role } = await requireOrgAccess(ctx, { slug }, "view");
    const clean = email.trim().toLowerCase();
    if (!EMAIL_RE.test(clean)) throw appError("INVALID", "Enter the contact's email address.");
    const hash = await sha256Hex(clean);
    const matches = await ctx.db.query("contacts").withIndex("by_org_email", q => q.eq("orgId", org._id).eq("emailHash", hash)).take(2);
    if (matches.length !== 1 || matches[0].deletedAt !== undefined) return null;
    const contact = matches[0];
    const record = await ctx.db.query("contactProgress").withIndex("by_org_contact", q => q.eq("orgId", org._id).eq("contactId", contact._id)).unique();
    return { contactId: contact._id, name: contact.displayName ?? "Uploaded contact", canEdit: can(role, "manage_connections"), progress: record?.progress ?? { current: [], history: [], revision: 0 } };
  },
});

/** Explicit owner observation/correction only. This cannot enroll, schedule or contact anybody. */
export const recordContactProgress = mutation({
  args: { slug: v.string(), contactId: v.id("contacts"), expectedRevision: v.number(), scope: v.string(), state: customerProgressStateV, criterion: v.string(), evidence: v.string(), observedOn: v.string() },
  handler: async (ctx, args) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: args.slug }, "manage_connections");
    const contact = assertSameOrg(await ctx.db.get(args.contactId), org._id, "contact");
    if (contact.deletedAt !== undefined) throw appError("NOT_FOUND", "This contact was deleted.");
    const record = await ctx.db.query("contactProgress").withIndex("by_org_contact", q => q.eq("orgId", org._id).eq("contactId", contact._id)).unique();
    const previous = record?.progress ?? { current: [], history: [], revision: 0 };
    if (!Number.isSafeInteger(args.expectedRevision) || args.expectedRevision !== previous.revision) throw appError("INVALID", "This contact's progress changed. Look up the contact again before saving.");
    const scope = args.scope.normalize("NFC").trim().replace(/\s+/g, " ");
    const criterion = args.criterion.trim(), evidence = args.evidence.trim();
    if (!scope || scope.length > 80 || !criterion || criterion.length > 300 || !evidence || evidence.length > 500 || !validProgressDate(args.observedOn, Date.now())) throw appError("INVALID", "Add a product or journey (up to 80 characters), a definition (300), evidence (500), and a valid observation date no later than today in UTC.");
    const key = progressScopeKey(scope);
    const existing = previous.current.find(r => progressScopeKey(r.scope) === key);
    if (!existing && previous.current.length >= 20) throw appError("LIMIT_REACHED", "This contact already has 20 product or journey scopes. Review an existing scope.");
    const revision = previous.revision + 1;
    const report = { scope: existing?.scope ?? scope, state: args.state, criterion, evidence, observedOn: args.observedOn, recordedAt: Date.now(), recordedBy: user._id, revision };
    const progress = { current: [...previous.current.filter(r => progressScopeKey(r.scope) !== key), report], history: [...previous.history, report].slice(-20), revision };
    if (record) await ctx.db.patch(record._id, { progress });
    else await ctx.db.insert("contactProgress", { orgId: org._id, contactId: contact._id, progress });
    await reconcileProgressJourneys(ctx, org._id, contact._id, progress);
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "contact.progress_recorded", subjectType: "contact", subjectId: contact._id, summary: `Owner recorded customer progress, revision ${revision}. No message, enrollment or consent change.` });
    return progress;
  },
});

/** Import owned contacts from CSV: email, first_name, last_name, consent, consent_source, consent_date, segment. */
export const importContacts = action({
  args: { slug: v.string(), csv: v.string() },
  handler: async (ctx, { slug, csv }): Promise<{ imported: number; updated: number; withConsent: number; withoutConsent: number; invalid: { row: number; message: string }[]; fatal?: string }> => {
    const access = await ctx.runQuery(internal.access.orgAccessForAction, { slug, permission: "manage_connections" });
    if (!access) throw appError("NOT_FOUND", "We couldn't find that workspace.");
    if (csv.length > 5_000_000) return { imported: 0, updated: 0, withConsent: 0, withoutConsent: 0, invalid: [], fatal: "File is larger than 5 MB." };
    const parsed = parseCsv(csv, MAX_CONTACT_ROWS + 1);
    if (!parsed.ok) return { imported: 0, updated: 0, withConsent: 0, withoutConsent: 0, invalid: [], fatal: `Couldn't read the file (line ${parsed.line}): ${parsed.error}` };
    const [header, ...records] = parsed.records;
    const col = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name);
    const iEmail = col("email");
    if (iEmail < 0) return { imported: 0, updated: 0, withConsent: 0, withoutConsent: 0, invalid: [], fatal: "The file needs an 'email' column." };
    if (records.length > MAX_CONTACT_ROWS) return { imported: 0, updated: 0, withConsent: 0, withoutConsent: 0, invalid: [], fatal: `Up to ${MAX_CONTACT_ROWS.toLocaleString()} contacts per file.` };
    const [iFirst, iLast, iConsent, iSource, iDate, iSegment] = ["first_name", "last_name", "consent", "consent_source", "consent_date", "segment"].map(col);
    const invalid: { row: number; message: string }[] = [];
    const rows: { emailHash: string; emailCiphertext: string; emailIv: string; emailDomain: string; displayName?: string; segment: string; consent?: { source: string; capturedAt: number } }[] = [];
    const seen = new Set<string>();
    let withConsent = 0;
    for (const [idx, r] of records.entries()) {
      const email = (r[iEmail] ?? "").trim().toLowerCase();
      if (!EMAIL_RE.test(email)) {
        invalid.push({ row: idx + 1, message: "Not a valid email address" });
        continue;
      }
      const hash = await sha256Hex(email);
      if (seen.has(hash)) continue;
      seen.add(hash);
      const consentYes = iConsent >= 0 && /^(yes|y|true|1|opted[_ -]?in)$/i.test((r[iConsent] ?? "").trim());
      const source = iSource >= 0 ? (r[iSource] ?? "").trim() : "";
      const date = iDate >= 0 ? Date.parse((r[iDate] ?? "").trim()) : Number.NaN;
      // Consent is never inferred: it needs an explicit yes plus where and when it was given.
      const consent = consentYes && source && Number.isFinite(date) && date <= Date.now() ? { source, capturedAt: date } : undefined;
      if (consentYes && !consent) invalid.push({ row: idx + 1, message: "Consent marked yes but source or date is missing; imported without consent" });
      if (consent) withConsent++;
      const enc = await encryptSecret(email, contactAad(access.orgId));
      rows.push({
        emailHash: hash,
        emailCiphertext: enc.ciphertext,
        emailIv: `${enc.keyId}:${enc.iv}`,
        emailDomain: email.split("@")[1],
        displayName: [iFirst >= 0 ? r[iFirst] : "", iLast >= 0 ? r[iLast] : ""].filter(Boolean).join(" ").trim().slice(0, 80) || undefined,
        segment: (iSegment >= 0 ? (r[iSegment] ?? "").trim() : "") || "all",
        consent,
      });
    }
    let imported = 0;
    let updated = 0;
    for (let i = 0; i < rows.length; i += 400) {
      const res = await ctx.runMutation(internal.marketing.insertContacts, { orgId: access.orgId, rows: rows.slice(i, i + 400) });
      imported += res.inserted;
      updated += res.updated;
    }
    await ctx.runMutation(internal.marketing.markCrmConnected, { orgId: access.orgId, userId: access.userId, count: imported + updated });
    return { imported, updated, withConsent, withoutConsent: rows.length - withConsent, invalid: invalid.slice(0, 50) };
  },
});

export const markCrmConnected = internalMutation({
  args: { orgId: v.id("organizations"), userId: v.id("users"), count: v.number() },
  handler: async (ctx, { orgId, userId, count }) => {
    const existing = await ctx.db
      .query("connections")
      .withIndex("by_org_provider", (q) => q.eq("orgId", orgId).eq("provider", "crm_csv"))
      .first();
    const now = Date.now();
    if (existing) await ctx.db.patch(existing._id, { status: "connected", lastSyncAt: now, updatedAt: now });
    else await ctx.db.insert("connections", { orgId, provider: "crm_csv", status: "connected", accountLabel: "Uploaded contacts", scopes: [], isFixture: false, lastSyncAt: now, createdBy: userId, createdAt: now, updatedAt: now });
    await audit(ctx, { orgId, actorType: "user", actorId: userId, action: "contacts.imported", summary: `${count} contact(s) imported or updated.` });
  },
});

/** Owner-set frequency limit over the consented, unsuppressed contacts in one segment (null when no limit is set). */
async function segmentFrequency(ctx: QueryCtx, orgId: Id<"organizations">, segment: string, limitDays: number | undefined, recipients?: Awaited<ReturnType<typeof eligibleRecipients>>, excludingApprovalId?: Id<"approvals">) {
  if (!limitDays) return null;
  // Use the exact send audience, including provenance, suppression and history
  // completeness checks. A different consent slice can silently omit a person
  // who will actually receive the approved broadcast.
  const audience = recipients ?? await eligibleRecipients(ctx, orgId, segment);
  const people: ContactHistory[] = [];
  const hasReviews = Boolean(await ctx.db.query("reviewRequests").withIndex("by_org_created", q => q.eq("orgId", orgId)).first());
  for (const recipient of audience) {
    const c = assertSameOrg(await ctx.db.get(recipient.contactId), orgId, "contact");
    let reviewHistory: Partial<ContactHistory> = {};
    if (hasReviews) {
      try {
        const [keyId, iv] = recipient.iv.split(":");
        const address = (await decryptSecret({ keyId, iv, ciphertext: recipient.ciphertext }, contactAad(orgId))).trim().toLowerCase();
        reviewHistory = await sha256Hex(address) === c.emailHash ? await reviewContactHistory(ctx, orgId, address) : { unknownReviewHistory: true };
      } catch { reviewHistory = { unknownReviewHistory: true }; }
    }
    people.push({ ...reviewHistory, ...(c.lastMarketingEmailAt ? { lastMarketingEmailAt: c.lastMarketingEmailAt } : {}), ...(await outreachHistoryByHash(ctx, orgId, c.emailHash)) });
  }
  const check = checkContactFrequency(people, limitDays, Date.now());
  if (!check || !audience.length) return check;
  const pending = await pendingMarketingRecipients(ctx, orgId, excludingApprovalId);
  if (pending === null) return { ...check, unknownMarketingAudience: true };
  const activeMarketing = audience.filter(r => pending.has(r.emailHash)).length;
  return { ...check, ...(activeMarketing ? { activeMarketing } : {}) };
}

/** Before approving a broadcast: who in the segment the owner's contact limit would hold back. */
export const frequencyPreview = query({
  args: { slug: v.string(), segment: v.string() },
  handler: async (ctx, { slug, segment }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const check = await segmentFrequency(ctx, org._id, segment, org.contactFrequencyDays);
    return check ? { limitDays: org.contactFrequencyDays!, ...check, message: frequencyBlockMessage(check, org.contactFrequencyDays!) } : null;
  },
});

async function segmentStats(ctx: { db: import("./_generated/server").QueryCtx["db"] }, orgId: Id<"organizations">) {
  const contacts = await marketingContactRows(ctx, orgId);
  const bySegment = new Map<string, { total: number; consented: number; suppressed: number; sendable: number }>();
  for (const c of contacts) {
    if (c.deletedAt !== undefined) continue;
    const consented = Boolean(await recordedMarketingConsent(ctx, orgId, c._id));
    const suppressed = Boolean(
      await ctx.db
        .query("suppressions")
        .withIndex("by_org_email", (q) => q.eq("orgId", orgId).eq("emailHash", c.emailHash))
        .first(),
    );
    for (const s of c.segments) {
      const st = bySegment.get(s) ?? { total: 0, consented: 0, suppressed: 0, sendable: 0 };
      st.total++;
      if (suppressed) st.suppressed++;
      else if (consented) {
        st.consented++;
        if (c.emailCiphertext && c.emailIv) st.sendable++;
      }
      bySegment.set(s, st);
    }
  }
  return [...bySegment.entries()].map(([segment, s]) => ({ segment, ...s }));
}

export const audience = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org, role } = await requireOrgAccess(ctx, { slug }, "view");
    const resend = await ctx.db
      .query("connections")
      .withIndex("by_org_provider", (q) => q.eq("orgId", org._id).eq("provider", "email_resend"))
      .first();
    return {
      segments: await segmentStats(ctx, org._id),
      providerConnected: resend?.status === "connected",
      canReviewRecipients: can(role, "manage_connections"),
      senderReadiness: await recordedEmailReadiness(ctx, resend),
      note: "Only people with a recorded marketing opt-in can be emailed. Unsubscribes, bounces and complaints are always excluded.",
    };
  },
});

/** Read-only provider inspection, with only a minimal local observation retained. */
export const checkSender = action({
  args: { slug: v.string(), from: v.string() },
  handler: async (ctx, { slug, from }): Promise<EmailSenderReadiness> => {
    const access = await ctx.runQuery(internal.access.orgAccessForAction, { slug, permission: "approve" });
    if (!emailSenderDomain(from)) throw appError("INVALID", "Enter one sender address, such as Name <hello@example.com>.");
    const conn = await ctx.runQuery(internal.connections.connectionFor, { orgId: access.orgId, provider: "email_resend" });
    if (!conn || conn.status !== "connected" || conn.isFixture) throw appError("INVALID", "Connect your own Resend account to check the sender.");
    const secret = await ctx.runQuery(internal.connections.getSecret, { connectionId: conn._id });
    if (!secret || secret.orgId !== access.orgId || secret.provider !== "email_resend") throw appError("INVALID", "The email credentials are unavailable.");
    const { apiKey } = JSON.parse(secret.value) as { apiKey: string };
    const report = await checkSenderDomain({ apiKey, from });
    await ctx.runMutation(internal.marketing.saveSenderReadiness, { slug, connectionId: conn._id, credentialId: secret.secretId, report });
    return report;
  },
});

export const saveSenderReadiness = internalMutation({
  args: { slug: v.string(), connectionId: v.id("connections"), credentialId: v.id("connectionSecrets"), report: emailReadinessValidator },
  handler: async (ctx, args) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: args.slug }, "approve");
    const conn = await ctx.db.get(args.connectionId);
    const key = conn ? await ctx.db.query("connectionSecrets").withIndex("by_connection", q => q.eq("connectionId", conn._id)).first() : null;
    if (!conn || conn.orgId !== org._id || conn.provider !== "email_resend" || conn.status !== "connected" || conn.isFixture || !key || key.orgId !== org._id || key._id !== args.credentialId) throw appError("INVALID", "The email connection changed. Check the current sender again.");
    if (!Number.isFinite(args.report.checkedAt) || args.report.checkedAt > Date.now()) throw appError("INVALID", "Invalid check time.");
    if ((conn.emailSenderReadiness?.report.checkedAt ?? 0) > args.report.checkedAt) return;
    await ctx.db.patch(conn._id, { emailSenderReadiness: { credentialId: key._id, report: args.report } });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "email.sender_checked", subjectType: "connection", subjectId: conn._id, summary: `Read sender setup for ${args.report.domain}: ${args.report.state}. No email sent or DNS changed.` });
  },
});

/** The customer's Resend segments (from their own account). */
export const providerSegments = action({
  args: { slug: v.string() },
  handler: async (ctx, { slug }): Promise<{ id: string; name: string }[]> => {
    const access = await ctx.runQuery(internal.access.orgAccessForAction, { slug, permission: "view" });
    if (!access) throw appError("NOT_FOUND", "We couldn't find that workspace.");
    const conn = await ctx.runQuery(internal.connections.connectionFor, { orgId: access.orgId, provider: "email_resend" });
    if (!conn || conn.status !== "connected") return [];
    const secret = await ctx.runQuery(internal.connections.getSecret, { connectionId: conn._id });
    if (!secret) return [];
    const { apiKey } = JSON.parse(secret.value) as { apiKey: string };
    const res = await listSegments({ apiKey, maxPages: 2 });
    return res.ok ? res.data.items.map((s) => ({ id: s.id, name: s.name })) : [];
  },
});

export function splitSequence(body: string): { subject: string; text: string }[] {
  return body
    .split(/\n\s*———\s*\n/)
    .map((block) => {
      const subject = block.match(/^Subject:\s*(.+)$/m)?.[1]?.trim() ?? "";
      const text = block
        .replace(/^Email \d+.*$/m, "")
        .replace(/^Subject:.*$/m, "")
        .replace(/^Preview:.*$/m, "")
        .trim();
      return { subject, text };
    })
    .filter((e) => e.subject && e.text);
}

function toHtml(text: string, businessName: string): string {
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const paras = text.split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px;line-height:1.6">${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:16px;color:#1a1d1b;max-width:560px">${paras}<p style="margin:24px 0 0;font-size:12px;color:#626761">You're receiving this because you opted in to emails from ${esc(businessName)}. <a href="${RESEND_UNSUBSCRIBE_PLACEHOLDER}">Unsubscribe</a></p></div>`;
}

/** A complete bounded audience, with identity rather than count used for approval. */
async function baseEligibleRecipients(ctx: QueryCtx, orgId: Id<"organizations">, segment: string) {
  const contacts = await marketingContactRows(ctx, orgId);
  const recipients = [];
  for (const contact of contacts) {
    if (contact.deletedAt !== undefined || !contact.segments.includes(segment)) continue;
    const consent = await recordedMarketingConsent(ctx, orgId, contact._id);
    const suppressed = await ctx.db.query("suppressions").withIndex("by_org_email", q => q.eq("orgId", orgId).eq("emailHash", contact.emailHash)).first();
    if (!consent || suppressed) continue;
    if (!contact.emailCiphertext || !contact.emailIv) throw appError("INVALID", "A selected contact's address is unavailable. Review the audience before sending.");
    recipients.push({ contactId: contact._id, emailHash: contact.emailHash, ciphertext: contact.emailCiphertext, iv: contact.emailIv, firstName: contact.displayName?.split(" ")[0], consent: { id: consent._id, source: consent.source, grantedAt: consent.capturedAt }, suppressed: false });
  }
  return recipients.sort((a, b) => a.emailHash.localeCompare(b.emailHash) || a.contactId.localeCompare(b.contactId));
}
type EmailRecipient = Awaited<ReturnType<typeof baseEligibleRecipients>>[number] & { progressEvidence?: { recordId: Id<"contactProgress">; observationHash: string }; journeyEvidence?: { enrollmentId: Id<"journeyContacts">; stepIndex: number; dueAt: number } };
function checkedProgressRule(rule?: CustomerProgressRule) {
  if (!rule) return undefined;
  const normalized = normalizeProgressRule(rule);
  if (!normalized) throw appError("INVALID", "Choose a known customer-progress group and how recent its observations must be (1–365 UTC calendar days).");
  return normalized;
}
async function selectedEmailAudience(ctx: QueryCtx, orgId: Id<"organizations">, segment: string, rule?: CustomerProgressRule, includeProgressOptions = false, journeyStep?: JourneyStepRef) {
  if (journeyStep) await checkedJourneyStep(ctx, orgId, journeyStep, segment, rule);
  const base = await baseEligibleRecipients(ctx, orgId, segment), now = Date.now();
  const recipients: EmailRecipient[] = [];
  const excluded = { unknown: 0, different_progress: 0, outdated: 0, not_due: 0 };
  const groups = new Map<string, { key: string; scope: string; state: CustomerProgressRule["state"]; criterion: string; contacts: number }>();
  if (!rule && !includeProgressOptions) return { recipients: base as EmailRecipient[], total: base.length, excluded, progressOptions: [], omittedGroups: 0 };
  for (const recipient of base) {
    const matches = await ctx.db.query("contactProgress").withIndex("by_org_contact", q => q.eq("orgId", orgId).eq("contactId", recipient.contactId)).take(2);
    const row = matches.length === 1 ? matches[0] : undefined;
    if (includeProgressOptions && row) for (const observation of row.progress.current) {
      const candidate = normalizeProgressRule({ scope: observation.scope, state: observation.state, criterion: observation.criterion, maxAgeDays: 365 });
      if (!candidate || progressEligibility(row.progress, candidate, now).status !== "eligible") continue;
      const key = JSON.stringify([progressScopeKey(candidate.scope), candidate.state, candidate.criterion]);
      const group = groups.get(key);
      if (group) group.contacts++;
      else groups.set(key, { key, scope: candidate.scope, state: candidate.state, criterion: candidate.criterion, contacts: 1 });
    }
    if (!rule) { recipients.push(recipient); continue; }
    const result = progressEligibility(row?.progress, rule, now);
    if (result.status !== "eligible") { excluded[result.status]++; continue; }
    const journeyEvidence = journeyStep ? await journeyRecipientEvidence(ctx, orgId, journeyStep, recipient.contactId, now) : null;
    if (journeyStep && !journeyEvidence) { excluded.not_due++; continue; }
    recipients.push({ ...recipient, ...(journeyEvidence ? { journeyEvidence } : {}), progressEvidence: { recordId: row!._id, observationHash: await sha256Hex(canonicalJson({ ...result.observation! })) } });
  }
  const options = [...groups.values()].sort((a, b) => a.key.localeCompare(b.key));
  return { recipients, total: base.length, excluded, progressOptions: options.slice(0, 30), omittedGroups: Math.max(0, options.length - 30) };
}
async function eligibleRecipients(ctx: QueryCtx, orgId: Id<"organizations">, segment: string, rule?: CustomerProgressRule, journeyStep?: JourneyStepRef) {
  return (await selectedEmailAudience(ctx, orgId, segment, rule, false, journeyStep)).recipients;
}
async function lifecyclePreviewHash(orgId: Id<"organizations">, segment: string, rule: CustomerProgressRule | undefined, recipients: EmailRecipient[], journeyStep?: JourneyStepRef) {
  return sha256Hex(canonicalJson({ ...(journeyStep ? { journeyStep } : {}), orgId, segment, rule: rule ? { ...rule } : undefined, recipientSetHash: await recipientSetHash(recipients) }));
}
/** Exact per-send review. Recorded progress does not create consent, schedule a message or infer a missing milestone. */
export const emailAudiencePreview = query({
  args: { slug: v.string(), segment: v.string(), lifecycleRule: v.optional(customerProgressRuleV), includeProgressOptions: v.optional(v.boolean()), journeyStep: v.optional(journeyStepRefV) },
  handler: async (ctx, args) => {
    const { org } = await requireOrgAccess(ctx, { slug: args.slug }, "view");
    const rule = checkedProgressRule(args.lifecycleRule);
    const result = await selectedEmailAudience(ctx, org._id, args.segment, rule, args.includeProgressOptions, args.journeyStep);
    const check = await segmentFrequency(ctx, org._id, args.segment, org.contactFrequencyDays, result.recipients);
    return { total: result.total, eligible: result.recipients.length, excluded: result.excluded, progressOptions: result.progressOptions, omittedGroups: result.omittedGroups, rule: rule ?? null, previewHash: await lifecyclePreviewHash(org._id, args.segment, rule, result.recipients, args.journeyStep), observedOnUtc: new Date(Date.now()).toISOString().slice(0, 10), frequency: check ? { ...check, message: frequencyBlockMessage(check, org.contactFrequencyDays!) } : null };
  },
});

/** Purpose-bound private review for contact managers. No provider calls, list writes or send authority. */
export const emailRecipientReview = query({
  args: { slug: v.string(), segment: v.string(), lifecycleRule: v.optional(customerProgressRuleV), journeyStep: v.optional(journeyStepRefV), previewHash: v.string(), offset: v.number() },
  handler: async (ctx, args) => {
    const { org } = await requireOrgAccess(ctx, { slug: args.slug }, "manage_connections");
    if (!Number.isSafeInteger(args.offset) || args.offset < 0 || args.offset > MAX_MARKETING_CONTACTS || !/^[a-f0-9]{64}$/.test(args.previewHash)) throw appError("INVALID", "Open a current audience preview before reviewing its recipients.");
    try {
      const rule = checkedProgressRule(args.lifecycleRule);
      const recipients = await eligibleRecipients(ctx, org._id, args.segment, rule, args.journeyStep);
      const hash = await lifecyclePreviewHash(org._id, args.segment, rule, recipients, args.journeyStep);
      if (hash !== args.previewHash) return { ready: false as const, message: "The audience changed. Close this review and open the current recipient list." };
      if (args.offset > recipients.length) throw appError("INVALID", "That page is no longer available.");
      const items = [];
      for (const recipient of recipients.slice(args.offset, args.offset + 50)) {
        const [keyId, iv] = recipient.iv.split(":");
        const email = (await decryptSecret({ keyId, iv, ciphertext: recipient.ciphertext }, contactAad(org._id))).trim().toLowerCase();
        if (!EMAIL_RE.test(email) || await sha256Hex(email) !== recipient.emailHash) throw appError("INVALID", "A recipient identity could not be verified.");
        items.push({ email, name: recipient.firstName ?? null });
      }
      return { ready: true as const, items, total: recipients.length, start: args.offset, nextOffset: args.offset + items.length < recipients.length ? args.offset + items.length : null };
    } catch { return { ready: false as const, message: "The complete audience or a recipient address could not be verified. Check the current progress, contact data and follow-up state before continuing." }; }
  },
});
async function recipientSetHash(recipients: EmailRecipient[]) {
  return sha256Hex(canonicalJson(recipients));
}
async function marketingConnection(ctx: QueryCtx, orgId: Id<"organizations">) {
  const connection = await ctx.db.query("connections").withIndex("by_org_provider", q => q.eq("orgId", orgId).eq("provider", "email_resend")).first();
  const secret = connection?.status === "connected" ? await ctx.db.query("connectionSecrets").withIndex("by_connection", q => q.eq("connectionId", connection._id)).first() : null;
  return { connection, credentialId: secret?.orgId === orgId ? secret._id : undefined };
}

/**
 * Approve sending ONE email from an approved sequence to a segment through the
 * customer's Resend account. The approval binds content, segment, sender and
 * the exact sendable count shown to the approver.
 */
export const approveSend = mutation({
  args: {
    slug: v.string(),
    artifactId: v.id("artifacts"),
    emailIndex: v.number(),
    segment: v.string(),
    providerSegmentId: v.string(),
    from: v.string(),
    lifecycleRule: v.optional(customerProgressRuleV),
    audiencePreviewHash: v.optional(v.string()),
    journeyStep: v.optional(journeyStepRefV),
  },
  handler: async (ctx, args) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: args.slug }, "approve");
    await requirePaid(ctx, org, "sending");
    const a = assertSameOrg(await ctx.db.get(args.artifactId), org._id, "email");
    if (a.kind !== "email_sequence" && a.kind !== "email") throw appError("INVALID", "Only email drafts can be sent.");
    if (a.status !== "approved") throw appError("INVALID", "Approve the email content first.");
    const pending = await ctx.db.query("approvals").withIndex("by_subject", q => q.eq("subjectType", "email_send").eq("subjectId", a._id))
      .filter(q => q.and(q.eq(q.field("orgId"), org._id), q.or(
        q.and(q.eq(q.field("status"), "approved"), q.gt(q.field("expiresAt"), Date.now())),
        q.and(q.eq(q.field("executionReconciledAt"), undefined), q.neq(q.field("executionStartedAt"), undefined), q.or(q.eq(q.field("executionFinishedAt"), undefined), q.eq(q.field("executionOutcome"), "uncertain"))),
      ))).first();
    if (pending) throw appError("INVALID", "This email already has an approved or unresolved send. Check its result before approving another.");
    if (!/^[^<>]*<?[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}>?$/i.test(args.from.trim())) throw appError("INVALID", "Enter a sender like “Your Name <hello@yourdomain.com>” on a domain verified in your Resend account.");
    const access = await chargeableAccess(ctx, org);
    if (!access.allowed) throw appError(access.code === "PAUSED" ? "PAUSED" : "PAYMENT_REQUIRED", access.message);
    const ver = a.currentVersionId ? await ctx.db.get(a.currentVersionId) : null;
    if (!ver || ver.orgId !== org._id || ver.artifactId !== a._id || ver.version !== a.currentVersion) throw appError("INVALID", "Review the current email version before sending.");
    if (!Number.isInteger(args.emailIndex) || args.emailIndex < 0 || (a.kind === "email" && args.emailIndex !== 0)) throw appError("INVALID", "Choose one email from the approved draft.");
    const emails = splitSequence(ver.body);
    const email = emails[args.emailIndex] ?? (a.kind === "email" ? { subject: ver.headline ?? a.title, text: ver.body.trim() } : undefined);
    if (!email) throw appError("INVALID", "We couldn't find that email in the draft.");
    const lifecycleRule = checkedProgressRule(args.lifecycleRule);
    if (args.journeyStep) {
      const { step } = await checkedJourneyStep(ctx, org._id, args.journeyStep, args.segment, lifecycleRule);
      if (step.artifactId !== a._id || step.artifactVersionId !== ver._id || step.emailIndex !== args.emailIndex) throw appError("INVALID", "This email does not match the saved follow-up step.");
    }
    const recipients = await eligibleRecipients(ctx, org._id, args.segment, lifecycleRule, args.journeyStep);
    if (lifecycleRule && args.audiencePreviewHash !== await lifecyclePreviewHash(org._id, args.segment, lifecycleRule, recipients, args.journeyStep)) throw appError("INVALID", "The customer-progress audience changed or was not previewed. Review its current count and rule before approving.");
    const stats = { sendable: recipients.length };
    if (stats.sendable === 0) throw appError("INVALID", lifecycleRule ? "No opted-in contacts match this customer-progress rule with recent usable evidence. Review the reports or choose a different purpose." : "Nobody in this segment has a recorded marketing opt-in. ClimbOS won't send without one.");
    // The owner's contact frequency limit holds the whole send rather than silently dropping people from an approved segment.
    const frequency = await segmentFrequency(ctx, org._id, args.segment, org.contactFrequencyDays, recipients);
    const blocked = frequency ? frequencyBlockMessage(frequency, org.contactFrequencyDays!) : null;
    if (blocked) throw appError("INVALID", blocked);
    // Reserve the send volume against the plan's marketing-send quota (customer's provider bill is separate).
    const period = access.period;
    const decision = decideReservation(ledgerOf(period), { costMicros: 0, topupCostMicros: 0, meters: { byoMarketingSends: stats.sendable } });
    if (!decision.ok) throw appError("LIMIT_REACHED", decision.message);
    await ctx.db.patch(period._id, ledgerPatch(decision.next));
    const policyVersion = await activePolicyVersion(ctx, org._id);
    const now = Date.now();
    const expiresAt = now + 24 * 3_600_000;
    const html = toHtml(email.text, org.name);
    const contentHash = await sha256Hex(canonicalJson({ subject: email.subject, html, from: args.from.trim() }));
    const { connection, credentialId } = await marketingConnection(ctx, org._id);
    const reservationId = await ctx.db.insert("usageReservations", { orgId: org._id, periodId: period._id, purpose: "email_send", walletMicros: 0, topupMicros: 0, meters: { byoMarketingSends: stats.sendable }, status: "held", createdAt: now });
    const scope = { ...(args.journeyStep ? { journeyStep: args.journeyStep } : {}), ...(lifecycleRule ? { lifecycleRule } : {}), destination: args.providerSegmentId, audience: args.segment, spendLimitMinor: stats.sendable, recipientSetHash: await recipientSetHash(recipients), artifactVersionId: ver._id, reservationId, connectionId: connection?.status === "connected" ? connection._id : undefined, credentialId };
    const binding = { orgId: org._id, subjectType: "email_send", subjectId: a._id, actionKind: `send:${args.emailIndex}`, contentHash, scope, policyVersion, expiresAt };
    const approvalId = await ctx.db.insert("approvals", {
      orgId: org._id,
      subjectType: "email_send",
      subjectId: a._id,
      actionKind: `send:${args.emailIndex}`,
      title: `Send “${email.subject}” to ${stats.sendable} opted-in contact${stats.sendable === 1 ? "" : "s"}`,
      contentHash,
      scope,
      costEstimateMicros: 0,
      policyVersion,
      approvalHash: await approvalHash(binding),
      status: "approved",
      decidedBy: user._id,
      decidedAt: now,
      expiresAt,
      createdAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.marketing.executeSend, { approvalId, reservationId, subject: email.subject, html, from: args.from.trim(), segment: args.segment, providerSegmentId: args.providerSegmentId });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "email.send_approved", subjectType: "artifact", subjectId: a._id, summary: `Approved sending “${email.subject}” to ${stats.sendable} opted-in contact(s) in “${args.segment}”${lifecycleRule ? `; owner-selected progress: ${lifecycleRule.scope} / ${lifecycleRule.state}, observations no older than ${lifecycleRule.maxAgeDays} UTC days` : ""}.` });
    return { recipients: stats.sendable };
  },
});

const sendArgs = {
  approvalId: v.id("approvals"), reservationId: v.id("usageReservations"), subject: v.string(), html: v.string(), from: v.string(), segment: v.string(), providerSegmentId: v.string(),
};
type SendArgs = { approvalId: Id<"approvals">; reservationId: Id<"usageReservations">; subject: string; html: string; from: string; segment: string; providerSegmentId: string };
async function readSendContext(ctx: QueryCtx, approvalId: Id<"approvals">, segment: string) {
  const approval = await ctx.db.get(approvalId);
  if (!approval || approval.subjectType !== "email_send") return null;
  const org = await ctx.db.get(approval.orgId);
  if (!org || org.deletedAt) return null;
  const { connection, credentialId } = await marketingConnection(ctx, org._id);
  let recipients: Awaited<ReturnType<typeof eligibleRecipients>> = [];
  let audienceProblem: string | null = null;
  let lifecycleRule: CustomerProgressRule | undefined;
  try { lifecycleRule = checkedProgressRule(approval.scope.lifecycleRule); recipients = await eligibleRecipients(ctx, org._id, segment, lifecycleRule, approval.scope.journeyStep);
    if (approval.scope.journeyStep) { const { step } = await checkedJourneyStep(ctx, org._id, approval.scope.journeyStep, segment, lifecycleRule); if (step.artifactId !== approval.subjectId || step.artifactVersionId !== approval.scope.artifactVersionId || approval.actionKind !== `send:${step.emailIndex}`) throw appError("INVALID", "Follow-up content changed."); } } catch { audienceProblem = "The complete audience, progress or consent history could not be verified. Review it before sending."; }
  const artifactId = ctx.db.normalizeId("artifacts", approval.subjectId);
  const artifact = artifactId ? await ctx.db.get(artifactId) : null;
  const version = artifact?.currentVersionId ? await ctx.db.get(artifact.currentVersionId) : null;
  return { approval, org, connectionId: connection?.status === "connected" ? connection._id : null, credentialId, recipients, audienceProblem, lifecycleRule, artifact, version };
}
export const sendContext = internalQuery({
  args: { approvalId: v.id("approvals"), segment: v.string() },
  handler: (ctx, args) => readSendContext(ctx, args.approvalId, args.segment),
});
async function sendProblem(ctx: MutationCtx, c: NonNullable<Awaited<ReturnType<typeof readSendContext>>>, args: SendArgs): Promise<string | null> {
  const { approval: a, org, artifact, version } = c;
  if (c.audienceProblem) return c.audienceProblem;
  if (!a.scope.recipientSetHash || !a.scope.artifactVersionId || !a.scope.reservationId) return "This older email approval needs a fresh review of its exact audience and content.";
  if (!c.connectionId || !c.credentialId) return "Connect your own Resend account before sending.";
  const reservation = await ctx.db.get(args.reservationId);
  if (!reservation || reservation.orgId !== org._id || reservation.purpose !== "email_send" || reservation.status !== "held" || reservation.meters.byoMarketingSends !== a.scope.spendLimitMinor) return "The reserved email allowance no longer matches this approval.";
  if (!artifact || artifact.orgId !== org._id || artifact.status !== "approved" || !version || version.orgId !== org._id || version.artifactId !== artifact._id || version.version !== artifact.currentVersion) return "The current email content is no longer approved.";
  const member = a.decidedBy ? await ctx.db.query("memberships").withIndex("by_org_user", q => q.eq("orgId", org._id).eq("userId", a.decidedBy!)).unique() : null;
  if (!member || member.status !== "active" || !can(member.role, "approve")) return "The approving member no longer has permission. Review the send again.";
  try { await requirePaid(ctx, org, "sending"); } catch { return "Your plan no longer allows email sending."; }
  const access = await chargeableAccess(ctx, org);
  if (!access.allowed) return access.message;
  const index = Number(a.actionKind.replace(/^send:/, ""));
  if (!/^send:\d+$/.test(a.actionKind) || !Number.isSafeInteger(index)) return "The approved email selection is invalid.";
  const email = selectedEmail(artifact, version, index);
  if (!email || email.subject !== args.subject || toHtml(email.text, org.name) !== args.html) return "The email content changed after approval. Review the current version.";
  const frequency = await segmentFrequency(ctx, org._id, args.segment, org.contactFrequencyDays, c.recipients, a._id);
  const frequencyIssue = frequency ? frequencyBlockMessage(frequency, org.contactFrequencyDays!) : null;
  if (frequencyIssue) return frequencyIssue;
  const scope = { ...(a.scope.journeyStep ? { journeyStep: a.scope.journeyStep } : {}), ...(c.lifecycleRule ? { lifecycleRule: c.lifecycleRule } : {}), destination: args.providerSegmentId, audience: args.segment, spendLimitMinor: c.recipients.length, recipientSetHash: await recipientSetHash(c.recipients), artifactVersionId: version._id, reservationId: args.reservationId, connectionId: c.connectionId, credentialId: c.credentialId };
  const check = await checkApprovalForExecution({ approval: a, current: { orgId: org._id, subjectType: "email_send", subjectId: artifact._id, actionKind: a.actionKind, contentHash: await sha256Hex(canonicalJson({ subject: args.subject, html: args.html, from: args.from })), scope, policyVersion: await activePolicyVersion(ctx, org._id), expiresAt: a.expiresAt }, now: Date.now(), emergencyStop: Boolean(org.emergencyStop?.active), capabilityReady: true });
  return check.ok ? null : check.message;
}

export function selectedEmail(artifact: Doc<"artifacts">, version: Doc<"artifactVersions">, index: number) {
  return artifact.kind === "email" && index === 0 ? splitSequence(version.body)[0] ?? { subject: version.headline ?? artifact.title, text: version.body.trim() } : artifact.kind === "email_sequence" ? splitSequence(version.body)[index] : null;
}
function approvedBroadcastDraft(c: NonNullable<Awaited<ReturnType<typeof readSendContext>>>, args: SendArgs): BroadcastDraft {
  const email = c.artifact && c.version ? selectedEmail(c.artifact, c.version, Number(c.approval.actionKind.replace(/^send:/, ""))) : null;
  if (!email) throw appError("INVALID", "The original approved email is unavailable.");
  return { segmentId: args.providerSegmentId, from: args.from, subject: args.subject, html: args.html, text: `${email.text}\n\nYou're receiving this because you opted in to emails from ${c.org.name}.\nUnsubscribe: ${RESEND_UNSUBSCRIBE_PLACEHOLDER}`, name: `climbos-${args.approvalId}` };
}

/** Claim before any provider write; an interrupted attempt never silently retries. */
export const claimSend = internalMutation({
  args: sendArgs,
  handler: async (ctx, args) => {
    const c = await readSendContext(ctx, args.approvalId, args.segment);
    if (!c || c.approval.executionStartedAt !== undefined || c.approval.executionFinishedAt !== undefined) return null;
    const reservation = await ctx.db.get(args.reservationId);
    if (!reservation || reservation.orgId !== c.org._id || reservation.purpose !== "email_send" || reservation.status !== "held" || (c.approval.scope.reservationId && c.approval.scope.reservationId !== reservation._id)) return null;
    const error = await sendProblem(ctx, c, args);
    await ctx.db.patch(c.approval._id, {
      executionStartedAt: Date.now(),
      // Keep the one-attempt claim even when validation refuses it. A known
      // pre-provider refusal must not hold another valid broadcast as unknown.
      ...(error ? { executionOutcome: "failed" as const } : {
        emailRecipientHashBatches: Array.from({ length: Math.ceil(c.recipients.length / 200) }, (_, i) => c.recipients.slice(i * 200, (i + 1) * 200).map(r => r.emailHash)),
      }),
    });
    return { context: c, error };
  },
});

/** Recheck after provider contact reads and immediately before the one send dispatch. */
export const authorizeSendDispatch = internalMutation({
  args: { ...sendArgs, externalId: v.string() },
  handler: async (ctx, args) => {
    const c = await readSendContext(ctx, args.approvalId, args.segment);
    if (!c || c.approval.executionStartedAt === undefined || c.approval.executionFinishedAt !== undefined || c.approval.emailSendDispatchedAt !== undefined) return { ok: false, message: "This email attempt is no longer available." };
    const error = await sendProblem(ctx, c, args);
    if (error) return { ok: false, message: error };
    if (!args.externalId.trim()) return { ok: false, message: "The provider draft identity is missing." };
    await ctx.db.patch(c.approval._id, { emailSendDispatchedAt: Date.now(), emailProviderPayloadHash: await sha256Hex(canonicalJson(broadcastPayload(approvedBroadcastDraft(c, args)))), executionExternalId: args.externalId, emailRecipientHashBatches: Array.from({ length: Math.ceil(c.recipients.length / 200) }, (_, i) => c.recipients.slice(i * 200, (i + 1) * 200).map(r => r.emailHash)), ...(c.approval.scope.journeyStep ? { emailJourneyRecipients: c.recipients.flatMap(r => r.journeyEvidence ? [{ emailHash: r.emailHash, ...r.journeyEvidence }] : []) } : {}) });
    return { ok: true, message: "" };
  },
});

export const finishSend = internalMutation({
  args: {
    approvalId: v.id("approvals"),
    reservationId: v.id("usageReservations"),
    status: v.union(v.literal("verified"), v.literal("failed"), v.literal("uncertain")),
    sent: v.number(),
    externalId: v.optional(v.string()),
    summary: v.string(),
    /** Normalized-email hashes of the contacts the provider accepted, to record when they were last emailed. */
    recipientHashes: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const approval = await ctx.db.get(args.approvalId);
    const reservation = await ctx.db.get(args.reservationId);
    if (!approval || !reservation || approval.subjectType !== "email_send" || reservation.orgId !== approval.orgId || reservation.purpose !== "email_send" || approval.executionFinishedAt !== undefined || approval.executionReconciledAt !== undefined || approval.emailRecovery !== undefined || (approval.scope.reservationId && approval.scope.reservationId !== reservation._id)) return;
    if (args.status === "verified" && approval.emailSendDispatchedAt === undefined) return;
    if (args.status === "uncertain" && approval.executionStartedAt === undefined) return;
    await ctx.db.patch(approval._id, { executionFinishedAt: Date.now(), executionOutcome: args.status, ...(args.externalId ? { executionExternalId: args.externalId } : {}) });
    if (args.status === "verified" && args.recipientHashes?.length) {
      const now = Date.now();
      await recordJourneyAcceptance(ctx, approval, args.recipientHashes, now, "provider_accepted");
      for (const emailHash of args.recipientHashes.slice(0, 10_000)) {
        const contact = await ctx.db.query("contacts").withIndex("by_org_email", (q) => q.eq("orgId", approval.orgId).eq("emailHash", emailHash)).first();
        if (contact) await ctx.db.patch(contact._id, { lastMarketingEmailAt: now });
      }
    }
    const period = await ctx.db.get(reservation.periodId);
    if (period?.orgId !== approval.orgId) throw appError("INVALID", "The email allowance does not belong to this workspace.");
    if (reservation.status === "held" && args.status === "uncertain") {
      await ctx.db.patch(reservation._id, { status: "unresolved" }); // Keep quota held until the provider outcome is known.
    } else if (reservation.status === "held") {
      const released = releaseReservation(ledgerOf(period), { walletMicros: 0, topupMicros: 0, meters: reservation.meters });
      released.meterUsed = { ...released.meterUsed, byoMarketingSends: released.meterUsed.byoMarketingSends + args.sent };
      await ctx.db.patch(period._id, ledgerPatch(released));
      await ctx.db.patch(reservation._id, { status: "reconciled", reconciledAt: Date.now() });
    }
    await ctx.db.insert("actionReceipts", {
      orgId: approval.orgId,
      artifactId: approval.subjectId as Id<"artifacts">,
      provider: "resend_marketing",
      action: SEND_BROADCAST_ACTION,
      idempotencyKey: `${approval.orgId}:email:${approval._id}`,
      status: args.status,
      externalId: args.externalId,
      summary: args.summary.slice(0, 400),
      createdAt: Date.now(),
      verifiedAt: args.status === "verified" ? Date.now() : undefined,
    });
    await ctx.db.patch(approval._id, { status: args.status === "verified" ? "consumed" : "invalidated", ...(args.status !== "verified" ? { invalidatedReason: args.summary.slice(0, 400) } : {}) });
    await audit(ctx, { orgId: approval.orgId, actorType: "system", action: `email.send.${args.status}`, summary: args.summary.slice(0, 300) });
  },
});

export const executeSend = internalAction({
  args: sendArgs,
  handler: async (ctx, args): Promise<void> => {
    const claim = await ctx.runMutation(internal.marketing.claimSend, args);
    if (!claim) return;
    const c = claim.context;
    const fail = async (summary: string): Promise<void> => {
      await ctx.runMutation(internal.marketing.finishSend, { approvalId: args.approvalId, reservationId: args.reservationId, status: "failed", sent: 0, externalId, summary });
    };
    let requestPhase: "preparation" | "draft" | "send" = "preparation";
    let externalId: string | undefined;
    try {
      if (claim.error) return fail(`Not sent: ${claim.error}`);
      if (c.approval.status !== "approved" || c.approval.expiresAt < Date.now()) return fail("Not sent: the approval is no longer valid.");
      const scope = c.approval.scope;
      if (scope.destination !== args.providerSegmentId || scope.audience !== args.segment || scope.spendLimitMinor === undefined) {
        return fail("Not sent: the reviewed email audience no longer matches this approval. Review and approve the send again.");
      }
      if (!c.connectionId) return fail("Not sent: connect your own Resend account first.");
      const secret = await ctx.runQuery(internal.connections.getSecret, { connectionId: c.connectionId });
      if (!secret || secret.orgId !== c.org._id || secret.provider !== "email_resend" || secret.secretId !== c.credentialId) return fail("Not sent: the email provider connection changed. Review the send again.");
      const { apiKey } = JSON.parse(secret.value) as { apiKey: string };
      const expectedRecipients = new Set<string>();
      let syncUnverified = false;
      for (const r of c.recipients) {
        if (!r.consent || r.suppressed || !r.ciphertext) continue;
        const [keyId, iv] = r.iv.split(":");
        const email = await decryptSecret({ keyId, iv, ciphertext: r.ciphertext }, contactAad(c.org._id));
        const contact = { email, firstName: r.firstName, consent: { purpose: "marketing_email", source: r.consent.source, grantedAt: r.consent.grantedAt }, suppressed: r.suppressed, segmentIds: [args.providerSegmentId] };
        if (contactRefusalReason(contact)) continue;
        const res = await upsertMarketingContact({ apiKey, contact });
        if (res.status !== "verified" || !res.data || res.data.email.trim().toLowerCase() !== email.trim().toLowerCase()) syncUnverified = true;
        else if (!res.data.unsubscribed) expectedRecipients.add(res.data.email.trim().toLowerCase());
      }
      if (syncUnverified) return fail("Not sent: the email provider could not verify every opted-in contact. Check the connection and try again.");
      if (expectedRecipients.size === 0) return fail("Not sent: no opted-in, unsuppressed contacts could be synced.");
      if (expectedRecipients.size !== scope.spendLimitMinor) {
        return fail("Not sent: the eligible contact count changed after approval. Review the current audience and approve the send again.");
      }
      const providerRecipients = await listSegmentContacts({ apiKey, segmentId: args.providerSegmentId });
      if (!providerRecipients.ok) return fail("Not sent: ClimbOS could not verify who is in the selected email segment. Check the connection and try again.");
      if (providerRecipients.data.truncated) return fail("Not sent: the email segment is too large for ClimbOS to verify completely. Narrow it to a segment of 10,000 contacts or fewer, then try again.");
      const match = compareSegmentRecipients(expectedRecipients, providerRecipients.data.items);
      if (!match.matches) {
        return fail(`Not sent: the selected email segment does not match the ${match.expectedCount} opted-in contacts you approved (${match.additional} extra active contact${match.additional === 1 ? "" : "s"}, ${match.missing} approved contact${match.missing === 1 ? " is" : "s are"} missing). Align the segment and approve again.`);
      }
      requestPhase = "draft";
      const expectedDraft = approvedBroadcastDraft(c, args);
      const draft = await createDraftBroadcast({ apiKey, draft: expectedDraft });
      if (draft.status !== "verified" || !draft.externalId) {
        await ctx.runMutation(internal.marketing.finishSend, { approvalId: args.approvalId, reservationId: args.reservationId, status: draft.status === "uncertain" ? "uncertain" : "failed", sent: 0, externalId: draft.externalId, summary: draft.providerMessage ?? "Your email provider didn't accept the draft." });
        return;
      }
      externalId = draft.externalId;
      const dispatch = await ctx.runMutation(internal.marketing.authorizeSendDispatch, { ...args, externalId });
      if (!dispatch.ok) return fail(`Not sent: ${dispatch.message}`);
      requestPhase = "send";
      const sent = await sendBroadcast({ apiKey, broadcastId: draft.externalId, expectedDraft, approval: { kind: SEND_BROADCAST_ACTION, targetId: draft.externalId, value: "now", approvedBy: String(c.approval.decidedBy ?? "owner"), approvedAt: Date.now() } });
      await ctx.runMutation(internal.marketing.finishSend, {
        approvalId: args.approvalId,
        reservationId: args.reservationId,
        status: sent.status,
        sent: sent.status === "verified" ? expectedRecipients.size : 0,
        externalId: draft.externalId,
        ...(sent.status === "verified" ? { recipientHashes: await Promise.all([...expectedRecipients].map((email) => sha256Hex(email))) } : {}),
        summary: sent.status === "verified" ? `Accepted by your email provider for ${expectedRecipients.size} opted-in contact(s) after the provider segment matched the approved audience.` : (sent.providerMessage ?? "Your email provider didn't send it."),
      });
    } catch {
      await ctx.runMutation(internal.marketing.finishSend, { approvalId: args.approvalId, reservationId: args.reservationId, status: requestPhase === "preparation" ? "failed" : "uncertain", sent: 0, externalId, summary: requestPhase === "preparation" ? "Email preparation stopped before a broadcast was requested. Review the connection and approve again." : "The email provider result is unknown. Check the provider before attempting another send; this approval will not retry." });
    }
  },
});

const EMAIL_RECOVERY_WAIT_MS = 5 * 60_000;
function unresolvedEmail(a: Doc<"approvals">) {
  return a.subjectType === "email_send" && a.executionStartedAt !== undefined && a.executionReconciledAt === undefined && (a.executionFinishedAt === undefined || a.executionOutcome === "uncertain");
}
const recoveryArgs = { slug: v.string(), artifactId: v.id("artifacts"), approvalId: v.id("approvals") };
type EmailRecoveryArgs = { slug: string; artifactId: Id<"artifacts">; approvalId: Id<"approvals"> };
async function readEmailRecovery(ctx: QueryCtx | MutationCtx, args: EmailRecoveryArgs) {
  const { org, user } = await requireOrgAccess(ctx, { slug: args.slug }, "approve");
  const artifact = assertSameOrg(await ctx.db.get(args.artifactId), org._id, "email");
  const a = assertSameOrg(await ctx.db.get(args.approvalId), org._id, "email request");
  if (a.subjectId !== artifact._id || !unresolvedEmail(a) || a.emailRecovery) throw appError("INVALID", "This email request is no longer unresolved. Refresh its result.");
  if (a.emailSendDispatchedAt === undefined || !a.executionExternalId || !a.emailProviderPayloadHash || !a.emailRecipientHashBatches?.length) throw appError("INVALID", "This older or interrupted request lacks dispatch evidence. Check the original Resend account; no automatic retry is available.");
  if (Date.now() - a.emailSendDispatchedAt < EMAIL_RECOVERY_WAIT_MS) throw appError("INVALID", "Wait five minutes after dispatch before checking its result.");
  const { connection, credentialId } = await marketingConnection(ctx, org._id);
  if (org.kind === "demo" || connection?.isFixture) throw appError("UNAVAILABLE", "Demo email has no live provider result to check.");
  if (!connection || connection.status !== "connected" || connection._id !== a.scope.connectionId || credentialId !== a.scope.credentialId || !credentialId) throw appError("INVALID", "The original email connection or credentials changed. Check the original Resend account.");
  const binding = { orgId: a.orgId, subjectType: a.subjectType, subjectId: a.subjectId, actionKind: a.actionKind, contentHash: a.contentHash, scope: a.scope, policyVersion: a.policyVersion, expiresAt: a.expiresAt };
  if (await approvalHash(binding) !== a.approvalHash) throw appError("INVALID", "The saved email approval no longer matches its original terms.");
  const id = a.scope.reservationId ? ctx.db.normalizeId("usageReservations", a.scope.reservationId) : null;
  const reservation = id ? await ctx.db.get(id) : null;
  const hashes = a.emailRecipientHashBatches.flat();
  if (!reservation || reservation.orgId !== org._id || reservation.purpose !== "email_send" || !["held", "unresolved"].includes(reservation.status) || reservation.meters.byoMarketingSends !== a.scope.spendLimitMinor || new Set(hashes).size !== a.scope.spendLimitMinor || hashes.length !== a.scope.spendLimitMinor || hashes.length > MAX_CONTACT_ROWS) throw appError("INVALID", "The original email allowance or recipient evidence needs review.");
  const period = await ctx.db.get(reservation.periodId);
  if (!period || period.orgId !== org._id) throw appError("INVALID", "The original email allowance is unavailable.");
  // A changed draft, expired approval, stopped workspace or lapsed plan cannot authorize a retry,
  // but also must not prevent observing what happened to the original approved request.
  return { org, user, approval: a, reservation, period, connection, credentialId,
    fingerprint: await sha256Hex(canonicalJson({ approvalHash: a.approvalHash, externalId: a.executionExternalId, dispatch: a.emailSendDispatchedAt, hashes: a.emailRecipientHashBatches, payloadHash: a.emailProviderPayloadHash, outcome: a.executionOutcome, finished: a.executionFinishedAt, checked: a.recoveryCheckedAt })) };
}
type EmailRecoveryContext = Awaited<ReturnType<typeof readEmailRecovery>>;

export const unresolvedSends = query({
  args: { slug: v.string(), artifactId: v.id("artifacts") },
  handler: async (ctx, args) => {
    const { org, role } = await requireOrgAccess(ctx, { slug: args.slug });
    assertSameOrg(await ctx.db.get(args.artifactId), org._id, "email");
    const rows = await ctx.db.query("approvals").withIndex("by_subject", q => q.eq("subjectType", "email_send").eq("subjectId", args.artifactId))
      .filter(q => q.and(q.eq(q.field("orgId"), org._id), q.eq(q.field("executionReconciledAt"), undefined), q.neq(q.field("executionStartedAt"), undefined), q.or(q.eq(q.field("executionFinishedAt"), undefined), q.eq(q.field("executionOutcome"), "uncertain")))).order("desc").take(11);
    return { omitted: rows.length > 10, items: rows.slice(0, 10).map(a => ({ id: a._id, title: a.title, versionId: a.scope.artifactVersionId ?? null, startedAt: a.executionStartedAt!, availableAt: (a.emailSendDispatchedAt ?? a.executionStartedAt!) + EMAIL_RECOVERY_WAIT_MS, resolving: Boolean(a.emailRecovery), canCheck: !a.emailRecovery && can(role, "approve") && a.emailSendDispatchedAt !== undefined && Boolean(a.executionExternalId && a.emailProviderPayloadHash && a.emailRecipientHashBatches?.length), message: a.recoveryMessage ?? "The send result is unknown. Do not send another copy while this is unresolved." })) };
  },
});
export const emailRecoveryContext = internalQuery({ args: recoveryArgs, handler: readEmailRecovery });

export const recordEmailRecovery = internalMutation({
  args: { ...recoveryArgs, fingerprint: v.string(), requestedAt: v.number(), providerStatus: v.optional(v.string()), matches: v.boolean(), sentAt: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const c = await readEmailRecovery(ctx, args);
    if (c.fingerprint !== args.fingerprint) throw appError("INVALID", "The email request changed during this check. Refresh its result.");
    const a = c.approval, now = Date.now();
    const confirmed = args.matches && args.providerStatus === "sent" && args.sentAt !== undefined && Number.isFinite(args.sentAt) && args.sentAt >= a.emailSendDispatchedAt! - 60_000 && args.sentAt <= now;
    const message = confirmed ? "Resend reports the original approved broadcast as sent. This does not confirm delivery, reads or customer outcomes. No new send was requested." : "The provider result could not confirm the original approved broadcast was sent. The allowance remains held; do not send another copy. Check the original Resend account.";
    // Preserve the original execution outcome and receipt, adding a separately dated observation.
    await ctx.db.patch(a._id, { recoveryCheckedAt: now, recoveryMessage: message });
    if (confirmed) {
      // Contact updates are applied in bounded batches before resolution releases the send hold.
      await ctx.db.patch(a._id, { emailRecovery: { sentAt: args.sentAt!, checkedAt: now, nextOffset: 0 } });
      await ctx.scheduler.runAfter(0, internal.marketing.finishEmailRecovery, { approvalId: a._id, offset: 0, checkedAt: now });
    }
    await ctx.db.insert("actionReceipts", { orgId: c.org._id, artifactId: args.artifactId, provider: "resend_marketing", action: "reconcile_email_send", idempotencyKey: `${a._id}:reconcile:${args.requestedAt}`, status: confirmed ? "verified" : "uncertain", externalId: a.executionExternalId, summary: message, createdAt: now, ...(confirmed ? { verifiedAt: now } : {}) });
    await audit(ctx, { orgId: c.org._id, actorType: "user", actorId: c.user._id, action: confirmed ? "email.recovery.confirmed" : "email.recovery.unresolved", subjectType: "artifact", subjectId: args.artifactId, summary: message });
    return { confirmed, message };
  },
});

/** Complete accounting in bounded batches; no provider calls or sending authority. */
export const finishEmailRecovery = internalMutation({
  args: { approvalId: v.id("approvals"), offset: v.number(), checkedAt: v.number() },
  handler: async (ctx, args) => {
    const a = await ctx.db.get(args.approvalId);
    if (!a || !unresolvedEmail(a) || !a.emailRecovery || a.emailRecovery.checkedAt !== args.checkedAt || a.emailRecovery.nextOffset !== args.offset || !a.emailRecipientHashBatches?.length) return;
    const hashes = a.emailRecipientHashBatches.flat();
    await recordJourneyAcceptance(ctx, a, hashes.slice(args.offset, args.offset + 200), a.emailRecovery.sentAt, "provider_reconciled");
    for (const hash of hashes.slice(args.offset, args.offset + 200)) {
      const contact = await ctx.db.query("contacts").withIndex("by_org_email", q => q.eq("orgId", a.orgId).eq("emailHash", hash)).first();
      if (contact && !contact.deletedAt) await ctx.db.patch(contact._id, { lastMarketingEmailAt: Math.max(contact.lastMarketingEmailAt ?? 0, a.emailRecovery.sentAt) });
    }
    if (args.offset + 200 < hashes.length) {
      await ctx.db.patch(a._id, { emailRecovery: { ...a.emailRecovery, nextOffset: args.offset + 200 } });
      await ctx.scheduler.runAfter(0, internal.marketing.finishEmailRecovery, { ...args, offset: args.offset + 200 });
      return;
    }
    const id = a.scope.reservationId ? ctx.db.normalizeId("usageReservations", a.scope.reservationId) : null;
    const reservation = id ? await ctx.db.get(id) : null;
    const period = reservation ? await ctx.db.get(reservation.periodId) : null;
    if (!reservation || !period || reservation.orgId !== a.orgId || period.orgId !== a.orgId || !["held", "unresolved"].includes(reservation.status) || reservation.purpose !== "email_send" || reservation.meters.byoMarketingSends === undefined || reservation.meters.byoMarketingSends !== a.scope.spendLimitMinor || new Set(hashes).size !== a.scope.spendLimitMinor) throw appError("INVALID", "The original allowance changed during recovery.");
    const released = releaseReservation(ledgerOf(period), { walletMicros: 0, topupMicros: 0, meters: reservation.meters });
    released.meterUsed = { ...released.meterUsed, byoMarketingSends: released.meterUsed.byoMarketingSends + reservation.meters.byoMarketingSends };
    await ctx.db.patch(period._id, ledgerPatch(released));
    await ctx.db.patch(reservation._id, { status: "reconciled", reconciledAt: Date.now() });
    await ctx.db.patch(a._id, { status: "consumed", executionReconciledAt: Date.now(), emailRecovery: undefined, invalidatedReason: undefined });
  },
});

export const checkSendResult = action({
  args: recoveryArgs,
  handler: async (ctx, args): Promise<{ confirmed: boolean; message: string }> => {
    const c: EmailRecoveryContext = await ctx.runQuery(internal.marketing.emailRecoveryContext, args);
    const requestedAt = Date.now();
    const secret = await ctx.runQuery(internal.connections.getSecret, { connectionId: c.connection._id });
    if (!secret || secret.orgId !== c.org._id || secret.secretId !== c.credentialId || secret.provider !== "email_resend") throw appError("INVALID", "The original email credentials are unavailable.");
    const { apiKey } = JSON.parse(secret.value) as { apiKey: string };
    let matches = false, providerStatus: string | undefined, sentAt: number | undefined;
    try {
      const result = await getBroadcast({ apiKey, broadcastId: c.approval.executionExternalId! });
      if (result.ok) {
        const b = result.data;
        providerStatus = b.status;
        sentAt = b.sentAt && /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}(?::?\d{2})?)$/i.test(b.sentAt) ? Date.parse(b.sentAt) : undefined;
        if (!Number.isFinite(sentAt)) sentAt = undefined;
        matches = !b.malformedFields?.length && b.id === c.approval.executionExternalId && b.name === `climbos-${c.approval._id}` && b.segmentId === c.approval.scope.destination && typeof b.subject === "string" && typeof b.html === "string" && typeof b.from === "string" && await sha256Hex(canonicalJson({ subject: b.subject, html: b.html, from: b.from })) === c.approval.contentHash && await sha256Hex(canonicalJson(broadcastPayload(b))) === c.approval.emailProviderPayloadHash;
      }
    } catch { /* A read failure is unknown, never proof that a send did not happen. */ }
    return ctx.runMutation(internal.marketing.recordEmailRecovery, { ...args, fingerprint: c.fingerprint, requestedAt, matches, providerStatus, sentAt });
  },
});
