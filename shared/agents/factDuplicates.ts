/** Conservative display grouping: only exact text after Unicode/case/spacing cleanup is grouped. */
export interface DisplayFact {
  id: string;
  category: string;
  statement: string;
}

export interface DisplayFactGroup<T extends DisplayFact> {
  primary: T;
  duplicates: T[];
}

function normalizedStatement(value: string): string {
  return value.normalize("NFKC").trim().replace(/[.!?]+$/u, "").replace(/\s+/gu, " ").toLocaleLowerCase("en-US");
}

/** Group obvious duplicate rows for display while retaining every underlying fact record. */
export function groupExactDuplicateFacts<T extends DisplayFact>(facts: readonly T[]): DisplayFactGroup<T>[] {
  const groups = new Map<string, DisplayFactGroup<T>>();
  for (const fact of facts) {
    const key = `${fact.category}\u0000${normalizedStatement(fact.statement)}`;
    const group = groups.get(key);
    if (group) group.duplicates.push(fact);
    else groups.set(key, { primary: fact, duplicates: [] });
  }
  return [...groups.values()];
}
