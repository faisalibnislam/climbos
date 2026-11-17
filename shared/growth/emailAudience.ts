/** Recorded permission is evidence to review, not sending authorization. */
export function currentMarketingConsent(record: { purpose: string; withdrawnAt?: number; source: string; capturedAt: number }, now: number): boolean {
  return record.purpose === "marketing_email" && record.withdrawnAt === undefined && Boolean(record.source.trim()) && Number.isFinite(record.capturedAt) && record.capturedAt <= now;
}

export interface EmailAudienceSnapshot {
  contacts: number | null;
  consented: number | null;
  observedContacts: number;
  coverage: "complete" | "partial";
  limitations: string[];
  observedAt: number;
}

export function emailAudienceBrief(a: EmailAudienceSnapshot | undefined): string {
  if (!a) return "";
  const scope = `EMAIL AUDIENCE (calculated from ClimbOS records at ${new Date(a.observedAt).toISOString()}):`;
  const contacts = a.contacts === null ? `${a.observedContacts} active contacts observed in a bounded sample; total unknown` : `${a.contacts} active contact${a.contacts === 1 ? "" : "s"} recorded`;
  const eligible = a.consented === null ? "Eligible audience unknown because coverage is incomplete" : `${a.consented} contact${a.consented === 1 ? " has" : "s have"} recorded current marketing consent, a stored address and no recorded suppression`;
  return `${scope} ${contacts}. ${eligible}.${a.limitations.length ? ` Limits: ${a.limitations.join("; ")}.` : ""} These are local records, not independently verified permission, customer interest, segment fit or deliverability. External lists, provider eligibility and sending-domain readiness remain unknown unless separately evidenced. Confirm the intended audience before proposing a send; building a voluntary list or drafting for later review is allowed. Every actual send still requires current eligibility and exact owner approval.`;
}
