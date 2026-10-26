import type { TurnResult } from "../../shared/ai/types";
import { MODEL_SPECS, searchCallUsd } from "../../shared/ai/models";
import { usdToMicrosCeil } from "../../shared/economics/money";
import type { ModelKey, RateVersion } from "../../shared/economics/rates";

/** Usage-event records for one metered Claude turn (tokens, plus web searches separately). */
export function claudeUsageRecords(modelKey: ModelKey, r: TurnResult, rates: RateVersion) {
  const searchMicros = usdToMicrosCeil(r.usage.webSearches * searchCallUsd(modelKey, rates));
  const records = [
    {
      type: "model_call" as const,
      provider: MODEL_SPECS[modelKey].provider,
      model: MODEL_SPECS[modelKey].apiModelId,
      inputTokens: r.usage.inputTokens,
      outputTokens: r.usage.outputTokens,
      reasoningTokens: r.usage.thinkingTokens,
      cacheReadTokens: r.usage.cacheReadTokens,
      cacheWriteTokens: r.usage.cacheWriteTokens,
      quantity: Math.max(1, r.usage.calls),
      costMicros: Math.max(0, r.costMicros - searchMicros),
      estimated: false,
    },
  ];
  if (r.usage.webSearches > 0) {
    records.push({ ...records[0], type: "search_call" as never, inputTokens: 0, outputTokens: 0, reasoningTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, quantity: r.usage.webSearches, costMicros: searchMicros });
  }
  return records;
}
