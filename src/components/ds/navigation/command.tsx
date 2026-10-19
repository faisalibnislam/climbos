"use client";

/*
 * Command menu (inline, filterable, grouped), command palette (the menu in a modal),
 * global search (combobox in the top bar), recent pages and favourites lists.
 */
import { Dialog as RDialog } from "radix-ui";
import { useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ArrowRight, Clock, Search, Star, X } from "@/components/icons";
import { Kbd } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface CommandItem {
  id: string;
  label: string;
  group?: string;
  icon?: ReactNode;
  /** Secondary text on the right (e.g. "Campaign"). */
  hint?: string;
  /** Keys shown as <Kbd>, e.g. ["G", "T"]. */
  shortcut?: string[];
  keywords?: string[];
  disabled?: boolean;
}

function score(item: CommandItem, q: string) {
  const l = item.label.toLowerCase();
  if (l.startsWith(q)) return 0;
  if (l.split(/\s+/).some((w) => w.startsWith(q))) return 1;
  if (l.includes(q)) return 2;
  if (item.keywords?.some((k) => k.toLowerCase().includes(q)) || item.group?.toLowerCase().includes(q)) return 3;
  return 9;
}

/** Bold the matched part of a label. */
export function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
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

/** Filter + group items; keeps group order of first appearance. */
export function useCommandResults(items: CommandItem[], query: string) {
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? items
          .map((it, i) => ({ it, s: score(it, q), i }))
          .filter((x) => x.s < 9)
          .sort((a, b) => a.s - b.s || a.i - b.i)
          .map((x) => x.it)
      : items;
    const order: string[] = [];
    const groups = new Map<string, CommandItem[]>();
    for (const it of list) {
      const g = it.group ?? "";
      if (!groups.has(g)) {
        groups.set(g, []);
        order.push(g);
      }
      groups.get(g)!.push(it);
    }
    const flat = order.flatMap((g) => groups.get(g)!);
    return { flat, sections: order.map((g) => ({ group: g, items: groups.get(g)! })) };
  }, [items, query]);
}

export interface CommandMenuProps {
  items: CommandItem[];
  onSelect: (item: CommandItem) => void;
  placeholder?: string;
  /** Called on Escape (e.g. close the palette). */
  onEscape?: () => void;
  autoFocus?: boolean;
  /** Footer hints row. */
  footer?: boolean;
  label?: string;
  className?: string;
  listClassName?: string;
}

