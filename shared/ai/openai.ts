import type { z } from "zod";
import type { RateVersion } from "../economics/rates";
import { turnCostMicros, jsonSchemaFor, parseJsonText, ZERO_USAGE, type ContentBlock, type MessageParam, type ProviderItemBlock, type Source, type ToolUseBlock, type TurnRequest, type TurnResult, type TurnUsage } from "./types";
import { MODEL_SPECS } from "./models";
import { FETCH_PAGE_TOOL, fetchPageToolDef, pageFetcherFor } from "./pageFetch";

/**
 * One OpenAI turn (Responses API) behind the same interface as claudeTurn, so
 * the agent runtime, metering and checkpoints don't care which provider runs a
 * phase. Messages stay in the Anthropic shape internally and are translated
 * here (text, tool_use ↔ function_call, tool_result ↔ function_call_output).
 * Reads OPENAI_API_KEY from the environment and never returns it.
 */

type Json = Record<string, unknown>;

/** OpenAI strict structured outputs: every object closed, every key required (optional → nullable). */
export function strictSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(strictSchema);
  if (!node || typeof node !== "object") return node;
  const s = { ...(node as Json) };
  for (const k of ["$schema", "default", "examples", "minLength", "maxLength", "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "pattern", "format", "minItems", "maxItems", "uniqueItems", "propertyNames"]) delete s[k];
  if (s.type === "object" || s.properties) {
    const props = (s.properties ?? {}) as Json;
    const required = new Set((s.required as string[] | undefined) ?? []);
    const out: Json = {};
    for (const [k, v] of Object.entries(props)) {
      const strict = strictSchema(v);
      out[k] = required.has(k) ? strict : { anyOf: [strict, { type: "null" }] };
    }
    s.properties = out;
    s.required = Object.keys(out);
    s.additionalProperties = false;
  }
  for (const k of ["items", "anyOf", "oneOf", "allOf", "$defs", "definitions"]) {
    if (s[k] !== undefined) {
      s[k] = k === "$defs" || k === "definitions" ? Object.fromEntries(Object.entries(s[k] as Json).map(([n, v]) => [n, strictSchema(v)])) : strictSchema(s[k]);
    }
  }
  if (s.oneOf) {
    s.anyOf = s.oneOf;
    delete s.oneOf;
  }
  return s;
}

/**
 * Strict mode makes every key required, so the model sends null for an omitted optional key. Using the
 * original (pre-strict) schema, drop nulls only on optional keys; keep them where the field itself is
 * nullable, so a genuine "unknown" (null) survives to the application schema (REQ-EVID-08).
 */
export function normalizeNulls(v: unknown, schema: unknown, defs: Json = {}): unknown {
  let s = (schema ?? {}) as Json;
  // Resolve local references ("#/$defs/X") against the root's definitions.
  if (typeof s.$ref === "string") s = (defs[s.$ref.replace(/^#\/(\$defs|definitions)\//, "")] ?? {}) as Json;
  const root = { ...defs, ...((s.$defs ?? s.definitions ?? {}) as Json) };
  const variants = (s.anyOf ?? s.oneOf) as unknown[] | undefined;
  if (variants?.length) {
    if (v === null) return null;
    const concrete = variants.filter((x) => (x as Json).type !== "null");
    return concrete.length === 1 ? normalizeNulls(v, concrete[0], root) : v;
  }
  if (Array.isArray(v)) return v.map((x) => normalizeNulls(x, s.items, root));
  if (v && typeof v === "object") {
    const props = (s.properties ?? {}) as Json;
    const required = new Set((s.required as string[] | undefined) ?? []);
    const out: Json = {};
    for (const [k, x] of Object.entries(v as Json)) {
      if (x === null && !required.has(k)) continue; // an omitted optional key
      out[k] = normalizeNulls(x, props[k], root);
    }
    return out;
  }
  return v;
}

/** Nulls stand in for omitted optional keys in strict mode; drop them (tool arguments have no app schema here). */
export function dropNulls(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(dropNulls);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v as Json).filter(([, x]) => x !== null).map(([k, x]) => [k, dropNulls(x)]));
  return v;
}

/** Anthropic-shaped history → Responses API input items. */
export function toInput(messages: MessageParam[]): Json[] {
  const items: Json[] = [];
  for (const m of messages) {
    if (typeof m.content === "string") {
      items.push({ role: m.role, content: m.content });
      continue;
    }
    for (const b of m.content) {
      if (b.type === "text") items.push({ role: m.role, content: b.text });
      if (b.type === "tool_use") items.push({ type: "function_call", call_id: b.id, name: b.name, arguments: JSON.stringify(b.input ?? {}) });
      if (b.type === "provider_item" && b.provider === "openai") items.push(b.item as Json);
      if (b.type === "tool_result") {
        const out = typeof b.content === "string" ? b.content : (b.content ?? []).map((c) => (c.type === "text" ? c.text : "")).join("\n");
        items.push({ type: "function_call_output", call_id: b.tool_use_id, output: out });
      }
    }
  }
  return items;
}

function effortFor(req: TurnRequest, modelId: string): string | undefined {
  if (req.thinkingOff) return modelId.includes("luna") ? "none" : "low";
  return req.effort;
}

type ResponseItem = {
  type: string;
  id?: string;
  status?: string;
  call_id?: string;
  name?: string;
  arguments?: string;
  encrypted_content?: string;
  action?: { type?: string; sources?: { url?: string; title?: string }[] };
  content?: { type: string; text?: string; refusal?: string; annotations?: { type: string; url?: string; title?: string }[] }[];
};
type ResponseBody = {
  id?: string;
  model?: string;
  status?: string;
  incomplete_details?: { reason?: string } | null;
  output?: ResponseItem[];
  usage?: { input_tokens?: number; output_tokens?: number; input_tokens_details?: { cached_tokens?: number; cache_write_tokens?: number }; output_tokens_details?: { reasoning_tokens?: number } };
  error?: { message?: string; type?: string; code?: string } | null;
  metadata?: Record<string, string> | null;
};

export function usageOf(body: ResponseBody): TurnUsage {
  const u = body.usage ?? {};
  const cached = u.input_tokens_details?.cached_tokens ?? 0;
  const written = u.input_tokens_details?.cache_write_tokens ?? 0;
  const searches = (body.output ?? []).filter((i) => i.type === "web_search_call" && (i.action?.type ?? "search") === "search").length;
  return {
    ...ZERO_USAGE,
    // Input includes cache reads and writes: bill each at its own rate.
    inputTokens: Math.max(0, (u.input_tokens ?? 0) - cached - written),
    cacheReadTokens: cached,
    cacheWriteTokens: written,
    // Output already includes reasoning tokens (billed as output).
    outputTokens: u.output_tokens ?? 0,
    thinkingTokens: u.output_tokens_details?.reasoning_tokens ?? 0,
    webSearches: searches,
    calls: 1,
  };
}

function httpFailure(res: Response, json: ResponseBody): TurnResult {
  const usage0 = { ...ZERO_USAGE };
  const msg = json.error?.message ?? `HTTP ${res.status}`;
  const ra = Number(res.headers.get("retry-after"));
  if (res.status === 429 && /quota|billing|credit/i.test(msg)) return { ok: false, kind: "spend_limit", message: "The OpenAI account is out of credit.", usage: usage0, costMicros: 0, appended: [] };
  if (res.status === 429 || res.status >= 500) return { ok: false, kind: "rate_limited", message: "OpenAI is busy right now.", retryAfterMs: Number.isFinite(ra) ? ra * 1000 : undefined, usage: usage0, costMicros: 0, appended: [] };
  if (res.status === 401 || res.status === 403) return { ok: false, kind: "provider_unavailable", message: "OpenAI rejected the server credentials.", usage: usage0, costMicros: 0, appended: [] };
  if (res.status === 404) return { ok: false, kind: "provider_error", message: "OpenAI no longer has that answer.", usage: usage0, costMicros: 0, appended: [] };
  return { ok: false, kind: "provider_error", message: `OpenAI error (${res.status}): ${msg.slice(0, 200)}`, usage: usage0, costMicros: 0, appended: [] };
}

type Respond = { ok: true; json: ResponseBody } | { ok: false; result: TurnResult };

/** One Responses call: foreground, or background (create, or resume `resumeId`, then poll). */
async function respond(body: Json, req: TurnRequest, headers: Record<string, string>, resumeId: string | undefined, rates: RateVersion): Promise<Respond> {
  const usage0 = { ...ZERO_USAGE };
  let res: Response;
  let json: ResponseBody;
  if (req.background) {
    // Background mode: create (or resume) the response, then poll until it finishes or the caller must yield.
    const bg = req.background;
    const pollUntil = bg.pollUntil ?? Date.now() + (req.timeoutMs ?? 600_000);
    let id = resumeId;
    if (!id) {
      try {
        res = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers, body: JSON.stringify({ ...body, background: true, store: true }) });
      } catch {
        return { ok: false, result: { ok: false, kind: "provider_error", message: "OpenAI could not be reached.", usage: usage0, costMicros: 0, appended: [] } };
      }
      json = (await res.json().catch(() => ({}))) as ResponseBody;
      if (!res.ok) return { ok: false, result: httpFailure(res, json) };
      id = json.id;
      if (!id) return { ok: false, result: { ok: false, kind: "provider_error", message: "OpenAI didn't return a response id.", usage: usage0, costMicros: 0, appended: [] } };
      await bg.onStarted?.(id);
    }
    for (;;) {
      try {
        res = await fetch(`https://api.openai.com/v1/responses/${encodeURIComponent(id)}`, { headers });
        json = (await res.json().catch(() => ({}))) as ResponseBody;
      } catch {
        json = { status: "in_progress" };
        res = new Response(null, { status: 200 });
      }
      if (!res.ok) return { ok: false, result: httpFailure(res, json) };
      if (!["queued", "in_progress"].includes(json.status ?? "")) break;
      if (Date.now() + 3_000 > pollUntil) return { ok: false, result: { ok: false, kind: "pending", message: "Still working; continuing in a fresh step.", usage: usage0, costMicros: 0, appended: [] } };
      await new Promise((r) => setTimeout(r, 2_500));
    }
    if (json.status === "failed" || json.status === "cancelled") {
      return { ok: false, result: { ok: false, kind: "provider_error", message: `OpenAI ${json.status === "failed" ? "failed" : "cancelled"} this answer${json.error?.message ? `: ${json.error.message.slice(0, 160)}` : ""}.`, usage: usageOf(json), costMicros: turnCostMicros(req.modelKey, usageOf(json), rates), appended: [] } };
    }
    return { ok: true, json };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), req.timeoutMs ?? 240_000);
  try {
    res = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers, body: JSON.stringify(body), signal: controller.signal });
  } catch (e) {
    clearTimeout(timer);
    const aborted = (e as Error).name === "AbortError";
    return { ok: false, result: { ok: false, kind: aborted ? "timeout" : "provider_error", message: aborted ? "OpenAI took too long to respond." : "OpenAI could not be reached.", usage: usage0, costMicros: 0, appended: [] } };
  }
  clearTimeout(timer);
  json = (await res.json().catch(() => ({}))) as ResponseBody;
  if (!res.ok) return { ok: false, result: httpFailure(res, json) };
  return { ok: true, json };
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

