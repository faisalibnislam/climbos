type JsonObject = Record<string, unknown>;

const object = (value: unknown): JsonObject | null => value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null;
const number = (value: unknown): number | null => {
  const result = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(result) && result >= 0 ? result : null;
};

// Google Search Central's "good" CWV cutoffs: LCP 2.5s, INP 200ms, CLS 0.1.
const CRUX_METRICS = [
  { id: "largest_contentful_paint", label: "Largest Contentful Paint", unit: "ms", good: 2500, needsImprovement: 4000 },
  { id: "interaction_to_next_paint", label: "Interaction to Next Paint", unit: "ms", good: 200, needsImprovement: 500 },
  { id: "cumulative_layout_shift", label: "Cumulative Layout Shift", unit: "score", good: 0.1, needsImprovement: 0.25 },
] as const;

export type CruxStatus = "measured" | "no_data" | "not_configured" | "unavailable";
export interface CruxPerformance {
  status: CruxStatus;
  formFactor: "PHONE";
  recordUrl: string | null;
  collectionPeriod: string | null;
  fetchedAt: number;
  metrics: { id: string; label: string; value: number; unit: string; verdict: "good" | "needs_improvement" | "poor" }[];
}

function periodOf(record: JsonObject): string | null {
  const period = object(record.collectionPeriod);
  const first = object(period?.firstDate);
  const last = object(period?.lastDate);
  const date = (part: JsonObject | null) => part && Number.isInteger(part.year) && Number.isInteger(part.month) && Number.isInteger(part.day)
    ? `${String(part.year).padStart(4, "0")}-${String(part.month).padStart(2, "0")}-${String(part.day).padStart(2, "0")}`
    : null;
  const start = date(first);
  const end = date(last);
  return start && end ? `${start} to ${end}` : null;
}

/** Parse only the explicit p75 field metrics and collection window returned by CrUX. */
export function parseCruxPerformance(value: unknown, fetchedAt = Date.now()): CruxPerformance {
  const root = object(value);
  const record = object(root?.record);
  const key = object(record?.key);
  const rawMetrics = object(record?.metrics);
  const metrics = CRUX_METRICS.flatMap((definition) => {
    const metric = object(rawMetrics?.[definition.id]);
    const value = number(object(metric?.percentiles)?.p75);
    if (value === null) return [];
    const verdict: "good" | "needs_improvement" | "poor" = value <= definition.good ? "good" : value <= definition.needsImprovement ? "needs_improvement" : "poor";
    return [{ id: definition.id, label: definition.label, value, unit: definition.unit, verdict }];
  });
  return {
    status: metrics.length ? "measured" : "no_data",
    formFactor: "PHONE",
    recordUrl: typeof key?.url === "string" ? key.url : typeof key?.origin === "string" ? key.origin : null,
    collectionPeriod: record ? periodOf(record) : null,
    fetchedAt,
    metrics,
  };
}

export interface LighthousePerformance {
  status: "measured" | "unavailable" | "no_result";
  strategy: "mobile";
  requestedUrl: string;
  finalUrl: string | null;
  fetchedAt: number;
  score: number | null;
  metrics: { id: string; label: string; displayValue: string }[];
  opportunities: { id: string; title: string; displayValue: string | null; description: string }[];
}

const LAB_METRICS: Record<string, string> = {
  "first-contentful-paint": "First Contentful Paint",
  "largest-contentful-paint": "Largest Contentful Paint",
  "speed-index": "Speed Index",
  "total-blocking-time": "Total Blocking Time",
  "cumulative-layout-shift": "Cumulative Layout Shift",
};

/** Parse bounded mobile Lighthouse results; these are lab results, not field data. */
export function parseLighthousePerformance(value: unknown, requestedUrl: string, fetchedAt = Date.now()): LighthousePerformance {
  const root = object(value);
  const result = object(root?.lighthouseResult);
  const categories = object(result?.categories);
  const performance = object(categories?.performance);
  const audits = object(result?.audits);
  const score = number(performance?.score);
  const metrics = Object.entries(LAB_METRICS).flatMap(([id, label]) => {
    const audit = object(audits?.[id]);
    return typeof audit?.displayValue === "string" ? [{ id, label, displayValue: audit.displayValue.slice(0, 80) }] : [];
  });
  const opportunities = Object.entries(audits ?? {}).flatMap(([id, raw]) => {
    const audit = object(raw);
    const details = object(audit?.details);
    const savings = number(details?.overallSavingsMs);
    if (!audit || audit.scoreDisplayMode !== "numeric" || number(audit.score) === null || number(audit.score)! >= 0.9 || !savings || typeof audit.title !== "string") return [];
    return [{ id, title: audit.title.slice(0, 120), displayValue: typeof audit.displayValue === "string" ? audit.displayValue.slice(0, 80) : null, description: typeof audit.description === "string" ? audit.description.slice(0, 280) : "" }];
  });
  const savingsMs = (id: string) => number(object(object(audits?.[id])?.details)?.overallSavingsMs) ?? 0;
  opportunities.sort((a, b) => savingsMs(b.id) - savingsMs(a.id));
  opportunities.splice(5);
  return {
    status: score !== null ? "measured" : "no_result",
    strategy: "mobile",
    requestedUrl,
    finalUrl: typeof result?.finalUrl === "string" ? result.finalUrl : null,
    fetchedAt,
    score,
    metrics,
    opportunities,
  };
}
