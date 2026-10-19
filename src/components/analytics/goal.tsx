"use client";

/*
 * Goal visuals: where you were, where you are, where you're going.
 * - TargetCapsules: nested capsules on one axis (past / now / target).
 * - BubbleTimeline: circles sized by value along a line, current highlighted.
 * - GoalStaircase: bars stepping toward a goal line; the current bar is lit.
 * - TickGauge: a half-dial of ticks filled to the score.
 */
import { useState } from "react";
import { cn } from "@/lib/utils";
import { DataTable, TipLayer, fmt, r2, useEntered, type Tip } from "./shared";

/* ---------------- Target capsules ---------------- */

export function TargetCapsules({ past, current, target, pastLabel = "30 days ago", unit = "" }: { past: number; current: number; target: number; pastLabel?: string; unit?: string }) {
  const { ref, entered } = useEntered<HTMLDivElement>();
  const max = Math.max(target, current, past) || 1;
  const w = (v: number) => `${Math.max(18, (v / max) * 100)}%`;
  const ring = (cls: string, width: string, h: string, delay: number) => (
    <div className={cn("absolute left-0 top-1/2 -translate-y-1/2 rounded-[var(--radius-cta)] transition-[width] duration-700", cls)} style={{ width: entered ? width : "18%", height: h, transitionDelay: `${delay}ms` }} />
  );
  const gap = target - current;
  return (
    <div ref={ref} className="relative h-44" role="img" aria-label={`${fmt(current)}${unit} now against a target of ${fmt(target)}${unit}; ${pastLabel} ${fmt(past)}${unit}`}>
      {ring("bg-cream", w(target), "100%", 0)}
      {ring("bg-[#d8ccab]", w(current), "72%", 120)}
      {ring("bg-lime", w(past), "44%", 240)}
      <div className="absolute inset-x-0 top-1/2 h-px bg-ink/25" aria-hidden />
      <Label left={w(past)} value={past} sub={pastLabel} unit={unit} small />
      <Label left={w(current)} value={current} sub="Now" unit={unit} />
      <Label left={w(target)} value={target} sub={gap > 0 ? `Target · ${fmt(gap)} to go` : "Target · reached"} unit={unit} big />
      <DataTable caption="Progress to target" columns={["Point", "Value"]} rows={[[pastLabel, past], ["Now", current], ["Target", target]]} />
    </div>
  );
}

function Label({ left, value, sub, unit, small, big }: { left: string; value: number; sub: string; unit: string; small?: boolean; big?: boolean }) {
  return (
    <div className="absolute top-1/2 -translate-x-[calc(100%+14px)] -translate-y-1/2 text-right" style={{ left }} aria-hidden>
      <p className={cn("font-semibold tabular-nums leading-none tracking-[-0.02em]", big ? "text-[28px]" : small ? "text-base" : "text-xl")}>{fmt(value)}{unit}</p>
      <p className="mt-1 whitespace-nowrap text-xs text-ink-2">{sub}</p>
    </div>
  );
}

/* ---------------- Bubble timeline ---------------- */

export interface Bubble {
  label: string;
  value: number;
  note?: string;
  highlight?: boolean;
}

