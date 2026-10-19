"use client";

/*
 * Point charts (Signal).
 * - ScatterPlot: two measures per item, coloured by group, with an optional dashed trend line.
 * - BubbleChart: the same plot with a third measure as bubble area.
 * Points are HTML dots over a dashed grid so they stay round at any width; arrows move
 * through points left to right.
 */
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { fmt, r2, useEntered } from "@/components/analytics/shared";
import { PALETTE, Plot, XTicks, compact, niceScale, useKeyNav, type ChartTip, SrTable } from "./core";
import { ChartLegend } from "./controls";

export interface PointGroup {
  key: string;
  label: string;
  color?: string;
}

export interface ChartPoint {
  label: string;
  x: number;
  y: number;
  /** Bubble charts only. */
  size?: number;
  group?: string;
}

interface AxisFormat {
  xLabel: string;
  yLabel: string;
  sizeLabel?: string;
  formatX?: (n: number) => string;
  formatY?: (n: number) => string;
  formatSize?: (n: number) => string;
}

function PointPlot({ points, groups = [], label, height = 240, trend, bubbles, xLabel, yLabel, sizeLabel = "Size", formatX = fmt, formatY = fmt, formatSize = fmt }: { points: ChartPoint[]; groups?: PointGroup[]; label: string; height?: number; trend?: boolean; bubbles?: boolean } & AxisFormat) {
  const { ref, entered } = useEntered<HTMLDivElement>();
  const ordered = useMemo(() => [...points].sort((a, b) => a.x - b.x || a.y - b.y), [points]);
  const xs = niceScale(Math.max(...points.map((p) => p.x)));
  const ys = niceScale(Math.max(...points.map((p) => p.y)));
  const smax = Math.max(...points.map((p) => p.size ?? 0), 1);
  const color = (g?: string) => {
    const i = groups.findIndex((x) => x.key === g);
    return i < 0 ? PALETTE[0] : (groups[i].color ?? PALETTE[i % PALETTE.length]);
  };
  const px = (v: number) => r2((v / xs.max) * 100);
  const py = (v: number) => r2(100 - (v / ys.max) * 100);
  const radius = (s = 0) => r2(6 + 20 * Math.sqrt(s / smax));
  const nav = useKeyNav(ordered.length);
  const a = nav.active;
  // least-squares line through the points
  const line = useMemo(() => {
    if (!trend || points.length < 2) return null;
    const n = points.length;
    const mx = points.reduce((s, p) => s + p.x, 0) / n;
    const my = points.reduce((s, p) => s + p.y, 0) / n;
    const k = points.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0) / (points.reduce((s, p) => s + (p.x - mx) ** 2, 0) || 1);
    return { k, b: my - k * mx };
  }, [points, trend]);
  const tip: ChartTip | null =
    a === null
      ? null
      : {
          x: px(ordered[a].x),
          y: py(ordered[a].y) - (bubbles ? (radius(ordered[a].size) / height) * 100 : 2),
          title: ordered[a].label,
          rows: [
            { label: xLabel, value: formatX(ordered[a].x) },
            { label: yLabel, value: formatY(ordered[a].y) },
            ...(bubbles ? [{ label: sizeLabel, value: formatSize(ordered[a].size ?? 0) }] : []),
          ],
          note: groups.find((g) => g.key === ordered[a].group)?.label,
        };
  return (
    <div ref={ref} className="flex flex-col gap-3">
      <div className="relative">
        <span aria-hidden className="absolute -top-5 left-0 text-2xs text-ink-3">{yLabel}</span>
        <Plot
          className="pt-5"
          height={height}
          scale={ys}
          yFormat={(n) => compact(n)}
          label={`${label}. Arrow keys read each point from left to right.`}
          nav={nav}
          tip={tip}
          xLabels={
            <div>
              <XTicks ticks={xs.ticks} at={(t) => (t / xs.max) * 100} format={(n) => compact(n)} />
              <p aria-hidden className="mt-0.5 text-right text-2xs text-ink-3">{xLabel}</p>
            </div>
          }
        >
          {xs.ticks.slice(1, -1).map((t) => (
            <span key={t} aria-hidden className="absolute inset-y-0 border-l border-dashed border-line" style={{ left: `${(t / xs.max) * 100}%` }} />
          ))}
          {line ? (
            <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full overflow-visible">
              <line
                x1={0}
                y1={py(Math.max(0, line.b))}
                x2={100}
                y2={py(Math.max(0, line.k * xs.max + line.b))}
                stroke="var(--ink)"
                strokeOpacity={0.45}
                strokeWidth={1.5}
                strokeDasharray="5 4"
                vectorEffect="non-scaling-stroke"
                style={{ opacity: entered ? 1 : 0, transition: "opacity .6s .5s" }}
              />
            </svg>
          ) : null}
          {ordered.map((p, i) => {
            const on = a === i;
            const d = bubbles ? radius(p.size) * 2 : on ? 12 : 10;
            return (
              <span
                key={`${p.label}-${i}`}
                onMouseEnter={() => nav.setActive(i)}
                className={cn("absolute -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 transition-[opacity,transform,width,height] duration-500", entered ? "scale-100" : "scale-0", a !== null && !on && "opacity-45", on ? "z-10 ring-ink" : "ring-surface")}
                style={{ left: `${px(p.x)}%`, top: `${py(p.y)}%`, width: d, height: d, background: color(p.group), opacity: bubbles && !on && a === null ? 0.85 : undefined, transitionDelay: entered && a === null ? `${i * 25}ms` : "0ms" }}
              />
            );
          })}
        </Plot>
      </div>
      {groups.length > 1 ? <ChartLegend label="Groups" items={groups.map((g) => ({ key: g.key, label: g.label, color: color(g.key), shape: "dot" }))} /> : null}
      <SrTable caption={label} columns={["Item", xLabel, yLabel, ...(bubbles ? [sizeLabel] : []), ...(groups.length ? ["Group"] : [])]} rows={ordered.map((p) => [p.label, p.x, p.y, ...(bubbles ? [p.size ?? 0] : []), ...(groups.length ? [groups.find((g) => g.key === p.group)?.label ?? ""] : [])])} />
    </div>
  );
}

export function ScatterPlot(props: { points: ChartPoint[]; groups?: PointGroup[]; label: string; height?: number; trend?: boolean } & AxisFormat) {
  return <PointPlot {...props} />;
}

export function BubbleChart(props: { points: ChartPoint[]; groups?: PointGroup[]; label: string; height?: number } & AxisFormat) {
  return <PointPlot {...props} bubbles />;
}
