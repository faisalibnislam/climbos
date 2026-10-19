"use client";

import { Popover as RPopover, RadioGroup as RRadio } from "radix-ui";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Check, ChevronDown, Plus, Search, X } from "@/components/icons";
import { controlClasses, useFieldControl } from "@/components/ui";
import { cn } from "@/lib/utils";
import { bareInputClasses, shellClasses } from "./inputs";

/* ------------------------------------------------------------------ */
/* Shared listbox bits                                                 */
/* ------------------------------------------------------------------ */

export interface ChoiceOption {
  value: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
}

const listClasses = "max-h-64 overflow-y-auto rounded-[var(--radius-card)] border border-line bg-surface p-1 shadow-lg";
const optionClasses =
  "flex min-h-8 cursor-pointer select-none items-center gap-2 rounded-[var(--radius-control)] px-2.5 py-1.5 text-ui text-ink " +
  "aria-disabled:cursor-not-allowed aria-disabled:opacity-45 data-[active=true]:bg-surface-2 [&_svg]:size-4";

/** Bold the part of `label` that matches `query`. */
export function Highlight({ label, query }: { label: string; query: string }) {
  const i = query ? label.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (i < 0) return <>{label}</>;
  return (
    <>
      {label.slice(0, i)}
      <span className="font-semibold text-ink">{label.slice(i, i + query.length)}</span>
      {label.slice(i + query.length)}
    </>
  );
}

function OptionBody({ o, query }: { o: ChoiceOption; query: string }) {
  return (
    <>
      {o.icon ? (
        <span aria-hidden="true" className="inline-flex text-ink-3">
          {o.icon}
        </span>
      ) : null}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate">
          <Highlight label={o.label} query={query} />
        </span>
        {o.description ? <span className="truncate text-xs text-ink-3">{o.description}</span> : null}
      </span>
    </>
  );
}

/** Moves the active index with arrows/Home/End, skipping disabled options. */
function nextIndex(opts: ChoiceOption[], from: number, key: string) {
  const n = opts.length;
  if (!n) return -1;
  const dir = key === "ArrowUp" || key === "End" ? -1 : 1;
  let i = key === "Home" ? -1 : key === "End" ? n : from;
  for (let k = 0; k < n; k++) {
    i = (i + dir + n) % n;
    if (!opts[i].disabled) return i;
  }
  return -1;
}

const matches = (o: ChoiceOption, q: string) => !q || o.label.toLowerCase().includes(q.toLowerCase()) || (o.description?.toLowerCase().includes(q.toLowerCase()) ?? false);

/* ------------------------------------------------------------------ */
/* Combobox (pick one, type to filter)                                 */
/* ------------------------------------------------------------------ */

export interface ComboboxProps {
  options: ChoiceOption[];
  value: string | null;
  onValueChange: (value: string | null) => void;
  placeholder?: string;
  emptyText?: string;
  id?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
}

