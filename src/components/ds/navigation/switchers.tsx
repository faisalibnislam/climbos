"use client";

/*
 * Context switchers (workspace, organization, project, account) and the connected-app launcher.
 * All share SwitcherMenu: optional filter, arrow-key list, current item checked, footer actions.
 */
import { useState, type KeyboardEvent, type ReactNode } from "react";
import { Building2, Check, ChevronDown, ChevronsUpDown, LayoutGrid, LogOut, Plus, Search } from "@/components/icons";
import { Avatar, Popover, PopoverContent, PopoverTrigger, Tooltip } from "@/components/ui";
import { cn } from "@/lib/utils";
import { WorkspaceTile } from "./sidebar";

export interface SwitcherOption {
  id: string;
  label: string;
  meta?: string;
  icon?: ReactNode;
  badge?: ReactNode;
}

export interface SwitcherAction {
  id: string;
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
}

/** Move focus between [data-sw] items with arrows / Home / End. */
function rovingKeys(e: KeyboardEvent<HTMLElement>) {
  const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
  if (!keys.includes(e.key)) return;
  const items = [...e.currentTarget.querySelectorAll<HTMLElement>("[data-sw]")];
  if (!items.length) return;
  e.preventDefault();
  const i = items.indexOf(document.activeElement as HTMLElement);
  const n = e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : e.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
  items[n]?.focus();
}

const optCls =
  "flex w-full items-center gap-2.5 rounded-[var(--radius-control)] px-2 py-1.5 text-left text-ui text-ink outline-none transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]";

