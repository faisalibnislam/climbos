import { v } from "convex/values";
import { requirePaid } from "./lib/access";
import { parseCsv } from "../shared/integrations/csvRevenue";
import {
  contactRefusalReason,
  createDraftBroadcast,
  listSegments,
  RESEND_UNSUBSCRIBE_PLACEHOLDER,
  SEND_BROADCAST_ACTION,
  sendBroadcast,
  upsertMarketingContact,
} from "../shared/integrations/resendMarketing";
import { approvalHash, canonicalJson, sha256Hex } from "../shared/policy";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
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

const MAX_CONTACT_ROWS = 10_000;
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

async function segmentStats(ctx: { db: import("./_generated/server").QueryCtx["db"] }, orgId: Id<"organizations">) {
  const contacts = await ctx.db
    .query("contacts")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .take(10_000);
  const bySegment = new Map<string, { total: number; consented: number; suppressed: number }>();
  for (const c of contacts) {
    if (c.deletedAt) continue;
    const consents = await ctx.db
      .query("consentRecords")
      .withIndex("by_org_contact", (q) => q.eq("orgId", orgId).eq("contactId", c._id))
      .take(5);
    const consented = consents.some((r) => r.purpose === "marketing_email" && !r.withdrawnAt);
    const suppressed = Boolean(
      await ctx.db
        .query("suppressions")
        .withIndex("by_org_email", (q) => q.eq("orgId", orgId).eq("emailHash", c.emailHash))
        .first(),
    );
    for (const s of c.segments) {
      const st = bySegment.get(s) ?? { total: 0, consented: 0, suppressed: 0 };
      st.total++;
      if (suppressed) st.suppressed++;
      else if (consented) st.consented++;
      bySegment.set(s, st);
    }
  }
  return [...bySegment.entries()].map(([segment, s]) => ({ segment, ...s, sendable: s.consented }));
}

export const audience = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const resend = await ctx.db
      .query("connections")
      .withIndex("by_org_provider", (q) => q.eq("orgId", org._id).eq("provider", "email_resend"))
      .first();
    return {
      segments: await segmentStats(ctx, org._id),
      providerConnected: resend?.status === "connected",
      note: "Only people with a recorded marketing opt-in can be emailed. Unsubscribes, bounces and complaints are always excluded.",
    };
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

function splitSequence(body: string): { subject: string; text: string }[] {
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
  },
  handler: async (ctx, args) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: args.slug }, "approve");
    await requirePaid(ctx, org, "sending");
    const a = assertSameOrg(await ctx.db.get(args.artifactId), org._id, "email");
    if (a.kind !== "email_sequence" && a.kind !== "email") throw appError("INVALID", "Only email drafts can be sent.");
    if (a.status !== "approved") throw appError("INVALID", "Approve the email content first.");
    if (!/^[^<>]*<?[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}>?$/i.test(args.from.trim())) throw appError("INVALID", "Enter a sender like “Your Name <hello@yourdomain.com>” on a domain verified in your Resend account.");
    const access = await chargeableAccess(ctx, org);
    if (!access.allowed) throw appError(access.code === "PAUSED" ? "PAUSED" : "PAYMENT_REQUIRED", access.message);
    const ver = a.currentVersionId ? await ctx.db.get(a.currentVersionId) : null;
    const emails = ver ? splitSequence(ver.body) : [];
    const email = emails[args.emailIndex] ?? (a.kind === "email" && ver ? { subject: ver.headline ?? a.title, text: ver.body } : undefined);
    if (!email) throw appError("INVALID", "We couldn't find that email in the draft.");
    const stats = (await segmentStats(ctx, org._id)).find((s) => s.segment === args.segment);
    if (!stats || stats.sendable === 0) throw appError("INVALID", "Nobody in this segment has a recorded marketing opt-in. ClimbOS won't send without one.");
    // Reserve the send volume against the plan's marketing-send quota (customer's provider bill is separate).
    const period = access.period;
    const decision = decideReservation(ledgerOf(period), { costMicros: 0, topupCostMicros: 0, meters: { byoMarketingSends: stats.sendable } });
    if (!decision.ok) throw appError("LIMIT_REACHED", decision.message);
    await ctx.db.patch(period._id, ledgerPatch(decision.next));
    const policyVersion = await activePolicyVersion(ctx, org._id);
    const now = Date.now();
    const expiresAt = now + 24 * 3_600_000;
    const contentHash = await sha256Hex(canonicalJson({ subject: email.subject, text: email.text, from: args.from.trim() }));
    const scope = { destination: args.providerSegmentId, audience: args.segment, spendLimitMinor: stats.sendable };
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
    const reservationId = await ctx.db.insert("usageReservations", { orgId: org._id, periodId: period._id, purpose: "email_send", walletMicros: 0, topupMicros: 0, meters: { byoMarketingSends: stats.sendable }, status: "held", createdAt: now });
    await ctx.scheduler.runAfter(0, internal.marketing.executeSend, { approvalId, reservationId, subject: email.subject, html: toHtml(email.text, org.name), from: args.from.trim(), segment: args.segment, providerSegmentId: args.providerSegmentId });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "email.send_approved", subjectType: "artifact", subjectId: a._id, summary: `Approved sending “${email.subject}” to ${stats.sendable} opted-in contact(s) in “${args.segment}”.` });
    return { recipients: stats.sendable };
  },
});

