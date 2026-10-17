import { type ModelKey, type RateVersion, modelCallCostUsd } from "../economics/rates";
import { usdToMicrosCeil } from "../economics/money";

/**
 * Model registry: real API identifiers verified against provider docs on
 * 2026-10-17. A public model name is not proof of account access: the
 * provider adapter records the model id the API actually reports, and a
 * missing key yields an explicit "provider unavailable" result.
 */
export interface ModelSpec {
  key: ModelKey;
  provider: "anthropic" | "google" | "openai";
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
  "claude-sonnet-5.5": {
    key: "claude-sonnet-5.5",
    provider: "anthropic",
    apiModelId: "claude-sonnet-5-5",
    availability: "enabled",
    contextWindow: 1_000_000,
    maxOutputTokens: 128_000,
    structuredOutput: "json_schema",
    verifiedAt: "2026-10-17",
    docs: "https://platform.claude.com/docs/en/about-claude/models/overview",
  },
  "claude-haiku-5.5": {
    key: "claude-haiku-5.5",
    provider: "anthropic",
    apiModelId: "claude-haiku-5-5",
    availability: "enabled",
    contextWindow: 1_000_000,
    maxOutputTokens: 128_000,
    longContextThreshold: 100_000,
    structuredOutput: "json_schema",
    verifiedAt: "2026-10-17",
    docs: "https://platform.claude.com/docs/en/about-claude/models/overview",
  },
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
    apiModelId: "unverified",
    availability: "disabled",
    contextWindow: 0,
    maxOutputTokens: 0,
    structuredOutput: "json_schema",
    verifiedAt: "2026-10-17",
    docs: "https://developers.openai.com/api/docs/pricing",
  },
  "gpt-6.1-sol": {
    key: "gpt-6.1-sol",
    provider: "openai",
    apiModelId: "unverified",
    availability: "disabled",
    contextWindow: 0,
    maxOutputTokens: 0,
    structuredOutput: "json_schema",
    verifiedAt: "2026-10-17",
    docs: "https://developers.openai.com/api/docs/pricing",
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

/** Rough token estimate for budgeting before a call (≈4 chars/token, rounded up, +10% margin). */
export function estimateTokens(text: string): number {
  return Math.ceil((text.length / 4) * 1.1);
}
