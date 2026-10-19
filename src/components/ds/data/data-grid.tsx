"use client";

/*
 * DataGrid: the one full-featured table in Signal. Every feature is opt-in:
 *   sortable · filterable (search + one facet) · pageSize (pagination)
 *   onCellEdit (inline edit on editable columns) · expandable (detail rows)
 *   selectable (row checkboxes + select all + bulk bar) · stickyHeader
 *   columnMenu (show / hide columns) · rowActions (… menu per row)
 * Rows are controlled by the caller; the grid only holds view state.
 */
import { Checkbox as RCheckbox } from "radix-ui";
import { Fragment, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Check, ChevronRight, Columns3, Minus, MoreHorizontal, Pencil, Search, X } from "@/components/icons";
import {
  Button,
  Checkbox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconButton,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { Pagination } from "./pagination";

export type CellValue = string | number;

export interface DataGridColumn<T> {
  key: string;
  header: string;
  /** Raw value: used to sort, search and edit. */
  value: (row: T) => CellValue;
  /** Custom cell rendering (defaults to the value). */
  cell?: (row: T) => ReactNode;
  sortable?: boolean;
  numeric?: boolean;
  /** Allow inline editing (needs onCellEdit on the grid). */
  editable?: boolean;
  /** Can be hidden from the column menu. Default true. */
  hideable?: boolean;
  defaultHidden?: boolean;
  className?: string;
}

export interface RowAction<T> {
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  onSelect: (row: T) => void;
  /** Draw a separator above this item. */
  separated?: boolean;
}

export interface DataGridProps<T> {
  /** Accessible table name (visually hidden caption). */
  label: string;
  rows: T[];
  columns: DataGridColumn<T>[];
  getRowId: (row: T) => string;
  sortable?: boolean;
  defaultSort?: { key: string; dir: "asc" | "desc" };
  filterable?: boolean;
  facet?: { label: string; value: (row: T) => string; options: string[] };
  pageSize?: number;
  pageSizes?: number[];
  selectable?: boolean;
  bulkActions?: (ids: string[], clear: () => void) => ReactNode;
  expandable?: (row: T) => ReactNode;
  stickyHeader?: boolean;
  /** Body height in px when stickyHeader is on. */
  maxHeight?: number;
  columnMenu?: boolean;
  rowActions?: RowAction<T>[];
  onCellEdit?: (rowId: string, key: string, value: CellValue) => void;
  /** Extra controls on the right of the toolbar. */
  toolbar?: ReactNode;
  emptyText?: string;
  className?: string;
}

type Sort = { key: string; dir: "asc" | "desc" } | null;

const ring = "outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]";

function compare(a: CellValue, b: CellValue) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

/** Small table checkbox (Radix) with indeterminate support. */
function CellCheckbox({ checked, onChange, label }: { checked: boolean | "indeterminate"; onChange: (v: boolean) => void; label: string }) {
  return (
    <RCheckbox.Root
      checked={checked}
      onCheckedChange={(v) => onChange(v === true)}
      aria-label={label}
      className={cn(
        "grid size-4 place-items-center rounded-[3px] border-[1.5px] border-control bg-surface text-white transition-colors hover:border-brand-700",
        "data-[state=checked]:border-ink data-[state=checked]:bg-ink data-[state=indeterminate]:border-ink data-[state=indeterminate]:bg-ink",
        ring,
        "focus-visible:ring-offset-1",
      )}
    >
      <RCheckbox.Indicator className="inline-flex">
        {checked === "indeterminate" ? <Minus aria-hidden="true" className="size-3" strokeWidth={3} /> : <Check aria-hidden="true" className="size-3" strokeWidth={3} />}
      </RCheckbox.Indicator>
    </RCheckbox.Root>
  );
}

function EditCell({
  value,
  numeric,
  label,
  display,
  editKey,
  onCommit,
}: {
  value: CellValue;
  numeric?: boolean;
  label: string;
  display: ReactNode;
  editKey: string;
  onCommit: (v: CellValue) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const finish = (save: boolean) => {
    if (draft === null) return;
    if (save && draft !== String(value)) {
      const n = Number(draft);
      onCommit(numeric ? (Number.isFinite(n) ? n : value) : draft.trim() || value);
    }
    setDraft(null);
    requestAnimationFrame(() => btn.current?.focus());
  };
  if (draft !== null) {
    return (
      <input
        autoFocus
        aria-label={label}
        type={numeric ? "number" : "text"}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={() => finish(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") finish(true);
          if (e.key === "Escape") {
            e.preventDefault();
            finish(false);
          }
        }}
        className={cn(
          "h-[calc(var(--cell-h)-12px)] w-full min-w-24 rounded-[var(--radius-field)] border border-brand-700 bg-surface px-2 text-ui text-ink outline-2 outline-brand-600",
          numeric && "text-right tabular-nums",
        )}
      />
    );
  }
  return (
    <button
      ref={btn}
      type="button"
      data-edit={editKey}
      onClick={() => setDraft(String(value))}
      aria-label={`${label}: ${value}. Edit`}
      className={cn(
        "group/edit -mx-2 flex w-[calc(100%+1rem)] items-center gap-1.5 rounded-[var(--radius-control)] px-2 py-1 text-left hover:bg-surface-2",
        numeric && "justify-end",
        ring,
      )}
    >
      <span className="min-w-0 truncate">{display}</span>
      <Pencil aria-hidden="true" className="size-3 shrink-0 text-ink-3 opacity-0 transition-opacity group-hover/edit:opacity-100 group-focus-visible/edit:opacity-100" />
    </button>
  );
}

export function DataGrid<T>({
  label,
  rows,
  columns,
  getRowId,
  sortable,
  defaultSort,
  filterable,
  facet,
  pageSize: initialPageSize,
  pageSizes,
  selectable,
  bulkActions,
  expandable,
  stickyHeader,
  maxHeight = 320,
  columnMenu,
  rowActions,
  onCellEdit,
  toolbar,
  emptyText = "No rows match.",
  className,
}: DataGridProps<T>) {
  const [sort, setSort] = useState<Sort>(defaultSort ?? null);
  const [query, setQuery] = useState("");
  const [facetValue, setFacetValue] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize ?? 0);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(columns.filter((c) => c.defaultHidden).map((c) => c.key)));
  const searchId = useId();
  const detailBase = useId();

  const visibleCols = columns.filter((c) => !hidden.has(c.key));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (facet && facetValue !== "all" && facet.value(r) !== facetValue) return false;
      if (!q) return true;
      return columns.some((c) => String(c.value(r)).toLowerCase().includes(q));
    });
  }, [rows, columns, query, facet, facetValue]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return filtered;
    const out = [...filtered].sort((a, b) => compare(col.value(a), col.value(b)));
    return sort.dir === "desc" ? out.reverse() : out;
  }, [filtered, sort, columns]);

  const paged = initialPageSize ? true : false;
  const pages = paged ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const current = Math.min(page, pages);
  const visibleRows = paged ? sorted.slice((current - 1) * pageSize, current * pageSize) : sorted;

  const pageIds = visibleRows.map(getRowId);
  const selectedOnPage = pageIds.filter((id) => selected.has(id)).length;
  const headState: boolean | "indeterminate" = selectedOnPage === 0 ? false : selectedOnPage === pageIds.length ? true : "indeterminate";

  const toggleSort = (key: string) =>
    setSort((s) => (!s || s.key !== key ? { key, dir: "asc" } : s.dir === "asc" ? { key, dir: "desc" } : null));

  const toggleIn = (set: Set<string>, id: string, on?: boolean) => {
    const next = new Set(set);
    const want = on ?? !next.has(id);
    if (want) next.add(id);
    else next.delete(id);
    return next;
  };

  const clear = () => setSelected(new Set());
  const colCount = visibleCols.length + (selectable ? 1 : 0) + (expandable ? 1 : 0) + (rowActions ? 1 : 0);
  const showToolbar = filterable || facet || columnMenu || toolbar;

  const onHeaderKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    // Let ← → move between sortable headers.
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const row = e.currentTarget.closest("tr");
    const btns = [...(row?.querySelectorAll<HTMLButtonElement>("[data-sort]") ?? [])];
    const i = btns.indexOf(e.currentTarget);
    const next = btns[i + (e.key === "ArrowRight" ? 1 : -1)];
    if (next) {
      e.preventDefault();
      next.focus();
    }
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {selectable && selected.size > 0 ? (
        <div role="region" aria-label="Bulk actions" className="flex min-h-10 flex-wrap items-center gap-2 rounded-[var(--radius-card)] bg-ink px-3 py-1 text-ui text-white">
          <span className="font-medium tabular-nums">{selected.size} selected</span>
          <span className="flex-1" />
          {bulkActions?.(Array.from(selected), clear)}
          <button type="button" onClick={clear} className={cn("inline-flex h-7 items-center gap-1 rounded-[var(--radius-control)] px-2 text-ui text-white hover:bg-white/10", ring)}>
            <X aria-hidden="true" className="size-3.5" /> Clear
          </button>
        </div>
      ) : showToolbar ? (
        <div className="flex min-h-10 flex-wrap items-center gap-2">
          {filterable ? (
            <div className="relative min-w-0 flex-1 sm:max-w-64">
              <label htmlFor={searchId} className="sr-only">
                Search {label}
              </label>
              <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
              <input
                id={searchId}
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search"
                className="h-[var(--h-sm)] w-full rounded-[var(--radius-field)] border border-control bg-surface pl-8 pr-2.5 text-ui text-ink placeholder:text-ink-3 hover:border-control-hover focus-visible:border-brand-700 focus-visible:outline-2 focus-visible:outline-brand-600"
              />
            </div>
          ) : null}
          {facet ? (
            <Select
              aria-label={facet.label}
              value={facetValue}
              onValueChange={(v) => {
                setFacetValue(v);
                setPage(1);
              }}
              className="h-[var(--h-sm)] w-40"
              options={[{ value: "all", label: `All ${facet.label.toLowerCase()}` }, ...facet.options.map((o) => ({ value: o, label: o }))]}
            />
          ) : null}
          <div className="ml-auto flex items-center gap-2">
            {toolbar}
            {columnMenu ? (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="secondary" size="sm">
                    <Columns3 /> Columns
                    {hidden.size ? <span className="tabular-nums text-ink-3">· {columns.length - hidden.size}</span> : null}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-56 p-2">
                  <p className="px-1 pb-1 text-overline">Show columns</p>
                  {columns.map((c) => (
                    <Checkbox
                      key={c.key}
                      label={c.header}
                      className="px-1"
                      checked={!hidden.has(c.key)}
                      disabled={c.hideable === false || (!hidden.has(c.key) && visibleCols.length === 1)}
                      onCheckedChange={(v) => setHidden((h) => toggleIn(h, c.key, v !== true))}
                    />
                  ))}
                  {hidden.size ? (
                    <Button variant="ghost" size="sm" className="mt-1 w-full" onClick={() => setHidden(new Set())}>
                      Show all
                    </Button>
                  ) : null}
                </PopoverContent>
              </Popover>
            ) : null}
          </div>
        </div>
      ) : selectable ? (
        <p className="flex min-h-10 items-center text-ui text-ink-3">Select rows to act on them.</p>
      ) : null}

      <div
        className={cn("relative w-full overflow-auto rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--card-shadow)]")}
        style={stickyHeader ? { maxHeight } : undefined}
        tabIndex={stickyHeader ? 0 : undefined}
        role={stickyHeader ? "region" : undefined}
        aria-label={stickyHeader ? `${label}, scrollable` : undefined}
      >
        <table className="w-full min-w-[640px] border-separate border-spacing-0 text-left text-ui text-ink">
          <caption className="sr-only">
            {label}
            {sort ? `, sorted by ${columns.find((c) => c.key === sort.key)?.header} ${sort.dir === "asc" ? "ascending" : "descending"}` : ""}
          </caption>
          <thead>
            <tr>
              {expandable ? <th scope="col" className={cn("h-9 w-10 border-b border-line bg-surface-2", stickyHeader && "sticky top-0 z-[1]")}><span className="sr-only">Details</span></th> : null}
              {selectable ? (
                <th scope="col" className={cn("h-9 w-10 border-b border-line bg-surface-2 pl-4", stickyHeader && "sticky top-0 z-[1]")}>
                  <CellCheckbox
                    checked={headState}
                    label={headState === true ? "Deselect all rows on this page" : "Select all rows on this page"}
                    onChange={(on) =>
                      setSelected((s) => {
                        const next = new Set(s);
                        pageIds.forEach((id) => (on ? next.add(id) : next.delete(id)));
                        return next;
                      })
                    }
                  />
                </th>
              ) : null}
              {visibleCols.map((c) => {
                const canSort = sortable && c.sortable !== false;
                const dir = sort?.key === c.key ? sort.dir : null;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : canSort ? "none" : undefined}
                    className={cn("h-9 whitespace-nowrap border-b border-line bg-surface-2 px-4 text-xs font-medium text-ink-3", c.numeric && "text-right", stickyHeader && "sticky top-0 z-[1]", c.className)}
                  >
                    {canSort ? (
                      <button
                        type="button"
                        data-sort
                        onClick={() => toggleSort(c.key)}
                        onKeyDown={onHeaderKey}
                        className={cn("-mx-1.5 inline-flex items-center gap-1 rounded-[var(--radius-control)] px-1.5 py-1 hover:bg-surface-3 hover:text-ink", dir && "text-ink", c.numeric && "flex-row-reverse", ring)}
                      >
                        {c.header}
                        {dir === "asc" ? <ArrowUp aria-hidden="true" className="size-3.5" /> : dir === "desc" ? <ArrowDown aria-hidden="true" className="size-3.5" /> : <ArrowUpDown aria-hidden="true" className="size-3.5 opacity-50" />}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
              {rowActions ? <th scope="col" className={cn("h-9 w-12 border-b border-line bg-surface-2", stickyHeader && "sticky top-0 z-[1]")}><span className="sr-only">Actions</span></th> : null}
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="h-24 text-center text-ui text-ink-3">
                  {emptyText}
                </td>
              </tr>
            ) : null}
            {visibleRows.map((r) => {
              const id = getRowId(r);
              const isSel = selected.has(id);
              const isOpen = expanded.has(id);
              const detailId = `${detailBase}-${id}`;
              const first = String(columns[0]?.value(r) ?? id);
              const cellBase = cn("h-[var(--cell-h)] border-b border-line px-4 py-1.5 align-middle whitespace-nowrap", isSel && "bg-brand-50");
              return (
                <Fragment key={id}>
                  <tr className="group/row hover:[&>td]:bg-surface-2/70">
                    {expandable ? (
                      <td className={cn(cellBase, "w-10 pl-2 pr-0")}>
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          aria-controls={detailId}
                          aria-label={`${isOpen ? "Hide" : "Show"} details for ${first}`}
                          onClick={() => setExpanded((s) => toggleIn(s, id))}
                          className={cn("grid size-7 place-items-center rounded-[var(--radius-control)] text-ink-3 hover:bg-surface-3 hover:text-ink", ring)}
                        >
                          <ChevronRight aria-hidden="true" className={cn("size-4 transition-transform motion-reduce:transition-none", isOpen && "rotate-90")} />
                        </button>
                      </td>
                    ) : null}
                    {selectable ? (
                      <td className={cn(cellBase, "w-10 pl-4 pr-0")}>
                        <CellCheckbox checked={isSel} label={`Select ${first}`} onChange={(on) => setSelected((s) => toggleIn(s, id, on))} />
                      </td>
                    ) : null}
                    {visibleCols.map((c) => {
                      const v = c.value(r);
                      const display = c.cell ? c.cell(r) : v;
                      return (
                        <td key={c.key} className={cn(cellBase, c.numeric && "text-right tabular-nums", c.className)}>
                          {c.editable && onCellEdit ? (
                            <EditCell value={v} numeric={c.numeric} label={`${c.header} for ${first}`} display={display} editKey={`${id}:${c.key}`} onCommit={(nv) => onCellEdit(id, c.key, nv)} />
                          ) : (
                            display
                          )}
                        </td>
                      );
                    })}
                    {rowActions ? (
                      <td className={cn(cellBase, "w-12 pl-0 pr-2 text-right")}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <IconButton aria-label={`Actions for ${first}`} icon={<MoreHorizontal />} size="sm" tooltip={false} />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            {rowActions.map((a) => (
                              <Fragment key={a.label}>
                                {a.separated ? <DropdownMenuSeparator /> : null}
                                <DropdownMenuItem icon={a.icon} danger={a.danger} onSelect={() => a.onSelect(r)}>
                                  {a.label}
                                </DropdownMenuItem>
                              </Fragment>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    ) : null}
                  </tr>
                  {expandable && isOpen ? (
                    <tr id={detailId}>
                      <td colSpan={colCount} className="border-b border-line bg-surface-2/60 px-4 py-3 pl-12">
                        {expandable(r)}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {paged ? (
        <Pagination
          page={current}
          total={sorted.length}
          pageSize={pageSize}
          onPageChange={setPage}
          pageSizes={pageSizes}
          onPageSizeChange={(s) => {
            setPageSize(s);
            setPage(1);
          }}
          label={`${label} pages`}
        />
      ) : null}
    </div>
  );
}
