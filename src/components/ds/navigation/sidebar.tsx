"use client";

/*
 * Signal sidebars: primary (grouped, collapsible groups), collapsible (full ⇄ icon rail),
 * secondary (section sub-nav), nested (disclosure tree) and the sidebar footer.
 * Items are buttons by default; pass `href` to render links.
 */
import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, ChevronsUpDown, LogOut, PanelLeftClose, PanelLeftOpen, Search } from "@/components/icons";
import { Tooltip } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface NavLinkItem {
  id: string;
  label: string;
  icon?: ReactNode;
  href?: string;
  /** Count or short label (e.g. "New"). */
  badge?: ReactNode;
  badgeTone?: NavBadgeTone;
  children?: NavLinkItem[];
}

export interface NavSection {
  id: string;
  label?: string;
  items: NavLinkItem[];
  /** Group header toggles the list. */
  collapsible?: boolean;
  defaultOpen?: boolean;
}

/* ------------------------------------------------------------------ */
/* Badges                                                              */
/* ------------------------------------------------------------------ */

export type NavBadgeTone = "count" | "attention" | "new" | "dot";

/** Small count / label on a nav item. `dot` needs `label` for screen readers. */
export function NavBadge({ tone = "count", children, label, className }: { tone?: NavBadgeTone; children?: ReactNode; label?: string; className?: string }) {
  if (tone === "dot")
    return (
      <span className={cn("inline-flex items-center", className)}>
        <span aria-hidden className="size-2 rounded-full bg-red-800" />
        {label ? <span className="sr-only">{label}</span> : null}
      </span>
    );
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-[var(--radius-badge)] px-1.5 text-2xs font-semibold tabular-nums",
        tone === "attention" ? "bg-ink text-white" : tone === "new" ? "bg-lime text-ink" : "bg-surface-3 text-ink-2",
        className,
      )}
    >
      {children}
      {label ? <span className="sr-only"> {label}</span> : null}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Items and groups                                                    */
/* ------------------------------------------------------------------ */

export interface SideNavItemProps {
  item: NavLinkItem;
  active?: boolean;
  /** Icon-only (rail). The label moves to a tooltip and stays in the accessible name. */
  collapsed?: boolean;
  onSelect?: (id: string) => void;
  /** Visual depth for nested items. */
  depth?: number;
  /** Rendered after the label (e.g. a chevron for nested items). */
  trailing?: ReactNode;
  className?: string;
}

const itemBase =
  "group/nav relative flex w-full items-center gap-2.5 rounded-[var(--radius-control)] text-left text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]";

/** One sidebar entry: 40px row, white raised surface when active (Signal). */
export function SideNavItem({ item, active, collapsed, onSelect, depth = 0, trailing, className }: SideNavItemProps) {
  const cls = cn(
    itemBase,
    collapsed ? "size-10 justify-center" : "h-[var(--h-lg)] px-3",
    active ? "bg-surface font-medium text-ink shadow-[var(--card-shadow)]" : "text-ink-2 hover:bg-surface/60 hover:text-ink",
    className,
  );
  const body = (
    <>
      {item.icon ? (
        <span aria-hidden className={cn("inline-flex shrink-0 [&_svg]:size-4", active ? "text-ink" : "text-ink-2")}>
          {item.icon}
        </span>
      ) : null}
      {collapsed ? (
        <span className="sr-only">{item.label}</span>
      ) : (
        <span className="min-w-0 flex-1 truncate" style={depth ? { paddingLeft: depth * 4 } : undefined}>
          {item.label}
        </span>
      )}
      {item.badge !== undefined && item.badge !== null ? (
        collapsed ? (
          <span className="absolute right-1 top-1">
            <NavBadge tone="dot" label={typeof item.badge === "number" ? `${item.badge} new` : String(item.badge)} />
          </span>
        ) : (
          <NavBadge tone={item.badgeTone}>{item.badge}</NavBadge>
        )
      ) : null}
      {!collapsed ? trailing : null}
    </>
  );
  const el = item.href ? (
    <a
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cls}
      onClick={(e) => {
        if (onSelect) {
          e.preventDefault();
          onSelect(item.id);
        }
      }}
    >
      {body}
    </a>
  ) : (
    <button type="button" aria-current={active ? "page" : undefined} className={cls} onClick={() => onSelect?.(item.id)}>
      {body}
    </button>
  );
  return collapsed ? (
    <Tooltip content={item.label} side="right">
      {el}
    </Tooltip>
  ) : (
    el
  );
}