/** Filterable, grouped list of commands. Arrows move, Enter runs, Esc leaves. */
export function CommandMenu({ items, onSelect, placeholder = "Type a command or search…", onEscape, autoFocus, footer = true, label = "Commands", className, listClassName }: CommandMenuProps) {
  const uid = useId();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const { flat, sections } = useCommandResults(items, q);
  const listId = `${uid}-list`;
  const optId = (i: number) => `${uid}-opt-${i}`;
  const active = Math.min(idx, Math.max(0, flat.length - 1));
  const move = (n: number) => {
    setIdx(n);
    requestAnimationFrame(() => document.getElementById(optId(n))?.scrollIntoView({ block: "nearest" }));
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (flat.length) move((active + 1) % flat.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (flat.length) move((active - 1 + flat.length) % flat.length);
    } else if (e.key === "Home") {
      e.preventDefault();
      move(0);
    } else if (e.key === "End") {
      e.preventDefault();
      move(Math.max(0, flat.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const it = flat[active];
      if (it && !it.disabled) onSelect(it);
    } else if (e.key === "Escape" && onEscape) {
      e.preventDefault();
      if (q) setQ("");
      else onEscape();
    }
  };
  const starts = sections.map((_, si) => sections.slice(0, si).reduce((a, x) => a + x.items.length, 0));
  return (
    <div className={cn("flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface", className)}>
      <div className="flex items-center gap-2 border-b border-line px-3.5">
        <Search aria-hidden className="size-4 shrink-0 text-ink-3" />
        <input
          autoFocus={autoFocus}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setIdx(0);
          }}
          onKeyDown={onKey}
          role="combobox"
          aria-label={label}
          aria-expanded="true"
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={flat[active] ? optId(active) : undefined}
          placeholder={placeholder}
          className="h-12 min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-3"
        />
        {q ? (
          <button type="button" aria-label="Clear" onClick={() => setQ("")} className="grid size-6 place-items-center rounded-[var(--radius-control)] text-ink-3 hover:bg-surface-2 hover:text-ink">
            <X aria-hidden className="size-3.5" />
          </button>
        ) : null}
      </div>
      <div id={listId} role="listbox" aria-label={label} className={cn("max-h-80 overflow-y-auto p-1.5", listClassName)}>
        {flat.length ? (
          sections.map((s, si) => (
            <div key={s.group || "_"} role="group" aria-label={s.group || undefined} className="pb-1">
              {s.group ? <p className="text-overline px-2.5 pb-1 pt-2" aria-hidden>{s.group}</p> : null}
              {s.items.map((it, j) => {
                const i = starts[si] + j;
                const on = i === active;
                return (
                  <div
                    key={it.id}
                    id={optId(i)}
                    role="option"
                    aria-selected={on}
                    aria-disabled={it.disabled || undefined}
                    onMouseMove={() => idx !== i && setIdx(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => !it.disabled && onSelect(it)}
                    className={cn(
                      "flex min-h-9 cursor-pointer items-center gap-3 rounded-[var(--radius-control)] px-2.5 text-ui text-ink-2",
                      on && "bg-surface-2 text-ink",
                      it.disabled && "cursor-not-allowed opacity-50",
                    )}
                  >
                    {it.icon ? <span aria-hidden className="inline-flex text-ink-3 [&_svg]:size-4">{it.icon}</span> : null}
                    <span className="min-w-0 flex-1 truncate">
                      <Highlight text={it.label} query={q} />
                    </span>
                    {it.hint ? <span className="shrink-0 text-xs text-ink-3">{it.hint}</span> : null}
                    {it.shortcut ? (
                      <span className="flex shrink-0 gap-1" aria-label={`Shortcut ${it.shortcut.join(" ")}`}>
                        {it.shortcut.map((k) => (
                          <Kbd key={k}>{k}</Kbd>
                        ))}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))
        ) : (
          <p className="px-3 py-8 text-center text-ui text-ink-3">Nothing matches “{q}”.</p>
        )}
      </div>
      {footer ? (
        <div className="hidden items-center gap-4 border-t border-line bg-surface-2/60 px-3.5 py-2 text-xs text-ink-3 sm:flex">
          <span className="flex items-center gap-1.5"><Kbd>↑</Kbd><Kbd>↓</Kbd> Move</span>
          <span className="flex items-center gap-1.5"><Kbd>↵</Kbd> Open</span>
          <span className="flex items-center gap-1.5"><Kbd>Esc</Kbd> Close</span>
        </div>
      ) : null}
    </div>
  );
}

/** The command menu in a modal. Focus is trapped; Esc clears the query, then closes. */
export function CommandPalette({ open, onOpenChange, items, onSelect, placeholder, title = "Command palette" }: { open: boolean; onOpenChange: (v: boolean) => void; items: CommandItem[]; onSelect: (item: CommandItem) => void; placeholder?: string; title?: string }) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-50 bg-[rgb(26_29_27/0.42)] animate-fade-in" />
        <RDialog.Content aria-describedby={undefined} onEscapeKeyDown={(e) => e.preventDefault()} className="fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 animate-fade-up outline-none">
          <RDialog.Title className="sr-only">{title}</RDialog.Title>
          <CommandMenu
            items={items}
            placeholder={placeholder}
            autoFocus
            className="shadow-lg"
            onEscape={() => onOpenChange(false)}
            onSelect={(it) => {
              onOpenChange(false);
              onSelect(it);
            }}
          />
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}

/* ------------------------------------------------------------------ */
/* Global search                                                       */
/* ------------------------------------------------------------------ */

/** Top-bar search: recent searches when empty, grouped results while typing, "see all" on Enter. */
export function GlobalSearch({
  items,
  recent = [],
  onOpen,
  onSearchAll,
  placeholder = "Search leads, campaigns, posts",
  className,
}: {
  items: CommandItem[];
  recent?: string[];
  onOpen: (item: CommandItem) => void;
  onSearchAll?: (q: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const uid = useId();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  const { flat, sections } = useCommandResults(items, q);
  const typing = q.trim().length > 0;
  const rows: { kind: "recent" | "item" | "all"; label: string; item?: CommandItem }[] = typing
    ? [...flat.slice(0, 8).map((it) => ({ kind: "item" as const, label: it.label, item: it })), ...(onSearchAll ? [{ kind: "all" as const, label: `See all results for “${q.trim()}”` }] : [])]
    : recent.map((r) => ({ kind: "recent" as const, label: r }));
  const shownIds = new Set(rows.filter((r) => r.item).map((r) => r.item!.id));
  const pick = (r: (typeof rows)[number]) => {
    if (r.kind === "recent") {
      setQ(r.label);
      setIdx(-1);
      input.current?.focus();
      return;
    }
    if (r.kind === "all") onSearchAll?.(q.trim());
    else if (r.item) onOpen(r.item);
    setOpen(false);
    setIdx(-1);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setIdx((i) => (rows.length ? (i + 1) % rows.length : -1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIdx((i) => (rows.length ? (i - 1 + rows.length) % rows.length : -1));
    } else if (e.key === "Enter") {
      const r = rows[idx] ?? (typing && onSearchAll ? rows[rows.length - 1] : undefined);
      if (r) {
        e.preventDefault();
        pick(r);
      }
    } else if (e.key === "Escape") {
      if (open) setOpen(false);
      else setQ("");
    }
  };
  const optId = (i: number) => `${uid}-gs-${i}`;
  const row = (r: (typeof rows)[number]) => {
    const i = rows.findIndex((x) => x.kind === r.kind && x.label === r.label && x.item?.id === r.item?.id);
    const on = i === idx;
    return (
      <li
        key={`${r.kind}-${r.item?.id ?? r.label}`}
        id={optId(i)}
        role="option"
        aria-selected={on}
        onMouseDown={(e) => e.preventDefault()}
        onMouseMove={() => idx !== i && setIdx(i)}
        onClick={() => pick(r)}
        className={cn("flex min-h-9 cursor-pointer items-center gap-3 rounded-[var(--radius-control)] px-2.5 text-ui text-ink-2", on && "bg-surface-2 text-ink")}
      >
        <span aria-hidden className="inline-flex text-ink-3 [&_svg]:size-4">
          {r.kind === "recent" ? <Clock /> : r.kind === "all" ? <Search /> : r.item?.icon}
        </span>
        <span className="min-w-0 flex-1 truncate">{r.kind === "item" ? <Highlight text={r.label} query={q} /> : r.label}</span>
        {r.item?.hint ? <span className="text-xs text-ink-3">{r.item.hint}</span> : r.kind === "all" ? <ArrowRight aria-hidden className="size-4 text-ink-3" /> : null}
      </li>
    );
  };
  return (
    <div className={cn("relative w-full max-w-md", className)}>
      <div className="flex h-[var(--h-md)] items-center gap-2 rounded-[var(--radius-control)] border border-line bg-surface px-3 shadow-[var(--btn-2-shadow)] focus-within:ring-2 focus-within:ring-[var(--focus-ring)]">
        <Search aria-hidden className="size-4 shrink-0 text-ink-3" />
        <input
          ref={input}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setIdx(-1);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKey}
          role="combobox"
          aria-label="Search"
          aria-expanded={open && rows.length > 0}
          aria-controls={`${uid}-gs`}
          aria-autocomplete="list"
          aria-activedescendant={idx >= 0 ? optId(idx) : undefined}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-ui text-ink outline-none placeholder:text-ink-3"
        />
        {q ? (
          <button type="button" aria-label="Clear search" onMouseDown={(e) => e.preventDefault()} onClick={() => setQ("")} className="grid size-5 place-items-center rounded-[var(--radius-control)] text-ink-3 hover:text-ink">
            <X aria-hidden className="size-3.5" />
          </button>
        ) : null}
      </div>
      {open && rows.length > 0 ? (
        <div className="absolute inset-x-0 top-full z-40 mt-1.5 rounded-[var(--radius-card)] border border-line bg-surface p-1.5 shadow-lg animate-fade-in">
          <ul id={`${uid}-gs`} role="listbox" aria-label={typing ? "Results" : "Recent searches"} className="max-h-80 overflow-y-auto">
            {typing ? (
              <>
                {sections.map((s) => {
                  const its = s.items.filter((it) => shownIds.has(it.id));
                  if (!its.length) return null;
                  return (
                    <li key={s.group || "_"} role="presentation">
                      {s.group ? <p className="text-overline px-2.5 pb-1 pt-2" aria-hidden>{s.group}</p> : null}
                      <ul role="group" aria-label={s.group || undefined}>
                        {its.map((it) => row({ kind: "item", label: it.label, item: it }))}
                      </ul>
                    </li>
                  );
                })}
                {!flat.length ? <li role="presentation" className="px-2.5 py-3 text-ui text-ink-3">No matches yet.</li> : null}
                {rows.filter((r) => r.kind === "all").map(row)}
              </>
            ) : (
              <>
                <li role="presentation" className="text-overline px-2.5 pb-1 pt-2" aria-hidden>Recent searches</li>
                {rows.map(row)}
              </>
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Recent pages and favourites                                         */
/* ------------------------------------------------------------------ */

export interface PageLink {
  id: string;
  label: string;
  /** e.g. "Campaign · 2h ago" */
  meta?: string;
  icon?: ReactNode;
}

const rowCls =
  "flex w-full items-center gap-2.5 rounded-[var(--radius-control)] px-2.5 py-1.5 text-left text-ui text-ink-2 outline-none transition-colors hover:bg-surface-2 hover:text-ink focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]";

/** Recently visited pages, newest first, with a clear action. */
export function RecentPages({ items, onOpen, onClear, title = "Recent" }: { items: PageLink[]; onOpen: (id: string) => void; onClear?: () => void; title?: string }) {
  return (
    <section aria-label={title} className="flex flex-col gap-1">
      <div className="flex items-center justify-between px-2.5">
        <p className="text-overline">{title}</p>
        {onClear && items.length ? (
          <button type="button" onClick={onClear} className="text-xs text-ink-3 underline-offset-2 hover:text-ink hover:underline">
            Clear
          </button>
        ) : null}
      </div>
      {items.length ? (
        <ul className="flex flex-col">
          {items.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => onOpen(p.id)} className={rowCls}>
                <span aria-hidden className="inline-flex text-ink-3 [&_svg]:size-4">{p.icon ?? <Clock />}</span>
                <span className="min-w-0 flex-1 truncate text-ink">{p.label}</span>
                {p.meta ? <span className="shrink-0 text-xs text-ink-3">{p.meta}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-2.5 py-2 text-ui text-ink-3">Pages you open show up here.</p>
      )}
    </section>
  );
}

/** Starred pages. The star toggles (aria-pressed); unstarring removes the row. */
export function Favorites({ items, onOpen, onToggle, title = "Favorites" }: { items: (PageLink & { starred: boolean })[]; onOpen: (id: string) => void; onToggle: (id: string) => void; title?: string }) {
  const starred = items.filter((i) => i.starred);
  return (
    <section aria-label={title} className="flex flex-col gap-1">
      <p className="text-overline px-2.5">{title}</p>
      {starred.length ? (
        <ul className="flex flex-col">
          {starred.map((p) => (
            <li key={p.id} className="group/fav flex items-center">
              <button type="button" onClick={() => onOpen(p.id)} className={rowCls}>
                <span aria-hidden className="inline-flex text-ink-3 [&_svg]:size-4">{p.icon}</span>
                <span className="min-w-0 flex-1 truncate text-ink">{p.label}</span>
              </button>
              <button
                type="button"
                aria-pressed
                aria-label={`Remove ${p.label} from favorites`}
                onClick={() => onToggle(p.id)}
                className="-ml-9 grid size-7 shrink-0 place-items-center rounded-[var(--radius-control)] text-amber-800 outline-none hover:bg-surface-3 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              >
                <Star aria-hidden className="size-4 fill-current" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-2.5 py-2 text-ui text-ink-3">Star a page to pin it here.</p>
      )}
    </section>
  );
}
