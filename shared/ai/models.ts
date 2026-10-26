import { type ModelKey, type Provider, type RateModelKey, type RateVersion, modelCallCostUsd } from "../economics/rates";
import { usdToMicrosCeil } from "../economics/money";

/**
 * Model registry: real API identifiers verified against provider docs on
 * 2026-10-17/18; Anthropic, Gemini Pro/Argon and GPT-6 Astra added for model
 * choice on 2026-10-26. A public model name is not proof of account access: the
 * provider adapter records the model id the API actually reports, and a
 * missing key yields an explicit "provider unavailable" result.
 */
export interface ModelSpec {
  key: ModelKey;
  provider: Provider;
  apiModelId: string;
  /** "enabled" = usable when the key is configured; "disabled" = owner decision. */
  availability: "enabled" | "disabled";
  contextWindow: number;
  maxOutputTokens: number;
  /** Prompts at or above this many tokens are billed at long-context rates; ClimbOS clips below it. */
  longContextThreshold?: number;
  structuredOutput: "json_schema";
  verifiedAt: string;
  docs: string;
}

export const MODEL_SPECS: Record<ModelKey, ModelSpec> = {
  "gemini-3.8-flash": {
    key: "gemini-3.8-flash",
    provider: "google",
    apiModelId: "gemini-3.8-flash",
    availability: "enabled",
    contextWindow: 1_000_000,
    maxOutputTokens: 65_536,
    structuredOutput: "json_schema",
    verifiedAt: "2026-10-17",
    docs: "https://ai.google.dev/gemini-api/docs/models",
  },
  "gemini-3.1-flash-lite": {
    key: "gemini-3.1-flash-lite",
    provider: "google",
    apiModelId: "gemini-3.1-flash-lite",
    availability: "enabled",
    contextWindow: 1_000_000,
    maxOutputTokens: 65_536,
    structuredOutput: "json_schema",
    verifiedAt: "2026-10-17",
    docs: "https://ai.google.dev/gemini-api/docs/models",
  },
  "gpt-6-luna": {
    key: "gpt-6-luna",
    provider: "openai",
    apiModelId: "gpt-6-luna",
    availability: "enabled",
    contextWindow: 1_050_000,
    maxOutputTokens: 128_000,
    longContextThreshold: 272_000,
    structuredOutput: "json_schema",
    verifiedAt: "2026-10-18",
    docs: "https://developers.openai.com/api/docs/models",
  },

  "gpt-6.1-sol": {
    key: "gpt-6.1-sol",
    provider: "openai",
    apiModelId: "gpt-6.1-sol",
    availability: "enabled",
    contextWindow: 1_050_000,
    maxOutputTokens: 128_000,
    longContextThreshold: 272_000,
    structuredOutput: "json_schema",
    verifiedAt: "2026-10-18",
    docs: "https://developers.openai.com/api/docs/models",
  },
  "gpt-6-sol": {
    key: "gpt-6-sol",
    provider: "openai",
    apiModelId: "gpt-6-sol",
    availability: "enabled",
    // 1.05M on the API; ClimbOS clips below the 272k long-context price break.
    contextWindow: 272_000,
    maxOutputTokens: 128_000,
    longContextThreshold: 272_000,
    structuredOutput: "json_schema",
    verifiedAt: "2026-10-26",
    docs: "https://developers.openai.com/api/docs/models/gpt-6-sol",
  },
  "claude-sonnet-5": {
    key: "claude-sonnet-5",
    provider: "anthropic",
    apiModelId: "claude-sonnet-5",
    availability: "enabled",
    contextWindow: 1_000_000,
    maxOutputTokens: 128_000,
    structuredOutput: "json_schema",
    verifiedAt: "2026-10-26",
    docs: "https://platform.claude.com/docs/en/about-claude/models/overview",
  },
  "claude-opus-5": {
    key: "claude-opus-5",
    provider: "anthropic",
    apiModelId: "claude-opus-5",
    availability: "enabled",
    contextWindow: 1_000_000,
    maxOutputTokens: 128_000,
    structuredOutput: "json_schema",
    verifiedAt: "2026-10-26",
    docs: "https://platform.claude.com/docs/en/about-claude/models/overview",
  },
  "claude-fable-5": {
    key: "claude-fable-5",
    provider: "anthropic",
    apiModelId: "claude-fable-5",
    availability: "enabled",
    contextWindow: 1_000_000,
    maxOutputTokens: 128_000,
    structuredOutput: "json_schema",
    verifiedAt: "2026-10-26",
    docs: "https://platform.claude.com/docs/en/about-claude/models/overview",
  },
  "gemini-3.5-flash-lite": {
    key: "gemini-3.5-flash-lite",
    provider: "google",
    apiModelId: "gemini-3.5-flash-lite",
    availability: "enabled",
    contextWindow: 1_000_000,
    maxOutputTokens: 65_536,
    structuredOutput: "json_schema",
    verifiedAt: "2026-10-26",
    docs: "https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite",
  },
  "gemini-3.6-flash": {
    key: "gemini-3.6-flash",
    provider: "google",
    apiModelId: "gemini-3.6-flash",
    availability: "enabled",
    contextWindow: 1_000_000,
    maxOutputTokens: 65_536,
    structuredOutput: "json_schema",
    verifiedAt: "2026-10-26",
    docs: "https://ai.google.dev/gemini-api/docs/models/gemini-3.6-flash",
  },
  "gpt-6-astra": {
    key: "gpt-6-astra",
    provider: "openai",
    apiModelId: "gpt-6-astra",
    availability: "enabled",
    // 1.05M on the API; ClimbOS clips below the 272k long-context price break.
    contextWindow: 272_000,
    maxOutputTokens: 128_000,
    longContextThreshold: 272_000,
    structuredOutput: "json_schema",
    verifiedAt: "2026-10-26",
    docs: "https://developers.openai.com/api/docs/models",
  },
  "claude-haiku-5.5": {
    key: "claude-haiku-5.5",
    provider: "anthropic",
    apiModelId: "claude-haiku-5-5",
    availability: "enabled",
    // 1M on the API; prompts above 100k are billed at long-context rates, so ClimbOS clips below it.
    contextWindow: 100_000,
    maxOutputTokens: 128_000,
    longContextThreshold: 100_000,
    structuredOutput: "json_schema",
    verifiedAt: "2026-10-26",
    docs: "https://platform.claude.com/docs/en/about-claude/models/overview",
  },
  "claude-sonnet-5.5": {
    key: "claude-sonnet-5.5",
    provider: "anthropic",
    apiModelId: "claude-sonnet-5-5",
    availability: "enabled",
    contextWindow: 1_000_000,
    maxOutputTokens: 128_000,
    structuredOutput: "json_schema",
    verifiedAt: "2026-10-26",
    docs: "https://platform.claude.com/docs/en/about-claude/models/overview",
  },
  "claude-opus-5.5": {
    key: "claude-opus-5.5",
    provider: "anthropic",
    apiModelId: "claude-opus-5-5",
    availability: "enabled",
    contextWindow: 1_000_000,
    maxOutputTokens: 128_000,
    structuredOutput: "json_schema",
    verifiedAt: "2026-10-26",
    docs: "https://platform.claude.com/docs/en/about-claude/models/overview",
  },
  "claude-fable-5.1": {
    key: "claude-fable-5.1",
    provider: "anthropic",
    apiModelId: "claude-fable-5-1",
    availability: "enabled",
    contextWindow: 1_000_000,
    maxOutputTokens: 128_000,
    structuredOutput: "json_schema",
    verifiedAt: "2026-10-26",
    docs: "https://platform.claude.com/docs/en/about-claude/models/overview",
  },
  "gemini-3.1-pro": {
    key: "gemini-3.1-pro",
    provider: "google",
    apiModelId: "gemini-3.1-pro-preview",
    availability: "enabled",
    // 1,048,576 on the API; prompts above 200k are billed higher, so ClimbOS clips below it.
    contextWindow: 200_000,
    maxOutputTokens: 65_536,
    longContextThreshold: 200_000,
    structuredOutput: "json_schema",
    verifiedAt: "2026-10-26",
    docs: "https://ai.google.dev/gemini-api/docs/models/gemini-3.1-pro-preview",
  },
  "gemini-4-argon": {
    key: "gemini-4-argon",
    provider: "google",
    apiModelId: "gemini-4-argon",
    availability: "enabled",
    // Unified 1,048,576 window for input and output; synchronous output caps at 65,536.
    contextWindow: 983_040,
    maxOutputTokens: 65_536,
    structuredOutput: "json_schema",
    verifiedAt: "2026-10-26",
    docs: "https://ai.google.dev/gemini-api/docs/models/gemini-4-argon",
  },
};

