"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown, Table2 } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";

/* ------------------------------------------------------------------------- */
/* ChartFrame                                                                 */
/* ------------------------------------------------------------------------- */

export interface ChartTable {
  columns: string[];
  rows: (string | number)[][];
}

export interface ChartFrameProps {
  title: ReactNode;
  /** One-sentence takeaway or what is measured. */
  description?: ReactNode;
  /** Source / freshness line, e.g. "Source: Google Analytics · updated today". */
  source?: ReactNode;
  /** Legend element shown under the chart. */
  legend?: ReactNode;
  /** Data behind the chart, always available via "View as table". */
  table: ChartTable;
  headingLevel?: "h2" | "h3" | "h4";
  children: ReactNode;
  className?: string;
}

/**
 * Wrapper for every chart: title, description, the visual, a legend, source
 * line and a "View as table" toggle exposing the same data as a real table.
 */
export function ChartFrame({ title, description, source, legend, table, headingLevel: H = "h3", children, className }: ChartFrameProps) {
  const [showTable, setShowTable] = useState(false);
  const tableId = useId();
  return (
    <figure className={cn("flex flex-col gap-3 rounded-[var(--radius-lg)] border border-line bg-surface p-4 sm:p-5", className)}>
      <figcaption className="flex flex-col gap-1">
        <H className="text-base font-semibold text-ink">{title}</H>
        {description ? <p className="text-sm leading-relaxed text-ink-2">{description}</p> : null}
      </figcaption>
      {children}
      {legend}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2">
        {source ? <p className="text-[0.8125rem] text-ink-3">{source}</p> : <span />}
        <button
          type="button"
          aria-expanded={showTable}
          aria-controls={tableId}
          onClick={() => setShowTable((v) => !v)}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-1 text-sm font-medium text-brand-800 hover:underline"
        >
          <Table2 aria-hidden="true" className="size-4" />
          {showTable ? "Hide table" : "View as table"}
          <ChevronDown aria-hidden="true" className={cn("size-4 transition-transform", showTable && "rotate-180")} />
        </button>
      </div>
      <div id={tableId} hidden={!showTable} className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">{title} — data table</caption>
          <thead>
            <tr className="border-b border-line">
              {table.columns.map((c, i) => (
                <th key={c} scope="col" className={cn("px-3 py-2 font-semibold text-ink-2", i > 0 && "text-right")}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r, ri) => (
              <tr key={ri} className="border-b border-line last:border-b-0">
                {r.map((cell, ci) =>
                  ci === 0 ? (
                    <th key={ci} scope="row" className="px-3 py-2 font-medium text-ink">
                      {cell}
                    </th>
                  ) : (
                    <td key={ci} className="px-3 py-2 text-right tabular-nums text-ink">
                      {cell}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

/* ------------------------------------------------------------------------- */
/* Shared helpers                                                             */
/* ------------------------------------------------------------------------- */

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / exp;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * exp;
}

function YAxis({ max, format }: { max: number; format: (n: number) => string }) {
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  return (
    <div aria-hidden="true" className="relative w-12 shrink-0 text-right text-[11px] tabular-nums text-ink-3">
      {ticks.map((t) => (
        <span key={t} className="absolute right-1.5 -translate-y-1/2" style={{ top: `${(1 - t) * 100}%` }}>
          {format(max * t)}
        </span>
      ))}
    </div>
  );
}

function Gridlines() {
  return (
    <>
      {[0, 25, 50, 75, 100].map((y) => (
        <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="var(--line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      ))}
    </>
  );
}

function XLabels({ labels, every = 1 }: { labels: string[]; every?: number }) {
  return (
    <div aria-hidden="true" className="ml-12 flex text-[11px] text-ink-3">
      {labels.map((l, i) => (
        <span key={`${l}-${i}`} className="min-w-0 flex-1 truncate px-0.5 pt-1.5 text-center">
          {i % every === 0 ? l : ""}
        </span>
      ))}
    </div>
  );
}

export function ChartLegend({ items }: { items: { label: string; kind: "solid" | "dashed" | "band" | "bar" | "bar-projected" }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-[0.8125rem] text-ink-2">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-2">
          <svg aria-hidden="true" width="22" height="10" viewBox="0 0 22 10">
            {it.kind === "solid" ? <line x1="0" x2="22" y1="5" y2="5" stroke="var(--brand-800)" strokeWidth="2.5" /> : null}
            {it.kind === "dashed" ? (
              <line x1="0" x2="22" y1="5" y2="5" stroke="var(--brand-700)" strokeWidth="2.5" strokeDasharray="4 3" />
            ) : null}
            {it.kind === "band" ? <rect x="0" y="1" width="22" height="8" fill="var(--brand-200)" opacity="0.7" /> : null}
            {it.kind === "bar" ? <rect x="5" y="0" width="12" height="10" rx="2" fill="var(--brand-800)" /> : null}
            {it.kind === "bar-projected" ? (
              <rect x="5.5" y="0.5" width="11" height="9" rx="2" fill="var(--brand-100)" stroke="var(--brand-700)" strokeDasharray="2.5 2" />
            ) : null}
          </svg>
          {it.label}
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------------- */
/* BarChart                                                                   */
/* ------------------------------------------------------------------------- */

export interface BarDatum {
  label: string;
  value: number;
  /** Projected values are drawn dashed + light and labelled "Projected". */
  projected?: boolean;
}

export interface BarChartProps extends Omit<ChartFrameProps, "table" | "children" | "legend"> {
  data: BarDatum[];
  /** Column header for values in the data table, e.g. "Visitors". */
  valueLabel: string;
  /** Column header for categories, e.g. "Month". */
  categoryLabel?: string;
  format?: (n: number) => string;
  /** Plot height in px. */
  height?: number;
}

/** Minimal vertical bar chart with observed vs projected styling and a data-table toggle. */
export function BarChart({ data, valueLabel, categoryLabel = "Period", format = formatNumber, height = 200, ...frame }: BarChartProps) {
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const slot = 100 / Math.max(1, data.length);
  const bw = slot * 0.62;
  const hasProjected = data.some((d) => d.projected);
  const table: ChartTable = {
    columns: [categoryLabel, valueLabel, ...(hasProjected ? ["Type"] : [])],
    rows: data.map((d) => [d.label, format(d.value), ...(hasProjected ? [d.projected ? "Projected" : "Observed"] : [])]),
  };
  return (
    <ChartFrame
      {...frame}
      table={table}
      legend={hasProjected ? <ChartLegend items={[{ label: "Observed", kind: "bar" }, { label: "Projected (estimate)", kind: "bar-projected" }]} /> : null}
    >
      <div>
        <div className="flex" style={{ height }}>
          <YAxis max={max} format={format} />
          <div className="relative flex-1">
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="absolute inset-0 size-full overflow-visible"
              role="img"
              aria-label={`Bar chart of ${valueLabel.toLowerCase()}. Use "View as table" for exact values.`}
            >
              <Gridlines />
              {data.map((d, i) => {
                const h = (d.value / max) * 100;
                const x = i * slot + (slot - bw) / 2;
                return (
                  <rect
                    key={`${d.label}-${i}`}
                    x={x}
                    y={100 - h}
                    width={bw}
                    height={h}
                    fill={d.projected ? "var(--brand-100)" : "var(--brand-800)"}
                    stroke={d.projected ? "var(--brand-700)" : "none"}
                    strokeWidth={d.projected ? 1.5 : 0}
                    strokeDasharray={d.projected ? "4 3" : undefined}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </svg>
          </div>
        </div>
        <XLabels labels={data.map((d) => (d.projected ? `${d.label}*` : d.label))} every={data.length > 8 ? 2 : 1} />
        {hasProjected ? <p className="ml-12 mt-1 text-[11px] text-ink-3">* Projected</p> : null}
      </div>
    </ChartFrame>
  );
}

/* ------------------------------------------------------------------------- */
/* LineChart                                                                  */
/* ------------------------------------------------------------------------- */

export interface LinePoint {
  x: string;
  y: number;
  /** Marks the point as a projection (dashed line). Projected points should come after observed ones. */
  projected?: boolean;
  /** Optional uncertainty range for projected points. */
  low?: number;
  high?: number;
}

export interface LineChartProps extends Omit<ChartFrameProps, "table" | "children" | "legend"> {
  points: LinePoint[];
  valueLabel: string;
  categoryLabel?: string;
  format?: (n: number) => string;
  height?: number;
}

/**
 * Minimal single-series line chart. Observed = solid line; projected = dashed
 * line with an optional shaded range, labelled "Projected" in the chart,
 * legend and data table.
 */
export function LineChart({ points, valueLabel, categoryLabel = "Period", format = formatNumber, height = 200, ...frame }: LineChartProps) {
  const max = niceMax(Math.max(0, ...points.map((p) => Math.max(p.y, p.high ?? 0))));
  const n = points.length;
  const xAt = (i: number) => (n <= 1 ? 50 : (i / (n - 1)) * 100);
  const yAt = (v: number) => 100 - (v / max) * 100;
  const firstProjected = points.findIndex((p) => p.projected);
  const observed = firstProjected === -1 ? points : points.slice(0, firstProjected);
  const projectedStart = firstProjected <= 0 ? firstProjected : firstProjected - 1;
  const projected = firstProjected === -1 ? [] : points.slice(projectedStart);
  const path = (pts: LinePoint[], offset: number) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"}${xAt(i + offset)},${yAt(p.y)}`).join(" ");

  const bandPts = projected
    .map((p, i) => ({ i: i + projectedStart, low: p.low ?? p.y, high: p.high ?? p.y }))
    .filter((p) => Number.isFinite(p.low) && Number.isFinite(p.high));
  const hasBand = points.some((p) => p.projected && (p.low !== undefined || p.high !== undefined));
  const band = hasBand
    ? [
        ...bandPts.map((p) => `${xAt(p.i)},${yAt(p.high)}`),
        ...[...bandPts].reverse().map((p) => `${xAt(p.i)},${yAt(p.low)}`),
      ].join(" ")
    : "";

  const table: ChartTable = {
    columns: [categoryLabel, valueLabel, ...(hasBand ? ["Likely range"] : []), ...(firstProjected !== -1 ? ["Type"] : [])],
    rows: points.map((p) => [
      p.x,
      format(p.y),
      ...(hasBand ? [p.low !== undefined && p.high !== undefined ? `${format(p.low)} – ${format(p.high)}` : "—"] : []),
      ...(firstProjected !== -1 ? [p.projected ? "Projected" : "Observed"] : []),
    ]),
  };

  const legendItems: { label: string; kind: "solid" | "dashed" | "band" }[] = [{ label: "Observed", kind: "solid" }];
  if (firstProjected !== -1) legendItems.push({ label: "Projected (estimate)", kind: "dashed" });
  if (hasBand) legendItems.push({ label: "Likely range", kind: "band" });

  return (
    <ChartFrame {...frame} table={table} legend={<ChartLegend items={legendItems} />}>
      <div>
        <div className="flex" style={{ height }}>
          <YAxis max={max} format={format} />
          <div className="relative flex-1">
            {firstProjected > 0 ? (
              <span
                aria-hidden="true"
                className="absolute top-0 rounded bg-surface px-1 text-[11px] font-medium text-brand-800"
                style={{ left: `calc(${xAt(firstProjected - 1)}% + 4px)` }}
              >
                Projected →
              </span>
            ) : null}
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="absolute inset-0 size-full overflow-visible"
              role="img"
              aria-label={`Line chart of ${valueLabel.toLowerCase()}${firstProjected !== -1 ? ", including projected values" : ""}. Use "View as table" for exact values.`}
            >
              <Gridlines />
              {firstProjected > 0 ? (
                <line
                  x1={xAt(firstProjected - 1)}
                  x2={xAt(firstProjected - 1)}
                  y1="0"
                  y2="100"
                  stroke="var(--line-strong)"
                  strokeDasharray="2 3"
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}
              {hasBand && band ? <polygon points={band} fill="var(--brand-200)" opacity="0.55" /> : null}
              {observed.length > 0 ? (
                <path d={path(observed, 0)} fill="none" stroke="var(--brand-800)" strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              ) : null}
              {projected.length > 0 ? (
                <path
                  d={path(projected, projectedStart)}
                  fill="none"
                  stroke="var(--brand-700)"
                  strokeWidth="2.5"
                  strokeDasharray="6 5"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}
            </svg>
            {points.map((p, i) => (
              <span
                key={`${p.x}-${i}`}
                aria-hidden="true"
                className={cn(
                  "absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2",
                  p.projected ? "border-brand-700 bg-surface" : "border-brand-800 bg-brand-800",
                )}
                style={{ left: `${xAt(i)}%`, top: `${yAt(p.y)}%` }}
              />
            ))}
          </div>
        </div>
        <div aria-hidden="true" className="relative ml-12 h-5 text-[11px] text-ink-3">
          {points.map((p, i) => {
            const every = n > 8 ? Math.ceil(n / 6) : 1;
            if (i % every !== 0 && i !== n - 1) return null;
            return (
              <span
                key={`${p.x}-${i}`}
                className={cn("absolute top-1.5 whitespace-nowrap", i === 0 ? "" : i === n - 1 ? "-translate-x-full" : "-translate-x-1/2")}
                style={{ left: `${xAt(i)}%` }}
              >
                {p.x}
              </span>
            );
          })}
        </div>
      </div>
    </ChartFrame>
  );
}
