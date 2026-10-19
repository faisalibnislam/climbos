"use client";

/*
 * Mobile navigation: bottom tab bar (4–5 destinations) and the left drawer that
 * holds the full sidebar on small screens.
 */
import { useState, type ReactNode } from "react";
import { Menu } from "@/components/icons";
import { Sheet } from "@/components/ui";
import { cn } from "@/lib/utils";
import { NavBadge, SideNavGroup, SideNavItem, type NavLinkItem, type NavSection } from "./sidebar";

/** Fixed bottom tab bar. 56px targets, label always visible, current tab in ink with a top marker. */
export function MobileBottomNav({ items, active, onSelect, className }: { items: NavLinkItem[]; active: string; onSelect: (id: string) => void; className?: string }) {
  return (
    <nav aria-label="Main" className={cn("border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]", className)}>
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((it) => {
          const on = it.id === active;
          return (
            <li key={it.id}>
              <button
                type="button"
                aria-current={on ? "page" : undefined}
                onClick={() => onSelect(it.id)}
                className={cn(
                  "relative flex h-14 w-full flex-col items-center justify-center gap-0.5 text-2xs outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]",
                  on ? "font-semibold text-ink" : "text-ink-3",
                )}
              >
                {on ? <span aria-hidden className="absolute inset-x-5 top-0 h-0.5 bg-ink" /> : null}
                <span aria-hidden className="relative inline-flex [&_svg]:size-5">
                  {it.icon}
                  {it.badge !== undefined ? (
                    <span className="absolute -right-2.5 -top-1.5">
                      <NavBadge tone={it.badgeTone ?? "attention"} className="h-4 min-w-4 px-1 text-2xs">{it.badge}</NavBadge>
                    </span>
                  ) : null}
                </span>
                {it.label}
                {it.badge !== undefined ? <span className="sr-only">, {String(it.badge)} new</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Hamburger + left drawer with the full grouped nav. Picking a page closes it. */
export function MobileNavDrawer({
  sections,
  active,
  onSelect,
  header,
  footer,
  open,
  onOpenChange,
  trigger,
}: {
  sections: NavSection[];
  active: string;
  onSelect: (id: string) => void;
  header?: ReactNode;
  footer?: ReactNode;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  trigger?: ReactNode;
}) {
  const [inner, setInner] = useState(false);
  const isOpen = open ?? inner;
  const setOpen = (v: boolean) => {
    setInner(v);
    onOpenChange?.(v);
  };
  const pick = (id: string) => {
    setOpen(false);
    onSelect(id);
  };
  return (
    <Sheet
      side="left"
      title="Menu"
      hideTitle
      open={isOpen}
      onOpenChange={setOpen}
      className="w-[min(18rem,calc(100vw-3rem))] gap-0 p-3"
      trigger={
        trigger ?? (
          <button type="button" aria-label="Open menu" className="grid size-10 place-items-center rounded-[var(--radius-control)] text-ink outline-none hover:bg-surface focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
            <Menu aria-hidden className="size-5" />
          </button>
        )
      }
    >
      <div className="flex h-full flex-col gap-3">
        {header}
        <nav aria-label="Main" className="flex flex-col gap-3">
          {sections.map((s) => (
            <SideNavGroup key={s.id} label={s.label} collapsible={s.collapsible} defaultOpen={s.defaultOpen}>
              {s.items.map((it) => (
                <SideNavItem key={it.id} item={it} active={active === it.id} onSelect={pick} />
              ))}
            </SideNavGroup>
          ))}
        </nav>
        {footer ? <div className="mt-auto pt-3">{footer}</div> : null}
      </div>
    </Sheet>
  );
}

/** 320px phone-sized frame for showing mobile patterns in docs. Content scrolls inside. */
export function DeviceFrame({ children, label = "Phone preview", className }: { children: ReactNode; label?: string; className?: string }) {
  return (
    <div role="group" aria-label={label} className={cn("relative mx-auto flex h-[560px] w-full max-w-[320px] flex-col overflow-hidden rounded-[8px] border border-line-strong bg-bg shadow-[var(--card-shadow)]", className)}>
      <div aria-hidden className="flex h-7 shrink-0 items-center justify-between px-5 text-2xs font-semibold text-ink">
        <span>9:41</span>
        <span className="flex gap-1">
          <span className="h-2 w-3 rounded-[1px] bg-ink/70" />
          <span className="h-2 w-4 rounded-[1px] bg-ink/70" />
        </span>
      </div>
      {children}
    </div>
  );
}