export const sendContext = internalQuery({
  args: { approvalId: v.id("approvals"), segment: v.string() },
  handler: async (ctx, { approvalId, segment }) => {
    const approval = await ctx.db.get(approvalId);
    if (!approval) return null;
    const org = await ctx.db.get(approval.orgId);
    if (!org) return null;
    const conn = await ctx.db
      .query("connections")
      .withIndex("by_org_provider", (q) => q.eq("orgId", org._id).eq("provider", "email_resend"))
      .first();
    const contacts = (
      await ctx.db
        .query("contacts")
        .withIndex("by_org", (q) => q.eq("orgId", org._id))
        .take(10_000)
    ).filter((c) => !c.deletedAt && c.segments.includes(segment));
    const recipients = [];
    for (const c of contacts) {
      const consent = (
        await ctx.db
          .query("consentRecords")
          .withIndex("by_org_contact", (q) => q.eq("orgId", org._id).eq("contactId", c._id))
          .take(5)
      ).find((r) => r.purpose === "marketing_email" && !r.withdrawnAt);
      const suppressed = Boolean(
        await ctx.db
          .query("suppressions")
          .withIndex("by_org_email", (q) => q.eq("orgId", org._id).eq("emailHash", c.emailHash))
          .first(),
      );
      recipients.push({ ciphertext: c.emailCiphertext ?? "", iv: c.emailIv ?? "", firstName: c.displayName?.split(" ")[0], consent: consent ? { source: consent.source, grantedAt: consent.capturedAt } : null, suppressed });
    }
    return { approval, org, connectionId: conn?.status === "connected" ? conn._id : null, recipients, paused: Boolean(org.emergencyStop?.active) };
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
  },
  handler: async (ctx, args) => {
    const approval = await ctx.db.get(args.approvalId);
    const reservation = await ctx.db.get(args.reservationId);
    if (!approval || !reservation) return;
    const period = await ctx.db.get(reservation.periodId);
    if (period && reservation.status === "held") {
      const released = releaseReservation(ledgerOf(period), { walletMicros: 0, topupMicros: 0, meters: reservation.meters });
      released.meterUsed = { ...released.meterUsed, byoMarketingSends: released.meterUsed.byoMarketingSends + args.sent };
      await ctx.db.patch(period._id, ledgerPatch(released));
      await ctx.db.patch(reservation._id, { status: args.status === "uncertain" ? "unresolved" : "reconciled", reconciledAt: Date.now() });
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
    if (args.status === "verified") await ctx.db.patch(approval._id, { status: "consumed" });
    await audit(ctx, { orgId: approval.orgId, actorType: "system", action: `email.send.${args.status}`, summary: args.summary.slice(0, 300) });
  },
});

export const executeSend = internalAction({
  args: {
    approvalId: v.id("approvals"),
    reservationId: v.id("usageReservations"),
    subject: v.string(),
    html: v.string(),
    from: v.string(),
    segment: v.string(),
    providerSegmentId: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    const c = await ctx.runQuery(internal.marketing.sendContext, { approvalId: args.approvalId, segment: args.segment });
    if (!c) return;
    const fail = async (summary: string): Promise<void> => {
      await ctx.runMutation(internal.marketing.finishSend, { approvalId: args.approvalId, reservationId: args.reservationId, status: "failed", sent: 0, summary });
    };
    if (c.paused) return fail("Not sent: all activity is paused.");
    if (c.approval.status !== "approved" || c.approval.expiresAt < Date.now()) return fail("Not sent: the approval is no longer valid.");
    if (!c.connectionId) return fail("Not sent: connect your own Resend account first.");
    const secret = await ctx.runQuery(internal.connections.getSecret, { connectionId: c.connectionId });
    if (!secret) return fail("Not sent: the email provider connection was removed.");
    const { apiKey } = JSON.parse(secret.value) as { apiKey: string };
    let synced = 0;
    for (const r of c.recipients) {
      if (!r.consent || r.suppressed || !r.ciphertext) continue;
      const [keyId, iv] = r.iv.split(":");
      const email = await decryptSecret({ keyId, iv, ciphertext: r.ciphertext }, contactAad(c.org._id));
      const contact = { email, firstName: r.firstName, consent: { purpose: "marketing_email", source: r.consent.source, grantedAt: r.consent.grantedAt }, suppressed: r.suppressed, segmentIds: [args.providerSegmentId] };
      if (contactRefusalReason(contact)) continue;
      const res = await upsertMarketingContact({ apiKey, contact });
      if (res.status === "verified") synced++;
    }
    if (synced === 0) return fail("Not sent: no opted-in, unsuppressed contacts could be synced.");
    const draft = await createDraftBroadcast({ apiKey, draft: { segmentId: args.providerSegmentId, from: args.from, subject: args.subject, html: args.html, name: `climbos-${args.approvalId}` } });
    if (draft.status !== "verified" || !draft.externalId) {
      await ctx.runMutation(internal.marketing.finishSend, { approvalId: args.approvalId, reservationId: args.reservationId, status: draft.status === "uncertain" ? "uncertain" : "failed", sent: 0, summary: draft.providerMessage ?? "Your email provider didn't accept the draft." });
      return;
    }
    const sent = await sendBroadcast({ apiKey, broadcastId: draft.externalId, approval: { kind: SEND_BROADCAST_ACTION, targetId: draft.externalId, value: "now", approvedBy: String(c.approval.decidedBy ?? "owner"), approvedAt: Date.now() } });
    await ctx.runMutation(internal.marketing.finishSend, {
      approvalId: args.approvalId,
      reservationId: args.reservationId,
      status: sent.status,
      sent: sent.status === "verified" ? synced : 0,
      externalId: draft.externalId,
      summary: sent.status === "verified" ? `Accepted by your email provider for ${synced} opted-in contact(s).` : (sent.providerMessage ?? "Your email provider didn't send it."),
    });
  },
});
