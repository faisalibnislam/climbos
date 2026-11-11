"use client";

import { Tabs as RTabs } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Tabbed views (Radix Tabs). Arrow keys move between tabs. */
export const Tabs = RTabs.Root;

/** Row of tab buttons. Scrolls horizontally on narrow screens instead of wrapping. */
export function TabsList({ className, ...props }: ComponentProps<typeof RTabs.List>) {
  return (
    <RTabs.List
      className={cn(
        "inline-flex max-w-full gap-0.5 overflow-x-auto rounded-[calc(var(--radius-control)+2px)] border border-[var(--tabs-track-border)] bg-[var(--tabs-track)] p-0.5",
        className,
      )}
      {...props}
    />
  );
}

/** A readable tab with a generous touch target. Arrow keys move within the track. */
export function TabsTrigger({ className, ...props }: ComponentProps<typeof RTabs.Trigger>) {
  return (
    <RTabs.Trigger
      className={cn(
        "inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-[var(--radius-control)] px-2.5 text-ui font-medium text-ink-2 [&_svg]:size-4",
        "data-[state=inactive]:hover:text-ink data-[state=active]:bg-[var(--tab-active)] data-[state=active]:text-[var(--tab-active-ink)] data-[state=active]:shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

/** Panel for a tab's content. */
export function TabsContent({ className, ...props }: ComponentProps<typeof RTabs.Content>) {
  return <RTabs.Content className={cn("mt-4", className)} {...props} />;
}
