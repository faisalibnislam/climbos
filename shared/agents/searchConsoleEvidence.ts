import { untrusted } from "../ai/tasks";
import { searchConsolePropertyMatchesWebsite } from "../integrations/searchConsole";
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
  return searchConsoleStrategyContext({ ...snapshot, rowCount: rows.length, rows }, website);
}
