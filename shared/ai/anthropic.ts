import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import type { RateVersion } from "../economics/rates";
import { MODEL_SPECS } from "./models";
import { dropNulls, normalizeNulls, strictSchema } from "./openai";
import { FETCH_PAGE_TOOL, fetchPageToolDef, pageFetcherFor } from "./pageFetch";
import { jsonSchemaFor, parseJsonText, turnCostMicros, ZERO_USAGE, type ContentBlock, type MessageParam, type Source, type ToolUseBlock, type TurnRequest, type TurnResult, type TurnUsage } from "./types";

/**
 * One Claude turn (Messages API, official SDK) behind the same interface as
 * openaiTurn. History is already in the Anthropic shape; thinking and
 * server-tool blocks ride along as opaque `provider_item`s so a tool loop can
 * pass them back unchanged. Reads ANTHROPIC_API_KEY and never returns it.
 *
 * Server-side refusal fallbacks are deliberately not enabled: a fallback runs
 * on another model at that model's rates, and ClimbOS meters every call at
 * the model the operator or user chose.
 */

type Raw = Record<string, unknown>;

/** Dynamic-filtering web search runs on Opus 5.5/5 and Sonnet 5.5/5; other Claude models use the basic tool. */
const DYNAMIC_SEARCH = new Set(["claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5", "claude-sonnet-5"]);

/** ClimbOS history → Messages API params (OpenAI and Gemini continuation items are dropped). */
export function toClaudeMessages(messages: MessageParam[]): Anthropic.MessageParam[] {
  const out: Anthropic.MessageParam[] = [];
  for (const m of messages) {
    if (typeof m.content === "string") {
      out.push({ role: m.role, content: m.content });
      continue;
    }
    const content: Anthropic.ContentBlockParam[] = [];
    for (const b of m.content) {
      if (b.type === "text") content.push({ type: "text", text: b.text });
      else if (b.type === "image") content.push({ type: "image", source: { type: "url", url: b.image_url } });
      else if (b.type === "tool_use") content.push({ type: "tool_use", id: b.id, name: b.name, input: (b.input ?? {}) as Raw });
      else if (b.type === "tool_result") {
        content.push({
          type: "tool_result",
          tool_use_id: b.tool_use_id,
          content: typeof b.content === "string" ? b.content : b.content.map((c) => ({ type: "text" as const, text: c.text })),
          ...(b.is_error ? { is_error: true } : {}),
        });
      } else if (b.type === "provider_item" && b.provider === "anthropic") content.push(b.item as unknown as Anthropic.ContentBlockParam);
    }
    if (content.length) out.push({ role: m.role, content });
  }
  return out;
}

export function claudeUsage(u: Anthropic.Usage | undefined): TurnUsage {
  return {
    ...ZERO_USAGE,
    // input_tokens excludes cache reads and writes; each is billed at its own rate.
    inputTokens: u?.input_tokens ?? 0,
    cacheReadTokens: u?.cache_read_input_tokens ?? 0,
    cacheWriteTokens: u?.cache_creation_input_tokens ?? 0,
    // Output already includes thinking (billed as output).
    outputTokens: u?.output_tokens ?? 0,
    thinkingTokens: u?.output_tokens_details?.thinking_tokens ?? 0,
    webSearches: u?.server_tool_use?.web_search_requests ?? 0,
    calls: 1,
  };
}

function addUsage(a: TurnUsage, b: TurnUsage): TurnUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    thinkingTokens: a.thinkingTokens + b.thinkingTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
    webSearches: a.webSearches + b.webSearches,
    webFetches: a.webFetches + b.webFetches,
    calls: a.calls + b.calls,
  };
}

/** Response content in the ClimbOS shape: text and tool calls, everything else kept opaque and in order. */
function blocksOf(content: Anthropic.ContentBlock[]): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  for (const c of content) {
    if (c.type === "text") {
      if (c.text) blocks.push({ type: "text", text: c.text });
    } else if (c.type === "tool_use") blocks.push({ type: "tool_use", id: c.id, name: c.name, input: dropNulls(c.input) });
    else blocks.push({ type: "provider_item", provider: "anthropic", item: c as unknown as Raw });
  }
  return blocks;
}

function sourcesOf(content: Anthropic.ContentBlock[], into: Map<string, Source>): void {
  for (const c of content) {
    if (c.type === "web_search_tool_result" && Array.isArray(c.content)) {
      for (const r of c.content) if (r.url && !into.has(r.url)) into.set(r.url, { url: r.url, title: r.title ?? undefined });
    }
    if (c.type === "text") {
      for (const cite of c.citations ?? []) {
        if (cite.type === "web_search_result_location" && cite.url && !into.has(cite.url)) into.set(cite.url, { url: cite.url, title: cite.title ?? undefined });
      }
    }
  }
}

