"use client";

/*
 * Drag and drop with a keyboard path for everything:
 * - DragBoard: move cards between columns (HTML5 drag, or Space to pick up, arrows to move, Space to drop, Esc to cancel).
 * - ReorderableList: reorder rows by handle (drag, or focus the handle and use ↑ ↓).
 * Moves are announced through a polite live region.
 */
import { useId, useState, type DragEvent, type KeyboardEvent, type ReactNode } from "react";
import { ArrowDown, ArrowUp, GripVertical } from "@/components/icons";
import { cn } from "@/lib/utils";

export interface DndItem {
  id: string;
}

export interface BoardColumn<T extends DndItem> {
  id: string;
  title: string;
  items: T[];
}

function focusLater(selector: string) {
  requestAnimationFrame(() => document.querySelector<HTMLElement>(selector)?.focus());
}

/** Polite screen-reader announcement area. */
export function LiveRegion({ message }: { message: string }) {
  return (
    <p aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </p>
  );
}

function moveItem<T extends DndItem>(cols: BoardColumn<T>[], id: string, toCol: string, toIndex: number): BoardColumn<T>[] {
  const from = cols.find((c) => c.items.some((i) => i.id === id));
  if (!from) return cols;
  const item = from.items.find((i) => i.id === id)!;
  const fromIndex = from.items.indexOf(item);
  return cols.map((c) => {
    let items = c.items;
    if (c.id === from.id) items = items.filter((i) => i.id !== id);
    if (c.id === toCol) {
      const idx = c.id === from.id && toIndex > fromIndex ? toIndex - 1 : toIndex;
      items = [...items.slice(0, idx), item, ...items.slice(idx)];
    }
    return { ...c, items };
  });
}

