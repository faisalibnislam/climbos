"use node";

import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { type ModelKey, type Provider, type RateVersion } from "../../shared/economics/rates";
import { actualStepMicros, IMAGE_ROUTES, imageProviderMicros, MODEL_SPECS, searchCallUsd } from "../../shared/ai/models";
import { usdToMicrosCeil } from "../../shared/economics/money";
import { anthropicTurn } from "../../shared/ai/anthropic";
import { providerKeyConfigured } from "../../shared/ai/modelChoice";
import { openaiTurn } from "../../shared/ai/openai";
import type { TurnRequest, TurnResult } from "../../shared/ai/types";

/**
 * Server-only provider adapters behind one typed interface. Secrets are read
 * from the Convex environment and never returned. Missing keys produce an
 * explicit `provider_unavailable` result (never a fake success). Demo
 * workspaces use the separate fixture adapter in ./fixtures.ts.
 */

export interface ModelRequest {
  modelKey: ModelKey;
  system: string;
  user: string;
  schema: z.ZodType;
  inputBudget: number;
  outputBudget: number;
  webSearches?: number;
  deadlineMs?: number;
}

export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  webSearches: number;
}

export type ModelResult =
  | {
      ok: true;
      provider: Provider;
      actualModelId: string;
      output: unknown;
      rawText: string;
      usage: ModelUsage;
      costMicros: number;
      searchCostMicros: number;
      finishReason: string;
      sourceUrls: string[];
    }
  | {
      ok: false;
      kind: "provider_unavailable" | "rate_limited" | "timeout" | "invalid_output" | "provider_error" | "refused" | "spend_limit";
      message: string;
      retryAfterMs?: number;
      usage?: ModelUsage;
      costMicros: number;
      rawText?: string;
    };

const ZERO_USAGE: ModelUsage = { inputTokens: 0, outputTokens: 0, reasoningTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, webSearches: 0 };

export function jsonSchemaFor(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

/** Extract the first JSON object from model text (tolerates code fences). */
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


export function providerConfigured(provider: Provider): boolean {
  return providerKeyConfigured(provider);
}

/** Match readiness to the provider that will actually serve a selected model. */
export function modelProviderConfigured(modelKey: ModelKey): boolean {
  const spec = MODEL_SPECS[modelKey];
  if (!spec || spec.availability !== "enabled") return false;
  return providerConfigured(spec.provider);
}


async function callGemini(req: ModelRequest, rates: RateVersion): Promise<ModelResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, kind: "provider_unavailable", message: "Gemini isn't configured on this server.", costMicros: 0 };
  const spec = MODEL_SPECS[req.modelKey];
  const ai = new GoogleGenAI({ apiKey });
  try {
    const res = await ai.models.generateContent({
      model: spec.apiModelId,
      contents: [{ role: "user", parts: [{ text: req.user }] }],
      config: {
        systemInstruction: req.system,
        responseMimeType: "application/json",
        responseJsonSchema: jsonSchemaFor(req.schema),
        maxOutputTokens: req.outputBudget,
        httpOptions: { timeout: req.deadlineMs ?? 90_000 },
      },
    });
    const meta = res.usageMetadata;
    const usage: ModelUsage = {
      inputTokens: meta?.promptTokenCount ?? 0,
      // Thinking tokens are billed as output.
      outputTokens: (meta?.candidatesTokenCount ?? 0) + (meta?.thoughtsTokenCount ?? 0),
      reasoningTokens: meta?.thoughtsTokenCount ?? 0,
      cacheReadTokens: meta?.cachedContentTokenCount ?? 0,
      cacheWriteTokens: 0,
      webSearches: 0,
    };
    const costMicros = actualStepMicros(req.modelKey, { ...usage, inputTokens: Math.max(0, usage.inputTokens - usage.cacheReadTokens) }, rates);
    const text = res.text ?? "";
    const finish = res.candidates?.[0]?.finishReason ?? "STOP";
    if (finish === "MAX_TOKENS") {
      return { ok: false, kind: "invalid_output", message: "The answer was cut off at the length limit.", usage, costMicros, rawText: text };
    }
    if (finish === "SAFETY" || finish === "PROHIBITED_CONTENT") {
      return { ok: false, kind: "refused", message: "The model declined this request.", usage, costMicros };
    }
    let output: unknown;
    try {
      output = req.schema.parse(parseJsonText(text));
    } catch (e) {
      return { ok: false, kind: "invalid_output", message: (e as Error).message.slice(0, 300), usage, costMicros, rawText: text };
    }
    return {
      ok: true,
      provider: "google",
      actualModelId: res.modelVersion ?? spec.apiModelId,
      output,
      rawText: text,
      usage,
      costMicros,
      searchCostMicros: 0,
      finishReason: String(finish),
      sourceUrls: [],
    };
  } catch (e) {
    const msg = (e as Error).message ?? "";
    const status = (e as { status?: number }).status;
    if (status === 429 || /RESOURCE_EXHAUSTED|429/.test(msg)) {
      return { ok: false, kind: "rate_limited", message: "Gemini is busy right now.", retryAfterMs: 20_000, costMicros: 0 };
    }
    if (status === 401 || status === 403 || /API key/i.test(msg)) {
      return { ok: false, kind: "provider_unavailable", message: "Gemini rejected the server credentials.", costMicros: 0 };
    }
    if (/timeout|aborted/i.test(msg)) return { ok: false, kind: "timeout", message: "Gemini took too long to respond.", costMicros: 0 };
    return { ok: false, kind: "provider_error", message: "Gemini could not be reached.", costMicros: 0 };
  }
}

