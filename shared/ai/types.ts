import { z } from "zod";
import { usdToMicrosCeil } from "../economics/money";
import type { ModelKey, RateVersion } from "../economics/rates";
import { actualStepMicros } from "./models";

/**
 * Provider-neutral model turn for the Engine v2 agent loop and Climb AI:
 * append-only messages, explicit effort, web search, client tools and exact
 * metering. The OpenAI adapter (openai.ts) implements it.
 */

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export interface SystemBlock {
  text: string;
  /** Stable prefix (providers cache it automatically). */
  cache?: boolean;
}

export interface TextBlock {
  type: "text";
  text: string;
}
export interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: unknown;
}
export interface ToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content: string | TextBlock[];
  is_error?: boolean;
}
export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

export interface MessageParam {
  role: "user" | "assistant";
  content: string | ContentBlock[];
}

/** A client-executed tool (JSON Schema input). */
export interface ToolDef {
  name: string;
  description?: string;
  input_schema: Record<string, unknown>;
}

export interface TurnRequest {
  modelKey: ModelKey;
  system: SystemBlock[];
  /** Conversation so far. Never edited, only appended to. */
  messages: MessageParam[];
  /** Final answer must match this schema. Omit for free-form research notes. */
  schema?: z.ZodType;
  maxTokens: number;
  effort?: Effort;
  /** Minimal reasoning (routine turns). */
  thinkingOff?: boolean;
  webSearch?: {
    maxUses: number;
    allowedDomains?: string[];
    blockedDomains?: string[];
    userLocation?: { country?: string; region?: string; city?: string; timezone?: string };
  };
  /** Page reads during research (OpenAI web search opens pages itself; kept for budgets). */
  webFetch?: { maxUses: number; maxContentTokens?: number; allowedDomains?: string[]; blockedDomains?: string[] };
  /** Client-executed tools (agent loops): a tool call returns the calls to the caller. */
  customTools?: ToolDef[];
  timeoutMs?: number;
}

export interface TurnUsage {
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  webSearches: number;
  webFetches: number;
  calls: number;
}

export interface Source {
  url: string;
  title?: string;
  pageAge?: string;
}

export type TurnFailureKind = "provider_unavailable" | "rate_limited" | "timeout" | "invalid_output" | "provider_error" | "refused" | "spend_limit";

export type TurnResult =
  | {
      ok: true;
      output: unknown;
      text: string;
      /** Assistant messages produced by this turn, to append for the next turn. */
      appended: MessageParam[];
      usage: TurnUsage;
      /** Tokens + web searches, µUSD. */
      costMicros: number;
      sources: Source[];
      actualModelId: string;
      stopReason: string;
      /** Present when the model stopped to call custom tools. */
      toolUses?: { id: string; name: string; input: unknown }[];
    }
  | {
      ok: false;
      kind: TurnFailureKind;
      message: string;
      usage: TurnUsage;
      costMicros: number;
      retryAfterMs?: number;
      text?: string;
      appended: MessageParam[];
    };

export const ZERO_USAGE: TurnUsage = {
  inputTokens: 0,
  outputTokens: 0,
  thinkingTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  webSearches: 0,
  webFetches: 0,
  calls: 0,
};

export function jsonSchemaFor(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

/** Extract the JSON object from model text (tolerates code fences or stray prose). */
export function parseJsonText(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error("Model did not return JSON");
  }
}

export function turnCostMicros(modelKey: ModelKey, usage: TurnUsage, rates: RateVersion): number {
  return (
    actualStepMicros(modelKey, { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, cacheReadTokens: usage.cacheReadTokens, cacheWriteTokens: usage.cacheWriteTokens }, rates) +
    usdToMicrosCeil(usage.webSearches * rates.services.searchCall)
  );
}
