import { formatNumber } from "@/lib/utils";
import { minorToDisplay, relativeTime } from "../money";

export type MetricUnit = "count" | "currency_minor";

/** Format a metric value in its own unit. Counts are rounded to whole numbers. */
export function formatMetric(value: number, unit: MetricUnit | string, currency: string | null | undefined): string {
  if (unit === "currency_minor") return minorToDisplay(Math.round(value), currency ?? "USD");
  return formatNumber(Math.round(value));
}

/** 0.0423 → "4.2%". */
export function formatPercent(fraction: number, digits = 1): string {
  if (!Number.isFinite(fraction)) return "—";
  return `${(fraction * 100).toFixed(digits).replace(/\.0+$/, "")}%`;
}

/** Plain-language period-over-period change (words, not just arrows). */
export function changeText(current: number, previous: number | null, spanDays: number): string {
  const period = `the previous ${spanDays} days`;
  if (previous === null) return `No data for ${period} to compare`;
  if (previous === 0 && current === 0) return `No change from ${period}`;
  if (previous === 0) return `Up from zero in ${period}`;
  const delta = (current - previous) / Math.abs(previous);
  if (Math.abs(delta) < 0.005) return `About the same as ${period}`;
  return `${delta > 0 ? "Up" : "Down"} ${formatPercent(Math.abs(delta))} vs ${period}`;
}

const SOURCE_NAMES: Record<string, string> = {
  ga4: "Google Analytics 4",
  billing: "Billing",
  stripe: "Stripe",
  csv: "Uploaded revenue file",
  demo: "Demo data",
  fixture: "Demo data",
};

export function sourceLabel(sourceName: string | null | undefined, fallback: string): string {
  if (!sourceName) return fallback;
  return SOURCE_NAMES[sourceName] ?? sourceName;
}

export function freshnessText(ms: number | null | undefined): string {
  return ms ? `updated ${relativeTime(ms)}` : "not updated yet";
}

/** "2026-10-01" → "Oct 1" (date-only strings are rendered in UTC so they don't shift). */
export function shortDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function longDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export const METRIC_LABELS: Record<string, string> = {
  visits: "Website visits",
  signups: "Sign-ups",
  paid_conversions: "New paying customers",
  revenue: "Revenue (net of refunds)",
};

export const FORECAST_METHOD_LABELS: Record<string, string> = {
  seasonal_naive: "Seasonal naive (repeats the same weekday from last week)",
  drift: "Drift (continues the recent trend in a straight line)",
  moving_average: "Moving average (repeats the recent average)",
};
