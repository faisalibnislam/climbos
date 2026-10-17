/**
 * Versioned vendor rate registry.
 *
 * `RESEARCH_2026_10_17` is the research-time snapshot that the original
 * ClimbOS-Cost-Calculator.xlsx workbook used. It is preserved verbatim as a
 * regression fixture and must never be edited. Newer prices are added as new,
 * effective-dated versions; every subscription and job records the version id
 * it was priced from.
 *
 * Rates are USD. Token rates are per 1M tokens.
 */

export type ModelKey =
  | "claude-sonnet-5.5"
  | "claude-haiku-5.5"
  | "gpt-6-luna"
  | "gpt-6.1-sol"
  | "gemini-3.8-flash"
  | "gemini-3.1-flash-lite";

export type Provider = "anthropic" | "google" | "openai";

export interface ModelRate {
  key: ModelKey;
  displayName: string;
  provider: Provider;
  inputPerM: number;
  outputPerM: number;
  cacheReadPerM: number;
  /** Claude: 5-minute write. Gemini: regular input rate (explicit cache storage billed separately). */
  cacheWritePerM: number;
  basis: string;
  source: string;
}

export interface ServiceRates {
  /** Planning allowance per image attempt (Gemini 2.5 Flash Image $0.039 output + input allowance). */
  imageAttempt: number;
  searchCall: number;
  scrapeCredit: number;
  transactionalEmail: number;
  vercelCpuHour: number;
  vercelMemoryGbHour: number;
  vercelInvocationsPerM: number;
  convexCallsPerM: number;
  convexActionGbHour: number;
  convexDbIoGb: number;
  convexDbStorageGbMonth: number;
  convexEgressGb: number;
  convexSearchStorageGbMonth: number;
  r2StorageGbMonth: number;
  r2WritesPerM: number;
  r2ReadsPerM: number;
  analyticsEvent: number;
  supportPerMinute: number;
}

export interface PaymentRates {
  provider: "polar";
  plan: "starter" | "pro" | "growth" | "scale";
  /** Checkout percentage applied to the taxed checkout total. */
  percent: number;
  fixedPerTransaction: number;
  internationalSurcharge: number;
  /** Conservative payout + FX reserve applied to pre-tax sales. */
  payoutVariableReserve: number;
  /** $2 active-month payout fee + $0.25 per payout (one payout per month). */
  monthlyPayoutFixed: number;
  /** Paid Polar plan monthly fee (0 for Starter). Change together with percent/fixed. */
  monthlyPlanFee: number;
  source: string;
}

export interface RateVersion {
  id: string;
  label: string;
  /** Inclusive ISO date (UTC) from which this version applies. */
  effectiveFrom: string;
  researchedAt: string;
  models: Record<ModelKey, ModelRate>;
  services: ServiceRates;
  payments: PaymentRates;
  notes: readonly string[];
}

const CLAUDE_PRICING = "https://platform.claude.com/docs/en/about-claude/pricing";
const OPENAI_PRICING = "https://developers.openai.com/api/docs/pricing";
const GEMINI_PRICING = "https://ai.google.dev/gemini-api/docs/pricing";
const POLAR_FEES = "https://polar.sh/docs/merchant-of-record/fees";

