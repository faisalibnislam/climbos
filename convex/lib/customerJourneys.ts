import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { appError, assertSameOrg } from "./tenancy";
import { can, canonicalJson } from "../../shared/policy";
import { journeyDueAt, MAX_JOURNEY_CONTACTS } from "../../shared/growth/customerJourneys";
import { progressEligibility, type CustomerProgressRule } from "../../shared/growth/customerProgress";
import { marketingContactRows, recordedMarketingConsent } from "./marketingAudience";
import { fleetStopped } from "./access";

export const journeyStepRefV = v.object({ journeyId: v.id("customerJourneys"), revision: v.number(), stepIndex: v.number() });
export type JourneyStepRef = { journeyId: Id<"customerJourneys">; revision: number; stepIndex: number };

export async function journeyOwnerActive(ctx: QueryCtx, journey: Doc<"customerJourneys">) {
  const member = await ctx.db.query("memberships").withIndex("by_org_user", q => q.eq("orgId", journey.orgId).eq("userId", journey.trackingOwnerId)).unique();
  return member?.status === "active" && can(member.role, "manage_connections");
}
export async function checkedJourneyStep(ctx: QueryCtx, orgId: Id<"organizations">, ref: JourneyStepRef, segment: string, rule?: CustomerProgressRule) {
  const journey = assertSameOrg(await ctx.db.get(ref.journeyId), orgId, "follow-up journey");
  const org = await ctx.db.get(orgId);
  if (!org || org.deletedAt !== undefined || org.suspendedAt !== undefined || org.emergencyStop?.active || await fleetStopped(ctx) || journey.status !== "active" || !await journeyOwnerActive(ctx, journey)) throw appError("INVALID", "This follow-up journey is paused or its owner no longer has access. Review it before sending.");
  if (journey.checkError || journey.checkedAt === undefined) throw appError("INVALID", journey.checkError ?? "Check this journey's audience before sending.");
  if (journey.revision !== ref.revision || !Number.isInteger(ref.stepIndex) || !journey.steps[ref.stepIndex] || journey.segment !== segment || !rule || canonicalJson({ ...journey.rule }) !== canonicalJson({ ...rule })) throw appError("INVALID", "The follow-up step or audience changed. Open it again from Customers.");
  const step = journey.steps[ref.stepIndex];
  const artifact = await ctx.db.get(step.artifactId);
  const version = await ctx.db.get(step.artifactVersionId);
  if (!artifact || artifact.orgId !== orgId || artifact.currentVersionId !== step.artifactVersionId || !version || version.orgId !== orgId || version.artifactId !== artifact._id || version.version !== artifact.currentVersion) throw appError("INVALID", "The saved follow-up draft changed. Create a new journey with the version you intend to use.");
  return { journey, step };
}

