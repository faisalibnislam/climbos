"use client";

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { X } from "@/components/icons";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Hint bubble (shared look for tooltips, tours and spotlights)        */
/* ------------------------------------------------------------------ */

export type Placement = "top" | "bottom" | "right" | "left";

export interface HintBubbleProps {
  title: ReactNode;
  body?: ReactNode;
  /** e.g. "2 of 4" */
  step?: ReactNode;
  /** Arrow side, pointing at the target. */
  placement?: Placement;
  /** Arrow offset from the bubble's start edge, in px. */
  arrowOffset?: number;
  primary?: { label: string; onClick: () => void };
  secondary?: { label: string; onClick: () => void };
  onClose?: () => void;
  className?: string;
  id?: string;
  /** Ink (default) for tours; white for quieter hints. */
  tone?: "ink" | "white";
  hideArrow?: boolean;
}

/** Small card with an arrow: title, text, step count and up to two actions. */
export function HintBubble({ title, body, step, placement = "bottom", arrowOffset = 20, primary, secondary, onClose, className, id, tone = "ink", hideArrow }: HintBubbleProps) {
  const ink = tone === "ink";
  const arrowPos: Record<Placement, string> = {
    bottom: "-top-1.5",
    top: "-bottom-1.5",
    right: "-left-1.5",
    left: "-right-1.5",
  };
  const vertical = placement === "top" || placement === "bottom";
  return (
    <div id={id} className={cn("relative w-72 max-w-full rounded-[var(--radius-card)] p-3.5 shadow-[var(--shadow-lg)]", ink ? "bg-ink text-white" : "border border-line bg-surface text-ink", className)}>
      <span
        aria-hidden="true"
        hidden={hideArrow}
        className={cn("absolute size-3 rotate-45", ink ? "bg-ink" : "border-l border-t border-line bg-surface", arrowPos[placement], !ink && placement === "top" && "rotate-[225deg]", !ink && placement === "right" && "-rotate-45", !ink && placement === "left" && "rotate-[135deg]")}
        style={vertical ? { left: arrowOffset } : { top: arrowOffset }}
      />
      <div className="relative flex items-start gap-2">
        <p className="min-w-0 flex-1 text-sm font-semibold">{title}</p>
        {onClose ? (
          <button type="button" onClick={onClose} aria-label="Close" className={cn("-m-1 grid size-7 shrink-0 place-items-center rounded-[var(--radius-control)]", ink ? "text-white/70 hover:bg-white/10 hover:text-white" : "text-ink-3 hover:bg-surface-2 hover:text-ink")}>
            <X aria-hidden="true" className="size-4" />
          </button>
        ) : null}
      </div>
      {body ? <div className={cn("relative mt-1 text-ui", ink ? "text-white/80" : "text-ink-2")}>{body}</div> : null}
      {step || primary || secondary ? (
        <div className="relative mt-3 flex items-center gap-2">
          {step ? <span className={cn("text-xs tabular-nums", ink ? "text-white/70" : "text-ink-3")}>{step}</span> : null}
          <span className="ml-auto flex gap-1.5">
            {secondary ? (
              <Button size="sm" variant="ghost" className={ink ? "text-white hover:bg-white/10 active:bg-white/15" : undefined} onClick={secondary.onClick}>
                {secondary.label}
              </Button>
            ) : null}
            {primary ? (
              <Button size="sm" variant={ink ? "accent" : "primary"} onClick={primary.onClick}>
                {primary.label}
              </Button>
            ) : null}
          </span>
        </div>
      ) : null}
    </div>
  );
}

