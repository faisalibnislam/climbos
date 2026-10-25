/** Conservative display grouping: only facts with the same category, review state, and canonical meaning are grouped. */
export interface DisplayFact {
  id: string;
  category: string;
  statement: string;
  /** Facts in different review states remain separate so pending evidence is never hidden. */
  state?: string;
}

export interface DisplayFactGroup<T extends DisplayFact> {
  primary: T;
  duplicates: T[];
}

function canonicalMeaning(value: string): string {
  const text = value.normalize("NFKC").toLocaleLowerCase("en-US")
    .replace(/[$]/gu, " usd ").replace(/[€]/gu, " eur ").replace(/[£]/gu, " gbp ").replace(/[₹]/gu, " inr ").replace(/[৳]/gu, " bdt ")
    .replace(/\b(?:per\s+month|a\s+month|each\s+month|every\s+month|monthly|\/\s?mo|\/\s?month|mo\s+subscription)\b/gu, " month ")
    .replace(/\b(?:tiers?|packages?|subscriptions?)\b/gu, " plan ")
    .replace(/\b(?:costs?|pricing|priced|fees?|charges?|charged)\b/gu, " price ")
    .replace(/\b(?:customers|clients|users)\b/gu, " customer ")
    .replace(/\b(?:plans)\b/gu, " plan ")
    .replace(/[^\p{L}\p{N}]+/gu, " ");
  const stop = new Set(["a", "an", "and", "are", "as", "at", "for", "from", "has", "in", "is", "of", "our", "the", "to", "with"]);
  return text.split(/\s+/u).filter((token) => token && !stop.has(token)).sort().join(" ");
}

/** Group obvious duplicate rows for display while retaining every underlying fact record. */
export function groupExactDuplicateFacts<T extends DisplayFact>(facts: readonly T[]): DisplayFactGroup<T>[] {
  const groups = new Map<string, DisplayFactGroup<T>>();
  for (const fact of facts) {
    const key = `${fact.category}\u0000${fact.state ?? ""}\u0000${canonicalMeaning(fact.statement)}`;
    const group = groups.get(key);
    if (group) group.duplicates.push(fact);
    else groups.set(key, { primary: fact, duplicates: [] });
  }
  return [...groups.values()];
}