export async function callModel(req: ModelRequest, rates: RateVersion): Promise<ModelResult> {
  const spec = MODEL_SPECS[req.modelKey];
  if (!spec || spec.availability !== "enabled") {
    return { ok: false, kind: "provider_unavailable", message: `${req.modelKey} is not enabled.`, costMicros: 0, usage: ZERO_USAGE };
  }
  if (spec.provider === "google") return callGemini(req, rates);
  return callViaTurn(spec.provider === "anthropic" ? anthropicTurn : openaiTurn, spec.provider, req, rates);
}

/** Single-call tasks on OpenAI (Responses API) or Claude (Messages API), in this module's result shape. */
async function callViaTurn(turn: (req: TurnRequest, rates: RateVersion) => Promise<TurnResult>, provider: Provider, req: ModelRequest, rates: RateVersion): Promise<ModelResult> {
  const r = await turn(
    {
      modelKey: req.modelKey,
      system: [{ text: req.system }],
      messages: [{ role: "user", content: req.user }],
      schema: req.schema,
      maxTokens: req.outputBudget,
      effort: "low",
      webSearch: req.webSearches ? { maxUses: req.webSearches } : undefined,
      timeoutMs: req.deadlineMs ?? 90_000,
    },
    rates,
  );
  const usage: ModelUsage = { inputTokens: r.usage.inputTokens, outputTokens: r.usage.outputTokens, reasoningTokens: r.usage.thinkingTokens, cacheReadTokens: r.usage.cacheReadTokens, cacheWriteTokens: 0, webSearches: r.usage.webSearches };
  const searchCostMicros = usdToMicrosCeil(r.usage.webSearches * searchCallUsd(req.modelKey, rates));
  if (!r.ok) {
    const kind = r.kind === "spend_limit" ? "provider_unavailable" : r.kind;
    return { ok: false, kind, message: r.message, usage, costMicros: Math.max(0, r.costMicros - searchCostMicros), searchCostMicros, rawText: r.text } as ModelResult;
  }
  return { ok: true, provider, actualModelId: r.actualModelId, output: r.output, rawText: r.text, usage, costMicros: Math.max(0, r.costMicros - searchCostMicros), searchCostMicros, finishReason: r.stopReason, sourceUrls: r.sources.map((x) => x.url).slice(0, 20) };
}

