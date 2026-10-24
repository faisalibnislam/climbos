/** Deterministic checks for sourced competitor suggestions before they reach watch controls. */
export interface CompetitorCandidate {
  name: string;
  url: string;
  sourceUrl?: string;
  kind?: "direct" | "adjacent";
}

const DIRECTORY_HOSTS = [
  "g2.com",
  "capterra.com",
  "getapp.com",
  "trustpilot.com",
  "yelp.com",
  "clutch.co",
  "producthunt.com",
  "crunchbase.com",
  "apps.apple.com",
  "play.google.com",
];

/** Canonical host identity: scheme, path, query and a leading www do not create new vendors. */
export function canonicalCompetitorHost(input: string): string | null {
  try {
    const url = new URL(/^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password) return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
    if (!host || !host.includes(".") || host === "localhost") return null;
    return host;
  } catch {
    return null;
  }
}

function sameSite(a: string, b: string): boolean {
  return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);
}

function isDirectory(host: string): boolean {
  return DIRECTORY_HOSTS.some((directory) => sameSite(host, directory));
}

/** Preserve research order; reject unsupported hosts, self references, directories and duplicate vendors. */
export function selectWatchCandidates(
  candidates: readonly CompetitorCandidate[],
  ownWebsite?: string,
  alreadyWatched: readonly string[] = [],
  limit = 6,
): CompetitorCandidate[] {
  if (!Number.isFinite(limit) || limit <= 0) return [];
  const ownHost = ownWebsite ? canonicalCompetitorHost(ownWebsite) : null;
  const seen = new Set(alreadyWatched.map(canonicalCompetitorHost).filter((x): x is string => Boolean(x)));
  const selected: CompetitorCandidate[] = [];
  for (const candidate of candidates) {
    const name = candidate.name.trim().slice(0, 80);
    const host = canonicalCompetitorHost(candidate.url);
    const source = candidate.sourceUrl ? canonicalCompetitorHost(candidate.sourceUrl) : null;
    if (!name || !host || !source || candidate.kind === "adjacent" || isDirectory(host) || (ownHost && sameSite(host, ownHost)) || seen.has(host)) continue;
    seen.add(host);
    selected.push({ name, url: `https://${host}`, sourceUrl: candidate.sourceUrl, ...(candidate.kind ? { kind: candidate.kind } : {}) });
    if (selected.length >= Math.max(0, Math.floor(limit))) break;
  }
  return selected;
}
