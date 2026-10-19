"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { CircleAlert, CircleCheck, Clock, Loader2, PlugZap, RefreshCw, Unplug, WifiOff, Globe, CirclePause } from "@/components/icons";
import { Button, Spinner } from "@/components/ui";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Status dot + badge                                                  */
/* ------------------------------------------------------------------ */

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral" | "progress";

const dotTone: Record<StatusTone, string> = {
  success: "bg-green-800",
  warning: "bg-amber-500",
  danger: "bg-red-800",
  info: "bg-chart-3",
  neutral: "bg-ink-3",
  progress: "bg-brand-700",
};

const badgeTone: Record<StatusTone, string> = {
  success: "bg-green-100 text-green-800",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-red-100 text-red-800",
  info: "bg-surface-2 text-ink-2 ring-1 ring-inset ring-line-strong",
  neutral: "bg-surface-3/70 text-ink-2",
  progress: "bg-brand-50 text-brand-900",
};

export interface StatusDotProps {
  tone?: StatusTone;
  /** Animated halo for live / in-progress states (static under reduced motion). */
  pulse?: boolean;
  size?: "sm" | "md" | "lg";
  /** Accessible text. Omit when a visible label sits next to the dot. */
  label?: string;
  className?: string;
}

/** Small round status marker. Always pair it with text (visible or `label`). */
export function StatusDot({ tone = "neutral", pulse, size = "md", label, className }: StatusDotProps) {
  const s = size === "sm" ? "size-1.5" : size === "lg" ? "size-2.5" : "size-2";
  return (
    <span className={cn("relative inline-flex shrink-0", s, className)} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {pulse ? <span className={cn("absolute inset-0 rounded-full opacity-60 motion-safe:animate-ping", dotTone[tone])} /> : null}
      <span className={cn("relative inline-flex rounded-full", s, dotTone[tone])} />
    </span>
  );
}

export interface StatusBadgeProps {
  tone?: StatusTone;
  children: ReactNode;
  pulse?: boolean;
  icon?: ReactNode;
  className?: string;
}

