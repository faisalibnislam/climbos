"use client";

/*
 * Numbers and comparisons.
 * - KpiCounter: a KPI that counts up when it scrolls into view (instant under reduced motion).
 * - TrendIndicator: arrow + percent change chip; colour follows whether the change is good.
 * - ComparisonChart: dumbbell rows, previous period (grey dot) to this period (ink dot).
 */
import { useEffect, useRef, useState } from "react";
import { Minus, TrendingDown, TrendingUp } from "@/components/icons";
import { cn } from "@/lib/utils";
import { BigNumber, fmt, useEntered } from "@/components/analytics/shared";
import { CHART, ChartTooltip, focusRing, niceScale, useKeyNav, XTicks, compact, SrTable } from "./core";

/* ---------------- KPI counter ---------------- */

export function KpiCounter({ value, label, format = (n) => fmt(Math.round(n)), unit, delta, good = true, duration = 1100, hero, className }: { value: number; label: string; format?: (n: number) => string; unit?: string; delta?: string; good?: boolean; duration?: number; hero?: boolean; className?: string }) {
  const { ref, entered } = useEntered<HTMLDivElement>();
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (!entered) return;
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = from.current;
    let t0 = 0;
    let raf = 0;
    const tick = (t: number) => {
      if (!t0) t0 = t;
      const p = reduce ? 1 : Math.min(1, (t - t0) / duration);
      const v = start + (value - start) * (1 - (1 - p) ** 3);
      from.current = v;
      setShown(v);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [entered, value, duration]);
  return (
    <div ref={ref} className={cn("flex flex-col gap-1", className)}>
      <p className="text-xs text-ink-3">{label}</p>
      <div aria-hidden>
        <BigNumber value={format(shown)} unit={unit} delta={delta} good={good} hero={hero} />
      </div>
      <span className="sr-only">
        {label}: {format(value)}
        {unit ? ` ${unit}` : ""}
        {delta ? `, ${delta}` : ""}
      </span>
    </div>
  );
}

/* ---------------- Trend indicator ---------------- */

/** `value` is a percent change, e.g. 12.4 or -3. Flat within ±0.5%. */
export function TrendIndicator({ value, upIsGood = true, label, size = "md", variant = "chip", className }: { value: number; upIsGood?: boolean; label?: string; size?: "sm" | "md"; variant?: "chip" | "inline"; className?: string }) {
  const dir = Math.abs(value) < 0.5 ? "flat" : value > 0 ? "up" : "down";
  const good = dir === "flat" ? null : (dir === "up") === upIsGood;
  const Icon = dir === "up" ? TrendingUp : dir === "down" ? TrendingDown : Minus;
  const text = `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(Math.round(value * 10) / 10)}%`;
  const tone = good === null ? "text-ink-2 border-line bg-surface-2" : good ? "border-green-800/25 bg-green-100/60 text-green-800" : "border-red-800/25 bg-red-100/60 text-red-800";
  const inlineTone = good === null ? "text-ink-3" : good ? "text-green-800" : "text-red-800";
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap font-medium tabular-nums", variant === "chip" ? cn("rounded-[var(--radius-badge)] border", tone, size === "sm" ? "h-5 px-1 text-2xs" : "h-6 px-1.5 text-xs") : cn(inlineTone, size === "sm" ? "text-2xs" : "text-xs"), className)}>
      <Icon aria-hidden className={size === "sm" ? "size-3" : "size-3.5"} />
      <span className="sr-only">{dir === "up" ? "Up" : dir === "down" ? "Down" : "Flat"} </span>
      {text}
      {label ? <span className={cn("font-normal", variant === "chip" ? "opacity-80" : "text-ink-3")}>{label}</span> : null}
      {good !== null ? <span className="sr-only">{good ? " (good)" : " (needs attention)"}</span> : null}
    </span>
  );
}

/* ---------------- Comparison (dumbbell) ---------------- */

export interface CompareItem {
  label: string;
  current: number;
  previous: number;
}

