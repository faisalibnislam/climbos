import { z } from "zod";
import { claudeCostMicros, ZERO_CLAUDE_USAGE, type ClaudeTurnRequest, type ClaudeTurnResult } from "../ai/claude";
import type { RateVersion } from "../economics/rates";

/**
 * Deterministic stand-in for Claude, used only by automated tests of the
 * Engine v2 wiring (never in production: it is enabled solely by the
 * CLIMBOS_FAKE_LLM test variable). It returns schema-valid answers so the
 * job, checkpoint, metering and resume paths can be exercised exactly.
 *
 * Modes (CLIMBOS_FAKE_LLM):
 * - "ship":   the first draft passes review.
 * - "revise": the first draft fails review; the revision passes.
 * - "fail":   every call fails with a provider error.
 */

type JsonSchema = { type?: string | string[]; properties?: Record<string, JsonSchema>; items?: JsonSchema; enum?: unknown[]; anyOf?: JsonSchema[]; required?: string[] };

function sample(s: JsonSchema, marker: string, key = ""): unknown {
  if (s.enum?.length) return s.enum[0];
  if (s.anyOf?.length) return sample(s.anyOf[0], marker, key);
  const type = Array.isArray(s.type) ? s.type[0] : s.type;
  switch (type) {
    case "object": {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(s.properties ?? {})) out[k] = sample(v, marker, k);
      return out;
    }
    case "array":
      return s.items ? [sample(s.items, marker, key)] : [];
    case "number":
    case "integer":
      return key === "priority" ? 1 : key.toLowerCase().includes("index") ? 0 : 1;
    case "boolean":
      return true;
    default:
      return /url/i.test(key) ? "https://example.com" : `${marker} ${key}`.trim();
  }
}

function rubricIds(system: string): { gates: string[]; criteria: string[] } {
  const gatesBlock = system.split("HARD GATES")[1]?.split("CRITERIA")[0] ?? "";
  const critBlock = system.split("CRITERIA (score")[1]?.split("Ship rule")[0] ?? "";
  return {
    gates: [...gatesBlock.matchAll(/^- ([A-Za-z0-9_]+): /gm)].map((m) => m[1]),
    criteria: [...critBlock.matchAll(/^- ([A-Za-z0-9_]+) /gm)].map((m) => m[1]),
  };
}

export async function fakeTurn(req: ClaudeTurnRequest, rates: RateVersion): Promise<ClaudeTurnResult> {
  const mode = process.env.CLIMBOS_FAKE_LLM ?? "ship";
  const usage = { ...ZERO_CLAUDE_USAGE, inputTokens: 1000, outputTokens: 500, calls: 1, webSearches: req.webSearch ? 1 : 0 };
  const costMicros = claudeCostMicros(req.modelKey, usage, rates);
  if (mode === "fail") return { ok: false, kind: "provider_error", message: "Fake provider error", usage, costMicros, appended: [] };

  const system = req.system.map((b) => b.text).join("\n");
  const lastUser = String(req.messages[req.messages.length - 1]?.content ?? "");
  let output: unknown;
  if (!req.schema) {
    output = "FAKE RESEARCH NOTES\n- Competitor A: example.com\nSources: https://example.com";
  } else if (system.includes("HARD GATES")) {
    const { gates, criteria } = rubricIds(system);
    const reviewingFirstDraft = lastUser.includes("fake-v1");
    const pass = mode === "ship" || !reviewingFirstDraft;
    output = {
      gates: gates.map((id) => ({ id, pass: pass, note: pass ? "ok" : "fails" })),
      scores: criteria.map((id) => ({ id, score: pass ? 5 : 2, note: "", fix: pass ? "none" : "Make it specific" })),
      strengths: ["clear"],
      fixes: pass ? [] : ["Make it specific"],
    };
  } else {
    const marker = lastUser.includes("A senior reviewer assessed your draft") ? "fake-v2" : "fake-v1";
    output = sample(z.toJSONSchema(req.schema) as JsonSchema, marker);
  }
  const text = typeof output === "string" ? output : JSON.stringify(output);
  return {
    ok: true,
    output: req.schema ? req.schema.parse(output) : output,
    text,
    appended: [{ role: "assistant", content: text }],
    usage,
    costMicros,
    sources: req.webSearch ? [{ url: "https://example.com", title: "Example" }] : [],
    actualModelId: "fake",
    stopReason: "end_turn",
  };
}
