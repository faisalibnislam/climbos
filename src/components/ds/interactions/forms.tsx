"use client";

/*
 * Form-flow patterns: progressive disclosure, conditional fields, sticky action bar
 * and multi-step form scaffolding (step indicator + state hook).
 */
import { useId, useState, type ReactNode } from "react";
import { Check, ChevronDown } from "@/components/icons";
import { cn } from "@/lib/utils";

/** "Show advanced" toggle. The panel stays in the DOM order right after its button. */
export function Disclosure({ summary, hint, children, defaultOpen = false, className }: { summary: string; hint?: string; children: ReactNode; defaultOpen?: boolean; className?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className={cn("flex flex-col", className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="group/dc -mx-2 flex items-center gap-2 self-start rounded-[var(--radius-control)] px-2 py-1.5 text-ui font-medium text-ink outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
      >
        <ChevronDown aria-hidden className={cn("size-4 text-ink-3 transition-transform", !open && "-rotate-90")} />
        {summary}
        {hint && !open ? <span className="font-normal text-ink-3">{hint}</span> : null}
      </button>
      <div id={id} hidden={!open} className="animate-fade-in pl-6 pt-2">
        {open ? children : null}
      </div>
    </div>
  );
}

/** Renders its fields only when `when` is true, with a quiet entrance and an indent rule. */
export function ConditionalField({ when, children, className }: { when: boolean; children: ReactNode; className?: string }) {
  if (!when) return null;
  return <div className={cn("animate-step-in border-l-2 border-line-strong pl-4", className)}>{children}</div>;
}

/**
 * Bar that sticks to the bottom of its scroll container while `show` is true.
 * Use for unsaved changes or bulk actions; the only place besides top bars that blurs.
 */
export function StickyActionBar({ show, message, children, className }: { show: boolean; message: ReactNode; children: ReactNode; className?: string }) {
  if (!show) return null;
  return (
    <div role="region" aria-label="Pending actions" className={cn("sticky bottom-3 z-20 mx-auto flex w-[calc(100%-1.5rem)] max-w-2xl flex-wrap items-center gap-3 rounded-[var(--radius-card)] bg-ink/95 px-4 py-2.5 text-white shadow-lg backdrop-blur animate-fade-up", className)}>
      <span aria-live="polite" className="min-w-0 flex-1 text-ui">
        {message}
      </span>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Multi-step                                                          */
/* ------------------------------------------------------------------ */

export interface FormStep {
  id: string;
  label: string;
}

/** Step state with guarded forward moves (pass a validator) and free backward moves. */
export function useSteps(steps: FormStep[]) {
  const [index, setIndex] = useState(0);
  const [visited, setVisited] = useState(0);
  return {
    index,
    step: steps[index],
    first: index === 0,
    last: index === steps.length - 1,
    visited,
    next: (valid = true) => {
      if (!valid) return false;
      const n = Math.min(steps.length - 1, index + 1);
      setIndex(n);
      setVisited((v) => Math.max(v, n));
      return true;
    },
    back: () => setIndex((i) => Math.max(0, i - 1)),
    goTo: (i: number) => i <= visited && setIndex(i),
    reset: () => {
      setIndex(0);
      setVisited(0);
    },
  };
}

/** Numbered step header. Done steps show a check and can be revisited. */
export function StepIndicator({ steps, index, visited, onGoTo }: { steps: FormStep[]; index: number; visited: number; onGoTo?: (i: number) => void }) {
  return (
    <nav aria-label="Progress">
      <ol className="flex items-center gap-2">
        {steps.map((s, i) => {
          const done = i < index;
          const cur = i === index;
          const reachable = i <= visited && !cur;
          return (
            <li key={s.id} className="flex min-w-0 flex-1 items-center gap-2">
              <button
                type="button"
                disabled={!reachable}
                onClick={() => onGoTo?.(i)}
                aria-current={cur ? "step" : undefined}
                className="flex min-w-0 items-center gap-2 rounded-[var(--radius-control)] text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:cursor-default"
              >
                <span
                  aria-hidden
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full text-2xs font-semibold tabular-nums",
                    cur ? "bg-ink text-white" : done ? "bg-brand-700 text-white" : "border border-line-strong bg-surface text-ink-3",
                  )}
                >
                  {done ? <Check className="size-3.5" /> : i + 1}
                </span>
                <span className={cn("hidden truncate text-ui sm:block", cur ? "font-semibold text-ink" : done ? "text-ink-2" : "text-ink-3")}>{s.label}</span>
                <span className="sr-only">
                  {s.label}
                  {done ? ", done" : cur ? ", current step" : ""}
                </span>
              </button>
              {i < steps.length - 1 ? <span aria-hidden className={cn("h-px min-w-3 flex-1", done ? "bg-brand-700" : "bg-line-strong")} /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
