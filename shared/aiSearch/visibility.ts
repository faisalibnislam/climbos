/**
 * Observed AI-search visibility. These are sampled owner observations, not
 * estimates of a platform's complete answer distribution or causal impact.
 */

export type AiSearchProvider = "chatgpt" | "gemini" | "perplexity" | "google_ai_overview" | "other";
export type AnswerStatus = "answered" | "no_answer" | "failed";
export type BrandMention = "yes" | "no" | "unknown";
export type AnswerSentiment = "positive" | "neutral" | "negative" | "mixed" | "unknown";

export interface AiSearchObservation {
  provider: AiSearchProvider;
  query: string;
  checkedAt: number;
  location?: string;
  answerStatus: AnswerStatus;
  brandMention: BrandMention;
  sentiment: AnswerSentiment;
  citedUrls: string[];
  competitorMentions: string[];
}

export interface WilsonInterval {
  low: number;
  high: number;
}

export interface ObservedRate {
  successes: number;
  trials: number;
  rate: number | null;
  interval95: WilsonInterval | null;
  intervalMethod: "wilson_score_independence_assumption" | null;
}

export interface AiSearchVisibilityRow {
  provider: AiSearchProvider;
  query: string;
  location: string | null;
  samples: { answered: number; noAnswer: number; failed: number };
  brandMentions: ObservedRate;
  firstPartyCitations: ObservedRate | null;
  sentiment: Record<AnswerSentiment, number>;
  competitors: { name: string; answers: number }[];
  observedFrom: number;
  observedTo: number;
  evidenceBasis: "owner_observed";
}

export interface AiSearchPanelSummary {
  observations: number;
  answered: number;
  noAnswer: number;
  failed: number;
  queryCount: number;
  businessMentionAnswers: number;
  competitorMentionEvents: number;
  answersWithKnownBrandOrCompetitorMention: number;
  businessShareAmongAnswersWithKnownBrandOrCompetitorMention: ObservedRate;
  firstPartyCitationAnswers: number | null;
  observedFirstPartyCitationRate: ObservedRate | null;
  competitorMentionAnswers: { name: string; answers: number }[];
  evidenceBasis: "owner_observed";
  limitations: string[];
}

const Z95 = 1.959963984540054;

