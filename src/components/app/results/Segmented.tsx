"use client";

import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: string;
}

/**
 * Small toggle group (e.g. 7 / 30 / 90 days). Buttons expose aria-pressed, and
 * the selected one is shown with a raised surface + bold text (not color alone).
 */
export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  /** Accessible group name, e.g. "Time period". */
  label: string;
  options: SegmentedOption<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn("inline-flex max-w-full gap-1 overflow-x-auto rounded-[12px] border border-line bg-surface-2 p-1", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex min-h-10 shrink-0 items-center justify-center rounded-[9px] px-3.5 text-[0.95rem] font-medium text-ink-2 transition-colors hover:text-ink",
              active && "bg-surface font-semibold text-ink shadow-sm",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
