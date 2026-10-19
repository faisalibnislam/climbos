"use client";

/*
 * Pattern views.
 * - CalendarHeat: months × days with numbered cells shaded in 6 sage steps
 *   (reference: "Every birthday"); the selected day is outlined.
 * - StripPlot: one dot per item positioned by days, stacked in its column, with
 *   bucket labels underneath and an overdue zone (reference: renewals by days remaining).
 */
import { useState } from "react";
import { cn } from "@/lib/utils";
import { DataTable, TipLayer, useEntered, type Tip } from "./shared";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS_IN = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const STEPS = ["bg-surface-2 text-ink-2", "bg-brand-100 text-ink", "bg-brand-200 text-ink", "bg-brand-300 text-ink", "bg-brand-700 text-white", "bg-brand-900 text-white"];

/** `value(month, day)` returns 0..1 (null for days that don't exist). */
export function CalendarHeat({ value, months = MONTHS.map((_, i) => i), selected, onSelect, label }: { value: (m: number, d: number) => number; months?: number[]; selected?: [number, number]; onSelect?: (m: number, d: number) => void; label: string }) {
  const { ref, entered } = useEntered<HTMLDivElement>();
  return (
    <div ref={ref} className="overflow-x-auto">
      <div className="grid min-w-[760px] gap-[3px]" role="grid" aria-label={label} style={{ gridTemplateColumns: "34px repeat(31, minmax(0, 1fr))" }}>
        {months.map((m) => (
          <div key={m} role="row" className="contents">
            <span role="rowheader" className="self-center text-2xs font-medium text-ink-3">{MONTHS[m].toUpperCase()}</span>
            {Array.from({ length: 31 }, (_, d) => {
              if (d >= DAYS_IN[m]) return <span key={d} />;
              const v = value(m, d + 1);
              const step = Math.min(STEPS.length - 1, Math.floor(v * STEPS.length));
              const sel = selected?.[0] === m && selected?.[1] === d + 1;
              return (
                <button
                  key={d}
                  type="button"
                  role="gridcell"
                  aria-label={`${MONTHS[m]} ${d + 1}: ${Math.round(v * 100)}`}
                  aria-selected={sel}
                  onClick={() => onSelect?.(m, d + 1)}
                  className={cn(
                    "grid h-6 place-items-center rounded-[2px] text-2xs tabular-nums transition-opacity duration-300",
                    STEPS[step],
                    sel && "outline-2 outline-offset-1 outline-ink",
                    entered ? "opacity-100" : "opacity-0",
                  )}
                  style={{ transitionDelay: `${(m * 31 + d) * 1.2}ms` }}
                >
                  {d + 1}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-2xs text-ink-3">
        Fewer
        {STEPS.map((c) => <span key={c} className={cn("size-3 rounded-[2px]", c.split(" ")[0])} />)}
        More
      </div>
    </div>
  );
}

export interface StripItem {
  label: string;
  days: number;
  tone: "overdue" | "soon" | "later";
  detail?: string;
}

export function StripPlot({ items, buckets, maxDays, overdueLabel = "Overdue" }: { items: StripItem[]; buckets: number[]; maxDays: number; overdueLabel?: string }) {
  const { ref, entered } = useEntered<HTMLDivElement>();
  const [tip, setTip] = useState<Tip | null>(null);
  const x = (d: number) => (Math.min(Math.max(d, 0), maxDays) / maxDays) * 100;
  const col: Record<number, number> = {};
  const placed = items
    .slice()
    .sort((a, b) => a.days - b.days)
    .map((it) => {
      const key = Math.round(x(it.days) / 2.5);
      col[key] = (col[key] ?? 0) + 1;
      return { ...it, row: col[key] - 1 };
    });
  const rows = Math.max(...Object.values(col), 1);
  const dot = { overdue: "bg-red-800", soon: "bg-sun-strong", later: "bg-ink/35" };
  return (
    <div ref={ref} className="relative">
      <div className="relative overflow-hidden rounded-[var(--radius-control)] border border-line" style={{ height: rows * 18 + 26 }}>
        {/* day grid */}
        {Array.from({ length: Math.floor(maxDays / 2) + 1 }, (_, i) => (
          <span key={i} className="absolute inset-y-0 w-px bg-line" style={{ left: `${x(i * 2)}%` }} aria-hidden />
        ))}
        <span className="absolute inset-y-0 left-0 bg-red-100/70" style={{ width: `${x(buckets[0] || 0.0001) + 1}%` }} aria-hidden />
        {buckets.slice(1).map((b) => (
          <span key={b} className="absolute inset-y-0 w-px bg-ink/40" style={{ left: `${x(b)}%` }} aria-hidden />
        ))}
        {placed.map((p, i) => (
          <button
            key={p.label + i}
            type="button"
            aria-label={`${p.label}: ${p.days} days${p.detail ? `, ${p.detail}` : ""}`}
            className={cn("absolute size-3 -translate-x-1/2 rounded-full transition-all duration-500", dot[p.tone], entered ? "opacity-100" : "translate-y-2 opacity-0")}
            style={{ left: `${x(p.days)}%`, top: 13 + p.row * 18, transitionDelay: `${i * 20}ms` }}
            onMouseEnter={() => setTip({ x: x(p.days), y: ((13 + p.row * 18) / (rows * 18 + 26)) * 100, title: p.label, lines: [`${p.days} days`, ...(p.detail ? [p.detail] : [])] })}
            onMouseLeave={() => setTip(null)}
            onFocus={() => setTip({ x: x(p.days), y: ((13 + p.row * 18) / (rows * 18 + 26)) * 100, title: p.label, lines: [`${p.days} days`, ...(p.detail ? [p.detail] : [])] })}
            onBlur={() => setTip(null)}
          />
        ))}
        <TipLayer tip={tip} />
      </div>
      <div className="relative mt-2 h-5 text-2xs text-ink-3">
        <span className="absolute left-0 top-0 rounded-[2px] bg-red-100 px-1.5 py-0.5 font-medium text-red-800">{overdueLabel}</span>
        {buckets.slice(1).map((b, i, all) => (
          <span key={b} className="absolute top-0 -translate-x-1/2 rounded-[2px] bg-surface-2 px-1.5 py-0.5 tabular-nums" style={{ left: `${x(b)}%` }}>
            {b}{i === all.length - 1 ? "+" : ""} days
          </span>
        ))}
      </div>
      <DataTable caption="Items by days" columns={["Item", "Days", "Status"]} rows={items.map((i) => [i.label, i.days, i.tone])} />
    </div>
  );
}
