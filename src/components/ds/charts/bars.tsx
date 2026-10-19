"use client";

/*
 * Bar family (Signal): flat columns, 2px top corners, dashed grid, one tab stop per chart.
 * - StackedBarChart: parts of a total per period, with legend toggles.
 * - HorizontalBarChart: ranked rows with a grey tick for the previous period.
 * - Histogram: distribution of raw values in bins, with a highlighted threshold.
 * - WaterfallChart: start → gains and losses → end.
 */
import { useState } from "react";
import { cn } from "@/lib/utils";
import { fmt, useEntered } from "@/components/analytics/shared";
import { CHART, ChartTooltip, PALETTE, Plot, XLabels, XTicks, compact, focusRing, niceScale, useKeyNav, type ChartTip, SrTable } from "./core";
import { ChartLegend } from "./controls";

const grow = (i: number, step = 25) => `height .55s cubic-bezier(.2,.7,.2,1) ${i * step}ms, opacity .15s`;

/* ---------------- Stacked bar ---------------- */

export interface BarSeries {
  key: string;
  label: string;
  values: number[];
  color?: string;
}

export function StackedBarChart({ labels, series, format = fmt, unit = "", height = 200, label, categoryLabel = "Period", toggles = true }: { labels: string[]; series: BarSeries[]; format?: (n: number) => string; unit?: string; height?: number; label: string; categoryLabel?: string; toggles?: boolean }) {
  const { ref, entered } = useEntered<HTMLDivElement>();
  const [hidden, setHidden] = useState<string[]>([]);
  const all = series.map((s, i) => ({ ...s, color: s.color ?? PALETTE[i % PALETTE.length] }));
  const shown = all.filter((s) => !hidden.includes(s.key));
  const totals = labels.map((_, i) => shown.reduce((t, s) => t + (s.values[i] ?? 0), 0));
  const scale = niceScale(Math.max(...totals, 0));
  const nav = useKeyNav(labels.length);
  const a = nav.active;
  const tip: ChartTip | null =
    a === null
      ? null
      : {
          x: ((a + 0.5) / labels.length) * 100,
          y: 100 - (totals[a] / scale.max) * 100,
          title: labels[a],
          rows: [...shown].reverse().map((s) => ({ label: s.label, value: `${format(s.values[a] ?? 0)}${unit}`, color: s.color })),
          note: `Total ${format(totals[a])}${unit}`,
        };
  return (
    <div ref={ref} className="flex flex-col gap-3">
      <Plot height={height} scale={scale} label={`${label}. Arrow keys read each ${categoryLabel.toLowerCase()}.`} nav={nav} tip={tip} xLabels={<XLabels labels={labels} />}>
        <div className="absolute inset-0 flex">
          {labels.map((l, i) => (
            <div key={l} className="relative h-full flex-1" onMouseEnter={() => nav.setActive(i)}>
              {a === i ? <span aria-hidden className="absolute inset-0 bg-ink/[0.04]" /> : null}
              <div
                className={cn("absolute inset-x-[18%] bottom-0 flex flex-col-reverse gap-px overflow-hidden rounded-t-[2px]", a !== null && a !== i && "opacity-55")}
                style={{ height: entered ? `${(totals[i] / scale.max) * 100}%` : "0%", transition: grow(i) }}
              >
                {shown.map((s) => (
                  <span key={s.key} style={{ flexGrow: s.values[i] ?? 0, flexBasis: 0, background: s.color }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Plot>
      <ChartLegend
        label={label}
        items={all.map((s) => ({ key: s.key, label: s.label, color: s.color, value: format(s.values.reduce((t, v) => t + v, 0)) }))}
        hidden={hidden}
        onToggle={toggles ? (k) => setHidden((h) => (h.includes(k) ? h.filter((x) => x !== k) : [...h, k])) : undefined}
      />
      <SrTable caption={label} columns={[categoryLabel, ...shown.map((s) => s.label), "Total"]} rows={labels.map((l, i) => [l, ...shown.map((s) => s.values[i] ?? 0), totals[i]])} />
    </div>
  );
}

/* ---------------- Horizontal bar ---------------- */

export interface HBarItem {
  label: string;
  value: number;
  previous?: number;
  meta?: string;
}

export function HorizontalBarChart({ items, format = fmt, unit = "", label, valueLabel = "Value", previousLabel = "Previous period", sort = true }: { items: HBarItem[]; format?: (n: number) => string; unit?: string; label: string; valueLabel?: string; previousLabel?: string; sort?: boolean }) {
  const { ref, entered } = useEntered<HTMLDivElement>();
  const rows = sort ? [...items].sort((p, q) => q.value - p.value) : items;
  const nav = useKeyNav(rows.length, 1);
  const max = Math.max(...rows.flatMap((r) => [r.value, r.previous ?? 0]), 1);
  const total = rows.reduce((t, r) => t + r.value, 0);
  const hasPrev = rows.some((r) => r.previous !== undefined);
  return (
    <div ref={ref}>
      <div role="group" tabIndex={0} aria-label={`${label}. Arrow keys read each row.`} onKeyDown={nav.onKeyDown} onBlur={nav.onBlur} onMouseLeave={nav.onMouseLeave} className={cn("flex flex-col gap-1 rounded-[2px]", focusRing)}>
        {rows.map((r, i) => {
          const on = nav.active === i;
          return (
            <div key={r.label} onMouseEnter={() => nav.setActive(i)} className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 transition-opacity sm:grid-cols-[minmax(0,9rem)_1fr_4rem]", nav.active !== null && !on && "opacity-55")}>
              <span className="min-w-0">
                <span className="block truncate text-ui text-ink">{r.label}</span>
                {r.meta ? <span className="block truncate text-2xs text-ink-3">{r.meta}</span> : null}
              </span>
              <div className="relative col-span-2 row-start-2 h-6 sm:col-span-1 sm:row-start-auto">
                <span aria-hidden className="absolute inset-y-1 left-0 right-0 rounded-[2px] bg-surface-2" />
                <span
                  aria-hidden
                  className="absolute inset-y-1 left-0 rounded-r-[2px] transition-[width] duration-700"
                  style={{ width: entered ? `${(r.value / max) * 100}%` : "0%", background: i === 0 ? CHART.ink : CHART.sage, transitionDelay: `${i * 50}ms` }}
                />
                {r.previous !== undefined ? <span aria-hidden className="absolute inset-y-0 w-[3px] -translate-x-1/2 rounded-[1px]" style={{ left: `${(r.previous / max) * 100}%`, background: CHART.previous }} /> : null}
                {on ? (
                  <ChartTooltip
                    place={i < rows.length / 2 ? "below" : "above"}
                    tip={{
                      x: (r.value / max) * 100,
                      y: i < rows.length / 2 ? 100 : 0,
                      title: r.label,
                      rows: [
                        { label: valueLabel, value: `${format(r.value)}${unit}`, color: i === 0 ? CHART.ink : CHART.sage, strong: true },
                        ...(r.previous !== undefined ? [{ label: previousLabel, value: `${format(r.previous)}${unit}`, color: CHART.previous }] : []),
                      ],
                      note: `${Math.round((r.value / (total || 1)) * 100)}% of total`,
                    }}
                  />
                ) : null}
              </div>
              <span className="col-start-2 row-start-1 text-right text-ui font-medium tabular-nums text-ink sm:col-start-auto sm:row-start-auto">{format(r.value)}{unit}</span>
            </div>
          );
        })}
      </div>
      {hasPrev ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-ink-3">
          <span aria-hidden className="h-3 w-[3px] rounded-[1px]" style={{ background: CHART.previous }} />
          {previousLabel}
        </p>
      ) : null}
      <SrTable caption={label} columns={["Item", valueLabel, ...(hasPrev ? [previousLabel] : [])]} rows={rows.map((r) => [r.label, r.value, ...(hasPrev ? [r.previous ?? ""] : [])])} />
    </div>
  );
}

/* ---------------- Histogram ---------------- */

export function Histogram({ values, binSize, min = 0, max, threshold, thresholdLabel, label, countLabel = "Count", valueLabel = "Value", height = 180 }: { values: number[]; binSize: number; min?: number; max: number; threshold?: number; thresholdLabel?: string; label: string; countLabel?: string; valueLabel?: string; height?: number }) {
  const { ref, entered } = useEntered<HTMLDivElement>();
  const n = Math.ceil((max - min) / binSize);
  const bins = Array.from({ length: n }, (_, i) => ({ from: min + i * binSize, to: min + (i + 1) * binSize, count: 0 }));
  values.forEach((v) => {
    const i = Math.min(n - 1, Math.max(0, Math.floor((v - min) / binSize)));
    bins[i].count++;
  });
  const scale = niceScale(Math.max(...bins.map((b) => b.count)));
  const sorted = [...values].sort((p, q) => p - q);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  const xAt = (v: number) => ((v - min) / (max - min)) * 100;
  const nav = useKeyNav(n);
  const a = nav.active;
  const tip: ChartTip | null =
    a === null
      ? null
      : {
          x: ((a + 0.5) / n) * 100,
          y: 100 - (bins[a].count / scale.max) * 100,
          title: `${valueLabel} ${bins[a].from}–${bins[a].to}`,
          rows: [{ label: countLabel, value: fmt(bins[a].count), color: threshold !== undefined && bins[a].from >= threshold ? CHART.ink : CHART.sage, strong: true }],
          note: `${Math.round((bins[a].count / (values.length || 1)) * 100)}% of ${fmt(values.length)}`,
        };
  const edges = bins.map((b) => b.from).concat(max).filter((_, i) => i % Math.max(1, Math.ceil(n / 5)) === 0 || i === n);
  return (
    <div ref={ref}>
      <Plot height={height} scale={scale} label={`${label}. Arrow keys read each bin.`} nav={nav} tip={tip} xLabels={<XTicks ticks={edges} at={xAt} format={(t) => String(t)} />}>
        <div className="absolute inset-0 flex gap-px">
          {bins.map((b, i) => {
            const hot = threshold !== undefined && b.from >= threshold;
            return (
              <div key={b.from} className="relative h-full flex-1" onMouseEnter={() => nav.setActive(i)}>
                <span
                  className={cn("absolute inset-x-0 bottom-0 rounded-t-[2px]", a !== null && a !== i && "opacity-55")}
                  style={{ height: entered ? `${(b.count / scale.max) * 100}%` : "0%", background: hot ? CHART.ink : CHART.sage, transition: grow(i, 20) }}
                />
              </div>
            );
          })}
        </div>
        <span aria-hidden className="pointer-events-none absolute inset-y-0 border-l border-dashed border-ink/50" style={{ left: `${xAt(median)}%` }}>
          <span className="text-annotation absolute -top-1 left-1.5 whitespace-nowrap text-ink-2">Median {median}</span>
        </span>
        {threshold !== undefined && thresholdLabel ? (
          <span aria-hidden className="pointer-events-none absolute top-1 rounded-[var(--radius-badge)] bg-ink px-1.5 py-0.5 text-2xs font-medium text-white" style={{ left: `calc(${xAt(threshold)}% + 4px)` }}>
            {thresholdLabel}
          </span>
        ) : null}
      </Plot>
      <SrTable caption={`${label}; median ${median}`} columns={[valueLabel, countLabel]} rows={bins.map((b) => [`${b.from}–${b.to}`, b.count])} />
    </div>
  );
}

/* ---------------- Waterfall ---------------- */

export interface WaterfallStep {
  label: string;
  /** For "start" the opening value; for "delta" the change; ignored for "total". */
  value: number;
  kind: "start" | "delta" | "total";
}

/** Running totals and bar extents for each step. */
export function runningTotals(steps: WaterfallStep[]) {
  const out: (WaterfallStep & { before: number; after: number; lo: number; hi: number })[] = [];
  let run = 0;
  for (const s of steps) {
    const before = run;
    if (s.kind === "start") run = s.value;
    else if (s.kind === "delta") run += s.value;
    out.push({ ...s, before, after: run, lo: s.kind === "delta" ? Math.min(before, run) : 0, hi: s.kind === "delta" ? Math.max(before, run) : run });
  }
  return out;
}

export function WaterfallChart({ steps, format = fmt, unit = "", label, height = 220 }: { steps: WaterfallStep[]; format?: (n: number) => string; unit?: string; label: string; height?: number }) {
  const { ref, entered } = useEntered<HTMLDivElement>();
  const bars = runningTotals(steps);
  const scale = niceScale(Math.max(...bars.map((b) => b.hi)));
  const y = (v: number) => (v / scale.max) * 100;
  const nav = useKeyNav(bars.length);
  const a = nav.active;
  const color = (b: (typeof bars)[number]) => (b.kind !== "delta" ? CHART.ink : b.value >= 0 ? CHART.sage : CHART.clay);
  const sign = (v: number) => `${v >= 0 ? "+" : "−"}${format(Math.abs(v))}${unit}`;
  const tip: ChartTip | null =
    a === null
      ? null
      : {
          x: ((a + 0.5) / bars.length) * 100,
          y: 100 - y(bars[a].hi),
          title: bars[a].label,
          rows: bars[a].kind === "delta" ? [{ label: "Change", value: sign(bars[a].value), color: color(bars[a]), strong: true }, { label: "Running total", value: `${format(bars[a].after)}${unit}` }] : [{ label: bars[a].kind === "start" ? "Opening" : "Closing", value: `${format(bars[a].after)}${unit}`, color: CHART.ink, strong: true }],
        };
  return (
    <div ref={ref}>
      <Plot height={height} scale={scale} label={`${label}. Arrow keys read each step.`} nav={nav} tip={tip} xLabels={<XLabels labels={steps.map((s) => s.label)} fit={8} />}>
        <div className="absolute inset-0 flex">
          {bars.map((b, i) => (
            <div key={b.label} className="relative h-full flex-1" onMouseEnter={() => nav.setActive(i)}>
              {a === i ? <span aria-hidden className="absolute inset-0 bg-ink/[0.04]" /> : null}
              <span
                className={cn("absolute inset-x-[16%] rounded-[2px]", a !== null && a !== i && "opacity-55")}
                style={{ bottom: `${y(b.lo)}%`, height: entered ? `${Math.max(0.6, y(b.hi) - y(b.lo))}%` : "0%", background: color(b), transition: grow(i, 70) }}
              />
              <span aria-hidden className="absolute left-1/2 -translate-x-1/2 -translate-y-[calc(100%+3px)] whitespace-nowrap text-2xs font-medium tabular-nums text-ink-2" style={{ bottom: `${y(b.hi)}%`, opacity: entered ? 1 : 0, transition: `opacity .3s ${i * 70 + 300}ms` }}>
                {b.kind === "delta" ? sign(b.value) : compact(b.after)}
              </span>
              {i < bars.length - 1 ? <span aria-hidden className="absolute left-[84%] right-[-16%] border-t border-dashed border-ink/40" style={{ bottom: `${y(b.after)}%` }} /> : null}
            </div>
          ))}
        </div>
      </Plot>
      <div className="ml-10 mt-3 flex flex-wrap gap-5 text-ui text-ink-2">
        {[["Increase", CHART.sage], ["Decrease", CHART.clay], ["Total", CHART.ink]].map(([l, c]) => (
          <span key={l} className="flex items-center gap-2"><span aria-hidden className="size-2.5 rounded-[2px]" style={{ background: c }} />{l}</span>
        ))}
      </div>
      <SrTable caption={label} columns={["Step", "Change", "Running total"]} rows={bars.map((b) => [b.label, b.kind === "delta" ? sign(b.value) : "", b.after])} />
    </div>
  );
}