function failure(e: unknown): TurnResult {
  const usage = { ...ZERO_USAGE };
  const fail = (kind: Extract<TurnResult, { ok: false }>["kind"], message: string, retryAfterMs?: number): TurnResult => ({ ok: false, kind, message, usage, costMicros: 0, appended: [], ...(retryAfterMs ? { retryAfterMs } : {}) });
  if (e instanceof Anthropic.APIConnectionTimeoutError) return fail("timeout", "Claude took too long to respond.");
  if (e instanceof Anthropic.APIUserAbortError) return fail("timeout", "Claude took too long to respond.");
  if (e instanceof Anthropic.APIConnectionError) return fail("provider_error", "Claude could not be reached.");
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return fail("provider_unavailable", "Anthropic rejected the server credentials.");
  if (e instanceof Anthropic.RateLimitError) {
    const ra = Number(e.headers?.get("retry-after"));
    return fail("rate_limited", "Claude is busy right now.", Number.isFinite(ra) && ra > 0 ? ra * 1000 : undefined);
  }
  if (e instanceof Anthropic.BadRequestError && /credit balance|billing/i.test(e.message)) return fail("spend_limit", "The Anthropic account is out of credit.");
  if (e instanceof Anthropic.NotFoundError) return fail("provider_unavailable", "This Claude model isn't available to the server's Anthropic account.");
  if (e instanceof Anthropic.InternalServerError || (e instanceof Anthropic.APIError && (e.status ?? 0) >= 500)) return fail("rate_limited", "Claude is busy right now.");
  if (e instanceof Anthropic.APIError) return fail("provider_error", `Anthropic error (${e.status ?? "?"}): ${e.message.slice(0, 200)}`);
  return fail("provider_error", "Claude could not be reached.");
}

/**
 * Run one Claude turn and validate the final answer. With `webFetch` (and a
 * DNS resolver) the model gets ClimbOS's `fetch_page` tool, run here in a loop
 * like the OpenAI adapter; `pause_turn` (long server-tool work) is resumed.
 */
