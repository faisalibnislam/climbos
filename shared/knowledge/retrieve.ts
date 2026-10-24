import library from "./growthLibrary.generated.json";

type KnowledgeRecord = (typeof library.records)[number];
export type RetrievedKnowledge = Pick<KnowledgeRecord, "id" | "kind" | "bookId" | "heading" | "path" | "sha256"> & { content: string; score: number };
export interface KnowledgeReferenceSet {
  edition: string;
  researchCutoff: string;
  records: Pick<RetrievedKnowledge, "id" | "kind" | "bookId" | "heading" | "path" | "sha256">[];
}

const STOP = new Set("about after again against all also any are because been before being between both but can could did does doing down during each few for from further had has have having her here hers him his how into itself just more most other our out over own same should some such than that the their them then there these they this those through too under until upon very was were what when where which while who why will with would your yourself business climbos growth guide recommendation reference references section example examples current actual".split(/\s+/u));
const tokens = (text: string) => text.toLocaleLowerCase("en-US").normalize("NFKC").match(/[\p{L}\p{N}]{2,}/gu)?.filter((term) => !STOP.has(term)) ?? [];
const docs = library.records.map((record) => {
  const terms = tokens(`${record.heading} ${record.kind} ${record.content}`);
  const frequency = new Map<string, number>();
  for (const term of terms) frequency.set(term, (frequency.get(term) ?? 0) + 1);
  return { record, terms, frequency, length: terms.length };
});
const avgLength = docs.reduce((sum, doc) => sum + doc.length, 0) / Math.max(1, docs.length);
const docFrequency = new Map<string, number>();
for (const doc of docs) for (const term of doc.frequency.keys()) docFrequency.set(term, (docFrequency.get(term) ?? 0) + 1);

function scoreDocument(doc: (typeof docs)[number], queryTerms: string[]): number {
  let score = 0;
  for (const term of queryTerms) {
    const tf = doc.frequency.get(term) ?? 0;
    if (!tf) continue;
    const df = docFrequency.get(term) ?? 0;
    const idf = Math.log(1 + (docs.length - df + 0.5) / (df + 0.5));
    const bm25 = (tf * 2.2) / (tf + 1.2 * (0.25 + 0.75 * (doc.length / Math.max(avgLength, 1))));
    const headingBoost = tokens(doc.record.heading).includes(term) ? 1.5 : 1;
    score += idf * bm25 * headingBoost;
  }
  return score;
}

/** Lexical BM25 retrieval over the versioned, hash-checked project corpus. */
export function retrieveGrowthKnowledge(query: string, options: { limit?: number; maxChars?: number } = {}): RetrievedKnowledge[] {
  const queryTerms = [...new Set(tokens(query).slice(0, 400))];
  if (!queryTerms.length) return [];
  const limit = Math.max(1, Math.min(8, Math.floor(options.limit ?? 3)));
  let budget = Math.max(400, Math.min(12_000, Math.floor(options.maxChars ?? 6_000)));
  const ranked = docs
    .map((doc) => ({ doc, score: scoreDocument(doc, queryTerms) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.doc.record.id.localeCompare(b.doc.record.id))
    .slice(0, limit);
  const out: RetrievedKnowledge[] = [];
  for (const { doc, score } of ranked) {
    if (budget < 300) break;
    const header = `[${doc.record.kind} · Book ${doc.record.bookId} · ${doc.record.heading} · docs/growth-intelligence/${doc.record.path} · sha256:${doc.record.sha256}]\n`;
    const available = Math.max(0, budget - header.length);
    if (available < 100) break;
    const content = doc.record.content.slice(0, available);
    out.push({ ...doc.record, content, score });
    budget -= header.length + content.length;
  }
  return out;
}

export function knowledgeReferenceSet(records: readonly RetrievedKnowledge[]): KnowledgeReferenceSet {
  return {
    edition: library.edition,
    researchCutoff: library.researchCutoff,
    records: records.map(({ id, kind, bookId, heading, path, sha256 }) => ({ id, kind, bookId, heading, path, sha256 })),
  };
}

export function formatGrowthKnowledge(records: readonly RetrievedKnowledge[]): string {
  if (!records.length) return "";
  return [
    `Edition: ${library.edition}. Research cutoff: ${library.researchCutoff}. The corpus is reference guidance, not business evidence or permission to execute.`,
    ...records.map((record) => `[${record.kind} · Book ${record.bookId} · ${record.heading} · docs/growth-intelligence/${record.path} · sha256:${record.sha256}]\n${record.content}`),
  ].join("\n\n---\n\n");
}

export function growthKnowledgeContext(query: string, options: { limit?: number; maxChars?: number } = {}): string {
  return formatGrowthKnowledge(retrieveGrowthKnowledge(query, options));
}
