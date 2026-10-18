import type Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import type { RateVersion } from "../economics/rates";
import { claudeCostMicros, jsonSchemaFor, parseJsonText, ZERO_CLAUDE_USAGE, type ClaudeTurnRequest, type ClaudeTurnResult, type ClaudeUsage, type Source } from "./claude";
import { MODEL_SPECS } from "./models";

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

/** Nulls stand in for omitted optional keys in strict mode; drop them before zod parses. */
export function dropNulls(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(dropNulls);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v as Json).filter(([, x]) => x !== null).map(([k, x]) => [k, dropNulls(x)]));
  return v;
}

function textOf(content: Anthropic.MessageParam["content"]): string {
  if (typeof content === "string") return content;
  return content
    .map((b) => (b.type === "text" ? b.text : ""))
    .filter(Boolean)
    .join("\n");
}

/** Anthropic-shaped history → Responses API input items. */
export function toInput(messages: Anthropic.MessageParam[]): Json[] {
  const items: Json[] = [];
  for (const m of messages) {
    if (typeof m.content === "string") {
      items.push({ role: m.role, content: m.content });
      continue;
    }
    const text = textOf(m.content);
    if (text) items.push({ role: m.role, content: text });
    for (const b of m.content) {
      if (b.type === "tool_use") items.push({ type: "function_call", call_id: b.id, name: b.name, arguments: JSON.stringify(b.input ?? {}) });
      if (b.type === "tool_result") {
        const out = typeof b.content === "string" ? b.content : (b.content ?? []).map((c) => (c.type === "text" ? c.text : "")).join("\n");
        items.push({ type: "function_call_output", call_id: b.tool_use_id, output: out });
      }
    }
  }
  return items;
}

function effortFor(req: ClaudeTurnRequest, modelId: string): string | undefined {
  if (req.thinkingOff) return modelId.includes("luna") ? "none" : "low";
  return req.effort;
}

type ResponseItem = {
  type: string;
  status?: string;
  call_id?: string;
  name?: string;
  arguments?: string;
  action?: { type?: string; sources?: { url?: string; title?: string }[] };
  content?: { type: string; text?: string; refusal?: string; annotations?: { type: string; url?: string; title?: string }[] }[];
};
type ResponseBody = {
  id?: string;
  model?: string;
  status?: string;
  incomplete_details?: { reason?: string } | null;
  output?: ResponseItem[];
  usage?: { input_tokens?: number; output_tokens?: number; input_tokens_details?: { cached_tokens?: number }; output_tokens_details?: { reasoning_tokens?: number } };
  error?: { message?: string; type?: string; code?: string } | null;
};

export function usageOf(body: ResponseBody): ClaudeUsage {
  const u = body.usage ?? {};
  const cached = u.input_tokens_details?.cached_tokens ?? 0;
  const searches = (body.output ?? []).filter((i) => i.type === "web_search_call" && (i.action?.type ?? "search") === "search").length;
  return {
    ...ZERO_CLAUDE_USAGE,
    // Input includes cached tokens: bill them separately at the cached rate.
    inputTokens: Math.max(0, (u.input_tokens ?? 0) - cached),
    cacheReadTokens: cached,
    // Output already includes reasoning tokens (billed as output).
    outputTokens: u.output_tokens ?? 0,
    thinkingTokens: u.output_tokens_details?.reasoning_tokens ?? 0,
    webSearches: searches,
    calls: 1,
  };
}

