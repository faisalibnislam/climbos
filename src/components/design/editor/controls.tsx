"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { resolvePaint } from "@shared/design/ops";
import type { BrandKit, Paint } from "@shared/design/types";
import { Button, HexInput, IconButton, Select, Tooltip } from "@/components/ui";
import { controlClasses } from "@/components/ui/field";
import { cn } from "@/lib/utils";

/**
 * Small, dense controls used by the editor toolbars and panels. Everything
 * sits on the design system's sm control size: 32px tall, 6px corners.
 */

const activeTool = "bg-brand-100 text-brand-900 hover:bg-brand-100 hover:text-brand-900";

/**
 * Toolbar action. Icon children render as an `IconButton` (ghost, sm) with the
 * label as its tooltip; short text children ("Fit", "Pill") render as a ghost
 * sm `Button` with the same tooltip.
 */
export function ToolButton({ label, active, onClick, children, disabled, className }: { label: string; active?: boolean; onClick: () => void; children: ReactNode; disabled?: boolean; className?: string }) {
  const classes = cn("text-ink-2 hover:text-ink", active && activeTool, className);
  if (typeof children === "string") {
    return (
      <Tooltip content={label}>
        <Button variant="ghost" size="sm" aria-label={label} aria-pressed={active} disabled={disabled} onClick={onClick} className={cn("px-2", classes)}>
          {children}
        </Button>
      </Tooltip>
    );
  }
  return <IconButton variant="ghost" size="sm" aria-label={label} aria-pressed={active} disabled={disabled} onClick={onClick} icon={children} className={classes} />;
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
    <Tooltip content={label}>
      <label className="inline-flex items-center gap-1 text-xs text-ink-3">
        <span className="sr-only">{label}</span>
        <input
          type="number"
          inputMode="decimal"
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
          className={cn(controlClasses, "h-8 px-2 tabular-nums", width)}
        />
        {suffix ? <span aria-hidden="true">{suffix}</span> : null}
      </label>
    </Tooltip>
  );
}

export function Slider({ label, value, onChange, min, max, step = 0.01 }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number }) {
  return (
    <label className="flex min-h-8 items-center gap-2 text-ui font-medium text-ink-2">
      <span className="w-20 shrink-0">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-brand-800" />
    </label>
  );
}

const PALETTE = ["#101828", "#ffffff", "#f5f6f8", "#0b5d46", "#ff9a4d", "#e5483a", "#f0a020", "#23a065", "#3d7ad6", "#7c5cd6", "#e05596", "#1c9aab"];

const swatchClasses = "size-8 rounded-md border border-line-strong";
const swatchSelected = "ring-2 ring-brand-600 ring-offset-1";

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
      <Tooltip content={label}>
        <button
          type="button"
          aria-label={`${label}: ${current}`}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="inline-flex h-8 items-center rounded-lg border border-line-strong bg-surface px-1 transition-colors hover:bg-surface-2"
        >
          <span className="size-6 rounded-sm border border-line-strong" style={{ background: current }} />
        </button>
      </Tooltip>
      {open ? (
        <div className="absolute left-0 top-10 z-50 w-60 rounded-xl border border-line bg-surface p-3 shadow-lg" role="dialog" aria-label={label}>
          <p className="text-overline">Brand colours</p>
          <div className="mt-2 flex gap-1.5">
            {(Object.keys(brand.colors) as (keyof BrandKit["colors"])[]).map((k) => (
              <Tooltip key={k} content={`Brand ${k}`}>
                <button
                  type="button"
                  aria-label={`Brand ${k}`}
                  onClick={() => onChange(`brand:${k}`)}
                  className={cn(swatchClasses, value === `brand:${k}` && swatchSelected)}
                  style={{ background: brand.colors[k] }}
                />
              </Tooltip>
            ))}
          </div>
          <p className="mt-3 text-overline">Colours</p>
          <div className="mt-2 grid grid-cols-6 gap-1.5">
            {PALETTE.map((c) => (
              <button key={c} type="button" title={c} aria-label={c} onClick={() => onChange(c)} className={cn(swatchClasses, value === c && swatchSelected)} style={{ background: c }} />
            ))}
          </div>
          <label className="mt-3 flex items-center justify-between gap-2">
            <span className="text-overline">Custom</span>
            <HexInput value={current.slice(0, 7)} onChange={onChange} label="Custom colour" />
          </label>
        </div>
      ) : null}
    </div>
  );
}

export function SelectField<T extends string | number>({ label, value, options, onChange, className }: { label: string; value: T; options: { value: T; label: string; style?: React.CSSProperties }[]; onChange: (v: T) => void; className?: string }) {
  return (
    <Tooltip content={label}>
      <span className="inline-flex">
        <Select
          aria-label={label}
          value={String(value)}
          onValueChange={(v) => {
            const o = options.find((x) => String(x.value) === v);
            if (o) onChange(o.value);
          }}
          options={options.map((o) => ({ value: String(o.value), label: <span style={o.style}>{o.label}</span> }))}
          className={cn("h-8 w-auto gap-1.5 px-2", className)}
        />
      </span>
    </Tooltip>
  );
}