/** Data-only tracking. No provider, billing, approval or send calls. Terminal entries never re-enroll. */
export async function refreshJourney(ctx: MutationCtx, journey: Doc<"customerJourneys">) {
  const now = Date.now(), nextCheckAt = now + 15 * 60_000;
  if (journey.status !== "active") return;
  const org = await ctx.db.get(journey.orgId);
  if (!org || org.deletedAt !== undefined || org.suspendedAt !== undefined || org.emergencyStop?.active || await fleetStopped(ctx) || !await journeyOwnerActive(ctx, journey)) {
    await ctx.db.patch(journey._id, { nextCheckAt, checkError: "Tracking is held while the workspace is paused or the journey owner lacks access." });
    return;
  }
  const entries = await ctx.db.query("journeyContacts").withIndex("by_journey", q => q.eq("journeyId", journey._id)).take(MAX_JOURNEY_CONTACTS + 1);
  let contacts: Doc<"contacts">[];
  try { contacts = await marketingContactRows(ctx, journey.orgId); }
  catch { await ctx.db.patch(journey._id, { nextCheckAt, checkError: "The complete contact list could not be checked. No new step can be approved." }); return; }
  const segment = contacts.filter(c => c.deletedAt === undefined && c.segments.includes(journey.segment));
  if (entries.length > MAX_JOURNEY_CONTACTS || segment.length > MAX_JOURNEY_CONTACTS) {
    await ctx.db.patch(journey._id, { nextCheckAt, checkError: `This follow-up supports at most ${MAX_JOURNEY_CONTACTS} contacts. Use a smaller group; no partial audience is authorized.` }); return;
  }
  const byContact = new Map(entries.map(e => [e.contactId, e]));
  const candidates = [...new Map([...segment, ...contacts.filter(c => byContact.has(c._id))].map(c => [c._id, c])).values()];
  const checks: { contact: Doc<"contacts">; status: "active" | "held" | "exited"; reason: string }[] = [];
  // Finish all reads before writing. Incomplete checks hold the whole journey.
  try {
    for (const contact of candidates) {
      if (["exited", "completed"].includes(byContact.get(contact._id)?.status ?? "")) continue;
      const consent = await recordedMarketingConsent(ctx, journey.orgId, contact._id);
      const suppressed = await ctx.db.query("suppressions").withIndex("by_org_email", q => q.eq("orgId", journey.orgId).eq("emailHash", contact.emailHash)).first();
      if (contact.deletedAt !== undefined || !contact.segments.includes(journey.segment) || !consent || suppressed) { checks.push({ contact, status: "exited", reason: "No longer in this group with usable email permission." }); continue; }
      const reports = await ctx.db.query("contactProgress").withIndex("by_org_contact", q => q.eq("orgId", journey.orgId).eq("contactId", contact._id)).take(2);
      const result = progressEligibility(reports.length === 1 ? reports[0].progress : undefined, journey.rule, now);
      const status = result.status === "eligible" && contact.emailCiphertext && contact.emailIv ? "active" : result.status === "different_progress" ? "exited" : "held";
      checks.push({ contact, status, reason: status === "active" ? "Recent progress report matches; each send still needs approval." : status === "exited" ? "The reported progress or its definition changed." : "A recent matching progress report and usable address are needed." });
    }
  } catch { await ctx.db.patch(journey._id, { nextCheckAt, checkError: "The complete consent and progress history could not be checked. No new step can be approved." }); return; }
  const newEntries = checks.filter(c => c.status === "active" && !byContact.has(c.contact._id));
  if (entries.length + newEntries.length > MAX_JOURNEY_CONTACTS) {
    await ctx.db.patch(journey._id, { nextCheckAt, checkError: `This journey has reached its ${MAX_JOURNEY_CONTACTS}-contact history limit. Create a separate, smaller follow-up; completed contacts are never silently restarted.` }); return;
  }
  for (const check of checks) {
    const existing = byContact.get(check.contact._id);
    if (existing) {
      if (existing.status !== check.status || existing.reason !== check.reason) await ctx.db.patch(existing._id, { status: check.status, reason: check.reason, updatedAt: now });
    } else if (check.status === "active") {
      await ctx.db.insert("journeyContacts", { orgId: journey.orgId, journeyId: journey._id, contactId: check.contact._id, status: "active", stepIndex: 0, enrolledAt: now, dueAt: journeyDueAt(now, journey.steps[0].delayDays)!, reason: check.reason, updatedAt: now, accepted: [] });
    }
  }
  for (const entry of entries) if ((entry.status === "active" || entry.status === "held") && !contacts.some(c => c._id === entry.contactId)) await ctx.db.patch(entry._id, { status: "exited", reason: "The contact was removed.", updatedAt: now });
  await ctx.db.patch(journey._id, { checkedAt: now, nextCheckAt, checkError: undefined });
}
export async function journeyRecipientEvidence(ctx: QueryCtx, orgId: Id<"organizations">, ref: JourneyStepRef, contactId: Id<"contacts">, now: number) {
  const row = await ctx.db.query("journeyContacts").withIndex("by_journey_contact", q => q.eq("journeyId", ref.journeyId).eq("contactId", contactId)).unique();
  if (!row || row.orgId !== orgId || row.status !== "active" || row.stepIndex !== ref.stepIndex || row.dueAt > now) return null;
  return { enrollmentId: row._id, stepIndex: row.stepIndex, dueAt: row.dueAt };
}
/** Accepted by the original provider only. An observation is not delivery, reading, activation or permission for the next step. */
export async function recordJourneyAcceptance(ctx: MutationCtx, approval: Doc<"approvals">, hashes: string[], acceptedAt: number, basis: "provider_accepted" | "provider_reconciled") {
  const ref = approval.scope.journeyStep;
  if (!ref || !Number.isSafeInteger(acceptedAt) || acceptedAt < 0 || acceptedAt > Date.now() || approval.emailSendDispatchedAt === undefined) return;
  const journey = await ctx.db.get(ref.journeyId);
  const step = journey?.steps[ref.stepIndex];
  if (!journey || journey.orgId !== approval.orgId || !step || step.artifactId !== approval.subjectId || step.artifactVersionId !== approval.scope.artifactVersionId || approval.actionKind !== `send:${step.emailIndex}`) return;
  const dispatched = new Set(approval.emailRecipientHashBatches?.flat() ?? []);
  const reviewed = new Map(approval.emailJourneyRecipients?.map(r => [r.emailHash, r]) ?? []);
  for (const emailHash of new Set(hashes)) {
    if (!dispatched.has(emailHash)) continue;
    const original = reviewed.get(emailHash);
    if (!original || original.stepIndex !== ref.stepIndex) continue;
    const row = await ctx.db.get(original.enrollmentId);
    if (!row || row.orgId !== approval.orgId || row.journeyId !== journey._id || row.stepIndex !== ref.stepIndex || row.dueAt !== original.dueAt || row.accepted.some(x => x.approvalId === approval._id)) continue;
    const contact = await ctx.db.get(row.contactId);
    if (!contact || contact.orgId !== approval.orgId || contact.emailHash !== emailHash || contact.deletedAt !== undefined) continue;
    const next = journey.steps[row.stepIndex + 1];
    const accepted = [...row.accepted, { stepIndex: row.stepIndex, approvalId: approval._id, acceptedAt, basis }];
    const terminal = row.status === "exited" || row.status === "completed";
    await ctx.db.patch(row._id, { accepted, ...(terminal ? {} : { stepIndex: row.stepIndex + 1, status: next ? row.status : "completed", dueAt: next ? journeyDueAt(acceptedAt, next.delayDays)! : acceptedAt, reason: next ? row.reason : "Every step has a provider acceptance record; customer outcomes remain unknown." }), updatedAt: Date.now() });
  }
}