/** Wilson score interval: finite for small samples and deterministic. */
export function wilsonInterval(successes: number, trials: number): WilsonInterval | null {
  if (!Number.isSafeInteger(successes) || !Number.isSafeInteger(trials) || trials <= 0 || successes < 0 || successes > trials) return null;
  const n = trials;
  const p = successes / n;
  const z2 = Z95 * Z95;
  const denominator = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denominator;
  const margin = (Z95 * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denominator;
  return { low: Math.max(0, center - margin), high: Math.min(1, center + margin) };
}

export function observedRate(successes: number, trials: number): ObservedRate {
  return {
    successes,
    trials,
    rate: trials > 0 ? successes / trials : null,
    interval95: wilsonInterval(successes, trials),
    intervalMethod: trials > 0 ? "wilson_score_independence_assumption" : null,
  };
}

function host(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function sameBusinessDomain(cited: string, businessWebsite: string): boolean {
  const citationHost = host(cited);
  const businessHost = host(businessWebsite);
  return Boolean(citationHost && businessHost && (citationHost === businessHost || citationHost.endsWith(`.${businessHost}`)));
}

const cleanKey = (value: string) => value.trim().toLocaleLowerCase().replace(/\s+/g, " ");

/**
 * Aggregate only comparable samples: platform, normalized query and stated
 * location. Failed/no-answer checks are visible, but are not counted as
 * answered responses. Unknown mention labels are excluded from that rate.
 */
export function summarizeAiSearchVisibility(
  observations: readonly AiSearchObservation[],
  businessWebsite?: string,
): AiSearchVisibilityRow[] {
  const groups = new Map<string, { provider: AiSearchProvider; query: string; location: string | null; rows: AiSearchObservation[] }>();
  for (const observation of observations) {
    const queryKey = cleanKey(observation.query);
    if (!queryKey) continue;
    const location = observation.location?.trim() || null;
    const key = `${observation.provider}\u0000${queryKey}\u0000${cleanKey(location ?? "")}`;
    const group = groups.get(key) ?? { provider: observation.provider, query: observation.query.trim(), location, rows: [] };
    group.rows.push(observation);
    groups.set(key, group);
  }

  return [...groups.values()].map(({ provider, query, location, rows }) => {
    const answered = rows.filter((row) => row.answerStatus === "answered");
    const knownMentions = answered.filter((row) => row.brandMention !== "unknown");
    const mentionSuccesses = knownMentions.filter((row) => row.brandMention === "yes").length;
    const citationSuccesses = businessWebsite
      ? answered.filter((row) => row.citedUrls.some((url) => sameBusinessDomain(url, businessWebsite))).length
      : null;
    const sentiment: Record<AnswerSentiment, number> = { positive: 0, neutral: 0, negative: 0, mixed: 0, unknown: 0 };
    const competitors = new Map<string, { name: string; answers: number }>();
    for (const row of answered) {
      if (row.brandMention === "yes") sentiment[row.sentiment] += 1;
      for (const name of new Set(row.competitorMentions.map((item) => cleanKey(item)).filter(Boolean))) {
        const existing = competitors.get(name) ?? { name: row.competitorMentions.find((item) => cleanKey(item) === name)!.trim(), answers: 0 };
        existing.answers += 1;
        competitors.set(name, existing);
      }
    }
    const dates = rows.map((row) => row.checkedAt);
    return {
      provider,
      query,
      location,
      samples: {
        answered: answered.length,
        noAnswer: rows.filter((row) => row.answerStatus === "no_answer").length,
        failed: rows.filter((row) => row.answerStatus === "failed").length,
      },
      brandMentions: observedRate(mentionSuccesses, knownMentions.length),
      firstPartyCitations: businessWebsite ? observedRate(citationSuccesses!, answered.length) : null,
      sentiment,
      competitors: [...competitors.values()].sort((a, b) => b.answers - a.answers || a.name.localeCompare(b.name)),
      observedFrom: Math.min(...dates),
      observedTo: Math.max(...dates),
      evidenceBasis: "owner_observed" as const,
    };
  }).sort((a, b) => a.provider.localeCompare(b.provider) || cleanKey(a.query).localeCompare(cleanKey(b.query)) || cleanKey(a.location ?? "").localeCompare(cleanKey(b.location ?? "")));
}

/**
 * Descriptive summary of the supplied observations. Every answered check has
 * equal weight regardless of query demand. Competitor coverage is limited to
 * labels the observer entered, and repeated checks are not independent market
 * samples; this is not market share or causal business impact.
 */
export function summarizeAiSearchPanel(
  observations: readonly AiSearchObservation[],
  businessWebsite?: string,
): AiSearchPanelSummary {
  const answered = observations.filter((row) => row.answerStatus === "answered");
  const knownMentions = answered.filter((row) => row.brandMention !== "unknown");
  const businessMentionAnswers = knownMentions.filter((row) => row.brandMention === "yes").length;
  const competitorAnswerCounts = new Map<string, { name: string; answers: number }>();
  let competitorMentionEvents = 0;
  let answersWithKnownBrandOrCompetitorMention = 0;

  for (const row of answered) {
    const uniqueNames = new Set(row.competitorMentions.map(cleanKey).filter(Boolean));
    competitorMentionEvents += uniqueNames.size;
    if (row.brandMention !== "unknown" && (row.brandMention === "yes" || uniqueNames.size > 0)) {
      answersWithKnownBrandOrCompetitorMention += 1;
    }
    for (const normalizedName of uniqueNames) {
      const name = row.competitorMentions.find((item) => cleanKey(item) === normalizedName)!.trim();
      const current = competitorAnswerCounts.get(normalizedName) ?? { name, answers: 0 };
      current.answers += 1;
      competitorAnswerCounts.set(normalizedName, current);
    }
  }

  const citationAnswers = businessWebsite
    ? answered.filter((row) => row.citedUrls.some((url) => sameBusinessDomain(url, businessWebsite))).length
    : null;
  return {
    observations: observations.length,
    answered: answered.length,
    noAnswer: observations.filter((row) => row.answerStatus === "no_answer").length,
    failed: observations.filter((row) => row.answerStatus === "failed").length,
    queryCount: new Set(observations.map((row) => `${row.provider}\u0000${cleanKey(row.query)}\u0000${cleanKey(row.location ?? "")}`)).size,
    businessMentionAnswers,
    competitorMentionEvents,
    answersWithKnownBrandOrCompetitorMention,
    businessShareAmongAnswersWithKnownBrandOrCompetitorMention: observedRate(businessMentionAnswers, answersWithKnownBrandOrCompetitorMention),
    firstPartyCitationAnswers: citationAnswers,
    observedFirstPartyCitationRate: citationAnswers === null ? null : observedRate(citationAnswers, answered.length),
    competitorMentionAnswers: [...competitorAnswerCounts.values()].sort((a, b) => b.answers - a.answers || a.name.localeCompare(b.name)),
    evidenceBasis: "owner_observed",
    limitations: [
      "Each recorded answer has equal weight; this does not weight queries by customer demand or commercial importance.",
      "Competitor mentions include only names entered by the observer and may omit alternatives.",
      "Wilson intervals are nominal and assume independent observations; repeated prompts or platform changes can violate this assumption. The result is not market share.",
      "A citation or mention is not evidence of visits, leads, customers, or revenue impact.",
    ],
  };
}
