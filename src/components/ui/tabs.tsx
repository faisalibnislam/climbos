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
        "inline-flex max-w-full gap-1 overflow-x-auto rounded-full border border-line bg-surface p-1 shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

/** A single tab. The selected tab is shown with a raised surface and bold weight. */
export function TabsTrigger({ className, ...props }: ComponentProps<typeof RTabs.Trigger>) {
  return (
    <RTabs.Trigger
      className={cn(
        "inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-full px-4 text-[0.95rem] font-semibold text-ink-2 transition-colors",
        "hover:bg-surface-2 hover:text-ink data-[state=active]:bg-ink data-[state=active]:text-white",
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
