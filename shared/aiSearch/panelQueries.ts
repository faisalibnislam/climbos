import type { AiSearchProvider } from "./visibility";

export const AI_SEARCH_PANEL_LIMIT = 100;

export interface AiSearchPanelQueryInput {
  provider: AiSearchProvider;
  query: string;
  location?: string;
}

/** Build a stable question × provider panel without inventing or rewriting query text. */
export function buildAiSearchPanelQueries(
  rawQuestions: string,
  providers: readonly AiSearchProvider[],
  rawLocation: string,
): { queries: AiSearchPanelQueryInput[]; error: string | null } {
  const questions = [...new Map(
    rawQuestions
      .split(/\n+/u)
      .map((question) => question.trim().replace(/\s+/gu, " "))
      .filter(Boolean)
      .map((question) => [question.toLocaleLowerCase("en-US"), question] as const),
  ).values()];
  const uniqueProviders = [...new Set(providers)];
  if (!questions.length || !uniqueProviders.length) {
    return { queries: [], error: "Add at least one question and choose an answer tool." };
  }

  const location = rawLocation.trim();
  const queries = questions.flatMap((query) => uniqueProviders.map((provider) => ({
    provider,
    query,
    ...(location ? { location } : {}),
  })));

  return queries.length > AI_SEARCH_PANEL_LIMIT
    ? { queries, error: `Choose fewer questions or tools. A panel can contain up to ${AI_SEARCH_PANEL_LIMIT} checks.` }
    : { queries, error: null };
}
