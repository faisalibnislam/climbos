"use client";

import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, Pencil, WifiOff } from "@/components/icons";
import { Button, Spinner } from "@/components/ui";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Unsaved changes                                                     */
/* ------------------------------------------------------------------ */

/** Small "Unsaved" marker for a title or tab. */
export function UnsavedDot({ className, label = "Unsaved changes" }: { className?: string; label?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium text-amber-800", className)}>
      <span aria-hidden="true" className="size-2 rounded-full bg-amber-500 ring-2 ring-amber-100" />
      {label}
    </span>
  );
}

export interface UnsavedChangesBarProps {
  count: number;
  onSave: () => void;
  onDiscard: () => void;
  saving?: boolean;
  /** Sticks to the bottom of the nearest scroll area by default. */
  sticky?: boolean;
  className?: string;
}

/** Bottom bar that appears once a form is edited: count, Discard, Save. */
export function UnsavedChangesBar({ count, onSave, onDiscard, saving, sticky = true, className }: UnsavedChangesBarProps) {
  if (count <= 0) return null;
  return (
    <div
      role="region"
      aria-label="Unsaved changes"
      className={cn(
        "z-10 flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] bg-ink px-4 py-2.5 text-ui text-white shadow-[var(--shadow-lg)] animate-fade-up",
        sticky && "sticky bottom-4",
        className,
      )}
    >
      <Pencil aria-hidden="true" className="size-4 shrink-0 text-lime" />
      <p className="min-w-0 flex-1" aria-live="polite">
        {count === 1 ? "1 unsaved change" : `${count} unsaved changes`}
      </p>
      <Button size="sm" variant="ghost" className="text-white hover:bg-white/10 active:bg-white/15" onClick={onDiscard} disabled={saving}>
        Discard
      </Button>
      <Button size="sm" variant="accent" onClick={onSave} loading={saving} loadingText="Saving…">
        Save changes
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Auto-save                                                           */
/* ------------------------------------------------------------------ */

export type AutoSaveState = "idle" | "editing" | "saving" | "saved" | "error" | "offline";

export interface AutoSaveIndicatorProps {
  state: AutoSaveState;
  /** e.g. "10:42" or "just now" */
  savedAt?: ReactNode;
  onRetry?: () => void;
  className?: string;
}

/** Quiet save status beside a title: Saving… / Saved just now / Couldn't save · Retry. */
export function AutoSaveIndicator({ state, savedAt, onRetry, className }: AutoSaveIndicatorProps) {
  return (
    <span role="status" className={cn("inline-flex items-center gap-1.5 text-xs", state === "error" ? "font-medium text-red-800" : "text-ink-3", className)}>
      {state === "saving" ? (
        <>
          <Spinner /> Saving…
        </>
      ) : state === "editing" ? (
        <>
          <span aria-hidden="true" className="size-1.5 rounded-full bg-amber-500" /> Editing
        </>
      ) : state === "error" ? (
        <>
          <CircleAlert aria-hidden="true" className="size-3.5" /> Couldn&apos;t save
          {onRetry ? (
            <button type="button" onClick={onRetry} className="ml-1 font-medium text-ink underline underline-offset-2 hover:no-underline">
              Retry
            </button>
          ) : null}
        </>
      ) : state === "offline" ? (
        <>
          <WifiOff aria-hidden="true" className="size-3.5" /> Saved on this device
        </>
      ) : (
        <>
          <CircleCheck aria-hidden="true" className="size-3.5 text-green-800" /> {state === "saved" ? `Saved${savedAt ? ` ${savedAt}` : ""}` : "All changes saved"}
        </>
      )}
    </span>
  );
}