export function ComparisonChart({ items, format = fmt, unit = "", currentLabel = "This month", previousLabel = "Last month", upIsGood = true, label }: { items: CompareItem[]; format?: (n: number) => string; unit?: string; currentLabel?: string; previousLabel?: string; upIsGood?: boolean; label: string }) {
  const { ref, entered } = useEntered<HTMLDivElement>();
  const nav = useKeyNav(items.length, 1);
  const scale = niceScale(Math.max(...items.flatMap((i) => [i.current, i.previous])));
  const x = (v: number) => (v / scale.max) * 100;
  const pct = (it: CompareItem) => (it.previous ? ((it.current - it.previous) / it.previous) * 100 : 0);
  return (
    <div ref={ref}>
      <div role="group" tabIndex={0} aria-label={`${label}. Arrow keys read each row.`} onKeyDown={nav.onKeyDown} onBlur={nav.onBlur} onMouseLeave={nav.onMouseLeave} className={cn("flex flex-col rounded-[2px]", focusRing)}>
        {items.map((it, i) => {
          const lo = Math.min(it.current, it.previous);
          const hi = Math.max(it.current, it.previous);
          const up = it.current >= it.previous;
          const good = up === upIsGood;
          const on = nav.active === i;
          return (
            <div key={it.label} onMouseEnter={() => nav.setActive(i)} className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 rounded-[2px] px-1 py-1 transition-opacity sm:h-[var(--cell-h)] sm:grid-cols-[minmax(0,8rem)_1fr_4.5rem] sm:py-0", nav.active !== null && !on && "opacity-55", on && "bg-ink/[0.03]")}>
              <span className="truncate text-ui text-ink">{it.label}</span>
              <div className="relative col-span-2 row-start-2 h-6 sm:col-span-1 sm:row-start-auto sm:h-full">
                <span aria-hidden className="absolute inset-x-0 top-1/2 border-t border-dashed border-line" />
                <span aria-hidden className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full transition-[left,width] duration-700" style={{ left: `${x(entered ? lo : it.previous)}%`, width: `${entered ? x(hi) - x(lo) : 0}%`, background: good ? CHART.sage : CHART.clay, transitionDelay: `${i * 60}ms` }} />
                <span aria-hidden className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface" style={{ left: `${x(it.previous)}%`, background: CHART.previous }} />
                <span aria-hidden className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface transition-[left] duration-700" style={{ left: `${x(entered ? it.current : it.previous)}%`, background: CHART.ink, transitionDelay: `${i * 60}ms` }} />
                {on ? (
                  <ChartTooltip
                    place={i < items.length / 2 ? "below" : "above"}
                    tip={{
                      x: x(it.current),
                      y: i < items.length / 2 ? 70 : 30,
                      title: it.label,
                      rows: [
                        { label: currentLabel, value: `${format(it.current)}${unit}`, color: CHART.ink, shape: "dot", strong: true },
                        { label: previousLabel, value: `${format(it.previous)}${unit}`, color: CHART.previous, shape: "dot" },
                      ],
                      note: `${up ? "+" : "−"}${format(Math.abs(it.current - it.previous))}${unit} vs ${previousLabel.toLowerCase()}`,
                    }}
                  />
                ) : null}
              </div>
              <span className="col-start-2 row-start-1 text-right sm:col-start-auto sm:row-start-auto">
                <TrendIndicator value={pct(it)} upIsGood={upIsGood} size="sm" />
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-1 grid gap-3 px-1 sm:grid-cols-[minmax(0,8rem)_1fr_4.5rem]">
        <span className="hidden sm:block" />
        <XTicks ticks={scale.ticks} at={x} format={compact} />
      </div>
      <div className="mt-3 flex flex-wrap gap-5 text-ui text-ink-2">
        <span className="flex items-center gap-2"><span aria-hidden className="size-3 rounded-full" style={{ background: CHART.ink }} />{currentLabel}</span>
        <span className="flex items-center gap-2"><span aria-hidden className="size-2.5 rounded-full" style={{ background: CHART.previous }} />{previousLabel}</span>
      </div>
      <SrTable caption={label} columns={["Item", currentLabel, previousLabel, "Change"]} rows={items.map((it) => [it.label, it.current, it.previous, `${Math.round(pct(it))}%`])} />
    </div>
  );
}
