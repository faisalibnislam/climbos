export interface UsageCostRow {
  provider: string;
  model?: string;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costMicros: number;
  estimated: boolean;
}

/** Stable, source-preserving aggregation for operator cost analysis. */
export function summarizeModelUsage(rows: UsageCostRow[]) {
  const groups = new Map<string, {
    provider: string;
    model: string | null;
    calls: number;
    estimatedCalls: number;
    recordedCalls: number;
    inputTokens: number;
    outputTokens: number;
    reasoningTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    costMicros: number;
    cacheReadRate: number | null;
  }>();
  const cacheInputTotals = new Map<string, number>();
  for (const row of rows) {
    const model = row.model?.trim() || null;
    const key = `${row.provider}\0${model ?? ""}`;
    const group = groups.get(key) ?? {
      provider: row.provider,
      model,
      calls: 0,
      estimatedCalls: 0,
      recordedCalls: 0,
      inputTokens: 0,
      outputTokens: 0,
      reasoningTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      costMicros: 0,
      cacheReadRate: null,
    };
    group.calls += 1;
    group.estimatedCalls += row.estimated ? 1 : 0;
    group.recordedCalls += row.estimated ? 0 : 1;
    group.inputTokens += row.inputTokens;
    group.outputTokens += row.outputTokens;
    group.reasoningTokens += row.reasoningTokens;
    group.cacheReadTokens += row.cacheReadTokens;
    group.cacheWriteTokens += row.cacheWriteTokens;
    group.costMicros += row.costMicros;
    const totalInput = row.provider === "openai"
      ? row.inputTokens + row.cacheReadTokens + row.cacheWriteTokens
      : row.provider === "google"
        ? row.inputTokens
        : null;
    if (totalInput !== null) {
      cacheInputTotals.set(key, (cacheInputTotals.get(key) ?? 0) + totalInput);
    }
    groups.set(key, group);
  }
  return [...groups.entries()]
    .map(([key, group]) => ({ ...group, cacheReadRate: (cacheInputTotals.get(key) ?? 0) > 0 ? group.cacheReadTokens / cacheInputTotals.get(key)! : null }))
    .sort((a, b) => b.costMicros - a.costMicros || a.provider.localeCompare(b.provider) || (a.model ?? "").localeCompare(b.model ?? ""));
}
