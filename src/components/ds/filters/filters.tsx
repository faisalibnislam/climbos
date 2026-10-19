"use client";

import { useId, useState, type ReactNode } from "react";
import { CalendarDays, Check, ChevronDown, Filter, Plus, Trash2, UserRound, X } from "@/components/icons";
import { Avatar, Button, DatePicker, FilterChip, Input, Popover, PopoverContent, PopoverTrigger, Select } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  DATE_PRESETS,
  OPERATORS,
  needsValue,
  rangeForPreset,
  shortDate,
  type Condition,
  type DatePreset,
  type DateRange,
  type FilterFieldDef,
  type FilterOption,
  type Match,
  type Operator,
} from "./model";

const triggerCls =
  "inline-flex h-[var(--h-sm)] items-center gap-1.5 rounded-[var(--radius-control)] border px-2.5 text-ui font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--focus-ring)] [&_svg]:size-4";
const triggerIdle = "border-[var(--btn-2-border)] bg-surface text-ink-2 shadow-[var(--btn-2-shadow)] hover:text-ink";
const triggerOn = "border-ink bg-surface text-ink";

/** Checkbox-like row used in filter lists (a real checkbox, styled). */
function CheckRow({ checked, onChange, children, count }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; count?: number }) {
  return (
    <label className="flex min-h-8 cursor-pointer items-center gap-2.5 rounded-[var(--radius-control)] px-2 text-ui text-ink hover:bg-surface-2 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--focus-ring)]">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span aria-hidden="true" className={cn("grid size-4 shrink-0 place-items-center rounded-[3px] border-[1.5px]", checked ? "border-ink bg-ink text-white" : "border-control bg-surface")}>
        {checked ? <Check className="size-3" strokeWidth={3} /> : null}
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-2 truncate">{children}</span>
      {count !== undefined ? <span className="text-xs tabular-nums text-ink-3">{count}</span> : null}
    </label>
  );
}

const toggle = (list: string[], v: string, on: boolean) => (on ? [...list, v] : list.filter((x) => x !== v));

/* ------------------------------------------------------------------ */
/* Filter dropdown                                                     */
/* ------------------------------------------------------------------ */

export interface FilterDropdownProps {
  label: string;
  options: (FilterOption & { icon?: ReactNode })[];
  selected: string[];
  onChange: (v: string[]) => void;
  /** Show a search box when there are many options. Default: > 6 options. */
  searchable?: boolean;
  icon?: ReactNode;
  className?: string;
}

/** Button that opens a multi-select list. Shows "Status: New" or "Status · 3" when set. */
export function FilterDropdown({ label, options, selected, onChange, searchable, icon, className }: FilterDropdownProps) {
  const [q, setQ] = useState("");
  const on = selected.length > 0;
  const shown = options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()));
  const first = options.find((o) => o.value === selected[0])?.label;
  return (
    <Popover onOpenChange={(o) => !o && setQ("")}>
      <PopoverTrigger className={cn(triggerCls, on ? triggerOn : triggerIdle, className)}>
        {icon ?? <Filter aria-hidden="true" />}
        <span>{label}</span>
        {on ? (
          <span className="text-ink">
            {selected.length === 1 ? <>: {first}</> : <span className="ml-0.5 rounded-[var(--radius-badge)] bg-ink px-1.5 text-2xs font-semibold leading-4 tabular-nums text-white">{selected.length}</span>}
          </span>
        ) : null}
        <ChevronDown aria-hidden="true" className="text-ink-3" />
      </PopoverTrigger>
      <PopoverContent className="w-64 p-1.5" aria-label={`${label} filter`}>
        {searchable ?? options.length > 6 ? (
          <Input size="sm" aria-label={`Search ${label.toLowerCase()}`} placeholder={`Search ${label.toLowerCase()}`} value={q} onChange={(e) => setQ(e.target.value)} className="mb-1.5" />
        ) : null}
        <div role="group" aria-label={label} className="flex max-h-64 flex-col overflow-y-auto">
          {shown.map((o) => (
            <CheckRow key={o.value} checked={selected.includes(o.value)} onChange={(v) => onChange(toggle(selected, o.value, v))} count={o.count}>
              {o.icon}
              {o.label}
            </CheckRow>
          ))}
          {!shown.length ? <p className="px-2 py-2 text-ui text-ink-3">No matches</p> : null}
        </div>
        <div className="mt-1.5 flex justify-between border-t border-line px-1 pt-1.5">
          <Button size="sm" variant="ghost" disabled={!on} onClick={() => onChange([])}>
            Clear
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onChange(options.map((o) => o.value))}>
            Select all
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------------------------------------------ */
/* Filter sidebar                                                      */
/* ------------------------------------------------------------------ */

