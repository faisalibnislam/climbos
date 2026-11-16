/**
 * Possible tracking breaks and unusual days in a connected daily metric. Each alert is a prompt to check the data
 * source, never a statement of cause. Thresholds are stated defaults: stale after 3 days without data (sources can
 * lag a day or two), a zero run of 3+ consecutive calendar days after a prior 14-day observed average of at least
 * 5 (at least 7 observations), and a day more than 4 robust deviations (MAD) from the prior 28 calendar days'
 * median (at least 14 observations). Gaps stay unknown; the windows never count rows as elapsed days.
 */

import { addDays, daysBetween, isValidDateString, sortSeries, validateSeries } from "./series";

export interface MetricHealthAlert {
  kind: "stale" | "zero_run" | "unusual_day" | "incomplete" | "invalid";
  date: string;
  message: string;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function metricHealth(points: readonly { date: string; value: number }[], options: { yesterday: string; label: string; format?: (n: number) => string }): MetricHealthAlert[] {
  if (!isValidDateString(options.yesterday)) throw new RangeError("Metric health needs a valid last completed calendar day.");
  if (!points.length) return [];
  if (!validateSeries(points).ok) return [{ kind: "invalid", date: options.yesterday, message: `${options.label}: daily observations have invalid dates, duplicate days or non-finite values. Check the source; unusual-day and zero-run checks are unavailable until these are corrected.` }];
  const fmt = options.format ?? ((n: number) => (Math.round(n * 10) / 10).toLocaleString("en-US"));
  const sorted = sortSeries(points.filter(p => p.date <= options.yesterday));
  if (!sorted.length) return [];
  const last = sorted[sorted.length - 1];
  const alerts: MetricHealthAlert[] = [];
  if (last.date < addDays(options.yesterday, -2)) {
    alerts.push({ kind: "stale", date: last.date, message: `${options.label}: no data recorded since ${last.date}. This may be a sync or tracking issue; check the connection.` });
    return alerts;
  }
  // The oldest relevant baseline is 28 days before the first day of the latest week.
  // Report only internal gaps in this bounded window, not days before collection began
  // or the one/two-day reporting lag allowed above. No missing values are synthesized.
  const windowStart = addDays(options.yesterday, -34);
  const observedStart = sorted[0].date > windowStart ? sorted[0].date : windowStart;
  const observed = sorted.filter(p => p.date >= observedStart);
  const missing = daysBetween(observedStart, last.date) + 1 - observed.length;
  if (missing > 0) alerts.push({ kind: "incomplete", date: last.date, message: `${options.label}: ${missing} missing ${missing === 1 ? "day" : "days"} between ${observedStart} and ${last.date}. Missing values are unknown, not zero. Checks use only recorded days; check source coverage before comparing performance.` });
  let run = 0;
  for (let i = sorted.length - 1; i >= 0 && sorted[i].value === 0; i--) {
    if (sorted[i].date !== addDays(last.date, -run)) break;
    run++;
  }
  const runStart = run ? sorted[sorted.length - run].date : last.date;
  const baselineStart = addDays(runStart, -14);
  const before = sorted.filter(p => p.date >= baselineStart && p.date < runStart);
  const priorMean = before.length ? before.reduce((s, p) => s + p.value, 0) / before.length : 0;
  if (run >= 3 && before.length >= 7 && priorMean >= 5) {
    alerts.push({ kind: "zero_run", date: runStart, message: `${options.label}: ${run} days in a row at zero after averaging ${fmt(priorMean)} a day across ${before.length} observed days in the preceding 14-day window. This may be a tracking break rather than a real drop; check the source before acting on it.` });
    return alerts;
  }
  // Most recent unusual day in the last week, against the 28 days before it.
  for (let i = sorted.length - 1; i >= 0 && sorted[i].date >= addDays(options.yesterday, -6); i--) {
    const baseStart = addDays(sorted[i].date, -28);
    const base = sorted.filter(p => p.date >= baseStart && p.date < sorted[i].date).map(p => p.value);
    if (base.length < 14) continue;
    const med = median(base);
    const mad = median(base.map((x) => Math.abs(x - med)));
    if (mad === 0) continue;
    const dev = (sorted[i].value - med) / (1.4826 * mad);
    if (Math.abs(dev) > 4) {
      alerts.push({ kind: "unusual_day", date: sorted[i].date, message: `${options.label}: ${sorted[i].date} was unusually ${dev > 0 ? "high" : "low"} (${fmt(sorted[i].value)} vs a typical ${fmt(med)}), based on ${base.length} observed days in the preceding 28-day window. Check for a tracking change, duplicate import, or one-off event before reading it as a trend.` });
      break;
    }
  }
  return alerts;
}
