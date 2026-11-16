import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { anthropicTurn } from "../../shared/ai/anthropic";
import Anthropic from "@anthropic-ai/sdk";
import { claudeSchema } from "../../shared/ai/anthropicSchema";
import { currentRateVersion } from "../../shared/economics/rates";
import type { TurnRequest } from "../../shared/ai/types";

const state = vi.hoisted(() => ({ requests: [] as Record<string, unknown>[], responses: [] as unknown[], clients: [] as Record<string, unknown>[] }));
vi.mock("@anthropic-ai/sdk", async (original) => {
  const actual = await original<typeof import("@anthropic-ai/sdk")>();
  class TestClient extends actual.default {
    constructor(options: Record<string, unknown>) {
      super(options); state.clients.push(options);
      this.messages.stream = ((request: Record<string, unknown>) => {
        state.requests.push(request);
        return { finalMessage: async () => { const value = state.responses.shift(); if (value instanceof Error) throw value; return value; } };
      }) as typeof this.messages.stream;
    }
  }
  return { ...actual, default: TestClient };
});
const rates = currentRateVersion(new Date("2026-11-09T12:00:00Z"));
const response = (extra: Record<string, unknown> = {}) => ({ id: "msg_test", model: "claude-haiku-5-5", stop_reason: "end_turn", content: [{ type: "text", text: '{"status":"ready","value":null}' }], usage: { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 200, cache_read_input_tokens: 300 }, ...extra });
const request = (extra: Partial<TurnRequest> = {}): TurnRequest => ({ modelKey: "claude-haiku-5.5", system: [{ text: "Stable instructions", cache: true }], messages: [{ role: "user", content: "Synthetic test only" }], maxTokens: 1000, schema: z.object({ status: z.enum(["ready", "waiting"]), value: z.number().nullable(), note: z.string().optional() }), ...extra });
beforeEach(() => { state.requests.length = 0; state.responses.length = 0; state.clients.length = 0; process.env.ANTHROPIC_API_KEY = "synthetic-test-key"; });
afterEach(() => { delete process.env.ANTHROPIC_API_KEY; });