/** Type-to-filter single select (ARIA combobox + listbox). The value must be one of the options. */
export function Combobox({ options, value, onValueChange, placeholder = "Type to search", emptyText = "No matches", id, disabled, size = "md", "aria-label": ariaLabel, "aria-describedby": describedBy }: ComboboxProps) {
  const wiring = useFieldControl({ id, "aria-describedby": describedBy });
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(-1);
  const selected = options.find((o) => o.value === value) ?? null;
  const q = query ?? "";
  const shown = useMemo(() => options.filter((o) => matches(o, q)), [options, q]);
  const optId = (i: number) => `${listId}-o${i}`;

  useEffect(() => {
    if (open && active >= 0) document.getElementById(`${listId}-o${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, listId]);

  const openList = (start = -1) => {
    setOpen(true);
    setActive(start >= 0 ? start : Math.max(0, shown.findIndex((o) => o.value === value)));
  };
  const pick = (o: ChoiceOption) => {
    if (o.disabled) return;
    onValueChange(o.value);
    setQuery(null);
    setOpen(false);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return openList();
      setActive((a) => nextIndex(shown, a, e.key));
    } else if ((e.key === "Home" || e.key === "End") && open) {
      e.preventDefault();
      setActive((a) => nextIndex(shown, a, e.key));
    } else if (e.key === "Enter" && open) {
      e.preventDefault();
      if (shown[active]) pick(shown[active]);
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
        setQuery(null);
      } else if (value) onValueChange(null);
    }
  };

  return (
    <div className="relative">
      <div className={cn(shellClasses, size === "sm" ? "h-[var(--h-sm)]" : size === "lg" ? "h-[var(--h-lg)]" : "h-[var(--h-md)]")}>
        {selected?.icon && query === null ? (
          <span aria-hidden="true" className="flex items-center pl-3 text-ink-3 [&_svg]:size-4">
            {selected.icon}
          </span>
        ) : null}
        <input
          ref={input}
          {...wiring}
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && shown[active] ? optId(active) : undefined}
          autoComplete="off"
          disabled={disabled}
          placeholder={placeholder}
          value={query ?? selected?.label ?? ""}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={(e) => e.target.select()}
          onClick={() => !open && openList()}
          onBlur={() => {
            setOpen(false);
            setQuery(null);
          }}
          onKeyDown={onKey}
          className={bareInputClasses}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={open ? "Hide options" : "Show options"}
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (open) setOpen(false);
            else openList();
            input.current?.focus();
          }}
          className="grid w-8 shrink-0 place-items-center text-ink-3 hover:text-ink"
        >
          <ChevronDown aria-hidden="true" className={cn("size-4 transition-transform", open && "rotate-180")} />
        </button>
      </div>
      <ul id={listId} role="listbox" aria-label={ariaLabel ?? "Options"} hidden={!open} className={cn(listClasses, "absolute inset-x-0 top-full z-50 mt-1")}>
        {shown.map((o, i) => (
          <li
            key={o.value}
            id={optId(i)}
            role="option"
            aria-selected={o.value === value}
            aria-disabled={o.disabled || undefined}
            data-active={i === active}
            onMouseDown={(e) => e.preventDefault()}
            onMouseMove={() => active !== i && setActive(i)}
            onClick={() => pick(o)}
            className={optionClasses}
          >
            <OptionBody o={o} query={q} />
            {o.value === value ? <Check aria-hidden="true" className="text-ink" /> : null}
          </li>
        ))}
        {shown.length === 0 ? <li className="px-2.5 py-2 text-ui text-ink-3">{emptyText}</li> : null}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Autocomplete (free text with suggestions)                           */
/* ------------------------------------------------------------------ */

export interface AutocompleteProps extends Omit<ComboboxProps, "options" | "value" | "onValueChange" | "emptyText"> {
  value: string;
  onValueChange: (value: string) => void;
  suggestions: (string | ChoiceOption)[];
  /** Called on Enter or when a suggestion is picked. */
  onCommit?: (value: string) => void;
  /** Most suggestions to show (default 6). */
  limit?: number;
  icon?: ReactNode;
}

/** Free-text input that suggests completions as you type. Any value is allowed. */
export function Autocomplete({ value, onValueChange, suggestions, onCommit, limit = 6, icon, placeholder, id, disabled, size = "md", "aria-label": ariaLabel, "aria-describedby": describedBy }: AutocompleteProps) {
  const wiring = useFieldControl({ id, "aria-describedby": describedBy });
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const opts = useMemo(() => suggestions.map((s) => (typeof s === "string" ? { value: s, label: s } : s)), [suggestions]);
  const shown = useMemo(() => (value ? opts.filter((o) => matches(o, value) && o.label.toLowerCase() !== value.toLowerCase()).slice(0, limit) : []), [opts, value, limit]);
  const visible = open && shown.length > 0;
  const optId = (i: number) => `${listId}-o${i}`;
  const pick = (o: ChoiceOption) => {
    onValueChange(o.label);
    onCommit?.(o.label);
    setOpen(false);
    setActive(-1);
  };
  return (
    <div className="relative">
      <div className={cn(shellClasses, size === "sm" ? "h-[var(--h-sm)]" : size === "lg" ? "h-[var(--h-lg)]" : "h-[var(--h-md)]")}>
        {icon ? (
          <span aria-hidden="true" className="flex items-center pl-3 -mr-1.5 text-ink-3 [&_svg]:size-4">
            {icon}
          </span>
        ) : null}
        <input
          {...wiring}
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={visible}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={visible && active >= 0 ? optId(active) : undefined}
          autoComplete="off"
          disabled={disabled}
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            onValueChange(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if ((e.key === "ArrowDown" || e.key === "ArrowUp") && shown.length) {
              e.preventDefault();
              setOpen(true);
              setActive((a) => nextIndex(shown, a, e.key));
            } else if (e.key === "Enter") {
              if (visible && shown[active]) {
                e.preventDefault();
                pick(shown[active]);
              } else {
                onCommit?.(value);
                setOpen(false);
              }
            } else if (e.key === "Escape" && visible) {
              e.preventDefault();
              setOpen(false);
            }
          }}
          className={bareInputClasses}
        />
      </div>
      <ul id={listId} role="listbox" aria-label="Suggestions" hidden={!visible} className={cn(listClasses, "absolute inset-x-0 top-full z-50 mt-1")}>
        {shown.map((o, i) => (
          <li
            key={o.value}
            id={optId(i)}
            role="option"
            aria-selected={i === active}
            data-active={i === active}
            onMouseDown={(e) => e.preventDefault()}
            onMouseMove={() => active !== i && setActive(i)}
            onClick={() => pick(o)}
            className={optionClasses}
          >
            <OptionBody o={o} query={value} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Multi-select                                                        */
/* ------------------------------------------------------------------ */

export interface MultiSelectProps {
  options: ChoiceOption[];
  value: string[];
  onValueChange: (value: string[]) => void;
  placeholder?: string;
  /** Noun for the summary, e.g. "channels" → "4 channels". */
  noun?: string;
  /** Show the search box (default when there are more than 7 options). */
  searchable?: boolean;
  id?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  disabled?: boolean;
}

/** Dropdown of checkable options with search, Select all and Clear. */
export function MultiSelect({ options, value, onValueChange, placeholder = "Choose…", noun = "selected", searchable, id, disabled, "aria-label": ariaLabel, "aria-describedby": describedBy }: MultiSelectProps) {
  const wiring = useFieldControl({ id, "aria-describedby": describedBy });
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const shown = useMemo(() => options.filter((o) => matches(o, query)), [options, query]);
  const search = searchable ?? options.length > 7;
  const chosen = options.filter((o) => value.includes(o.value));
  const optId = (i: number) => `${listId}-o${i}`;

  useEffect(() => {
    if (open) document.getElementById(`${listId}-o${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, listId]);

  const toggle = (o: ChoiceOption) => {
    if (o.disabled) return;
    onValueChange(value.includes(o.value) ? value.filter((v) => v !== o.value) : [...value, o.value]);
  };
  const onKey = (e: KeyboardEvent<HTMLElement>) => {
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
      e.preventDefault();
      setActive((a) => nextIndex(shown, a, e.key));
    } else if (e.key === "Enter" || (e.key === " " && !search)) {
      e.preventDefault();
      if (shown[active]) toggle(shown[active]);
    }
  };

  return (
    <RPopover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setQuery("");
          setActive(0);
        }
      }}
    >
      <RPopover.Trigger
        {...wiring}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        disabled={disabled}
        className={cn(controlClasses, "flex h-auto min-h-[var(--h-md)] items-center gap-2 py-1 text-left")}
      >
        <span className="flex min-w-0 flex-1 flex-wrap gap-1">
          {chosen.length === 0 ? <span className="text-ink-3">{placeholder}</span> : null}
          {chosen.slice(0, 2).map((o) => (
            <span key={o.value} className="inline-flex h-6 items-center rounded-[var(--radius-badge)] bg-surface-2 px-2 text-xs text-ink-2">
              {o.label}
            </span>
          ))}
          {chosen.length > 2 ? <span className="inline-flex h-6 items-center px-1 text-xs text-ink-3">+{chosen.length - 2} more</span> : null}
        </span>
        <span className="sr-only">{chosen.length ? `${chosen.length} ${noun}` : ""}</span>
        <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-ink-3" />
      </RPopover.Trigger>
      <RPopover.Portal>
        <RPopover.Content
          align="start"
          sideOffset={6}
          onOpenAutoFocus={(e) => {
            if (!search) {
              e.preventDefault();
              listRef.current?.focus();
            }
          }}
          className="z-50 w-[max(var(--radix-popover-trigger-width),16rem)] rounded-[var(--radius-card)] border border-line bg-surface p-1 shadow-lg outline-none"
        >
          {search ? (
            <div className="flex h-9 items-center gap-2 border-b border-line px-2.5">
              <Search aria-hidden="true" className="size-4 text-ink-3" />
              <input
                role="combobox"
                aria-label="Filter options"
                aria-expanded="true"
                aria-controls={listId}
                aria-activedescendant={shown[active] ? optId(active) : undefined}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onKey}
                placeholder="Search"
                className="h-full min-w-0 flex-1 bg-transparent text-ui placeholder:text-ink-3 focus-visible:outline-none!"
              />
            </div>
          ) : null}
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-multiselectable="true"
            aria-label={ariaLabel ?? "Options"}
            tabIndex={search ? -1 : 0}
            aria-activedescendant={!search && shown[active] ? optId(active) : undefined}
            onKeyDown={search ? undefined : onKey}
            className="mt-1 max-h-60 overflow-y-auto focus-visible:outline-none!"
          >
            {shown.map((o, i) => {
              const on = value.includes(o.value);
              return (
                <li
                  key={o.value}
                  id={optId(i)}
                  role="option"
                  aria-selected={on}
                  aria-disabled={o.disabled || undefined}
                  data-active={i === active}
                  onMouseMove={() => active !== i && setActive(i)}
                  onClick={() => toggle(o)}
                  className={optionClasses}
                >
                  <span aria-hidden="true" className={cn("grid size-4 shrink-0 place-items-center rounded-[3px] border-[1.5px]", on ? "border-ink bg-ink text-white" : "border-control bg-surface")}>
                    {on ? <Check className="size-3!" strokeWidth={3} /> : null}
                  </span>
                  <OptionBody o={o} query={query} />
                </li>
              );
            })}
            {shown.length === 0 ? <li className="px-2.5 py-2 text-ui text-ink-3">No matches</li> : null}
          </ul>
          <div className="mt-1 flex items-center justify-between border-t border-line px-1 pt-1">
            <button type="button" onClick={() => onValueChange(value.length === options.length ? [] : options.filter((o) => !o.disabled).map((o) => o.value))} className="h-7 rounded-[var(--radius-control)] px-2 text-xs font-medium text-ink-2 hover:bg-surface-2 hover:text-ink">
              {value.length === options.length ? "Clear all" : "Select all"}
            </button>
            <RPopover.Close className="h-7 rounded-[var(--radius-control)] bg-ink px-2.5 text-xs font-medium text-white hover:bg-black">Done</RPopover.Close>
          </div>
        </RPopover.Content>
      </RPopover.Portal>
    </RPopover.Root>
  );
}

