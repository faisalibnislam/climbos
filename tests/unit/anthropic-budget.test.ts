import { describe, expect, it } from "vitest";
import { ANTHROPIC_QA_CAP_MICROS, CLAUDE_QA_REVISION_HEADROOM_MICROS, canStartClaudeQaRevision, claudeQaActualMicros, reserveClaudeQaCall } from "../../bench/strategy-quality/anthropicBudget";

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
  it("preflights a whole revision and review against both ledgers, including uncertain holds", () => {
    expect(CLAUDE_QA_REVISION_HEADROOM_MICROS).toBe(5_640_000);
    const historical = 1_896_709, main = ANTHROPIC_QA_CAP_MICROS - CLAUDE_QA_REVISION_HEADROOM_MICROS - historical;
    expect(canStartClaudeQaRevision(main + historical)).toBe(true);
    expect(canStartClaudeQaRevision(main + historical + 1)).toBe(false);
    expect(canStartClaudeQaRevision(90_000_000 + historical)).toBe(true);
    expect(canStartClaudeQaRevision(ANTHROPIC_QA_CAP_MICROS)).toBe(false);
    expect(() => canStartClaudeQaRevision(NaN)).toThrow(/ledger/);
    expect(() => canStartClaudeQaRevision(-1)).toThrow(/ledger/);
  });
  it("keeps the per-attempt cap even after a revision preflight succeeds", () => {
    const before = ANTHROPIC_QA_CAP_MICROS - CLAUDE_QA_REVISION_HEADROOM_MICROS;
    expect(canStartClaudeQaRevision(before)).toBe(true);
    const requestHold = reserveClaudeQaCall(body, before);
    expect(() => reserveClaudeQaCall(body, ANTHROPIC_QA_CAP_MICROS - requestHold + 1)).toThrow(/BUDGET/);
  });
});