export interface ImageRoute {
  key: string;
  provider: "google";
  apiModelId: string;
  /** Planning allowance per attempt (output + prompt input), USD. */
  planningCostPerAttemptUsd: number;
  resolution: "1K" | "2K";
  includedInPlan: boolean;
  note: string;
}

export const IMAGE_ROUTES: Record<"standard" | "premium", ImageRoute> = {
  standard: {
    key: "standard",
    provider: "google",
    apiModelId: "gemini-3.1-flash-lite-image",
    planningCostPerAttemptUsd: 0.045,
    resolution: "1K",
    includedInPlan: true,
    note: "~$0.0336 per 1K image plus prompt input; budgeted at $0.045 per attempt.",
  },
  premium: {
    key: "premium",
    provider: "google",
    apiModelId: "gemini-3.1-flash-image",
    planningCostPerAttemptUsd: 0.11,
    resolution: "2K",
    includedInPlan: false,
    note: "2K output ~$0.101 per image. Separately quoted and approved; never included in plan allowance.",
  },
};

/**
 * AI video clips for reels (paid accounts): Google Veo 3.1 Lite via the Gemini
 * API, 9:16, 720p, audio muted in the reel. Price per second from published
 * third-party rate cards (Oct 2026), to re-check against Google's pricing page.
 */
