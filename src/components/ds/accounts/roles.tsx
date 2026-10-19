"use client";

/*
 * Roles and permissions: RoleSelector (listbox popover with descriptions),
 * PermissionMatrix (role × permission checkbox grid) and AccessBadge /
 * ViewAsBanner (who can see this, and "you are viewing as…").
 */
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, Eye, Globe, Lock, RotateCcw, ShieldCheck, Users } from "@/components/icons";
import { Button, Popover, PopoverContent, PopoverTrigger, Tooltip } from "@/components/ui";
import { cn } from "@/lib/utils";

export type Role = "owner" | "admin" | "member" | "staff";

export const ROLES: { value: Role; label: string; description: string }[] = [
  { value: "owner", label: "Owner", description: "Billing, credits and everything else. One per account." },
  { value: "admin", label: "Admin", description: "Manage team, workspaces and approvals." },
  { value: "member", label: "Member", description: "Create and edit plays, posts and campaigns." },
  { value: "staff", label: "Support staff", description: "ClimbOS support. Read-only, time-limited." },
];

export const roleLabel = (r: Role) => ROLES.find((x) => x.value === r)?.label ?? r;

export interface RoleSelectorProps {
  value: Role;
  onChange: (role: Role) => void;
  /** Roles that can't be picked here (e.g. owner needs a transfer flow). */
  disabledRoles?: Role[];
  /** Roles left out entirely (e.g. staff in a customer-facing invite). */
  hiddenRoles?: Role[];
  "aria-label"?: string;
  size?: "sm" | "md";
  className?: string;
}

/** Role picker: a listbox in a popover, each option with a one-line description. Arrow keys, Enter, Esc. */
export function RoleSelector({ value, onChange, disabledRoles = [], hiddenRoles = [], size = "md", className, "aria-label": ariaLabel = "Role" }: RoleSelectorProps) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const options = ROLES.filter((r) => !hiddenRoles.includes(r.value));
  const listRef = useRef<HTMLUListElement>(null);

  const focusAt = (i: number) => {
    const items = listRef.current?.querySelectorAll<HTMLElement>("[role=option]:not([aria-disabled=true])");
    if (!items?.length) return;
    items[(i + items.length) % items.length]?.focus();
  };
  const onKey = (e: KeyboardEvent<HTMLUListElement>) => {
    const items = [...(listRef.current?.querySelectorAll<HTMLElement>("[role=option]:not([aria-disabled=true])") ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    const keys: Record<string, number> = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: items.length - 1 };
    const to = keys[e.key];
    if (to === undefined) return;
    e.preventDefault();
    focusAt(to);
  };
  const pick = (r: Role) => {
    onChange(r);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={`${ariaLabel}: ${roleLabel(value)}`}
        aria-haspopup="listbox"
        aria-controls={open ? listId : undefined}
        className={cn(
          "inline-flex items-center justify-between gap-1.5 rounded-[var(--radius-control)] border border-[var(--btn-2-border)] bg-surface text-ui font-medium text-ink shadow-[var(--btn-2-shadow)] hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]",
          size === "sm" ? "h-[var(--h-sm)] px-2.5" : "h-[var(--h-md)] px-3",
          className,
        )}
      >
        {roleLabel(value)}
        <ChevronDown aria-hidden className="size-4 text-ink-3" />
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-1"
        align="start"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          requestAnimationFrame(() => {
            const sel = listRef.current?.querySelector<HTMLElement>("[aria-selected=true]");
            if (sel) sel.focus();
            else focusAt(0);
          });
        }}
      >
        <ul ref={listRef} id={listId} role="listbox" aria-label={ariaLabel} onKeyDown={onKey}>
          {options.map((r) => {
            const disabled = disabledRoles.includes(r.value);
            const selected = r.value === value;
            return (
              <li
                key={r.value}
                role="option"
                tabIndex={-1}
                aria-selected={selected}
                aria-disabled={disabled || undefined}
                onClick={() => !disabled && pick(r.value)}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === " ") && !disabled) {
                    e.preventDefault();
                    pick(r.value);
                  }
                }}
                className={cn(
                  "flex cursor-pointer gap-2.5 rounded-[var(--radius-control)] px-2.5 py-2 outline-none hover:bg-surface-2 focus:bg-surface-2",
                  disabled && "cursor-not-allowed opacity-55 hover:bg-transparent",
                )}
              >
                <span className="mt-0.5 inline-flex size-4 shrink-0">{selected ? <Check aria-hidden className="size-4 text-brand-800" /> : null}</span>
                <span className="min-w-0">
                  <span className="block text-ui font-medium text-ink">{r.label}</span>
                  <span className="block text-xs text-ink-3">{disabled && r.value === "owner" ? "Use Transfer ownership instead." : r.description}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------------------------------------------ */
