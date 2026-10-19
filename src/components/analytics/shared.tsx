"use client";

/*
 * Shared pieces for ClimbOS analytics (Signal): a hover/focus tooltip, a hidden
 * data table for screen readers, a one-shot entry flag for gentle draw-in motion
 * (CSS transitions; the global reduced-motion rule turns them off) and the card frame.
 * Flat colour only: no gradients, no patterns beyond what encodes data.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** True after the element first scrolls into view (once). */
export function useEntered<T extends Element>() {
  const ref = useRef<T | null>(null);
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || entered) return;
    if (typeof IntersectionObserver === "undefined") {
      const id = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(id);
    }
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) {
        setEntered(true);
        io.disconnect();
      }
    }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, [entered]);
  return { ref, entered };
}

export interface Tip {
  x: number;
  y: number;
  title: string;
  lines?: string[];
}

/** Floating tooltip positioned in the chart's own box (percent coordinates). */
export function TipLayer({ tip }: { tip: Tip | null }) {
  if (!tip) return null;
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-10 min-w-28 -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-[var(--radius-control)] border border-line bg-surface px-2.5 py-2 text-xs shadow-lg"
      style={{ left: `${tip.x}%`, top: `${tip.y}%` }}
    >
      <p className="font-semibold text-ink">{tip.title}</p>
      {tip.lines?.map((l) => (
        <p key={l} className="text-ink-2">{l}</p>
      ))}
    </div>
  );
}

/** Visually hidden table so every chart's numbers are available to assistive tech. */
export function DataTable({ caption, columns, rows }: { caption: string; columns: string[]; rows: (string | number)[][] }) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>{columns.map((c) => <th key={c} scope="col">{c}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>{r.map((v, j) => (j === 0 ? <th key={j} scope="row">{v}</th> : <td key={j}>{v}</td>))}</tr>
        ))}
      </tbody>
    </table>
  );
}

/** Analytics card: title row with optional controls; `tone="ink"` for the one hero per screen. */
export function ChartCard({ title, sub, actions, tone = "white", className, children }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; tone?: "white" | "ink" | "cream"; className?: string; children: ReactNode }) {
  return (
    <section
      className={cn(
        "flex flex-col gap-4 rounded-[var(--radius-card)] p-5",
        tone === "ink" ? "bg-ink text-white" : tone === "cream" ? "bg-cream text-ink" : "border border-line bg-surface text-ink shadow-[var(--card-shadow)]",
        className,
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-base font-semibold tracking-[-0.01em]">{title}</h4>
          {sub ? <p className={cn("text-xs", tone === "ink" ? "text-white/70" : "text-ink-3")}>{sub}</p> : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </header>
      {children}
    </section>
  );
}

/** Big number with an optional change chip (reference: “186 ↑”). */
export function BigNumber({ value, unit, delta, good = true, size = "lg", onInk }: { value: string; unit?: string; delta?: string; good?: boolean; size?: "lg" | "xl"; onInk?: boolean }) {
  return (
    <div className="flex items-end gap-2">
      <span className={cn("font-semibold tabular-nums tracking-[-0.03em]", size === "xl" ? "text-[72px] leading-[72px]" : "text-[40px] leading-[44px]")}>
        {value}
        {unit ? <span className={cn("ml-1 text-base font-medium tracking-normal", onInk ? "text-white/70" : "text-ink-3")}>{unit}</span> : null}
      </span>
      {delta ? (
        <span className={cn("mb-1.5 inline-flex h-5 items-center rounded-[var(--radius-badge)] border px-1.5 text-2xs font-medium", onInk ? (good ? "border-lime/50 text-lime" : "border-red-500/60 text-red-500") : good ? "border-green-800/25 bg-green-100/60 text-green-800" : "border-red-800/25 bg-red-100/60 text-red-800")}>
          {delta}
        </span>
      ) : null}
    </div>
  );
}

export const fmt = (n: number) => n.toLocaleString("en-US");
/** Round SVG coordinates so server and browser render identical markup. */
export const r2 = (n: number) => Math.round(n * 100) / 100;
