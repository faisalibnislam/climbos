import { untrusted } from "../ai/tasks";
import { searchConsolePropertyMatchesWebsite } from "../integrations/searchConsole";
import { queryPageOverlaps } from "../seo/queryOverlap";
import { urlKey } from "./provenance";

export interface SearchConsoleEvidenceSnapshot {
  property: string;
  startDate: string;
  endDate: string;
  dataState: "final";
  rowCount: number;
  truncated: boolean;
  rows: { query: string; page: string; clicks: number; impressions: number; ctr: number; position: number }[];
}

export interface SearchConsoleRefreshCandidate {
  page: string;
  queries: number;
  clicks: number;
  impressions: number;
  ctr: number;
  averagePosition: number;
}

/**
 * Rank observed pages for a human refresh review. The 4–20 position band is a
 * triage heuristic, not a ranking target or prediction; impressions decide the
 * ordering, and low-volume rows remain visible as weak evidence.
 */
export function searchConsoleRefreshCandidates(
  rows: SearchConsoleEvidenceSnapshot["rows"],
  limit = 5,
): SearchConsoleRefreshCandidate[] {
  const uniqueRows = new Map<string, SearchConsoleEvidenceSnapshot["rows"][number]>();
  for (const row of rows) {
    if (!Number.isFinite(row.clicks) || row.clicks < 0 || !Number.isFinite(row.impressions) || row.impressions <= 0 || !Number.isFinite(row.position) || row.position <= 0) continue;
    try {
      const url = new URL(row.page);
      if (!(url.protocol === "https:" || url.protocol === "http:") || url.username || url.password) continue;
      url.hash = "";
      const page = url.toString().replace(/\/$/u, "");
      const query = row.query.normalize("NFKC").replace(/\s+/gu, " ").trim().toLocaleLowerCase("en-US");
      if (!query) continue;
      const key = `${query}\u0000${page}`;
      if (!uniqueRows.has(key)) uniqueRows.set(key, { ...row, page });
    } catch {
      continue;
    }
  }

  const pages = new Map<string, { queries: Set<string>; clicks: number; impressions: number; weightedPosition: number }>();
  for (const [key, row] of uniqueRows) {
    const [query] = key.split("\u0000");
    const page = pages.get(row.page) ?? { queries: new Set<string>(), clicks: 0, impressions: 0, weightedPosition: 0 };
    page.queries.add(query ?? "");
    page.clicks += row.clicks;
    page.impressions += row.impressions;
    page.weightedPosition += row.position * row.impressions;
    pages.set(row.page, page);
  }

  const max = Math.max(1, Math.min(10, Math.floor(limit)));
  return [...pages.entries()]
    .map(([page, stats]) => ({
      page,
      queries: stats.queries.size,
      clicks: stats.clicks,
      impressions: stats.impressions,
      ctr: stats.clicks / stats.impressions,
      averagePosition: stats.weightedPosition / stats.impressions,
    }))
    .filter((candidate) => candidate.averagePosition >= 4 && candidate.averagePosition <= 20)
    .sort((a, b) => b.impressions - a.impressions || a.page.localeCompare(b.page))
    .slice(0, max);
}

function refreshCandidateContext(rows: SearchConsoleEvidenceSnapshot["rows"]): string {
  const candidates = searchConsoleRefreshCandidates(rows);
  if (!candidates.length) return "No observed page falls in the 4–20 average-position review band for this window.";
  return [
    "PAGES TO REVIEW FIRST (deterministic triage from query/page rows):",
    untrusted("Search Console page refresh candidates", JSON.stringify(candidates), 4_000),
    "Candidates are ranked by observed impressions within this property and window; the 4–20 average-position band is a review heuristic, not a benchmark, expected lift, or ranking target. Average position varies by query and search context. Check the page's query intent and conversion role before recommending a change. Google may omit rows, and low impressions are weak evidence.",
  ].join("\n");
}

/** Bounded historical Search Console evidence for channel-fit and strategy reasoning. */
export function searchConsoleStrategyContext(snapshot: SearchConsoleEvidenceSnapshot | null, website?: string): string {
  if (!snapshot) return "SEARCH CONSOLE: no completed observations are available; do not claim search performance was measured.";
  if (!website) return `SEARCH CONSOLE: observations for ${snapshot.property} were not used because this business has no recorded website to verify against.`;
  if (!searchConsolePropertyMatchesWebsite(snapshot.property, website)) {
    return `SEARCH CONSOLE: observations for ${snapshot.property} were not used because the selected property does not match the recorded business website. Ask the owner to check the property before using these metrics.`;
  }
  const rows = snapshot.rows
    .slice()
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 15)
    .map((row) => ({
      query: row.query.slice(0, 250),
      page: row.page.slice(0, 250),
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      averagePosition: row.position,
    }));
  const data = untrusted("Search Console query and page observations", JSON.stringify(rows), 8_000);
  return [
    `SEARCH CONSOLE PERFORMANCE OBSERVATIONS (${snapshot.property}; ${snapshot.startDate} through ${snapshot.endDate}; ${snapshot.dataState} data; ${snapshot.rowCount} stored rows${snapshot.truncated ? "; top-row result was truncated" : ""}):`,
    data,
    refreshCandidateContext(snapshot.rows),
    "These are historical performance observations for one owner-selected property and date window. They are not total search demand, complete query coverage, or proof that SEO caused growth. Google may omit some queries. Use them only as evidence about this website's observed search activity; do not infer a market-wide volume, future result, or causal lift.",
  ].join("\n");
}

/** Search Console evidence for SEO briefs is limited to pages that were fetched successfully in this run. */
export function searchConsoleSeoContext(snapshot: SearchConsoleEvidenceSnapshot | null, website: string | undefined, observedPageUrls: string[]): string {
  if (!snapshot) return "SEARCH CONSOLE: no completed observations are available; do not claim search performance was measured.";
  if (!website) return `SEARCH CONSOLE: observations for ${snapshot.property} were not used because this business has no recorded website to verify against.`;
  if (!searchConsolePropertyMatchesWebsite(snapshot.property, website)) {
    return `SEARCH CONSOLE: observations for ${snapshot.property} were not used because the selected property does not match the recorded business website. Ask the owner to check the property before using these metrics.`;
  }
  const observed = new Set(observedPageUrls.map(urlKey));
  const rows = snapshot.rows.filter((row) => observed.has(urlKey(row.page)));
  if (!rows.length) {
    return `SEARCH CONSOLE: property ${snapshot.property} matches the recorded website, but none of its returned page rows match a page successfully fetched in this run. Do not use these observations for page-level recommendations.`;
  }
  const base = searchConsoleStrategyContext({ ...snapshot, rowCount: rows.length, rows }, website);
  const overlaps = queryPageOverlaps(rows, { maxQueries: 5, maxPagesPerQuery: 5 });
  if (!overlaps.length) return base;
  const observedData = untrusted("Search Console query-to-page overlap observations", JSON.stringify(overlaps), 4_000);
  return base + "\n\nQUERY-TO-PAGE OVERLAP IN THE FETCHED-PAGE SUBSET:\n" + observedData +
    "\nThese rows show the same normalized query with impressions for multiple page URLs in this property and date window. This can be normal and is not proof that pages harm each other's ranking. Compare the pages' intent and role; recommend consolidation or differentiation only when their content and purpose support it.";
}
