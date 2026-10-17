"use client";

import { DropdownMenu as RMenu, Tooltip as RTooltip } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Menu of actions (Radix DropdownMenu). Compose Trigger (asChild) + Content + Items. */
export const DropdownMenu = RMenu.Root;
export const DropdownMenuTrigger = RMenu.Trigger;
export const DropdownMenuGroup = RMenu.Group;

/** Floating menu panel. */
export function DropdownMenuContent({ className, sideOffset = 6, align = "end", ...props }: ComponentProps<typeof RMenu.Content>) {
  return (
    <RMenu.Portal>
      <RMenu.Content
        sideOffset={sideOffset}
        align={align}
        className={cn("z-50 min-w-48 rounded-[8px] border border-line bg-surface p-1.5 shadow-lg", className)}
        {...props}
      />
    </RMenu.Portal>
  );
}

export interface DropdownMenuItemProps extends ComponentProps<typeof RMenu.Item> {
  /** Decorative leading icon. */
  icon?: ReactNode;
  /** Destructive styling (text still needs to say what happens). */
  danger?: boolean;
}

/** A menu action. 44px tall for touch. */
export function DropdownMenuItem({ className, icon, danger, children, ...props }: DropdownMenuItemProps) {
  return (
    <RMenu.Item
      className={cn(
        "flex min-h-11 cursor-pointer select-none items-center gap-2.5 rounded-[8px] px-3 text-[0.95rem] outline-none",
        "data-[highlighted]:bg-surface-2 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 [&_svg]:size-4",
        danger ? "text-red-800 data-[highlighted]:bg-red-100" : "text-ink",
        className,
      )}
      {...props}
    >
      {icon ? (
        <span aria-hidden="true" className="inline-flex text-ink-3">
          {icon}
        </span>
      ) : null}
      {children}
    </RMenu.Item>
  );
}

/** Non-interactive group heading inside a menu. */
export function DropdownMenuLabel({ className, ...props }: ComponentProps<typeof RMenu.Label>) {
  return <RMenu.Label className={cn("px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-3", className)} {...props} />;
}

/** Divider between menu groups. */
export function DropdownMenuSeparator({ className, ...props }: ComponentProps<typeof RMenu.Separator>) {
  return <RMenu.Separator className={cn("my-1 h-px bg-line", className)} {...props} />;
}

export interface TooltipProps {
  /** Short supplementary text. Never put essential information only in a tooltip. */
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  delayDuration?: number;
}

/**
 * Hover/focus hint (Radix Tooltip, self-contained provider). The trigger child
 * must be focusable. Treat tooltips as optional extras: the same information
 * must also be available elsewhere (visible text, help page, or label).
 */
export function Tooltip({ content, children, side = "top", delayDuration = 300 }: TooltipProps) {
  return (
    <RTooltip.Provider delayDuration={delayDuration}>
      <RTooltip.Root>
        <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
        <RTooltip.Portal>
          <RTooltip.Content
            side={side}
            sideOffset={6}
            className="z-50 max-w-xs rounded-[8px] bg-ink px-3 py-2 text-sm leading-snug text-white shadow-lg"
          >
            {content}
            <RTooltip.Arrow className="fill-ink" />
          </RTooltip.Content>
        </RTooltip.Portal>
      </RTooltip.Root>
    </RTooltip.Provider>
  );
}
