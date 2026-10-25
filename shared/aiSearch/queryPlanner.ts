import { inferSearchIntentStage, type SearchIntentStage } from "../agents/searchIntent";

export interface SearchQueryObservation {
  query: string;
  page: string;
  clicks: number;
  impressions: number;
}

export interface AiSearchQuerySuggestion {
  /** Exact query wording observed in Search Console; the planner does not rewrite it. */
  query: string;
  intent: SearchIntentStage;
  /** Highest observed page-level impressions for this query; rows are not summed across pages. */
  highestPageImpressions: number;
  highestPageClicks: number;
  observedPageCount: number;
}

const intentOrder: Record<SearchIntentStage, number> = {
  purchase: 0,
  evaluation: 1,
  awareness: 2,
  unclear: 3,
};

/**
 * Builds a bounded list of exact, property-observed query phrases to test in
 * answer engines. Intent is a lexical hint. Search Console impressions are
 * not AI-search demand, and page rows are never added into a query total.
 */
export function planAiSearchQueries(
  rows: readonly SearchQueryObservation[],
  limit = 12,
): AiSearchQuerySuggestion[] {
  const groups = new Map<
    string,
    { query: string; impressions: number; clicks: number; pages: Set<string> }
  >();
  for (const row of rows) {
    const query = row.query.trim().replace(/\s+/g, " ");
    const key = query.toLocaleLowerCase("en-US");
    if (
      !key ||
      !Number.isSafeInteger(row.impressions) ||
      row.impressions <= 0 ||
      !Number.isSafeInteger(row.clicks) ||
      row.clicks < 0
    ) {
      continue;
    }
    const group = groups.get(key) ?? {
      query,
      impressions: 0,
      clicks: 0,
      pages: new Set<string>(),
    };
    if (
      row.impressions > group.impressions ||
      (row.impressions === group.impressions && row.clicks > group.clicks)
    ) {
      group.impressions = row.impressions;
      group.clicks = row.clicks;
      group.query = query;
    }
    if (row.page.trim()) group.pages.add(row.page.trim());
    groups.set(key, group);
  }

  const safeLimit = Number.isFinite(limit)
    ? Math.max(1, Math.min(50, Math.floor(limit)))
    : 12;
  return [...groups.values()]
    .map((group) => ({
      query: group.query,
      intent: inferSearchIntentStage(group.query, ""),
      highestPageImpressions: group.impressions,
      highestPageClicks: group.clicks,
      observedPageCount: group.pages.size,
    }))
    .sort(
      (a, b) =>
        intentOrder[a.intent] - intentOrder[b.intent] ||
        b.highestPageImpressions - a.highestPageImpressions ||
        b.highestPageClicks - a.highestPageClicks ||
        a.query.localeCompare(b.query),
    )
    .slice(0, safeLimit);
}
