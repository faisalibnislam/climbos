import { customerProgressEvidence } from "../../shared/growth/customerProgress";
import { currentMarketingConsent, type EmailAudienceSnapshot } from "../../shared/growth/emailAudience";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { appError } from "./tenancy";

export const MAX_MARKETING_CONTACTS = 10_000;
const MAX_CONSENT_RECORDS = 100;
const PLANNING_SAMPLE = 1000;

export async function marketingContactRows(ctx: Pick<QueryCtx, "db">, orgId: Id<"organizations">) {
  const rows = await ctx.db.query("contacts").withIndex("by_org", q => q.eq("orgId", orgId)).take(MAX_MARKETING_CONTACTS + 1);
  if (rows.length > MAX_MARKETING_CONTACTS) throw appError("LIMIT_REACHED", "This workspace's audience is too large to verify completely. No send was authorized.");
  return rows;
}

export async function recordedMarketingConsent(ctx: Pick<QueryCtx, "db">, orgId: Id<"organizations">, contactId: Id<"contacts">) {
  const rows = await ctx.db.query("consentRecords").withIndex("by_org_contact", q => q.eq("orgId", orgId).eq("contactId", contactId)).take(MAX_CONSENT_RECORDS + 1);
  if (rows.length > MAX_CONSENT_RECORDS) throw appError("LIMIT_REACHED", "A contact's consent history needs review before sending.");
  return rows.find(record => currentMarketingConsent(record, Date.now()));
}

/** Planning evidence only. A capped join cannot become an exact sendable audience. */
export async function planningEmailAudience(ctx: QueryCtx, orgId: Id<"organizations">): Promise<EmailAudienceSnapshot> {
  const observedAt = Date.now();
  const [contacts, consents, suppressions, progress] = await Promise.all([
    ctx.db.query("contacts").withIndex("by_org", q => q.eq("orgId", orgId)).take(PLANNING_SAMPLE + 1),
    ctx.db.query("consentRecords").withIndex("by_org_contact", q => q.eq("orgId", orgId)).take(PLANNING_SAMPLE + 1),
    ctx.db.query("suppressions").withIndex("by_org_email", q => q.eq("orgId", orgId)).take(PLANNING_SAMPLE + 1),
    ctx.db.query("contactProgress").withIndex("by_org", q => q.eq("orgId", orgId)).take(101),
  ]);
  const limitations: string[] = [];
  for (const [name, rows] of [["Contact", contacts], ["Consent", consents], ["Suppression", suppressions]] as const) {
    if (rows.length > PLANNING_SAMPLE) limitations.push(`${name} records exceed the ${PLANNING_SAMPLE}-row planning sample`);
  }
  const active = contacts.slice(0, PLANNING_SAMPLE).filter(c => c.deletedAt === undefined);
  const consentCounts = new Map<string, number>();
  const consented = new Set<string>();
  for (const record of consents.slice(0, PLANNING_SAMPLE)) {
    consentCounts.set(record.contactId, (consentCounts.get(record.contactId) ?? 0) + 1);
    if (currentMarketingConsent(record, observedAt)) consented.add(record.contactId);
  }
  if (active.some(c => (consentCounts.get(c._id) ?? 0) > MAX_CONSENT_RECORDS)) limitations.push("A contact's consent history exceeds the send-review limit");
  const suppressed = new Set(suppressions.map(r => r.emailHash));
  const count = active.filter(c => consented.has(c._id) && !suppressed.has(c.emailHash) && c.emailCiphertext && c.emailIv).length;
  const knownEmpty = contacts.length <= PLANNING_SAMPLE && active.length === 0;
  return { customerProgress: customerProgressEvidence(active.map(contact => ({ customerProgress: progress.slice(0, 100).find(report => report.contactId === contact._id)?.progress })), contacts.length <= PLANNING_SAMPLE && progress.length <= 100, observedAt), contacts: contacts.length > PLANNING_SAMPLE ? null : active.length, consented: knownEmpty ? 0 : limitations.length ? null : count, observedContacts: active.length, coverage: limitations.length ? "partial" : "complete", limitations, observedAt };
}