/** Pulsing dot that draws the eye to something new. */
export function Beacon({ className, label }: { className?: string; label?: string }) {
  return (
    <span className={cn("pointer-events-none relative inline-flex size-3", className)} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <span className="absolute inset-0 rounded-full bg-lime opacity-80 motion-safe:animate-ping" />
      <span className="relative inline-flex size-3 rounded-full bg-lime ring-2 ring-ink" />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Guided tooltip                                                      */
/* ------------------------------------------------------------------ */

export interface GuidedTooltipProps extends Omit<HintBubbleProps, "className" | "id" | "arrowOffset"> {
  open: boolean;
  /** The element being explained. */
  children: ReactNode;
  /** Show a beacon on the target while closed; clicking it opens the hint. */
  onOpen?: () => void;
  /** For top/bottom: line the bubble up with the target's start or end edge. */
  align?: "start" | "end";
  className?: string;
}

const bubblePos: Record<Placement, string> = {
  bottom: "top-full mt-3",
  top: "bottom-full mb-3",
  right: "left-full top-0 ml-3",
  left: "right-full top-0 mr-3",
};

/** A one-off hint pinned to a control, with a beacon until it's opened. */
export function GuidedTooltip({ open, children, onOpen, placement = "bottom", align = "start", className, ...bubble }: GuidedTooltipProps) {
  const id = useId();
  return (
    <span className={cn("relative inline-flex", className)}>
      <span aria-describedby={open ? id : undefined} className="inline-flex">
        {children}
      </span>
      {!open && onOpen ? (
        <button type="button" onClick={onOpen} aria-label="Show tip" className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full">
          <Beacon />
        </button>
      ) : null}
      {open ? (
        <span role="tooltip" className={cn("absolute z-20 block animate-fade-in", bubblePos[placement], (placement === "top" || placement === "bottom") && (align === "end" ? "right-0" : "left-0"))}>
          <HintBubble id={id} placement={placement} arrowOffset={align === "end" ? undefined : 20} className={cn("w-[min(18rem,calc(100vw-3rem))]", align === "end" && (placement === "top" || placement === "bottom") && "[&>span:first-child]:left-auto! [&>span:first-child]:right-5")} {...bubble} />
        </span>
      ) : null}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Product tour                                                        */
/* ------------------------------------------------------------------ */

export interface TourStep {
  /** Matches data-tour="…" on an element inside the tour area. */
  target: string;
  title: ReactNode;
  body: ReactNode;
}

export interface ProductTourProps {
  steps: TourStep[];
  open: boolean;
  onClose: (finished: boolean) => void;
  /** The UI being toured; mark targets with data-tour. */
  children: ReactNode;
  className?: string;
}

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
  areaW: number;
  areaH: number;
}

/**
 * Step-by-step popovers over real UI. Dims everything except the target,
 * moves focus to the popover, ← → step, Esc ends.
 */
export function ProductTour({ steps, open, onClose, children, className }: ProductTourProps) {
  const root = useRef<HTMLDivElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const titleId = useId();
  const step = steps[Math.min(i, steps.length - 1)];

  const measure = useCallback(() => {
    const area = root.current;
    const el = area?.querySelector<HTMLElement>(`[data-tour="${step?.target}"]`);
    if (!area || !el) return setBox(null);
    const a = area.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setBox({ top: r.top - a.top, left: r.left - a.left, width: r.width, height: r.height, areaW: a.width, areaH: a.height });
  }, [step?.target]);

  const hasBox = box !== null;
  const returnTo = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (open) returnTo.current = document.activeElement as HTMLElement | null;
  }, [open]);
  useEffect(() => {
    if (open && hasBox) pop.current?.focus({ preventScroll: true });
  }, [open, hasBox, i]);

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => measure());
    const ro = new ResizeObserver(() => measure());
    if (root.current) ro.observe(root.current);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [open, measure]);

  const end = (finished: boolean) => {
    onClose(finished);
    setI(0);
    returnTo.current?.focus({ preventScroll: true });
  };
  const next = () => (i >= steps.length - 1 ? end(true) : setI(i + 1));
  const back = () => setI(Math.max(0, i - 1));
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") end(false);
    else if (e.key === "ArrowRight") next();
    else if (e.key === "ArrowLeft") back();
  };

  // Popover placement: below, above, right of the target, else pinned inside the area's bottom edge.
  const POP_H = 176;
  const GAP = 14;
  const W = box ? Math.min(288, box.areaW - 16) : 288;
  let side: Placement = "bottom";
  let popStyle: CSSProperties = {};
  let arrow = 20;
  if (box) {
    const below = box.areaH - (box.top + box.height);
    const right = box.areaW - (box.left + box.width);
    const left = Math.max(8, Math.min(box.left, box.areaW - W - 8));
    const hArrow = Math.max(14, Math.min(W - 26, box.left + Math.min(box.width / 2, 40) - left - 6));
    if (below >= POP_H + GAP) {
      side = "bottom";
      popStyle = { top: box.top + box.height + GAP, left, width: W };
      arrow = hArrow;
    } else if (box.top >= POP_H + GAP) {
      side = "top";
      popStyle = { top: box.top - GAP, left, width: W, transform: "translateY(-100%)" };
      arrow = hArrow;
    } else if (right >= W + GAP) {
      side = "right";
      const top = Math.max(8, Math.min(box.top, box.areaH - POP_H - 8));
      popStyle = { top, left: box.left + box.width + GAP, width: W };
      arrow = Math.max(14, Math.min(POP_H - 26, box.top + Math.min(box.height / 2, 24) - top - 6));
    } else {
      side = "bottom";
      popStyle = { top: Math.max(8, box.areaH - POP_H - 8), left: Math.max(8, (box.areaW - W) / 2), width: W };
      arrow = -100; // no arrow when overlapping
    }
  }

  return (
    <div ref={root} className={cn("relative overflow-hidden", className)}>
      {children}
      {open && box ? (
        <>
          <div aria-hidden="true" className="absolute inset-0 z-10" onClick={() => end(false)} />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute z-10 rounded-[var(--radius-card)] ring-2 ring-lime transition-all duration-300"
            style={{ top: box.top - 4, left: box.left - 4, width: box.width + 8, height: box.height + 8, boxShadow: "0 0 0 9999px rgb(22 24 21 / 0.5)" }}
          />
          <div
            ref={pop}
            role="dialog"
            aria-modal="false"
            aria-labelledby={titleId}
            tabIndex={-1}
            onKeyDown={onKeyDown}
            className="absolute z-20 outline-none transition-all duration-300"
            style={popStyle}
          >
            <HintBubble
              className="w-full"
              placement={side}
              arrowOffset={arrow}
              hideArrow={arrow < 0}
              title={<span id={titleId}>{step.title}</span>}
              body={step.body}
              step={`${i + 1} of ${steps.length}`}
              onClose={() => end(false)}
              secondary={i > 0 ? { label: "Back", onClick: back } : { label: "Skip", onClick: () => end(false) }}
              primary={{ label: i === steps.length - 1 ? "Done" : "Next", onClick: next }}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Feature spotlight                                                   */
/* ------------------------------------------------------------------ */

export interface FeatureSpotlightProps {
  active: boolean;
  /** The feature being introduced. */
  children: ReactNode;
  title: ReactNode;
  body: ReactNode;
  onTry: () => void;
  onDismiss: () => void;
  tryLabel?: string;
  placement?: "bottom" | "right";
  className?: string;
}

/**
 * Dims the surrounding area (inside the nearest overflow-hidden parent),
 * rings the new feature and explains it. One spotlight per session.
 */
export function FeatureSpotlight({ active, children, title, body, onTry, onDismiss, tryLabel = "Try it", placement = "bottom", className }: FeatureSpotlightProps) {
  const id = useId();
  return (
    <div className={cn("relative", active && "z-10", className)} onKeyDown={(e) => active && e.key === "Escape" && onDismiss()}>
      <div aria-describedby={active ? id : undefined} className={cn("relative rounded-[var(--radius-card)] transition-shadow", active && "bg-surface ring-2 ring-lime shadow-[0_0_0_9999px_rgb(22_24_21/0.5)]")}>
        {children}
        {active ? <Beacon className="absolute -right-1.5 -top-1.5" /> : null}
      </div>
      {active ? (
        <div role="dialog" aria-modal="false" aria-labelledby={`${id}-t`} className={cn("absolute z-20 animate-fade-in", placement === "right" ? "left-full top-0 ml-4" : "left-0 top-full mt-4")}>
          <HintBubble
            id={id}
            placement={placement}
            title={
              <span id={`${id}-t`} className="flex items-center gap-2">
                <span className="rounded-[var(--radius-badge)] bg-lime px-1.5 text-2xs font-semibold uppercase tracking-wide text-ink">New</span>
                {title}
              </span>
            }
            body={body}
            onClose={onDismiss}
            secondary={{ label: "Not now", onClick: onDismiss }}
            primary={{ label: tryLabel, onClick: onTry }}
          />
        </div>
      ) : null}
    </div>
  );
}
