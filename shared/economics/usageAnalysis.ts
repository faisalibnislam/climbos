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

export interface DatedUsageCostRow extends UsageCostRow {
  createdAt: number;
}

const DAY_MS = 86_400_000;

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

/** Conservative rolling-day cost signal; unavailable when the history read is capped or sparse. */
export function detectModelCostAnomalies(rows: DatedUsageCostRow[], now: number, historyCapped: boolean) {
  if (historyCapped) return { available: false as const, reason: "history_capped" as const, thresholdMultiple: 3, alerts: [] };
  const groups = new Map<string, { provider: string; model: string | null; currentMicros: number; priorMicros: number[]; priorDaysWithUsage: number }>();
  for (const row of rows) {
    if (row.estimated) continue;
    const ageDays = Math.floor((now - row.createdAt) / DAY_MS);
    if (ageDays < 0 || ageDays > 7) continue;
    const model = row.model?.trim() || null;
    const key = `${row.provider}\0${model ?? ""}`;
    const group = groups.get(key) ?? { provider: row.provider, model, currentMicros: 0, priorMicros: Array(7).fill(0), priorDaysWithUsage: 0 };
    if (ageDays === 0) group.currentMicros += row.costMicros;
    else group.priorMicros[ageDays - 1] += row.costMicros;
    groups.set(key, group);
  }
  const alerts = [];
  let enoughBaseline = false;
  for (const group of groups.values()) {
    group.priorDaysWithUsage = group.priorMicros.filter((cost) => cost > 0).length;
    if (group.priorDaysWithUsage < 5) continue;
    enoughBaseline = true;
    const sorted = [...group.priorMicros].sort((a, b) => a - b);
    const medianMicros = (sorted[3] + sorted[4]) / 2;
    if (medianMicros <= 0 || group.currentMicros < medianMicros * 3) continue;
    alerts.push({
      provider: group.provider,
      model: group.model,
      currentMicros: group.currentMicros,
      priorDailyMedianMicros: medianMicros,
      multipleOfMedian: group.currentMicros / medianMicros,
      baselineDaysWithUsage: group.priorDaysWithUsage,
      heuristic: true as const,
    });
  }
  alerts.sort((a, b) => b.multipleOfMedian - a.multipleOfMedian || b.currentMicros - a.currentMicros || a.provider.localeCompare(b.provider) || (a.model ?? "").localeCompare(b.model ?? ""));
  return {
    available: enoughBaseline,
    reason: enoughBaseline ? null : "insufficient_baseline" as const,
    thresholdMultiple: 3,
    alerts: alerts.slice(0, 10),
  };
}
