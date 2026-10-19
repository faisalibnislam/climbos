"use client";

/*
 * Line family (Signal).
 * - MultiLineChart: series over time with a hover/keyboard crosshair, optional flat area under
 *   the first series, hidden series (for legend toggles) and pinned annotations.
 * - RetentionChart: cohort retention curves (0–100%) with legend toggles.
 * - RealtimeChart: a rolling window that ticks on an interval; pausable, cleaned up on unmount,
 *   starts paused under reduced motion.
 */
import { useEffect, useState, type ReactNode } from "react";
import { Pause, Play } from "@/components/icons";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { fmt, r2, useEntered } from "@/components/analytics/shared";
import { CHART, PALETTE, Plot, PointLabels, compact, niceScale, useKeyNav, type ChartTip, SrTable } from "./core";
import { ChartAnnotation, ChartLegend, useHiddenSeries } from "./controls";

export interface LineSeries {
  key: string;
  label: string;
  /** null leaves a gap (e.g. a cohort that hasn't reached that week yet). */
  values: (number | null)[];
  color?: string;
  dashed?: boolean;
  /** Flat area under this series. */
  area?: boolean;
}

export interface LineNote {
  index: number;
  /** Series key the note sits on (defaults to the first). */
  series?: string;
  text: ReactNode;
  side?: "left" | "right";
  /** Leader length in px (stagger close notes). */
  lift?: number;
}

