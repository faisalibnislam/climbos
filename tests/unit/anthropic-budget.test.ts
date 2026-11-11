import { describe, expect, it } from "vitest";
import { ANTHROPIC_QA_CAP_MICROS, claudeQaActualMicros, reserveClaudeQaCall } from "../../bench/strategy-quality/anthropicBudget";

describe("owner-authorized Anthropic QA envelope", () => {
  const body = { model: "claude-sonnet-5-5", max_tokens: 32000, messages: [{ role: "user", content: "Public business research" }] };
  it("reserves before every attempt and refuses to cross the cumulative cap", () => {
    const held = reserveClaudeQaCall(body, 0);
    expect(held).toBeGreaterThan(320000);
    expect(() => reserveClaudeQaCall(body, ANTHROPIC_QA_CAP_MICROS - held)).not.toThrow();
    expect(() => reserveClaudeQaCall(body, ANTHROPIC_QA_CAP_MICROS - held + 1)).toThrow(/BUDGET/);
    expect(() => reserveClaudeQaCall({ ...body, model: "claude-opus-5-5" }, 0)).toThrow(/scope/);
    expect(() => reserveClaudeQaCall({ ...body, tools: [{ name: "send_email" }] }, 0)).toThrow(/bounded web search/);
  });
  it("covers opaque search expansion and Haiku cache writes at the long-context price", () => {
    const reservation = reserveClaudeQaCall({ ...body, model: "claude-haiku-5-5", tools: [{ name: "web_search", max_uses: 4 }] }, 0);
    expect(reservation).toBe(745000);
    expect(claudeQaActualMicros("claude-haiku-5-5", { input_tokens: 0, cache_creation_input_tokens: 100001, output_tokens: 100 })).toBe(62751);
    expect(claudeQaActualMicros("claude-sonnet-5-5", {})).toBeNull();
  });
});
