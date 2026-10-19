"use client";

/*
 * Top-of-page navigation: app top bar, breadcrumbs (with overflow menu),
 * page-level tab navigation and an icon view switcher.
 */
import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { ChevronRight, Ellipsis } from "@/components/icons";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Tooltip } from "@/components/ui";
import { cn } from "@/lib/utils";

/** Sticky app bar: left (menu, breadcrumbs), centre (search), right (actions). Blur only here. */
export function TopBar({ left, center, right, sticky, className }: { left?: ReactNode; center?: ReactNode; right?: ReactNode; sticky?: boolean; className?: string }) {
  return (
    <header className={cn("flex h-14 items-center gap-3 border-b border-line bg-bg/95 px-4", sticky && "sticky top-0 z-30 backdrop-blur", className)}>
      <div className="flex min-w-0 items-center gap-2">{left}</div>
      <div className="flex min-w-0 flex-1 justify-center">{center}</div>
      <div className="flex shrink-0 items-center gap-1.5">{right}</div>
    </header>
  );
}

export interface Crumb {
  id: string;
  label: string;
  href?: string;
}

/** Breadcrumb trail. Middle crumbs fold into a "…" menu past `max`. The last crumb is the current page. */
export function Breadcrumbs({ items, max = 4, onNavigate, className }: { items: Crumb[]; max?: number; onNavigate?: (id: string) => void; className?: string }) {
  const folded = items.length > max ? items.slice(1, items.length - (max - 2)) : [];
  const shown = folded.length ? [items[0], null, ...items.slice(items.length - (max - 2))] : items;
  const link = (c: Crumb) => (
    <a
      href={c.href ?? "#"}
      onClick={(e) => {
        if (onNavigate) {
          e.preventDefault();
          onNavigate(c.id);
        }
      }}
      className="truncate rounded-[var(--radius-control)] px-1 text-ink-3 outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
    >
      {c.label}
    </a>
  );
  return (
    <nav aria-label="Breadcrumb" className={cn("min-w-0", className)}>
      <ol className="flex min-w-0 items-center gap-1 text-ui">
        {shown.map((c, i) => {
          const last = i === shown.length - 1;
          return (
            <li key={c?.id ?? "fold"} className={cn("flex min-w-0 items-center gap-1", last ? "shrink" : "shrink-0")}>
              {c === null ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" aria-label={`Show ${folded.length} more`} className="grid size-6 place-items-center rounded-[var(--radius-control)] text-ink-3 outline-none hover:bg-surface hover:text-ink focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
                      <Ellipsis className="size-4" aria-hidden />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {folded.map((f) => (
                      <DropdownMenuItem key={f.id} onSelect={() => onNavigate?.(f.id)}>
                        {f.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : last ? (
                <span aria-current="page" className="truncate px-1 font-medium text-ink">
                  {c.label}
                </span>
              ) : (
                link(c)
              )}
              {!last ? <ChevronRight aria-hidden className="size-3.5 shrink-0 text-ink-3" /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export interface TabNavItem {
  id: string;
  label: string;
  count?: number;
  icon?: ReactNode;
}

/** Page-level section tabs (navigation, not a tablist): ink underline on the current tab. */
export function TabNav({ items, value, onChange, label = "Sections", className }: { items: TabNavItem[]; value: string; onChange: (id: string) => void; label?: string; className?: string }) {
  return (
    <nav aria-label={label} className={cn("relative max-w-full overflow-x-auto border-b border-line", className)}>
      <ul className="flex gap-5">
        {items.map((t) => {
          const on = t.id === value;
          return (
            <li key={t.id} className="shrink-0">
              <button
                type="button"
                aria-current={on ? "page" : undefined}
                onClick={() => onChange(t.id)}
                className={cn(
                  "-mb-px flex h-10 items-center gap-1.5 border-b-2 text-ui outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] [&_svg]:size-4",
                  on ? "border-ink font-medium text-ink" : "border-transparent text-ink-3 hover:border-line-strong hover:text-ink",
                )}
              >
                {t.icon ? <span aria-hidden className="inline-flex">{t.icon}</span> : null}
                {t.label}
                {t.count !== undefined ? (
                  <span className={cn("rounded-[var(--radius-badge)] px-1.5 text-2xs font-semibold tabular-nums", on ? "bg-ink text-white" : "bg-surface-3 text-ink-2")}>{t.count}</span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Icon-only segmented control (list / grid / board). Radio-group semantics with arrow keys. */
export function ViewSwitcher<T extends string>({ label, options, value, onChange, className }: { label: string; options: { value: T; label: string; icon: ReactNode }[]; value: T; onChange: (v: T) => void; className?: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, i: number) => {
    const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (i + d + options.length) % options.length;
    onChange(options[n].value);
    refs.current[n]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex gap-0.5 rounded-[calc(var(--radius-control)+2px)] bg-surface-2 p-0.5", className)}>
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <Tooltip key={o.value} content={o.label}>
            <button
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={o.label}
              tabIndex={on ? 0 : -1}
              onClick={() => onChange(o.value)}
              onKeyDown={(e) => onKey(e, i)}
              className={cn(
                "grid size-7 place-items-center rounded-[var(--radius-control)] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] [&_svg]:size-4",
                on ? "bg-surface text-ink shadow-[var(--seg-item-shadow)]" : "text-ink-3 hover:text-ink",
              )}
            >
              {o.icon}
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
