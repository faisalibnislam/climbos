/** Remove only directly negated trial phrases; an affirmative offer elsewhere still needs terms. */
export function withoutNegatedTrials(text: string): string {
  return text.replace(/\b(?:free trial|\d+[- ]day trial)\b/gi, (match, offset: number) => {
    const before = text.slice(Math.max(0, offset - 65), offset);
    return /\b(?:(?:no|without|not)(?: an?| any)?|(?:do(?:es)? not|don't|doesn't) (?:offer|include)(?: an?| any)?)\s*$/i.test(before) ? "trial unavailable" : match;
  });
}

/** A direct denial is not a refund promise; retain affirmative promises elsewhere. */
export function withoutNegatedRefundPromises(text: string): string {
  return text.replace(/\b(?:money[- ]back(?: guarantees?)?|refund guarantees?)\b/gi, (match, offset: number) => {
    const before = text.slice(Math.max(0, offset - 80), offset);
    return /\b(?:(?:no|without|not)(?: an?| any)?|(?:do(?:es)? not|don't|doesn't) (?:offer|include|guarantee|promise)(?: an?| any| your)?)\s*$/i.test(before) ? "refund promise unavailable" : match;
  });
}
