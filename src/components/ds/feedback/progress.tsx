"use client";

import type { ReactNode } from "react";
import { Check, CircleAlert, CircleCheck, FileText, Image as ImageIcon, RotateCcw, X } from "@/components/icons";
import { ProgressRing, Skeleton, Spinner, StepList, type StepItem } from "@/components/ui";
import { cn } from "@/lib/utils";
import { formatBytes, formatTimeLeft } from "./use-simulation";

/* ------------------------------------------------------------------ */
/* Live progress (bar + time left + steps)                             */
/* ------------------------------------------------------------------ */

export type LiveState = "idle" | "running" | "paused" | "done" | "failed";

const liveText: Record<LiveState, string> = {
  idle: "Ready to start",
  running: "Working",
  paused: "Paused",
  done: "Finished",
  failed: "Stopped with a problem",
};

export interface LiveProgressProps {
  title: ReactNode;
  /** 0–1 */
  value: number;
  state: LiveState;
  secondsLeft?: number | null;
  /** Latest finding or current action, shown under the bar. */
  detail?: ReactNode;
  steps?: StepItem[];
  actions?: ReactNode;
  className?: string;
}

/**
 * The standard "ClimbOS is working" block: bar, percentage, time left, the
 * current step and the full step list. Use it wherever a job takes > 3 s.
 */
export function LiveProgress({ title, value, state, secondsLeft, detail, steps, actions, className }: LiveProgressProps) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  const bar = state === "done" ? "bg-green-800" : state === "failed" ? "bg-red-800" : state === "paused" ? "bg-ink-3" : "bg-ink";
  const label = typeof title === "string" ? title : "Progress";
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="text-sm font-semibold tabular-nums text-ink">{pct}%</p>
      </div>
      <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-valuetext={`${pct}%, ${liveText[state]}`} className="h-2 overflow-hidden rounded-full bg-surface-3">
        <div className={cn("h-full rounded-full transition-[width] duration-200 ease-linear", bar)} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs" aria-live="polite">
        <span className={cn("inline-flex items-center gap-1.5 font-medium", state === "failed" ? "text-red-800" : state === "done" ? "text-green-800" : "text-ink-2")}>
          {state === "running" ? <Spinner /> : state === "done" ? <CircleCheck aria-hidden="true" className="size-3.5" /> : state === "failed" ? <CircleAlert aria-hidden="true" className="size-3.5" /> : null}
          {liveText[state]}
          {detail ? <span className="font-normal text-ink-3">· {detail}</span> : null}
        </span>
        {state === "running" || state === "paused" ? <span className="tabular-nums text-ink-3">{formatTimeLeft(secondsLeft)}</span> : null}
      </div>
      {steps?.length ? <StepList steps={steps} className="mt-1 text-ui" /> : null}
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

/** Map a 0–1 value onto named steps (equal share each) for LiveProgress. */
export function stepsFromProgress(labels: { key: string; label: ReactNode; finding?: ReactNode }[], value: number, state: LiveState): StepItem[] {
  const n = labels.length;
  const current = Math.min(n - 1, Math.floor(value * n));
  return labels.map((s, i) => ({
    key: s.key,
    label: s.label,
    status: state === "done" || i < current ? "done" : i === current && state !== "idle" ? (state === "failed" ? "failed" : "running") : "pending",
    detail: state === "done" || i < current ? s.finding : undefined,
  }));
}

/* ------------------------------------------------------------------ */
/* Circular progress                                                   */
/* ------------------------------------------------------------------ */

export interface CircularProgressProps {
  /** 0–1 */
  value: number;
  label: string;
  size?: number;
  /** Text under the label, e.g. time left. */
  meta?: ReactNode;
  tone?: "default" | "done";
  className?: string;
}