/** Text and tool calls of one response, in the Anthropic shape the runtime appends. */
function blocksOf(item: ResponseItem[]): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  for (const i of item) {
    if (i.type === "reasoning" && i.encrypted_content) {
      // Never place plaintext reasoning in history.
      blocks.push({ type: "provider_item", provider: "openai", item: i as unknown as Record<string, unknown> } satisfies ProviderItemBlock);
    } else if (i.type === "message") {
      const text = (i.content ?? []).filter((c) => c.type === "output_text").map((c) => c.text ?? "").join("");
      if (text) blocks.push({ type: "text", text });
    } else if (i.type === "function_call") {
      let input: unknown = {};
      try {
        input = dropNulls(JSON.parse(i.arguments ?? "{}"));
      } catch {
        input = {};
      }
      blocks.push({ type: "tool_use", id: i.call_id!, name: i.name!, input });
    }
  }
  return blocks;
}

/**
 * Run one OpenAI Responses turn and validate the final answer. With `webFetch`
 * (and a DNS resolver) the model gets a `fetch_page` tool that this adapter
 * runs itself (shared/ai/pageFetch.ts), looping until the model answers: usage
 * is summed over the loop's calls and each page read counts in `webFetches`.
 */
export async function openaiTurn(req: TurnRequest, rates: RateVersion): Promise<TurnResult> {
  const usage0 = { ...ZERO_USAGE };
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: false, kind: "provider_unavailable", message: "OpenAI isn't configured on this server.", usage: usage0, costMicros: 0, appended: [] };
  const spec = MODEL_SPECS[req.modelKey];
  if (spec.provider !== "openai") throw new Error(`${req.modelKey} is not an OpenAI model`);
  const fetcher = req.customTools?.some((t) => t.name === FETCH_PAGE_TOOL) ? null : pageFetcherFor(req.webFetch);
  const tools: Json[] = [];
  if (req.webSearch && req.webSearch.maxUses > 0) {
    const w = req.webSearch;
    tools.push({
      type: "web_search",
      search_context_size: w.maxUses > 8 ? "high" : "medium",
      ...(w.allowedDomains?.length || w.blockedDomains?.length ? { filters: { ...(w.allowedDomains?.length ? { allowed_domains: w.allowedDomains } : {}), ...(w.blockedDomains?.length ? { blocked_domains: w.blockedDomains } : {}) } } : {}),
      ...(w.userLocation ? { user_location: { type: "approximate", ...w.userLocation } } : {}),
    });
  }
  const fnTools = [...(req.customTools ?? []), ...(fetcher ? [fetchPageToolDef(req.webFetch!.maxUses)] : [])];
  for (const t of fnTools) tools.push({ type: "function", name: t.name, description: t.description ?? "", parameters: strictSchema(t.input_schema), strict: true });
  const effort = effortFor(req, spec.apiModelId);
  // Stateless follow-ups (store: false) resend the previous output, reasoning included (encrypted).
  const include = [...(req.webSearch ? ["web_search_call.action.sources"] : []), ...(fnTools.length && !req.background ? ["reasoning.encrypted_content"] : [])];
  const base: Json = {
    model: spec.apiModelId,
    instructions: req.system.map((b) => b.text).join("\n\n"),
    max_output_tokens: req.maxTokens,
    store: false,
    ...(effort ? { reasoning: { effort } } : {}),
    ...(tools.length ? { tools, tool_choice: "auto", include: include.length ? include : undefined } : {}),
    ...(req.schema || req.verbosity ? { text: { ...(req.schema ? { format: { type: "json_schema", name: "answer", schema: strictSchema(jsonSchemaFor(req.schema)), strict: true } } : {}), ...(req.verbosity ? { verbosity: req.verbosity } : {}) } } : {}),
    ...(req.cacheKey ? { prompt_cache_key: req.cacheKey.slice(0, 64) } : {}),
  };
  const headers = { authorization: `Bearer ${apiKey}`, "content-type": "application/json" };

  // A bad fetch_page loop can't run forever: after maxUses + 2 rounds the model must answer.
  const maxRounds = fetcher ? req.webFetch!.maxUses + 2 : 0;
  let input = toInput(req.messages);
  let body: Json = { ...base, input, ...(fetcher && req.background ? { metadata: fetcher.metadata() } : {}) };
  let resumeId = req.background?.resumeResponseId;
  let usedBefore = 0;
  let total: TurnUsage = { ...ZERO_USAGE };
  const sources = new Map<string, Source>();
  const appended: MessageParam[] = [];
  const fetchesNow = () => (fetcher ? fetcher.used - usedBefore : 0);
  let json: ResponseBody;
  let mixed: ResponseItem[] | null = null;
  for (let round = 0; ; round++) {
    const r = await respond(body, req, headers, resumeId, rates);
    if (!r.ok) {
      // Calls already made in this loop are still billed (a pending result carries them for metering).
      const usage = addUsage(r.result.usage, { ...total, webFetches: fetchesNow() });
      return { ...r.result, usage, costMicros: turnCostMicros(req.modelKey, usage, rates), appended: [] } as TurnResult;
    }
    json = r.json;
    if (resumeId && fetcher) {
      // Resumed in a fresh server action: earlier reads were counted and metered before the yield.
      fetcher.restore(json.metadata);
      usedBefore = fetcher.used;
    }
    resumeId = undefined;
    total = addUsage(total, usageOf(json));
    const output = json.output ?? [];
    for (const item of output) {
      if (item.type === "web_search_call") for (const s of item.action?.sources ?? []) if (s.url && !sources.has(s.url)) sources.set(s.url, { url: s.url, title: s.title });
      if (item.type === "message") for (const c of item.content ?? []) if (c.type === "output_text") for (const a of c.annotations ?? []) if (a.type === "url_citation" && a.url && !sources.has(a.url)) sources.set(a.url, { url: a.url, title: a.title });
    }
    const fetchCalls = fetcher ? output.filter((i) => i.type === "function_call" && i.name === FETCH_PAGE_TOOL && i.call_id) : [];
    if (!fetcher || !fetchCalls.length || json.status === "incomplete") break;
    const results = await fetcher.runAll(fetchCalls.map((c) => ({ call_id: c.call_id!, arguments: c.arguments })));
    appended.push({ role: "assistant", content: blocksOf(output) }, { role: "user", content: results.map((x) => ({ type: "tool_result" as const, tool_use_id: x.call_id, content: x.output })) });
    if (req.customTools?.length && output.some((i) => i.type === "function_call" && i.name !== FETCH_PAGE_TOOL)) {
      // The model also called the caller's tools: hand those back (the page reads are answered in `appended`).
      mixed = output;
      break;
    }
    const outputs = results.map((x) => ({ type: "function_call_output", call_id: x.call_id, output: x.output }));
    body = req.background
      ? { ...base, input: outputs, previous_response_id: json.id, metadata: fetcher.metadata() }
      : { ...base, input: (input = [...input, ...(output as unknown as Json[]), ...outputs]) };
    if (round + 1 >= maxRounds) body.tool_choice = "none";
  }

  const usage: TurnUsage = { ...total, webFetches: fetchesNow() };
  const costMicros = turnCostMicros(req.modelKey, usage, rates);
  const output = json.output ?? [];
  let text = "";
  let refusal = "";
  for (const item of output) {
    if (item.type !== "message") continue;
    for (const c of item.content ?? []) {
      if (c.type === "output_text") text += c.text ?? "";
      if (c.type === "refusal") refusal = c.refusal ?? "refused";
    }
  }
  // Pages the model read are research sources too (first, so the cap never drops them).
  const allSources = [...(fetcher?.fetched ?? []), ...[...sources.values()].filter((s) => !fetcher?.fetched.some((f) => f.url === s.url))].slice(0, 60);
  const calls = output.filter((i) => i.type === "function_call" && !(fetcher && i.name === FETCH_PAGE_TOOL));
  // Keep history in the Anthropic shape the runtime appends to.
  const blocks = blocksOf(output);
  if (!mixed && blocks.length) appended.push({ role: "assistant", content: blocks });
  const base2 = { usage, costMicros, appended };

  if (refusal) return { ok: false, kind: "refused", message: "The model declined this request.", ...base2, text };
  if (calls.length && req.customTools?.length) {
    const ids = new Set(calls.map((c) => c.call_id));
    const toolUses = blocks.filter((b): b is ToolUseBlock => b.type === "tool_use" && ids.has(b.id)).map((b) => ({ id: b.id, name: b.name, input: b.input }));
    return { ok: true, output: text, text, ...base2, sources: allSources, actualModelId: json.model ?? spec.apiModelId, stopReason: "tool_use", toolUses };
  }
  if (json.status === "incomplete") {
    return { ok: false, kind: "invalid_output", message: json.incomplete_details?.reason === "max_output_tokens" ? "The answer was cut off at the length limit." : `Incomplete answer (${json.incomplete_details?.reason ?? "unknown"}).`, ...base2, text };
  }
  let parsed: unknown = text;
  if (req.schema) {
    try {
      parsed = (req.schema as z.ZodType).parse(normalizeNulls(parseJsonText(text), jsonSchemaFor(req.schema)));
    } catch (e) {
      return { ok: false, kind: "invalid_output", message: (e as Error).message.slice(0, 400), ...base2, text };
    }
  }
  return { ok: true, output: parsed, text, ...base2, sources: allSources, actualModelId: json.model ?? spec.apiModelId, stopReason: "end_turn" };
}