/** costMicros is the flat credit allowance per attempt; providerMicros is what Google billed (from its reported usage). */
export type ImageResult =
  | { ok: true; bytes: Uint8Array; mimeType: string; costMicros: number; providerMicros: number; actualModelId: string }
  | { ok: false; kind: "provider_unavailable" | "refused" | "provider_error" | "rate_limited"; message: string; costMicros: number; providerMicros: number };

/** One image attempt on the standard (included) route. Each attempt is metered. */
export async function generateImage(prompt: string, rates: RateVersion): Promise<ImageResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  const route = IMAGE_ROUTES.standard;
  if (!apiKey) return { ok: false, kind: "provider_unavailable", message: "Image generation isn't configured on this server.", costMicros: 0, providerMicros: 0 };
  const ai = new GoogleGenAI({ apiKey });
  const attemptCost = usdToMicrosCeil(rates.services.imageAttempt);
  try {
    const res = await ai.models.generateContent({
      model: route.apiModelId,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseModalities: ["IMAGE"], httpOptions: { timeout: 90_000 } },
    });
    const parts = res.candidates?.[0]?.content?.parts ?? [];
    const img = parts.find((p) => p.inlineData?.data);
    if (!img?.inlineData?.data) {
      return { ok: false, kind: "refused", message: "No image was produced for this prompt.", costMicros: attemptCost, providerMicros: imageProviderMicros(route, res.usageMetadata, false) };
    }
    return {
      ok: true,
      bytes: Uint8Array.from(Buffer.from(img.inlineData.data, "base64")),
      mimeType: img.inlineData.mimeType ?? "image/png",
      costMicros: attemptCost,
      providerMicros: imageProviderMicros(route, res.usageMetadata, true),
      actualModelId: res.modelVersion ?? route.apiModelId,
    };
  } catch (e) {
    const msg = (e as Error).message ?? "";
    if (/429|RESOURCE_EXHAUSTED/.test(msg)) return { ok: false, kind: "rate_limited", message: "Image service is busy.", costMicros: 0, providerMicros: 0 };
    return { ok: false, kind: "provider_error", message: "Image service could not be reached.", costMicros: 0, providerMicros: 0 };
  }
}

/** Edit an existing image (real screenshot or product photo) with Gemini, keeping what must stay exact. */
export async function editImage(prompt: string, image: { bytes: Uint8Array; mimeType: string }, rates: RateVersion): Promise<ImageResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  const route = IMAGE_ROUTES.standard;
  if (!apiKey) return { ok: false, kind: "provider_unavailable", message: "Image editing isn't configured on this server.", costMicros: 0, providerMicros: 0 };
  const ai = new GoogleGenAI({ apiKey });
  const attemptCost = usdToMicrosCeil(rates.services.imageAttempt);
  try {
    const res = await ai.models.generateContent({
      model: route.apiModelId,
      contents: [{ role: "user", parts: [{ inlineData: { mimeType: image.mimeType, data: Buffer.from(image.bytes).toString("base64") } }, { text: prompt }] }],
      config: { responseModalities: ["IMAGE"], httpOptions: { timeout: 120_000 } },
    });
    const parts = res.candidates?.[0]?.content?.parts ?? [];
    const img = parts.find((p) => p.inlineData?.data);
    if (!img?.inlineData?.data) return { ok: false, kind: "refused", message: "The image service didn't return an edit for this image.", costMicros: attemptCost, providerMicros: imageProviderMicros(route, res.usageMetadata, false) };
    return { ok: true, bytes: Uint8Array.from(Buffer.from(img.inlineData.data, "base64")), mimeType: img.inlineData.mimeType ?? "image/png", costMicros: attemptCost, providerMicros: imageProviderMicros(route, res.usageMetadata, true), actualModelId: res.modelVersion ?? route.apiModelId };
  } catch (e) {
    const msg = (e as Error).message ?? "";
    if (/429|RESOURCE_EXHAUSTED/.test(msg)) return { ok: false, kind: "rate_limited", message: "Image service is busy.", costMicros: 0, providerMicros: 0 };
    return { ok: false, kind: "provider_error", message: "Image service could not be reached.", costMicros: 0, providerMicros: 0 };
  }
}