/** Ring with % in the centre plus a label and meta line beside it. */
export function CircularProgress({ value, label, size = 56, meta, tone = "default", className }: CircularProgressProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <ProgressRing value={value} size={size} label={label} color={tone === "done" ? "var(--green-800)" : "var(--chart-2)"} />
      <div className="min-w-0">
        <p className="text-ui font-medium text-ink">{label}</p>
        {meta ? <p className="text-xs tabular-nums text-ink-3">{meta}</p> : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step progress (horizontal)                                          */
/* ------------------------------------------------------------------ */

export interface StepProgressProps {
  steps: string[];
  /** Index of the current step. Steps before it are done. */
  current: number;
  /** Lets people jump back to finished steps. */
  onStepClick?: (i: number) => void;
  className?: string;
}

/** Numbered steps with connectors for multi-step flows (wizards, checkout). */
export function StepProgress({ steps, current, onStepClick, className }: StepProgressProps) {
  return (
    <ol className={cn("flex w-full items-start", className)} aria-label="Progress">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        const inner = (
          <>
            <span
              aria-hidden="true"
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold tabular-nums ring-1",
                done ? "bg-ink text-white ring-ink" : active ? "bg-lime text-ink ring-ink" : "bg-surface text-ink-3 ring-line-strong",
              )}
            >
              {done ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span className={cn("mt-1.5 max-w-24 text-center text-xs leading-tight", active ? "font-semibold text-ink" : done ? "text-ink-2" : "text-ink-3")}>
              {s}
              <span className="sr-only">{done ? " (done)" : active ? " (current)" : ""}</span>
            </span>
          </>
        );
        return (
          <li key={s} className="relative flex flex-1 flex-col items-center" aria-current={active ? "step" : undefined}>
            {i > 0 ? <span aria-hidden="true" className={cn("absolute top-3.5 h-px", i <= current ? "bg-ink" : "bg-line-strong")} style={{ left: "calc(-50% + 18px)", right: "calc(50% + 18px)" }} /> : null}
            {done && onStepClick ? (
              <button type="button" onClick={() => onStepClick(i)} className="relative flex flex-col items-center rounded-[var(--radius-control)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]">
                {inner}
              </button>
            ) : (
              <span className="relative flex flex-col items-center">{inner}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/* Upload progress                                                     */
/* ------------------------------------------------------------------ */

export type UploadState = "queued" | "uploading" | "done" | "failed";

export interface UploadItem {
  id: string;
  name: string;
  size: number;
  loaded: number;
  state: UploadState;
  /** Bytes per second, for time left. */
  rate?: number;
  error?: string;
}

export interface UploadProgressProps {
  items: UploadItem[];
  onCancel?: (id: string) => void;
  onRetry?: (id: string) => void;
  onRemove?: (id: string) => void;
  className?: string;
}

/** File list with per-file bar, bytes, time left and cancel / retry. Plus an overall line. */
export function UploadProgress({ items, onCancel, onRetry, onRemove, className }: UploadProgressProps) {
  const total = items.reduce((a, f) => a + f.size, 0);
  const loaded = items.reduce((a, f) => a + (f.state === "done" ? f.size : f.loaded), 0);
  const active = items.filter((f) => f.state === "uploading" || f.state === "queued");
  const doneCount = items.filter((f) => f.state === "done").length;
  const rate = items.reduce((a, f) => a + (f.state === "uploading" ? (f.rate ?? 0) : 0), 0);
  const secondsLeft = rate > 0 ? (total - loaded) / rate : null;
  return (
    <div className={cn("flex flex-col", className)}>
      {items.length ? (
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-xs text-ink-3" aria-live="polite">
          <span>
            <span className="font-semibold text-ink">{doneCount} of {items.length}</span> uploaded · {formatBytes(loaded)} of {formatBytes(total)}
          </span>
          {active.length ? <span className="tabular-nums">{formatTimeLeft(secondsLeft)}</span> : null}
        </div>
      ) : null}
      <ul className="flex flex-col divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface">
        {items.map((f) => {
          const pct = f.size ? Math.round(((f.state === "done" ? f.size : f.loaded) / f.size) * 100) : 0;
          const left = f.rate && f.state === "uploading" ? (f.size - f.loaded) / f.rate : null;
          const isImage = /\.(png|jpe?g|gif|webp|svg)$/i.test(f.name);
          return (
            <li key={f.id} className="flex items-center gap-3 px-3 py-2.5">
              <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-[var(--radius-control)] bg-surface-2 text-ink-2 [&_svg]:size-4">
                {isImage ? <ImageIcon /> : <FileText />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-ui font-medium text-ink">{f.name}</p>
                  <p className={cn("shrink-0 text-xs tabular-nums", f.state === "failed" ? "font-medium text-red-800" : f.state === "done" ? "text-green-800" : "text-ink-3")}>
                    {f.state === "done" ? "Uploaded" : f.state === "failed" ? "Failed" : f.state === "queued" ? "Waiting" : `${pct}%`}
                  </p>
                </div>
                {f.state === "uploading" || f.state === "queued" ? (
                  <div role="progressbar" aria-label={`Uploading ${f.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-3">
                    <div className="h-full rounded-full bg-ink transition-[width] duration-200" style={{ width: `${pct}%` }} />
                  </div>
                ) : null}
                <p className="mt-1 text-xs tabular-nums text-ink-3">
                  {f.state === "failed" ? (f.error ?? "Connection dropped") : f.state === "uploading" ? `${formatBytes(f.loaded)} of ${formatBytes(f.size)} · ${formatTimeLeft(left)}` : formatBytes(f.size)}
                </p>
              </div>
              <div className="flex shrink-0 items-center">
                {f.state === "failed" && onRetry ? (
                  <button type="button" onClick={() => onRetry(f.id)} aria-label={`Retry ${f.name}`} className="grid size-8 place-items-center rounded-[var(--radius-control)] text-ink-2 hover:bg-surface-2 hover:text-ink">
                    <RotateCcw aria-hidden="true" className="size-4" />
                  </button>
                ) : null}
                {(f.state === "uploading" || f.state === "queued") && onCancel ? (
                  <button type="button" onClick={() => onCancel(f.id)} aria-label={`Cancel ${f.name}`} className="grid size-8 place-items-center rounded-[var(--radius-control)] text-ink-2 hover:bg-surface-2 hover:text-ink">
                    <X aria-hidden="true" className="size-4" />
                  </button>
                ) : null}
                {(f.state === "done" || f.state === "failed") && onRemove ? (
                  <button type="button" onClick={() => onRemove(f.id)} aria-label={`Remove ${f.name}`} className="grid size-8 place-items-center rounded-[var(--radius-control)] text-ink-3 hover:bg-surface-2 hover:text-ink">
                    <X aria-hidden="true" className="size-4" />
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Loading                                                             */
/* ------------------------------------------------------------------ */

/** Spinner with visible text. `block` centres it in a panel-sized area. */
export function LoadingSpinner({ label = "Loading…", block, size = "md", className }: { label?: string; block?: boolean; size?: "sm" | "md" | "lg"; className?: string }) {
  const s = size === "sm" ? "text-sm" : size === "lg" ? "text-2xl" : "text-base";
  return (
    <div role="status" className={cn("flex items-center gap-2 text-ui text-ink-2", block && "min-h-32 flex-col justify-center gap-3", className)}>
      <Spinner className={cn(s, "text-ink")} />
      <span>{label}</span>
    </div>
  );
}

/** Skeleton shaped like a card: title line, two text lines, a footer chip. */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-[var(--card-p)]", className)}>
      <div className="flex items-center gap-3">
        <Skeleton className="size-9 rounded-[var(--radius-control)]" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-3.5 w-2/5" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
      <Skeleton className="h-6 w-20 rounded-[var(--radius-badge)]" />
    </div>
  );
}

/** Skeleton rows shaped like a table body. */
export function SkeletonRows({ rows = 4, className }: { rows?: number; className?: string }) {
  const widths = ["w-3/5", "w-2/5", "w-1/2", "w-1/3", "w-2/3"];
  return (
    <div aria-hidden="true" className={cn("flex flex-col divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface", className)}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex h-[var(--cell-h)] items-center gap-3 px-3">
          <Skeleton className="size-6 rounded-full" />
          <Skeleton className={cn("h-3", widths[i % widths.length])} />
          <Skeleton className="ml-auto h-5 w-16 rounded-[var(--radius-badge)]" />
        </div>
      ))}
    </div>
  );
}