/** Run one OpenAI Responses turn and validate the final answer. */
export async function openaiTurn(req: ClaudeTurnRequest, rates: RateVersion): Promise<ClaudeTurnResult> {
  const usage0 = { ...ZERO_CLAUDE_USAGE };
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: false, kind: "provider_unavailable", message: "OpenAI isn't configured on this server.", usage: usage0, costMicros: 0, appended: [] };
  const spec = MODEL_SPECS[req.modelKey];
  if (spec.provider !== "openai") throw new Error(`${req.modelKey} is not an OpenAI model`);
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
  for (const t of req.customTools ?? []) tools.push({ type: "function", name: t.name, description: t.description ?? "", parameters: strictSchema(t.input_schema), strict: true });
  const effort = effortFor(req, spec.apiModelId);
  const body: Json = {
    model: spec.apiModelId,
    instructions: req.system.map((b) => b.text).join("\n\n"),
    input: toInput(req.messages),
    max_output_tokens: req.maxTokens,
    store: false,
    ...(effort ? { reasoning: { effort } } : {}),
    ...(tools.length ? { tools, tool_choice: "auto", include: req.webSearch ? ["web_search_call.action.sources"] : undefined } : {}),
    ...(req.schema ? { text: { format: { type: "json_schema", name: "answer", schema: strictSchema(jsonSchemaFor(req.schema)), strict: true } } } : {}),
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), req.timeoutMs ?? 240_000);
  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    const aborted = (e as Error).name === "AbortError";
    return { ok: false, kind: aborted ? "timeout" : "provider_error", message: aborted ? "OpenAI took too long to respond." : "OpenAI could not be reached.", usage: usage0, costMicros: 0, appended: [] };
  }
  clearTimeout(timer);
  const json = (await res.json().catch(() => ({}))) as ResponseBody;
  if (!res.ok) {
    const msg = json.error?.message ?? `HTTP ${res.status}`;
    const ra = Number(res.headers.get("retry-after"));
    if (res.status === 429 && /quota|billing|credit/i.test(msg)) return { ok: false, kind: "spend_limit", message: "The OpenAI account is out of credit.", usage: usage0, costMicros: 0, appended: [] };
    if (res.status === 429 || res.status >= 500) return { ok: false, kind: "rate_limited", message: "OpenAI is busy right now.", retryAfterMs: Number.isFinite(ra) ? ra * 1000 : undefined, usage: usage0, costMicros: 0, appended: [] };
    if (res.status === 401 || res.status === 403) return { ok: false, kind: "provider_unavailable", message: "OpenAI rejected the server credentials.", usage: usage0, costMicros: 0, appended: [] };
    return { ok: false, kind: "provider_error", message: `OpenAI error (${res.status}): ${msg.slice(0, 200)}`, usage: usage0, costMicros: 0, appended: [] };
  }

  const usage = usageOf(json);
  const costMicros = claudeCostMicros(req.modelKey, usage, rates);
  const output = json.output ?? [];
  const sources = new Map<string, Source>();
  let text = "";
  let refusal = "";
  for (const item of output) {
    if (item.type === "web_search_call") for (const s of item.action?.sources ?? []) if (s.url && !sources.has(s.url)) sources.set(s.url, { url: s.url, title: s.title });
    if (item.type === "message") {
      for (const c of item.content ?? []) {
        if (c.type === "output_text") {
          text += c.text ?? "";
          for (const a of c.annotations ?? []) if (a.type === "url_citation" && a.url && !sources.has(a.url)) sources.set(a.url, { url: a.url, title: a.title });
        }
        if (c.type === "refusal") refusal = c.refusal ?? "refused";
      }
    }
  }
  const calls = output.filter((i) => i.type === "function_call");
  // Keep history in the Anthropic shape the runtime appends to.
  const blocks: Anthropic.ContentBlockParam[] = [];
  if (text) blocks.push({ type: "text", text });
  for (const c of calls) {
    let input: unknown = {};
    try {
      input = dropNulls(JSON.parse(c.arguments ?? "{}"));
    } catch {
      input = {};
    }
    blocks.push({ type: "tool_use", id: c.call_id!, name: c.name!, input });
  }
  const appended: Anthropic.MessageParam[] = blocks.length ? [{ role: "assistant", content: blocks }] : [];
  const base = { usage, costMicros, appended };

  if (refusal) return { ok: false, kind: "refused", message: "The model declined this request.", ...base, text };
  if (calls.length && req.customTools?.length) {
    const toolUses = blocks.filter((b): b is Anthropic.ToolUseBlockParam => b.type === "tool_use").map((b) => ({ id: b.id, name: b.name, input: b.input }));
    return { ok: true, output: text, text, ...base, sources: [...sources.values()].slice(0, 60), actualModelId: json.model ?? spec.apiModelId, stopReason: "tool_use", toolUses };
  }
  if (json.status === "incomplete") {
    return { ok: false, kind: "invalid_output", message: json.incomplete_details?.reason === "max_output_tokens" ? "The answer was cut off at the length limit." : `Incomplete answer (${json.incomplete_details?.reason ?? "unknown"}).`, ...base, text };
  }
  let parsed: unknown = text;
  if (req.schema) {
    try {
      parsed = (req.schema as z.ZodType).parse(dropNulls(parseJsonText(text)));
    } catch (e) {
      return { ok: false, kind: "invalid_output", message: (e as Error).message.slice(0, 400), ...base, text };
    }
  }
  return { ok: true, output: parsed, text, ...base, sources: [...sources.values()].slice(0, 60), actualModelId: json.model ?? spec.apiModelId, stopReason: "end_turn" };
}
