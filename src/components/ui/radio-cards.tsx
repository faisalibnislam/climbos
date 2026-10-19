"use client";

import { RadioGroup } from "radix-ui";
import { CircleCheck } from "@/components/icons"
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface RadioCardOption {
  value: string;
  title: ReactNode;
  description?: ReactNode;
  /** Decorative icon or emoji shown at the start of the card. */
  icon?: ReactNode;
  disabled?: boolean;
}

export interface RadioCardsProps extends Omit<ComponentProps<typeof RadioGroup.Root>, "children"> {
  options: RadioCardOption[];
  /** Accessible group name; use when no visible legend labels the group. */
  "aria-label"?: string;
  /** Number of columns from the `sm` breakpoint up. */
  columns?: 1 | 2 | 3 | 4;
}

const colClasses = { 1: "", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" };

/**
 * Large selectable cards (single choice). Arrow keys move between options,
 * Space selects. Selection is shown with border, background and a check icon.
 */
export function RadioCards({ options, columns = 2, className, ...props }: RadioCardsProps) {
  return (
    <RadioGroup.Root className={cn("grid grid-cols-1 gap-3", colClasses[columns], className)} {...props}>
      {options.map((o) => (
        <RadioGroup.Item
          key={o.value}
          value={o.value}
          disabled={o.disabled}
          className={cn(
            "group relative flex min-h-16 w-full items-start gap-3 rounded-xl border border-control bg-surface p-4 text-left transition-colors",
            "hover:border-brand-700 data-[state=checked]:border-brand-800 data-[state=checked]:bg-brand-50",
            "data-[state=checked]:ring-1 data-[state=checked]:ring-brand-800 disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          {o.icon ? (
            <span aria-hidden="true" className="mt-0.5 text-xl leading-none">
              {o.icon}
            </span>
          ) : null}
          <span className="flex min-w-0 flex-1 flex-col gap-1 pr-6">
            <span className="heading-card">{o.title}</span>
            {o.description ? <span className="text-ui text-ink-3">{o.description}</span> : null}
          </span>
          <span
            aria-hidden="true"
            className="absolute right-3.5 top-3.5 grid size-5 place-items-center rounded-full border-[1.5px] border-control group-data-[state=checked]:border-transparent"
          >
            <RadioGroup.Indicator className="inline-flex">
              <CircleCheck className="size-5 fill-brand-800 text-white" />
            </RadioGroup.Indicator>
          </span>
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}
