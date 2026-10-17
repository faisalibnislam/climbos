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
        "inline-flex max-w-full gap-0.5 overflow-x-auto rounded-lg border border-line bg-surface-2 p-0.5",
        className,
      )}
      {...props}
    />
  );
}

/** A single tab (28px inside a 32px track). The selected tab sits on a white surface. */
export function TabsTrigger({ className, ...props }: ComponentProps<typeof RTabs.Trigger>) {
  return (
    <RTabs.Trigger
      className={cn(
        "inline-flex h-7 shrink-0 items-center justify-center gap-1.5 rounded-md px-2.5 text-ui font-medium text-ink-3 transition-colors [&_svg]:size-4",
        "hover:text-ink data-[state=active]:bg-surface data-[state=active]:text-ink data-[state=active]:shadow-sm",
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
