"use client";

import { Popover as RPopover } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Anchored panel for small editors and pickers (colour, date, filters). Escape closes; focus returns to the trigger. */
export const Popover = RPopover.Root;
export const PopoverTrigger = RPopover.Trigger;
export const PopoverClose = RPopover.Close;

export function PopoverContent({ className, sideOffset = 6, align = "start", ...props }: ComponentProps<typeof RPopover.Content>) {
  return (
    <RPopover.Portal>
      <RPopover.Content
        sideOffset={sideOffset}
        align={align}
        className={cn("z-50 w-72 rounded-xl border border-line bg-surface p-3 text-ui shadow-lg outline-none animate-fade-in", className)}
        {...props}
      />
    </RPopover.Portal>
  );
}
