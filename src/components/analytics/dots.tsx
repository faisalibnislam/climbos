"use client";

/*
 * Dot-matrix charts.
 * - DotBars: a KPI sparkbar where each column is a stack of dots (empty dots show headroom).
 * - DotForecast: stacked dots per period by category up to today; projected periods
 *   are faint dots, with a marker line and a projection pill.
 */
import { useState } from "react";
import { cn } from "@/lib/utils";
import { DataTable, TipLayer, fmt, useEntered, type Tip } from "./shared";

export function DotBars({ values, rows = 9, tone = "ink", label }: { values: number[]; rows?: number; tone?: "ink" | "sage" | "lime"; label: string }) {
  const { ref, entered } = useEntered<HTMLDivElement>();
  const max = Math.max(...values) || 1;
  const on = tone === "sage" ? "bg-brand-700" : tone === "lime" ? "bg-sun-strong" : "bg-ink";
  return (
    <div ref={ref} className="flex items-end gap-[3px]" role="img" aria-label={`${label}: ${values.join(", ")}`}>
      {values.map((v, i) => {
        const n = Math.round((v / max) * rows);
        return (
          <div key={i} className="flex flex-col-reverse gap-[3px]">
            {Array.from({ length: rows }, (_, r) => (
              <span
                key={r}
                className={cn("size-[5px] rounded-full transition-colors duration-300", r < n && entered ? on : "bg-surface-3")}
                style={{ transitionDelay: `${i * 25 + r * 15}ms` }}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

export interface ForecastSeries {
  label: string;
  /** Tailwind background class for the dots (flat colour). */
  dot: string;
  values: number[];
}

export function DotForecast({ series, periods, todayIndex, projected, unitPerDot, projectionLabel }: { series: ForecastSeries[]; periods: string[]; todayIndex: number; projected: number[]; unitPerDot: number; projectionLabel?: string }) {
  const { ref, entered } = useEntered<HTMLDivElement>();
  const [tip, setTip] = useState<Tip | null>(null);
  const totals = periods.map((_, i) => (i <= todayIndex ? series.reduce((s, x) => s + (x.values[i] ?? 0), 0) : projected[i - todayIndex - 1] ?? 0));
  const rows = Math.max(...totals.map((t) => Math.ceil(t / unitPerDot)), 1);
  const show = (i: number) =>
    setTip({
      x: ((i + 0.5) / periods.length) * 100,
      y: 100 - (Math.ceil(totals[i] / unitPerDot) / rows) * 100,
      title: periods[i],
      lines: i <= todayIndex ? series.map((s) => `${s.label}: ${fmt(s.values[i] ?? 0)}`) : [`Projected: ${fmt(totals[i])}`],
    });
  return (
    <div ref={ref} className="relative">
      <div className="relative flex items-end gap-[3px]" style={{ height: rows * 9 }} role="img" aria-label={`Forecast by period; today is ${periods[todayIndex]}`}>
        {periods.map((p, i) => {
          const future = i > todayIndex;
          const dots: string[] = [];
          if (future) dots.push(...Array(Math.ceil(totals[i] / unitPerDot)).fill("bg-ink/15"));
          else series.forEach((s) => dots.push(...Array(Math.round((s.values[i] ?? 0) / unitPerDot)).fill(s.dot)));
          return (
            <div key={p} tabIndex={0} className="flex flex-1 flex-col-reverse items-center gap-[3px] outline-none" onMouseEnter={() => show(i)} onMouseLeave={() => setTip(null)} onFocus={() => show(i)} onBlur={() => setTip(null)}>
              {dots.map((c, j) => (
                <span key={j} className={cn("size-[6px] rounded-full transition-opacity duration-300", c, entered ? "opacity-100" : "opacity-0")} style={{ transitionDelay: `${i * 12 + j * 6}ms` }} />
              ))}
            </div>
          );
        })}
        <div className="pointer-events-none absolute inset-y-0 w-px bg-ink" style={{ left: `${((todayIndex + 1) / periods.length) * 100}%` }} aria-hidden>
          <span className="absolute -top-1 -left-[3px] size-[7px] bg-ink" />
          {projectionLabel ? <span className="absolute -top-2 left-3 whitespace-nowrap rounded-[var(--radius-badge)] bg-surface px-2 py-0.5 text-xs text-ink-2 shadow-sm ring-1 ring-line">{projectionLabel}</span> : null}
        </div>
      </div>
      <div className="mt-3 flex justify-between text-xs text-ink-3">
        {periods.filter((_, i) => i % Math.ceil(periods.length / 6) === 0).map((p) => <span key={p}>{p}</span>)}
      </div>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-ink-2">
        {series.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5"><span className={cn("size-2 rounded-full", s.dot)} />{s.label}</span>
        ))}
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-ink/15" />Projected</span>
      </div>
      <TipLayer tip={tip} />
      <DataTable caption="Forecast" columns={["Period", ...series.map((s) => s.label), "Total"]} rows={periods.map((p, i) => [p, ...series.map((s) => (i <= todayIndex ? s.values[i] ?? 0 : "")), totals[i]])} />
    </div>
  );
}
