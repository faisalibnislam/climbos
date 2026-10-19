"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, RefreshCw, SearchX, TriangleAlert, X, Cog, Copy, Check } from "@/components/icons";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

export type MessageTone = "info" | "success" | "warning" | "danger" | "neutral";

const toneIcon = { info: Info, success: CircleCheck, warning: TriangleAlert, danger: CircleAlert, neutral: Info };

/* ------------------------------------------------------------------ */
/* Alert banner                                                        */
/* ------------------------------------------------------------------ */

const bannerTone: Record<MessageTone, string> = {
  info: "bg-brand-50 text-brand-900 border-brand-200",
  success: "bg-green-100 text-green-800 border-green-500/30",
  warning: "bg-amber-100 text-amber-800 border-amber-500/40",
  danger: "bg-red-100 text-red-800 border-red-500/30",
  neutral: "bg-ink text-white border-ink",
};

export interface AlertBannerProps {
  tone?: MessageTone;
  children: ReactNode;
  /** Optional bold lead-in, e.g. "Payment failed." */
  title?: ReactNode;
  action?: ReactNode;
  onDismiss?: () => void;
  className?: string;
}

/** Full-width bar at the top of a page or panel for account-wide news. */
export function AlertBanner({ tone = "info", title, children, action, onDismiss, className }: AlertBannerProps) {
  const Icon = toneIcon[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-2.5 text-ui sm:flex-nowrap", bannerTone[tone], className)}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <p className="min-w-0 flex-1">
        {title ? <span className="font-semibold">{title} </span> : null}
        {children}
      </p>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="-my-1 -mr-1 grid size-7 shrink-0 place-items-center rounded-[var(--radius-control)] opacity-80 hover:bg-black/5 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Inline alert                                                        */
/* ------------------------------------------------------------------ */

const inlineTone: Record<MessageTone, string> = {
  info: "text-ink-2 [&_.ia-icon]:text-brand-800",
  success: "text-green-800",
  warning: "text-amber-800",
  danger: "text-red-800",
  neutral: "text-ink-3",
};

/** One-line message that sits next to the thing it's about (under a field, in a card row). */
export function InlineAlert({ tone = "info", children, action, className }: { tone?: MessageTone; children: ReactNode; action?: ReactNode; className?: string }) {
  const Icon = toneIcon[tone];
  return (
    <p role={tone === "danger" ? "alert" : undefined} className={cn("flex items-start gap-1.5 text-ui font-medium", inlineTone[tone], className)}>
      <Icon aria-hidden="true" className="ia-icon mt-px size-4 shrink-0" />
      <span className="min-w-0">
        {children}
        {action ? <span className="ml-2 inline-flex">{action}</span> : null}
      </span>
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Page states                                                         */
/* ------------------------------------------------------------------ */

function StateFrame({ icon, title, children, actions, className, tone = "default" }: { icon: ReactNode; title: ReactNode; children?: ReactNode; actions?: ReactNode; className?: string; tone?: "default" | "danger" }) {
  return (
    <div className={cn("flex flex-col items-center gap-2 rounded-[var(--radius-card)] border border-dashed border-line-strong bg-surface px-6 py-10 text-center", className)}>
      <span aria-hidden="true" className={cn("mb-1 grid size-10 place-items-center rounded-[var(--radius-card)] ring-1 ring-line [&_svg]:size-5", tone === "danger" ? "bg-red-100 text-red-800" : "bg-surface-2 text-ink-2")}>
        {icon}
      </span>
      <h3 className="heading-empty">{title}</h3>
      {children ? <div className="max-w-md text-sm text-ink-3">{children}</div> : null}
      {actions ? <div className="mt-2 flex flex-wrap justify-center gap-2">{actions}</div> : null}
    </div>
  );
}

export interface NoResultsStateProps {
  query?: string;
  /** Other searches to try. */
  suggestions?: string[];
  onSuggestion?: (s: string) => void;
  onClear?: () => void;
  className?: string;
}

/** Search or filters matched nothing: say what was searched and how to widen it. */
export function NoResultsState({ query, suggestions, onSuggestion, onClear, className }: NoResultsStateProps) {
  return (
    <StateFrame
      className={className}
      icon={<SearchX />}
      title={query ? <>No results for &ldquo;{query}&rdquo;</> : "No matches"}
      actions={onClear ? <Button variant="secondary" size="sm" onClick={onClear}>Clear search and filters</Button> : null}
    >
      <p>Check the spelling, use fewer words or remove a filter.</p>
      {suggestions?.length ? (
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          <span className="text-xs text-ink-3">Try:</span>
          {suggestions.map((s) => (
            <button key={s} type="button" onClick={() => onSuggestion?.(s)} className="inline-flex h-6 items-center rounded-[var(--radius-badge)] bg-surface-2 px-2 text-xs font-medium text-ink-2 hover:bg-surface-3 hover:text-ink">
              {s}
            </button>
          ))}
        </div>
      ) : null}
    </StateFrame>
  );
}

export interface ErrorStateProps {
  title?: ReactNode;
  message?: ReactNode;
  /** Reference the user can quote to support. */
  reference?: string;
  onRetry?: () => void;
  retrying?: boolean;
  supportHref?: string;
  className?: string;
}

/** Something broke: plain cause, a retry and a reference for support. */
export function ErrorState({ title = "We couldn't load this", message = "Our server didn't answer in time. Your data is safe.", reference, onRetry, retrying, supportHref, className }: ErrorStateProps) {
  const [copied, setCopied] = useState(false);
  return (
    <StateFrame
      className={className}
      tone="danger"
      icon={<CircleAlert />}
      title={title}
      actions={
        <>
          {onRetry ? (
            <Button size="sm" onClick={onRetry} loading={retrying} loadingText="Retrying…">
              <RefreshCw aria-hidden="true" /> Try again
            </Button>
          ) : null}
          {supportHref ? (
            <Button size="sm" variant="secondary" asChild>
              <a href={supportHref}>Contact support</a>
            </Button>
          ) : null}
        </>
      }
    >
      <p>{message}</p>
      {reference ? (
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(reference);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          }}
          className="mt-2 inline-flex items-center gap-1 rounded-[var(--radius-badge)] bg-surface-2 px-2 py-0.5 font-mono text-2xs text-ink-2 hover:bg-surface-3"
        >
          Ref {reference}
          {copied ? <Check aria-hidden="true" className="size-3" /> : <Copy aria-hidden="true" className="size-3" />}
          <span className="sr-only">{copied ? "Copied" : "Copy reference"}</span>
        </button>
      ) : null}
    </StateFrame>
  );
}

export interface MaintenanceStateProps {
  /** e.g. "Back by 14:30 UTC" */
  until?: ReactNode;
  /** What still works, e.g. "Scheduled posts still publish." */
  stillWorks?: ReactNode;
  statusHref?: string;
  className?: string;
}

/** Planned downtime: when it ends, what keeps running, where to check. */
export function MaintenanceState({ until, stillWorks, statusHref, className }: MaintenanceStateProps) {
  return (
    <StateFrame
      className={className}
      icon={<Cog />}
      title="Down for planned maintenance"
      actions={statusHref ? <Button size="sm" variant="secondary" asChild><a href={statusHref}>Status page</a></Button> : null}
    >
      <p>We&apos;re upgrading ClimbOS. {until ? <strong className="font-semibold text-ink">{until}.</strong> : null}</p>
      {stillWorks ? <p className="mt-1">{stillWorks}</p> : null}
    </StateFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Retry action                                                        */
/* ------------------------------------------------------------------ */

export interface RetryActionProps {
  /** Runs the work. Resolve on success, reject on failure. */
  action: () => Promise<void>;
  /** Auto-retry delays in seconds, e.g. [3, 6, 12]. Empty = manual only. */
  backoff?: number[];
  failedText?: ReactNode;
  onSuccess?: () => void;
  className?: string;
}

/**
 * Failure line with "Retry now" plus automatic backoff ("Retrying in 3 s…").
 * Gives up after the backoff list and leaves the manual button.
 */
export function RetryAction({ action, backoff = [3, 6], failedText = "Couldn't publish the post.", onSuccess, className }: RetryActionProps) {
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<"failed" | "waiting" | "running" | "done">("failed");
  const [countdown, setCountdown] = useState(0);

  const run = async () => {
    setPhase("running");
    try {
      await action();
      setPhase("done");
      onSuccess?.();
    } catch {
      const next = attempt + 1;
      setAttempt(next);
      const delay = backoff[next - 1];
      if (delay) {
        setCountdown(delay);
        setPhase("waiting");
      } else setPhase("failed");
    }
  };

  useEffect(() => {
    if (phase !== "waiting") return;
    const id = window.setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== "waiting" || countdown > 0) return;
    const id = requestAnimationFrame(() => void run());
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once when the countdown hits 0
  }, [phase, countdown]);

  if (phase === "done") {
    return (
      <p role="status" className={cn("flex items-center gap-1.5 text-ui font-medium text-green-800", className)}>
        <CircleCheck aria-hidden="true" className="size-4" /> Done{attempt ? ` after ${attempt + 1} tries` : ""}.
      </p>
    );
  }
  return (
    <div role="status" className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 text-ui", className)}>
      <span className="flex items-center gap-1.5 font-medium text-red-800">
        <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
        {failedText}
      </span>
      <span className="text-ink-3 tabular-nums">
        {phase === "waiting" ? `Retrying in ${Math.max(0, countdown)} s…` : phase === "running" ? "Trying again…" : attempt ? `Tried ${attempt} ${attempt === 1 ? "time" : "times"}` : null}
      </span>
      <Button size="sm" variant="secondary" loading={phase === "running"} onClick={() => void run()}>
        <RefreshCw aria-hidden="true" /> Retry now
      </Button>
    </div>
  );
}
