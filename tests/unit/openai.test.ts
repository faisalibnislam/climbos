import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { currentRateVersion } from "../../shared/economics";
import { dropNulls, openaiTurn, strictSchema, toInput, usageOf } from "../../shared/ai/openai";
import { jsonSchemaFor } from "../../shared/ai/types";
import { modelTurn } from "../../shared/ai/turn";
import { expertEscalationModel, routeModels } from "../../shared/agents/routes";

const rates = currentRateVersion();

describe("OpenAI adapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.OPENAI_API_KEY;
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

  it("round-trips encrypted reasoning through caller-managed stateless tool turns", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const reasoning = { type: "reasoning", id: "rs_tool_1", encrypted_content: "opaque-encrypted-payload" };
    const posts: { body: Record<string, unknown> }[] = [];
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      posts.push({ body });
      const output = posts.length === 1
        ? [reasoning, { type: "function_call", call_id: "call_1", name: "get_plan", arguments: "{}" }]
        : [{ type: "message", content: [{ type: "output_text", text: "done" }] }];
      return new Response(JSON.stringify({ status: "completed", output, usage: { input_tokens: 10, output_tokens: 5 } }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const request = { modelKey: "gpt-6-luna" as const, system: [], maxTokens: 100, customTools: [{ name: "get_plan", input_schema: { type: "object" as const, properties: {} } }] };
    const first = await openaiTurn({ ...request, messages: [{ role: "user", content: "inspect plan" }] }, rates);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(posts[0].body.include).toContain("reasoning.encrypted_content");
    const second = await openaiTurn({
      ...request,
      messages: [
        { role: "user", content: "inspect plan" },
        ...first.appended,
        { role: "user", content: [{ type: "tool_result", tool_use_id: "call_1", content: "plan output" }] },
      ],
    }, rates);
    expect(second.ok).toBe(true);
    expect(posts[1].body.input).toEqual(expect.arrayContaining([reasoning, { type: "function_call", call_id: "call_1", name: "get_plan", arguments: "{}" }, { type: "function_call_output", call_id: "call_1", output: "plan output" }]));
    expect(posts[1].body.input).not.toContainEqual(expect.objectContaining({ type: "reasoning_text" }));
  });

  it("meters cached input separately, reasoning inside output, and search calls", () => {
    const u = usageOf({ usage: { input_tokens: 10_000, output_tokens: 2_000, input_tokens_details: { cached_tokens: 3_000, cache_write_tokens: 1_000 }, output_tokens_details: { reasoning_tokens: 1_500 } }, output: [{ type: "web_search_call", action: { type: "search" } }, { type: "web_search_call", action: { type: "open_page" } }] });
    expect(u).toMatchObject({ inputTokens: 6_000, cacheReadTokens: 3_000, cacheWriteTokens: 1_000, outputTokens: 2_000, thinkingTokens: 1_500, webSearches: 1 });
  });

  it("runs a structured, web-searching turn and prices it from the Sol rates", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      expect(body.model).toBe("gpt-6.1-sol");
      expect(body.text.format.strict).toBe(true);
      expect(body.tools[0].type).toBe("web_search");
      expect(body.max_tool_calls).toBe(5);
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

  it("background mode: saves the response id, polls to completion, and yields as pending at the deadline", async () => {
    process.env.OPENAI_API_KEY = "test";
    let polls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === "POST") {
          expect(JSON.parse(init.body as string)).toMatchObject({ background: true, store: true });
          return new Response(JSON.stringify({ id: "resp_1", status: "queued" }), { status: 200 });
        }
        expect(url).toContain("/v1/responses/resp_1");
        polls++;
        return new Response(JSON.stringify(polls < 2 ? { id: "resp_1", status: "in_progress" } : { id: "resp_1", status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "notes" }] }], usage: { input_tokens: 10, output_tokens: 5 } }), { status: 200 });
      }),
    );
    const saved: string[] = [];
    const r = await openaiTurn({ modelKey: "gpt-6.1-sol", system: [], messages: [{ role: "user", content: "q" }], maxTokens: 100, background: { onStarted: async (id) => void saved.push(id) } }, rates);
    expect(saved).toEqual(["resp_1"]);
    expect(r.ok && r.text).toBe("notes");
    // Resuming an unfinished response past the deadline returns pending without creating a new one.
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.method).not.toBe("POST");
      return new Response(JSON.stringify({ id: "resp_2", status: "in_progress" }), { status: 200 });
    }));
    const p = await openaiTurn({ modelKey: "gpt-6.1-sol", system: [], messages: [{ role: "user", content: "q" }], maxTokens: 100, background: { resumeResponseId: "resp_2", pollUntil: Date.now() } }, rates);
    expect(!p.ok && p.kind).toBe("pending");
    delete process.env.OPENAI_API_KEY;
  });

  it("uses Luna by default and permits Sol escalation only for eligible Expert agents", () => {
    const luna = { research: "gpt-6-luna", draft: "gpt-6-luna", critic: "gpt-6-luna", revise: "gpt-6-luna" };
    for (const id of ["business_insights", "growth_strategy", "social_posts", "ad_drafts", "prospecting"]) expect(routeModels(id)).toEqual(luna);
    for (const id of ["business_insights", "growth_plays", "growth_strategy", "ad_drafts", "social_calendar"])
      expect(routeModels(id, "expert")).toEqual(luna);
    for (const id of ["social_posts", "email_sequence", "seo_brief", "prospecting", "cold_outreach", "conversion_audit"]) expect(routeModels(id, "expert")).toEqual(luna);
    expect(expertEscalationModel("growth_strategy", "expert")).toBe("gpt-6.1-sol");
    expect(expertEscalationModel("growth_strategy", "basic")).toBeUndefined();
    expect(expertEscalationModel("social_posts", "expert")).toBeUndefined();
  });
});
