/** Remove only directly negated trial phrases; an affirmative offer elsewhere still needs terms. */
export function withoutNegatedTrials(text: string): string {
  return text.replace(/\b(?:free trials?|\d+[- ]day trials?)\b/gi, (match, offset: number) => {
    const before = text.slice(Math.max(0, offset - 65), offset);
    return /\b(?:(?:no|without|not)(?: an?| any)?|(?:do(?:es)? not|don't|doesn't) (?:offer|include)(?: an?| any)?)\s*$/i.test(before) ? "trial unavailable" : match;
  });
}

// A closed noun list keeps negation from swallowing an affirmative instruction,
// qualifications such as "no discount restrictions", or the next sentence.
const DECLINED_ITEMS = String.raw`(?:discounts?|coupons?|promo codes?|bonus(?:es)?|bundles?|free trials?|payment terms|installments?|split payments?|guarantees?|referral rewards?|incentives?|special offers?|offer changes?|free (?:setup|shipping|delivery|consultation|onboarding)|ads?|audiences?|sending)`;
const DECLINED_LIST = new RegExp(String.raw`\b(?:no|without|never (?:offer|use)|(?:do not|don't) (?:offer|use))[ \t]+(?:(?:an?|any)[ \t]+)?${DECLINED_ITEMS}(?:[ \t]*(?:,[ \t]*(?:(?:or|and)[ \t]+)?|[ \t]+(?:or|and)[ \t]+)${DECLINED_ITEMS})*(?=$|[.!?;,:\n]|[ \t]+(?:(?:is|are)[ \t]+)?(?:needed|required|involved|proposed)\b|[ \t]+(?:gives|helps|keeps|tests|but)\b)`, "gi");

// The rejected side of a narrow comparison is not the recommended mechanism.
// Require a closed ending; qualifications and affirmative offers elsewhere survive.
const DECLINED_ALTERNATIVE = new RegExp(String.raw`\b(?:rather than|instead of|(?:safer|better)(?:[ \t]+first)?(?:[ \t]+test)?[ \t]+than)[ \t]+(?:an?[ \t]+)?${DECLINED_ITEMS}(?=$|[.!?;,:\n]|[ \t]+but\b)`, "gi");

/** Recommendation classification only; never strips terms from public copy or approved artifacts. */
export function withoutDeclinedPromotionRecommendations(text: string): string {
  return withoutNegatedTrials(text.replace(DECLINED_LIST, "declined mechanism").replace(DECLINED_ALTERNATIVE, "declined alternative"));
}

/** A direct denial is not a refund promise; retain affirmative promises elsewhere. */
export function withoutNegatedRefundPromises(text: string): string {
  return text.replace(/\b(?:money[- ]back(?: guarantees?)?|refund guarantees?)\b/gi, (match, offset: number) => {
    const before = text.slice(Math.max(0, offset - 80), offset);
    return /\b(?:(?:no|without|not)(?: an?| any)?|(?:do(?:es)? not|don't|doesn't) (?:offer|include|guarantee|promise)(?: an?| any| your)?)\s*$/i.test(before) ? "refund promise unavailable" : match;
  });
}
