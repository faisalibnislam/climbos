export const REVIEW_SAFETY_CATEGORIES = ["legal", "health_safety", "discrimination", "payment", "privacy"] as const;
export type ReviewSafetyCategory = (typeof REVIEW_SAFETY_CATEGORIES)[number];

export function ratingOnlyReviewReply(rating: number): string | null {
  if (!Number.isInteger(rating) || rating < 4 || rating > 5) return null;
  return `Thank you for taking the time to leave a ${rating}-star rating. We appreciate your support.`;
}

const SIGNALS: Array<{ category: ReviewSafetyCategory; pattern: RegExp }> = [
  { category: "legal", pattern: /\b(lawyer|attorney|lawsuit|sue|sued|court|legal action|regulator|regulatory complaint)\b/i },
  { category: "health_safety", pattern: /\b(injur(?:y|ed)|unsafe|safety issue|hospital|poison(?:ed|ing)?|allerg(?:y|ic reaction)|contaminat(?:ed|ion)|fire|assault)\b/i },
  { category: "discrimination", pattern: /\b(discriminat(?:ed|ion)|racist|racism|sexist|sexual harassment|harass(?:ed|ment)|hate crime)\b/i },
  { category: "payment", pattern: /\b(charged (?:me |us )?twice|double charged|unauthori[sz]ed charge|chargeback|payment fraud|billing fraud|refund dispute)\b/i },
  { category: "privacy", pattern: /\b(data breach|privacy breach|(?:personal|private) (?:data|information) (?:was |were |has been )?exposed|credit card number (?:was |were |has been )?exposed|medical records (?:were |have been )?exposed|doxx(?:ed|ing)?)\b/i },
];

/** A conservative routing signal, not a finding that the review is true or legally classified. */
export function reviewSafetySignals(text: string): ReviewSafetyCategory[] {
  return SIGNALS.filter(({ pattern }) => pattern.test(text)).map(({ category }) => category);
}