describe("native Anthropic adapter, no network", () => {
  it("returns actual fetched text separately from model notes and source URLs", async () => {
    const url = "https://reviews.example/customer-note";
    state.responses.push(response({ stop_reason: "tool_use", content: [{ type: "tool_use", id: "fetch_1", name: "fetch_page", input: { url } }] }), response());
    const out = await anthropicTurn(request({ webFetch: { maxUses: 1, resolveHost: async () => ["93.184.216.34"], fetchImpl: async (target) => String(target).endsWith("/robots.txt") ? new Response("", { status: 404 }) : new Response("<html><body><p>I keep chasing the brief.</p></body></html>", { headers: { "content-type": "text/html" } }) } }), rates);
    expect(out.ok && out.pageReads).toEqual([{ url, text: expect.stringContaining("I keep chasing the brief."), retrievedAt: expect.any(Number) }]);
    expect(state.requests).toHaveLength(2);
  });
  it("keeps ambiguous connection failures distinct from known unbilled rejections", async () => {
    state.responses.push(new Anthropic.APIConnectionTimeoutError());
    const out = await anthropicTurn(request(), rates);
    expect(out.ok).toBe(false);
    expect(!out.ok && out.billingUncertain).toBe(true);
    expect(state.requests).toHaveLength(1);
  });
  it("uses Claude's schema subset while preserving enums, optional fields and required unknowns", async () => {
    state.responses.push(response());
    const out = await anthropicTurn(request(), rates);
    expect(out.ok && out.output).toEqual({ status: "ready", value: null });
    const body = state.requests[0] as { output_config: { format: { schema: { required: string[]; properties: Record<string, Record<string, unknown>> } } }; system: unknown[] };
    expect(body.output_config.format.schema.required).toEqual(["status", "value"]);
    expect(body.output_config.format.schema.properties.status.enum).toEqual(["ready", "waiting"]);
    expect(body.system).toEqual([{ type: "text", text: "Stable instructions", cache_control: { type: "ephemeral" } }]);
    expect(state.clients[0].maxRetries).toBe(0);
  });
  it("moves unsupported bounds into descriptions and still enforces the original schema", async () => {
    const schema = z.object({ code: z.string().length(3), fraction: z.number().min(0).max(1), items: z.array(z.string()).min(2).max(4) });
    const wire = claudeSchema(z.toJSONSchema(schema)) as { properties: Record<string, Record<string, unknown>> };
    expect(wire.properties.code.maxLength).toBeUndefined();
    expect(wire.properties.code.description).toContain("maxLength");
    expect(wire.properties.fraction.maximum).toBeUndefined();
    expect(wire.properties.items.minItems).toBeUndefined();
    state.responses.push(response({ content: [{ type: "text", text: '{"code":"bad length","fraction":0.5,"items":["a","b"]}' }] }));
    const out = await anthropicTurn(request({ schema }), rates);
    expect(!out.ok && out.kind).toBe("invalid_output");
  });
  it("uses the right low-latency thinking control on Haiku and Sonnet", async () => {
    state.responses.push(response(), response({ model: "claude-sonnet-5-5" }));
    await anthropicTurn(request({ thinkingOff: true }), rates);
    await anthropicTurn(request({ modelKey: "claude-sonnet-5.5", thinkingOff: true }), rates);
    expect(state.requests.map((body) => body.thinking)).toEqual([{ type: "disabled" }, { type: "between_tools" }]);
    expect(state.requests.every((body) => !body.temperature && !body.top_p && !body.top_k && !body.fallbacks)).toBe(true);
  });
  it("preserves nullable tool arguments and signed thinking in the same provider conversation", async () => {
    const thinking = { type: "thinking", thinking: "", signature: "synthetic-signature" };
    state.responses.push(response({ content: [thinking, { type: "tool_use", id: "tool_test", name: "record_unknown", input: { baseline: null } }], stop_reason: "tool_use" }));
    const out = await anthropicTurn(request({ schema: undefined, customTools: [{ name: "record_unknown", input_schema: { type: "object", properties: { baseline: { type: ["number", "null"] } }, required: ["baseline"] } }] }), rates);
    expect(out.ok && out.toolUses?.[0].input).toEqual({ baseline: null });
    expect(out.appended[0].content).toContainEqual({ type: "provider_item", provider: "anthropic", item: thinking });
  });
  it("sums costs per API message instead of repricing several short turns as one long prompt", async () => {
    state.responses.push(response({ stop_reason: "pause_turn", usage: { input_tokens: 60000, output_tokens: 100 }, content: [{ type: "text", text: "Continuing" }] }), response({ usage: { input_tokens: 60000, output_tokens: 100 } }));
    const out = await anthropicTurn(request(), rates);
    expect(out.usage.calls).toBe(2);
    expect(out.usage.inputTokens).toBe(120000);
    expect(out.costMicros).toBe(12100);
    expect(state.requests[1].messages).toEqual(expect.arrayContaining([expect.objectContaining({ role: "assistant" })]));
  });
  it("reports missing configuration before constructing a client", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const out = await anthropicTurn(request(), rates);
    expect(!out.ok && out.kind).toBe("provider_unavailable");
    expect(state.clients).toHaveLength(0);
  });
});

it("uses application-validated JSON for production-size strategy schemas instead of a rejected grammar", async () => {
  const { growthPlaysSpec, strategySpec } = await import("../../shared/agents/specs");
  const { claudeCanConstrain } = await import("../../shared/ai/anthropicSchema");
  expect(claudeCanConstrain([claudeSchema(z.toJSONSchema(growthPlaysSpec().schema))])).toBe(false);
  expect(claudeCanConstrain([claudeSchema(z.toJSONSchema(strategySpec().schema))])).toBe(false);
  const manyFields = Object.fromEntries(Array.from({ length: 25 }, (_, index) => [`field${index}`, z.string().optional()]));
  const schema = z.object({ status: z.literal("ready"), ...manyFields });
  state.responses.push(response({ content: [{ type: "text", text: '{"status":"ready"}' }] }));
  const out = await anthropicTurn(request({ schema }), rates);
  expect(out.ok && out.output).toEqual({ status: "ready" });
  expect((state.requests[0].output_config as { format?: unknown } | undefined)?.format).toBeUndefined();
  expect(state.requests[0].system).toEqual(expect.arrayContaining([expect.objectContaining({ text: expect.stringContaining("application validates every field") })]));
  state.responses.push(response({ content: [{ type: "text", text: '{"status":"invented"}' }] }));
  expect((await anthropicTurn(request({ schema }), rates)).ok).toBe(false);
});
