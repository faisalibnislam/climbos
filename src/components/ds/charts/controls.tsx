"use client";

/*
 * Chart controls (Signal): legend toggles, annotation notes, date range,
 * metric tabs, zoom + brush, and export (CSV, PNG).
 */
import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  ImageDown,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from "@/components/icons";
import {
  Button,
  Checkbox,
  DatePicker,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  IconButton,
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
  Segmented,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { focusRing } from "./core";
import { TrendIndicator } from "./kpi";

/* ---------------- Legend ---------------- */

export interface LegendItem {
  key: string;
  label: string;
  color: string;
  /** Optional total shown after the label. */
  value?: string;
  shape?: "square" | "dot" | "line" | "dashed";
}

function LegendSwatch({ color, shape = "square", off }: { color: string; shape?: LegendItem["shape"]; off?: boolean }) {
  if (shape === "line" || shape === "dashed")
    return (
      <svg aria-hidden width="16" height="8" viewBox="0 0 16 8" className={cn("shrink-0", off && "opacity-35")}>
        <line x1="0" x2="16" y1="4" y2="4" stroke={color} strokeWidth="2" strokeDasharray={shape === "dashed" ? "3 2" : undefined} />
      </svg>
    );
  return (
    <span
      aria-hidden
      className={cn("size-2.5 shrink-0 border-[1.5px]", shape === "dot" ? "rounded-full" : "rounded-[2px]")}
      style={{ borderColor: color, background: off ? "transparent" : color }}
    />
  );
}

/**
 * Chart legend. With `onToggle` each item is a toggle button (aria-pressed) that shows or hides
 * its series; the last visible series can't be hidden. Without it, a plain key.
 */
export function ChartLegend({ items, hidden = [], onToggle, label = "Series", className }: { items: LegendItem[]; hidden?: string[]; onToggle?: (key: string) => void; label?: string; className?: string }) {
  const visible = items.filter((i) => !hidden.includes(i.key)).length;
  if (!onToggle)
    return (
      <ul aria-label={label} className={cn("flex flex-wrap gap-x-5 gap-y-1.5 text-ui text-ink-2", className)}>
        {items.map((it) => (
          <li key={it.key} className="flex items-center gap-2">
            <LegendSwatch color={it.color} shape={it.shape} />
            {it.label}
            {it.value ? <b className="font-medium tabular-nums text-ink">{it.value}</b> : null}
          </li>
        ))}
      </ul>
    );
  return (
    <div role="group" aria-label={`${label}: show or hide`} className={cn("flex flex-wrap gap-1", className)}>
      {items.map((it) => {
        const off = hidden.includes(it.key);
        const locked = !off && visible === 1;
        return (
          <button
            key={it.key}
            type="button"
            aria-pressed={!off}
            aria-disabled={locked || undefined}
            title={locked ? "At least one series stays visible" : undefined}
            onClick={() => (locked ? undefined : onToggle(it.key))}
            className={cn(
              "inline-flex h-7 items-center gap-2 rounded-[var(--radius-control)] px-2 text-ui transition-colors hover:bg-surface-2",
              off ? "text-ink-3" : "text-ink-2",
              focusRing,
            )}
          >
            <LegendSwatch color={it.color} shape={it.shape} off={off} />
            <span className={cn(off && "line-through decoration-ink-3/60")}>{it.label}</span>
            {it.value ? <b className={cn("font-medium tabular-nums", off ? "text-ink-3" : "text-ink")}>{it.value}</b> : null}
          </button>
        );
      })}
    </div>
  );
}

/** Toggle helper for legends: hides/shows a key. */
export function useHiddenSeries(initial: string[] = []) {
  const [hidden, setHidden] = useState<string[]>(initial);
  const toggle = (key: string) => setHidden((h) => (h.includes(key) ? h.filter((k) => k !== key) : [...h, key]));
  return { hidden, toggle, setHidden };
}

/* ---------------- Annotation ---------------- */

/**
 * A note pinned to a point on a plot (percent coordinates): a dot, a leader line and a short
 * Reckless italic note. Place inside a relative plot box.
 */
export function ChartAnnotation({ x, y, children, side = "right", lift = 30, className }: { x: number; y: number; children: ReactNode; side?: "left" | "right"; lift?: number; className?: string }) {
  return (
    <div className={cn("pointer-events-none absolute z-10", className)} style={{ left: `${x}%`, top: `${y}%` }}>
      <span aria-hidden className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink ring-2 ring-surface" />
      <span aria-hidden className="absolute w-px -translate-x-1/2 bg-ink/50" style={{ height: lift, top: -lift }} />
      <span
        className={cn("text-annotation absolute whitespace-nowrap rounded-[var(--radius-badge)] bg-surface px-1.5 text-ink-2 ring-1 ring-line", side === "right" ? "left-0 -translate-x-2" : "right-0 translate-x-2")}
        style={{ top: -lift - 20 }}
      >
        {children}
      </span>
    </div>
  );
}

/* ---------------- Date selector ---------------- */

export type RangePreset = "7d" | "30d" | "90d" | "12m" | "custom";
export interface DateRangeValue {
  preset: RangePreset;
  /** YYYY-MM-DD, inclusive. */
  from: string;
  to: string;
  compare: boolean;
}

const DAY = 86_400_000;
const toUtc = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, (m || 1) - 1, d || 1);
};
const toIso = (t: number) => new Date(t).toISOString().slice(0, 10);
const shortDate = (iso: string, year = false) => new Date(toUtc(iso)).toLocaleDateString("en-US", { month: "short", day: "numeric", ...(year ? { year: "numeric" } : {}), timeZone: "UTC" });
export const daysBetween = (from: string, to: string) => Math.round((toUtc(to) - toUtc(from)) / DAY) + 1;

