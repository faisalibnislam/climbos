export interface PreviewLearningRow {
  status: string;
  createdAt: number;
  firstValueAt?: number;
  completedAt?: number;
  usefulness?: "useful" | "not_yet";
}

export interface PreviewLearningSummary {
  firstValueSamples: number;
  firstValueP50Ms: number | null;
  completedSamples: number;
  completedP50Ms: number | null;
  usefulnessResponses: number;
  usefulnessRate: number | null;
}

const MIN_REPORTING_SAMPLE = 5;

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return Number.isFinite(value) ? Math.round(value) : null;
}

function durations(rows: PreviewLearningRow[], timestamp: "firstValueAt" | "completedAt"): number[] {
  return rows.flatMap((row) => {
    const value = row[timestamp];
    if (value == null || !Number.isFinite(value) || !Number.isFinite(row.createdAt) || value < row.createdAt) return [];
    return [value - row.createdAt];
  });
}

/**
 * Aggregate only preview process timing and optional owner-reported usefulness.
 * Small samples stay hidden so operator views do not imply a stable benchmark.
 */
export function summarizePreviewLearning(rows: PreviewLearningRow[]): PreviewLearningSummary {
  const firstValueDurations = durations(rows, "firstValueAt");
  const completedDurations = durations(rows.filter((row) => row.status === "done"), "completedAt");
  const feedback = rows.filter((row) => row.usefulness === "useful" || row.usefulness === "not_yet");
  const useful = feedback.filter((row) => row.usefulness === "useful").length;
  return {
    firstValueSamples: firstValueDurations.length,
    firstValueP50Ms: firstValueDurations.length >= MIN_REPORTING_SAMPLE ? median(firstValueDurations) : null,
    completedSamples: completedDurations.length,
    completedP50Ms: completedDurations.length >= MIN_REPORTING_SAMPLE ? median(completedDurations) : null,
    usefulnessResponses: feedback.length,
    usefulnessRate: feedback.length >= MIN_REPORTING_SAMPLE ? useful / feedback.length : null,
  };
}