/* ------------------------------------------------------------------ */
/* Radio group                                                         */
/* ------------------------------------------------------------------ */

export interface RadioGroupProps {
  /** Visible group label (rendered as the group's name). */
  label: ReactNode;
  options: ChoiceOption[];
  value: string;
  onValueChange: (value: string) => void;
  orientation?: "vertical" | "horizontal";
  /** `card` draws each option as a bordered tile. */
  appearance?: "default" | "card";
  name?: string;
  disabled?: boolean;
  className?: string;
}

/** One choice from a few visible options. Arrow keys move and select (Radix RadioGroup). */
export function RadioGroup({ label, options, value, onValueChange, orientation = "vertical", appearance = "default", name, disabled, className }: RadioGroupProps) {
  const labelId = useId();
  const card = appearance === "card";
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <p id={labelId} className="text-ui font-medium text-ink">
        {label}
      </p>
      <RRadio.Root
        aria-labelledby={labelId}
        value={value}
        onValueChange={onValueChange}
        orientation={orientation}
        name={name}
        disabled={disabled}
        className={cn("flex", orientation === "horizontal" ? "flex-wrap gap-x-5 gap-y-2" : "flex-col", card ? "gap-2" : orientation === "vertical" && "gap-1", card && orientation === "horizontal" && "grid sm:grid-cols-3")}
      >
        {options.map((o) => {
          const id = `${labelId}-${o.value}`;
          return (
            <label
              key={o.value}
              htmlFor={id}
              className={cn(
                "flex cursor-pointer items-start gap-2.5",
                card ? "rounded-[var(--radius-card)] border border-line bg-surface p-3 transition-colors hover:border-line-strong has-[[data-state=checked]]:border-ink has-[[data-state=checked]]:shadow-[0_0_0_1px_var(--ink)]" : "py-1.5",
                o.disabled && "cursor-not-allowed opacity-50",
              )}
            >
              <RRadio.Item
                id={id}
                value={o.value}
                disabled={o.disabled}
                aria-describedby={o.description ? `${id}-d` : undefined}
                className="mt-px grid size-4 shrink-0 place-items-center rounded-full border-[1.5px] border-control bg-surface transition-colors hover:border-ink focus-visible:rounded-full! data-[state=checked]:border-ink"
              >
                <RRadio.Indicator className="size-2 rounded-full bg-ink" />
              </RRadio.Item>
              <span className="flex min-w-0 flex-col">
                <span className="flex items-center gap-1.5 text-ui font-medium text-ink">
                  {o.icon ? (
                    <span aria-hidden="true" className="inline-flex text-ink-3 [&_svg]:size-4">
                      {o.icon}
                    </span>
                  ) : null}
                  {o.label}
                </span>
                {o.description ? (
                  <span id={`${id}-d`} className="mt-0.5 text-xs text-ink-3">
                    {o.description}
                  </span>
                ) : null}
              </span>
            </label>
          );
        })}
      </RRadio.Root>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tag input                                                           */
/* ------------------------------------------------------------------ */

export interface TagInputProps {
  value: string[];
  onValueChange: (tags: string[]) => void;
  placeholder?: string;
  /** Quick-add chips shown under the field. */
  suggestions?: string[];
  max?: number;
  /** Return an error message to reject a tag. */
  validate?: (tag: string) => string | null;
  id?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  disabled?: boolean;
}

/** Free-form tags. Enter or comma adds, Backspace on empty removes the last, paste splits on commas. */
export function TagInput({ value, onValueChange, placeholder = "Add a tag", suggestions = [], max, validate, id, disabled, "aria-label": ariaLabel, "aria-describedby": describedBy }: TagInputProps) {
  const errId = useId();
  const wiring = useFieldControl({ id, "aria-describedby": describedBy });
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const full = max !== undefined && value.length >= max;

  const add = (raw: string[]) => {
    const next = [...value];
    let err: string | null = null;
    for (const r of raw) {
      const t = r.trim();
      if (!t) continue;
      if (next.some((x) => x.toLowerCase() === t.toLowerCase())) {
        err = `"${t}" is already added`;
        continue;
      }
      if (max !== undefined && next.length >= max) {
        err = `Up to ${max} tags`;
        break;
      }
      const v = validate?.(t);
      if (v) {
        err = v;
        continue;
      }
      next.push(t);
    }
    setError(err);
    if (next.length !== value.length) {
      onValueChange(next);
      setAnnounce(`Added ${next.slice(value.length).join(", ")}`);
    }
    setDraft("");
  };
  const remove = (t: string) => {
    onValueChange(value.filter((x) => x !== t));
    setAnnounce(`Removed ${t}`);
    setError(null);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className={cn(shellClasses, "h-auto min-h-[var(--h-md)] flex-wrap items-center gap-1 p-1")} onClick={() => input.current?.focus()}>
        <ul className="contents" aria-label="Tags">
          {value.map((t) => (
            <li key={t} className="inline-flex h-6 items-center gap-0.5 rounded-[var(--radius-badge)] bg-surface-2 pl-2 pr-0.5 text-xs text-ink-2">
              {t}
              <button
                type="button"
                aria-label={`Remove ${t}`}
                disabled={disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  remove(t);
                  input.current?.focus();
                }}
                className="grid size-5 place-items-center rounded-[var(--radius-control)] text-ink-3 hover:bg-surface-3 hover:text-ink"
              >
                <X aria-hidden="true" className="size-3" />
              </button>
            </li>
          ))}
        </ul>
        <input
          ref={input}
          {...wiring}
          aria-label={ariaLabel}
          aria-describedby={cn(wiring["aria-describedby"], error && errId) || undefined}
          aria-invalid={error ? true : wiring["aria-invalid"]}
          disabled={disabled || full}
          value={draft}
          placeholder={full ? `Limit of ${max} reached` : value.length ? "" : placeholder}
          onChange={(e) => {
            const v = e.target.value;
            if (v.includes(",")) add(v.split(","));
            else {
              setDraft(v);
              setError(null);
            }
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            if (/[,\n]/.test(text)) {
              e.preventDefault();
              add(text.split(/[,\n]/));
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              e.preventDefault();
              add([draft]);
            } else if (e.key === "Backspace" && !draft && value.length) {
              remove(value[value.length - 1]);
            }
          }}
          onBlur={() => draft.trim() && add([draft])}
          className="h-6 min-w-24 flex-1 bg-transparent px-1.5 text-ui placeholder:text-ink-3 focus-visible:outline-none!"
        />
      </div>
      {error ? (
        <p id={errId} className="text-ui font-medium text-red-800">
          {error}
        </p>
      ) : null}
      {suggestions.filter((s) => !value.includes(s)).length && !full ? (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-xs text-ink-3">Suggested</span>
          {suggestions
            .filter((s) => !value.includes(s))
            .map((s) => (
              <button
                key={s}
                type="button"
                disabled={disabled}
                onClick={() => add([s])}
                className="inline-flex h-6 items-center gap-1 rounded-[var(--radius-badge)] border border-dashed border-line-strong px-1.5 text-xs text-ink-2 hover:border-ink/30 hover:text-ink"
              >
                <Plus aria-hidden="true" className="size-3" />
                {s}
              </button>
            ))}
        </div>
      ) : null}
      <span className="sr-only" aria-live="polite">
        {announce}
      </span>
    </div>
  );
}
