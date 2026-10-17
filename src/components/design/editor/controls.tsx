"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { resolvePaint } from "@shared/design/ops";
import type { BrandKit, Paint } from "@shared/design/types";
import { cn } from "@/lib/utils";

/** Small, dense controls used by the editor toolbars and panels. */

export function ToolButton({ label, active, onClick, children, disabled, className }: { label: string; active?: boolean; onClick: () => void; children: ReactNode; disabled?: boolean; className?: string }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-md px-2 text-sm font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-40 [&_svg]:size-4",
        active && "bg-brand-100 text-brand-900",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Divider() {
  return <span aria-hidden="true" className="mx-1 h-6 w-px bg-line" />;
}

export function NumberField({ label, value, onChange, min, max, step = 1, suffix, width = "w-16" }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; suffix?: string; width?: string }) {
  // A draft exists only while the field is being edited; otherwise it shows the live value.
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? String(Math.round(value * 100) / 100);
  const commit = () => {
    const n = Number(text);
    if (Number.isFinite(n) && draft !== null) onChange(Math.max(min ?? -Infinity, Math.min(max ?? Infinity, n)));
    setDraft(null);
  };
  return (
    <label className="inline-flex items-center gap-1 text-xs text-ink-3">
      <span className="sr-only">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        title={label}
        value={text}
        step={step}
        min={min}
        max={max}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          e.stopPropagation();
        }}
        className={cn("h-9 rounded-md border border-line bg-surface px-2 text-sm text-ink tabular-nums focus-visible:outline-2 focus-visible:outline-brand-600", width)}
      />
      {suffix ? <span aria-hidden="true">{suffix}</span> : null}
    </label>
  );
}

export function Slider({ label, value, onChange, min, max, step = 0.01 }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number }) {
  return (
    <label className="flex items-center gap-2 text-xs font-medium text-ink-2">
      <span className="w-20 shrink-0">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[var(--brand-800)]" />
    </label>
  );
}

const PALETTE = ["#101828", "#ffffff", "#f5f6f8", "#0b5d46", "#ff9a4d", "#e5483a", "#f0a020", "#23a065", "#3d7ad6", "#7c5cd6", "#e05596", "#1c9aab"];

/** Colour picker: brand colours first (stored as brand references), then a palette and a custom colour. */
export function ColorControl({ label, value, brand, onChange }: { label: string; value: Paint; brand: BrandKit; onChange: (p: Paint) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const current = resolvePaint(value, brand);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        title={label}
        aria-label={`${label}: ${current}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line bg-surface px-1.5 hover:border-line-strong"
      >
        <span className="size-6 rounded border border-black/10" style={{ background: current }} />
      </button>
      {open ? (
        <div className="absolute left-0 top-11 z-50 w-60 rounded-lg border border-line bg-surface p-3 shadow-lg" role="dialog" aria-label={label}>
          <p className="text-xs font-semibold text-ink-2">Brand colours</p>
          <div className="mt-2 flex gap-1.5">
            {(Object.keys(brand.colors) as (keyof BrandKit["colors"])[]).map((k) => (
              <button
                key={k}
                type="button"
                title={`Brand ${k}`}
                aria-label={`Brand ${k}`}
                onClick={() => onChange(`brand:${k}`)}
                className={cn("size-8 rounded-md border border-black/10", value === `brand:${k}` && "ring-2 ring-brand-600 ring-offset-1")}
                style={{ background: brand.colors[k] }}
              />
            ))}
          </div>
          <p className="mt-3 text-xs font-semibold text-ink-2">Colours</p>
          <div className="mt-2 grid grid-cols-6 gap-1.5">
            {PALETTE.map((c) => (
              <button key={c} type="button" title={c} aria-label={c} onClick={() => onChange(c)} className={cn("size-8 rounded-md border border-black/10", value === c && "ring-2 ring-brand-600 ring-offset-1")} style={{ background: c }} />
            ))}
          </div>
          <label className="mt-3 flex items-center justify-between gap-2 text-xs font-semibold text-ink-2">
            Custom
            <input type="color" value={current.slice(0, 7)} onChange={(e) => onChange(e.target.value)} className="h-8 w-14 cursor-pointer rounded border border-line" />
          </label>
        </div>
      ) : null}
    </div>
  );
}

export function SelectField<T extends string | number>({ label, value, options, onChange, className }: { label: string; value: T; options: { value: T; label: string; style?: React.CSSProperties }[]; onChange: (v: T) => void; className?: string }) {
  return (
    <label className="inline-flex">
      <span className="sr-only">{label}</span>
      <select
        title={label}
        value={String(value)}
        onChange={(e) => {
          const o = options.find((x) => String(x.value) === e.target.value);
          if (o) onChange(o.value);
        }}
        className={cn("h-9 rounded-md border border-line bg-surface px-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-brand-600", className)}
      >
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)} style={o.style}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
