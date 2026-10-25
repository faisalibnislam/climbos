/**
 * Possible tracking breaks and unusual days in a connected daily metric. Each alert is a prompt to check the data
 * source, never a statement of cause. Thresholds are stated defaults: stale after 3 days without data (sources can
 * lag a day or two), a zero run of 3+ days after a prior 14-day average of at least 5, and a day more than 4 robust
 * deviations (MAD) from the prior 28 days' median.
 */

import { addDays } from "./series";

export interface MetricHealthAlert {
  kind: "stale" | "zero_run" | "unusual_day";
  date: string;
  message: string;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function metricHealth(points: readonly { date: string; value: number }[], options: { yesterday: string; label: string; format?: (n: number) => string }): MetricHealthAlert[] {
  if (!points.length) return [];
  const fmt = options.format ?? ((n: number) => (Math.round(n * 10) / 10).toLocaleString("en-US"));
  const sorted = [...points].sort((a, b) => (a.date < b.date ? -1 : 1));
  const last = sorted[sorted.length - 1];
  const alerts: MetricHealthAlert[] = [];
  if (last.date < addDays(options.yesterday, -2)) {
    alerts.push({ kind: "stale", date: last.date, message: `${options.label}: no data recorded since ${last.date}. This may be a sync or tracking issue; check the connection.` });
    return alerts;
  }
  let run = 0;
  for (let i = sorted.length - 1; i >= 0 && sorted[i].value === 0; i--) run++;
  const before = sorted.slice(Math.max(0, sorted.length - run - 14), sorted.length - run);
  const priorMean = before.length ? before.reduce((s, p) => s + p.value, 0) / before.length : 0;
  if (run >= 3 && before.length >= 7 && priorMean >= 5) {
    alerts.push({ kind: "zero_run", date: sorted[sorted.length - run].date, message: `${options.label}: ${run} days in a row at zero after averaging ${fmt(priorMean)} a day. This may be a tracking break rather than a real drop; check the source before acting on it.` });
    return alerts;
  }
  // Most recent unusual day in the last week, against the 28 days before it.
  for (let i = sorted.length - 1; i >= Math.max(0, sorted.length - 7); i--) {
    const base = sorted.slice(Math.max(0, i - 28), i).map((p) => p.value);
    if (base.length < 14) continue;
    const med = median(base);
    const mad = median(base.map((x) => Math.abs(x - med)));
    if (mad === 0) continue;
    const dev = (sorted[i].value - med) / (1.4826 * mad);
    if (Math.abs(dev) > 4) {
      alerts.push({ kind: "unusual_day", date: sorted[i].date, message: `${options.label}: ${sorted[i].date} was unusually ${dev > 0 ? "high" : "low"} (${fmt(sorted[i].value)} vs a typical ${fmt(med)}). Check for a tracking change, duplicate import, or one-off event before reading it as a trend.` });
      break;
    }
  }
  return alerts;
}
