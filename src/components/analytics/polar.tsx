"use client";

/*
 * Shape views.
 * - PolarRose: one wedge per factor, radius = score; dashed rings, value chips at
 *   each wedge edge, labels outside (reference: player radar).
 * - SegmentStrip: a horizontal strip of segments whose shade encodes a state over
 *   time (reference: sleep stages), with totals below.
 * - TickMeter: a row of thin ticks filled to a level (reference: stress level).
 */
import { useState } from "react";
import { cn } from "@/lib/utils";
import { DataTable, TipLayer, r2, useEntered, type Tip } from "./shared";

export function PolarRose({ factors, max = 5, label }: { factors: { label: string; value: number }[]; max?: number; label: string }) {
  const { ref, entered } = useEntered<HTMLDivElement>();
  const [tip, setTip] = useState<Tip | null>(null);
  const C = 160;
  const R0 = 14;
  const R = 112;
  const n = factors.length;
  const step = (Math.PI * 2) / n;
  const wedge = (i: number, r: number) => {
    const a0 = -Math.PI / 2 + i * step + 0.015;
    const a1 = a0 + step - 0.03;
    const p = (a: number, rr: number) => `${(C + Math.cos(a) * rr).toFixed(1)} ${(C + Math.sin(a) * rr).toFixed(1)}`;
    return `M${p(a0, R0)} L${p(a0, r)} A${r} ${r} 0 0 1 ${p(a1, r)} L${p(a1, R0)} A${R0} ${R0} 0 0 0 ${p(a0, R0)}Z`;
  };
  return (
    <div ref={ref} className="relative mx-auto w-full max-w-md">
      <svg viewBox="0 0 320 320" className="w-full overflow-visible" role="img" aria-label={`${label}: ${factors.map((f) => `${f.label} ${f.value}`).join(", ")}`}>
        {[0.25, 0.5, 0.75, 1].map((t) => (
          <circle key={t} cx={C} cy={C} r={R0 + (R - R0) * t} fill="none" stroke="var(--line-strong)" strokeDasharray="3 4" />
        ))}
        {factors.map((_, i) => {
          const a = -Math.PI / 2 + i * step;
          return <line key={i} x1={r2(C + Math.cos(a) * R0)} y1={r2(C + Math.sin(a) * R0)} x2={r2(C + Math.cos(a) * (R + 10))} y2={r2(C + Math.sin(a) * (R + 10))} stroke="var(--line-strong)" strokeDasharray="2 4" />;
        })}
        {factors.map((f, i) => {
          const r = R0 + (R - R0) * (f.value / max);
          const mid = -Math.PI / 2 + (i + 0.5) * step;
          const show = () => setTip({ x: ((C + Math.cos(mid) * r * 0.7) / 320) * 100, y: ((C + Math.sin(mid) * r * 0.7) / 320) * 100, title: f.label, lines: [`${f.value} / ${max}`] });
          return (
            <path
              key={f.label}
              d={wedge(i, r)}
              fill={f.value >= max * 0.8 ? "var(--ink)" : "var(--brand-700)"}
              stroke="var(--surface)"
              strokeWidth={1.5}
              tabIndex={0}
              className="outline-none"
              style={{ transform: entered ? "scale(1)" : "scale(0.15)", transformOrigin: `${C}px ${C}px`, transition: `transform .7s cubic-bezier(.2,.7,.2,1) ${i * 60}ms` }}
              onMouseEnter={show}
              onMouseLeave={() => setTip(null)}
              onFocus={show}
              onBlur={() => setTip(null)}
            />
          );
        })}
        {factors.map((f, i) => {
          const mid = -Math.PI / 2 + (i + 0.5) * step;
          const r = R0 + (R - R0) * (f.value / max);
          const lx = r2(C + Math.cos(mid) * (R + 30));
          const ly = r2(C + Math.sin(mid) * (R + 30));
          const vx = r2(C + Math.cos(mid) * Math.max(r - 12, R0 + 14));
          const vy = r2(C + Math.sin(mid) * Math.max(r - 12, R0 + 14));
          return (
            <g key={`l${f.label}`} aria-hidden>
              <rect x={vx - 14} y={vy - 9} width={28} height={18} rx={3} fill="var(--lime)" />
              <text x={vx} y={vy + 1} fontSize={11} fontWeight={600} textAnchor="middle" dominantBaseline="middle" fill="var(--ink)">{f.value}</text>
              <text x={lx} y={ly} fontSize={11} textAnchor="middle" dominantBaseline="middle" fill="var(--ink-2)">{f.label}</text>
            </g>
          );
        })}
      </svg>
      <TipLayer tip={tip} />
      <DataTable caption={label} columns={["Factor", "Score"]} rows={factors.map((f) => [f.label, `${f.value} / ${max}`])} />
    </div>
  );
}

export interface Segment {
  /** Relative length. */
  size: number;
  state: number;
}

export function SegmentStrip({ segments, states, start, end, label }: { segments: Segment[]; states: { label: string; className: string; total: string }[]; start: string; end: string; label: string }) {
  const { ref, entered } = useEntered<HTMLDivElement>();
  const total = segments.reduce((s, x) => s + x.size, 0);
  return (
    <div ref={ref}>
      <div className="flex h-14 overflow-hidden rounded-[var(--radius-card)]" role="img" aria-label={`${label}: ${states.map((s) => `${s.label} ${s.total}`).join(", ")}`}>
        {segments.map((s, i) => (
          <span key={i} className={cn("h-full border-r border-surface last:border-0 transition-transform duration-500", states[s.state].className, entered ? "scale-y-100" : "scale-y-0")} style={{ width: `${(s.size / total) * 100}%`, transitionDelay: `${i * 15}ms` }} />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-ink-3"><span>{start}</span><span>{end}</span></div>
      <div className="mt-3 grid grid-cols-3 gap-3">
        {states.map((s) => (
          <div key={s.label}>
            <p className="text-xl font-semibold tabular-nums tracking-[-0.02em]">{s.total}</p>
            <p className="flex items-center gap-1.5 text-xs text-ink-2"><span className={cn("h-1.5 w-3 rounded-[1px]", s.className)} />{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TickMeter({ value, ticks = 28, label, level }: { value: number; ticks?: number; label: string; level: string }) {
  const { ref, entered } = useEntered<HTMLDivElement>();
  const on = Math.round(value * ticks);
  return (
    <div ref={ref}>
      <p className="text-2xl font-semibold tracking-[-0.02em]">{level}</p>
      <div className="mt-2 flex h-10 items-stretch gap-[3px]" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
        {Array.from({ length: ticks }, (_, i) => (
          <span key={i} className={cn("flex-1 rounded-[1px] transition-colors duration-300", i < on && entered ? (i >= on - 2 ? "bg-chart-4" : "bg-brand-700") : "bg-surface-3")} style={{ transitionDelay: `${i * 18}ms` }} />
        ))}
      </div>
      <p className="mt-2 flex justify-between text-xs text-ink-2"><span>{label}</span><span className="font-medium tabular-nums text-ink">{Math.round(value * 100)}%</span></p>
    </div>
  );
}