/** The list inside any switcher. */
export function SwitcherMenu({
  options,
  value,
  onChange,
  label,
  searchable,
  searchPlaceholder = "Find…",
  actions = [],
}: {
  options: SwitcherOption[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  actions?: SwitcherAction[];
}) {
  const [q, setQ] = useState("");
  const s = q.trim().toLowerCase();
  const list = s ? options.filter((o) => o.label.toLowerCase().includes(s) || o.meta?.toLowerCase().includes(s)) : options;
  return (
    <div onKeyDown={rovingKeys} className="flex flex-col">
      {searchable ? (
        <label className="mb-1 flex h-[var(--h-sm)] items-center gap-2 rounded-[var(--radius-control)] bg-surface-2 px-2.5 text-ink-3 focus-within:ring-2 focus-within:ring-[var(--focus-ring)]">
          <Search aria-hidden className="size-3.5" />
          <span className="sr-only">{searchPlaceholder}</span>
          <input data-sw value={q} onChange={(e) => setQ(e.target.value)} placeholder={searchPlaceholder} className="min-w-0 flex-1 bg-transparent text-ui text-ink outline-none placeholder:text-ink-3" />
        </label>
      ) : null}
      <p className="text-overline px-2 pb-1 pt-1.5">{label}</p>
      <ul className="flex max-h-64 flex-col gap-px overflow-y-auto" aria-label={label}>
        {list.map((o) => {
          const on = o.id === value;
          return (
            <li key={o.id}>
              <button data-sw type="button" aria-current={on || undefined} onClick={() => onChange(o.id)} className={optCls}>
                {o.icon ? <span aria-hidden className="inline-flex shrink-0">{o.icon}</span> : null}
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate", on && "font-medium")}>{o.label}</span>
                  {o.meta ? <span className="block truncate text-xs text-ink-3">{o.meta}</span> : null}
                </span>
                {o.badge}
                {on ? <Check aria-label="Current" className="size-4 shrink-0 text-ink" /> : <span className="size-4 shrink-0" />}
              </button>
            </li>
          );
        })}
        {!list.length ? <li className="px-2 py-3 text-ui text-ink-3">Nothing matches “{q}”.</li> : null}
      </ul>
      {actions.length ? (
        <div className="mt-1 flex flex-col gap-px border-t border-line pt-1">
          {actions.map((a) => (
            <button key={a.id} data-sw type="button" onClick={a.onSelect} className={cn(optCls, a.danger ? "text-red-800 hover:bg-red-100" : "text-ink-2")}>
              {a.icon ? <span aria-hidden className="inline-flex shrink-0 [&_svg]:size-4">{a.icon}</span> : null}
              {a.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

interface SwitcherBase {
  options: SwitcherOption[];
  value: string;
  onChange: (id: string) => void;
  onCreate?: () => void;
  className?: string;
}

function useClosingChange(onChange: (id: string) => void) {
  const [open, setOpen] = useState(false);
  return { open, setOpen, change: (id: string) => (setOpen(false), onChange(id)) };
}

/** Signal sidebar header: lime tile, workspace name and plan. */
export function WorkspaceSwitcher({ options, value, onChange, onCreate, collapsed, className }: SwitcherBase & { collapsed?: boolean }) {
  const { open, setOpen, change } = useClosingChange(onChange);
  const cur = options.find((o) => o.id === value) ?? options[0];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={collapsed ? `Workspace: ${cur.label}` : undefined}
          className={cn("w-full rounded-[var(--radius-control)] px-1 py-1.5 outline-none transition-colors hover:bg-surface/60 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] data-[state=open]:bg-surface/60", collapsed && "w-auto px-0", className)}
        >
          <WorkspaceTile name={cur.label} meta={cur.meta} icon={cur.icon} collapsed={collapsed} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-1.5" align="start">
        <SwitcherMenu
          label="Workspaces"
          options={options.map((o) => ({ ...o, icon: <span className="grid size-7 place-items-center rounded-[3px] bg-surface-2 text-ink-2 [&_svg]:size-3.5">{o.icon}</span> }))}
          value={value}
          onChange={change}
          searchable={options.length > 5}
          actions={onCreate ? [{ id: "new", label: "New workspace", icon: <Plus />, onSelect: () => (setOpen(false), onCreate()) }] : []}
        />
      </PopoverContent>
    </Popover>
  );
}

/** Organization (billing account / agency) switcher: compact, sits above workspaces. */
export function OrganizationSwitcher({ options, value, onChange, onCreate, className }: SwitcherBase) {
  const { open, setOpen, change } = useClosingChange(onChange);
  const cur = options.find((o) => o.id === value) ?? options[0];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={cn("inline-flex h-[var(--h-sm)] max-w-full items-center gap-2 rounded-[var(--radius-control)] px-2 text-ui text-ink outline-none hover:bg-surface focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] data-[state=open]:bg-surface", className)}>
          <Building2 aria-hidden className="size-4 shrink-0 text-ink-3" />
          <span className="truncate font-medium">{cur.label}</span>
          {cur.badge}
          <ChevronsUpDown aria-hidden className="size-3.5 shrink-0 text-ink-3" />
          <span className="sr-only">, switch organization</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-1.5" align="start">
        <SwitcherMenu
          label="Organizations"
          options={options}
          value={value}
          onChange={change}
          actions={onCreate ? [{ id: "new", label: "Create organization", icon: <Plus />, onSelect: () => (setOpen(false), onCreate()) }] : []}
        />
      </PopoverContent>
    </Popover>
  );
}

/** Project / campaign switcher for the top bar: "/" separator, filterable. */
export function ProjectSwitcher({ options, value, onChange, onCreate, className }: SwitcherBase) {
  const { open, setOpen, change } = useClosingChange(onChange);
  const cur = options.find((o) => o.id === value) ?? options[0];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={cn("inline-flex h-[var(--h-sm)] max-w-full items-center gap-1.5 rounded-[var(--radius-control)] px-2 text-ui font-medium text-ink outline-none hover:bg-surface focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] data-[state=open]:bg-surface", className)}>
          {cur.icon ? <span aria-hidden className="inline-flex">{cur.icon}</span> : null}
          <span className="truncate">{cur.label}</span>
          <ChevronDown aria-hidden className="size-3.5 shrink-0 text-ink-3" />
          <span className="sr-only">, switch project</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-1.5" align="start">
        <SwitcherMenu
          label="Projects"
          options={options}
          value={value}
          onChange={change}
          searchable
          searchPlaceholder="Find a project"
          actions={onCreate ? [{ id: "new", label: "New project", icon: <Plus />, onSelect: () => (setOpen(false), onCreate()) }] : []}
        />
      </PopoverContent>
    </Popover>
  );
}

export interface Account {
  id: string;
  name: string;
  email: string;
}

/** Avatar menu: signed-in accounts, add another, sign out. */
export function AccountSwitcher({ accounts, value, onChange, onAdd, onSignOut, links = [] }: { accounts: Account[]; value: string; onChange: (id: string) => void; onAdd?: () => void; onSignOut?: () => void; links?: SwitcherAction[] }) {
  const { open, setOpen, change } = useClosingChange(onChange);
  const cur = accounts.find((a) => a.id === value) ?? accounts[0];
  const close = (fn?: () => void) => () => {
    setOpen(false);
    fn?.();
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip content="Account">
        <PopoverTrigger asChild>
          <button type="button" aria-label={`Account: ${cur.name}`} className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2">
            <Avatar name={cur.name} size="md" />
          </button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent className="w-72 p-1.5" align="end">
        <div className="flex items-center gap-3 px-2 pb-2 pt-1.5">
          <Avatar name={cur.name} size="lg" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{cur.name}</span>
            <span className="block truncate text-xs text-ink-3">{cur.email}</span>
          </span>
        </div>
        <SwitcherMenu
          label="Switch account"
          options={accounts.map((a) => ({ id: a.id, label: a.name, meta: a.email, icon: <Avatar name={a.name} size="sm" /> }))}
          value={value}
          onChange={change}
          actions={[
            ...links.map((l) => ({ ...l, onSelect: close(l.onSelect) })),
            ...(onAdd ? [{ id: "add", label: "Add another account", icon: <Plus />, onSelect: close(onAdd) }] : []),
            ...(onSignOut ? [{ id: "out", label: "Sign out", icon: <LogOut />, onSelect: close(onSignOut), danger: true }] : []),
          ]}
        />
      </PopoverContent>
    </Popover>
  );
}

export interface LauncherApp {
  id: string;
  name: string;
  blurb: string;
  icon: ReactNode;
  connected?: boolean;
}

/** Grid of connected apps. Arrow keys move across the grid; connected apps say so. */
export function AppLauncher({ apps, current, onOpen }: { apps: LauncherApp[]; current?: string; onOpen: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const cols = 3;
  const onKey = (e: KeyboardEvent<HTMLElement>) => {
    const d = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key];
    if (!d) return;
    const items = [...e.currentTarget.querySelectorAll<HTMLElement>("[data-app]")];
    const i = items.indexOf(document.activeElement as HTMLElement);
    const n = i + d;
    if (n < 0 || n >= items.length) return;
    e.preventDefault();
    items[n].focus();
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip content="Connected apps">
        <PopoverTrigger asChild>
          <button type="button" aria-label="Connected apps" className="grid size-[var(--h-md)] place-items-center rounded-[var(--radius-control)] text-ink-2 outline-none hover:bg-surface hover:text-ink focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] data-[state=open]:bg-surface">
            <LayoutGrid aria-hidden className="size-[18px]" />
          </button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent className="w-80 p-2" align="end">
        <p className="text-overline px-1.5 pb-2 pt-1">Connected apps</p>
        <ul onKeyDown={onKey} className="grid grid-cols-3 gap-1">
          {apps.map((a) => (
            <li key={a.id}>
              <button
                data-app
                type="button"
                aria-current={a.id === current || undefined}
                onClick={() => {
                  setOpen(false);
                  onOpen(a.id);
                }}
                className={cn(
                  "flex w-full flex-col items-center gap-1.5 rounded-[var(--radius-card)] px-1 py-3 text-center outline-none transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                  a.id === current && "bg-surface-2",
                )}
              >
                <span aria-hidden className={cn("grid size-10 place-items-center rounded-[var(--radius-card)] [&_svg]:size-[18px]", a.id === current ? "bg-lime text-ink" : "bg-ink text-white")}>
                  {a.icon}
                </span>
                <span className="text-ui font-medium text-ink">{a.name}</span>
                <span className="text-2xs leading-tight text-ink-3">{a.id === current ? "You're here" : a.connected ? "Connected" : a.blurb}</span>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