const RESEARCH_MODELS: Record<ModelKey, ModelRate> = {
  "claude-sonnet-5.5": {
    key: "claude-sonnet-5.5",
    displayName: "Claude Sonnet 5.5",
    provider: "anthropic",
    inputPerM: 2,
    outputPerM: 10,
    cacheReadPerM: 0.1,
    cacheWritePerM: 2.5,
    basis: "Standard, short context",
    source: CLAUDE_PRICING,
  },
  "claude-haiku-5.5": {
    key: "claude-haiku-5.5",
    displayName: "Claude Haiku 5.5",
    provider: "anthropic",
    inputPerM: 0.1,
    outputPerM: 0.5,
    cacheReadPerM: 0.01,
    cacheWritePerM: 0.125,
    basis: "Standard, short context",
    source: CLAUDE_PRICING,
  },
  "gpt-6-luna": {
    key: "gpt-6-luna",
    displayName: "GPT-6 Luna",
    provider: "openai",
    inputPerM: 0.1,
    outputPerM: 0.5,
    cacheReadPerM: 0.01,
    cacheWritePerM: 0.125,
    basis: "Standard, short context",
    source: OPENAI_PRICING,
  },
  "gpt-6.1-sol": {
    key: "gpt-6.1-sol",
    displayName: "GPT-6.1 Sol",
    provider: "openai",
    inputPerM: 2,
    outputPerM: 10,
    cacheReadPerM: 0.1,
    cacheWritePerM: 2.5,
    basis: "Standard, short context",
    source: OPENAI_PRICING,
  },
  "gemini-3.8-flash": {
    key: "gemini-3.8-flash",
    displayName: "Gemini 3.8 Flash",
    provider: "google",
    inputPerM: 0.75,
    outputPerM: 3.75,
    cacheReadPerM: 0.075,
    cacheWritePerM: 0.75,
    basis: "Standard, short context (promotional until 2027-01-01)",
    source: GEMINI_PRICING,
  },
  "gemini-3.1-flash-lite": {
    key: "gemini-3.1-flash-lite",
    displayName: "Gemini 3.1 Flash-Lite",
    provider: "google",
    inputPerM: 0.25,
    outputPerM: 1.5,
    cacheReadPerM: 0.025,
    cacheWritePerM: 0.25,
    basis: "Standard, short context",
    source: GEMINI_PRICING,
  },
};

const RESEARCH_SERVICES: ServiceRates = {
  imageAttempt: 0.045,
  searchCall: 0.01,
  scrapeCredit: 0.005,
  transactionalEmail: 0.0009,
  vercelCpuHour: 0.128,
  vercelMemoryGbHour: 0.0106,
  vercelInvocationsPerM: 0.6,
  convexCallsPerM: 2,
  convexActionGbHour: 0.3,
  convexDbIoGb: 0.2,
  convexDbStorageGbMonth: 0.2,
  convexEgressGb: 0.12,
  convexSearchStorageGbMonth: 0.5,
  r2StorageGbMonth: 0.015,
  r2WritesPerM: 4.5,
  r2ReadsPerM: 0.36,
  analyticsEvent: 0.00005,
  supportPerMinute: 0.5,
};

const POLAR_STARTER: PaymentRates = {
  provider: "polar",
  plan: "starter",
  percent: 0.05,
  fixedPerTransaction: 0.5,
  internationalSurcharge: 0.015,
  payoutVariableReserve: 0.0125,
  monthlyPayoutFixed: 2.25,
  monthlyPlanFee: 0,
  source: POLAR_FEES,
};

/** Research-time snapshot used by the workbook. Regression fixture: never edit. */
export const RESEARCH_2026_10_17: RateVersion = Object.freeze({
  id: "research-2026-10-17",
  label: "Research snapshot, 17 Oct 2026 (workbook fixture)",
  effectiveFrom: "2026-10-17",
  researchedAt: "2026-10-17",
  models: RESEARCH_MODELS,
  services: RESEARCH_SERVICES,
  payments: POLAR_STARTER,
  notes: [
    "Search call rate is the OpenAI web search research-time rate ($10 / 1k calls).",
    "Scrape credit is the Firecrawl Hobby extra-credit rate ($5 / 1k credits).",
    "No cache, batch or free-tier savings are assumed.",
  ],
});

/**
 * Gemini 3.8 Flash promotional input/output rates double on 1 Jan 2027.
 * Everything else carries forward from the research snapshot.
 */
export const GEMINI_FLASH_REPRICE_2027_01_01: RateVersion = Object.freeze({
  ...RESEARCH_2026_10_17,
  id: "gemini-flash-reprice-2027-01-01",
  label: "Gemini 3.8 Flash promotional pricing ends (1 Jan 2027)",
  effectiveFrom: "2027-01-01",
  models: {
    ...RESEARCH_MODELS,
    "gemini-3.8-flash": {
      ...RESEARCH_MODELS["gemini-3.8-flash"],
      inputPerM: 1.5,
      outputPerM: 7.5,
      cacheReadPerM: 0.15,
      cacheWritePerM: 1.5,
      basis: "Standard, short context (post-promotion)",
    },
  },
  notes: [
    ...RESEARCH_2026_10_17.notes,
    "Gemini 3.8 Flash input/output doubled from the promotional rate.",
  ],
});

