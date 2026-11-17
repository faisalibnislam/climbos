import { checkContactFrequency, frequencyBlockMessage, type ContactHistory } from "../../shared/growth/contactFrequency";
import { sha256Hex } from "../../shared/policy";
import type { Id, Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

const ACTIVE_OUTBOUND_STATUSES: Doc<"outboundSends">["status"][] = ["queued", "sending", "uncertain"];

/** True while this workspace has an unresolved owner-started prospect sequence for the address. */
export async function hasActiveOutboundSequence(
  ctx: QueryCtx | MutationCtx,
  orgId: Id<"organizations">,
  email: string,
  excludingSendId?: Id<"outboundSends">,
): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  const hash = await sha256Hex(normalized);
  const indexed = await Promise.all(ACTIVE_OUTBOUND_STATUSES.map((status) =>
    ctx.db.query("outboundSends").withIndex("by_org_recipient_status", (q) => q.eq("orgId", orgId).eq("recipientHash", hash).eq("status", status)).take(2),
  ));
  if (indexed.some((rows) => rows.some((row) => row._id !== excludingSendId))) return true;

  // Older sends predate recipientHash. Check their original prospect address exactly;
  // if that bounded legacy lookup is ambiguous, conservatively refuse the message.
  const legacyProspects = await ctx.db.query("prospects").withIndex("by_org_email", (q) => q.eq("orgId", orgId).eq("publicEmail", email)).take(301);
  if (legacyProspects.length > 300) return true;
  for (const prospect of legacyProspects) {
    const sends = await ctx.db.query("outboundSends").withIndex("by_prospect", (q) => q.eq("prospectId", prospect._id).eq("step", 0)).take(21);
    if (sends.length > 20 || sends.some((send) => send._id !== excludingSendId && ACTIVE_OUTBOUND_STATUSES.includes(send.status))) return true;
  }
  return false;
}

/** Queued, in-flight and unresolved public-review invitations occupy this address until resolved. */
export async function hasQueuedReviewInvitation(ctx: QueryCtx | MutationCtx, orgId: Id<"organizations">, email: string): Promise<boolean> {
  const rows = await Promise.all((["queued", "sending", "uncertain"] as const).map(status => ctx.db.query("reviewRequests").withIndex("by_org_email_status", q =>
    q.eq("orgId", orgId).eq("email", email.trim().toLowerCase()).eq("status", status),
  ).first()));
  return rows.some(Boolean);
}

/** Exact tenant/address history, including pre-recovery rows. No sent time is inferred from creation time. */
export async function reviewContactHistory(ctx: QueryCtx, orgId: Id<"organizations">, email: string, excludingRequestId?: Id<"reviewRequests">): Promise<Partial<ContactHistory>> {
  const address = email.trim().toLowerCase();
  const active = await Promise.all((["queued", "sending", "uncertain"] as const).map(status => ctx.db.query("reviewRequests").withIndex("by_org_email_status", q => q.eq("orgId", orgId).eq("email", address).eq("status", status)).take(2)));
  const latest = await ctx.db.query("reviewRequests").withIndex("by_org_email_status_sent", q => q.eq("orgId", orgId).eq("email", address).eq("status", "sent")).order("desc").first();
  // Only undated receipts need bounded inspection. Dated receipts use the index's actual maximum.
  const undated = await ctx.db.query("reviewRequests").withIndex("by_org_email_status_sent", q => q.eq("orgId", orgId).eq("email", address).eq("status", "sent").eq("sentAt", undefined)).take(101);
  const failures = await ctx.db.query("reviewRequests").withIndex("by_org_email_status", q => q.eq("orgId", orgId).eq("email", address).eq("status", "failed")).take(101);
  const unresolvedFailure = failures.some(r => !r.notSentConfirmed && !(r.recovery?.source === "owner_reported" && r.recovery.outcome === "not_sent"));
  let unknownReviewHistory = undated.length > 100 || failures.length > 100 || unresolvedFailure;
  const now = Date.now();
  const validSentAt = latest?.sentAt !== undefined && Number.isFinite(latest.sentAt) && latest.sentAt >= 0 && latest.sentAt <= now;
  if (latest?.sentAt !== undefined && !validSentAt) unknownReviewHistory = true;
  let reviewObservedAt: number | undefined;
  for (const row of undated) {
    if (row.recovery?.outcome !== "sent" || !Number.isFinite(row.recovery.at) || row.recovery.at < 0 || row.recovery.at > now) { unknownReviewHistory = true; continue; }
    // A matching Sent copy / explicit owner observation establishes only that the send preceded observation.
    reviewObservedAt = Math.max(reviewObservedAt ?? 0, row.recovery.at);
  }
  return {
    activeReview: active.some(rows => rows.some(r => r._id !== excludingRequestId)),
    ...(validSentAt ? { lastReviewSentAt: latest!.sentAt } : {}),
    ...(reviewObservedAt !== undefined ? { reviewObservedAt } : {}),
    ...(unknownReviewHistory ? { unknownReviewHistory } : {}),
  };
}

