"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn, formatNumber } from "@/lib/utils";
import { ChartFrame, type ChartFrameProps, type ChartTable } from "./chart";
import { Tooltip } from "./menu";

/**
 * ClimbOS data-visualisation kit, built in-house on SVG. Every chart:
 * - uses the ordered chart palette (--chart-1…6, all ≥3:1 on panels),
 * - shows exact values on hover AND on keyboard focus (arrow keys move),
 * - exposes the same data as a real table through ChartFrame,
 * - stays calm: thin gridlines, no 3D, no gradients beyond a soft area fill.
 */

export const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)"];

type FrameProps = Omit<ChartFrameProps, "table" | "children" | "legend">;

function niceScale(max: number, ticks = 4): { max: number; ticks: number[] } {
  if (max <= 0) return { max: 1, ticks: [0, 0.25, 0.5, 0.75, 1] };
  const raw = max / ticks;
  const exp = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / exp;
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * exp;
  const top = Math.ceil(max / step) * step;
  return { max: top, ticks: Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step) };
}

export function compactNumber(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}m`;
  if (abs >= 10_000) return `${Math.round(n / 1000)}k`;
  if (abs >= 1_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return formatNumber(Math.round(n * 10) / 10);
}

/** Floating value card used by every chart's hover state. */
function HoverCard({ x, children }: { x: number; children: ReactNode }) {
  const left = Math.min(Math.max(x, 12), 88);
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute top-1 z-10 min-w-36 -translate-x-1/2 rounded-lg border border-line bg-surface px-2.5 py-2 text-ui shadow-lg"
      style={{ left: `${left}%` }}
    >
      {children}
    </div>
  );
}

function SeriesRow({ color, label, value }: { color: string; label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-1.5 text-ink-2">
        <span className="size-2 rounded-full" style={{ background: color }} />
        {label}
      </span>
      <span className="font-medium tabular-nums text-ink">{value}</span>
    </div>
  );
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  if (items.length < 2) return null;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-ui text-ink-2">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-0.5 w-3.5 rounded-full" style={{ background: it.color }} />
          {it.label}
        </li>
      ))}
    </ul>
  );
}

/** Arrow-key navigation + a polite live region for charts with an active index. */
function useActiveIndex(count: number) {
  const [active, setActive] = useState<number | null>(null);
  const onKeyDown = (e: KeyboardEvent) => {
    if (!count) return;
    if (e.key === "ArrowRight") setActive((a) => Math.min(count - 1, (a ?? -1) + 1));
    else if (e.key === "ArrowLeft") setActive((a) => Math.max(0, (a ?? count) - 1));
    else if (e.key === "Home") setActive(0);
    else if (e.key === "End") setActive(count - 1);
    else if (e.key === "Escape") setActive(null);
    else return;
    e.preventDefault();
  };
  return { active, setActive, onKeyDown };
}

/* ------------------------------------------------------------------------- */
/* AreaChart: one or more series over time, with a hover crosshair            */
/* ------------------------------------------------------------------------- */

export interface Series {
  key: string;
  label: string;
  values: number[];
  color?: string;
}

export interface AreaChartProps extends FrameProps {
  labels: string[];
  series: Series[];
  format?: (n: number) => string;
  height?: number;
  /** Fill under the first series (default true). */
  area?: boolean;
  categoryLabel?: string;
  bare?: boolean;
}

export function AreaChart({ labels, series, format = formatNumber, height = 220, area = true, categoryLabel = "Period", bare, ...frame }: AreaChartProps) {
  const gid = useId().replace(/:/g, "");
  const plot = useRef<HTMLDivElement>(null);
  const n = labels.length;
  const { active, setActive, onKeyDown } = useActiveIndex(n);
  const peak = Math.max(0, ...series.flatMap((s) => s.values));
  const { max, ticks } = niceScale(peak);
  const xAt = (i: number) => (n <= 1 ? 50 : (i / (n - 1)) * 100);
  const yAt = (v: number) => 100 - (v / max) * 100;
  const colors = series.map((s, i) => s.color ?? CHART_COLORS[i % CHART_COLORS.length]);
  const line = (vals: number[]) => vals.map((v, i) => `${i ? "L" : "M"}${xAt(i)},${yAt(v)}`).join(" ");

  const onMove = (clientX: number) => {
    const r = plot.current?.getBoundingClientRect();
    if (!r || n === 0) return;
    const ratio = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    setActive(Math.round(ratio * (n - 1)));
  };

  const table: ChartTable = { columns: [categoryLabel, ...series.map((s) => s.label)], rows: labels.map((l, i) => [l, ...series.map((s) => format(s.values[i] ?? 0))]) };
  const every = n > 8 ? Math.ceil(n / 6) : 1;
  const chart = (
    <div>
      <div className="flex" style={{ height }}>
        <div aria-hidden="true" className="relative w-10 shrink-0 text-right text-2xs tabular-nums text-ink-3">
          {ticks.map((t) => (
            <span key={t} className="absolute right-2 -translate-y-1/2" style={{ top: `${yAt(t)}%` }}>
              {compactNumber(t)}
            </span>
          ))}
        </div>
        <div
          ref={plot}
          role="group"
          tabIndex={0}
          aria-label={`${series.map((s) => s.label).join(", ")} by ${categoryLabel.toLowerCase()}. Use arrow keys to read values.`}
          className="relative flex-1 rounded-md outline-offset-4"
          onMouseMove={(e) => onMove(e.clientX)}
          onMouseLeave={() => setActive(null)}
          onKeyDown={onKeyDown}
          onBlur={() => setActive(null)}
        >
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden="true">
            <defs>
              <linearGradient id={`fill-${gid}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={colors[0]} style={{ stopOpacity: "var(--area-top, 0.16)" }} />
                <stop offset="100%" stopColor={colors[0]} style={{ stopOpacity: "var(--area-bottom, 0)" }} />
              </linearGradient>
            </defs>
            {ticks.map((t) => (
              <line key={t} x1="0" x2="100" y1={yAt(t)} y2={yAt(t)} stroke="var(--chart-grid)" vectorEffect="non-scaling-stroke" />
            ))}
            {area && series[0] && n > 1 ? <path d={`${line(series[0].values)} L100,100 L0,100 Z`} fill={`url(#fill-${gid})`} /> : null}
            {series.map((s, si) => (
              <path key={s.key} d={line(s.values)} fill="none" stroke={colors[si]} strokeWidth={si === 0 ? 2 : 1.75} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            ))}
            {active !== null ? <line x1={xAt(active)} x2={xAt(active)} y1="0" y2="100" stroke="var(--line-strong)" vectorEffect="non-scaling-stroke" /> : null}
          </svg>
          {active !== null
            ? series.map((s, si) => (
                <span
                  key={s.key}
                  aria-hidden="true"
                  className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface"
                  style={{ left: `${xAt(active)}%`, top: `${yAt(s.values[active] ?? 0)}%`, background: colors[si] }}
                />
              ))
            : null}
          {active !== null ? (
            <HoverCard x={xAt(active)}>
              <div className="mb-1 text-xs text-ink-3">{labels[active]}</div>
              <div className="flex flex-col gap-0.5">
                {series.map((s, si) => (
                  <SeriesRow key={s.key} color={colors[si]} label={s.label} value={format(s.values[active] ?? 0)} />
                ))}
              </div>
            </HoverCard>
          ) : null}
          <span className="sr-only" aria-live="polite">
            {active !== null ? `${labels[active]}: ${series.map((s) => `${s.label} ${format(s.values[active] ?? 0)}`).join(", ")}` : ""}
          </span>
        </div>
      </div>
      <div aria-hidden="true" className="relative ml-10 h-5 text-2xs text-ink-3">
        {labels.map((l, i) =>
          i % every === 0 || i === n - 1 ? (
            <span key={`${l}-${i}`} className={cn("absolute top-1.5 whitespace-nowrap", i === 0 ? "" : i === n - 1 ? "-translate-x-full" : "-translate-x-1/2")} style={{ left: `${xAt(i)}%` }}>
              {l}
            </span>
          ) : null,
        )}
      </div>
    </div>
  );
  if (bare) return chart;
  return (
    <ChartFrame {...frame} table={table} legend={<Legend items={series.map((s, i) => ({ label: s.label, color: colors[i] }))} />}>
      {chart}
    </ChartFrame>
  );
}

