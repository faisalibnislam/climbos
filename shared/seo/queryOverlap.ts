export type SearchConsolePageObservation = {
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type QueryPageOverlap = {
  query: string;
  pageCount: number;
  pages: SearchConsolePageObservation[];
};

function pageKey(value: string): string | null {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    url.hash = "";
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.toString();
  } catch {
    return null;
  }
}

/** Report exact query-to-URL overlap in one Search Console window; it is not a cannibalization verdict. */
export function queryPageOverlaps(
  rows: SearchConsolePageObservation[],
  options: { maxQueries?: number; maxPagesPerQuery?: number } = {},
): QueryPageOverlap[] {
  const maxQueries = Math.max(1, Math.min(options.maxQueries ?? 8, 20));
  const maxPages = Math.max(2, Math.min(options.maxPagesPerQuery ?? 5, 10));
  const grouped = new Map<string, { query: string; pages: Map<string, SearchConsolePageObservation> }>();
  for (const row of rows) {
    const query = row.query.normalize("NFKC").replace(/\s+/gu, " ").trim();
    const url = pageKey(row.page);
    if (!query || !url || !(row.impressions > 0)) continue;
    const key = query.toLocaleLowerCase("en-US");
    const group = grouped.get(key) ?? { query, pages: new Map() };
    // Search Console normally returns one aggregated row per query/page pair.
    // Keep the first duplicate so bad/replayed inputs cannot inflate metrics.
    if (!group.pages.has(url)) group.pages.set(url, { ...row, page: url });
    grouped.set(key, group);
  }
  return [...grouped.values()]
    .filter((group) => group.pages.size > 1)
    .sort((a, b) => b.pages.size - a.pages.size || a.query.localeCompare(b.query))
    .slice(0, maxQueries)
    .map((group) => ({
      query: group.query.slice(0, 250),
      pageCount: group.pages.size,
      pages: [...group.pages.values()]
        .sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks || a.page.localeCompare(b.page))
        .slice(0, maxPages),
    }));
}
