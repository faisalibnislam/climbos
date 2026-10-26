import library from "./growthLibrary.generated.json";
import industryLibrary from "./industryPlaybooks.generated.json";
import sourceRegistry from "../../docs/growth-intelligence/source_registry.json";
import { sourceFreshness, type SourceFreshness } from "./freshness";

type KnowledgeRecord = (typeof library.records)[number] & { businessType?: string; evidenceClass?: string };
type KnowledgeKind = KnowledgeRecord["kind"] | "industry_playbook";
type IndustryLibrary = typeof industryLibrary;
const industryPlaybooksByBusiness = new Map<string, IndustryLibrary["playbooks"]>();
for (const playbook of industryLibrary.playbooks) {
  const group = industryPlaybooksByBusiness.get(playbook.businessTypeId) ?? [];
  group.push(playbook);
  industryPlaybooksByBusiness.set(playbook.businessTypeId, group);
}
export interface KnowledgeSourceReference {
  registryId: string;
  url: string;
  title: string;
  retrievedAt: string;
  publicationDate: string | null;
  claims: { sourceId: string; scope: string; verificationStatus: string }[];
  freshness: SourceFreshness;
}
export type RetrievedKnowledge = Omit<Pick<KnowledgeRecord, "id" | "bookId" | "heading" | "path" | "sha256">, never> & { kind: KnowledgeKind; businessType?: string; businessTypeId?: string; industry?: string; evidenceClass?: string; content: string; score: number; sources: KnowledgeSourceReference[] };
export interface KnowledgeReferenceSet {
  edition: string;
  researchCutoff: string;
  records: (Pick<RetrievedKnowledge, "id" | "kind" | "bookId" | "heading" | "path" | "sha256"> & { businessType?: string; businessTypeId?: string; industry?: string; evidenceClass?: string; sources: KnowledgeSourceReference[] })[];
}

