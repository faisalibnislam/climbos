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

export interface SimilarFactCandidate<T extends DisplayFact> {
  first: T;
  second: T;
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

function candidateTokens(value: string): Set<string> {
  return new Set(canonicalMeaning(value).split(" ").map((token) => {
    if (token.length > 5 && token.endsWith("ing")) return token.slice(0, -3);
    if (token.length > 5 && token.endsWith("s")) return token.slice(0, -1);
    return token;
  }).filter((token) => !["include", "contain", "provide", "offer", "feature", "product", "service", "customer", "user", "not", "never", "no", "without", "exclude"].includes(token)));
}

function protectedValues(value: string): string[] {
  return [...value.normalize("NFKC").toLocaleLowerCase("en-US").replace(/[$]/gu, " usd ").replace(/[€]/gu, " eur ").replace(/[£]/gu, " gbp ").replace(/[₹]/gu, " inr ").replace(/[৳]/gu, " bdt ").matchAll(/\b(?:\d+(?:[.,]\d+)?|usd|eur|gbp|inr|bdt)\b/gu)].map((match) => match[0]).sort();
}

function protectedPolarity(value: string): string[] {
  return [...value.normalize("NFKC").toLocaleLowerCase("en-US").matchAll(/\b(?:not|never|no|without|exclude|excluding|doesn't|don't|isn't|aren't|cannot|can't)\b/gu)].map((match) => /n't$/u.test(match[0]) ? "not" : match[0]).sort();
}

function namedEntities(value: string): string[] {
  const matches = value.matchAll(/\b(?:the\s+|our\s+|a\s+)?([a-z0-9][\w'-]*(?:\s+[a-z0-9][\w'-]*)*)\s+(?:plan|tier|package|subscription|product|service|offer)\b/giu);
  return [...new Set([...matches].map((match) => match[1].trim().toLocaleLowerCase("en-US").replace(/\s+/gu, " ")))].sort();
}

/**
 * Suggest close same-category/state fact pairs for owner review. This function
 * never merges records; amount/currency, polarity, and labelled product names
 * must agree before lexical similarity is considered.
 */
export function findPossibleDuplicateFacts<T extends DisplayFact>(facts: readonly T[], limit = 12): SimilarFactCandidate<T>[] {
  const candidates: SimilarFactCandidate<T>[] = [];
  const rows = facts.slice(0, 300);
  for (let leftIndex = 0; leftIndex < rows.length; leftIndex++) {
    const first = rows[leftIndex]!;
    const firstMeaning = canonicalMeaning(first.statement);
    const firstTokens = candidateTokens(first.statement);
    if (firstTokens.size < 3) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < rows.length; rightIndex++) {
      const second = rows[rightIndex]!;
      if (first.category !== second.category || (first.state ?? "") !== (second.state ?? "")) continue;
      const secondMeaning = canonicalMeaning(second.statement);
      if (firstMeaning === secondMeaning || JSON.stringify(protectedValues(first.statement)) !== JSON.stringify(protectedValues(second.statement))) continue;
      if (JSON.stringify(protectedPolarity(first.statement)) !== JSON.stringify(protectedPolarity(second.statement))) continue;
      const firstEntities = namedEntities(first.statement);
      const secondEntities = namedEntities(second.statement);
      if ((firstEntities.length || secondEntities.length) && JSON.stringify(firstEntities) !== JSON.stringify(secondEntities)) continue;
      const secondTokens = candidateTokens(second.statement);
      if (secondTokens.size < 3) continue;
      let shared = 0;
      for (const token of firstTokens) if (secondTokens.has(token)) shared++;
      const union = firstTokens.size + secondTokens.size - shared;
      if (shared >= 3 && union > 0 && shared / union >= 0.78) candidates.push({ first, second });
    }
  }
  return candidates.slice(0, Math.max(0, Math.min(24, limit)));
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
