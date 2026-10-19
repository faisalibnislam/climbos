"use client";

/*
 * Period comparison as ghost bars (replaces line charts and sparklines in Signal).
 * Read it in one glance: the light bar behind is the previous period, the solid bar
 * is this period, the ink bar is the latest point, and its value sits in a chip.
 * - TrendBars: compact, for KPI cards.
 * - ComparisonColumns: full chart with axis, labels, legend and hover details.
 */
import { useState } from "react";
import { cn } from "@/lib/utils";
import { DataTable, TipLayer, fmt, useEntered, type Tip } from "./shared";

export function TrendBars({ values, previous, good = true, label, format = fmt }: { values: number[]; previous?: number[]; good?: boolean; label: string; format?: (n: number) => string }) {
  const { ref, entered } = useEntered<HTMLDivElement>();
  const max = Math.max(...values, ...(previous ?? [])) || 1;
  const last = values.length - 1;
  return (
    <div ref={ref} className="flex h-14 w-32 items-end gap-[3px]" role="img" aria-label={`${label}: latest ${format(values[last])}${previous ? `, previous period ${format(previous[last])}` : ""}`}>
      {values.map((v, i) => (
        <div key={i} className="relative h-full flex-1">
          {previous ? <span className="absolute inset-x-0 bottom-0 rounded-t-[1.5px] bg-surface-3" style={{ height: `${(previous[i] / max) * 100}%` }} /> : null}
          <span
            className={cn("absolute inset-x-[18%] bottom-0 rounded-t-[1.5px] transition-[height] duration-500", i === last ? (good ? "bg-ink" : "bg-red-800") : good ? "bg-brand-700" : "bg-red-500/70")}
            style={{ height: entered ? `${(v / max) * 100}%` : "0%", transitionDelay: `${i * 35}ms` }}
          />
        </div>
      ))}
    </div>
  );
}

export function ComparisonColumns({ values, previous, labels, currentLabel = "This period", previousLabel = "Previous period", unit = "", height = 220 }: { values: number[]; previous: number[]; labels: string[]; currentLabel?: string; previousLabel?: string; unit?: string; height?: number }) {
  const { ref, entered } = useEntered<HTMLDivElement>();
  const [tip, setTip] = useState<Tip | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const top = Math.max(...values, ...previous);
  const step = top > 20 ? 10 : top > 8 ? 4 : 2;
  const max = Math.ceil(top / step) * step || 1;
  const ticks = Array.from({ length: max / step + 1 }, (_, i) => max - i * step);
  const last = values.length - 1;
  const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);
  const show = (i: number) => {
    setHover(i);
    setTip({ x: ((i + 0.5) / values.length) * 100, y: 100 - (Math.max(values[i], previous[i]) / max) * 100, title: labels[i], lines: [`${currentLabel}: ${fmt(values[i])}${unit}`, `${previousLabel}: ${fmt(previous[i])}${unit}`] });
  };
  const hide = () => {
    setHover(null);
    setTip(null);
  };
  return (
    <div ref={ref}>
      <div className="grid grid-cols-[28px_1fr] gap-x-2">
        <div className="flex flex-col justify-between text-right text-2xs tabular-nums text-ink-3" style={{ height }}>
          {ticks.map((t) => <span key={t} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">{t}</span>)}
        </div>
        <div className="relative" style={{ height }} role="img" aria-label={`${currentLabel} ${fmt(sum(values))}${unit} vs ${previousLabel} ${fmt(sum(previous))}${unit}`}>
          {ticks.map((t, i) => (
            <span key={t} className="absolute inset-x-0 border-t border-dashed border-line" style={{ top: `${(i / (ticks.length - 1)) * 100}%` }} aria-hidden />
          ))}
          <div className="absolute inset-0 flex items-end gap-[3px]">
            {values.map((v, i) => (
              <div key={i} tabIndex={0} className="relative h-full flex-1 outline-none" onMouseEnter={() => show(i)} onMouseLeave={hide} onFocus={() => show(i)} onBlur={hide}>
                {hover === i ? <span className="absolute inset-0 -mx-[1.5px] bg-ink/[0.04]" aria-hidden /> : null}
                <span className="absolute inset-x-0 bottom-0 rounded-t-[2px] bg-surface-3" style={{ height: `${(previous[i] / max) * 100}%` }} />
                <span
                  className={cn("absolute inset-x-[22%] bottom-0 rounded-t-[2px] transition-[height] duration-500", i === last ? "bg-ink" : "bg-brand-700", hover !== null && hover !== i && "opacity-60")}
                  style={{ height: entered ? `${(v / max) * 100}%` : "0%", transitionDelay: `${i * 18}ms` }}
                />
                {i === last ? (
                  <span className="absolute left-1/2 -translate-x-1/2 -translate-y-[calc(100%+6px)] whitespace-nowrap rounded-[var(--radius-badge)] bg-ink px-1.5 py-0.5 text-2xs font-medium text-white" style={{ bottom: `${(v / max) * 100}%` }}>
                    {fmt(v)}{unit}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
          <TipLayer tip={tip} />
        </div>
        <span />
        <div className="mt-2 flex justify-between text-xs text-ink-3">
          {labels.filter((_, i) => i % Math.ceil(labels.length / 8) === 0).map((l) => <span key={l}>{l}</span>)}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-6 text-ui">
        <span className="flex items-center gap-2"><span className="h-3 w-2 rounded-t-[1.5px] bg-brand-700" />{currentLabel} <b className="font-medium tabular-nums">{fmt(sum(values))}</b></span>
        <span className="flex items-center gap-2 text-ink-2"><span className="h-3 w-3 rounded-t-[1.5px] bg-surface-3" />{previousLabel} <b className="font-medium tabular-nums text-ink">{fmt(sum(previous))}</b></span>
        <span className="flex items-center gap-2 text-ink-2"><span className="h-3 w-2 rounded-t-[1.5px] bg-ink" />Today</span>
      </div>
      <DataTable caption={`${currentLabel} vs ${previousLabel}`} columns={["Day", currentLabel, previousLabel]} rows={values.map((v, i) => [labels[i], v, previous[i]])} />
    </div>
  );
}