/* ------------------------------------------------------------------------- */
/* Sparkline + StatTrend                                                      */
/* ------------------------------------------------------------------------- */

export function Sparkline({ values, color = "var(--chart-1)", height = 32, area = true, className }: { values: number[]; color?: string; height?: number; area?: boolean; className?: string }) {
  const gid = useId().replace(/:/g, "");
  if (values.length < 2) return <div className={className} style={{ height }} />;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * 100, 92 - ((v - min) / span) * 84] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join(" ");
  return (
    <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" className={cn("w-full overflow-visible", className)} style={{ height }}>
      <defs>
        <linearGradient id={`spark-${gid}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} style={{ stopOpacity: "var(--area-top, 0.18)" }} />
          <stop offset="100%" stopColor={color} style={{ stopOpacity: "var(--area-bottom, 0)" }} />
        </linearGradient>
      </defs>
      {area ? <path d={`${d} L100,100 L0,100 Z`} fill={`url(#spark-${gid})`} /> : null}
      <path d={d} fill="none" stroke={color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export interface StatTrendProps {
  label: ReactNode;
  value: ReactNode;
  /** Change vs the previous period, e.g. +12 (percent). */
  delta?: number;
  /** Whether "up" is good (default) — controls the delta colour. */
  upIsGood?: boolean;
  deltaLabel?: string;
  trend?: number[];
  sublabel?: ReactNode;
  icon?: ReactNode;
  /** Short explanation shown on hover of the info icon. */
  help?: ReactNode;
  className?: string;
}

/** KPI card: label, serif number, coloured change with words, sparkline and provenance. */
export function StatTrend({ label, value, delta, upIsGood = true, deltaLabel = "vs last period", trend, sublabel, icon, help, className }: StatTrendProps) {
  const good = delta === undefined || delta === 0 ? null : delta > 0 === upIsGood;
  const deltaText = delta === undefined ? null : `${delta > 0 ? "Up" : delta < 0 ? "Down" : "No change"}${delta ? ` ${Math.abs(delta)}%` : ""}`;
  return (
    <div className={cn("flex flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--card-shadow)]", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-ui font-medium text-ink-3">
          {icon ? <span aria-hidden="true" className="inline-flex [&_svg]:size-4">{icon}</span> : null}
          {label}
          {help ? (
            <Tooltip content={help}>
              <button type="button" className="grid size-4 place-items-center rounded-full border border-control text-2xs leading-none text-ink-3 hover:text-ink" aria-label="What this means">
                ?
              </button>
            </Tooltip>
          ) : null}
        </span>
        {deltaText ? (
          <span
            className={cn(
              "inline-flex h-5 items-center rounded-[var(--radius-badge)] border px-1.5 text-xs font-medium",
              // Signal outlines the change pill; Summit keeps a plain soft fill.
              "border-transparent [[data-theme=wact]_&]:border-current/25",
              good === null ? "bg-surface-2 text-ink-2" : good ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800",
            )}
            title={deltaLabel}
          >
            {deltaText}
          </span>
        ) : null}
      </div>
      <div className="flex items-end justify-between gap-3">
        <span className="metric">{value}</span>
        {trend && trend.length > 1 ? <Sparkline values={trend} className="max-w-28" height={30} color={good === false ? "var(--red-500)" : "var(--chart-1)"} /> : null}
      </div>
      {sublabel ? <span className="text-xs text-ink-3">{sublabel}</span> : null}
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* DonutChart                                                                 */
/* ------------------------------------------------------------------------- */

export interface Segment {
  label: string;
  value: number;
  color?: string;
  icon?: ReactNode;
}

export interface DonutChartProps extends FrameProps {
  segments: Segment[];
  centerLabel?: ReactNode;
  centerValue?: ReactNode;
  format?: (n: number) => string;
  size?: number;
  bare?: boolean;
}

export function DonutChart({ segments, centerLabel, centerValue, format = formatNumber, size = 168, bare, ...frame }: DonutChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  const colors = segments.map((s, i) => s.color ?? CHART_COLORS[i % CHART_COLORS.length]);
  const r = 40;
  const c = 2 * Math.PI * r;
  const lengths = segments.map((s) => (total ? (Math.max(0, s.value) / total) * c : 0));
  const arcs = lengths.map((len, i) => {
    const start = lengths.slice(0, i).reduce((a, b) => a + b, 0);
    const gap = segments.length > 1 && len > 2 ? 1.2 : 0;
    return { i, dash: `${Math.max(0, len - gap)} ${c}`, offset: -start };
  });
  const pct = (v: number) => (total ? Math.round((v / total) * 100) : 0);
  const shown = hover !== null ? segments[hover] : null;
  const table: ChartTable = { columns: ["Segment", "Value", "Share"], rows: segments.map((s) => [s.label, format(s.value), `${pct(s.value)}%`]) };
  const chart = (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden="true">
          <circle cx="50" cy="50" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="11" />
          {arcs.map((a) => (
            <circle
              key={a.i}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={colors[a.i]}
              strokeWidth={hover === a.i ? 13 : 11}
              strokeDasharray={a.dash}
              strokeDashoffset={a.offset}
              opacity={hover === null || hover === a.i ? 1 : 0.35}
              className="transition-[opacity,stroke-width] duration-150"
              onMouseEnter={() => setHover(a.i)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="metric">{shown ? `${pct(shown.value)}%` : (centerValue ?? format(total))}</div>
            <div className="mt-0.5 max-w-24 truncate text-xs text-ink-3">{shown ? shown.label : (centerLabel ?? "Total")}</div>
          </div>
        </div>
      </div>
      <ul className="flex w-full min-w-0 flex-col gap-0.5">
        {segments.map((s, i) => (
          <li key={s.label}>
            <button
              type="button"
              className={cn("flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-ui transition-colors hover:bg-surface-2 focus-visible:bg-surface-2", hover === i && "bg-surface-2")}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
            >
              <span aria-hidden="true" className="size-2.5 shrink-0 rounded-[3px]" style={{ background: colors[i] }} />
              {s.icon ? <span aria-hidden="true" className="inline-flex">{s.icon}</span> : null}
              <span className="min-w-0 flex-1 truncate text-ink-2">{s.label}</span>
              <span className="font-medium tabular-nums text-ink">{format(s.value)}</span>
              <span className="w-10 text-right tabular-nums text-ink-3">{pct(s.value)}%</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
  if (bare) return chart;
  return (
    <ChartFrame {...frame} table={table}>
      {chart}
    </ChartFrame>
  );
}

/* ------------------------------------------------------------------------- */
/* FunnelChart                                                                */
/* ------------------------------------------------------------------------- */

export interface FunnelStep {
  label: string;
  value: number;
  icon?: ReactNode;
}

export interface FunnelChartProps extends FrameProps {
  steps: FunnelStep[];
  format?: (n: number) => string;
  bare?: boolean;
}

/** Horizontal funnel with step-to-step conversion (e.g. prospects → booked calls). */
export function FunnelChart({ steps, format = formatNumber, bare, ...frame }: FunnelChartProps) {
  const top = Math.max(1, steps[0]?.value ?? 1);
  const rate = (a: number, b: number) => (a ? `${Math.round((b / a) * 1000) / 10}%` : "—");
  const table: ChartTable = {
    columns: ["Step", "Count", "From previous", "From start"],
    rows: steps.map((s, i) => [s.label, format(s.value), i ? rate(steps[i - 1].value, s.value) : "—", rate(top, s.value)]),
  };
  const chart = (
    <ol className="flex flex-col gap-1.5">
      {steps.map((s, i) => {
        const w = Math.max(2, (s.value / top) * 100);
        return (
          <li key={s.label} className="group">
            {i > 0 ? (
              <div aria-hidden="true" className="flex items-center gap-1.5 py-0.5 pl-3 text-2xs text-ink-3">
                <span className="h-3 w-px bg-line-strong" />
                {rate(steps[i - 1].value, s.value)} continue
              </div>
            ) : null}
            <Tooltip content={`${s.label}: ${format(s.value)} (${rate(top, s.value)} of ${steps[0].label.toLowerCase()})`}>
              <div tabIndex={0} className="relative flex h-9 items-center overflow-hidden rounded-lg bg-surface-2 outline-offset-2">
                <div className="absolute inset-y-0 left-0 rounded-lg bg-brand-100 transition-colors group-hover:bg-brand-200" style={{ width: `${w}%` }} />
                <div className="relative flex w-full items-center justify-between gap-3 px-3 text-ui">
                  <span className="flex min-w-0 items-center gap-2 font-medium text-ink">
                    {s.icon ? <span aria-hidden="true" className="inline-flex text-brand-800 [&_svg]:size-4">{s.icon}</span> : null}
                    <span className="truncate">{s.label}</span>
                  </span>
                  <span className="font-semibold tabular-nums text-ink">{format(s.value)}</span>
                </div>
              </div>
            </Tooltip>
          </li>
        );
      })}
    </ol>
  );
  if (bare) return chart;
  return (
    <ChartFrame {...frame} table={table}>
      {chart}
    </ChartFrame>
  );
}

/* ------------------------------------------------------------------------- */
/* BarList: ranked horizontal bars (top channels, posts, pages)               */
/* ------------------------------------------------------------------------- */

export interface BarListItem {
  label: string;
  value: number;
  icon?: ReactNode;
  /** Secondary text under the label, e.g. "LinkedIn · Tue". */
  meta?: string;
}

export function BarList({ items, format = formatNumber, valueLabel = "Value", bare, ...frame }: FrameProps & { items: BarListItem[]; format?: (n: number) => string; valueLabel?: string; bare?: boolean }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const table: ChartTable = { columns: ["Item", valueLabel], rows: items.map((i) => [i.label, format(i.value)]) };
  const chart = (
    <ul className="flex flex-col gap-1">
      {items.map((it) => (
        <li key={it.label} className="group flex items-center gap-3">
          <div className="relative min-w-0 flex-1">
            <div aria-hidden="true" className="absolute inset-y-0 left-0 rounded-md bg-brand-50 transition-colors group-hover:bg-brand-100" style={{ width: `${Math.max(3, (it.value / max) * 100)}%` }} />
            <div className="relative flex min-h-8 items-center gap-2 px-2 py-1 text-ui">
              {it.icon ? <span aria-hidden="true" className="inline-flex">{it.icon}</span> : null}
              <span className="min-w-0">
                <span className="block truncate text-ink">{it.label}</span>
                {it.meta ? <span className="block truncate text-xs text-ink-3">{it.meta}</span> : null}
              </span>
            </div>
          </div>
          <span className="w-14 shrink-0 text-right text-ui font-medium tabular-nums text-ink">{format(it.value)}</span>
        </li>
      ))}
    </ul>
  );
  if (bare) return chart;
  return (
    <ChartFrame {...frame} table={table}>
      {chart}
    </ChartFrame>
  );
}

/* ------------------------------------------------------------------------- */
/* Heatmap: e.g. engagement by weekday × hour                                 */
/* ------------------------------------------------------------------------- */

export interface HeatmapProps extends FrameProps {
  rows: string[];
  columns: string[];
  /** values[row][col] */
  values: number[][];
  format?: (n: number) => string;
  bare?: boolean;
}

export function Heatmap({ rows, columns, values, format = formatNumber, bare, ...frame }: HeatmapProps) {
  const max = Math.max(1, ...values.flat());
  const table: ChartTable = { columns: ["", ...columns], rows: rows.map((r, ri) => [r, ...columns.map((_, ci) => format(values[ri]?.[ci] ?? 0))]) };
  const chart = (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-1 text-2xs">
        <thead>
          <tr>
            <th className="w-10" />
            {columns.map((c) => (
              <th key={c} scope="col" className="font-normal text-ink-3">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={r}>
              <th scope="row" className="pr-1 text-left font-normal text-ink-3">
                {r}
              </th>
              {columns.map((c, ci) => {
                const v = values[ri]?.[ci] ?? 0;
                const k = v / max;
                return (
                  <td key={c} className="p-0">
                    <Tooltip content={`${r} ${c}: ${format(v)}`}>
                      <div
                        role="img"
                        tabIndex={0}
                        aria-label={`${r} ${c}: ${format(v)}`}
                        className="h-6 min-w-6 rounded-[4px] outline-offset-1 transition-transform hover:scale-110"
                        style={{ background: k === 0 ? "var(--surface-2)" : `color-mix(in srgb, var(--chart-1) ${Math.round(12 + k * 88)}%, white)` }}
                      />
                    </Tooltip>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div aria-hidden="true" className="mt-2 flex items-center justify-end gap-1.5 text-2xs text-ink-3">
        Less
        {[0.12, 0.35, 0.6, 0.85, 1].map((k) => (
          <span key={k} className="size-3 rounded-[3px]" style={{ background: `color-mix(in srgb, var(--chart-1) ${Math.round(k * 100)}%, white)` }} />
        ))}
        More
      </div>
    </div>
  );
  if (bare) return chart;
  return (
    <ChartFrame {...frame} table={table}>
      {chart}
    </ChartFrame>
  );
}

/* ------------------------------------------------------------------------- */
/* ProgressRing                                                               */
/* ------------------------------------------------------------------------- */

export function ProgressRing({ value, size = 44, label, color = "var(--chart-1)", children }: { value: number; size?: number; label: string; color?: string; children?: ReactNode }) {
  const v = Math.min(1, Math.max(0, value));
  const r = 42;
  const c = 2 * Math.PI * r;
  return (
    <div role="img" aria-label={`${label}: ${Math.round(v * 100)}%`} className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="10" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${v * c} ${c}`} />
      </svg>
      <span className="relative text-2xs font-semibold tabular-nums text-ink">{children ?? `${Math.round(v * 100)}%`}</span>
    </div>
  );
}
