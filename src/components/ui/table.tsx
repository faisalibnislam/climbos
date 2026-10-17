import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Table primitives: the one table look in ClimbOS.
 *
 * - Frame: white panel, hairline border, 8px corners, scrolls sideways on
 *   small screens.
 * - Header: 36px, sage-tinted, 12px medium ink-3 labels (sentence case).
 * - Rows: 44px minimum, 13px text, hairline dividers, soft hover.
 * - Numbers align right with tabular figures (`numeric`).
 *
 * Use <DataTable> for simple sortable lists; compose these for anything custom.
 */
export function TableFrame({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("w-full overflow-x-auto rounded-xl border border-line bg-surface", className)} {...props} />;
}

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return <table className={cn("w-full border-collapse text-left text-ui text-ink", className)} {...props} />;
}

export function THead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("bg-surface-2 [&_tr]:border-b [&_tr]:border-line", className)} {...props} />;
}

export function TBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("[&_tr:last-child]:border-b-0", className)} {...props} />;
}

export function Tr({ className, interactive, ...props }: HTMLAttributes<HTMLTableRowElement> & { interactive?: boolean }) {
  return <tr className={cn("border-b border-line", interactive && "cursor-pointer transition-colors hover:bg-surface-2", className)} {...props} />;
}

export function Th({ className, numeric, ...props }: ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <th
      scope={props.scope ?? "col"}
      className={cn("h-9 whitespace-nowrap px-4 text-xs font-medium text-ink-3", numeric && "text-right", className)}
      {...props}
    />
  );
}

export function Td({ className, numeric, ...props }: TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return <td className={cn("h-11 px-4 py-2 align-middle", numeric && "text-right tabular-nums", className)} {...props} />;
}

/** A cell's primary line plus a muted second line (e.g. name + email). */
export function CellStack({ primary, secondary, className }: { primary: React.ReactNode; secondary?: React.ReactNode; className?: string }) {
  return (
    <span className={cn("flex min-w-0 flex-col", className)}>
      <span className="truncate font-medium text-ink">{primary}</span>
      {secondary ? <span className="truncate text-xs text-ink-3">{secondary}</span> : null}
    </span>
  );
}
