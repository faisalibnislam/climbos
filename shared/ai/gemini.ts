import type { z } from "zod";
import type { RateVersion } from "../economics/rates";
import { MODEL_SPECS } from "./models";
import { dropNulls, normalizeNulls, strictSchema } from "./openai";
import { FETCH_PAGE_TOOL, fetchPageToolDef, pageFetcherFor } from "./pageFetch";
import { jsonSchemaFor, parseJsonText, turnCostMicros, ZERO_USAGE, type ContentBlock, type MessageParam, type Source, type ToolUseBlock, type TurnRequest, type TurnResult, type TurnUsage } from "./types";

/**
 * One Gemini turn (generateContent REST) behind the same interface as
 * openaiTurn. Plain fetch, so it runs in both Convex runtimes. A model turn's
 * raw parts (with their thought signatures, which Gemini requires back on
 * function-calling turns) ride along as an opaque `provider_item`. Web search
 * uses Google Search grounding, metered per query at the grounding rate.
 * Reads GEMINI_API_KEY and never returns it.
 */

type Json = Record<string, unknown>;
type Part = { text?: string; thought?: boolean; thoughtSignature?: string; functionCall?: { id?: string; name: string; args?: Json }; functionResponse?: Json; fileData?: Json };
type Body = {
  candidates?: { content?: { parts?: Part[] }; finishReason?: string; groundingMetadata?: { webSearchQueries?: string[]; groundingChunks?: { web?: { uri?: string; title?: string } }[] } }[];
  usageMetadata?: { promptTokenCount?: number; cachedContentTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number; toolUsePromptTokenCount?: number };
  modelVersion?: string;
  promptFeedback?: { blockReason?: string };
  error?: { message?: string; status?: string };
};

/** ClimbOS history → Gemini contents. A model turn with saved raw parts is replayed exactly. */
export function toGeminiContents(messages: MessageParam[]): Json[] {
  const names = new Map<string, string>();
  const out: Json[] = [];
  for (const m of messages) {
    const role = m.role === "assistant" ? "model" : "user";
    if (typeof m.content === "string") {
      out.push({ role, parts: [{ text: m.content }] });
      continue;
    }
    for (const b of m.content) if (b.type === "tool_use") names.set(b.id, b.name);
    const raw = m.content.find((b) => b.type === "provider_item" && b.provider === "google");
    if (raw && raw.type === "provider_item") {
      out.push({ role, parts: (raw.item.parts as Part[]) ?? [] });
      continue;
    }
    const parts: Json[] = [];
    for (const b of m.content) {
      if (b.type === "text") parts.push({ text: b.text });
      else if (b.type === "image") parts.push({ fileData: { fileUri: b.image_url, mimeType: "image/jpeg" } });
      else if (b.type === "tool_use") parts.push({ functionCall: { id: b.id, name: b.name, args: b.input ?? {} } });
      else if (b.type === "tool_result") {
        const output = typeof b.content === "string" ? b.content : b.content.map((c) => c.text).join("\n");
        parts.push({ functionResponse: { id: b.tool_use_id, name: names.get(b.tool_use_id) ?? "tool", response: b.is_error ? { error: output } : { output } } });
      }
    }
    if (parts.length) out.push({ role, parts });
  }
  return out;
}

