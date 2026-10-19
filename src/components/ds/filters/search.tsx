"use client";

import { forwardRef, useId, useState, type KeyboardEvent, type ReactNode } from "react";
import { Bookmark, Clock, Search, SlidersHorizontal, Trash2, X, Play } from "@/components/icons";
import { Button, Field, Input, Kbd, Select, controlClasses } from "@/components/ui";
import { cn } from "@/lib/utils";
import { advancedToString, EMPTY_ADVANCED, type AdvancedQuery, type FilterOption } from "./model";

/* ------------------------------------------------------------------ */
/* Local search                                                        */
/* ------------------------------------------------------------------ */

export interface SearchFieldProps {
  value: string;
  onChange: (v: string) => void;
  /** Accessible name, e.g. "Search leads". */
  label: string;
  placeholder?: string;
  /** Shown as a hint on the right while empty. */
  shortcut?: string;
  /** Results count, announced politely. */
  resultCount?: number;
  size?: "sm" | "md";
  className?: string;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
}

/** Search box that filters the list it sits above. Esc clears. */
export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  { value, onChange, label, placeholder = "Search", shortcut, resultCount, size = "md", className, onKeyDown },
  ref,
) {
  return (
    <div className={cn("relative flex items-center", className)}>
      <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 size-4 text-ink-3" />
      <input
        ref={ref}
        type="search"
        aria-label={label}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && value) {
            e.preventDefault();
            onChange("");
          }
          onKeyDown?.(e);
        }}
        className={cn(controlClasses, "pl-8 pr-9 [&::-webkit-search-cancel-button]:hidden", size === "sm" ? "h-[var(--h-sm)]" : "h-[var(--h-md)]")}
      />
      {value ? (
        <button type="button" onClick={() => onChange("")} aria-label="Clear search" className="absolute right-1 grid size-7 place-items-center rounded-[var(--radius-control)] text-ink-3 hover:bg-surface-2 hover:text-ink">
          <X aria-hidden="true" className="size-4" />
        </button>
      ) : shortcut ? (
        <Kbd className="pointer-events-none absolute right-2">{shortcut}</Kbd>
      ) : null}
      {resultCount !== undefined ? (
        <span className="sr-only" aria-live="polite">
          {value ? `${resultCount} results` : ""}
        </span>
      ) : null}
    </div>
  );
});

/** Bold the part of `text` that matches `q`. */
export function Highlight({ text, q }: { text: string; q: string }) {
  const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-transparent font-semibold text-ink">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Search with suggestions + recent                                    */
/* ------------------------------------------------------------------ */

export interface SearchComboboxProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** Runs a search (Enter or picking an option). */
  onSearch: (q: string) => void;
  suggestions: string[];
  recent?: string[];
  onRemoveRecent?: (q: string) => void;
  onClearRecent?: () => void;
  placeholder?: string;
  className?: string;
}

/**
 * ARIA combobox: recent searches when empty, matching suggestions while typing.
 * ↑/↓ move, Enter picks, Esc closes.
 */
