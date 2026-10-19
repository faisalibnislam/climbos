"use client";

import { ChevronLeft, ChevronRight } from "@/components/icons";
import { cn } from "@/lib/utils";

/** Page numbers with ellipses: 1 … 4 5 6 … 12. */
export function pageWindow(page: number, pages: number, siblings = 1): (number | "gap")[] {
  if (pages <= 5 + siblings * 2) return Array.from({ length: pages }, (_, i) => i + 1);
  const start = Math.max(2, page - siblings);
  const end = Math.min(pages - 1, page + siblings);
  const out: (number | "gap")[] = [1];
  if (start > 2) out.push("gap");
  for (let i = start; i <= end; i++) out.push(i);
  if (end < pages - 1) out.push("gap");
  out.push(pages);
  return out;
}

export interface PaginationProps {
  /** 1-based current page. */
  page: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  /** Offer a rows-per-page select. */
  pageSizes?: number[];
  onPageSizeChange?: (size: number) => void;
  /** "full": range text + numbers. "simple": prev / next with "Page x of y". */
  variant?: "full" | "simple";
  label?: string;
  className?: string;
}

const btn =
  "inline-flex h-[var(--h-sm)] min-w-[var(--h-sm)] items-center justify-center gap-1 rounded-[var(--radius-control)] px-2 text-ui font-medium tabular-nums text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink disabled:pointer-events-none disabled:opacity-40 outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]";

/** Page navigation for tables and lists. */
export function Pagination({ page, total, pageSize, onPageChange, pageSizes, onPageSizeChange, variant = "full", label = "Pagination", className }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav aria-label={label} className={cn("flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-ui text-ink-3", className)}>
      <div className="flex items-center gap-3">
        <span aria-live="polite" className="tabular-nums">
          {variant === "simple" ? `Page ${page} of ${pages}` : `${from}–${to} of ${total}`}
        </span>
        {pageSizes && onPageSizeChange ? (
          <label className="flex items-center gap-1.5">
            <span>Rows</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-[var(--h-sm)] rounded-[var(--radius-control)] border border-control bg-surface px-1.5 text-ui text-ink outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              {pageSizes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <ul className="flex items-center gap-0.5">
        <li>
          <button type="button" className={btn} disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page">
            <ChevronLeft aria-hidden="true" className="size-4" />
            {variant === "simple" ? <span className="pr-1">Previous</span> : null}
          </button>
        </li>
        {variant === "full"
          ? pageWindow(page, pages).map((p, i) =>
              p === "gap" ? (
                <li key={`g${i}`} aria-hidden="true" className="px-1 text-ink-3">
                  …
                </li>
              ) : (
                <li key={p}>
                  <button
                    type="button"
                    className={cn(btn, p === page && "bg-ink text-white hover:bg-ink hover:text-white")}
                    aria-current={p === page ? "page" : undefined}
                    aria-label={`Page ${p}`}
                    onClick={() => onPageChange(p)}
                  >
                    {p}
                  </button>
                </li>
              ),
            )
          : null}
        <li>
          <button type="button" className={btn} disabled={page >= pages} onClick={() => onPageChange(page + 1)} aria-label="Next page">
            {variant === "simple" ? <span className="pl-1">Next</span> : null}
            <ChevronRight aria-hidden="true" className="size-4" />
          </button>
        </li>
      </ul>
    </nav>
  );
}
