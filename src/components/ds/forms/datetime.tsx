"use client";

import { Popover as RPopover } from "radix-ui";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from "@/components/icons";
import { controlClasses, isoDate, useFieldControl } from "@/components/ui";
import { cn } from "@/lib/utils";
import { shellClasses } from "./inputs";

/* ------------------------------------------------------------------ */
/* Date helpers (fixed English names so server and client agree)       */
/* ------------------------------------------------------------------ */

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function parse(v: string | undefined): Date | null {
  const m = v?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const short = (d: Date) => `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;

/** "Oct 1 – Oct 19, 2026" (year shown once when shared). */
export function formatRange(r: DateRange) {
  const a = parse(r.start);
  const b = parse(r.end);
  if (!a) return "";
  if (!b) return `${short(a)}, ${a.getFullYear()} – …`;
  return a.getFullYear() === b.getFullYear() ? `${short(a)} – ${short(b)}, ${b.getFullYear()}` : `${short(a)}, ${a.getFullYear()} – ${short(b)}, ${b.getFullYear()}`;
}

/* ------------------------------------------------------------------ */
/* Date range picker                                                   */
/* ------------------------------------------------------------------ */

export interface DateRange {
  /** "YYYY-MM-DD" or "". */
  start: string;
  end: string;
}

export interface DateRangePreset {
  label: string;
  /** Build the range from today's ISO date. */
  range: (today: string) => DateRange;
}

export const DEFAULT_RANGE_PRESETS: DateRangePreset[] = [
  { label: "Last 7 days", range: (t) => ({ start: isoDate(addDays(parse(t)!, -6)), end: t }) },
  { label: "Last 30 days", range: (t) => ({ start: isoDate(addDays(parse(t)!, -29)), end: t }) },
  { label: "Last 90 days", range: (t) => ({ start: isoDate(addDays(parse(t)!, -89)), end: t }) },
  {
    label: "This month",
    range: (t) => {
      const d = parse(t)!;
      return { start: isoDate(new Date(d.getFullYear(), d.getMonth(), 1)), end: t };
    },
  },
  {
    label: "Last month",
    range: (t) => {
      const d = parse(t)!;
      return { start: isoDate(new Date(d.getFullYear(), d.getMonth() - 1, 1)), end: isoDate(new Date(d.getFullYear(), d.getMonth(), 0)) };
    },
  },
];

export interface DateRangePickerProps {
  value: DateRange;
  onChange: (r: DateRange) => void;
  presets?: DateRangePreset[];
  /** Today as "YYYY-MM-DD" (for presets and the today marker). Defaults to the device date. */
  today?: string;
  min?: string;
  max?: string;
  placeholder?: string;
  id?: string;
  "aria-label"?: string;
  disabled?: boolean;
  className?: string;
}

/** Start and end dates in one popover: presets on the left, two months on the right. */
export function DateRangePicker({ value, onChange, presets = DEFAULT_RANGE_PRESETS, today, min, max, placeholder = "Pick dates", id, disabled, className, "aria-label": ariaLabel }: DateRangePickerProps) {
  const wiring = useFieldControl({ id });
  const [open, setOpen] = useState(false);
  const label = formatRange(value);
  return (
    <RPopover.Root open={open} onOpenChange={setOpen}>
      <RPopover.Trigger
        id={wiring.id}
        aria-label={ariaLabel ? `${ariaLabel}${label ? `: ${label}` : ""}` : undefined}
        aria-describedby={wiring["aria-describedby"]}
        aria-haspopup="dialog"
        disabled={disabled}
        className={cn(controlClasses, "flex h-[var(--h-md)] items-center gap-2 text-left", !label && "text-ink-3", className)}
      >
        <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-ink-3" />
        <span className="flex-1 truncate tabular-nums">{label || placeholder}</span>
      </RPopover.Trigger>
      <RPopover.Portal>
        <RPopover.Content sideOffset={6} align="start" collisionPadding={12} className="z-50 max-w-[calc(100vw-24px)] rounded-[var(--radius-card)] border border-line bg-surface shadow-lg outline-none">
          <RangePanel
            value={value}
            today={today}
            min={min}
            max={max}
            presets={presets}
            onDone={(r) => {
              onChange(r);
              setOpen(false);
            }}
          />
        </RPopover.Content>
      </RPopover.Portal>
    </RPopover.Root>
  );
}

function RangePanel({ value, today, min, max, presets, onDone }: { value: DateRange; today?: string; min?: string; max?: string; presets: DateRangePreset[]; onDone: (r: DateRange) => void }) {
  const todayIso = useMemo(() => today ?? isoDate(new Date()), [today]);
  const [draft, setDraft] = useState<DateRange>(value);
  const [hover, setHover] = useState<string | null>(null);
  const [focus, setFocus] = useState<Date>(() => parse(value.end) ?? parse(todayIso)!);
  const [month, setMonth] = useState(() => {
    const f = parse(value.end) ?? parse(todayIso)!;
    return new Date(f.getFullYear(), f.getMonth() - 1, 1);
  });
  const grid = useRef<HTMLDivElement>(null);

  useEffect(() => {
    grid.current?.querySelector<HTMLButtonElement>(`[data-iso="${isoDate(focus)}"]`)?.focus();
  }, [focus]);

  const picking = draft.start && !draft.end;
  const lo = draft.start;
  const hi = draft.end || (picking && hover ? hover : "");
  const [a, b] = hi && hi < lo ? [hi, lo] : [lo, hi];

  const pick = (iso: string) => {
    if (!picking) {
      setDraft({ start: iso, end: "" });
      return;
    }
    const r = iso < draft.start ? { start: iso, end: draft.start } : { start: draft.start, end: iso };
    setDraft(r);
    onDone(r);
  };
  const move = (d: Date) => {
    setFocus(d);
    const first = month;
    const last = new Date(month.getFullYear(), month.getMonth() + 2, 0);
    if (d < first) setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    else if (d > last) setMonth(new Date(d.getFullYear(), d.getMonth() - 1, 1));
  };
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, d: Date) => {
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key in step) {
      e.preventDefault();
      move(addDays(d, step[e.key]));
    } else if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      move(new Date(d.getFullYear(), d.getMonth() + (e.key === "PageUp" ? -1 : 1), d.getDate()));
    }
  };
  const months = [month, new Date(month.getFullYear(), month.getMonth() + 1, 1)];

  return (
    <div className="flex flex-col sm:flex-row">
      <ul aria-label="Presets" className="relative flex gap-1 overflow-x-auto border-b border-line p-2 sm:w-36 sm:flex-col sm:border-b-0 sm:border-r">
        {presets.map((p) => {
          const r = p.range(todayIso);
          const on = r.start === value.start && r.end === value.end;
          return (
            <li key={p.label}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onDone(r)}
                className={cn("h-8 w-full whitespace-nowrap rounded-[var(--radius-control)] px-2.5 text-left text-ui text-ink-2 hover:bg-surface-2 hover:text-ink", on && "bg-surface-2 font-medium text-ink")}
              >
                {p.label}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="p-3">
        <div className="mb-2 flex items-center justify-between">
          <button type="button" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="grid size-8 place-items-center rounded-[var(--radius-control)] text-ink-2 hover:bg-surface-2">
            <ChevronLeft aria-hidden="true" className="size-4" />
          </button>
          <p className="text-xs text-ink-3" aria-live="polite">
            {picking ? "Pick an end date" : draft.start ? formatRange(draft) : "Pick a start date"}
          </p>
          <button type="button" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="grid size-8 place-items-center rounded-[var(--radius-control)] text-ink-2 hover:bg-surface-2">
            <ChevronRight aria-hidden="true" className="size-4" />
          </button>
        </div>
        <div ref={grid} className="flex gap-6" onMouseLeave={() => setHover(null)}>
          {months.map((m, mi) => {
            const lead = (m.getDay() + 6) % 7;
            const days = Array.from({ length: 42 }, (_, i) => addDays(m, i - lead));
            return (
              <div key={mi} className={cn("w-[15.5rem]", mi === 1 && "hidden md:block")}>
                <p className="mb-1 text-center text-ui font-medium text-ink">
                  {MONTHS[m.getMonth()]} {m.getFullYear()}
                </p>
                <div role="grid" aria-label={`${MONTHS[m.getMonth()]} ${m.getFullYear()}`} className="grid grid-cols-7 text-center">
                  {WEEKDAYS.map((w) => (
                    <span key={w} role="columnheader" className="py-1 text-2xs font-medium text-ink-3">
                      {w}
                    </span>
                  ))}
                  {days.map((d) => {
                    const iso = isoDate(d);
                    const inMonth = d.getMonth() === m.getMonth();
                    if (!inMonth) return <span key={iso} aria-hidden="true" className="h-8" />;
                    const off = (min && iso < min) || (max && iso > max);
                    const isEnd = iso === a || iso === b;
                    const inRange = a && b && iso > a && iso < b;
                    return (
                      <button
                        key={iso}
                        type="button"
                        role="gridcell"
                        data-iso={iso}
                        tabIndex={isoDate(focus) === iso ? 0 : -1}
                        aria-selected={Boolean(isEnd || inRange)}
                        aria-label={`${DAY_NAMES[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}${iso === todayIso ? " (today)" : ""}`}
                        disabled={Boolean(off)}
                        onClick={() => pick(iso)}
                        onMouseEnter={() => picking && setHover(iso)}
                        onKeyDown={(e) => onKey(e, d)}
                        className={cn(
                          "h-8 text-ui tabular-nums transition-colors focus-visible:z-10",
                          isEnd ? "rounded-[var(--radius-control)] bg-ink font-medium text-white" : inRange ? "bg-brand-100 text-ink" : "rounded-[var(--radius-control)] text-ink hover:bg-surface-2",
                          iso === todayIso && !isEnd && "font-semibold underline decoration-2 underline-offset-4",
                          off && "cursor-not-allowed opacity-35",
                        )}
                      >
                        {d.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Time picker                                                         */
/* ------------------------------------------------------------------ */

export interface TimePickerProps {
  /** 24-hour "HH:mm" or "". */
  value: string;
  onChange: (v: string) => void;
  /** Minutes per arrow press (default 5). */
  step?: number;
  /** Group label (or pass aria-labelledby). */
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  disabled?: boolean;
  className?: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Typed time field: hour, minute and AM/PM segments (ARIA spinbuttons).
 * ↑/↓ change a segment, digits type into it, ←/→ move, A/P set the period.
 */
export function TimePicker({ value, onChange, step = 5, disabled, className, "aria-label": ariaLabel, "aria-labelledby": labelledBy, "aria-describedby": describedBy }: TimePickerProps) {
  const groupId = useId();
  const segs = useRef<(HTMLSpanElement | null)[]>([]);
  const typed = useRef<{ seg: number; buf: string; at: number }>({ seg: -1, buf: "", at: 0 });
  const m = value.match(/^(\d{2}):(\d{2})$/);
  const h24 = m ? Number(m[1]) : null;
  const min = m ? Number(m[2]) : null;
  const pm = h24 !== null && h24 >= 12;
  const h12 = h24 === null ? null : h24 % 12 === 0 ? 12 : h24 % 12;

  const set = (h: number, mi: number) => onChange(`${pad(((h % 24) + 24) % 24)}:${pad(((mi % 60) + 60) % 60)}`);
  const base = () => ({ h: h24 ?? 9, mi: min ?? 0 });
  const focusSeg = (i: number) => segs.current[Math.max(0, Math.min(2, i))]?.focus();

  const onKey = (e: KeyboardEvent<HTMLSpanElement>, seg: 0 | 1 | 2) => {
    if (disabled) return;
    const { h, mi } = base();
    const up = e.key === "ArrowUp" ? 1 : e.key === "ArrowDown" ? -1 : 0;
    if (up) {
      e.preventDefault();
      if (seg === 0) set(h + up, mi);
      else if (seg === 1) set(h, Math.round((mi + up * step) / step) * step);
      else set(h + 12, mi);
      return;
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      focusSeg(seg + (e.key === "ArrowRight" ? 1 : -1));
      return;
    }
    if (seg === 2 && /^[ap]$/i.test(e.key)) {
      e.preventDefault();
      const wantPm = e.key.toLowerCase() === "p";
      if (wantPm !== h >= 12) set(h + 12, mi);
      return;
    }
    if (/^\d$/.test(e.key) && seg < 2) {
      e.preventDefault();
      const t = typed.current;
      const fresh = t.seg !== seg || e.timeStamp - t.at > 1200;
      const buf = (fresh ? "" : t.buf) + e.key;
      typed.current = { seg, buf, at: e.timeStamp };
      const n = Number(buf);
      if (seg === 0) {
        const hh = Math.min(12, Math.max(1, n || 1));
        set((hh % 12) + (h >= 12 ? 12 : 0), mi);
        if (buf.length === 2 || n > 1) {
          typed.current.buf = "";
          focusSeg(1);
        }
      } else {
        set(h, Math.min(59, n));
        if (buf.length === 2 || n > 5) {
          typed.current.buf = "";
          focusSeg(2);
        }
      }
      return;
    }
    if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      onChange("");
    }
  };

  const seg = (i: 0 | 1 | 2, text: string, label: string, now: number | undefined, lo: number, hi: number, valueText: string) => (
    <span
      ref={(el) => {
        segs.current[i] = el;
      }}
      role="spinbutton"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-valuenow={now}
      aria-valuemin={lo}
      aria-valuemax={hi}
      aria-valuetext={valueText}
      aria-disabled={disabled || undefined}
      onKeyDown={(e) => onKey(e, i)}
      className={cn(
        "rounded-[2px] px-0.5 tabular-nums caret-transparent outline-none! focus-visible:rounded-[2px]! focus:bg-ink focus:text-white",
        now === undefined && "text-ink-3",
      )}
    >
      {text}
    </span>
  );

  return (
    <div
      id={groupId}
      role="group"
      aria-label={ariaLabel}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      className={cn(shellClasses, "h-[var(--h-md)] w-36 items-center gap-0.5 px-3 has-[[role=spinbutton]:focus]:border-brand-700", disabled && "bg-surface-2 text-ink-3", className)}
      onClick={(e) => {
        if (e.target === e.currentTarget) focusSeg(0);
      }}
    >
      <Clock aria-hidden="true" className="mr-1.5 size-4 shrink-0 text-ink-3" />
      {seg(0, h12 === null ? "--" : pad(h12), "Hours", h12 ?? undefined, 1, 12, h12 === null ? "Empty" : String(h12))}
      <span aria-hidden="true" className="text-ink-3">
        :
      </span>
      {seg(1, min === null ? "--" : pad(min), "Minutes", min ?? undefined, 0, 59, min === null ? "Empty" : pad(min))}
      <span className="w-1" />
      {seg(2, h24 === null ? "--" : pm ? "PM" : "AM", "AM or PM", h24 === null ? undefined : pm ? 1 : 0, 0, 1, h24 === null ? "Empty" : pm ? "PM" : "AM")}
    </div>
  );
}

/** "14:30" → "2:30 PM". */
export function formatTime(v: string) {
  const m = v.match(/^(\d{2}):(\d{2})$/);
  if (!m) return "";
  const h = Number(m[1]);
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h >= 12 ? "PM" : "AM"}`;
}