/** Pill with a dot (or icon) and a word. The word carries the meaning. */
export function StatusBadge({ tone = "neutral", children, pulse, icon, className }: StatusBadgeProps) {
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 rounded-[var(--radius-badge)] px-2 text-xs font-medium [&_svg]:size-3.5", badgeTone[tone], className)}>
      {icon ? <span aria-hidden="true" className="inline-flex">{icon}</span> : <StatusDot tone={tone} pulse={pulse} size="sm" />}
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Notification badge                                                  */
/* ------------------------------------------------------------------ */

export interface NotificationBadgeProps {
  count?: number;
  /** Cap before showing "99+". */
  max?: number;
  /** Dot only, no number. */
  dot?: boolean;
  /** What is being counted, for screen readers: "unread messages". */
  label?: string;
  children: ReactNode;
  className?: string;
}

/** Count or dot pinned to the corner of an icon or avatar. Hidden at 0. */
export function NotificationBadge({ count = 0, max = 99, dot, label = "new", children, className }: NotificationBadgeProps) {
  const show = dot || count > 0;
  const text = count > max ? `${max}+` : String(count);
  return (
    <span className={cn("relative inline-flex", className)}>
      {children}
      {show ? (
        dot ? (
          <span className="absolute right-1 top-1 size-2 rounded-full bg-red-800 ring-2 ring-surface">
            <span className="sr-only">{label}</span>
          </span>
        ) : (
          <span className="pointer-events-none absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-800 px-1 text-2xs font-semibold leading-none tabular-nums text-white ring-2 ring-surface">
            <span aria-hidden="true">{text}</span>
            <span className="sr-only">{`${count} ${label}`}</span>
          </span>
        )
      ) : null}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Processing / sync / connection                                      */
/* ------------------------------------------------------------------ */

export type JobState = "queued" | "processing" | "done" | "failed";

export interface ProcessingStatusProps {
  label: ReactNode;
  state: JobState;
  /** 0–1 while processing. */
  progress?: number;
  /** e.g. "Step 2 of 3 · Writing captions" */
  detail?: ReactNode;
  /** e.g. "About 40 s left" */
  eta?: ReactNode;
  onRetry?: () => void;
  className?: string;
}

const jobText: Record<JobState, string> = { queued: "Queued", processing: "Processing", done: "Done", failed: "Didn't finish" };

/** One background job: state word, mini bar, current step and time left. */
export function ProcessingStatus({ label, state, progress = 0, detail, eta, onRetry, className }: ProcessingStatusProps) {
  const pct = Math.round(Math.min(1, Math.max(0, state === "done" ? 1 : progress)) * 100);
  return (
    <div className={cn("flex items-center gap-3 py-2.5", className)}>
      <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-[var(--radius-control)] bg-surface-2 text-ink-2 [&_svg]:size-4">
        {state === "processing" ? <Spinner /> : state === "done" ? <CircleCheck className="text-green-800" /> : state === "failed" ? <CircleAlert className="text-red-800" /> : <Clock />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="truncate text-ui font-medium text-ink">{label}</p>
          <p className={cn("shrink-0 text-xs tabular-nums", state === "failed" ? "font-medium text-red-800" : "text-ink-3")}>
            {state === "processing" ? `${pct}%` : jobText[state]}
          </p>
        </div>
        {state === "processing" ? (
          <div role="progressbar" aria-label={typeof label === "string" ? label : "Processing"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full rounded-full bg-brand-700 transition-[width] duration-200" style={{ width: `${pct}%` }} />
          </div>
        ) : null}
        {detail || eta || (state === "failed" && onRetry) ? (
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-ink-3">
            {detail ? <span>{detail}</span> : null}
            {detail && eta ? <span aria-hidden="true">·</span> : null}
            {eta ? <span className="tabular-nums">{eta}</span> : null}
            {state === "failed" && onRetry ? (
              <button type="button" onClick={onRetry} className="font-medium text-ink underline underline-offset-2 hover:no-underline">
                Retry
              </button>
            ) : null}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export type SyncState = "synced" | "syncing" | "error" | "paused";

export interface SyncStatusProps {
  state: SyncState;
  /** e.g. "2 min ago" */
  lastSynced?: string;
  source?: string;
  onSync?: () => void;
  className?: string;
}

/** Compact "Synced 2 min ago · Sync now" line for data that comes from elsewhere. */
export function SyncStatus({ state, lastSynced, source, onSync, className }: SyncStatusProps) {
  const text =
    state === "syncing" ? `Syncing${source ? ` ${source}` : ""}…` : state === "error" ? "Sync failed" : state === "paused" ? "Sync paused" : `Synced${lastSynced ? ` ${lastSynced}` : ""}`;
  return (
    <div className={cn("inline-flex items-center gap-2 text-xs", className)}>
      <span role="status" className={cn("inline-flex items-center gap-1.5", state === "error" ? "font-medium text-red-800" : "text-ink-3")}>
        <span aria-hidden="true" className="inline-flex [&_svg]:size-3.5">
          {state === "syncing" ? <RefreshCw className="motion-safe:animate-spin" /> : state === "error" ? <CircleAlert /> : state === "paused" ? <CirclePause /> : <CircleCheck className="text-green-800" />}
        </span>
        {text}
      </span>
      {onSync && state !== "syncing" ? (
        <button type="button" onClick={onSync} className="rounded-[var(--radius-control)] font-medium text-ink underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]">
          {state === "error" ? "Try again" : state === "paused" ? "Resume" : "Sync now"}
        </button>
      ) : null}
    </div>
  );
}

export type ConnectionState = "connected" | "connecting" | "attention" | "disconnected";

const connMeta: Record<ConnectionState, { tone: StatusTone; text: string; Icon: typeof Globe }> = {
  connected: { tone: "success", text: "Connected", Icon: PlugZap },
  connecting: { tone: "progress", text: "Connecting…", Icon: Loader2 },
  attention: { tone: "warning", text: "Needs reconnect", Icon: CircleAlert },
  disconnected: { tone: "neutral", text: "Not connected", Icon: Unplug },
};

export interface ConnectionStatusProps {
  name: ReactNode;
  icon?: ReactNode;
  state: ConnectionState;
  detail?: ReactNode;
  onAction?: () => void;
  className?: string;
}

/** Integration row: name, state badge, one-line reason and the next step. */
export function ConnectionStatus({ name, icon, state, detail, onAction, className }: ConnectionStatusProps) {
  const m = connMeta[state];
  const action = state === "connected" ? "Manage" : state === "attention" ? "Reconnect" : state === "disconnected" ? "Connect" : null;
  return (
    <div className={cn("flex flex-wrap items-center gap-3 py-2.5", className)}>
      <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-[var(--radius-control)] border border-line bg-surface text-ink-2 [&_svg]:size-4">
        {icon ?? <m.Icon />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-ui font-medium text-ink">{name}</p>
        {detail ? <p className="text-xs text-ink-3">{detail}</p> : null}
      </div>
      <StatusBadge tone={m.tone} pulse={state === "connecting"}>
        {m.text}
      </StatusBadge>
      {action && onAction ? (
        <Button size="sm" variant={state === "attention" ? "primary" : "secondary"} onClick={onAction}>
          {action}
        </Button>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Online / offline                                                    */
/* ------------------------------------------------------------------ */

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/** Browser connectivity (true on the server). */
export function useOnline() {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}

export interface OnlineIndicatorProps {
  /** Override the detected state (previews, tests). */
  online?: boolean;
  variant?: "pill" | "banner";
  className?: string;
}

/** Shows connectivity: a quiet pill when online, a clear banner when offline. */
export function OnlineIndicator({ online: forced, variant = "pill", className }: OnlineIndicatorProps) {
  const detected = useOnline();
  const online = forced ?? detected;
  if (variant === "banner") {
    if (online) return null;
    return (
      <div role="status" className={cn("flex items-center gap-2 rounded-[var(--radius-control)] bg-ink px-3 py-2 text-ui text-white", className)}>
        <WifiOff aria-hidden="true" className="size-4 shrink-0" />
        <span className="flex-1">You&apos;re offline. Changes are kept and sync when you reconnect.</span>
      </div>
    );
  }
  return (
    <span role="status" className={cn("inline-flex h-6 items-center gap-1.5 rounded-[var(--radius-badge)] px-2 text-xs font-medium", online ? "bg-green-100 text-green-800" : "bg-ink text-white", className)}>
      {online ? <StatusDot tone="success" size="sm" /> : <WifiOff aria-hidden="true" className="size-3.5" />}
      {online ? "Online" : "Offline"}
    </span>
  );
}
