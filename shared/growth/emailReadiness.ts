/** A provider observation about one sender domain, not overall deliverability or authorization. */
export interface EmailSenderReadiness {
  domain: string;
  state: "verified" | "setup_required" | "unknown";
  checkedAt: number;
  message: string;
  sourceUrl: string | null;
}
export const EMAIL_DOMAIN_SOURCE = "https://resend.com/docs/dashboard/domains/manage-domains";
export const EMAIL_READINESS_LIMITS = "This does not verify DMARC, sender reputation, inbox placement, account quotas, audience permission or customer interest. A send still needs its own approval.";

export function emailSenderDomain(from: string): string | null {
  const value = from.trim();
  const address = value.includes("<") ? /^[^<>\r\n]*<([^<>\r\n]+)>$/.exec(value)?.[1] : value;
  if (!address || !/^[^\s@<>()[\],;:"]+@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(address)) return null;
  return address.slice(address.lastIndexOf("@") + 1).toLowerCase();
}

export function emailReadinessBrief(report: EmailSenderReadiness | null | undefined): string {
  if (!report) return "EMAIL SENDER SETUP: Unknown. A connected account is not evidence of a verified sender domain or deliverability. Ask the owner to check the intended sender before proposing a send; private drafting remains available.";
  return `EMAIL SENDER SETUP — historical provider report captured ${new Date(report.checkedAt).toISOString()} for ${report.domain}: ${report.state}. ${report.message} This applies only to that domain at the capture time; recheck the intended sender before sending. Provider endpoint: ${report.sourceUrl ?? "No provider endpoint was read"}. Setup guidance: ${EMAIL_DOMAIN_SOURCE}. ${EMAIL_READINESS_LIMITS}`;
}