/** Reuse the same owner policy in review/outreach eligibility and transactional dispatch claims. */
export async function recipientContactPressure(ctx: QueryCtx, org: Doc<"organizations">, email: string, excludingRequestId?: Id<"reviewRequests">, pendingMarketing?: Set<string> | null) {
  if (!org.contactFrequencyDays) return null;
  const hash = await sha256Hex(email.trim().toLowerCase());
  const contacts = await ctx.db.query("contacts").withIndex("by_org_email", q => q.eq("orgId", org._id).eq("emailHash", hash)).take(101);
  // A deleted/suppressed contact does not erase its previous send from this separate eligibility check.
  const lastMarketingEmailAt = Math.max(0, ...contacts.map(c => c.lastMarketingEmailAt ?? 0));
  const outreach = await outreachHistoryByHash(ctx, org._id, hash);
  const review = await reviewContactHistory(ctx, org._id, email, excludingRequestId);
  const check = checkContactFrequency([{ ...outreach, ...review, lastMarketingEmailAt, activeOutreach: false }], org.contactFrequencyDays, Date.now())!;
  // Active outreach has a separate sequence-aware check; a follow-up must not block itself.
  const pending = pendingMarketing === undefined ? await pendingMarketingRecipients(ctx, org._id) : pendingMarketing;
  if (contacts.length > 100 || pending === null) check.unknownMarketingAudience = true;
  else if (pending.has(hash)) check.activeMarketing = 1;
  return { check, message: frequencyBlockMessage(check, org.contactFrequencyDays) };
}

/** History for one contact hash: last ClimbOS outreach send and whether an outreach sequence is still active. */
export async function outreachHistoryByHash(ctx: QueryCtx | MutationCtx, orgId: Id<"organizations">, recipientHash: string): Promise<{ activeOutreach: boolean; lastOutreachSentAt?: number }> {
  const active = await Promise.all(ACTIVE_OUTBOUND_STATUSES.map((status) =>
    ctx.db.query("outboundSends").withIndex("by_org_recipient_status", (q) => q.eq("orgId", orgId).eq("recipientHash", recipientHash).eq("status", status)).first(),
  ));
  // Creation order is not send order: queued steps and delayed reconciliation
  // can have older rows with newer send times. Read the actual maximum, without
  // treating a bounded sample of the recipient's history as complete.
  const sent = await ctx.db.query("outboundSends").withIndex("by_org_recipient_status_sent", (q) => q.eq("orgId", orgId).eq("recipientHash", recipientHash).eq("status", "sent")).order("desc").first();
  const last = sent?.sentAt;
  return { activeOutreach: active.some(Boolean), ...(last ? { lastOutreachSentAt: last } : {}) };
}

/** Complete bounded lookup of running/uncertain attempts, including legacy approvals.
 * Read and claim in the same mutation so overlapping claims conflict transactionally.
 * Never infer "not sent" from an expired approval or an invalidated uncertain result.
 */
export async function pendingMarketingRecipients(ctx: QueryCtx, orgId: Id<"organizations">, excludingApprovalId?: Id<"approvals">): Promise<Set<string> | null> {
  const maxAttempts = 8; // Each record can contain up to 10,000 recipient hashes.
  const running = await ctx.db.query("approvals").withIndex("by_org_email_execution", q => q.eq("orgId", orgId).eq("subjectType", "email_send").eq("executionOutcome", undefined).eq("executionReconciledAt", undefined).eq("executionFinishedAt", undefined).gte("executionStartedAt", 0))
    .filter(q => q.neq(q.field("_id"), excludingApprovalId)).take(maxAttempts + 1);
  if (running.length > maxAttempts) return null;
  const uncertain = await ctx.db.query("approvals").withIndex("by_org_email_execution", q => q.eq("orgId", orgId).eq("subjectType", "email_send").eq("executionOutcome", "uncertain").eq("executionReconciledAt", undefined))
    .filter(q => q.neq(q.field("_id"), excludingApprovalId)).take(maxAttempts - running.length + 1);
  if (running.length + uncertain.length > maxAttempts) return null;
  const hashes = new Set<string>();
  for (const attempt of [...running, ...uncertain]) {
    const batches = attempt.emailRecipientHashBatches;
    if (!batches?.length || batches.length > 50 || batches.some(b => !b.length || b.length > 200)) return null;
    const recipients = batches.flat();
    if (recipients.length !== attempt.scope.spendLimitMinor || new Set(recipients).size !== recipients.length || recipients.some(h => !/^[a-f0-9]{64}$/.test(h))) return null;
    for (const hash of recipients) hashes.add(hash);
  }
  return hashes;
}
