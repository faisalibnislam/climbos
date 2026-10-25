import type { ReadinessFinding } from "./readiness";

export type OpportunityPriority = {
  finding: ReadinessFinding;
  priority: "check_first" | "verify" | "review";
  priorityReason: string;
  effort: "small" | "moderate" | "unknown";
  evidenceQuality: "direct_observation" | "incomplete_observation";
  customerRelevance: "business_homepage_only";
  observedVisibility: "not_measured_by_this_check";
  businessValue: "unknown";
  nextUsefulCheck: string;
};

export type AiAnswerSample = {
  provider: string;
  query: string;
  location?: string | null;
  checkedAt: number;
  answerStatus: string;
  brandMention: string;
  citedUrls: string[];
};

export type SearchQueryRow = { query: string; page: string; clicks: number; impressions: number };

export type AiVisibilityOpportunity = {
  provider: string;
  query: string;
  location: string | null;
  priority: "investigate_repeated_gap" | "recheck_single_gap";
  answerSamples: number;
  knownMentionSamples: number;
  observedNoMention: number;
  citationSamples: number;
  observedNoOwnCitation: number;
  lastCheckedAt: number;
  exactSearchConsoleMatch: { query: string; page: string; clicks: number; impressions: number } | null;
  customerRelevance: "owner_tracked_question";
  businessValue: "unknown";
  effort: "unknown_until_target_page_is_reviewed";
  nextCheck: string;
};

const normalizeQuery = (value: string) => value.trim().toLocaleLowerCase("en-US").replace(/\s+/gu, " ");
const MIN_REPEAT_INTERVAL_MS = 24 * 60 * 60 * 1_000;

function repeatedAcrossDays(samples: AiAnswerSample[]): boolean {
  if (samples.length < 2) return false;
  const times = samples.map((sample) => sample.checkedAt);
  return Math.max(...times) - Math.min(...times) >= MIN_REPEAT_INTERVAL_MS;
}

function isFirstPartyCitation(citedUrls: string[], website: string): boolean {
  let businessHost: string;
  try { businessHost = new URL(website).hostname.toLocaleLowerCase("en-US").replace(/^www\./u, ""); }
  catch { return false; }
  return citedUrls.some((raw) => {
    try {
      const host = new URL(raw).hostname.toLocaleLowerCase("en-US").replace(/^www\./u, "");
      return host === businessHost || host.endsWith(`.${businessHost}`);
    } catch { return false; }
  });
}

/**
 * Rank only owner-recorded, answered samples with explicit negative evidence.
 * Exact Search Console phrase matches add property context, never a conversion
 * or qualified-demand claim. Unlinked value and implementation effort stay unknown.
 */