const PRESET_DAYS: Record<Exclude<RangePreset, "custom">, number> = { "7d": 7, "30d": 30, "90d": 90, "12m": 365 };

/** Resolve a preset against today (UTC dates, so server and browser agree). */
export function presetRange(preset: Exclude<RangePreset, "custom">, today: string, compare = false): DateRangeValue {
  return { preset, from: toIso(toUtc(today) - (PRESET_DAYS[preset] - 1) * DAY), to: today, compare };
}

/** The equal-length period just before a range. */
export function previousRange(v: DateRangeValue) {
  const n = daysBetween(v.from, v.to);
  return { from: toIso(toUtc(v.from) - n * DAY), to: toIso(toUtc(v.from) - DAY) };
}

export function formatRange(from: string, to: string) {
  return `${shortDate(from)} – ${shortDate(to, true)}`;
}

/** Presets (7d/30d/90d/12m), a custom range popover and a compare-to-previous toggle. */
export function ChartDateSelector({ value, onChange, today, className }: { value: DateRangeValue; onChange: (v: DateRangeValue) => void; today: string; className?: string }) {
  const [draft, setDraft] = useState({ from: value.from, to: value.to });
  const prev = previousRange(value);
  const valid = draft.from && draft.to && draft.from <= draft.to;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label="Date range"
          value={value.preset}
          onChange={(p) => (p === "custom" ? undefined : onChange(presetRange(p, today, value.compare)))}
          options={[
            { value: "7d", label: "7d" },
            { value: "30d", label: "30d" },
            { value: "90d", label: "90d" },
            { value: "12m", label: "12m" },
          ]}
        />
        <Popover onOpenChange={(o) => (o ? setDraft({ from: value.from, to: value.to }) : undefined)}>
          <PopoverTrigger asChild>
            <Button variant={value.preset === "custom" ? "primary" : "secondary"} size="sm" aria-haspopup="dialog">
              <CalendarDays className="size-4" aria-hidden />
              {value.preset === "custom" ? formatRange(value.from, value.to) : "Custom"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto rounded-[var(--radius-card)]" aria-label="Custom date range">
            <div className="flex flex-col gap-3">
              <p className="text-ui font-medium text-ink">Custom range</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-xs text-ink-3">
                  From
                  <DatePicker aria-label="From" value={draft.from} max={draft.to || today} onChange={(from) => setDraft((d) => ({ ...d, from }))} />
                </label>
                <label className="flex flex-col gap-1 text-xs text-ink-3">
                  To
                  <DatePicker aria-label="To" value={draft.to} min={draft.from} max={today} onChange={(to) => setDraft((d) => ({ ...d, to }))} />
                </label>
              </div>
              {!valid ? <p className="text-xs text-red-800">Pick a start date before the end date.</p> : null}
              <div className="flex justify-end gap-2">
                <PopoverClose asChild>
                  <Button variant="ghost" size="sm">Cancel</Button>
                </PopoverClose>
                <PopoverClose asChild>
                  <Button size="sm" disabled={!valid} onClick={() => onChange({ preset: "custom", from: draft.from, to: draft.to, compare: value.compare })}>
                    Apply
                  </Button>
                </PopoverClose>
              </div>
            </div>
          </PopoverContent>
        </Popover>
        <Checkbox label="Compare" checked={value.compare} onCheckedChange={(c) => onChange({ ...value, compare: c === true })} />
      </div>
      <p className="text-xs text-ink-3" aria-live="polite">
        <span className="font-medium text-ink-2">{formatRange(value.from, value.to)}</span> · {daysBetween(value.from, value.to)} days
        {value.compare ? <> · vs {formatRange(prev.from, prev.to)}</> : null}
      </p>
    </div>
  );
}