export function MultiLineChart({ labels, series, hidden = [], format = fmt, unit = "", yMax, height = 200, label, categoryLabel = "Period", animate = true, notes = [], yFormat = compact }: { labels: string[]; series: LineSeries[]; hidden?: string[]; format?: (n: number) => string; unit?: string; yMax?: number; height?: number; label: string; categoryLabel?: string; animate?: boolean; notes?: LineNote[]; yFormat?: (n: number) => string }) {
  const { ref, entered } = useEntered<HTMLDivElement>();
  const n = labels.length;
  const all = series.map((s, i) => ({ ...s, color: s.color ?? PALETTE[i % PALETTE.length] }));
  const shown = all.filter((s) => !hidden.includes(s.key));
  const peak = Math.max(0, ...shown.flatMap((s) => s.values.filter((v): v is number => v !== null)));
  const scale = yMax ? niceScale(yMax) : niceScale(peak);
  const x = (i: number) => r2(n <= 1 ? 50 : (i / (n - 1)) * 100);
  const y = (v: number) => r2(100 - (v / scale.max) * 100);
  const path = (vals: (number | null)[]) => {
    let d = "";
    let pen = false;
    vals.forEach((v, i) => {
      if (v === null) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(i)} ${y(v)} `;
      pen = true;
    });
    return d.trim();
  };
  const areaPath = (vals: (number | null)[]) => {
    const idx = vals.map((v, i) => (v === null ? -1 : i)).filter((i) => i >= 0);
    if (idx.length < 2) return "";
    return `${path(vals)} L${x(idx[idx.length - 1])} 100 L${x(idx[0])} 100 Z`;
  };
  const nav = useKeyNav(n);
  const a = nav.active;
  const at = (s: (typeof all)[number], i: number) => s.values[i] ?? null;
  const tip: ChartTip | null =
    a === null
      ? null
      : {
          x: x(a),
          y: Math.min(...shown.map((s) => (at(s, a) === null ? 100 : y(at(s, a) as number)))),
          title: labels[a],
          rows: shown.map((s) => ({ label: s.label, value: at(s, a) === null ? "—" : `${format(at(s, a) as number)}${unit}`, color: s.color, shape: "line" as const })),
        };
  const show = !animate || entered;
  return (
    <div ref={ref}>
      <Plot height={height} scale={scale} yFormat={yFormat} label={`${label}. Arrow keys read each ${categoryLabel.toLowerCase()}.`} nav={nav} tip={tip} onMouseMove={(r) => nav.setActive(Math.round(r * (n - 1)))} xLabels={<PointLabels labels={labels} />}>
        <div className="absolute inset-0" style={{ clipPath: show ? "inset(-10px -10px -10px -10px)" : "inset(-10px 100% -10px -10px)", transition: animate ? "clip-path 1s cubic-bezier(.2,.7,.2,1)" : undefined }}>
          <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
            {shown.map((s) => (s.area ? <path key={`a-${s.key}`} d={areaPath(s.values)} fill={s.color} fillOpacity={0.09} /> : null))}
            {shown.map((s, si) => (
              <path key={s.key} d={path(s.values)} fill="none" stroke={s.color} strokeWidth={si === 0 ? 2.25 : 1.75} strokeDasharray={s.dashed ? "5 4" : undefined} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity={a !== null ? 1 : 0.95} />
            ))}
          </svg>
        </div>
        {a !== null ? <span aria-hidden className="pointer-events-none absolute inset-y-0 w-px bg-line-strong" style={{ left: `${x(a)}%` }} /> : null}
        {a !== null
          ? shown.map((s) =>
              at(s, a) === null ? null : (
                <span key={s.key} aria-hidden className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface" style={{ left: `${x(a)}%`, top: `${y(at(s, a) as number)}%`, background: s.color }} />
              ),
            )
          : null}
        {notes.map((nt) => {
          const s = shown.find((q) => q.key === (nt.series ?? shown[0]?.key)) ?? shown[0];
          const v = s ? at(s, nt.index) : null;
          if (v === null) return null;
          return (
            <ChartAnnotation key={`${nt.index}-${String(nt.series)}`} x={x(nt.index)} y={y(v)} side={nt.side ?? (x(nt.index) > 60 ? "left" : "right")} lift={nt.lift} className={cn("transition-opacity duration-500", show ? "opacity-100" : "opacity-0")}>
              {nt.text}
            </ChartAnnotation>
          );
        })}
      </Plot>
      <SrTable caption={label} columns={[categoryLabel, ...shown.map((s) => s.label)]} rows={labels.map((l, i) => [l, ...shown.map((s) => s.values[i] ?? "")])} />
    </div>
  );
}

/* ---------------- Retention ---------------- */

export interface RetentionCohort {
  label: string;
  /** Percent retained per period, starting at 100. */
  values: (number | null)[];
}

export function RetentionChart({ cohorts, periods, average, label, height = 220 }: { cohorts: RetentionCohort[]; periods: string[]; average?: number[]; label: string; height?: number }) {
  const { hidden, toggle } = useHiddenSeries();
  const colors = [CHART.sage, CHART.slate, CHART.clay, CHART.ochre, CHART.previous];
  const series: LineSeries[] = [
    ...(average ? [{ key: "avg", label: "Average", values: average, color: CHART.ink }] : []),
    ...cohorts.map((c, i) => ({ key: c.label, label: c.label, values: c.values, color: colors[i % colors.length] })),
  ];
  return (
    <div className="flex flex-col gap-3">
      <MultiLineChart labels={periods} series={series} hidden={hidden} yMax={100} format={(v) => String(Math.round(v))} unit="%" yFormat={(v) => `${v}%`} label={label} categoryLabel="Week" height={height} />
      <ChartLegend label="Cohorts" items={series.map((s) => ({ key: s.key, label: s.label, color: s.color ?? CHART.sage, shape: "line" }))} hidden={hidden} onToggle={toggle} />
    </div>
  );
}

/* ---------------- Real-time ---------------- */

const wave = (i: number) => {
  const r = Math.sin(i * 12.9898) * 43758.5453;
  return Math.round(38 + 14 * Math.sin(i / 4.5) + 9 * Math.sin(i / 1.7) + 8 * (r - Math.floor(r)));
};

export function RealtimeChart({ label = "Visitors on site", windowSize = 40, intervalMs = 1500, unit = "visitors", height = 160 }: { label?: string; windowSize?: number; intervalMs?: number; unit?: string; height?: number }) {
  const [state, setState] = useState(() => ({ tick: 0, values: Array.from({ length: windowSize }, (_, i) => wave(i)) }));
  const [paused, setPaused] = useState(false);
  // Respect reduced motion: start paused (people can still press play).
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setPaused(true);
    });
    return () => cancelAnimationFrame(id);
  }, []);
  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      setState((s) => ({ tick: s.tick + 1, values: [...s.values.slice(1), wave(s.tick + windowSize)] }));
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [paused, intervalMs, windowSize]);
  const secs = intervalMs / 1000;
  const labels = state.values.map((_, i) => {
    const ago = Math.round((windowSize - 1 - i) * secs);
    return ago === 0 ? "Now" : `${ago}s ago`;
  });
  const now = state.values[state.values.length - 1];
  const prev = state.values[state.values.length - 2];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs text-ink-3">
            <span aria-hidden className={cn("size-2 rounded-full", paused ? "bg-chart-6" : "animate-pulse bg-chart-1")} />
            {paused ? "Paused" : "Live"} · every {secs}s
          </p>
          <p className="text-kpi font-semibold leading-9 tabular-nums tracking-[-0.03em] text-ink">
            {fmt(now)} <span className="text-sm font-medium tracking-normal text-ink-3">{unit} now</span>
            <span className={cn("ml-2 text-xs font-medium tracking-normal", now >= prev ? "text-green-800" : "text-red-800")}>{now >= prev ? "+" : "−"}{Math.abs(now - prev)}</span>
          </p>
        </div>
        <Button variant="secondary" size="sm" aria-pressed={paused} onClick={() => setPaused((p) => !p)}>
          {paused ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}
          {paused ? "Resume" : "Pause"}
        </Button>
      </div>
      <MultiLineChart labels={labels} series={[{ key: "live", label, values: state.values, color: CHART.sage, area: true }]} label={`${label}, last ${Math.round(windowSize * secs)} seconds`} categoryLabel="Moment" height={height} animate={false} unit={` ${unit}`} />
    </div>
  );
}
