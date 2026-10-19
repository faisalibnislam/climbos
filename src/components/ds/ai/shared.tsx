"use client";

/*
 * Shared AI pieces: the AI mark, model tiers (Luna / Sol), credit cost chip,
 * live progress bar (bar + time left) and a reduced-motion-aware typewriter hook.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Moon, Sparkle, Sun } from "@/components/icons";
import { cn } from "@/lib/utils";

export type ModelTier = "luna" | "sol";

export interface ModelInfo {
  id: ModelTier;
  name: string;
  tier: string;
  /** Credits per draft (1 credit = 1¢). */
  credits: number;
  blurb: string;
  paid: boolean;
}

export const MODELS: Record<ModelTier, ModelInfo> = {
  luna: { id: "luna", name: "Luna", tier: "Basic", credits: 2, blurb: "Fast drafts and replies. Included on every plan.", paid: false },
  sol: { id: "sol", name: "Sol", tier: "Expert", credits: 9, blurb: "Plans, insights, ads and autopilot. Deeper research.", paid: true },
};

export function ModelGlyph({ model, className }: { model: ModelTier; className?: string }) {
  const Icon = model === "sol" ? Sun : Moon;
  return <Icon aria-hidden className={cn("size-4", className)} />;
}

/** Small square that marks AI-made content. */
export function AIMark({ size = "md", className }: { size?: "sm" | "md"; className?: string }) {
  return (
    <span aria-hidden className={cn("inline-grid shrink-0 place-items-center rounded-[var(--radius-control)] bg-sage-ink text-white", size === "sm" ? "size-5 [&_svg]:size-3" : "size-7 [&_svg]:size-3.5", className)}>
      <Sparkle />
    </span>
  );
}

/** Credit cost chip, e.g. "9 credits". */
export function CreditCost({ credits, className, prefix }: { credits: number; className?: string; prefix?: string }) {
  return (
    <span className={cn("inline-flex h-5 items-center gap-1 rounded-[var(--radius-badge)] bg-surface-2 px-1.5 text-2xs font-medium tabular-nums text-ink-2", className)}>
      {prefix ? `${prefix} ` : null}
      {credits} {credits === 1 ? "credit" : "credits"}
    </span>
  );
}

export function formatSeconds(s: number) {
  const v = Math.max(0, Math.round(s));
  if (v < 60) return `${v}s`;
  return `${Math.floor(v / 60)}m ${String(v % 60).padStart(2, "0")}s`;
}

/** Live progress: bar, percent and time left. */
export function LiveProgress({ label, value, secondsLeft, className, tone = "ink" }: { label: string; value: number; secondsLeft?: number; className?: string; tone?: "ink" | "lime" }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="font-medium text-ink">{label}</span>
        <span className="tabular-nums text-ink-3">
          {pct}%{secondsLeft !== undefined && pct < 100 ? ` · ${formatSeconds(secondsLeft)} left` : pct >= 100 ? " · done" : ""}
        </span>
      </div>
      <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
        <div className={cn("h-full rounded-full transition-[width] duration-300 ease-out motion-reduce:transition-none", tone === "lime" ? "bg-sun-strong" : "bg-ink")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Streaming-style reveal. By default it starts complete (SSR-safe); call `play()`
 * to type the text out. `autoplay` starts empty and types on mount (client-only
 * messages). Respects prefers-reduced-motion (shows the full text at once).
 */
export function useTypewriter(text: string, { cps = 90, autoplay = false }: { cps?: number; autoplay?: boolean } = {}) {
  const [count, setCount] = useState(autoplay ? 0 : text.length);
  const timer = useRef<number | null>(null);
  const stop = useCallback(() => {
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
  }, []);
  const play = useCallback(() => {
    stop();
    if (prefersReducedMotion()) {
      setCount(text.length);
      return;
    }
    setCount(0);
    const step = Math.max(1, Math.round(cps / 30));
    timer.current = window.setInterval(() => {
      setCount((c) => Math.min(text.length, c + step));
    }, 33);
  }, [text, cps, stop]);
  const done = count >= text.length;
  useEffect(() => {
    if (done) stop();
  }, [done, stop]);
  useEffect(() => {
    if (!autoplay) return stop;
    const id = requestAnimationFrame(play);
    return () => {
      cancelAnimationFrame(id);
      stop();
    };
  }, [autoplay, play, stop]);
  const skip = useCallback(() => {
    stop();
    setCount(text.length);
  }, [stop, text.length]);
  return { shown: text.slice(0, count), streaming: !done, play, skip };
}

/** Blinking caret shown while text streams. */
export function Caret() {
  return <span aria-hidden className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] animate-soft-pulse bg-ink motion-reduce:animate-none" />;
}

/** Plain white panel used by AI widgets. */
export function AIPanel({ children, className, as: Tag = "section", ...rest }: { children: ReactNode; className?: string; as?: "section" | "div" | "article" | "aside"; "aria-label"?: string; "aria-labelledby"?: string }) {
  return (
    <Tag className={cn("rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--card-shadow)]", className)} {...rest}>
      {children}
    </Tag>
  );
}