export function SearchCombobox({ label, value, onChange, onSearch, suggestions, recent = [], onRemoveRecent, onClearRecent, placeholder = "Search", className }: SearchComboboxProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const q = value.trim();
  const ql = q.toLowerCase();
  const rec = (ql ? recent.filter((r) => r.toLowerCase().includes(ql)) : recent).slice(0, 4);
  const sug = ql ? suggestions.filter((s) => s.toLowerCase().includes(ql) && !rec.includes(s)).slice(0, 6) : [];
  const items = [...rec.map((text) => ({ kind: "recent" as const, text })), ...sug.map((text) => ({ kind: "suggestion" as const, text }))];
  const showList = open && items.length > 0;

  const pick = (text: string) => {
    onChange(text);
    onSearch(text);
    setOpen(false);
    setActive(-1);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (items.length ? (a + 1) % items.length : -1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (items.length ? (a <= 0 ? items.length - 1 : a - 1) : -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (showList && active >= 0 && items[active]) pick(items[active].text);
      else if (q) pick(q);
    } else if (e.key === "Escape") {
      if (showList) {
        e.preventDefault();
        setOpen(false);
        setActive(-1);
      } else if (value) onChange("");
    }
  };

  const option = (it: (typeof items)[number], i: number) => (
    <li
      key={`${it.kind}-${it.text}`}
      id={`${id}-opt-${i}`}
      role="option"
      aria-selected={active === i}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => pick(it.text)}
      onMouseEnter={() => setActive(i)}
      className={cn("group flex min-h-8 cursor-pointer items-center gap-2 rounded-[var(--radius-control)] px-2 text-ui text-ink-2", active === i && "bg-surface-2 text-ink")}
    >
      {it.kind === "recent" ? <Clock aria-hidden="true" className="size-4 shrink-0 text-ink-3" /> : <Search aria-hidden="true" className="size-4 shrink-0 text-ink-3" />}
      <span className="min-w-0 flex-1 truncate">
        <Highlight text={it.text} q={q} />
      </span>
      {it.kind === "recent" && onRemoveRecent ? (
        <button
          type="button"
          tabIndex={-1}
          aria-label={`Remove ${it.text} from recent searches`}
          onClick={(e) => {
            e.stopPropagation();
            onRemoveRecent(it.text);
          }}
          className="grid size-6 place-items-center rounded-[var(--radius-control)] text-ink-3 opacity-0 hover:bg-surface-3 hover:text-ink group-hover:opacity-100 group-aria-selected:opacity-100"
        >
          <X aria-hidden="true" className="size-3.5" />
        </button>
      ) : null}
    </li>
  );

  return (
    <div className={cn("relative", className)}>
      <div className="relative flex items-center">
        <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 size-4 text-ink-3" />
        <input
          role="combobox"
          aria-label={label}
          aria-expanded={showList}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 ? `${id}-opt-${active}` : undefined}
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          className={cn(controlClasses, "h-[var(--h-md)] pl-8 pr-9")}
        />
        {value ? (
          <button type="button" onClick={() => onChange("")} aria-label="Clear search" className="absolute right-1 grid size-7 place-items-center rounded-[var(--radius-control)] text-ink-3 hover:bg-surface-2 hover:text-ink">
            <X aria-hidden="true" className="size-4" />
          </button>
        ) : null}
      </div>
      <div className={cn("absolute inset-x-0 top-full z-30 mt-1.5 rounded-[var(--radius-card)] border border-line bg-surface p-1 shadow-[var(--shadow-lg)]", !showList && "hidden")}>
        <ul id={`${id}-list`} role="listbox" aria-label={`${label} suggestions`}>
          {rec.length ? (
            <li role="presentation" className="flex items-center justify-between px-2 pb-1 pt-1.5">
              <span className="text-overline">Recent</span>
              {onClearRecent && !ql ? (
                <button type="button" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={onClearRecent} className="text-xs font-medium text-ink-3 hover:text-ink">
                  Clear
                </button>
              ) : null}
            </li>
          ) : null}
          {items.slice(0, rec.length).map((it, i) => option(it, i))}
          {sug.length ? (
            <li role="presentation" className="px-2 pb-1 pt-2">
              <span className="text-overline">Suggestions</span>
            </li>
          ) : null}
          {items.slice(rec.length).map((it, i) => option(it, i + rec.length))}
        </ul>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Recent searches                                                     */
/* ------------------------------------------------------------------ */

export function RecentSearches({ items, onPick, onRemove, onClear, className }: { items: string[]; onPick: (q: string) => void; onRemove: (q: string) => void; onClear?: () => void; className?: string }) {
  if (!items.length) return <p className={cn("text-ui text-ink-3", className)}>No recent searches.</p>;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between">
        <p className="text-overline">Recent searches</p>
        {onClear ? (
          <button type="button" onClick={onClear} className="text-xs font-medium text-ink-3 hover:text-ink">
            Clear all
          </button>
        ) : null}
      </div>
      <ul className="flex flex-wrap gap-1.5">
        {items.map((q) => (
          <li key={q} className="inline-flex h-7 items-center rounded-[var(--radius-badge)] bg-surface-2 text-xs text-ink-2">
            <button type="button" onClick={() => onPick(q)} className="inline-flex h-full items-center gap-1.5 rounded-l-[var(--radius-badge)] pl-2 pr-1 hover:text-ink">
              <Clock aria-hidden="true" className="size-3.5 text-ink-3" />
              {q}
            </button>
            <button type="button" onClick={() => onRemove(q)} aria-label={`Remove ${q}`} className="grid h-full w-6 place-items-center rounded-r-[var(--radius-badge)] text-ink-3 hover:bg-surface-3 hover:text-ink">
              <X aria-hidden="true" className="size-3" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Saved searches                                                      */
/* ------------------------------------------------------------------ */

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  /** Matching items right now. */
  count?: number;
  /** Notify when new matches arrive. */
  alert?: boolean;
}

export interface SavedSearchesProps {
  items: SavedSearch[];
  activeId?: string | null;
  onRun: (s: SavedSearch) => void;
  onDelete: (id: string) => void;
  /** Save the current query under a name. Omit to hide the save row. */
  onSave?: (name: string) => void;
  currentQuery?: string;
  className?: string;
}

export function SavedSearches({ items, activeId, onRun, onDelete, onSave, currentQuery, className }: SavedSearchesProps) {
  const [name, setName] = useState("");
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <ul className="flex flex-col divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface">
        {items.map((s) => (
          <li key={s.id} className={cn("flex items-center gap-3 px-3 py-2", activeId === s.id && "bg-brand-50")}>
            <Bookmark aria-hidden="true" className={cn("size-4 shrink-0", activeId === s.id ? "text-ink" : "text-ink-3")} />
            <button type="button" onClick={() => onRun(s)} aria-pressed={activeId === s.id} className="min-w-0 flex-1 text-left">
              <span className="block truncate text-ui font-medium text-ink">{s.name}</span>
              <span className="block truncate font-mono text-2xs text-ink-3">{s.query}</span>
            </button>
            {s.count !== undefined ? <span className="shrink-0 rounded-[var(--radius-badge)] bg-surface-2 px-1.5 text-xs tabular-nums text-ink-2">{s.count}</span> : null}
            <button type="button" onClick={() => onRun(s)} aria-label={`Run ${s.name}`} className="grid size-7 shrink-0 place-items-center rounded-[var(--radius-control)] text-ink-3 hover:bg-surface-2 hover:text-ink">
              <Play aria-hidden="true" className="size-3.5" />
            </button>
            <button type="button" onClick={() => onDelete(s.id)} aria-label={`Delete ${s.name}`} className="grid size-7 shrink-0 place-items-center rounded-[var(--radius-control)] text-ink-3 hover:bg-surface-2 hover:text-red-800">
              <Trash2 aria-hidden="true" className="size-3.5" />
            </button>
          </li>
        ))}
        {!items.length ? <li className="px-3 py-3 text-ui text-ink-3">No saved searches yet.</li> : null}
      </ul>
      {onSave ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim() || !currentQuery) return;
            onSave(name.trim());
            setName("");
          }}
        >
          <Field label="Save current search" hint={currentQuery ? <span className="font-mono">{currentQuery}</span> : "Type a search first"} className="min-w-48 flex-1">
            <Input size="sm" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, e.g. Hot Brooklyn leads" disabled={!currentQuery} />
          </Field>
          <Button type="submit" size="sm" variant="secondary" disabled={!name.trim() || !currentQuery}>
            <Bookmark aria-hidden="true" /> Save
          </Button>
        </form>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Advanced search                                                     */
/* ------------------------------------------------------------------ */

export interface AdvancedSearchProps {
  value: AdvancedQuery;
  onChange: (v: AdvancedQuery) => void;
  fields: FilterOption[];
  onReset?: () => void;
  footer?: ReactNode;
  className?: string;
}

/** Structured search form that also shows the equivalent search-box syntax. */
export function AdvancedSearch({ value, onChange, fields, onReset, footer, className }: AdvancedSearchProps) {
  const set = (k: keyof AdvancedQuery) => (v: string) => onChange({ ...value, [k]: v });
  const fieldLabel = fields.find((f) => f.value === value.field)?.label;
  const syntax = advancedToString(value, fieldLabel);
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex items-center gap-2">
        <SlidersHorizontal aria-hidden="true" className="size-4 text-ink-3" />
        <p className="heading-card">Advanced search</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="All of these words">
          <Input size="sm" value={value.all} onChange={(e) => set("all")(e.target.value)} placeholder="dentist brooklyn" />
        </Field>
        <Field label="This exact phrase">
          <Input size="sm" value={value.exact} onChange={(e) => set("exact")(e.target.value)} placeholder="same day" />
        </Field>
        <Field label="Any of these words">
          <Input size="sm" value={value.any} onChange={(e) => set("any")(e.target.value)} placeholder="implant whitening" />
        </Field>
        <Field label="None of these words">
          <Input size="sm" value={value.none} onChange={(e) => set("none")(e.target.value)} placeholder="spam" />
        </Field>
        <Field label="Search in">
          <Select options={[{ value: "any", label: "Any field" }, ...fields]} value={value.field} onValueChange={set("field")} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-control)] bg-surface-2 px-3 py-2">
        <code className="min-w-0 break-all font-mono text-xs text-ink-2">{syntax || "Nothing set yet"}</code>
        {onReset ? (
          <Button size="sm" variant="ghost" onClick={() => (onReset ? onReset() : onChange(EMPTY_ADVANCED))}>
            Reset
          </Button>
        ) : null}
      </div>
      {footer}
    </div>
  );
}
