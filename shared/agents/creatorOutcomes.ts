export type CreatorOutcomeMetric = {
  name: string;
  kind: "count" | "rate" | "amount";
  value: number;
  unit: string;
  denominator?: number;
  eligible?: number;
  exposed?: number;
  currency?: string;
  periodStartAt: number;
  periodEndAt: number;
  sourceUrl?: string;
};

export type CreatorOutcomeReport = {
  creator: string;
  status: string;
  format?: string;
  agreedValueMinor?: number;
  actualCostMinor?: number;
  currency?: string;
  publishedUrl?: string;
  metric?: CreatorOutcomeMetric;
  note?: string;
  reportedAt: number;
};

const day = (timestamp: number) => Number.isFinite(timestamp) ? new Date(timestamp).toISOString().slice(0, 10) : "unknown";

/** Bounded, tenant-local operating history; never converts owner reports into causal evidence. */
export function formatCreatorOutcomeContext(reports: CreatorOutcomeReport[], limit = 15): string {
  const rows = reports.slice(0, Math.max(0, Math.min(20, Math.floor(limit))));
  if (!rows.length) return "";
  const data = rows.map((report) => ({
    creator: report.creator.slice(0, 120),
    status: report.status,
    reportedAt: day(report.reportedAt),
    ...(report.format ? { format: report.format } : {}),
    ...(report.agreedValueMinor !== undefined ? { agreedValueMinor: report.agreedValueMinor, currency: report.currency ?? null } : {}),
    ...(report.actualCostMinor !== undefined ? { actualCostMinor: report.actualCostMinor, currency: report.currency ?? null } : {}),
    ...(report.publishedUrl ? { publishedUrl: report.publishedUrl.slice(0, 500) } : {}),
    ...(report.metric ? { metric: { ...report.metric, name: report.metric.name.slice(0, 100), unit: report.metric.unit.slice(0, 40), periodStart: day(report.metric.periodStartAt), periodEnd: day(report.metric.periodEndAt) } } : {}),
    ...(report.note ? { ownerNote: report.note.slice(0, 300) } : {}),
  }));
  return JSON.stringify(data);
}
