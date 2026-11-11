/** Live QA budget guard. USD millionths; conservative reservations, no implicit retries. */
export const ANTHROPIC_QA_CAP_MICROS = 100_000_000;
export type ClaudeQaModel = "claude-haiku-5-5" | "claude-sonnet-5-5";
export function reserveClaudeQaCall(body: Record<string, unknown>, used: number): number {
  if (!["claude-haiku-5-5", "claude-sonnet-5-5"].includes(String(body.model))) throw new Error("QA model is outside the approved Haiku/Sonnet scope.");
  if (!Number.isSafeInteger(used) || used < 0) throw new Error("Invalid QA ledger.");
  const output = Number(body.max_tokens);
  if (!Number.isSafeInteger(output) || output < 1 || output > 32_000) throw new Error("Invalid QA output limit.");
  const tools = (body.tools ?? []) as { name?: string; max_uses?: number; input_schema?: unknown }[];
  if (tools.some((t) => t.name === "fetch_page" ? !t.input_schema : t.name !== "web_search" || !Number.isSafeInteger(t.max_uses) || t.max_uses! < 1 || t.max_uses! > 6)) throw new Error("QA allows only bounded web search and the SSRF-safe page reader, with no external actions.");
  const searches = tools.reduce((sum, t) => sum + (t.max_uses ?? 0), 0);
  // A UTF-8 byte per input token is conservative for text. Include schema/cache overhead.
  // Server search expansion is opaque: reserve the entire 1M context when tools exist.
  const inputBound = searches ? 1_000_000 : Buffer.byteLength(JSON.stringify(body), "utf8") + 65_536;
  if (inputBound > 1_000_000) throw new Error("QA input exceeds its bounded context.");
  const sonnet = body.model === "claude-sonnet-5-5";
  // Cache-write rates are the most expensive input class. Haiku always reserves its long tier.
  const reservation = Math.ceil(inputBound * (sonnet ? 2.5 : 0.625) + output * (sonnet ? 10 : 2.5) + searches * 10_000);
  if (used + reservation > ANTHROPIC_QA_CAP_MICROS) throw new Error("QA_BUDGET_EXHAUSTED: next request exceeds the cumulative $100 cap.");
  return reservation;
}
export function claudeQaActualMicros(model: ClaudeQaModel, u: Record<string, unknown>): number | null {
  const input = Number(u.input_tokens), output = Number(u.output_tokens);
  const read = Number(u.cache_read_input_tokens ?? 0), write = Number(u.cache_creation_input_tokens ?? 0);
  const search = Number((u.server_tool_use as Record<string, unknown> | undefined)?.web_search_requests ?? 0);
  if (![input, output, read, write, search].every((n) => Number.isSafeInteger(n) && n >= 0)) return null;
  const long = input + read + write > 100_000;
  const rates = model === "claude-sonnet-5-5" ? [2, 10, 0.1, 2.5] : long ? [0.5, 2.5, 0.05, 0.625] : [0.1, 0.5, 0.01, 0.125];
  return Math.ceil(input * rates[0] + output * rates[1] + read * rates[2] + write * rates[3] + search * 10_000);
}