/** Kanban-style board. Controlled: you own `columns`. */
export function DragBoard<T extends DndItem>({
  columns,
  onChange,
  renderCard,
  label,
  itemName = (i) => i.id,
}: {
  columns: BoardColumn<T>[];
  onChange: (next: BoardColumn<T>[]) => void;
  renderCard: (item: T) => ReactNode;
  label: string;
  itemName?: (item: T) => string;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<{ col: string; index: number } | null>(null);
  const [grab, setGrab] = useState<{ id: string; snapshot: BoardColumn<T>[] } | null>(null);
  const [msg, setMsg] = useState("");
  const helpId = useId();

  const locate = (cols: BoardColumn<T>[], id: string) => {
    const ci = cols.findIndex((c) => c.items.some((i) => i.id === id));
    return { ci, ii: ci < 0 ? -1 : cols[ci].items.findIndex((i) => i.id === id) };
  };
  const nameOf = (id: string) => {
    const it = columns.flatMap((c) => c.items).find((i) => i.id === id);
    return it ? itemName(it) : id;
  };

  const drop = (col: string, index: number) => {
    if (!dragId) return;
    const next = moveItem(columns, dragId, col, index);
    onChange(next);
    setMsg(`${nameOf(dragId)} moved to ${next.find((c) => c.id === col)?.title}.`);
    setDragId(null);
    setOver(null);
  };

  const onCardKey = (e: KeyboardEvent, id: string) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (grab?.id === id) {
        setGrab(null);
        const { ci, ii } = locate(columns, id);
        setMsg(`${nameOf(id)} dropped in ${columns[ci].title}, position ${ii + 1}.`);
      } else {
        setGrab({ id, snapshot: columns });
        setMsg(`${nameOf(id)} picked up. Arrow keys move it, Space drops, Escape cancels.`);
      }
      return;
    }
    if (!grab || grab.id !== id) return;
    if (e.key === "Escape") {
      e.preventDefault();
      onChange(grab.snapshot);
      setGrab(null);
      setMsg("Move cancelled.");
      focusLater(`[data-card-id="${id}"]`);
      return;
    }
    const { ci, ii } = locate(columns, id);
    let next: BoardColumn<T>[] | null = null;
    if (e.key === "ArrowRight" && ci < columns.length - 1) next = moveItem(columns, id, columns[ci + 1].id, Math.min(ii, columns[ci + 1].items.length));
    if (e.key === "ArrowLeft" && ci > 0) next = moveItem(columns, id, columns[ci - 1].id, Math.min(ii, columns[ci - 1].items.length));
    if (e.key === "ArrowDown" && ii < columns[ci].items.length - 1) next = moveItem(columns, id, columns[ci].id, ii + 2);
    if (e.key === "ArrowUp" && ii > 0) next = moveItem(columns, id, columns[ci].id, ii - 1);
    if (next) {
      e.preventDefault();
      onChange(next);
      const l = locate(next, id);
      setMsg(`${next[l.ci].title}, position ${l.ii + 1} of ${next[l.ci].items.length}.`);
      focusLater(`[data-card-id="${id}"]`);
    }
  };

  return (
    <div role="group" aria-label={label} className="relative grid gap-3 overflow-x-auto sm:grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
      <LiveRegion message={msg} />
      {columns.map((col) => {
        const isOver = over?.col === col.id;
        return (
          <section
            key={col.id}
            aria-label={`${col.title}, ${col.items.length} items`}
            onDragOver={(e) => {
              if (!dragId) return;
              e.preventDefault();
              if (!col.items.length || (e.target as HTMLElement) === e.currentTarget) setOver({ col: col.id, index: col.items.length });
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver((o) => (o?.col === col.id ? null : o));
            }}
            onDrop={(e) => {
              e.preventDefault();
              drop(col.id, over?.col === col.id ? over.index : col.items.length);
            }}
            className={cn("flex min-h-48 flex-col gap-2 rounded-[var(--radius-card)] bg-surface-2 p-2 transition-colors", isOver && "bg-brand-50 ring-2 ring-inset ring-brand-600/50")}
          >
            <p className="flex items-center justify-between px-1.5 pt-1 text-ui font-medium text-ink">
              {col.title}
              <span className="text-xs tabular-nums text-ink-3">{col.items.length}</span>
            </p>
            <ul className="flex flex-1 flex-col gap-2">
              {col.items.map((it, i) => {
                const grabbed = grab?.id === it.id;
                return (
                  <li key={it.id} className="relative">
                    {isOver && over.index === i ? <span aria-hidden className="absolute -top-1.5 inset-x-1 h-0.5 rounded-full bg-brand-700" /> : null}
                    <div
                      data-card-id={it.id}
                      tabIndex={0}
                      draggable
                      role="button"
                      aria-roledescription="draggable card"
                      aria-pressed={grabbed}
                      aria-describedby={helpId}
                      onKeyDown={(e) => onCardKey(e, it.id)}
                      onDragStart={(e: DragEvent) => {
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", it.id);
                        setDragId(it.id);
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setOver(null);
                      }}
                      onDragOver={(e) => {
                        if (!dragId) return;
                        e.preventDefault();
                        const r = e.currentTarget.getBoundingClientRect();
                        setOver({ col: col.id, index: e.clientY < r.top + r.height / 2 ? i : i + 1 });
                      }}
                      className={cn(
                        "cursor-grab rounded-[var(--radius-card)] border border-line bg-surface p-3 shadow-[var(--card-shadow)] outline-none transition-[box-shadow,opacity,transform] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] active:cursor-grabbing",
                        dragId === it.id && "opacity-40",
                        grabbed && "-rotate-1 shadow-lg ring-2 ring-ink",
                      )}
                    >
                      {renderCard(it)}
                    </div>
                  </li>
                );
              })}
              {isOver && over.index === col.items.length && col.items.length ? <li aria-hidden className="mx-1 h-0.5 rounded-full bg-brand-700" /> : null}
              {!col.items.length ? <li className="grid flex-1 place-items-center rounded-[var(--radius-card)] border border-dashed border-line-strong p-4 text-center text-xs text-ink-3">Drop here</li> : null}
            </ul>
          </section>
        );
      })}
      <p id={helpId} className="sr-only">
        Press Space to pick up. Use arrow keys to move between columns and positions. Space drops, Escape cancels.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Reorderable list                                                    */
/* ------------------------------------------------------------------ */

/** Vertical list reordered by its handle. Drag, or focus the handle and press ↑ ↓. */
export function ReorderableList<T extends DndItem>({
  items,
  onChange,
  renderItem,
  label,
  itemName = (i) => i.id,
}: {
  items: T[];
  onChange: (next: T[]) => void;
  renderItem: (item: T, index: number) => ReactNode;
  label: string;
  itemName?: (item: T) => string;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  const move = (from: number, to: number, refocus: boolean) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    onChange(next);
    setMsg(`${itemName(it)} moved to position ${to + 1} of ${items.length}.`);
    if (refocus) focusLater(`[data-handle-id="${it.id}"]`);
  };
  return (
    <>
      <LiveRegion message={msg} />
      <ol aria-label={label} className="flex flex-col gap-1.5">
        {items.map((it, i) => (
          <li
            key={it.id}
            onDragOver={(e) => {
              if (!dragId) return;
              e.preventDefault();
              const r = e.currentTarget.getBoundingClientRect();
              setOverIndex(e.clientY < r.top + r.height / 2 ? i : i + 1);
            }}
            onDrop={(e) => {
              e.preventDefault();
              const from = items.findIndex((x) => x.id === dragId);
              if (from >= 0 && overIndex !== null) move(from, overIndex > from ? overIndex - 1 : overIndex, false);
              setDragId(null);
              setOverIndex(null);
            }}
            className={cn(
              "group/row relative flex items-center gap-2 rounded-[var(--radius-card)] border border-line bg-surface py-2 pl-1.5 pr-3 shadow-[var(--card-shadow)] transition-opacity",
              dragId === it.id && "opacity-40",
            )}
          >
            {overIndex === i ? <span aria-hidden className="absolute -top-1 inset-x-2 h-0.5 rounded-full bg-brand-700" /> : null}
            {overIndex === items.length && i === items.length - 1 ? <span aria-hidden className="absolute -bottom-1 inset-x-2 h-0.5 rounded-full bg-brand-700" /> : null}
            <button
              type="button"
              data-handle-id={it.id}
              draggable
              aria-label={`Reorder ${itemName(it)}, position ${i + 1} of ${items.length}. Use arrow keys.`}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", it.id);
                const row = e.currentTarget.closest("li");
                if (row) e.dataTransfer.setDragImage(row, 16, 16);
                setDragId(it.id);
              }}
              onDragEnd={() => {
                setDragId(null);
                setOverIndex(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  move(i, i - 1, true);
                } else if (e.key === "ArrowDown") {
                  e.preventDefault();
                  move(i, i + 1, true);
                }
              }}
              className="grid h-8 w-6 cursor-grab place-items-center rounded-[var(--radius-control)] text-ink-3 outline-none hover:bg-surface-2 hover:text-ink focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] active:cursor-grabbing"
            >
              <GripVertical aria-hidden className="size-4" />
            </button>
            <span className="w-5 text-right text-xs tabular-nums text-ink-3">{i + 1}</span>
            <div className="min-w-0 flex-1">{renderItem(it, i)}</div>
            <span className="flex gap-0.5 opacity-0 transition-opacity group-focus-within/row:opacity-100 group-hover/row:opacity-100">
              <button type="button" aria-label={`Move ${itemName(it)} up`} disabled={i === 0} onClick={() => move(i, i - 1, false)} className="grid size-7 place-items-center rounded-[var(--radius-control)] text-ink-3 outline-none hover:bg-surface-2 hover:text-ink focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-30">
                <ArrowUp aria-hidden className="size-3.5" />
              </button>
              <button type="button" aria-label={`Move ${itemName(it)} down`} disabled={i === items.length - 1} onClick={() => move(i, i + 1, false)} className="grid size-7 place-items-center rounded-[var(--radius-control)] text-ink-3 outline-none hover:bg-surface-2 hover:text-ink focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-30">
                <ArrowDown aria-hidden className="size-3.5" />
              </button>
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}
