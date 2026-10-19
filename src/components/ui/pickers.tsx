"use client";

import { Popover as RPopover } from "radix-ui";
import { CalendarDays, ChevronLeft, ChevronRight } from "@/components/icons"
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { controlClasses, useFieldControl } from "./field";
import { Select } from "./select";

/**
 * Branded pickers. ClimbOS never shows the operating system's date, time,
 * month or colour popups: every picker is ours, keyboard-first and labelled.
 */

/* ---------------- dates ---------------- */

const pad = (n: number) => String(n).padStart(2, "0");
/** "YYYY-MM-DD" for a local calendar date. */
export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function parseIso(v: string | undefined): Date | null {
  const m = v?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}
function addDays(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function Calendar({ value, min, max, onPick }: { value: string; min?: string; max?: string; onPick: (iso: string) => void }) {
  const selected = parseIso(value);
  const [focus, setFocus] = useState<Date>(() => selected ?? parseIso(min) ?? new Date());
  const [month, setMonth] = useState(() => new Date(focus.getFullYear(), focus.getMonth(), 1));
  const grid = useRef<HTMLDivElement>(null);
  const outOfRange = (d: Date) => (min ? isoDate(d) < min : false) || (max ? isoDate(d) > max : false);

  useEffect(() => {
    grid.current?.querySelector<HTMLButtonElement>(`[data-iso="${isoDate(focus)}"]`)?.focus();
  }, [focus]);

  const days = useMemo(() => {
    const lead = (month.getDay() + 6) % 7; // Monday first
    const start = addDays(month, -lead);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [month]);

  const move = (d: Date) => {
    setFocus(d);
    if (d.getMonth() !== month.getMonth() || d.getFullYear() !== month.getFullYear()) setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
  };
  const shiftMonth = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));

  return (
    <div>
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => shiftMonth(-1)} aria-label="Previous month" className="grid size-8 place-items-center rounded-md text-ink-2 hover:bg-surface-2">
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        <p className="text-ui font-medium text-ink" aria-live="polite">
          {month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </p>
        <button type="button" onClick={() => shiftMonth(1)} aria-label="Next month" className="grid size-8 place-items-center rounded-md text-ink-2 hover:bg-surface-2">
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
      <div role="grid" ref={grid} className="mt-2 grid grid-cols-7 gap-0.5 text-center" aria-label="Choose a date">
        {WEEKDAYS.map((w) => (
          <span key={w} role="columnheader" className="py-1 text-2xs font-medium text-ink-3">
            {w}
          </span>
        ))}
        {days.map((d) => {
          const iso = isoDate(d);
          const inMonth = d.getMonth() === month.getMonth();
          const isSel = value === iso;
          const isToday = iso === isoDate(new Date());
          const disabled = outOfRange(d);
          return (
            <button
              key={iso}
              type="button"
              role="gridcell"
              data-iso={iso}
              tabIndex={isoDate(focus) === iso ? 0 : -1}
              aria-selected={isSel}
              aria-label={d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
              disabled={disabled}
              onClick={() => onPick(iso)}
              onKeyDown={(e) => {
                const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
                if (e.key in step) {
                  e.preventDefault();
                  move(addDays(d, step[e.key]));
                } else if (e.key === "PageUp" || e.key === "PageDown") {
                  e.preventDefault();
                  move(new Date(d.getFullYear(), d.getMonth() + (e.key === "PageUp" ? -1 : 1), d.getDate()));
                }
              }}
              className={cn(
                "h-8 rounded-md text-ui tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-brand-600",
                isSel ? "bg-brand-800 font-medium text-white" : inMonth ? "text-ink hover:bg-brand-50" : "text-ink-3 hover:bg-surface-2",
                isToday && !isSel && "font-semibold text-brand-800",
                disabled && "cursor-not-allowed opacity-35 hover:bg-transparent",
              )}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export interface DatePickerProps {
  /** "YYYY-MM-DD" or "". */
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  id?: string;
  "aria-label"?: string;
  disabled?: boolean;
  className?: string;
}

/** A date field with ClimbOS's own calendar popup. Inside <Field> it is labelled automatically. */
export function DatePicker({ value, onChange, min, max, placeholder = "Pick a date", id, disabled, className, "aria-label": ariaLabel }: DatePickerProps) {
  const wiring = useFieldControl({ id });
  const [open, setOpen] = useState(false);
  const d = parseIso(value);
  return (
    <RPopover.Root open={open} onOpenChange={setOpen}>
      <RPopover.Trigger
        id={wiring.id}
        aria-label={ariaLabel}
        aria-describedby={wiring["aria-describedby"]}
        aria-invalid={wiring["aria-invalid"]}
        aria-haspopup="dialog"
        disabled={disabled}
        className={cn(controlClasses, "flex h-9 items-center justify-between gap-2 text-left", !d && "text-ink-3", className)}
      >
        <span className="truncate">{d ? d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : placeholder}</span>
        <CalendarDays aria-hidden className="size-4 shrink-0 text-ink-3" />
      </RPopover.Trigger>
      <RPopover.Portal>
        <RPopover.Content sideOffset={6} align="start" className="z-50 w-72 rounded-xl border border-line bg-surface p-3 shadow-lg outline-none animate-fade-in">
          <Calendar
            value={value}
            min={min}
            max={max}
            onPick={(iso) => {
              onChange(iso);
              setOpen(false);
            }}
          />
        </RPopover.Content>
      </RPopover.Portal>
    </RPopover.Root>
  );
}

export interface DateTimePickerProps {
  /** Local "YYYY-MM-DDTHH:mm" or "". */
  value: string;
  onChange: (v: string) => void;
  /** Local "YYYY-MM-DDTHH:mm" bounds. */
  min?: string;
  max?: string;
  /** Minutes between time options. */
  step?: number;
  id?: string;
}

/** Date plus a time list (ClimbOS's own popups), in the viewer's time zone. */
export function DateTimePicker({ value, onChange, min, max, step = 15, id }: DateTimePickerProps) {
  const [date, time] = value ? value.split("T") : ["", ""];
  const times = useMemo(() => {
    const out: { value: string; label: string }[] = [];
    for (let m = 0; m < 24 * 60; m += step) {
      const t = `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
      const full = `${date}T${t}`;
      if (date && ((min && full < min) || (max && full > max))) continue;
      const label = new Date(2000, 0, 1, Math.floor(m / 60), m % 60).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
      out.push({ value: t, label });
    }
    return out;
  }, [date, min, max, step]);
  const pickTime = (t: string) => onChange(`${date || (min ?? "").slice(0, 10) || isoDate(new Date())}T${t}`);
  return (
    <div className="grid grid-cols-[1fr_8.5rem] gap-2">
      <DatePicker
        id={id}
        value={date}
        min={min?.slice(0, 10)}
        max={max?.slice(0, 10)}
        onChange={(d) => {
          const first = (() => {
            for (let m = 0; m < 24 * 60; m += step) {
              const t = `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
              const full = `${d}T${t}`;
              if ((!min || full >= min) && (!max || full <= max)) return t;
            }
            return "09:00";
          })();
          const keep = time && (!min || `${d}T${time}` >= min) && (!max || `${d}T${time}` <= max);
          onChange(`${d}T${keep ? time : first}`);
        }}
      />
      <Select aria-label="Time" value={time || undefined} onValueChange={pickTime} placeholder="Time" options={times} disabled={!date} />
    </div>
  );
}

/* ---------------- months ---------------- */

/** The last `count` months (newest first) as Select options, value "YYYY-MM". */
export function monthOptions(count = 24, from = new Date()): { value: string; label: string }[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(from.getFullYear(), from.getMonth() - i, 1);
    return { value: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`, label: d.toLocaleDateString(undefined, { month: "long", year: "numeric" }) };
  });
}

/* ---------------- colours ---------------- */

export const COLOR_PALETTE = ["#101828", "#ffffff", "#f5f6f8", "#0b5d46", "#ff9a4d", "#e5483a", "#f0a020", "#23a065", "#3d7ad6", "#7c5cd6", "#e05596", "#1c9aab"];

const HEX = /^#[0-9a-f]{6}$/i;

/** A hex field with a live swatch; commits only valid #RRGGBB values. */
export function HexInput({ value, onChange, label = "Hex colour", className }: { value: string; onChange: (hex: string) => void; label?: string; className?: string }) {
  const [draft, setDraft] = useState(value);
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    setDraft(value);
  }
  const valid = HEX.test(draft);
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <span aria-hidden className="size-8 shrink-0 rounded-md border border-line-strong" style={{ background: valid ? draft : value }} />
      <input
        aria-label={label}
        aria-invalid={!valid || undefined}
        value={draft}
        maxLength={7}
        spellCheck={false}
        onChange={(e) => {
          const v = e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`;
          setDraft(v);
          if (HEX.test(v)) onChange(v.toLowerCase());
        }}
        onBlur={() => setDraft(value)}
        className={cn(controlClasses, "h-8 w-24 px-2 font-mono text-xs uppercase")}
      />
    </span>
  );
}

/** Swatch button that opens a branded palette + hex popover. */
export function ColorPicker({ value, onChange, label, palette = COLOR_PALETTE }: { value: string; onChange: (hex: string) => void; label: string; palette?: string[] }) {
  return (
    <RPopover.Root>
      <RPopover.Trigger aria-label={`${label}: ${value}`} className="flex h-8 items-center gap-2 rounded-lg border border-control bg-surface pl-1 pr-2 text-xs font-mono uppercase text-ink-2 hover:border-control-hover">
        <span aria-hidden className="size-6 rounded-md border border-line-strong" style={{ background: value }} />
        {value}
      </RPopover.Trigger>
      <RPopover.Portal>
        <RPopover.Content sideOffset={6} align="end" className="z-50 w-60 rounded-xl border border-line bg-surface p-3 shadow-lg outline-none animate-fade-in">
          <p className="text-overline">{label}</p>
          <div className="mt-2 grid grid-cols-6 gap-1.5">
            {palette.map((c) => (
              <RPopover.Close key={c} asChild>
                <button
                  type="button"
                  aria-label={c}
                  aria-pressed={value.toLowerCase() === c}
                  onClick={() => onChange(c)}
                  className={cn("size-8 rounded-md border border-line-strong", value.toLowerCase() === c && "ring-2 ring-brand-600 ring-offset-1")}
                  style={{ background: c }}
                />
              </RPopover.Close>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-overline">Custom</span>
            <HexInput value={value} onChange={onChange} label={`${label} hex`} />
          </div>
        </RPopover.Content>
      </RPopover.Portal>
    </RPopover.Root>
  );
}