export function prioritizeAiVisibilityGaps(input: {
  observations: AiAnswerSample[];
  website?: string | null;
  searchQueries?: SearchQueryRow[];
}): AiVisibilityOpportunity[] {
  const grouped = new Map<string, AiAnswerSample[]>();
  for (const observation of input.observations) {
    if (observation.answerStatus !== "answered") continue;
    const key = [observation.provider, normalizeQuery(observation.query), normalizeQuery(observation.location ?? "")].join("\u0000");
    grouped.set(key, [...(grouped.get(key) ?? []), observation]);
  }
  const queryMap = new Map<string, SearchQueryRow>();
  for (const row of input.searchQueries ?? []) {
    const key = normalizeQuery(row.query);
    const current = queryMap.get(key);
    if (!current || row.impressions > current.impressions) queryMap.set(key, row);
  }
  const opportunities: AiVisibilityOpportunity[] = [];
  for (const samples of grouped.values()) {
    const latest = samples.reduce((a, b) => a.checkedAt > b.checkedAt ? a : b);
    const mentionSamples = samples.filter((sample) => sample.brandMention === "yes" || sample.brandMention === "no");
    const noMentionSamples = mentionSamples.filter((sample) => sample.brandMention === "no");
    const noMention = noMentionSamples.length;
    const citationSamples = input.website ? samples.filter((sample) => sample.citedUrls.length > 0) : [];
    const noOwnCitationSamples = input.website
      ? citationSamples.filter((sample) => !isFirstPartyCitation(sample.citedUrls, input.website!))
      : [];
    const noOwnCitation = noOwnCitationSamples.length;
    if (!noMention && !noOwnCitation) continue;
    // Multiple checks in one sitting can be near-duplicates, not durable evidence.
    // Keep their counts visible, but call a gap repeated only when the negative
    // observation is reproduced at least 24 hours later.
    const repeated = repeatedAcrossDays(noMentionSamples) || repeatedAcrossDays(noOwnCitationSamples);
    const exactSearchConsoleMatch = queryMap.get(normalizeQuery(latest.query)) ?? null;
    opportunities.push({
      provider: latest.provider,
      query: latest.query,
      location: latest.location ?? null,
      priority: repeated ? "investigate_repeated_gap" : "recheck_single_gap",
      answerSamples: samples.length,
      knownMentionSamples: mentionSamples.length,
      observedNoMention: noMention,
      citationSamples: citationSamples.length,
      observedNoOwnCitation: noOwnCitation,
      lastCheckedAt: latest.checkedAt,
      exactSearchConsoleMatch: exactSearchConsoleMatch ? { query: exactSearchConsoleMatch.query, page: exactSearchConsoleMatch.page, clicks: exactSearchConsoleMatch.clicks, impressions: exactSearchConsoleMatch.impressions } : null,
      customerRelevance: "owner_tracked_question",
      businessValue: "unknown",
      effort: "unknown_until_target_page_is_reviewed",
      nextCheck: exactSearchConsoleMatch
        ? "Review the strongest matching Search Console page and the recorded answer together, confirm that the phrase reflects a real customer need, then identify the smallest page or entity change worth testing."
        : "Repeat the same question in the same provider and market, inspect the exact answer and cited URLs, then compare with a real customer question before proposing a content change.",
    });
  }
  return opportunities.sort((a, b) => Number(b.priority === "investigate_repeated_gap") - Number(a.priority === "investigate_repeated_gap") || Math.max(b.observedNoMention, b.observedNoOwnCitation) - Math.max(a.observedNoMention, a.observedNoOwnCitation) || b.lastCheckedAt - a.lastCheckedAt);
}

const ACCESS_BLOCKERS = new Set(["http-status", "page-noindex"]);
const CONTENT_CLARITY = new Set(["missing-title", "missing-description", "missing-h1", "thin-readable-content"]);
const SMALL_FIXES = new Set(["missing-title", "missing-description", "missing-h1", "missing-document-language", "missing-viewport"]);
const MODERATE_FIXES = new Set(["invalid-json-ld", "multiple-h1", "heading-order"]);

/**
 * Order only the strength and type of the observed prerequisite. This is not a
 * growth-impact score: demand, customer relevance, business value and expected
 * visibility remain unknown unless separate evidence is available.
 */
export function prioritizeSearchOpportunities(findings: ReadinessFinding[]): OpportunityPriority[] {
  return findings.map((finding) => {
    const accessBlocked = ACCESS_BLOCKERS.has(finding.id);
    const shouldVerify = finding.id === "robots-unavailable" || finding.id.startsWith("robots-");
    const clarityIssue = CONTENT_CLARITY.has(finding.id);
    return {
      finding,
      priority: accessBlocked ? "check_first" as const : shouldVerify ? "verify" as const : "review" as const,
      priorityReason: accessBlocked
        ? "This check found an HTTP or indexing prerequisite that can prevent access to this page. Confirm it is unintended before making a change."
        : shouldVerify
          ? "Crawler access is unknown or restricted by the published robots.txt rule; this is only an access prerequisite, not proof of lost traffic or citations."
          : clarityIssue
            ? "This check found a page-level clarity or readable-content issue that is directly observable in the sampled HTML."
            : "This is a page-level technical check; review whether it matters for this page before changing anything.",
      effort: SMALL_FIXES.has(finding.id) ? "small" as const : MODERATE_FIXES.has(finding.id) ? "moderate" as const : "unknown" as const,
      evidenceQuality: finding.id === "robots-unavailable" ? "incomplete_observation" as const : "direct_observation" as const,
      customerRelevance: "business_homepage_only" as const,
      observedVisibility: "not_measured_by_this_check" as const,
      businessValue: "unknown" as const,
      nextUsefulCheck: finding.id === "no-structured-data"
        ? "First check whether a relevant structured-data type accurately describes information already visible on the page; do not add markup just to seek AI citations."
        : "Compare this page with the business's real customer questions and dated Search Console or AI-answer observations before estimating business value.",
    };
  }).sort((a, b) => {
    const order = { check_first: 0, verify: 1, review: 2 } as const;
    return order[a.priority] - order[b.priority] || Number(a.finding.level === "check") - Number(b.finding.level === "check") || a.finding.title.localeCompare(b.finding.title);
  });
}