/** Labelled group of items with an optional collapse toggle. */
export function SideNavGroup({
  label,
  collapsible,
  defaultOpen = true,
  collapsed,
  children,
}: {
  label?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  /** Rail mode: the label becomes a divider. */
  collapsed?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (collapsed) return <div className="flex flex-col items-center gap-1 border-t border-line pt-2">{children}</div>;
  const show = !collapsible || open;
  return (
    <div className={cn("flex flex-col gap-0.5", label && "border-t border-line pt-3")}>
      {label ? (
        collapsible ? (
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-[var(--radius-control)] px-3 pb-1 text-left text-ui text-ink-3 outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            <ChevronDown aria-hidden className={cn("size-3 transition-transform", !open && "-rotate-90")} />
            {label}
          </button>
        ) : (
          <p className="px-3 pb-1 text-ui text-ink-3">{label}</p>
        )
      ) : null}
      {show ? children : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Primary sidebar                                                     */
/* ------------------------------------------------------------------ */

export interface PrimarySidebarProps {
  sections: NavSection[];
  active: string;
  onSelect?: (id: string) => void;
  /** Top slot: logo, workspace switcher. */
  header?: ReactNode;
  /** Bottom slot: upsell, user, credits. */
  footer?: ReactNode;
  collapsed?: boolean;
  label?: string;
  className?: string;
}

/** Signal primary sidebar: sits on the ground, items lift to white when active. */
export function PrimarySidebar({ sections, active, onSelect, header, footer, collapsed, label = "Main", className }: PrimarySidebarProps) {
  return (
    <aside className={cn("flex shrink-0 flex-col gap-3 bg-bg py-4 transition-[width] duration-200", collapsed ? "w-[68px] items-center px-2" : "w-[248px] px-3", className)}>
      {header}
      <nav aria-label={label} className={cn("flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto", collapsed && "items-center")}>
        {sections.map((s) => (
          <SideNavGroup key={s.id} label={s.label} collapsible={s.collapsible} defaultOpen={s.defaultOpen} collapsed={collapsed}>
            {s.items.map((it) => (
              <SideNavItem key={it.id} item={it} active={active === it.id} collapsed={collapsed} onSelect={onSelect} />
            ))}
          </SideNavGroup>
        ))}
      </nav>
      {footer ? <div className={cn("flex flex-col gap-3 pt-2", collapsed && "items-center")}>{footer}</div> : null}
    </aside>
  );
}

/** Primary sidebar that folds to a 68px icon rail. Controlled or uncontrolled. */
export function CollapsibleSidebar({
  collapsed: controlled,
  onCollapsedChange,
  defaultCollapsed = false,
  brand,
  brandCollapsed,
  ...props
}: Omit<PrimarySidebarProps, "collapsed" | "header"> & {
  collapsed?: boolean;
  onCollapsedChange?: (v: boolean) => void;
  defaultCollapsed?: boolean;
  /** Logo shown when expanded. */
  brand?: ReactNode;
  /** Mark shown in the rail. */
  brandCollapsed?: ReactNode;
}) {
  const [inner, setInner] = useState(defaultCollapsed);
  const collapsed = controlled ?? inner;
  const toggle = () => {
    setInner(!collapsed);
    onCollapsedChange?.(!collapsed);
  };
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const header = (
    <div className={cn("flex items-center", collapsed ? "flex-col gap-3" : "justify-between px-1")}>
      {collapsed ? brandCollapsed : brand}
      <Tooltip content={collapsed ? "Expand sidebar" : "Collapse sidebar"} side="right">
        <button
          type="button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          onClick={toggle}
          className="grid size-8 place-items-center rounded-[var(--radius-control)] text-ink-3 outline-none hover:bg-surface hover:text-ink focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <ToggleIcon className="size-[18px]" aria-hidden />
        </button>
      </Tooltip>
    </div>
  );
  return <PrimarySidebar {...props} collapsed={collapsed} header={header} />;
}

/* ------------------------------------------------------------------ */
/* Secondary sidebar                                                   */
/* ------------------------------------------------------------------ */

export interface SecondaryNavItem {
  id: string;
  label: string;
  description?: string;
  badge?: ReactNode;
}

/** Second column for a section's own pages (Settings, Campaign). White, with optional filter. */
export function SecondarySidebar({
  title,
  groups,
  active,
  onSelect,
  searchable,
  className,
}: {
  title: string;
  groups: { label?: string; items: SecondaryNavItem[] }[];
  active: string;
  onSelect?: (id: string) => void;
  searchable?: boolean;
  className?: string;
}) {
  const [q, setQ] = useState("");
  const s = q.trim().toLowerCase();
  return (
    <aside className={cn("flex w-60 shrink-0 flex-col gap-3 border-r border-line bg-surface p-3", className)}>
      <p className="heading-card px-2 pt-1">{title}</p>
      {searchable ? (
        <label className="flex h-[var(--h-sm)] items-center gap-2 rounded-[var(--radius-control)] bg-surface-2 px-2.5 text-ink-3 focus-within:ring-2 focus-within:ring-[var(--focus-ring)]">
          <Search aria-hidden className="size-3.5" />
          <span className="sr-only">Filter {title}</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter" className="min-w-0 flex-1 bg-transparent text-ui text-ink outline-none placeholder:text-ink-3" />
        </label>
      ) : null}
      <nav aria-label={title} className="flex flex-col gap-3">
        {groups.map((g, gi) => {
          const items = g.items.filter((i) => !s || i.label.toLowerCase().includes(s));
          if (!items.length) return null;
          return (
            <div key={g.label ?? gi} className="flex flex-col gap-px">
              {g.label ? <p className="text-overline px-2 pb-1">{g.label}</p> : null}
              {items.map((i) => {
                const on = i.id === active;
                return (
                  <button
                    key={i.id}
                    type="button"
                    aria-current={on ? "page" : undefined}
                    onClick={() => onSelect?.(i.id)}
                    className={cn(
                      "flex w-full items-start gap-2 rounded-[var(--radius-control)] px-2 py-1.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                      on ? "bg-surface-2 text-ink" : "text-ink-2 hover:bg-surface-2/60 hover:text-ink",
                    )}
                  >
                    <span aria-hidden className={cn("mt-1 h-3.5 w-0.5 shrink-0 rounded-full", on ? "bg-ink" : "bg-transparent")} />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate text-ui", on && "font-medium")}>{i.label}</span>
                      {i.description ? <span className="block truncate text-xs text-ink-3">{i.description}</span> : null}
                    </span>
                    {i.badge}
                  </button>
                );
              })}
            </div>
          );
        })}
        {s && groups.every((g) => !g.items.some((i) => i.label.toLowerCase().includes(s))) ? <p className="px-2 py-4 text-ui text-ink-3">No pages match “{q}”.</p> : null}
      </nav>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Nested navigation                                                   */
/* ------------------------------------------------------------------ */

function containsId(item: NavLinkItem, id: string): boolean {
  return item.id === id || !!item.children?.some((c) => containsId(c, id));
}

/** Multi-level nav: parents disclose children; the branch holding the active page starts open. */
export function NestedNav({ items, active, onSelect, label = "Sections", className }: { items: NavLinkItem[]; active: string; onSelect?: (id: string) => void; label?: string; className?: string }) {
  const [open, setOpen] = useState<Set<string>>(() => {
    const s = new Set<string>();
    const walk = (list: NavLinkItem[]) =>
      list.forEach((i) => {
        if (i.children?.length && containsId(i, active)) {
          s.add(i.id);
          walk(i.children);
        }
      });
    walk(items);
    return s;
  });
  const toggle = (id: string) =>
    setOpen((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const render = (list: NavLinkItem[], depth: number) => (
    <ul className={cn("flex flex-col gap-px", depth > 0 && "ml-[18px] border-l border-line pl-2")}>
      {list.map((i) => {
        const has = !!i.children?.length;
        const isOpen = open.has(i.id);
        return (
          <li key={i.id}>
            {has ? (
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => toggle(i.id)}
                className={cn(itemBase, "h-[var(--h-md)] px-2.5 text-ui", containsId(i, active) ? "text-ink" : "text-ink-2 hover:bg-surface/60 hover:text-ink")}
              >
                {i.icon ? <span aria-hidden className="inline-flex text-ink-2 [&_svg]:size-4">{i.icon}</span> : null}
                <span className="min-w-0 flex-1 truncate font-medium">{i.label}</span>
                <ChevronRight aria-hidden className={cn("size-3.5 text-ink-3 transition-transform", isOpen && "rotate-90")} />
              </button>
            ) : (
              <SideNavItem item={i} active={active === i.id} onSelect={onSelect} className="h-[var(--h-md)] px-2.5 text-ui" />
            )}
            {has && isOpen ? render(i.children!, depth + 1) : null}
          </li>
        );
      })}
    </ul>
  );
  return (
    <nav aria-label={label} className={className}>
      {render(items, 0)}
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* Sidebar footer                                                      */
/* ------------------------------------------------------------------ */

/** Credits left + the signed-in person. Collapses to an avatar in the rail. */
export function SidebarFooter({
  name,
  role,
  credits,
  creditsMax,
  collapsed,
  onSignOut,
  onCredits,
}: {
  name: string;
  role: string;
  credits: number;
  creditsMax: number;
  collapsed?: boolean;
  onSignOut?: () => void;
  onCredits?: () => void;
}) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("");
  const pct = Math.round((credits / creditsMax) * 100);
  if (collapsed)
    return (
      <Tooltip content={`${name} · ${credits.toLocaleString("en-US")} credits left`} side="right">
        <button type="button" aria-label={`${name}, ${credits} credits left`} className="grid size-10 place-items-center rounded-[var(--radius-control)] bg-surface text-xs font-semibold shadow-[var(--card-shadow)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
          {initials}
        </button>
      </Tooltip>
    );
  return (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={onCredits} className="flex flex-col gap-1.5 rounded-[var(--radius-card)] border border-line bg-surface p-3 text-left shadow-[var(--card-shadow)] outline-none hover:bg-surface-2/60 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
        <span className="flex items-baseline justify-between text-ui">
          <span className="text-ink-2">Credits</span>
          <span className="font-semibold tabular-nums">
            {credits.toLocaleString("en-US")}
            <span className="font-normal text-ink-3"> / {creditsMax.toLocaleString("en-US")}</span>
          </span>
        </span>
        <span role="meter" aria-label="Credits left" aria-valuemin={0} aria-valuemax={creditsMax} aria-valuenow={credits} className="h-1.5 overflow-hidden rounded-full bg-surface-3">
          <span className="block h-full rounded-full bg-brand-700" style={{ width: `${pct}%` }} />
        </span>
      </button>
      <div className="flex items-center gap-3 rounded-[4px] bg-surface p-2.5 shadow-[var(--card-shadow)]">
        <span aria-hidden className="grid size-9 place-items-center rounded-[3px] bg-surface-2 text-xs font-semibold">
          {initials}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{name}</span>
          <span className="block text-xs text-ink-3">{role}</span>
        </span>
        <Tooltip content="Sign out">
          <button type="button" aria-label="Sign out" onClick={onSignOut} className="grid size-8 place-items-center rounded-[var(--radius-control)] text-ink-3 outline-none hover:bg-surface-2 hover:text-ink focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
            <LogOut className="size-4" aria-hidden />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}

/** Lime workspace tile + name, as in the Signal sidebar header. Purely presentational trigger content. */
export function WorkspaceTile({ name, meta, icon, collapsed }: { name: string; meta?: string; icon: ReactNode; collapsed?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-[3px] bg-lime text-ink [&_svg]:size-[18px]">
        {icon}
      </span>
      {collapsed ? (
        <span className="sr-only">{name}</span>
      ) : (
        <>
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate text-sm font-medium">{name}</span>
            {meta ? <span className="block truncate text-xs text-ink-3">{meta}</span> : null}
          </span>
          <ChevronsUpDown aria-hidden className="size-4 shrink-0 text-ink-3" />
        </>
      )}
    </span>
  );
}