/**
 * Implementation-time verification (17 Oct 2026, later the same day).
 * Token rates for every routed model matched the research snapshot. Two
 * service routes changed without changing modeled unit costs:
 * - Gemini 2.5 Flash Image was shut down on 2 Oct 2026. The default image
 *   route is gemini-3.1-flash-lite-image (~$0.0336 per 1K image); the $0.045
 *   planning allowance per attempt still covers output plus prompt input.
 * - Research search calls use Claude's server web search tool at $10 / 1k
 *   searches (same as the OpenAI rate the workbook used). OpenAI is not used.
 * This version is identical in cost to the research snapshot until the
 * Gemini Flash reprice on 1 Jan 2027.
 */
export const VERIFIED_2026_10_17: RateVersion = Object.freeze({
  ...RESEARCH_2026_10_17,
  id: "verified-2026-10-17",
  label: "Verified at implementation, 17 Oct 2026",
  notes: [
    "Image route: gemini-3.1-flash-lite-image (1K) at ~$0.0336; $0.045 planning allowance retained.",
    "Premium image route gemini-3.1-flash-image (2K ~$0.101) requires a separate paid quote.",
    "Search: Claude web_search tool, $10 / 1k searches plus tokens.",
    "Scrape: Firecrawl v2 REST, 1 credit per plain scrape; built-in fetcher fallback is metered identically.",
    "Claude Haiku 5.5 prompts above 100k tokens are billed at long-context rates; ClimbOS clips below 100k.",
  ],
});

/** All known versions, oldest first. */
export const RATE_VERSIONS: readonly RateVersion[] = Object.freeze([
  RESEARCH_2026_10_17,
  VERIFIED_2026_10_17,
  GEMINI_FLASH_REPRICE_2027_01_01,
]);

/** Rate version used for new subscriptions and jobs right now. */
export function currentRateVersion(now: Date = new Date()): RateVersion {
  return rateVersionForDate(now.toISOString().slice(0, 10));
}

export function getRateVersion(id: string): RateVersion {
  const version = RATE_VERSIONS.find((v) => v.id === id);
  if (!version) throw new Error(`Unknown rate version: ${id}`);
  return version;
}

/** The rate version in force on a given ISO date (YYYY-MM-DD, UTC). */
export function rateVersionForDate(isoDate: string): RateVersion {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    throw new RangeError(`Expected YYYY-MM-DD, received ${isoDate}`);
  }
  let current: RateVersion | undefined;
  for (const v of RATE_VERSIONS) {
    if (v.effectiveFrom <= isoDate) current = v;
  }
  if (!current) throw new Error(`No rate version is effective on ${isoDate}`);
  return current;
}

/** Cost in USD of one model call at standard (uncached, unbatched) rates. */
export function modelCallCostUsd(
  rate: ModelRate,
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens?: number; cacheWriteTokens?: number },
): number {
  const { inputTokens, outputTokens } = usage;
  const cacheRead = usage.cacheReadTokens ?? 0;
  const cacheWrite = usage.cacheWriteTokens ?? 0;
  for (const [label, v] of [
    ["inputTokens", inputTokens],
    ["outputTokens", outputTokens],
    ["cacheReadTokens", cacheRead],
    ["cacheWriteTokens", cacheWrite],
  ] as const) {
    if (!Number.isFinite(v) || v < 0) throw new RangeError(`${label} must be a non-negative number`);
  }
  return (
    (inputTokens * rate.inputPerM +
      outputTokens * rate.outputPerM +
      cacheRead * rate.cacheReadPerM +
      cacheWrite * rate.cacheWritePerM) /
    1_000_000
  );
}