export async function anthropicTurn(req: TurnRequest, rates: RateVersion): Promise<TurnResult> {
  const usage0 = { ...ZERO_USAGE };
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, kind: "provider_unavailable", message: "Anthropic isn't configured on this server.", usage: usage0, costMicros: 0, appended: [] };
  const spec = MODEL_SPECS[req.modelKey];
  if (spec.provider !== "anthropic") throw new Error(`${req.modelKey} is not an Anthropic model`);
  const client = new Anthropic({ apiKey, maxRetries: 0 });
  const fetcher = req.customTools?.some((t) => t.name === FETCH_PAGE_TOOL) ? null : pageFetcherFor(req.webFetch);

  const tools: Anthropic.ToolUnion[] = [];
  if (req.webSearch && req.webSearch.maxUses > 0) {
    const w = req.webSearch;
    const common = {
      name: "web_search" as const,
      max_uses: w.maxUses,
      ...(w.allowedDomains?.length ? { allowed_domains: w.allowedDomains } : w.blockedDomains?.length ? { blocked_domains: w.blockedDomains } : {}),
      ...(w.userLocation ? { user_location: { type: "approximate" as const, ...w.userLocation } } : {}),
    };
    tools.push(DYNAMIC_SEARCH.has(spec.apiModelId) ? { type: "web_search_20260209", ...common } : { type: "web_search_20250305", ...common });
  }
  const fnTools = [...(req.customTools ?? []), ...(fetcher ? [fetchPageToolDef(req.webFetch!.maxUses)] : [])];
  for (const t of fnTools) tools.push({ name: t.name, description: t.description ?? "", input_schema: strictSchema(t.input_schema) as Anthropic.Tool.InputSchema, strict: true });

  const system: Anthropic.TextBlockParam[] = req.system.map((b) => ({ type: "text", text: b.text, ...(b.cache ? { cache_control: { type: "ephemeral" as const } } : {}) }));
  const effort = req.thinkingOff ? "low" : req.effort;
  const base = {
    model: spec.apiModelId,
    max_tokens: Math.min(req.maxTokens, spec.maxOutputTokens),
    system,
    ...(tools.length ? { tools } : {}),
    ...(effort || req.schema ? { output_config: { ...(effort ? { effort } : {}), ...(req.schema ? { format: { type: "json_schema" as const, schema: strictSchema(jsonSchemaFor(req.schema)) as Raw } } : {}) } } : {}),
  };

  const deadline = Date.now() + (req.timeoutMs ?? 240_000);
  const maxRounds = (fetcher ? req.webFetch!.maxUses + 2 : 0) + 3;
  let messages = toClaudeMessages(req.messages);
  let total: TurnUsage = { ...ZERO_USAGE };
  const sources = new Map<string, Source>();
  const appended: MessageParam[] = [];
  let mixed = false;
  let res: Anthropic.Message;
  for (let round = 0; ; round++) {
    const remaining = deadline - Date.now();
    try {
      if (remaining <= 0) throw new Anthropic.APIConnectionTimeoutError();
      // Streaming keeps long, high-max_tokens turns under the SDK's HTTP timeout.
      res = await client.messages.stream({ ...base, messages, ...(round + 1 >= maxRounds && fetcher ? { tool_choice: { type: "none" as const } } : {}) }, { timeout: remaining }).finalMessage();
    } catch (e) {
      const r = failure(e);
      // Calls already made in this turn are still billed.
      const usage = addUsage(r.usage, { ...total, webFetches: fetcher?.used ?? 0 });
      return { ...r, usage, costMicros: turnCostMicros(req.modelKey, usage, rates), appended: [] } as TurnResult;
    }
    total = addUsage(total, claudeUsage(res.usage));
    sourcesOf(res.content, sources);
    if (res.stop_reason === "pause_turn" && round + 1 < maxRounds) {
      // Long server-tool work: send the partial turn back and let Claude continue it.
      messages = [...messages, { role: "assistant", content: res.content as unknown as Anthropic.ContentBlockParam[] }];
      appended.push({ role: "assistant", content: blocksOf(res.content) });
      continue;
    }
    const fetchCalls = fetcher ? res.content.filter((c): c is Anthropic.ToolUseBlock => c.type === "tool_use" && c.name === FETCH_PAGE_TOOL) : [];
    if (!fetcher || !fetchCalls.length || res.stop_reason !== "tool_use") break;
    const results = await fetcher.runAll(fetchCalls.map((c) => ({ call_id: c.id, arguments: JSON.stringify(c.input ?? {}) })));
    const toolResults: Anthropic.ToolResultBlockParam[] = results.map((x) => ({ type: "tool_result", tool_use_id: x.call_id, content: x.output }));
    appended.push({ role: "assistant", content: blocksOf(res.content) }, { role: "user", content: results.map((x) => ({ type: "tool_result" as const, tool_use_id: x.call_id, content: x.output })) });
    if (req.customTools?.length && res.content.some((c) => c.type === "tool_use" && c.name !== FETCH_PAGE_TOOL)) {
      // The model also called the caller's tools: hand those back (page reads are answered in `appended`).
      mixed = true;
      break;
    }
    messages = [...messages, { role: "assistant", content: res.content as unknown as Anthropic.ContentBlockParam[] }, { role: "user", content: toolResults }];
  }

  const usage: TurnUsage = { ...total, webFetches: fetcher?.used ?? 0 };
  const costMicros = turnCostMicros(req.modelKey, usage, rates);
  const text = res.content.filter((c): c is Anthropic.TextBlock => c.type === "text").map((c) => c.text).join("");
  const allSources = [...(fetcher?.fetched ?? []), ...[...sources.values()].filter((s) => !fetcher?.fetched.some((f) => f.url === s.url))].slice(0, 60);
  const blocks = blocksOf(res.content);
  if (!mixed && blocks.length) appended.push({ role: "assistant", content: blocks });
  const base2 = { usage, costMicros, appended };

  if (res.stop_reason === "refusal") return { ok: false, kind: "refused", message: "The model declined this request.", ...base2, text };
  const calls = res.content.filter((c): c is Anthropic.ToolUseBlock => c.type === "tool_use" && !(fetcher && c.name === FETCH_PAGE_TOOL));
  if (calls.length && req.customTools?.length) {
    const ids = new Set(calls.map((c) => c.id));
    const toolUses = blocks.filter((b): b is ToolUseBlock => b.type === "tool_use" && ids.has(b.id)).map((b) => ({ id: b.id, name: b.name, input: b.input }));
    return { ok: true, output: text, text, ...base2, sources: allSources, actualModelId: res.model ?? spec.apiModelId, stopReason: "tool_use", toolUses };
  }
  if (res.stop_reason === "max_tokens") return { ok: false, kind: "invalid_output", message: "The answer was cut off at the length limit.", ...base2, text };
  let parsed: unknown = text;
  if (req.schema) {
    try {
      parsed = (req.schema as z.ZodType).parse(normalizeNulls(parseJsonText(text), jsonSchemaFor(req.schema)));
    } catch (e) {
      return { ok: false, kind: "invalid_output", message: (e as Error).message.slice(0, 400), ...base2, text };
    }
  }
  return { ok: true, output: parsed, text, ...base2, sources: allSources, actualModelId: res.model ?? spec.apiModelId, stopReason: res.stop_reason ?? "end_turn" };
}
