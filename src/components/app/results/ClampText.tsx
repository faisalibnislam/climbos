"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const CLAMP = { 1: "line-clamp-1", 2: "line-clamp-2", 3: "line-clamp-3" } as const;

/**
 * Clamped text with a More/Less toggle (shown only when it overflows), for
 * secondary user or AI text on lists and cards. Use `inline` inside a <p>.
 */
export function ClampText({ children, className, lines = 2, inline }: { children: ReactNode; className?: string; lines?: 1 | 2 | 3; inline?: boolean }) {
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || open) return;
    const check = () => setOverflows(el.scrollHeight > el.clientHeight + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, children]);
  const Outer = inline ? "span" : "div";
  const Inner = inline ? "span" : "div";
  return (
    <Outer className={cn("block", className)}>
      <Inner ref={ref as never} className={open ? "block" : CLAMP[lines]}>
        {children}
      </Inner>
      {overflows || open ? (
        <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="mt-0.5 text-xs font-medium text-brand-800 hover:underline">
          {open ? "Less" : "More"}
        </button>
      ) : null}
    </Outer>
  );
}
