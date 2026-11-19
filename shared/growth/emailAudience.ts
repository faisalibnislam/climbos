import { productFunnelBrief, type ProductFunnelAssessment } from "./productFunnels";
import type { CustomerProgressEvidence } from "./customerProgress";
import type { FactEvidenceBasis } from "../agents/evidenceKind";
import { followupPlanningBrief, type FollowupPlanningEvidence } from "./customerJourneys";

/** Recorded permission is evidence to review, not sending authorization. */
export function currentMarketingConsent(record: { purpose: string; withdrawnAt?: number; source: string; capturedAt: number }, now: number): boolean {
  return record.purpose === "marketing_email" && record.withdrawnAt === undefined && Boolean(record.source.trim()) && Number.isFinite(record.capturedAt) && record.capturedAt <= now;
}

export interface EmailAudienceSnapshot {
  customerProgress?: CustomerProgressEvidence;
  productFunnels?: ProductFunnelAssessment[];
  followups?: FollowupPlanningEvidence;
  contacts: number | null;
  consented: number | null;
  observedContacts: number;
  coverage: "complete" | "partial";
  limitations: string[];
  observedAt: number;
}

export function emailAudienceBrief(a: EmailAudienceSnapshot | undefined, workflow?: { startedAt: number } | { cacheKey: true }): string {
  if (!a) return "";
  // Resumable checks reread current records; a fresh query timestamp alone must not change their prompt identity.
  // The workflow timestamp is a reference for the check, never a claim that these were the records at its start.
  const timing = workflow && "cacheKey" in workflow ? "current records (query clock excluded from cache identity)"
    : workflow ? `records refreshed for the workflow started ${new Date(workflow.startedAt).toISOString()}` : `records at ${new Date(a.observedAt).toISOString()}`;
  const scope = `EMAIL AUDIENCE (calculated from ClimbOS ${timing}):`;
  const contacts = a.contacts === null ? `${a.observedContacts} active contacts observed in a bounded sample; total unknown` : `${a.contacts} active contact${a.contacts === 1 ? "" : "s"} recorded`;
  const eligible = a.consented === null ? "Eligible audience unknown because coverage is incomplete" : `${a.consented} contact${a.consented === 1 ? " has" : "s have"} recorded current marketing consent, a stored address and no recorded suppression`;
  return `${scope} ${contacts}. ${eligible}.${a.limitations.length ? ` Limits: ${a.limitations.join("; ")}.` : ""} These are local records, not independently verified permission, customer interest, segment fit or deliverability. External lists, provider eligibility and sending-domain readiness remain unknown unless separately evidenced. Confirm the intended audience before proposing a send; building a voluntary list or drafting for later review is allowed. Every actual send still requires current eligibility and exact owner approval.\n${followupPlanningBrief(a.followups, Boolean(workflow && "cacheKey" in workflow))}\n${productFunnelBrief(a.productFunnels)}`;
}

const EMAIL_AUDIENCE = /\b(?:newsletter|mailing list|email (?:list|subscribers?|contacts?|recipients?|readers?))\b/i;
const THIRD_PARTY = /\b(?:competitors?|rivals?|partners?|third[- ]part(?:y|ies)|case stud(?:y|ies)|example|competes? with)\b/i;
const UNSETTLED = /\b(?:no|not|none|zero|empty|unknown|unverified|unconfirmed|unclear|withdrawn|revoked|unsubscribed|suppressed|purchased|scraped|rented|hypothetical|assum(?:e|ed|ption)|could|would|might|may|previously|formerly|historically|used to|no longer|target|goal)\b|\b(?:plan|want|aim|hope|intend|need|expect)\s+to\b|n['’]t\b/i;
const AUDIENCE_COUNT = /\b(\d[\d,]*(?:\.\d+)?)\s*(?:k|m|thousand|million)?\s+(?:(?:active|current|opted[- ]in|consented)\s+)*(?:email|newsletter|mailing(?: list)?)\s+(?:subscribers?|contacts?|recipients?|readers?|members?)\b|\b(?:email|mailing|newsletter)\s+list\s+(?:of|with)\s+(\d[\d,]*(?:\.\d+)?)\s*(?:k|m|thousand|million)?\s+(?:subscribers?|contacts?|recipients?|readers?|members?)\b/gi;
const NEWSLETTER_COUNT = /\b(?:newsletter|(?:email|mailing) list)\s+(?:currently\s+)?has\s+(\d[\d,]*(?:\.\d+)?)\s*(?:k|m|thousand|million)?\s+(?:subscribers?|contacts?|recipients?|readers?|members?)\b/gi;

/** A bounded interpretation of a recorded report, never independent verification or send permission.
 * Unclear ownership/provenance and conflicting reports require an owner check.
 */
export function hasReportedEmailAudience(facts: readonly string[], bases: readonly FactEvidenceBasis[] | undefined, businessName?: string): boolean {
  const name = businessName?.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const named = name ? new RegExp(`(?:^|[^\\p{L}\\p{N}])${name}(?=$|[^\\p{L}\\p{N}])`, "iu") : null;
  const namedOwnership = name ? new RegExp(`(?:^|[^\\p{L}\\p{N}])${name}(?:['’]s\\s+(?:newsletter|(?:email|mailing) list))?\\s+(?:currently\\s+)?(?:has|have|maintains?|manages?)\\b`, "iu") : null;
  let reported = false;
  for (const [index, fact] of facts.entries()) {
    const basis = bases?.[index];
    if (!basis || basis === "unknown" || !EMAIL_AUDIENCE.test(fact) || THIRD_PARTY.test(fact)) continue;
    const ownerVoice = basis === "owner_reported" && /\b(?:we|our (?:business|company|newsletter|email list|mailing list))\b/i.test(fact);
    if (!ownerVoice && !named?.test(fact)) continue;
    if (UNSETTLED.test(fact)) return false;
    const counts = [...fact.matchAll(AUDIENCE_COUNT), ...fact.matchAll(NEWSLETTER_COUNT)].map(match => Number((match[1] ?? match[2]).replaceAll(",", "")));
    if (counts.some(count => count === 0)) return false;
    const owns = namedOwnership?.test(fact) || (ownerVoice && /\b(?:we\s+(?:currently\s+)?(?:have|maintain|manage)|our\s+(?:(?:business|company|newsletter)|(?:email|mailing)\s+list)\s+(?:currently\s+)?has)\b/i.test(fact));
    if (owns && counts.some(count => Number.isFinite(count) && count > 0)) reported = true;
  }
  return reported;
}
