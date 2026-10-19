"use client";

/*
 * Shared pieces for the Signal chart set (src/components/ds/charts).
 * Builds on @/components/analytics/shared (DataTable, useEntered, r2, fmt) and adds:
 * - the ordered chart palette (--chart-1 sage … --chart-6 grey = previous period),
 * - a nice axis scale, y-axis ticks and dashed gridlines,
 * - ChartTooltip: the rich hover/focus card (swatches, values, a note),
 * - useKeyNav: arrow-key reading for charts with many marks (one tab stop per chart).
 */
import { useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { DataTable, fmt } from "@/components/analytics/shared";

/**
 * Hidden data table for screen readers. Wraps the analytics DataTable in a clipped sr-only box:
 * a wide table on its own (sr-only tables still size to content) adds horizontal page scroll.
 */
export function SrTable(props: { caption: string; columns: string[]; rows: (string | number)[][] }) {
  return (
    <div className="sr-only">
      <DataTable {...props} />
    </div>
  );
}

/** Ordered palette. 1 sage, 2 ink, 3 slate, 4 clay, 5 ochre, 6 grey (previous period). */
export const CHART = {
  sage: "var(--chart-1)",
  ink: "var(--chart-2)",
  slate: "var(--chart-3)",
  clay: "var(--chart-4)",
  ochre: "var(--chart-5)",
  previous: "var(--chart-6)",
} as const;
export const PALETTE = [CHART.sage, CHART.ink, CHART.slate, CHART.clay, CHART.ochre, CHART.previous];

/** Rounded axis top and evenly spaced ticks from 0. */
export function niceScale(max: number, count = 4): { max: number; ticks: number[] } {
  if (max <= 0) return { max: 1, ticks: [0, 1] };
  const raw = max / count;
  const exp = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / exp;
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * exp;
  const top = Math.ceil(max / step) * step;
  return { max: top, ticks: Array.from({ length: Math.round(top / step) + 1 }, (_, i) => Math.round(i * step * 1000) / 1000) };
}

/** 1.2k / 34k / 1.5m. */
export function compact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
  if (a >= 10_000) return `${Math.round(n / 1000)}k`;
  if (a >= 1_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return fmt(Math.round(n * 10) / 10);
}

/** Y-axis labels for a plot of fixed height (0 at the bottom). */
export function YTicks({ ticks, max, format = compact, className }: { ticks: number[]; max: number; format?: (n: number) => string; className?: string }) {
  return (
    <div aria-hidden className={cn("relative text-right text-2xs tabular-nums text-ink-3", className)}>
      {ticks.map((t) => (
        <span key={t} className="absolute right-0 -translate-y-1/2 whitespace-nowrap" style={{ top: `${100 - (t / max) * 100}%` }}>
          {format(t)}
        </span>
      ))}
    </div>
  );
}

/** Dashed horizontal gridlines matching YTicks. */
export function GridLines({ ticks, max }: { ticks: number[]; max: number }) {
  return (
    <>
      {ticks.map((t) => (
        <span key={t} aria-hidden className={cn("absolute inset-x-0 border-t", t === 0 ? "border-line-strong" : "border-dashed border-line")} style={{ top: `${100 - (t / max) * 100}%` }} />
      ))}
    </>
  );
}

/** Show every nth x label so they never collide. */
export const every = (n: number, fit = 7) => Math.max(1, Math.ceil(n / fit));

/* ---------------- Tooltip ---------------- */

export interface TipRow {
  label: string;
  value: string;
  /** CSS colour for the swatch. */
  color?: string;
  /** Square swatch for bars/areas, round for points/lines. */
  shape?: "square" | "dot" | "line";
  strong?: boolean;
}

export interface ChartTip {
  /** Percent of the plot box. */
  x: number;
  y: number;
  title: string;
  rows?: TipRow[];
  /** Short footnote, e.g. "+12% vs last month". */
  note?: string;
}

function Swatch({ color, shape = "square" }: { color: string; shape?: TipRow["shape"] }) {
  return <span aria-hidden className={cn("shrink-0", shape === "dot" ? "size-2 rounded-full" : shape === "line" ? "h-0.5 w-3" : "size-2 rounded-[1.5px]")} style={{ background: color }} />;
}

/** The card itself; `ChartTooltip` positions it over a plot. */
export function TooltipCard({ title, rows, note, className }: Omit<ChartTip, "x" | "y"> & { className?: string }) {
  return (
    <div className={cn("min-w-36 rounded-[var(--radius-control)] border border-line bg-surface px-2.5 py-2 text-xs shadow-lg", className)}>
      <p className="font-semibold text-ink">{title}</p>
      {rows?.length ? (
        <dl className="mt-1 flex flex-col gap-0.5">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-4">
              <dt className="flex items-center gap-1.5 text-ink-2">
                {r.color ? <Swatch color={r.color} shape={r.shape} /> : null}
                {r.label}
              </dt>
              <dd className={cn("tabular-nums text-ink", r.strong ? "font-semibold" : "font-medium")}>{r.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {note ? <p className="mt-1.5 border-t border-line pt-1.5 text-2xs text-ink-3">{note}</p> : null}
    </div>
  );
}

/** Hover/focus tooltip for a relative plot box. Flips below the point near the top edge and stays inside the sides. */
export function ChartTooltip({ tip, place = "auto" }: { tip: ChartTip | null; place?: "auto" | "above" | "below" }) {
  if (!tip) return null;
  const below = place === "below" || (place === "auto" && tip.y < 22);
  return (
    <div
      role="status"
      className={cn("pointer-events-none absolute z-20 -translate-x-1/2", below ? "translate-y-3" : "-translate-y-[calc(100%+10px)]")}
      style={{ left: `${Math.min(86, Math.max(14, tip.x))}%`, top: `${tip.y}%` }}
    >
      <TooltipCard title={tip.title} rows={tip.rows} note={tip.note} />
    </div>
  );
}

/* ---------------- Keyboard reading ---------------- */

/**
 * One tab stop per chart: arrows move through marks (Up/Down move a row when `cols` < count),
 * Home/End jump, Escape clears. Pair with onMouseEnter on each mark.
 */
export function useKeyNav(count: number, cols = count) {
  const [active, setActive] = useState<number | null>(null);
  const onKeyDown = (e: KeyboardEvent) => {
    if (!count) return;
    const k = e.key;
    const vertical = cols < count;
    if (k === "Escape") {
      setActive(null);
      return;
    }
    if (!["ArrowRight", "ArrowLeft", "Home", "End", ...(vertical ? ["ArrowDown", "ArrowUp"] : [])].includes(k)) return;
    e.preventDefault();
    setActive((a) => {
      const cur = a === null || a >= count ? -1 : a;
      if (k === "ArrowRight") return Math.min(count - 1, cur + 1);
      if (k === "ArrowLeft") return cur < 0 ? count - 1 : Math.max(0, cur - 1);
      if (k === "ArrowDown") return cur < 0 ? 0 : Math.min(count - 1, cur + cols);
      if (k === "ArrowUp") return cur < 0 ? 0 : Math.max(0, cur - cols);
      return k === "Home" ? 0 : count - 1;
    });
  };
  // Ignore a stale index when the data shrinks (zoom, filters).
  const safe = active !== null && active < count ? active : null;
  return { active: safe, setActive, onKeyDown, onBlur: () => setActive(null), onMouseLeave: () => setActive(null) };
}

/** Focus ring for chart groups and marks. */
export const focusRing = "outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

/* ---------------- Plot scaffold ---------------- */

export type KeyNav = ReturnType<typeof useKeyNav>;

/** Y ticks + gridlines + a focusable plot box (one tab stop) + tooltip + x labels. */
export function Plot({
  height,
  scale,
  yFormat = compact,
  label,
  nav,
  tip,
  xLabels,
  onMouseMove,
  children,
  className,
}: {
  height: number;
  scale: { max: number; ticks: number[] };
  yFormat?: (n: number) => string;
  /** Accessible name; mention the arrow keys. */
  label: string;
  nav: KeyNav;
  tip: ChartTip | null;
  xLabels?: ReactNode;
  onMouseMove?: (ratioX: number, e: MouseEvent<HTMLDivElement>) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex" style={{ height }}>
        <YTicks ticks={scale.ticks} max={scale.max} format={yFormat} className="mr-2 w-8 shrink-0" />
        <div
          role="group"
          tabIndex={0}
          aria-label={label}
          onKeyDown={nav.onKeyDown}
          onBlur={nav.onBlur}
          onMouseLeave={nav.onMouseLeave}
          onMouseMove={
            onMouseMove
              ? (e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  onMouseMove(Math.min(1, Math.max(0, (e.clientX - r.left) / (r.width || 1))), e);
                }
              : undefined
          }
          className={cn("relative min-w-0 flex-1 rounded-[2px]", focusRing)}
        >
          <GridLines ticks={scale.ticks} max={scale.max} />
          {children}
          <ChartTooltip tip={tip} />
        </div>
      </div>
      {xLabels ? <div className="ml-10 mt-1.5">{xLabels}</div> : null}
    </div>
  );
}

/** Evenly spaced category labels under columns. */
export function XLabels({ labels, fit = 7 }: { labels: string[]; fit?: number }) {
  const k = every(labels.length, fit);
  return (
    <div aria-hidden className="flex text-2xs text-ink-3">
      {labels.map((l, i) => (
        <span key={`${l}-${i}`} className="min-w-0 flex-1 truncate text-center">{i % k === 0 ? l : ""}</span>
      ))}
    </div>
  );
}

/** Labels at positions along a continuous x axis (0..max), or at point indexes for line charts. */
export function XTicks({ ticks, at, format = compact }: { ticks: number[]; at: (t: number) => number; format?: (n: number) => string }) {
  return (
    <div aria-hidden className="relative h-4 text-2xs tabular-nums text-ink-3">
      {ticks.map((t, i) => (
        <span key={t} className={cn("absolute top-0 whitespace-nowrap", i === 0 ? "" : i === ticks.length - 1 ? "-translate-x-full" : "-translate-x-1/2")} style={{ left: `${at(t)}%` }}>
          {format(t)}
        </span>
      ))}
    </div>
  );
}

/** Labels for a line chart's points: first, last and evenly spaced ones (fewer on phones). */
export function PointLabels({ labels, fit = 6 }: { labels: string[]; fit?: number }) {
  const n = labels.length;
  const x = (i: number) => (n <= 1 ? 50 : (i / (n - 1)) * 100);
  const shows = (i: number, k: number) => i === n - 1 || (i % k === 0 && n - 1 - i >= k);
  const kWide = every(n, fit);
  const kNarrow = every(n, Math.min(fit, 3));
  return (
    <div aria-hidden className="relative h-4 text-2xs text-ink-3">
      {labels.map((l, i) => {
        const wide = shows(i, kWide);
        const narrow = shows(i, kNarrow);
        if (!wide && !narrow) return null;
        return (
          <span
            key={`${l}-${i}`}
            className={cn("absolute top-0 whitespace-nowrap", i === 0 ? "" : i === n - 1 ? "-translate-x-full" : "-translate-x-1/2", narrow ? (wide ? "" : "sm:hidden") : "hidden sm:block")}
            style={{ left: `${x(i)}%` }}
          >
            {l}
          </span>
        );
      })}
    </div>
  );
}