export interface FacetGroup {
  key: string;
  label: string;
  options: (FilterOption & { icon?: ReactNode })[];
}

export interface FilterSidebarProps {
  groups: FacetGroup[];
  value: Record<string, string[]>;
  onChange: (v: Record<string, string[]>) => void;
  /** Extra controls at the end (date range, sliders). */
  children?: ReactNode;
  className?: string;
}

/** Facet panel with collapsible groups and live counts. */
export function FilterSidebar({ groups, value, onChange, children, className }: FilterSidebarProps) {
  const [closed, setClosed] = useState<string[]>([]);
  const total = Object.values(value).reduce((a, v) => a + v.length, 0);
  const uid = useId();
  return (
    <aside aria-label="Filters" className={cn("flex flex-col rounded-[var(--radius-card)] border border-line bg-surface", className)}>
      <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
        <p className="text-ui font-semibold text-ink">
          Filters{total ? <span className="ml-1.5 font-normal text-ink-3">({total})</span> : null}
        </p>
        <button type="button" disabled={!total} onClick={() => onChange({})} className="text-xs font-medium text-ink-3 hover:text-ink disabled:opacity-40">
          Clear all
        </button>
      </div>
      {groups.map((g) => {
        const open = !closed.includes(g.key);
        const sel = value[g.key] ?? [];
        return (
          <div key={g.key} className="border-b border-line px-1.5 py-1.5 last:border-b-0">
            <button
              type="button"
              aria-expanded={open}
              aria-controls={`${uid}-${g.key}`}
              onClick={() => setClosed((c) => (open ? [...c, g.key] : c.filter((k) => k !== g.key)))}
              className="flex h-8 w-full items-center justify-between rounded-[var(--radius-control)] px-2 text-overline hover:bg-surface-2"
            >
              <span>
                {g.label}
                {sel.length ? <span className="ml-1 text-ink">· {sel.length}</span> : null}
              </span>
              <ChevronDown aria-hidden="true" className={cn("size-4 text-ink-3 transition-transform", !open && "-rotate-90")} />
            </button>
            <div id={`${uid}-${g.key}`} role="group" aria-label={g.label} hidden={!open} className="flex flex-col">
              {g.options.map((o) => (
                <CheckRow key={o.value} checked={sel.includes(o.value)} count={o.count} onChange={(v) => onChange({ ...value, [g.key]: toggle(sel, o.value, v) })}>
                  {o.icon}
                  {o.label}
                </CheckRow>
              ))}
            </div>
          </div>
        );
      })}
      {children ? <div className="px-3 py-3">{children}</div> : null}
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Filter chips                                                        */
/* ------------------------------------------------------------------ */

export interface ActiveChip {
  id: string;
  /** Field name, e.g. "Status". */
  field: string;
  /** Value text, e.g. "New, Qualified". */
  value: string;
  onRemove: () => void;
}

/** Row of removable chips for every active filter, plus "Clear all". */
export function FilterChips({ chips, onClearAll, className }: { chips: ActiveChip[]; onClearAll?: () => void; className?: string }) {
  if (!chips.length) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {chips.map((c) => (
        <span key={c.id} className="inline-flex h-7 items-center gap-1 rounded-[var(--radius-badge)] border border-line-strong bg-surface pl-2 text-xs text-ink-2">
          <span className="text-ink-3">{c.field}:</span>
          <span className="max-w-48 truncate font-medium text-ink">{c.value}</span>
          <button type="button" onClick={c.onRemove} aria-label={`Remove ${c.field} filter`} className="grid h-full w-6 place-items-center rounded-r-[var(--radius-badge)] text-ink-3 hover:bg-surface-2 hover:text-ink">
            <X aria-hidden="true" className="size-3" />
          </button>
        </span>
      ))}
      {onClearAll ? (
        <button type="button" onClick={onClearAll} className="h-7 px-1.5 text-xs font-medium text-ink-3 underline-offset-2 hover:text-ink hover:underline">
          Clear all
        </button>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Multi-filter builder                                                */
/* ------------------------------------------------------------------ */

export interface FilterBuilderProps {
  fields: FilterFieldDef[];
  conditions: Condition[];
  onChange: (c: Condition[]) => void;
  match: Match;
  onMatchChange: (m: Match) => void;
  /** Creates ids for new rows (keep deterministic in tests). */
  newId?: () => string;
  className?: string;
}

let rowSeq = 0;

/** Rows of field / operator / value with AND / OR, add and remove. */
export function FilterBuilder({ fields, conditions, onChange, match, onMatchChange, newId, className }: FilterBuilderProps) {
  const make = (): Condition => {
    const f = fields[0];
    return { id: newId ? newId() : `c${++rowSeq}`, field: f.key, op: OPERATORS[f.type][0].value, value: "" };
  };
  const update = (id: string, patch: Partial<Condition>) => onChange(conditions.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {conditions.map((c, i) => {
        const f = fields.find((x) => x.key === c.field) ?? fields[0];
        const ops = OPERATORS[f.type];
        return (
          <div key={c.id} role="group" aria-label={`Condition ${i + 1}`} className="grid grid-cols-[72px_1fr_auto] items-center gap-2 sm:grid-cols-[72px_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1.2fr)_auto]">
            <div className="text-ui text-ink-3">
              {i === 0 ? (
                <span className="pl-1">Where</span>
              ) : i === 1 ? (
                <Select aria-label="Match" className="h-[var(--h-sm)]" value={match} onValueChange={(v) => onMatchChange(v as Match)} options={[{ value: "and", label: "and" }, { value: "or", label: "or" }]} />
              ) : (
                <span className="pl-1">{match}</span>
              )}
            </div>
            <Select
              aria-label="Field"
              className="h-[var(--h-sm)]"
              value={c.field}
              onValueChange={(key) => {
                const nf = fields.find((x) => x.key === key) ?? fields[0];
                update(c.id, { field: key, op: OPERATORS[nf.type][0].value, value: "" });
              }}
              options={fields.map((x) => ({ value: x.key, label: x.label }))}
            />
            <button type="button" onClick={() => onChange(conditions.filter((x) => x.id !== c.id))} aria-label={`Remove condition ${i + 1}`} className="grid size-8 place-items-center rounded-[var(--radius-control)] text-ink-3 hover:bg-surface-2 hover:text-red-800 sm:order-last">
              <Trash2 aria-hidden="true" className="size-4" />
            </button>
            <div className="col-span-2 col-start-2 grid grid-cols-2 gap-2 sm:col-span-2 sm:col-start-auto sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)] sm:contents">
              <Select aria-label="Operator" className="h-[var(--h-sm)]" value={c.op} onValueChange={(op) => update(c.id, { op: op as Operator })} options={ops} />
              {!needsValue(c.op) ? (
                <span aria-hidden="true" />
              ) : f.type === "select" ? (
                <Select aria-label="Value" className="h-[var(--h-sm)]" placeholder="Pick…" value={c.value || undefined} onValueChange={(v) => update(c.id, { value: v })} options={f.options ?? []} />
              ) : f.type === "date" ? (
                <DatePicker aria-label="Value" className="h-[var(--h-sm)]" value={c.value} onChange={(v) => update(c.id, { value: v })} />
              ) : (
                <Input aria-label="Value" size="sm" type={f.type === "number" ? "number" : "text"} value={c.value} onChange={(e) => update(c.id, { value: e.target.value })} placeholder={f.type === "number" ? "0" : "Type…"} />
              )}
            </div>
          </div>
        );
      })}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={() => onChange([...conditions, make()])}>
          <Plus aria-hidden="true" /> Add condition
        </Button>
        {conditions.length ? (
          <Button size="sm" variant="ghost" onClick={() => onChange([])}>
            Remove all
          </Button>
        ) : (
          <span className="text-xs text-ink-3">No conditions: showing everything.</span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Date range filter                                                   */
/* ------------------------------------------------------------------ */

export interface DateRangeFilterProps {
  value: DateRange;
  onChange: (v: DateRange) => void;
  /** "YYYY-MM-DD" used for presets (pass the real today in product code). */
  today: string;
  label?: string;
  className?: string;
}

export function rangeLabel(r: DateRange): string {
  if (r.preset !== "custom") return DATE_PRESETS.find((p) => p.value === r.preset)?.label ?? "Any time";
  if (r.from && r.to) return `${shortDate(r.from)} – ${shortDate(r.to)}`;
  if (r.from) return `From ${shortDate(r.from)}`;
  if (r.to) return `Until ${shortDate(r.to)}`;
  return "Custom";
}

/** Presets plus a custom from / to. Trigger shows the chosen range. */
export function DateRangeFilter({ value, onChange, today, label = "Created", className }: DateRangeFilterProps) {
  const on = value.preset !== "any";
  const pick = (p: DatePreset) => onChange(p === "custom" ? { preset: "custom", from: value.from, to: value.to } : { preset: p, ...rangeForPreset(p, today) });
  return (
    <Popover>
      <PopoverTrigger className={cn(triggerCls, on ? triggerOn : triggerIdle, className)}>
        <CalendarDays aria-hidden="true" />
        <span>{label}</span>
        {on ? <span className="text-ink">: {rangeLabel(value)}</span> : null}
        <ChevronDown aria-hidden="true" className="text-ink-3" />
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" aria-label={`${label} date range`}>
        <div role="radiogroup" aria-label="Range" className="grid grid-cols-2 gap-1">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              role="radio"
              aria-checked={value.preset === p.value}
              onClick={() => pick(p.value)}
              className={cn("flex h-8 items-center justify-between rounded-[var(--radius-control)] px-2 text-left text-ui", value.preset === p.value ? "bg-ink font-medium text-white" : "text-ink-2 hover:bg-surface-2 hover:text-ink")}
            >
              {p.label}
              {value.preset === p.value ? <Check aria-hidden="true" className="size-3.5" /> : null}
            </button>
          ))}
        </div>
        {value.preset === "custom" ? (
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-ink-3">From</span>
              <DatePicker aria-label="From" value={value.from} max={value.to || today} onChange={(from) => onChange({ ...value, from })} placeholder="Start" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-ink-3">To</span>
              <DatePicker aria-label="To" value={value.to} min={value.from || undefined} max={today} onChange={(to) => onChange({ ...value, to })} placeholder="End" />
            </div>
          </div>
        ) : value.from ? (
          <p className="mt-3 border-t border-line pt-3 text-xs text-ink-3">
            {shortDate(value.from)} – {shortDate(value.to)}
          </p>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------------------------------------------ */
/* Status filter                                                       */
/* ------------------------------------------------------------------ */

export interface StatusFilterProps {
  options: (FilterOption & { dot?: string })[];
  selected: string[];
  onChange: (v: string[]) => void;
  /** Total for the "All" chip. */
  total?: number;
  className?: string;
}

/** Chip row: "All" plus one toggle per status, each with a count. */
export function StatusFilter({ options, selected, onChange, total, className }: StatusFilterProps) {
  return (
    <div role="group" aria-label="Status" className={cn("flex flex-wrap gap-1.5", className)}>
      <FilterChip pressed={!selected.length} onPressedChange={() => onChange([])} count={total}>
        All
      </FilterChip>
      {options.map((o) => (
        <FilterChip key={o.value} pressed={selected.includes(o.value)} onPressedChange={(v) => onChange(toggle(selected, o.value, v))} count={o.count}>
          {o.dot ? <span aria-hidden="true" className={cn("size-2 rounded-full", o.dot)} /> : null}
          {o.label}
        </FilterChip>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Assignee filter                                                     */
/* ------------------------------------------------------------------ */

export interface AssigneeOption {
  value: string;
  name: string;
  count?: number;
  /** Marks the signed-in person (shown as "Me"). */
  me?: boolean;
}

export const UNASSIGNED = "__none";

/** Avatar stack trigger + searchable people list, with "Me" and "Unassigned". */
export function AssigneeFilter({ people, selected, onChange, unassignedCount, className }: { people: AssigneeOption[]; selected: string[]; onChange: (v: string[]) => void; unassignedCount?: number; className?: string }) {
  const [q, setQ] = useState("");
  const chosen = people.filter((p) => selected.includes(p.value));
  const me = people.find((p) => p.me);
  const shown = people.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <Popover onOpenChange={(o) => !o && setQ("")}>
      <PopoverTrigger className={cn(triggerCls, selected.length ? triggerOn : triggerIdle, className)}>
        {chosen.length ? (
          <span aria-hidden="true" className="flex -space-x-1.5">
            {chosen.slice(0, 3).map((p) => (
              <Avatar key={p.value} name={p.name} size="sm" className="size-5 ring-2 ring-surface" />
            ))}
          </span>
        ) : (
          <UserRound aria-hidden="true" />
        )}
        <span>Assignee</span>
        {selected.length ? (
          <span className="text-ink">
            : {selected.length === 1 ? (selected[0] === UNASSIGNED ? "Unassigned" : chosen[0]?.me ? "Me" : chosen[0]?.name.split(" ")[0]) : `${selected.length} people`}
          </span>
        ) : null}
        <ChevronDown aria-hidden="true" className="text-ink-3" />
      </PopoverTrigger>
      <PopoverContent className="w-64 p-1.5" aria-label="Assignee filter">
        <Input size="sm" aria-label="Search people" placeholder="Search people" value={q} onChange={(e) => setQ(e.target.value)} className="mb-1.5" />
        <div role="group" aria-label="Assignee" className="flex max-h-64 flex-col overflow-y-auto">
          {me && !q ? (
            <CheckRow checked={selected.includes(me.value)} onChange={(v) => onChange(toggle(selected, me.value, v))} count={me.count}>
              <Avatar name={me.name} size="sm" className="size-5" /> Me
            </CheckRow>
          ) : null}
          <CheckRow checked={selected.includes(UNASSIGNED)} onChange={(v) => onChange(toggle(selected, UNASSIGNED, v))} count={unassignedCount}>
            <span aria-hidden="true" className="grid size-5 place-items-center rounded-full border border-dashed border-line-strong text-ink-3">
              <UserRound className="size-3" />
            </span>
            Unassigned
          </CheckRow>
          <div className="my-1 h-px bg-line" />
          {shown
            .filter((p) => !p.me || q)
            .map((p) => (
              <CheckRow key={p.value} checked={selected.includes(p.value)} onChange={(v) => onChange(toggle(selected, p.value, v))} count={p.count}>
                <Avatar name={p.name} size="sm" className="size-5" />
                {p.name}
              </CheckRow>
            ))}
        </div>
        {selected.length ? (
          <div className="mt-1.5 border-t border-line px-1 pt-1.5">
            <Button size="sm" variant="ghost" onClick={() => onChange([])}>
              Clear
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
