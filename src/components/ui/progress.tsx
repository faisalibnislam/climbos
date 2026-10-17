import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";

export interface ProgressProps {
  /** 0–max. Omit for an indeterminate bar. */
  value?: number;
  max?: number;
  /** Accessible name, e.g. "Uploading logo". */
  label: string;
  /** Show the label and percentage above the bar. */
  showLabel?: boolean;
  className?: string;
}

/** Task progress bar (role="progressbar"). */
export function Progress({ value, max = 100, label, showLabel = false, className }: ProgressProps) {
  const pct = value === undefined ? undefined : Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {showLabel ? (
        <div className="flex justify-between text-sm text-ink-2">
          <span>{label}</span>
          {pct !== undefined ? <span className="tabular-nums">{Math.round(pct)}%</span> : null}
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        className="h-2 w-full overflow-hidden rounded-full bg-surface-3"
      >
        <div
          className={cn("h-full rounded-full bg-green-700 transition-[width]", pct === undefined && "w-1/3 animate-soft-pulse")}
          style={pct !== undefined ? { width: `${pct}%` } : undefined}
        />
      </div>
    </div>
  );
}

export interface MeterProps {
  /** e.g. "Social posts" */
  label: string;
  used: number;
  max: number;
  /** Unit used in the text, e.g. "posts". */
  unit?: string;
  /** Alert thresholds as fractions. Default 70 / 90 / 100 %. */
  thresholds?: readonly [number, number, number];
  /** Extra line under the meter, e.g. "Resets on 1 Nov". */
  footnote?: ReactNode;
  className?: string;
}

/**
 * Usage meter for monthly limits. Changes color AND icon AND text at 70%, 90%
 * and 100% so the state never relies on color alone.
 */
export function Meter({ label, used, max, unit, thresholds = [0.7, 0.9, 1], footnote, className }: MeterProps) {
  const ratio = max > 0 ? used / max : used > 0 ? 1 : 0;
  const pct = Math.round(ratio * 100);
  const level = ratio >= thresholds[2] ? 3 : ratio >= thresholds[1] ? 2 : ratio >= thresholds[0] ? 1 : 0;
  const bar = ["bg-green-700", "bg-[#b7791f]", "bg-amber-800", "bg-red-800"][level];
  const state = [
    null,
    { text: `${Math.round(thresholds[0] * 100)}% used — heads up`, Icon: TriangleAlert, cls: "text-amber-800" },
    { text: "Almost used up", Icon: TriangleAlert, cls: "text-amber-800" },
    { text: "Limit reached — nothing more runs until it resets or you add capacity", Icon: CircleAlert, cls: "text-red-800" },
  ][level];
  const unitText = unit ? ` ${unit}` : "";
  const valueText = `${formatNumber(used)} of ${formatNumber(max)}${unitText} used (${pct}%)`;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="text-[0.95rem] font-medium text-ink">{label}</span>
        <span className="text-sm tabular-nums text-ink-2">{valueText}</span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.min(used, max)}
        aria-valuetext={valueText}
        className="relative h-2.5 w-full overflow-hidden rounded-full bg-surface-3"
      >
        <div className={cn("h-full rounded-full", bar)} style={{ width: `${Math.min(100, pct)}%` }} />
        {thresholds.slice(0, 2).map((t) => (
          <span key={t} aria-hidden="true" className="absolute inset-y-0 w-px bg-white/80" style={{ left: `${t * 100}%` }} />
        ))}
      </div>
      {state ? (
        <p className={cn("flex items-start gap-1.5 text-sm font-medium", state.cls)}>
          <state.Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {state.text}
        </p>
      ) : (
        <p className="flex items-center gap-1.5 text-sm text-ink-3">
          <CircleCheck aria-hidden="true" className="size-4 text-green-700" />
          Plenty left
        </p>
      )}
      {footnote ? <p className="text-sm text-ink-3">{footnote}</p> : null}
    </div>
  );
}