/* ---------------- Metric selector ---------------- */

export interface MetricOption {
  key: string;
  label: string;
  value: string;
  /** Percent change vs the previous period. */
  delta?: number;
  upIsGood?: boolean;
}

/** KPI tiles that switch the chart below (tablist with arrow keys; selection follows focus). */
export function ChartMetricSelector({ options, value, onChange, controls, label = "Metric", className }: { options: MetricOption[]; value: string; onChange: (key: string) => void; controls?: string; label?: string; className?: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (e: KeyboardEvent, i: number) => {
    const n = options.length;
    const next = e.key === "ArrowRight" || e.key === "ArrowDown" ? (i + 1) % n : e.key === "ArrowLeft" || e.key === "ArrowUp" ? (i - 1 + n) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    onChange(options[next].key);
    refs.current[next]?.focus();
  };
  return (
    <div role="tablist" aria-label={label} className={cn("grid grid-cols-2 overflow-hidden rounded-[var(--radius-card)] border border-line bg-line gap-px sm:grid-cols-4", className)}>
      {options.map((o, i) => {
        const on = o.key === value;
        return (
          <button
            key={o.key}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={on}
            aria-controls={controls}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.key)}
            onKeyDown={(e) => move(e, i)}
            className={cn(
              "flex flex-col items-start gap-1 px-3 py-2.5 text-left transition-colors focus-visible:z-10",
              on ? "bg-surface shadow-[inset_0_2px_0_var(--ink)]" : "bg-surface-2 hover:bg-surface",
              focusRing,
            )}
          >
            <span className={cn("text-xs", on ? "font-medium text-ink" : "text-ink-3")}>{o.label}</span>
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="text-lg font-semibold leading-6 tabular-nums tracking-[-0.02em] text-ink">{o.value}</span>
              {o.delta !== undefined ? <TrendIndicator value={o.delta} upIsGood={o.upIsGood} size="sm" /> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- Zoom ---------------- */

/** [start, end) index window over `total` points. */
export type ZoomRange = [number, number];

export function zoomBy(range: ZoomRange, total: number, factor: number, minSpan: number): ZoomRange {
  const span = range[1] - range[0];
  const next = Math.min(total, Math.max(minSpan, Math.round(span * factor)));
  const mid = (range[0] + range[1]) / 2;
  const start = Math.min(total - next, Math.max(0, Math.round(mid - next / 2)));
  return [start, start + next];
}

function panBy(range: ZoomRange, total: number, delta: number): ZoomRange {
  const span = range[1] - range[0];
  const start = Math.min(total - span, Math.max(0, range[0] + delta));
  return [start, start + span];
}

/** Zoom in/out, pan and reset buttons for an index window. */
export function ChartZoomControls({ total, range, onChange, minSpan = 4, rangeLabel, className }: { total: number; range: ZoomRange; onChange: (r: ZoomRange) => void; minSpan?: number; rangeLabel?: string; className?: string }) {
  const span = range[1] - range[0];
  const step = Math.max(1, Math.round(span / 2));
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div role="group" aria-label="Zoom" className="flex items-center gap-0.5 rounded-[var(--radius-control)] border border-line bg-surface p-0.5">
        <IconButton size="sm" aria-label="Zoom out" icon={<ZoomOut className="size-4" />} disabled={span >= total} onClick={() => onChange(zoomBy(range, total, 2, minSpan))} />
        <IconButton size="sm" aria-label="Zoom in" icon={<ZoomIn className="size-4" />} disabled={span <= minSpan} onClick={() => onChange(zoomBy(range, total, 0.5, minSpan))} />
        <span aria-hidden className="mx-0.5 h-4 w-px bg-line" />
        <IconButton size="sm" aria-label="Earlier" icon={<ChevronLeft className="size-4" />} disabled={range[0] <= 0} onClick={() => onChange(panBy(range, total, -step))} />
        <IconButton size="sm" aria-label="Later" icon={<ChevronRight className="size-4" />} disabled={range[1] >= total} onClick={() => onChange(panBy(range, total, step))} />
        <span aria-hidden className="mx-0.5 h-4 w-px bg-line" />
        <IconButton size="sm" aria-label="Reset zoom" icon={<RotateCcw className="size-4" />} disabled={span >= total} onClick={() => onChange([0, total])} />
      </div>
      {rangeLabel ? (
        <p className="text-xs tabular-nums text-ink-3" aria-live="polite">
          {rangeLabel}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Brush: a mini overview of every point with the visible window on top. Drag the window (or use
 * arrows / Page keys on it) to pan; click outside it to jump there.
 */
export function ChartBrush({ values, range, onChange, label = "Visible range" }: { values: number[]; range: ZoomRange; onChange: (r: ZoomRange) => void; label?: string }) {
  const total = values.length;
  const span = range[1] - range[0];
  const max = Math.max(...values, 1);
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; start: number } | null>(null);
  const toIndexDelta = (dx: number) => {
    const w = track.current?.getBoundingClientRect().width || 1;
    return Math.round((dx / w) * total);
  };
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, start: range[0] };
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const start = Math.min(total - span, Math.max(0, drag.current.start + toIndexDelta(e.clientX - drag.current.x)));
    if (start !== range[0]) onChange([start, start + span]);
  };
  const onUp = () => {
    drag.current = null;
  };
  const jump = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const at = Math.round(((e.clientX - r.left) / (r.width || 1)) * total);
    const start = Math.min(total - span, Math.max(0, at - Math.round(span / 2)));
    onChange([start, start + span]);
  };
  const onKey = (e: KeyboardEvent) => {
    const d = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : e.key === "PageUp" ? span : e.key === "PageDown" ? -span : 0;
    let start = range[0] + d;
    if (e.key === "Home") start = 0;
    else if (e.key === "End") start = total - span;
    else if (!d) return;
    e.preventDefault();
    start = Math.min(total - span, Math.max(0, start));
    onChange([start, start + span]);
  };
  return (
    <div ref={track} className="relative h-10 cursor-pointer select-none rounded-[var(--radius-control)] bg-surface-2" onPointerDown={jump}>
      <div aria-hidden className="absolute inset-x-1 bottom-1 top-1.5 flex items-end gap-px">
        {values.map((v, i) => (
          <span key={i} className={cn("flex-1 rounded-t-[1px]", i >= range[0] && i < range[1] ? "bg-chart-1" : "bg-chart-6/50")} style={{ height: `${(v / max) * 100}%` }} />
        ))}
      </div>
      <div
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total - span}
        aria-valuenow={range[0]}
        aria-valuetext={`Points ${range[0] + 1} to ${range[1]} of ${total}`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onKeyDown={onKey}
        className={cn("absolute inset-y-0 cursor-grab touch-none rounded-[var(--radius-control)] border-x-[3px] border-ink bg-ink/[0.07] active:cursor-grabbing", focusRing)}
        style={{ left: `${(range[0] / total) * 100}%`, width: `${(span / total) * 100}%` }}
      />
    </div>
  );
}

/* ---------------- Export ---------------- */

export function toCsv(columns: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns, ...rows].map((r) => r.map(esc).join(",")).join("\n");
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Rasterise an on-screen SVG (CSS variables resolved) to a 2× PNG on the panel colour. */
export async function downloadSvgPng(svg: SVGSVGElement, filename: string, scale = 2) {
  const cs = getComputedStyle(svg);
  const vb = svg.viewBox.baseVal;
  const w = vb && vb.width ? vb.width : svg.clientWidth;
  const h = vb && vb.height ? vb.height : svg.clientHeight;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(h));
  clone.setAttribute("font-family", cs.fontFamily || "sans-serif");
  const src = new XMLSerializer().serializeToString(clone).replace(/var\((--[\w-]+)\)/g, (_, name: string) => cs.getPropertyValue(name).trim() || "#000");
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(src)}`;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = cs.getPropertyValue("--surface").trim() || "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  await new Promise<void>((resolve) =>
    canvas.toBlob((b) => {
      if (b) downloadBlob(b, filename);
      resolve();
    }, "image/png"),
  );
}

/** Export menu: CSV of the chart's data, and PNG when an SVG ref is given. */
export function ChartExportAction({ filename, columns, rows, svgRef, className }: { filename: string; columns: string[]; rows: (string | number)[][]; svgRef?: RefObject<SVGSVGElement | null>; className?: string }) {
  const [status, setStatus] = useState("");
  const csv = () => {
    downloadBlob(new Blob([toCsv(columns, rows)], { type: "text/csv;charset=utf-8" }), `${filename}.csv`);
    setStatus(`${filename}.csv downloaded`);
  };
  const png = async () => {
    const svg = svgRef?.current;
    if (!svg) return;
    try {
      await downloadSvgPng(svg, `${filename}.png`);
      setStatus(`${filename}.png downloaded`);
    } catch {
      setStatus("Couldn't make the image. Try CSV instead.");
    }
  };
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="sm">
            <Download className="size-4" aria-hidden />
            Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="rounded-[var(--radius-card)]">
          <DropdownMenuItem icon={<FileSpreadsheet />} onSelect={csv}>Download CSV</DropdownMenuItem>
          {svgRef ? <DropdownMenuItem icon={<ImageDown />} onSelect={() => void png()}>Download PNG</DropdownMenuItem> : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <span className="text-xs text-ink-3" role="status">{status}</span>
    </div>
  );
}
