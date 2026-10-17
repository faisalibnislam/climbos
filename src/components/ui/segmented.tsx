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
    <div role="group" aria-label={label} className={cn("inline-flex max-w-full gap-0.5 overflow-x-auto rounded-lg border border-line bg-surface-2 p-0.5", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex h-7 shrink-0 items-center justify-center rounded-md px-2.5 text-ui font-medium text-ink-3 transition-colors hover:text-ink",
              active && "bg-surface text-ink shadow-sm",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