const STOP = new Set("about after again against all also any are because been before being between both but can could did does doing down during each few for from further had has have having her here hers him his how into itself just more most other our out over own same should some such than that the their them then there these they this those through too under until upon very was were what when where which while who why will with would your yourself business climbos growth guide recommendation reference references section example examples current actual".split(/\s+/u));
const tokens = (text: string) => text.toLocaleLowerCase("en-US").normalize("NFKC").match(/[\p{L}\p{N}]{2,}/gu)?.filter((term) => !STOP.has(term)) ?? [];
const docs = library.records.map((record) => {
  const terms = tokens(`${record.heading} ${record.kind} ${record.content}`);
  const frequency = new Map<string, number>();
  for (const term of terms) frequency.set(term, (frequency.get(term) ?? 0) + 1);
  return { record, terms, frequency, length: terms.length };
});
const scenarioAliases: readonly [string, RegExp][] = [
  ["B2B SaaS", /\b(b2b saas|business[- ]to[- ]business saas|enterprise saas)\b/iu],
  ["Consumer SaaS", /\bconsumer saas\b/iu],
  ["Mobile and desktop apps", /\b(mobile app|desktop app|mac app|ios app|android app|app store optimization)\b/iu],
  ["DTC e-commerce", /\b(dtc|direct[- ]to[- ]consumer|e[- ]?commerce|online store|shopify)\b/iu],
  ["Marketplaces", /\b(marketplace|two[- ]sided market|buyers and sellers)\b/iu],
  ["Restaurants and cafes", /\b(restaurant|cafe|caf[eé]|food delivery|dining)\b/iu],
  ["Hotels and hospitality", /\b(hotel|hospitality|lodging|short[- ]term rental)\b/iu],
  ["Professional services", /\b(professional services|consulting firm|accounting firm|law firm|clinic)\b/iu],
  ["Agencies and freelancers", /\b(agency|freelancer|creative studio|marketing services)\b/iu],
  ["B2B manufacturing and wholesale", /\b(manufactur(?:er|ing)|wholesale|distributor|rfq)\b/iu],
  ["Healthcare practices", /\b(healthcare|medical practice|dentist|physician|patient appointment)\b/iu],
  ["Education and online courses", /\b(education|online course|course enrollment|learning platform)\b/iu],
  ["Coaches and consultants", /\b(coach(?:ing)?|independent consultant|consultant program)\b/iu],
  ["Real estate and property", /\b(real estate|property management|realtor|property listing)\b/iu],
  ["Home and local services", /\b(home services|local services|plumb(?:er|ing)|hvac|electrician|landscap(?:er|ing))\b/iu],
  ["Nonprofits and membership organizations", /\b(nonprofit|non-profit|membership organization|donations|volunteers)\b/iu],
  ["Creators and media businesses", /\b(creator|newsletter|podcast|media business|paid membership)\b/iu],
  ["Events and ticketing", /\b(event|ticketing|conference|festival|registrations)\b/iu],
  ["Fintech and financial services", /\b(fintech|financial services|lending|payments company|wealth management)\b/iu],
  ["Enterprise software and complex sales", /\b(enterprise software|complex sales|procurement|security review|proof of concept)\b/iu],
];
function matchingScenarioTypes(query: string): Set<string> {
  return new Set(scenarioAliases.filter(([, pattern]) => pattern.test(query)).map(([name]) => name));
}
const normalizedPhrase = (value: string) => value.toLocaleLowerCase("en-US").normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
function matchingIndustryBusiness(query: string, businessTypeId?: string): IndustryLibrary["businesses"][number] | undefined {
  if (businessTypeId) return industryLibrary.businesses.find((business) => business.id === businessTypeId);
  const normalizedQuery = ` ${normalizedPhrase(query)} `;
  const matches = industryLibrary.businesses
    .filter((business) => normalizedQuery.includes(` ${normalizedPhrase(business.name)} `))
    .sort((left, right) => normalizedPhrase(right.name).length - normalizedPhrase(left.name).length);
  // Require an unambiguous, complete business-type name in the prompt. Industry
  // similarity alone is too broad to justify using a niche-specific scenario.
  return matches.length === 1 ? matches[0] : undefined;
}
function industryPlaybookRecords(query: string, business: IndustryLibrary["businesses"][number]): RetrievedKnowledge[] {
  const queryTerms = [...new Set(tokens(query).slice(0, 400))];
  if (!queryTerms.length) return [];
  const candidates = industryPlaybooksByBusiness.get(business.id) ?? [];
  const docsForBusiness = candidates.map((item) => {
    const fields = item.fieldRefs.map((index, fieldIndex) => `${industryLibrary.fieldOrder[fieldIndex]}: ${industryLibrary.fieldValues[industryLibrary.fieldOrder[fieldIndex] as keyof typeof industryLibrary.fieldValues][index]}`);
    const content = fields.join("\n");
    const terms = tokens(`${item.heading} ${business.name} ${business.industry} ${business.profile} ${content}`);
    const frequency = new Map<string, number>();
    for (const term of terms) frequency.set(term, (frequency.get(term) ?? 0) + 1);
    return { item, content, terms, frequency, length: terms.length };
  });
  const avgLengthForBusiness = docsForBusiness.reduce((sum, doc) => sum + doc.length, 0) / Math.max(1, docsForBusiness.length);
  const docFrequencyForBusiness = new Map<string, number>();
  for (const doc of docsForBusiness) for (const term of doc.frequency.keys()) docFrequencyForBusiness.set(term, (docFrequencyForBusiness.get(term) ?? 0) + 1);
  const ranked = docsForBusiness.map((doc) => {
    let score = 0;
    for (const term of queryTerms) {
      const tf = doc.frequency.get(term) ?? 0;
      if (!tf) continue;
      const df = docFrequencyForBusiness.get(term) ?? 0;
      const idf = Math.log(1 + (docsForBusiness.length - df + 0.5) / (df + 0.5));
      score += idf * ((tf * 2.2) / (tf + 1.2 * (0.25 + 0.75 * (doc.length / Math.max(avgLengthForBusiness, 1))))) * (tokens(doc.item.heading).includes(term) ? 1.5 : 1);
    }
    return { ...doc, score };
  }).filter((item) => item.score > 0).sort((left, right) => right.score - left.score || left.item.id.localeCompare(right.item.id));
  const best = ranked[0];
  if (!best) return [];
  return [{
    id: `industry:${best.item.id}`,
    kind: "industry_playbook",
    bookId: "I1",
    heading: `${business.name}: ${best.item.heading}`,
    path: business.path,
    sha256: best.item.sha256,
    businessType: business.name,
    businessTypeId: business.id,
    industry: business.industry,
    evidenceClass: "proposed_scenario",
    content: `Business type: ${business.name}\nIndustry: ${business.industry}\nProfile: ${business.profile}\n${best.content}\nEvidence status: owner-supplied strategic hypothesis; not validated production guidance. Diagnose against this business's evidence before recommending a tactic.`,
    score: best.score,
    sources: [],
  }];
}
const normalizeUrl = (raw: string): string => {
  try {
    const url = new URL(raw);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) if (/^(utm_|ref$|source$)/iu.test(key)) url.searchParams.delete(key);
    url.pathname = url.pathname.replace(/\/+$/u, "") || "/";
    return url.toString().replace(/\/$/u, url.pathname === "/" ? "/" : "");
  } catch {
    return raw;
  }
};
const registryByUrl = new Map(sourceRegistry.sources.map((source) => [normalizeUrl(source.url), source]));
const sourceRefsFor = (content: string): KnowledgeSourceReference[] => {
  const urls = [...content.matchAll(/https?:\/\/[^\s)\]}>"']+/giu)]
    .map(([url]) => url.replace(/[.,;:!?]+$/u, ""));
  const seen = new Set<string>();
  const refs: KnowledgeSourceReference[] = [];
  for (const url of urls) {
    const source = registryByUrl.get(normalizeUrl(url));
    if (!source || seen.has(source.registry_id)) continue;
    seen.add(source.registry_id);
    refs.push({
      registryId: source.registry_id,
      url: source.url,
      title: source.title,
      retrievedAt: source.retrieved_at,
      publicationDate: source.publication_date,
      claims: source.records.slice(0, 3).map((claim) => ({ sourceId: claim.source_id, scope: claim.claim_scope, verificationStatus: claim.verification_status })),
      freshness: sourceFreshness(source),
    });
    if (refs.length >= 3) break;
  }
  return refs;
};
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
export function retrieveGrowthKnowledge(query: string, options: { limit?: number; maxChars?: number; businessTypeId?: string } = {}): RetrievedKnowledge[] {
  const queryTerms = [...new Set(tokens(query).slice(0, 400))];
  if (!queryTerms.length) return [];
  const limit = Math.max(1, Math.min(8, Math.floor(options.limit ?? 3)));
  let budget = Math.max(400, Math.min(12_000, Math.floor(options.maxChars ?? 6_000)));
  const matchedBusiness = limit >= 3 && budget >= 1_800 ? matchingIndustryBusiness(query, options.businessTypeId) : undefined;
  // The owner-chosen industry business type also selects its problem scenarios, not only words in the prompt.
  const scenarioTypes = limit >= 3 && budget >= 1_800 ? matchingScenarioTypes(matchedBusiness ? `${query}\n${matchedBusiness.name} ${matchedBusiness.industry}` : query) : new Set<string>();
  const industryRecords = matchedBusiness ? industryPlaybookRecords(query, matchedBusiness) : [];
  const genericLimit = Math.max(0, limit - (scenarioTypes.size > 0 ? 1 : 0) - (industryRecords.length ? 1 : 0));
  const rankedGeneric = docs
    .filter((doc) => doc.record.kind !== "scenario")
    .map((doc) => ({ doc, score: scoreDocument(doc, queryTerms) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.doc.record.id.localeCompare(b.doc.record.id))
    .slice(0, genericLimit);
  const rankedScenario = scenarioTypes.size
    ? docs
      .filter((doc) => doc.record.kind === "scenario" && scenarioTypes.has(doc.record.businessType ?? ""))
      .map((doc) => ({ doc, score: scoreDocument(doc, queryTerms) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.doc.record.id.localeCompare(b.doc.record.id))
      .slice(0, 1)
    : [];
  const ranked = [...rankedGeneric, ...rankedScenario].sort((a, b) => b.score - a.score || a.doc.record.id.localeCompare(b.doc.record.id));
  const out: RetrievedKnowledge[] = [];
  for (const record of industryRecords) {
    if (budget < 300) break;
    const location = record.path;
    const header = `[${record.kind} · ${record.businessType} · ${record.industry} · ${location} · sha256:${record.sha256}]\n`;
    const available = Math.max(0, budget - header.length);
    if (available < 100) break;
    out.push({ ...record, content: record.content.slice(0, available) });
    budget -= header.length + Math.min(record.content.length, available);
  }
  for (const { doc, score } of ranked) {
    if (budget < 300) break;
    const sources = sourceRefsFor(doc.record.content);
    const sourceText = sources.length ? `\nSources (general guidance only; check dates/status before using for current platform or legal decisions): ${sources.map((source) => `[${source.registryId}] ${source.title} · checked ${source.retrievedAt} · review ${source.freshness.status}${source.freshness.nextCheckAt ? ` by ${source.freshness.nextCheckAt.slice(0, 10)}` : ""} · ${source.claims[0]?.verificationStatus ?? "status not recorded"} · scope: ${source.claims[0]?.scope ?? "not recorded"} · ${source.url}`).join(" | ")}` : "";
    const location = doc.record.path.startsWith("docs/") ? doc.record.path : `docs/growth-intelligence/${doc.record.path}`;
    const status = doc.record.kind === "scenario" ? " · proposed hypothesis, not validated production guidance" : "";
    const header = `[${doc.record.kind}${status} · Book ${doc.record.bookId} · ${doc.record.heading} · ${location} · sha256:${doc.record.sha256}]${sourceText}\n`;
    const available = Math.max(0, budget - header.length);
    if (available < 100) break;
    const content = doc.record.content.slice(0, available);
    out.push({ ...doc.record, content, score, sources });
    budget -= header.length + content.length;
  }
  return out.sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
}

export function knowledgeReferenceSet(records: readonly RetrievedKnowledge[]): KnowledgeReferenceSet {
  return {
    edition: library.edition,
    researchCutoff: library.researchCutoff,
    records: records.map(({ id, kind, bookId, heading, path, sha256, sources, businessType, businessTypeId, industry, evidenceClass }) => ({ id, kind, bookId, heading, path, sha256, ...(businessType ? { businessType } : {}), ...(businessTypeId ? { businessTypeId } : {}), ...(industry ? { industry } : {}), ...(evidenceClass ? { evidenceClass } : {}), sources })),
  };
}

export function formatGrowthKnowledge(records: readonly RetrievedKnowledge[]): string {
  if (!records.length) return "";
  return [
    `Edition: ${library.edition}. Research cutoff: ${library.researchCutoff}. The corpus is reference guidance, not business evidence or permission to execute. Scenario records are proposed hypotheses: diagnose with this business's evidence before using them. A registry retrieval date records a check, not the source's publication or current accuracy. For current platform, API, pricing, or legal decisions, do not rely on a source marked recheck_due, direct_check_required, or not_scheduled without a fresh primary-source check.`,
    ...records.map((record) => {
      const location = record.path.startsWith("docs/") ? record.path : `docs/growth-intelligence/${record.path}`;
      const status = record.kind === "scenario" || record.kind === "industry_playbook" ? " · proposed hypothesis, not validated production guidance" : "";
      return `[${record.kind}${status} · Book ${record.bookId} · ${record.heading} · ${location} · sha256:${record.sha256}]${record.sources.length ? `\nSources (general guidance only): ${record.sources.map((source) => `[${source.registryId}] ${source.title} · checked ${source.retrievedAt} · review ${source.freshness.status}${source.freshness.nextCheckAt ? ` by ${source.freshness.nextCheckAt.slice(0, 10)}` : ""} · ${source.claims[0]?.verificationStatus ?? "status not recorded"} · ${source.claims[0]?.scope ?? "not recorded"} · ${source.url}`).join(" | ")}` : ""}\n${record.content}`;
    }),
  ].join("\n\n---\n\n");
}

export function growthKnowledgeContext(query: string, options: { limit?: number; maxChars?: number } = {}): string {
  return formatGrowthKnowledge(retrieveGrowthKnowledge(query, options));
}
