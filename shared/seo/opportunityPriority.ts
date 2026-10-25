import type { ReadinessFinding } from "./readiness";

export type OpportunityPriority = {
  finding: ReadinessFinding;
  priority: "check_first" | "verify" | "review";
  priorityReason: string;
  effort: "small" | "moderate" | "unknown";
  evidenceQuality: "direct_observation" | "incomplete_observation";
  customerRelevance: "business_homepage_only";
  observedVisibility: "not_measured_by_this_check";
  businessValue: "unknown";
  nextUsefulCheck: string;
};

const ACCESS_BLOCKERS = new Set(["http-status", "page-noindex"]);
const CONTENT_CLARITY = new Set(["missing-title", "missing-description", "missing-h1", "thin-readable-content"]);
const SMALL_FIXES = new Set(["missing-title", "missing-description", "missing-h1", "missing-document-language", "missing-viewport"]);
const MODERATE_FIXES = new Set(["invalid-json-ld", "multiple-h1", "heading-order"]);

/**
 * Order only the strength and type of the observed prerequisite. This is not a
 * growth-impact score: demand, customer relevance, business value and expected
 * visibility remain unknown unless separate evidence is available.
 */
export function prioritizeSearchOpportunities(findings: ReadinessFinding[]): OpportunityPriority[] {
  return findings.map((finding) => {
    const accessBlocked = ACCESS_BLOCKERS.has(finding.id);
    const shouldVerify = finding.id === "robots-unavailable" || finding.id.startsWith("robots-");
    const clarityIssue = CONTENT_CLARITY.has(finding.id);
    return {
      finding,
      priority: accessBlocked ? "check_first" as const : shouldVerify ? "verify" as const : "review" as const,
      priorityReason: accessBlocked
        ? "This check found an HTTP or indexing prerequisite that can prevent access to this page. Confirm it is unintended before making a change."
        : shouldVerify
          ? "Crawler access is unknown or restricted by the published robots.txt rule; this is only an access prerequisite, not proof of lost traffic or citations."
          : clarityIssue
            ? "This check found a page-level clarity or readable-content issue that is directly observable in the sampled HTML."
            : "This is a page-level technical check; review whether it matters for this page before changing anything.",
      effort: SMALL_FIXES.has(finding.id) ? "small" as const : MODERATE_FIXES.has(finding.id) ? "moderate" as const : "unknown" as const,
      evidenceQuality: finding.id === "robots-unavailable" ? "incomplete_observation" as const : "direct_observation" as const,
      customerRelevance: "business_homepage_only" as const,
      observedVisibility: "not_measured_by_this_check" as const,
      businessValue: "unknown" as const,
      nextUsefulCheck: finding.id === "no-structured-data"
        ? "First check whether a relevant structured-data type accurately describes information already visible on the page; do not add markup just to seek AI citations."
        : "Compare this page with the business's real customer questions and dated Search Console or AI-answer observations before estimating business value.",
    };
  }).sort((a, b) => {
    const order = { check_first: 0, verify: 1, review: 2 } as const;
    return order[a.priority] - order[b.priority] || Number(a.finding.level === "check") - Number(b.finding.level === "check") || a.finding.title.localeCompare(b.finding.title);
  });
}
