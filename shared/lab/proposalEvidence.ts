export interface FeedbackEvidence {
  business: string;
  quote: string;
}

export interface RuleWithEvidence {
  rule: string;
  evidence: FeedbackEvidence[];
}

export interface VerifiedRule {
  rule: string;
  distinctBusinesses: number;
}

const normalize = (value: string) => value.normalize("NFKC").toLocaleLowerCase("en-US").replace(/\s+/gu, " ").trim();
const wordCount = (value: string) => value.trim().split(/\s+/u).filter(Boolean).length;

/**
 * Count recurrence from the redacted source records, never from a model-provided
 * count. A citation must be a substantive verbatim excerpt from that business's
 * own feedback; multiple comments from one workspace still count only once.
 */
export function verifyRecurringRules(
  proposals: RuleWithEvidence[],
  feedback: { business: string; fix: string }[],
  minBusinesses = 5,
): VerifiedRule[] {
  const feedbackByBusiness = new Map<string, string[]>();
  for (const item of feedback) {
    const business = item.business.trim();
    const fix = normalize(item.fix);
    if (!business || !fix) continue;
    const rows = feedbackByBusiness.get(business) ?? [];
    rows.push(fix);
    feedbackByBusiness.set(business, rows);
  }

  const seenRules = new Set<string>();
  const verified: VerifiedRule[] = [];
  for (const proposal of proposals) {
    const rule = proposal.rule.replace(/\s+/gu, " ").trim();
    const ruleKey = normalize(rule);
    if (!rule || wordCount(rule) > 24 || ruleKey.length < 12 || seenRules.has(ruleKey)) continue;

    const matchedBusinesses = new Set<string>();
    for (const evidence of proposal.evidence) {
      const business = evidence.business.trim();
      const quote = normalize(evidence.quote);
      if (quote.length < 20) continue;
      if (feedbackByBusiness.get(business)?.some((fix) => fix.includes(quote))) matchedBusinesses.add(business);
    }
    if (matchedBusinesses.size < minBusinesses) continue;
    seenRules.add(ruleKey);
    verified.push({ rule, distinctBusinesses: matchedBusinesses.size });
  }
  return verified;
}
