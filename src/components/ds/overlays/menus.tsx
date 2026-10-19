"use client";

/*
 * Context menu (right-click / Shift+F10 / menu key) and hover card, styled to match
 * the DropdownMenu primitive. Both wrap Radix.
 */
import { ContextMenu as RContext, HoverCard as RHover } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { Check, ChevronRight } from "@/components/icons";
import { Kbd } from "@/components/ui";
import { cn } from "@/lib/utils";

const panel = "z-50 min-w-52 rounded-[var(--radius-card)] border border-line bg-surface p-1 shadow-lg animate-fade-in";
const itemCls =
  "flex min-h-8 cursor-pointer select-none items-center gap-2 rounded-[var(--radius-control)] px-2.5 text-ui outline-none data-[highlighted]:bg-surface-2 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 [&_svg]:size-4";

export const ContextMenu = RContext.Root;
export const ContextMenuSub = RContext.Sub;

/** The area that opens the menu on right-click (or long-press on touch). */
export function ContextMenuTrigger({ className, ...props }: ComponentProps<typeof RContext.Trigger>) {
  return <RContext.Trigger className={cn("outline-none", className)} {...props} />;
}

export function ContextMenuContent({ className, ...props }: ComponentProps<typeof RContext.Content>) {
  return (
    <RContext.Portal>
      <RContext.Content className={cn(panel, className)} {...props} />
    </RContext.Portal>
  );
}

export interface ContextMenuItemProps extends ComponentProps<typeof RContext.Item> {
  icon?: ReactNode;
  shortcut?: string;
  danger?: boolean;
}

export function ContextMenuItem({ icon, shortcut, danger, className, children, ...props }: ContextMenuItemProps) {
  return (
    <RContext.Item className={cn(itemCls, danger ? "text-red-800 data-[highlighted]:bg-red-100" : "text-ink", className)} {...props}>
      {icon ? <span aria-hidden className={cn("inline-flex", danger ? "text-red-800" : "text-ink-3")}>{icon}</span> : null}
      <span className="flex-1">{children}</span>
      {shortcut ? <Kbd aria-hidden>{shortcut}</Kbd> : null}
    </RContext.Item>
  );
}

/** Toggle inside a context menu (e.g. "Pin to Today"). */
export function ContextMenuCheckboxItem({ className, children, ...props }: ComponentProps<typeof RContext.CheckboxItem>) {
  return (
    <RContext.CheckboxItem className={cn(itemCls, "text-ink", className)} {...props}>
      <span className="inline-flex size-4 items-center justify-center">
        <RContext.ItemIndicator>
          <Check aria-hidden className="size-4" />
        </RContext.ItemIndicator>
      </span>
      {children}
    </RContext.CheckboxItem>
  );
}

export function ContextMenuSubTrigger({ icon, className, children, ...props }: ComponentProps<typeof RContext.SubTrigger> & { icon?: ReactNode }) {
  return (
    <RContext.SubTrigger className={cn(itemCls, "text-ink data-[state=open]:bg-surface-2", className)} {...props}>
      {icon ? <span aria-hidden className="inline-flex text-ink-3">{icon}</span> : null}
      <span className="flex-1">{children}</span>
      <ChevronRight aria-hidden className="size-4 text-ink-3" />
    </RContext.SubTrigger>
  );
}

export function ContextMenuSubContent({ className, ...props }: ComponentProps<typeof RContext.SubContent>) {
  return (
    <RContext.Portal>
      <RContext.SubContent className={cn(panel, "min-w-44", className)} {...props} />
    </RContext.Portal>
  );
}

export function ContextMenuLabel({ className, ...props }: ComponentProps<typeof RContext.Label>) {
  return <RContext.Label className={cn("text-overline px-2.5 pb-1 pt-2", className)} {...props} />;
}

export function ContextMenuSeparator({ className, ...props }: ComponentProps<typeof RContext.Separator>) {
  return <RContext.Separator className={cn("my-1 h-px bg-line", className)} {...props} />;
}

/* ------------------------------------------------------------------ */
/* Hover card                                                          */
/* ------------------------------------------------------------------ */

/**
 * Rich preview on hover or keyboard focus (Radix HoverCard). Supplementary only:
 * the trigger must still lead to the same information when clicked.
 */
export function HoverCard({ trigger, children, side = "bottom", align = "start", openDelay = 300, className }: { trigger: ReactNode; children: ReactNode; side?: "top" | "right" | "bottom" | "left"; align?: "start" | "center" | "end"; openDelay?: number; className?: string }) {
  return (
    <RHover.Root openDelay={openDelay} closeDelay={120}>
      <RHover.Trigger asChild>{trigger}</RHover.Trigger>
      <RHover.Portal>
        <RHover.Content side={side} align={align} sideOffset={8} className={cn("z-50 w-80 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-lg outline-none animate-fade-in", className)}>
          {children}
        </RHover.Content>
      </RHover.Portal>
    </RHover.Root>
  );
}
