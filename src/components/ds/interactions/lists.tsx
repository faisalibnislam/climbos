"use client";

/*
 * List behaviours: multi-select (click, ⌘/Ctrl-click, Shift-click ranges),
 * roving keyboard navigation, hover-reveal actions, infinite scroll and an interval hook.
 */
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { Loader2 } from "@/components/icons";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Multi-select                                                        */
/* ------------------------------------------------------------------ */

/** Selection over an ordered id list. Shift extends from the last anchor; ⌘/Ctrl toggles. */
export function useMultiSelect(ids: string[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [anchor, setAnchor] = useState<string | null>(null);
  const range = (a: string, b: string) => {
    const i = ids.indexOf(a);
    const j = ids.indexOf(b);
    if (i < 0 || j < 0) return [b];
    return ids.slice(Math.min(i, j), Math.max(i, j) + 1);
  };
  /** Row click: plain click selects only this row; Shift adds a range; ⌘/Ctrl toggles. */
  const click = (id: string, e: Pick<MouseEvent, "shiftKey" | "metaKey" | "ctrlKey">) => {
    if (e.shiftKey && anchor) {
      setSelected((s) => new Set([...s, ...range(anchor, id)]));
      return;
    }
    if (e.metaKey || e.ctrlKey) toggle(id);
    else setSelected(new Set([id]));
    setAnchor(id);
  };
  /** Checkbox toggle: Shift on the checkbox selects the range too. */
  const toggle = (id: string, shift = false) => {
    if (shift && anchor) {
      setSelected((s) => new Set([...s, ...range(anchor, id)]));
      return;
    }
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
    setAnchor(id);
  };
  const all = ids.length > 0 && ids.every((id) => selected.has(id));
  const some = !all && ids.some((id) => selected.has(id));
  return {
    selected,
    isSelected: (id: string) => selected.has(id),
    count: ids.filter((id) => selected.has(id)).length,
    click,
    toggle,
    selectAll: () => setSelected(new Set(ids)),
    clear: () => setSelected(new Set()),
    /** For a header checkbox: true / false / "indeterminate". */
    headerState: (all ? true : some ? "indeterminate" : false) as boolean | "indeterminate",
  };
}

/* ------------------------------------------------------------------ */
/* Keyboard navigation                                                 */
/* ------------------------------------------------------------------ */

export interface KeyListItem {
  id: string;
}

/**
 * Listbox with roving focus. ↑ ↓ or J K move, Home/End jump, Enter opens,
 * X toggles the item's mark, type-ahead jumps by first letter.
 */
export function KeyboardList<T extends KeyListItem>({
  items,
  label,
  renderItem,
  onOpen,
  onToggle,
  textOf,
  className,
}: {
  items: T[];
  label: string;
  renderItem: (item: T, state: { active: boolean }) => ReactNode;
  onOpen?: (item: T) => void;
  onToggle?: (item: T) => void;
  textOf?: (item: T) => string;
  className?: string;
}) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLLIElement | null)[]>([]);
  const go = (i: number) => {
    const n = Math.max(0, Math.min(items.length - 1, i));
    setActive(n);
    refs.current[n]?.focus();
  };
  const onKey = (e: KeyboardEvent) => {
    const k = e.key;
    if (k === "ArrowDown" || k === "j") go(active + 1);
    else if (k === "ArrowUp" || k === "k") go(active - 1);
    else if (k === "Home") go(0);
    else if (k === "End") go(items.length - 1);
    else if (k === "Enter") onOpen?.(items[active]);
    else if (k === "x" || k === " ") onToggle?.(items[active]);
    else if (textOf && k.length === 1 && /\S/.test(k)) {
      const start = active + 1;
      const order = [...items.slice(start), ...items.slice(0, start)];
      const hit = order.find((it) => textOf(it).toLowerCase().startsWith(k.toLowerCase()));
      if (hit) go(items.indexOf(hit));
      else return;
    } else return;
    e.preventDefault();
  };
  return (
    <ul role="listbox" aria-label={label} onKeyDown={onKey} className={cn("flex flex-col", className)}>
      {items.map((it, i) => (
        <li
          key={it.id}
          ref={(el) => {
            refs.current[i] = el;
          }}
          role="option"
          aria-selected={i === active}
          tabIndex={i === active ? 0 : -1}
          onClick={() => go(i)}
          onDoubleClick={() => onOpen?.(it)}
          className={cn("cursor-default rounded-[var(--radius-control)] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]", i === active ? "bg-surface-2" : "hover:bg-surface-2/50")}
        >
          {renderItem(it, { active: i === active })}
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Hover-reveal actions                                                */
/* ------------------------------------------------------------------ */

/**
 * Row whose secondary actions appear on hover and on keyboard focus. On touch
 * (no hover) they are always visible, so nothing is hidden from phones.
 */
export function HoverActionsRow({ children, actions, className }: { children: ReactNode; actions: ReactNode; className?: string }) {
  return (
    <div className={cn("group/hr relative flex items-center gap-3 rounded-[var(--radius-control)] px-3 py-2 transition-colors hover:bg-surface-2 focus-within:bg-surface-2", className)}>
      <div className="min-w-0 flex-1">{children}</div>
      <div className="flex shrink-0 items-center gap-0.5 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/hr:opacity-100 [@media(hover:hover)]:group-focus-within/hr:opacity-100">{actions}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Infinite scroll                                                     */
/* ------------------------------------------------------------------ */

/**
 * Scroll box that asks for more when its bottom sentinel comes into view
 * (IntersectionObserver rooted on the box). Shows loading and end states,
 * and a manual "Load more" button for keyboard and screen-reader users.
 */
export function InfiniteScroll({
  children,
  hasMore,
  loading,
  onLoadMore,
  height = 360,
  endText = "That's everything.",
  label,
}: {
  children: ReactNode;
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
  height?: number;
  endText?: string;
  label: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const cb = useRef(onLoadMore);
  useEffect(() => {
    cb.current = onLoadMore;
  }, [onLoadMore]);
  useEffect(() => {
    const root = box.current;
    const el = sentinel.current;
    if (!root || !el || !hasMore || loading) return;
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && cb.current(), { root, rootMargin: "0px 0px 120px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading]);
  return (
    <div ref={box} role="region" aria-label={label} aria-busy={loading} tabIndex={0} style={{ height }} className="overflow-y-auto rounded-[var(--radius-card)] border border-line bg-surface outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
      {children}
      <div ref={sentinel} className="flex min-h-12 items-center justify-center p-3 text-ui text-ink-3">
        {loading ? (
          <span role="status" className="inline-flex items-center gap-2">
            <Loader2 aria-hidden className="size-4 animate-spin" /> Loading more…
          </span>
        ) : hasMore ? (
          <button type="button" onClick={onLoadMore} className="rounded-[var(--radius-control)] px-2 py-1 font-medium text-ink-2 underline-offset-2 outline-none hover:text-ink hover:underline focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
            Load more
          </button>
        ) : (
          <span>{endText}</span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Interval                                                            */
/* ------------------------------------------------------------------ */

/** setInterval that always calls the latest callback and is cleared on unmount or when paused. */
export function useInterval(callback: () => void, ms: number | null) {
  const cb = useRef(callback);
  useEffect(() => {
    cb.current = callback;
  }, [callback]);
  useEffect(() => {
    if (ms === null) return;
    const id = setInterval(() => cb.current(), ms);
    return () => clearInterval(id);
  }, [ms]);
}