export function BubbleTimeline({ items, unit = "" }: { items: Bubble[]; unit?: string }) {
  const { ref, entered } = useEntered<HTMLDivElement>();
  const max = Math.max(...items.map((i) => i.value)) || 1;
  // Sizes are shares of the row width, so the timeline always fits its card.
  const rel = items.map((i) => 0.38 + 0.62 * Math.sqrt(i.value / max));
  const sum = rel.reduce((a, b) => a + b, 0);
  const pct = rel.map((r) => (r / sum) * 100);
  return (
    <div ref={ref} className="relative @container" role="img" aria-label={items.map((i) => `${i.label} ${fmt(i.value)}${unit}`).join(", ")}>
      <div className="relative flex items-center">
        <div className="absolute inset-x-0 top-1/2 h-px bg-ink/25" aria-hidden />
        {items.map((b, i) => (
          <div key={b.label} className="relative flex justify-center" style={{ width: `${pct[i]}%` }}>
            <div
              className={cn(
                "grid aspect-square w-[94%] place-items-center rounded-full text-center transition-transform duration-500",
                b.highlight ? "bg-lime text-ink" : i === items.length - 1 ? "bg-sage-ink text-white" : i % 2 ? "bg-surface text-ink ring-1 ring-line" : "bg-[#bfb59a] text-ink",
                entered ? "scale-100" : "scale-50",
              )}
              style={{ transitionDelay: `${i * 90}ms` }}
            >
              <span>
                <span className={cn("block font-semibold tabular-nums tracking-[-0.02em]", rel[i] > 0.85 ? "text-[clamp(18px,7cqw,30px)]" : "text-[clamp(13px,4.5cqw,20px)]")}>{fmt(b.value)}{unit}</span>
                {b.note ? <span className="block text-2xs font-medium">{b.note}</span> : null}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex">
        {items.map((b, i) => (
          <span key={b.label} className="text-center text-xs text-ink-2" style={{ width: `${pct[i]}%` }}>{b.label}</span>
        ))}
      </div>
      <DataTable caption="Values over time" columns={["Point", "Value"]} rows={items.map((b) => [b.label, b.value])} />
    </div>
  );
}

/* ---------------- Goal staircase ---------------- */

export function GoalStaircase({ values, goal, currentIndex, labels, unit = "" }: { values: number[]; goal: number; currentIndex: number; labels?: string[]; unit?: string }) {
  const { ref, entered } = useEntered<HTMLDivElement>();
  const [tip, setTip] = useState<Tip | null>(null);
  const max = Math.max(goal * 1.15, ...values);
  const gy = 100 - (goal / max) * 100;
  return (
    <div ref={ref} className="relative">
      <div className="relative flex h-40 items-end gap-1" role="img" aria-label={`Now ${fmt(values[currentIndex])}${unit}; goal ${fmt(goal)}${unit}`}>
        {values.map((v, i) => {
          const past = i < currentIndex;
          const cur = i === currentIndex;
          return (
            <div
              key={i}
              tabIndex={0}
              className="relative flex-1 outline-none"
              style={{ height: "100%" }}
              onMouseEnter={() => setTip({ x: ((i + 0.5) / values.length) * 100, y: 100 - (v / max) * 100, title: `${fmt(v)}${unit}`, lines: labels?.[i] ? [labels[i]] : undefined })}
              onMouseLeave={() => setTip(null)}
              onFocus={() => setTip({ x: ((i + 0.5) / values.length) * 100, y: 100 - (v / max) * 100, title: `${fmt(v)}${unit}`, lines: labels?.[i] ? [labels[i]] : undefined })}
              onBlur={() => setTip(null)}
            >
              {cur ? <div className="absolute inset-x-0 bottom-0 top-0 bg-ink/[0.04]" aria-hidden /> : null}
              <div
                className={cn("absolute inset-x-0 bottom-0 rounded-t-[2px] transition-[height] duration-500", cur ? "bg-ink" : past ? "bg-sage" : "bg-surface-3")}
                style={{ height: entered ? `${(v / max) * 100}%` : "0%", transitionDelay: `${i * 30}ms` }}
              />
            </div>
          );
        })}
        <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-ink/60" style={{ top: `${gy}%` }} aria-hidden>
          <span className="absolute -top-3 right-0 rounded-[var(--radius-badge)] bg-ink px-1.5 py-0.5 text-2xs font-medium text-white">Goal: {fmt(goal)}{unit}</span>
        </div>
      </div>
      <TipLayer tip={tip} />
      <DataTable caption="Progress to goal" columns={["Period", "Value"]} rows={values.map((v, i) => [labels?.[i] ?? `#${i + 1}`, v])} />
    </div>
  );
}

/* ---------------- Tick gauge ---------------- */

export function TickGauge({ value, max = 100, label, caption }: { value: number; max?: number; label?: string; caption?: string }) {
  const { ref, entered } = useEntered<HTMLDivElement>();
  const n = 41;
  const filled = Math.round((value / max) * (n - 1));
  return (
    <div ref={ref} className="relative mx-auto w-full max-w-sm">
      <svg viewBox="0 0 240 140" className="w-full" role="img" aria-label={`${label ?? "Score"} ${value} out of ${max}`}>
        {Array.from({ length: n }, (_, i) => {
          const a = Math.PI + (i / (n - 1)) * Math.PI;
          const x1 = r2(120 + Math.cos(a) * 88);
          const y1 = r2(122 + Math.sin(a) * 88);
          const x2 = r2(120 + Math.cos(a) * 108);
          const y2 = r2(122 + Math.sin(a) * 108);
          const on = i <= filled;
          return (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={on ? "var(--brand-700)" : "var(--surface-3)"} strokeWidth={4} strokeLinecap="butt" style={{ opacity: entered || !on ? 1 : 0, transition: `opacity .25s ${i * 18}ms` }} />
          );
        })}
        <text x={120} y={112} textAnchor="middle" fontSize={46} fontWeight={400} fill="var(--ink)" letterSpacing={-1.5} style={{ fontFamily: "var(--font-hero-num)" }}>{value}</text>
        <text x={152} y={112} fontSize={14} fill="var(--ink-3)">/ {max}</text>
        <text x={14} y={136} fontSize={11} fill="var(--ink-3)">0</text>
        <text x={226} y={136} fontSize={11} fill="var(--ink-3)" textAnchor="end">{max}</text>
      </svg>
      {caption ? <p className="text-voice text-center">{caption}</p> : null}
    </div>
  );
}