/* Permission matrix                                                   */
/* ------------------------------------------------------------------ */

export interface Permission {
  id: string;
  label: string;
  group: string;
}

export type PermissionGrid = Record<Role, string[]>;

export interface PermissionMatrixProps {
  permissions: Permission[];
  value: PermissionGrid;
  onChange: (next: PermissionGrid) => void;
  /** Columns that can't be edited (owner always has everything; staff is fixed). */
  lockedRoles?: Role[];
  roles?: Role[];
}

/** Checkbox grid of roles × permissions, grouped by area. Locked columns show why. */
export function PermissionMatrix({ permissions, value, onChange, lockedRoles = ["owner", "staff"], roles = ["owner", "admin", "member", "staff"] }: PermissionMatrixProps) {
  const groups = [...new Set(permissions.map((p) => p.group))];
  const toggle = (role: Role, id: string) => {
    const has = value[role].includes(id);
    onChange({ ...value, [role]: has ? value[role].filter((x) => x !== id) : [...value[role], id] });
  };
  return (
    <div className="relative overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface">
      <table className="w-full min-w-[560px] border-collapse text-ui">
        <caption className="sr-only">Permissions by role</caption>
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className="h-[var(--cell-h)] px-4 text-left font-medium text-ink-3">
              Permission
            </th>
            {roles.map((r) => (
              <th key={r} scope="col" className="h-[var(--cell-h)] w-28 px-2 text-center font-medium text-ink">
                <span className="inline-flex items-center gap-1">
                  {roleLabel(r)}
                  {lockedRoles.includes(r) ? <Lock aria-label="Locked" className="size-3.5 text-ink-3" /> : null}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        {groups.map((g) => (
          <tbody key={g}>
            <tr>
              <th scope="colgroup" colSpan={roles.length + 1} className="bg-surface-2 px-4 py-1.5 text-left text-overline">
                {g}
              </th>
            </tr>
            {permissions
              .filter((p) => p.group === g)
              .map((p) => (
                <tr key={p.id} className="border-t border-line hover:bg-surface-2/60">
                  <th scope="row" className="h-[var(--cell-h)] px-4 text-left font-normal text-ink">
                    {p.label}
                  </th>
                  {roles.map((r) => {
                    const locked = lockedRoles.includes(r);
                    const on = value[r].includes(p.id);
                    return (
                      <td key={r} className="text-center">
                        <input
                          type="checkbox"
                          checked={on}
                          disabled={locked}
                          onChange={() => toggle(r, p.id)}
                          aria-label={`${roleLabel(r)}: ${p.label}`}
                          className="size-4 cursor-pointer accent-[var(--brand-800)] disabled:cursor-not-allowed disabled:opacity-60"
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Access control indicator                                            */
/* ------------------------------------------------------------------ */

export type AccessLevel = "private" | "team" | "admins" | "public";

const ACCESS: Record<AccessLevel, { label: string; Icon: typeof Lock; cls: string }> = {
  private: { label: "Only you", Icon: Lock, cls: "bg-surface-2 text-ink-2" },
  team: { label: "Workspace", Icon: Users, cls: "bg-brand-50 text-brand-900" },
  admins: { label: "Admins only", Icon: ShieldCheck, cls: "bg-amber-100 text-amber-800" },
  public: { label: "Anyone with link", Icon: Globe, cls: "bg-blue-100 text-blue-800" },
};

/** Who can see this item. Icon + text; the tooltip lists the people when given. */
export function AccessBadge({ level, who }: { level: AccessLevel; who?: string }) {
  const { label, Icon, cls } = ACCESS[level];
  const badge = (
    <span tabIndex={who ? 0 : undefined} className={cn("inline-flex h-6 items-center gap-1.5 rounded-[var(--radius-badge)] px-2 text-xs font-medium focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]", cls)}>
      <Icon aria-hidden className="size-3.5" />
      {label}
    </span>
  );
  return who ? <Tooltip content={who}>{badge}</Tooltip> : badge;
}

/** Sticky strip when an admin or staff member views the app as someone else. Read-only by design. */
export function ViewAsBanner({ name, role, onExit }: { name: string; role: string; onExit: () => void }) {
  return (
    <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[var(--radius-card)] bg-ink px-4 py-2.5 text-ui text-white">
      <Eye aria-hidden className="size-4 shrink-0" />
      <span className="min-w-0 flex-1">
        Viewing as <strong className="font-semibold">{name}</strong> ({role}). Read-only: nothing you click is saved.
      </span>
      <Button size="sm" variant="secondary" onClick={onExit}>
        <RotateCcw /> Exit view
      </Button>
    </div>
  );
}