export const VIDEO_ROUTE = { apiModelId: "veo-3.1-lite-generate-preview", perSecondUsd: 0.05, resolution: "720p", aspectRatio: "9:16", clipSeconds: 4 } as const;

/** Worst-case cost of one model step: full input budget + full output cap (incl. reasoning). */
export function worstCaseStepMicros(
  modelKey: ModelKey,
  inputBudget: number,
  outputBudget: number,
  rates: RateVersion,
): number {
  const rate = rates.models[modelKey];
  return usdToMicrosCeil(modelCallCostUsd(rate, { inputTokens: inputBudget, outputTokens: outputBudget }));
}

/** Actual cost from provider-reported usage. Cache reads/writes are separate meters. */
export function actualStepMicros(
  modelKey: ModelKey,
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens?: number; cacheWriteTokens?: number },
  rates: RateVersion,
): number {
  return usdToMicrosCeil(modelCallCostUsd(rates.models[modelKey], usage));
}

/** Price of one web search on the provider that serves this model (Gemini grounding is billed per query). */
export function searchCallUsd(modelKey: ModelKey, rates: RateVersion): number {
  return MODEL_SPECS[modelKey].provider === "google" ? (rates.services.groundingSearchCall ?? rates.services.searchCall) : rates.services.searchCall;
}

/** Rough token estimate for budgeting before a call (≈4 chars/token, rounded up, +10% margin). */
export function estimateTokens(text: string): number {
  return Math.ceil((text.length / 4) * 1.1);
}

/** A routing-table model as a callable model (unknown models throw). */
export function runtimeModel(key: RateModelKey): ModelKey {
  if (key in MODEL_SPECS) return key;
  throw new Error(`${key} is retired and can't be called`);
}