export function geminiUsage(body: Body): TurnUsage {
  const u = body.usageMetadata ?? {};
  const cached = u.cachedContentTokenCount ?? 0;
  return {
    ...ZERO_USAGE,
    // Prompt count includes cached tokens; grounding results (toolUsePrompt) are billed as input.
    inputTokens: Math.max(0, (u.promptTokenCount ?? 0) - cached) + (u.toolUsePromptTokenCount ?? 0),
    cacheReadTokens: cached,
    // Thinking is billed as output.
    outputTokens: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0),
    thinkingTokens: u.thoughtsTokenCount ?? 0,
    webSearches: body.candidates?.[0]?.groundingMetadata?.webSearchQueries?.length ?? 0,
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

/** Function calls get stable ids (Gemini may omit them) so results can be matched. */
function withIds(parts: Part[], round: number): Part[] {
  return parts.map((p, i) => (p.functionCall && !p.functionCall.id ? { ...p, functionCall: { ...p.functionCall, id: `gemini_${round}_${i}` } } : p));
}

function blocksOf(parts: Part[]): ContentBlock[] {
  const blocks: ContentBlock[] = [{ type: "provider_item", provider: "google", item: { parts } }];
  const text = parts.filter((p) => p.text && !p.thought).map((p) => p.text).join("");
  if (text) blocks.push({ type: "text", text });
  for (const p of parts) if (p.functionCall) blocks.push({ type: "tool_use", id: p.functionCall.id!, name: p.functionCall.name, input: dropNulls(p.functionCall.args ?? {}) });
  return blocks;
}

function httpFailure(status: number, body: Body, retryAfter: string | null): TurnResult {
  const usage = { ...ZERO_USAGE };
  const msg = body.error?.message ?? `HTTP ${status}`;
  const fail = (kind: Extract<TurnResult, { ok: false }>["kind"], message: string, retryAfterMs?: number): TurnResult => ({ ok: false, kind, message, usage, costMicros: 0, appended: [], ...(retryAfterMs ? { retryAfterMs } : {}) });
  if (status === 429 && /billing|quota exceeded for.*paid|prepay/i.test(msg)) return fail("spend_limit", "The Gemini account is out of credit.");
  if (status === 429 || status >= 500) {
    const ra = Number(retryAfter);
    return fail("rate_limited", "Gemini is busy right now.", Number.isFinite(ra) && ra > 0 ? ra * 1000 : 20_000);
  }
  if (status === 401 || status === 403) return fail("provider_unavailable", "Gemini rejected the server credentials.");
  if (status === 404) return fail("provider_unavailable", "This Gemini model isn't available to the server's Google account.");
  return fail("provider_error", `Gemini error (${status}): ${msg.slice(0, 200)}`);
}

/** Run one Gemini turn and validate the final answer (page reads loop like the OpenAI adapter). */
export async function geminiTurn(req: TurnRequest, rates: RateVersion): Promise<TurnResult> {
  const usage0 = { ...ZERO_USAGE };
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, kind: "provider_unavailable", message: "Gemini isn't configured on this server.", usage: usage0, costMicros: 0, appended: [] };
  const spec = MODEL_SPECS[req.modelKey];
  if (spec.provider !== "google") throw new Error(`${req.modelKey} is not a Gemini model`);
  const fetcher = req.customTools?.some((t) => t.name === FETCH_PAGE_TOOL) ? null : pageFetcherFor(req.webFetch);
  const fnTools = [...(req.customTools ?? []), ...(fetcher ? [fetchPageToolDef(req.webFetch!.maxUses)] : [])];
  const tools: Json[] = [];
  if (fnTools.length) tools.push({ functionDeclarations: fnTools.map((t) => ({ name: t.name, description: t.description ?? "", parametersJsonSchema: strictSchema(t.input_schema) })) });
  if (req.webSearch && req.webSearch.maxUses > 0) tools.push({ googleSearch: {} });
  const level = req.thinkingOff || req.effort === "low" ? "low" : req.effort ? "high" : undefined;
  const base: Json = {
    systemInstruction: { parts: [{ text: req.system.map((b) => b.text).join("\n\n") }] },
    ...(tools.length ? { tools } : {}),
    generationConfig: {
      maxOutputTokens: Math.min(req.maxTokens, spec.maxOutputTokens),
      ...(req.schema ? { responseMimeType: "application/json", responseJsonSchema: strictSchema(jsonSchemaFor(req.schema)) } : {}),
      ...(level ? { thinkingConfig: { thinkingLevel: level } } : {}),
    },
  };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(spec.apiModelId)}:generateContent`;
  const deadline = Date.now() + (req.timeoutMs ?? 240_000);
  const maxRounds = fetcher ? req.webFetch!.maxUses + 2 : 1;
  let contents = toGeminiContents(req.messages);
  let total: TurnUsage = { ...ZERO_USAGE };
  const sources = new Map<string, Source>();
  const appended: MessageParam[] = [];
  let mixed = false;
  let body: Body = {};
  let parts: Part[] = [];
  for (let round = 0; ; round++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(1, deadline - Date.now()));
    let res: Response;
    try {
      const last = fetcher && round + 1 >= maxRounds;
      res = await fetch(url, { method: "POST", headers: { "x-goog-api-key": apiKey, "content-type": "application/json" }, body: JSON.stringify({ ...base, contents, ...(last ? { toolConfig: { functionCallingConfig: { mode: "NONE" } } } : {}) }), signal: controller.signal });
      body = (await res.json().catch(() => ({}))) as Body;
    } catch (e) {
      clearTimeout(timer);
      const aborted = (e as Error).name === "AbortError";
      const usage = { ...total, webFetches: fetcher?.used ?? 0 };
      return { ok: false, kind: aborted ? "timeout" : "provider_error", message: aborted ? "Gemini took too long to respond." : "Gemini could not be reached.", usage, costMicros: turnCostMicros(req.modelKey, usage, rates), appended: [] };
    }
    clearTimeout(timer);
    if (!res.ok) {
      const r = httpFailure(res.status, body, res.headers.get("retry-after"));
      const usage = { ...total, webFetches: fetcher?.used ?? 0 };
      return { ...r, usage, costMicros: turnCostMicros(req.modelKey, usage, rates) } as TurnResult;
    }
    total = addUsage(total, geminiUsage(body));
    const cand = body.candidates?.[0];
    for (const c of cand?.groundingMetadata?.groundingChunks ?? []) if (c.web?.uri && !sources.has(c.web.uri)) sources.set(c.web.uri, { url: c.web.uri, title: c.web.title });
    parts = withIds(cand?.content?.parts ?? [], round);
    const fetchCalls = fetcher ? parts.filter((p) => p.functionCall?.name === FETCH_PAGE_TOOL) : [];
    if (!fetcher || !fetchCalls.length) break;
    const results = await fetcher.runAll(fetchCalls.map((p) => ({ call_id: p.functionCall!.id!, arguments: JSON.stringify(p.functionCall!.args ?? {}) })));
    appended.push({ role: "assistant", content: blocksOf(parts) }, { role: "user", content: results.map((x) => ({ type: "tool_result" as const, tool_use_id: x.call_id, content: x.output })) });
    if (req.customTools?.length && parts.some((p) => p.functionCall && p.functionCall.name !== FETCH_PAGE_TOOL)) {
      mixed = true;
      break;
    }
    contents = [...contents, { role: "model", parts }, { role: "user", parts: results.map((x) => ({ functionResponse: { id: x.call_id, name: FETCH_PAGE_TOOL, response: { output: x.output } } })) }];
  }

  const usage: TurnUsage = { ...total, webFetches: fetcher?.used ?? 0 };
  const costMicros = turnCostMicros(req.modelKey, usage, rates);
  const text = parts.filter((p) => p.text && !p.thought).map((p) => p.text).join("");
  const allSources = [...(fetcher?.fetched ?? []), ...[...sources.values()].filter((s) => !fetcher?.fetched.some((f) => f.url === s.url))].slice(0, 60);
  const blocks = parts.length ? blocksOf(parts) : [];
  if (!mixed && blocks.length) appended.push({ role: "assistant", content: blocks });
  const base2 = { usage, costMicros, appended };
  const finish = body.candidates?.[0]?.finishReason ?? (body.promptFeedback?.blockReason ? "SAFETY" : "STOP");

  if (["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION"].includes(finish)) return { ok: false, kind: "refused", message: "The model declined this request.", ...base2, text };
  const calls = blocks.filter((b): b is ToolUseBlock => b.type === "tool_use" && !(fetcher && b.name === FETCH_PAGE_TOOL));
  if (calls.length && req.customTools?.length) {
    return { ok: true, output: text, text, ...base2, sources: allSources, actualModelId: body.modelVersion ?? spec.apiModelId, stopReason: "tool_use", toolUses: calls.map((b) => ({ id: b.id, name: b.name, input: b.input })) };
  }
  if (finish === "MAX_TOKENS") return { ok: false, kind: "invalid_output", message: "The answer was cut off at the length limit.", ...base2, text };
  let parsed: unknown = text;
  if (req.schema) {
    try {
      parsed = (req.schema as z.ZodType).parse(normalizeNulls(parseJsonText(text), jsonSchemaFor(req.schema)));
    } catch (e) {
      return { ok: false, kind: "invalid_output", message: (e as Error).message.slice(0, 400), ...base2, text };
    }
  }
  return { ok: true, output: parsed, text, ...base2, sources: allSources, actualModelId: body.modelVersion ?? spec.apiModelId, stopReason: "end_turn" };
}
