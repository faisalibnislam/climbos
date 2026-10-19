"use client";

import { useState } from "react";
import { DropdownMenu as RMenu } from "radix-ui";
import { ArrowDown, ArrowUp, ArrowUpDown, Bookmark, Check, ChevronDown, Filter, Layers, Plus, RotateCcw, X } from "@/components/icons";
import { Button, Input, Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { SortDir } from "./model";

const triggerCls =
  "inline-flex h-[var(--h-sm)] items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--btn-2-border)] bg-surface px-2.5 text-ui font-medium text-ink-2 shadow-[var(--btn-2-shadow)] transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--focus-ring)] [&_svg]:size-4";

const itemCls =
  "relative flex min-h-8 cursor-pointer select-none items-center rounded-[var(--radius-control)] py-1.5 pl-8 pr-2.5 text-ui text-ink outline-none data-[highlighted]:bg-surface-2";

/* ------------------------------------------------------------------ */
/* Sort dropdown + direction                                           */
/* ------------------------------------------------------------------ */

export interface SortOption {
  value: string;
  label: string;
  /** Words for each direction, e.g. ["Oldest first", "Newest first"]. */
  dirLabels?: [asc: string, desc: string];
}

export interface SortDropdownProps {
  options: SortOption[];
  value: string;
  onChange: (v: string) => void;
  dir?: SortDir;
  /** Include direction choices in the menu as well. */
  onDirChange?: (d: SortDir) => void;
  className?: string;
}

/** "Sort: Score" menu (radio items), optionally with direction inside. */
export function SortDropdown({ options, value, onChange, dir, onDirChange, className }: SortDropdownProps) {
  const cur = options.find((o) => o.value === value);
  const dirs = cur?.dirLabels ?? ["Ascending", "Descending"];
  return (
    <RMenu.Root>
      <RMenu.Trigger className={cn(triggerCls, className)}>
        <ArrowUpDown aria-hidden="true" />
        <span>
          Sort: <span className="text-ink">{cur?.label}</span>
        </span>
        <ChevronDown aria-hidden="true" className="text-ink-3" />
      </RMenu.Trigger>
      <RMenu.Portal>
        <RMenu.Content align="start" sideOffset={6} className="z-50 min-w-48 rounded-[var(--radius-card)] border border-line bg-surface p-1 shadow-[var(--shadow-lg)]">
          <RMenu.Label className="px-2.5 pb-1 pt-1.5 text-overline">Sort by</RMenu.Label>
          <RMenu.RadioGroup value={value} onValueChange={onChange}>
            {options.map((o) => (
              <RMenu.RadioItem key={o.value} value={o.value} className={itemCls}>
                <RMenu.ItemIndicator className="absolute left-2.5 inline-flex">
                  <Check aria-hidden="true" className="size-4" />
                </RMenu.ItemIndicator>
                {o.label}
              </RMenu.RadioItem>
            ))}
          </RMenu.RadioGroup>
          {dir && onDirChange ? (
            <>
              <RMenu.Separator className="my-1 h-px bg-line" />
              <RMenu.RadioGroup value={dir} onValueChange={(d) => onDirChange(d as SortDir)}>
                {(["asc", "desc"] as const).map((d, i) => (
                  <RMenu.RadioItem key={d} value={d} className={itemCls}>
                    <RMenu.ItemIndicator className="absolute left-2.5 inline-flex">
                      <Check aria-hidden="true" className="size-4" />
                    </RMenu.ItemIndicator>
                    {dirs[i]}
                  </RMenu.RadioItem>
                ))}
              </RMenu.RadioGroup>
            </>
          ) : null}
        </RMenu.Content>
      </RMenu.Portal>
    </RMenu.Root>
  );
}

/** Square toggle that flips asc / desc and says which in words. */
export function SortDirectionToggle({ dir, onChange, labels = ["Ascending", "Descending"], showLabel = true, className }: { dir: SortDir; onChange: (d: SortDir) => void; labels?: [string, string]; showLabel?: boolean; className?: string }) {
  const text = dir === "asc" ? labels[0] : labels[1];
  return (
    <button
      type="button"
      onClick={() => onChange(dir === "asc" ? "desc" : "asc")}
      aria-label={`Sort direction: ${text}. Click to reverse.`}
      className={cn(triggerCls, !showLabel && "w-[var(--h-sm)] justify-center px-0", className)}
    >
      {dir === "asc" ? <ArrowUp aria-hidden="true" /> : <ArrowDown aria-hidden="true" />}
      {showLabel ? <span className="text-ink">{text}</span> : null}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Group by                                                            */
/* ------------------------------------------------------------------ */

export function GroupByControl({ options, value, onChange, className }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void; className?: string }) {
  const cur = options.find((o) => o.value === value);
  return (
    <RMenu.Root>
      <RMenu.Trigger className={cn(triggerCls, className)}>
        <Layers aria-hidden="true" />
        <span>
          Group: <span className="text-ink">{cur?.label ?? "None"}</span>
        </span>
        <ChevronDown aria-hidden="true" className="text-ink-3" />
      </RMenu.Trigger>
      <RMenu.Portal>
        <RMenu.Content align="start" sideOffset={6} className="z-50 min-w-44 rounded-[var(--radius-card)] border border-line bg-surface p-1 shadow-[var(--shadow-lg)]">
          <RMenu.Label className="px-2.5 pb-1 pt-1.5 text-overline">Group by</RMenu.Label>
          <RMenu.RadioGroup value={value} onValueChange={onChange}>
            {[{ value: "none", label: "None" }, ...options].map((o) => (
              <RMenu.RadioItem key={o.value} value={o.value} className={itemCls}>
                <RMenu.ItemIndicator className="absolute left-2.5 inline-flex">
                  <Check aria-hidden="true" className="size-4" />
                </RMenu.ItemIndicator>
                {o.label}
              </RMenu.RadioItem>
            ))}
          </RMenu.RadioGroup>
        </RMenu.Content>
      </RMenu.Portal>
    </RMenu.Root>
  );
}

/* ------------------------------------------------------------------ */
/* Saved views                                                         */
/* ------------------------------------------------------------------ */

export interface SavedView {
  id: string;
  name: string;
  count?: number;
}

export interface SavedViewsProps {
  views: SavedView[];
  activeId: string;
  onSelect: (id: string) => void;
  /** Current filters differ from the active view. */
  modified?: boolean;
  onReset?: () => void;
  onUpdate?: () => void;
  onSaveAs?: (name: string) => void;
  onDelete?: (id: string) => void;
  className?: string;
}

/** View tabs over a list. A dot marks edits; Reset, Update or Save as new. */
export function SavedViews({ views, activeId, onSelect, modified, onReset, onUpdate, onSaveAs, onDelete, className }: SavedViewsProps) {
  const [name, setName] = useState("");
  return (
    <div className={cn("flex flex-wrap items-center gap-x-1 gap-y-2", className)}>
      <div role="group" aria-label="Views" className="flex flex-wrap items-center gap-1">
        {views.map((v) => {
          const active = v.id === activeId;
          return (
            <span key={v.id} className={cn("group inline-flex h-[var(--h-sm)] items-center rounded-[var(--radius-control)] text-ui font-medium", active ? "bg-ink text-white" : "text-ink-2 hover:bg-surface-2 hover:text-ink")}>
              <button type="button" aria-pressed={active} onClick={() => onSelect(v.id)} className="inline-flex h-full items-center gap-1.5 rounded-[var(--radius-control)] px-2.5">
                {v.name}
                {v.count !== undefined ? <span className={cn("text-xs tabular-nums", active ? "text-white/70" : "text-ink-3")}>{v.count}</span> : null}
                {active && modified ? (
                  <span className="size-1.5 rounded-full bg-lime">
                    <span className="sr-only">(edited)</span>
                  </span>
                ) : null}
              </button>
              {onDelete && !active && v.id !== views[0]?.id ? (
                <button type="button" onClick={() => onDelete(v.id)} aria-label={`Delete view ${v.name}`} className="-ml-1 mr-1 hidden size-5 place-items-center rounded-[var(--radius-control)] text-ink-3 hover:bg-surface-3 hover:text-ink group-hover:grid group-focus-within:grid">
                  <X aria-hidden="true" className="size-3" />
                </button>
              ) : null}
            </span>
          );
        })}
      </div>
      {modified ? (
        <div className="ml-1 flex items-center gap-1">
          {onReset ? (
            <Button size="sm" variant="ghost" onClick={onReset}>
              <RotateCcw aria-hidden="true" /> Reset
            </Button>
          ) : null}
          {onUpdate ? (
            <Button size="sm" variant="secondary" onClick={onUpdate}>
              Update view
            </Button>
          ) : null}
        </div>
      ) : null}
      {onSaveAs ? (
        <Popover onOpenChange={(o) => !o && setName("")}>
          <PopoverTrigger asChild>
            <Button size="sm" variant="ghost">
              <Plus aria-hidden="true" /> Save view
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64" aria-label="Save view">
            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (name.trim()) onSaveAs(name.trim());
              }}
            >
              <label className="text-ui font-medium text-ink" htmlFor="ds-save-view-name">
                View name
              </label>
              <Input id="ds-save-view-name" size="sm" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Hot website leads" autoFocus />
              <p className="text-xs text-ink-3">Saves the current filters, sort and grouping.</p>
              <div className="flex justify-end gap-2">
                <PopoverClose asChild>
                  <Button size="sm" variant="ghost">
                    Cancel
                  </Button>
                </PopoverClose>
                {name.trim() ? (
                  <PopoverClose asChild>
                    <Button size="sm" type="submit">
                      <Bookmark aria-hidden="true" /> Save
                    </Button>
                  </PopoverClose>
                ) : (
                  <Button size="sm" disabled>
                    <Bookmark aria-hidden="true" /> Save
                  </Button>
                )}
              </div>
            </form>
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Clear filters + counter                                             */
/* ------------------------------------------------------------------ */

export function ClearFiltersButton({ count, onClear, className }: { count: number; onClear: () => void; className?: string }) {
  return (
    <Button size="sm" variant="ghost" disabled={!count} onClick={onClear} className={className}>
      <X aria-hidden="true" /> Clear filters{count ? ` (${count})` : ""}
    </Button>
  );
}

/** "Filters 3" toggle that opens a filter panel; the count is the number of active filters. */
export function ActiveFilterCounter({ count, pressed, onClick, className }: { count: number; pressed?: boolean; onClick?: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      aria-label={count ? `Filters, ${count} active` : "Filters, none active"}
      className={cn(triggerCls, (count > 0 || pressed) && "border-ink text-ink", className)}
    >
      <Filter aria-hidden="true" />
      Filters
      {count ? <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-[var(--radius-badge)] bg-ink px-1 text-2xs font-semibold tabular-nums text-white">{count}</span> : null}
    </button>
  );
}
