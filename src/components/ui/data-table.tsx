"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Table, TableFrame, TBody, Td, Th, THead, Tr } from "./table";

export interface DataTableColumn<T> {
  key: string;
  header: ReactNode;
  /** Cell renderer. Defaults to String(row[key]). */
  cell?: (row: T) => ReactNode;
  /** Value used for sorting; providing it makes the column sortable. */
  sortValue?: (row: T) => string | number;
  align?: "left" | "right";
  /** Render this column's cells as row headers (<th scope="row">). */
  rowHeader?: boolean;
}

export interface DataTableProps<T> {
  /** Required: describes the table for screen readers (can be visually hidden). */
  caption: ReactNode;
  hideCaption?: boolean;
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  /** Shown in a single cell when rows is empty. */
  emptyText?: ReactNode;
  className?: string;
}

type SortState = { key: string; dir: "asc" | "desc" } | null;

/**
 * Sortable list table built on the Table primitives, with caption, column headers and optional sorting
 * (sortable headers are buttons and expose aria-sort). Scrolls horizontally
 * inside its own container on small screens.
 */
export function DataTable<T>({ caption, hideCaption, columns, rows, rowKey, emptyText = "Nothing to show yet.", className }: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState>(null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const get = col.sortValue;
    return [...rows].sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [rows, columns, sort]);

  return (
    <TableFrame className={className}>
      <Table>
        <caption className={cn("px-4 pb-1 pt-3 text-left heading-card", hideCaption && "sr-only")}>{caption}</caption>
        <THead>
          <tr>
            {columns.map((c) => {
              const active = sort?.key === c.key;
              const ariaSort = active ? (sort!.dir === "asc" ? "ascending" : "descending") : c.sortValue ? "none" : undefined;
              return (
                <Th key={c.key} aria-sort={ariaSort} numeric={c.align === "right"}>
                  {c.sortValue ? (
                    <button
                      type="button"
                      className={cn("inline-flex h-7 items-center gap-1 rounded-md hover:text-ink", c.align === "right" && "flex-row-reverse")}
                      onClick={() =>
                        setSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === "asc" ? "desc" : "asc" } : { key: c.key, dir: "asc" }))
                      }
                    >
                      {c.header}
                      {active ? (
                        sort!.dir === "asc" ? (
                          <ArrowUp aria-hidden="true" className="size-3.5" />
                        ) : (
                          <ArrowDown aria-hidden="true" className="size-3.5" />
                        )
                      ) : (
                        <ArrowUpDown aria-hidden="true" className="size-3.5 opacity-60" />
                      )}
                    </button>
                  ) : (
                    c.header
                  )}
                </Th>
              );
            })}
          </tr>
        </THead>
        <TBody>
          {sorted.length === 0 ? (
            <tr>
              <Td colSpan={columns.length} className="h-20 text-center text-ink-3">
                {emptyText}
              </Td>
            </tr>
          ) : (
            sorted.map((row, i) => (
              <Tr key={rowKey(row, i)}>
                {columns.map((c) => {
                  const content = c.cell ? c.cell(row) : String((row as Record<string, unknown>)[c.key] ?? "");
                  return c.rowHeader ? (
                    <th key={c.key} scope="row" className={cn("h-11 px-4 py-2 text-left align-middle font-medium", c.align === "right" && "text-right tabular-nums")}>
                      {content}
                    </th>
                  ) : (
                    <Td key={c.key} numeric={c.align === "right"}>
                      {content}
                    </Td>
                  );
                })}
              </Tr>
            ))
          )}
        </TBody>
      </Table>
    </TableFrame>
  );
}
