import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { usdToMicrosCeil } from "../economics/money";
import type { ModelKey, RateVersion } from "../economics/rates";
import { actualStepMicros, MODEL_SPECS } from "./models";

/**
 * One Claude "turn" for the Engine v2 agent loop: append-only messages,
 * cached system blocks, explicit effort, the 2026 web tools, pause_turn
 * continuation and exact metering. Runs in Convex Node actions and in plain
 * Node (benchmark). Reads ANTHROPIC_API_KEY from the environment and never
 * returns it. Structured output always uses output_config.format: Claude 5.x
 * rejects forced tool_choice and prefill.
 */

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export interface SystemBlock {
  text: string;
  /** Put a cache breakpoint after this block (stable prefixes only). */
  cache?: boolean;
}

export interface ClaudeTurnRequest {
  modelKey: ModelKey;
  system: SystemBlock[];
  /** Conversation so far. Never edited, only appended to (preserved thinking + caching). */
  messages: Anthropic.MessageParam[];
  /** Final answer must match this schema. Omit for free-form research notes. */
  schema?: z.ZodType;
  maxTokens: number;
  effort?: Effort;
  /** Sonnet/Haiku only: no thinking between tool calls. Ignored on Opus (always thinks). */
  thinkingOff?: boolean;
  webSearch?: {
    maxUses: number;
    allowedDomains?: string[];
    blockedDomains?: string[];
    userLocation?: { country?: string; region?: string; city?: string; timezone?: string };
  };
  webFetch?: { maxUses: number; maxContentTokens?: number; allowedDomains?: string[]; blockedDomains?: string[] };
  /** pause_turn continuations allowed for long server-tool turns. */
  maxContinuations?: number;
  /** Client-executed tools (agent loops): a tool_use stop returns the calls to the caller. */
  customTools?: Anthropic.Tool[];
  timeoutMs?: number;
}

