"use client";

/*
 * Onboarding overlay (coach marks). <OnboardingTour> dims its area; the current
 * <OnboardingTarget> lifts above the dim layer with a ring and a coach card beside it.
 * No measuring: the target and its card render in place. Esc ends, ← → step.
 */
import { createContext, useContext, useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { X } from "@/components/icons";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface TourStep {
  /** Matches an <OnboardingTarget id>. Omit for a centred welcome card. */
  target?: string;
  title: string;
  body: string;
  placement?: "top" | "bottom" | "right";
}

interface Ctx {
  steps: TourStep[];
  step: number | null;
  go: (n: number | null) => void;
}
const TourCtx = createContext<Ctx | null>(null);

function CoachCard({ className }: { className?: string }) {
  const ctx = useContext(TourCtx)!;
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const i = ctx.step ?? 0;
  const s = ctx.steps[i];
  const last = i === ctx.steps.length - 1;
  useEffect(() => {
    ref.current?.focus();
  }, [i]);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") ctx.go(null);
    else if (e.key === "ArrowRight" && !last) ctx.go(i + 1);
    else if (e.key === "ArrowLeft" && i > 0) ctx.go(i - 1);
  };
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="dialog"
      aria-labelledby={`${id}-t`}
      aria-describedby={`${id}-b`}
      onKeyDown={onKey}
      className={cn("z-30 w-[min(18rem,80vw)] rounded-[var(--radius-card)] bg-ink p-4 text-left text-white shadow-lg outline-none animate-step-in", className)}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-overline !text-white/70">
          Step {i + 1} of {ctx.steps.length}
        </p>
        <button type="button" aria-label="End tour" onClick={() => ctx.go(null)} className="-mr-1 -mt-1 grid size-7 place-items-center rounded-[var(--radius-control)] text-white/80 outline-none hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-lime">
          <X aria-hidden className="size-4" />
        </button>
      </div>
      <p id={`${id}-t`} className="heading-card mt-1 !text-white">
        {s.title}
      </p>
      <p id={`${id}-b`} className="mt-1 text-ui text-white/85">
        {s.body}
      </p>
      <div className="mt-4 flex items-center gap-2">
        <span aria-hidden className="flex flex-1 gap-1">
          {ctx.steps.map((_, j) => (
            <span key={j} className={cn("h-1 w-4 rounded-full", j === i ? "bg-lime" : "bg-white/30")} />
          ))}
        </span>
        {i > 0 ? (
          <button type="button" onClick={() => ctx.go(i - 1)} className="h-8 rounded-[var(--radius-control)] px-2.5 text-ui font-medium text-white/85 outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-lime">
            Back
          </button>
        ) : null}
        <Button size="sm" variant="accent" onClick={() => ctx.go(last ? null : i + 1)}>
          {last ? "Finish" : "Next"}
        </Button>
      </div>
    </div>
  );
}

/** Wraps the area the tour covers. Controlled: `step` null means off. */
export function OnboardingTour({ steps, step, onStepChange, children, className }: { steps: TourStep[]; step: number | null; onStepChange: (n: number | null) => void; children: ReactNode; className?: string }) {
  const cur = step === null ? null : steps[step];
  return (
    <TourCtx.Provider value={{ steps, step, go: onStepChange }}>
      <div className={cn("relative", className)}>
        {children}
        {cur ? <div aria-hidden className="absolute inset-0 z-10 rounded-[inherit] bg-ink/45 animate-fade-in" onClick={() => onStepChange(null)} /> : null}
        {cur && !cur.target ? (
          <div className="absolute inset-0 z-30 grid place-items-center p-4">
            <CoachCard />
          </div>
        ) : null}
      </div>
    </TourCtx.Provider>
  );
}

/** Something a tour step can point at. */
export function OnboardingTarget({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
  const ctx = useContext(TourCtx);
  const s = ctx && ctx.step !== null ? ctx.steps[ctx.step] : null;
  const on = s?.target === id;
  const place = s?.placement ?? "bottom";
  return (
    <div className={cn("relative", on && "z-20 rounded-[var(--radius-card)] bg-surface ring-2 ring-lime ring-offset-4 ring-offset-transparent", className)}>
      {children}
      {on ? (
        <div className={cn("absolute", place === "bottom" ? "left-0 top-full mt-4" : place === "top" ? "bottom-full left-0 mb-4" : "left-full top-0 ml-4")}>
          <CoachCard />
        </div>
      ) : null}
    </div>
  );
}
