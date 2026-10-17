"use client";

import { RadioGroup } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ChoiceChip {
  value: string;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface ChoiceChipsProps extends Omit<ComponentProps<typeof RadioGroup.Root>, "children"> {
  options: ChoiceChip[];
  /** Required: names the group for screen readers. */
  "aria-label": string;
  size?: "md" | "lg";
}

/**
 * Single-choice chips (a radio group that looks like pills): quick filters,
 * goal pickers, cadence. Arrow keys move between chips. Selected = pine.
 */
export function ChoiceChips({ options, size = "md", className, ...props }: ChoiceChipsProps) {
  return (
    <RadioGroup.Root className={cn("flex flex-wrap gap-2", className)} orientation="horizontal" {...props}>
      {options.map((o) => (
        <RadioGroup.Item
          key={o.value}
          value={o.value}
          disabled={o.disabled}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border border-control bg-surface px-3 font-medium text-ink transition-colors [&_svg]:size-4",
            size === "lg" ? "h-10 text-sm" : "h-9 text-ui",
            "hover:bg-surface-2 data-[state=checked]:border-brand-800 data-[state=checked]:bg-brand-800 data-[state=checked]:text-white",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          {o.icon ? <span aria-hidden="true" className="inline-flex">{o.icon}</span> : null}
          {o.label}
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}

/**
 * Multi-select filter chip (a toggle button with aria-pressed). Use a row of
 * them for filters like channels or statuses; selected = pine outline + check.
 */
export function FilterChip({ pressed, onPressedChange, icon, children, className, count }: { pressed: boolean; onPressedChange: (v: boolean) => void; icon?: ReactNode; children: ReactNode; className?: string; count?: number }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onPressedChange(!pressed)}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-ui font-medium transition-colors [&_svg]:size-4",
        pressed ? "border-brand-800 bg-brand-50 text-brand-900" : "border-line-strong bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink",
        className,
      )}
    >
      {icon ? <span aria-hidden="true" className="inline-flex">{icon}</span> : null}
      {children}
      {count !== undefined ? <span className="rounded-md bg-surface-2 px-1 text-xs tabular-nums text-ink-3">{count}</span> : null}
    </button>
  );
}