export interface ClaudeUsage {
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

export type ClaudeFailureKind = "provider_unavailable" | "rate_limited" | "timeout" | "invalid_output" | "provider_error" | "refused" | "spend_limit";

export type ClaudeTurnResult =
  | {
      ok: true;
      output: unknown;
      text: string;
      /** Assistant messages produced by this turn, to append for the next turn. */
      appended: Anthropic.MessageParam[];
      usage: ClaudeUsage;
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
      kind: ClaudeFailureKind;
      message: string;
      usage: ClaudeUsage;
      costMicros: number;
      retryAfterMs?: number;
      text?: string;
      appended: Anthropic.MessageParam[];
    };

export const ZERO_CLAUDE_USAGE: ClaudeUsage = {
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

function addUsage(total: ClaudeUsage, u: Anthropic.Usage): ClaudeUsage {
  const details = (u as unknown as { output_tokens_details?: { thinking_tokens?: number } }).output_tokens_details;
  return {
    inputTokens: total.inputTokens + u.input_tokens,
    outputTokens: total.outputTokens + u.output_tokens,
    thinkingTokens: total.thinkingTokens + (details?.thinking_tokens ?? 0),
    cacheReadTokens: total.cacheReadTokens + (u.cache_read_input_tokens ?? 0),
    cacheWriteTokens: total.cacheWriteTokens + (u.cache_creation_input_tokens ?? 0),
    webSearches: total.webSearches + (u.server_tool_use?.web_search_requests ?? 0),
    webFetches: total.webFetches + ((u.server_tool_use as { web_fetch_requests?: number } | null | undefined)?.web_fetch_requests ?? 0),
    calls: total.calls + 1,
  };
}

export function claudeCostMicros(modelKey: ModelKey, usage: ClaudeUsage, rates: RateVersion): number {
  return (
    actualStepMicros(modelKey, { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, cacheReadTokens: usage.cacheReadTokens, cacheWriteTokens: usage.cacheWriteTokens }, rates) +
    usdToMicrosCeil(usage.webSearches * rates.services.searchCall)
  );
}

function retryAfterMs(headers: unknown): number | undefined {
  const get = (k: string) => (headers instanceof Headers ? headers.get(k) : (headers as Record<string, string> | undefined)?.[k]);
  const ra = get("retry-after");
  if (!ra) return undefined;
  const secs = Number(ra);
  if (Number.isFinite(secs)) return Math.min(secs * 1000, 120_000);
  const date = Date.parse(ra);
  return Number.isFinite(date) ? Math.max(0, Math.min(date - Date.now(), 120_000)) : undefined;
}

function buildTools(req: ClaudeTurnRequest): Anthropic.ToolUnion[] | undefined {
  const tools: Anthropic.ToolUnion[] = [];
  if (req.webSearch && req.webSearch.maxUses > 0) {
    const w = req.webSearch;
    tools.push({
      type: "web_search_20260318",
      name: "web_search",
      max_uses: w.maxUses,
      ...(w.allowedDomains?.length ? { allowed_domains: w.allowedDomains } : w.blockedDomains?.length ? { blocked_domains: w.blockedDomains } : {}),
      ...(w.userLocation ? { user_location: { type: "approximate" as const, ...w.userLocation } } : {}),
    } as Anthropic.ToolUnion);
  }
  if (req.webFetch && req.webFetch.maxUses > 0) {
    const f = req.webFetch;
    tools.push({
      type: "web_fetch_20260318",
      name: "web_fetch",
      max_uses: f.maxUses,
      max_content_tokens: f.maxContentTokens ?? 12_000,
      ...(f.allowedDomains?.length ? { allowed_domains: f.allowedDomains } : f.blockedDomains?.length ? { blocked_domains: f.blockedDomains } : {}),
    } as Anthropic.ToolUnion);
  }
  if (req.customTools?.length) tools.push(...req.customTools);
  return tools.length ? tools : undefined;
}

function collectSources(content: Anthropic.ContentBlock[], into: Map<string, Source>) {
  for (const block of content) {
    const b = block as unknown as { type: string; content?: unknown };
    if (b.type === "web_search_tool_result" && Array.isArray(b.content)) {
      for (const r of b.content as { url?: string; title?: string; page_age?: string }[]) {
        if (r.url && !into.has(r.url)) into.set(r.url, { url: r.url, title: r.title, pageAge: r.page_age ?? undefined });
      }
    }
    if (b.type === "web_fetch_tool_result" && b.content && typeof b.content === "object") {
      const c = b.content as { url?: string; content?: { title?: string } };
      if (c.url && !into.has(c.url)) into.set(c.url, { url: c.url, title: c.content?.title });
    }
  }
}

/** Run one Claude turn (with pause_turn continuations) and validate the final answer. */
export async function claudeTurn(req: ClaudeTurnRequest, rates: RateVersion): Promise<ClaudeTurnResult> {
  let usage = { ...ZERO_CLAUDE_USAGE };
  const appended: Anthropic.MessageParam[] = [];
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, kind: "provider_unavailable", message: "Claude isn't configured on this server.", usage, costMicros: 0, appended };
  const spec = MODEL_SPECS[req.modelKey];
  if (spec.provider !== "anthropic") throw new Error(`${req.modelKey} is not a Claude model`);
  const client = new Anthropic({ apiKey, maxRetries: 0, timeout: req.timeoutMs ?? 240_000 });
  const isOpus = spec.apiModelId.startsWith("claude-opus");
  const tools = buildTools(req);
  const system: Anthropic.TextBlockParam[] = req.system.map((b) => ({ type: "text", text: b.text, ...(b.cache ? { cache_control: { type: "ephemeral" as const } } : {}) }));
  const messages = [...req.messages];
  const sources = new Map<string, Source>();
  const cost = () => claudeCostMicros(req.modelKey, usage, rates);
  const maxContinuations = req.maxContinuations ?? 4;

  try {
    for (let turn = 0; turn <= maxContinuations; turn++) {
      const res = await client.messages
        .stream({
          model: spec.apiModelId,
          max_tokens: req.maxTokens,
          system,
          messages,
          ...(tools ? { tools } : {}),
          ...(req.thinkingOff && !isOpus ? { thinking: { type: "between_tools" as const } } : {}),
          output_config: {
            ...(req.effort ? { effort: req.effort } : {}),
            ...(req.schema ? { format: { type: "json_schema" as const, schema: jsonSchemaFor(req.schema) } } : {}),
          },
          // Moving breakpoint on the growing conversation tail.
          cache_control: { type: "ephemeral" },
        } as Anthropic.MessageStreamParams)
        .finalMessage();
      usage = addUsage(usage, res.usage);
      collectSources(res.content, sources);
      const assistant: Anthropic.MessageParam = { role: "assistant", content: res.content as Anthropic.ContentBlockParam[] };
      messages.push(assistant);
      appended.push(assistant);
      const text = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");

      if (res.stop_reason === "pause_turn") continue;
      if (res.stop_reason === "tool_use" && req.customTools?.length) {
        const toolUses = res.content
          .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
          .map((b) => ({ id: b.id, name: b.name, input: b.input }));
        return { ok: true, output: text, text, appended, usage, costMicros: cost(), sources: [...sources.values()].slice(0, 60), actualModelId: res.model, stopReason: "tool_use", toolUses };
      }
      if (res.stop_reason === "refusal") {
        return { ok: false, kind: "refused", message: "The model declined this request.", usage, costMicros: cost(), appended, text };
      }
      if (res.stop_reason === "max_tokens") {
        return { ok: false, kind: "invalid_output", message: "The answer was cut off at the length limit.", usage, costMicros: cost(), appended, text };
      }
      let output: unknown = text;
      if (req.schema) {
        try {
          output = req.schema.parse(parseJsonText(text));
        } catch (e) {
          return { ok: false, kind: "invalid_output", message: (e as Error).message.slice(0, 400), usage, costMicros: cost(), appended, text };
        }
      }
      return {
        ok: true,
        output,
        text,
        appended,
        usage,
        costMicros: cost(),
        sources: [...sources.values()].slice(0, 60),
        actualModelId: res.model,
        stopReason: res.stop_reason ?? "end_turn",
      };
    }
    return { ok: false, kind: "provider_error", message: "The research turn did not finish within its continuation limit.", usage, costMicros: cost(), appended };
  } catch (e) {
    if (e instanceof Anthropic.APIConnectionTimeoutError) {
      return { ok: false, kind: "timeout", message: "Claude took too long to respond.", usage, costMicros: cost(), appended };
    }
    if (e instanceof Anthropic.APIError) {
      const body = e.error as { error?: { details?: { error_code?: string } } } | undefined;
      if (e.status === 429 && body?.error?.details?.error_code === "enforced_spend_limit_reached") {
        return { ok: false, kind: "spend_limit", message: "The AI account's spend limit was reached.", usage, costMicros: cost(), appended };
      }
      if (e.status === 429 || e.status === 529) {
        return { ok: false, kind: "rate_limited", message: "Claude is busy right now.", retryAfterMs: retryAfterMs(e.headers), usage, costMicros: cost(), appended };
      }
      if (e.status === 401 || e.status === 403) {
        return { ok: false, kind: "provider_unavailable", message: "Claude rejected the server credentials.", usage, costMicros: cost(), appended };
      }
      return { ok: false, kind: "provider_error", message: `Claude error (${e.status ?? "network"}): ${e.message.slice(0, 200)}`, usage, costMicros: cost(), appended };
    }
    return { ok: false, kind: "provider_error", message: "Claude could not be reached.", usage, costMicros: cost(), appended };
  }
}
