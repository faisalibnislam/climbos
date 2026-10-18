import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { currentRateVersion } from "../../shared/economics";
import { dropNulls, openaiTurn, strictSchema, toInput, usageOf } from "../../shared/ai/openai";
import { jsonSchemaFor } from "../../shared/ai/claude";
import { modelTurn } from "../../shared/ai/turn";
import { routeModels } from "../../shared/agents/routes";

const rates = currentRateVersion();

describe("OpenAI adapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.OPENAI_API_KEY;
    delete process.env.CLIMBOS_ROUTES;
  });

  it("makes schemas strict: closed objects, all keys required, optional → nullable", () => {
    const s = strictSchema(jsonSchemaFor(z.object({ a: z.string().min(2), b: z.number().optional(), c: z.array(z.object({ d: z.string() })) }))) as { additionalProperties: boolean; required: string[]; properties: { a: { minLength?: number }; b: { anyOf: unknown[] }; c: { items: { additionalProperties: boolean } } } };
    expect(s.additionalProperties).toBe(false);
    expect(s.required).toEqual(["a", "b", "c"]);
    expect(s.properties.b.anyOf[1]).toEqual({ type: "null" });
    expect(s.properties.a.minLength).toBeUndefined();
    expect(s.properties.c.items.additionalProperties).toBe(false);
    expect(dropNulls({ a: "x", b: null, c: [{ d: "y", e: null }] })).toEqual({ a: "x", c: [{ d: "y" }] });
  });

  it("translates Anthropic-shaped history, including tool calls and results", () => {
    const items = toInput([
      { role: "user", content: "hi" },
      { role: "assistant", content: [{ type: "text", text: "checking" }, { type: "tool_use", id: "t1", name: "get_plan", input: { a: 1 } }] },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: "plan json" }] },
    ]);
    expect(items).toEqual([
      { role: "user", content: "hi" },
      { role: "assistant", content: "checking" },
      { type: "function_call", call_id: "t1", name: "get_plan", arguments: '{"a":1}' },
      { type: "function_call_output", call_id: "t1", output: "plan json" },
    ]);
  });

  it("meters cached input separately, reasoning inside output, and search calls", () => {
    const u = usageOf({ usage: { input_tokens: 10_000, output_tokens: 2_000, input_tokens_details: { cached_tokens: 4_000 }, output_tokens_details: { reasoning_tokens: 1_500 } }, output: [{ type: "web_search_call", action: { type: "search" } }, { type: "web_search_call", action: { type: "open_page" } }] });
    expect(u).toMatchObject({ inputTokens: 6_000, cacheReadTokens: 4_000, outputTokens: 2_000, thinkingTokens: 1_500, webSearches: 1 });
  });

  it("runs a structured, web-searching turn and prices it from the Sol rates", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      expect(body.model).toBe("gpt-6.1-sol");
      expect(body.text.format.strict).toBe(true);
      expect(body.tools[0].type).toBe("web_search");
      expect(body.reasoning.effort).toBe("high");
      return new Response(
        JSON.stringify({
          model: "gpt-6.1-sol",
          status: "completed",
          output: [
            { type: "web_search_call", action: { type: "search", sources: [{ url: "https://a.com" }] } },
            { type: "message", content: [{ type: "output_text", text: '{"answer":"ok","note":null}', annotations: [{ type: "url_citation", url: "https://b.com", title: "B" }] }] },
          ],
          usage: { input_tokens: 1_000_000, output_tokens: 100_000, input_tokens_details: { cached_tokens: 0 } },
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const r = await modelTurn({ modelKey: "gpt-6.1-sol", system: [{ text: "sys" }], messages: [{ role: "user", content: "q" }], schema: z.object({ answer: z.string(), note: z.string().optional() }), maxTokens: 1000, effort: "high", webSearch: { maxUses: 5 } }, rates);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.output).toEqual({ answer: "ok" });
    expect(r.sources.map((s) => s.url)).toEqual(["https://a.com", "https://b.com"]);
    // $2/M input + $10/M output + 1 search × $0.01 = $2 + $1 + $0.01
    expect(r.costMicros).toBe(3_010_000);
  });

  it("returns tool calls for agent loops and maps errors honestly", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ status: "completed", output: [{ type: "function_call", call_id: "c1", name: "get_plan", arguments: '{"x":null}' }], usage: { input_tokens: 10, output_tokens: 5 } }), { status: 200 })));
    const tools = [{ name: "get_plan", description: "d", input_schema: { type: "object" as const, properties: { x: { type: "string" } } } }];
    const r = await openaiTurn({ modelKey: "gpt-6-luna", system: [], messages: [{ role: "user", content: "q" }], customTools: tools, maxTokens: 100, thinkingOff: true }, rates);
    expect(r.ok && r.toolUses).toEqual([{ id: "c1", name: "get_plan", input: {} }]);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { message: "You exceeded your current quota" } }), { status: 429 })));
    const q = await openaiTurn({ modelKey: "gpt-6-luna", system: [], messages: [{ role: "user", content: "q" }], maxTokens: 100 }, rates);
    expect(!q.ok && q.kind).toBe("spend_limit");
    delete process.env.OPENAI_API_KEY;
    const n = await openaiTurn({ modelKey: "gpt-6-luna", system: [], messages: [{ role: "user", content: "q" }], maxTokens: 100 }, rates);
    expect(!n.ok && n.kind).toBe("provider_unavailable");
  });

  it("routes follow the owner's table, and classic mode rolls back", () => {
    const classic = { research: "claude-sonnet-5.5" as const, draft: "claude-opus-5.5" as const, critic: "claude-opus-5.5" as const };
    expect(routeModels("business_insights", classic)).toMatchObject({ research: "gpt-6-luna", draft: "gpt-6.1-sol", critic: "claude-sonnet-5.5" });
    expect(routeModels("growth_strategy", classic)).toMatchObject({ draft: "claude-sonnet-5.5", revise: "claude-opus-5.5" });
    expect(routeModels("social_posts", classic)).toMatchObject({ draft: "claude-sonnet-5.5", critic: "claude-haiku-5.5" });
    process.env.CLIMBOS_ROUTES = "classic";
    expect(routeModels("business_insights", classic)).toEqual(classic);
  });
});
