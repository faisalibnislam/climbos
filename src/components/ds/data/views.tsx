"use client";

/*
 * Signal collection views: list, grid, kanban, calendar month, timeline,
 * Gantt and tree. All take plain data and render deterministic markup.
 */
import { useId, useRef, useState, type DragEvent, type KeyboardEvent, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, FileText, Folder, GripVertical } from "@/components/icons";
import { Avatar, Badge, IconButton, type Tone } from "@/components/ui";
import { cn } from "@/lib/utils";

const ring = "outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]";

/* ------------------------------------------------------------------ */
/* List view                                                           */
/* ------------------------------------------------------------------ */

export interface ListItem {
  id: string;
  title: string;
  sub?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  meta?: string;
}

/** Rows with a leading avatar/icon, two lines of text and trailing meta. Click selects. */
export function ListView({ items, label, selected, onSelect, className }: { items: ListItem[]; label: string; selected?: string | null; onSelect?: (id: string) => void; className?: string }) {
  return (
    <ul aria-label={label} className={cn("divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--card-shadow)]", className)}>
      {items.map((it) => {
        const body = (
          <>
            {it.leading}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-ui font-medium">{it.title}</span>
              {it.sub ? <span className="block truncate text-xs text-ink-3">{it.sub}</span> : null}
            </span>
            {it.trailing}
            {it.meta ? <span className="hidden shrink-0 text-xs tabular-nums text-ink-3 sm:inline">{it.meta}</span> : null}
          </>
        );
        return (
          <li key={it.id}>
            {onSelect ? (
              <button
                type="button"
                aria-current={selected === it.id ? "true" : undefined}
                onClick={() => onSelect(it.id)}
                className={cn("flex min-h-[var(--cell-h)] w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-surface-2", ring, "focus-visible:ring-inset", selected === it.id && "bg-surface-2 shadow-[inset_2px_0_0_var(--ink)]")}
              >
                {body}
              </button>
            ) : (
              <div className="flex min-h-[var(--cell-h)] items-center gap-3 px-4 py-2">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Grid view                                                           */
/* ------------------------------------------------------------------ */

export interface GridItem {
  id: string;
  title: string;
  sub?: string;
  /** Thumbnail content (an image or a placeholder block). */
  media: ReactNode;
  badge?: { label: string; tone: Tone };
}

/** Tiles with a thumbnail. Multi-select with the corner checkbox. */
export function GridView({ items, label, selected, onSelectedChange, min = 180, className }: { items: GridItem[]; label: string; selected?: string[]; onSelectedChange?: (ids: string[]) => void; min?: number; className?: string }) {
  return (
    <ul aria-label={label} className={cn("grid gap-3", className)} style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(${min}px, 100%), 1fr))` }}>
      {items.map((it) => {
        const on = selected?.includes(it.id) ?? false;
        return (
          <li key={it.id} className={cn("group relative overflow-hidden rounded-[var(--radius-card)] border bg-surface shadow-[var(--card-shadow)] transition-colors", on ? "border-ink ring-1 ring-ink" : "border-line")}>
            <div className="aspect-[4/3] overflow-hidden border-b border-line">{it.media}</div>
            <div className="flex items-start gap-2 p-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-ui font-medium">{it.title}</span>
                {it.sub ? <span className="block truncate text-xs text-ink-3">{it.sub}</span> : null}
              </span>
              {it.badge ? <Badge tone={it.badge.tone}>{it.badge.label}</Badge> : null}
            </div>
            {onSelectedChange ? (
              <label className={cn("absolute left-2 top-2 grid size-7 cursor-pointer place-items-center rounded-[var(--radius-control)] bg-surface/95 shadow-[var(--card-shadow)] transition-opacity has-[:focus-visible]:opacity-100 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--focus-ring)]", on ? "opacity-100" : "opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100")}>
                <input
                  type="checkbox"
                  checked={on}
                  aria-label={`Select ${it.title}`}
                  onChange={(e) => onSelectedChange(e.target.checked ? [...(selected ?? []), it.id] : (selected ?? []).filter((x) => x !== it.id))}
                  className="size-4 accent-[var(--ink)]"
                />
              </label>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Kanban board                                                        */
/* ------------------------------------------------------------------ */

export interface KanbanCard {
  id: string;
  column: string;
  title: string;
  meta?: string;
  owner?: string;
  tag?: { label: string; tone: Tone };
}

export interface KanbanColumn {
  id: string;
  title: string;
  /** Soft limit shown next to the count. */
  limit?: number;
}

/**
 * Columns of cards. Drag a card to another column (HTML5 drag and drop), or
 * focus a card and press ← / → to move it. Moves are announced.
 */
export function KanbanBoard({ columns, cards, onMove, label, className }: { columns: KanbanColumn[]; cards: KanbanCard[]; onMove: (cardId: string, column: string) => void; label: string; className?: string }) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const refs = useRef(new Map<string, HTMLDivElement>());

  const moveTo = (id: string, col: string) => {
    const card = cards.find((c) => c.id === id);
    if (!card || card.column === col) return;
    onMove(id, col);
    setAnnounce(`${card.title} moved to ${columns.find((c) => c.id === col)?.title}`);
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>, card: KanbanCard) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const i = columns.findIndex((c) => c.id === card.column);
    const next = columns[i + (e.key === "ArrowRight" ? 1 : -1)];
    if (!next) return;
    e.preventDefault();
    moveTo(card.id, next.id);
    requestAnimationFrame(() => refs.current.get(card.id)?.focus());
  };

  const onDrop = (e: DragEvent, col: string) => {
    e.preventDefault();
    const id = dragId ?? e.dataTransfer.getData("text/plain");
    if (id) moveTo(id, col);
    setDragId(null);
    setOver(null);
  };

  return (
    <div className={className}>
      <div role="group" aria-label={label} className="relative flex gap-3 overflow-x-auto pb-2">
        {columns.map((col) => {
          const list = cards.filter((c) => c.column === col.id);
          const overLimit = col.limit !== undefined && list.length > col.limit;
          return (
            <section
              key={col.id}
              aria-label={`${col.title}, ${list.length} ${list.length === 1 ? "card" : "cards"}`}
              onDragOver={(e) => {
                e.preventDefault();
                if (over !== col.id) setOver(col.id);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver((o) => (o === col.id ? null : o));
              }}
              onDrop={(e) => onDrop(e, col.id)}
              className={cn("flex w-64 shrink-0 flex-col gap-2 rounded-[var(--radius-card)] bg-surface-2 p-2 ring-1 ring-line transition-colors", over === col.id && dragId && "bg-brand-50 ring-2 ring-brand-700")}
            >
              <header className="flex items-center gap-2 px-1.5 py-1">
                <h3 className="flex-1 text-ui font-semibold">{col.title}</h3>
                <span className={cn("text-xs tabular-nums", overLimit ? "font-medium text-red-800" : "text-ink-3")}>
                  {list.length}
                  {col.limit !== undefined ? ` / ${col.limit}` : ""}
                </span>
              </header>
              <ul className="flex min-h-16 flex-col gap-2">
                {list.map((c) => (
                  <li key={c.id}>
                    <div
                      ref={(n) => {
                        if (n) refs.current.set(c.id, n);
                        else refs.current.delete(c.id);
                      }}
                      tabIndex={0}
                      draggable
                      aria-roledescription="Draggable card"
                      aria-describedby={`${col.id}-hint`}
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", c.id);
                        setDragId(c.id);
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setOver(null);
                      }}
                      onKeyDown={(e) => onKey(e, c)}
                      className={cn("flex cursor-grab flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-surface p-3 shadow-[var(--card-shadow)] active:cursor-grabbing", ring, dragId === c.id && "opacity-50")}
                    >
                      <div className="flex items-start gap-2">
                        <p className="min-w-0 flex-1 text-ui font-medium">{c.title}</p>
                        <GripVertical aria-hidden="true" className="size-3.5 shrink-0 text-ink-3" />
                      </div>
                      <div className="flex items-center gap-2">
                        {c.tag ? <Badge tone={c.tag.tone}>{c.tag.label}</Badge> : null}
                        {c.meta ? <span className="flex-1 truncate text-xs text-ink-3">{c.meta}</span> : <span className="flex-1" />}
                        {c.owner ? <Avatar name={c.owner} size="sm" /> : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <p id={`${col.id}-hint`} className="sr-only">
                Press left or right arrow to move to another column.
              </p>
            </section>
          );
        })}
      </div>
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Calendar month view                                                 */
/* ------------------------------------------------------------------ */

export interface CalendarEvent {
  id: string;
  /** ISO date, yyyy-mm-dd. */
  date: string;
  title: string;
  tone?: "ink" | "sage" | "clay" | "slate";
}

const EVENT_TONE: Record<NonNullable<CalendarEvent["tone"]>, string> = {
  ink: "bg-ink text-white",
  sage: "bg-brand-100 text-brand-900",
  clay: "bg-orange-100 text-orange-800",
  slate: "bg-blue-100 text-blue-800",
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

/**
 * Month grid (Monday first). Arrow keys move between days, PageUp / PageDown
 * change month, Enter selects. `today` is passed in so SSR stays stable.
 */
export function CalendarMonth({ year: y0, month: m0, today, events, selected, onSelect, className }: { year: number; month: number; today?: string; events: CalendarEvent[]; selected?: string | null; onSelect?: (date: string) => void; className?: string }) {
  const [ym, setYm] = useState({ y: y0, m: m0 });
  const [focusDate, setFocusDate] = useState<string>(selected ?? today ?? iso(y0, m0, 1));
  const grid = useRef<HTMLTableElement>(null);
  const titleId = useId();

  const first = new Date(Date.UTC(ym.y, ym.m, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(ym.y, ym.m + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));

  const byDate = new Map<string, CalendarEvent[]>();
  events.forEach((e) => byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]));

  const shift = (delta: number) =>
    setYm(({ y, m }) => {
      const d = new Date(Date.UTC(y, m + delta, 1));
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
    });

  const focusDay = (date: string) => {
    setFocusDate(date);
    requestAnimationFrame(() => grid.current?.querySelector<HTMLButtonElement>(`[data-date="${date}"]`)?.focus());
  };

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, d: number) => {
    const map: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key in map || e.key === "PageUp" || e.key === "PageDown" || e.key === "Home" || e.key === "End") {
      e.preventDefault();
      let t: Date;
      if (e.key === "PageUp" || e.key === "PageDown") t = new Date(Date.UTC(ym.y, ym.m + (e.key === "PageDown" ? 1 : -1), d));
      else if (e.key === "Home") t = new Date(Date.UTC(ym.y, ym.m, d - ((lead + d - 1) % 7)));
      else if (e.key === "End") t = new Date(Date.UTC(ym.y, ym.m, d + (6 - ((lead + d - 1) % 7))));
      else t = new Date(Date.UTC(ym.y, ym.m, d + map[e.key]));
      const ny = t.getUTCFullYear();
      const nm = t.getUTCMonth();
      if (ny !== ym.y || nm !== ym.m) setYm({ y: ny, m: nm });
      focusDay(iso(ny, nm, t.getUTCDate()));
    }
  };

  const inMonth = focusDate.startsWith(`${ym.y}-${pad(ym.m + 1)}`);
  const tabDate = inMonth ? focusDate : iso(ym.y, ym.m, 1);

  return (
    <div className={cn("overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--card-shadow)]", className)}>
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <h3 id={titleId} aria-live="polite" className="heading-card flex-1">
          {MONTHS[ym.m]} {ym.y}
        </h3>
        <IconButton aria-label="Previous month" icon={<ChevronLeft />} size="sm" variant="secondary" onClick={() => shift(-1)} tooltip={false} />
        <IconButton aria-label="Next month" icon={<ChevronRight />} size="sm" variant="secondary" onClick={() => shift(1)} tooltip={false} />
      </div>
      <div className="relative overflow-x-auto">
        <table ref={grid} role="grid" aria-labelledby={titleId} className="w-full min-w-[480px] table-fixed border-collapse">
          <thead>
            <tr>
              {WEEKDAYS.map((w) => (
                <th key={w} scope="col" className="h-8 border-b border-line text-center text-2xs font-medium text-ink-3">
                  <abbr title={w} className="no-underline">
                    {w}
                  </abbr>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((wk, wi) => (
              <tr key={wi}>
                {wk.map((d, di) => {
                  if (d === null) return <td key={di} className="h-24 border-b border-r border-line bg-surface-2/50 last:border-r-0" />;
                  const date = iso(ym.y, ym.m, d);
                  const evs = byDate.get(date) ?? [];
                  const isToday = date === today;
                  const isSel = date === selected;
                  return (
                    <td key={di} className={cn("h-24 border-b border-r border-line align-top last:border-r-0", isSel && "bg-brand-50")}>
                      <button
                        type="button"
                        data-date={date}
                        tabIndex={date === tabDate ? 0 : -1}
                        aria-pressed={isSel}
                        aria-label={`${d} ${MONTHS[ym.m]}${isToday ? ", today" : ""}${evs.length ? `, ${evs.length} ${evs.length === 1 ? "event" : "events"}` : ""}`}
                        onKeyDown={(e) => onKey(e, d)}
                        onFocus={() => setFocusDate(date)}
                        onClick={() => onSelect?.(date)}
                        className={cn("flex size-full flex-col gap-1 p-1.5 text-left hover:bg-surface-2", ring, "focus-visible:ring-inset")}
                      >
                        <span className={cn("grid size-6 place-items-center rounded-full text-xs tabular-nums", isToday ? "bg-ink font-semibold text-white" : "text-ink-2")}>{d}</span>
                        {evs.slice(0, 2).map((ev) => (
                          <span key={ev.id} aria-hidden="true" className={cn("truncate rounded-[3px] px-1.5 py-0.5 text-2xs font-medium", EVENT_TONE[ev.tone ?? "sage"])}>
                            {ev.title}
                          </span>
                        ))}
                        {evs.length > 2 ? <span aria-hidden="true" className="px-1 text-2xs text-ink-3">+{evs.length - 2} more</span> : null}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Timeline                                                            */
/* ------------------------------------------------------------------ */

export interface TimelineItem {
  id: string;
  time: string;
  title: string;
  body?: ReactNode;
  state?: "done" | "current" | "upcoming";
}

/** Vertical timeline: done (filled), current (ringed), upcoming (hollow). */
export function TimelineView({ items, className }: { items: TimelineItem[]; className?: string }) {
  return (
    <ol className={cn("flex flex-col", className)}>
      {items.map((it, i) => {
        const st = it.state ?? "done";
        return (
          <li key={it.id} className="grid grid-cols-[72px_20px_minmax(0,1fr)] gap-x-3">
            <time className="pt-0.5 text-right text-xs tabular-nums text-ink-3">{it.time}</time>
            <span className="relative flex justify-center">
              <span
                aria-hidden="true"
                className={cn(
                  "relative z-[1] mt-1 size-3 rounded-full border-2",
                  st === "done" && "border-ink bg-ink",
                  st === "current" && "border-ink bg-lime ring-4 ring-lime/40",
                  st === "upcoming" && "border-line-strong bg-surface",
                )}
              />
              {i < items.length - 1 ? <span aria-hidden="true" className={cn("absolute top-4 bottom-0 w-px", st === "done" ? "bg-ink/40" : "bg-line-strong")} /> : null}
            </span>
            <div className="pb-5">
              <p className={cn("text-ui font-medium", st === "upcoming" && "text-ink-3")}>
                {it.title}
                {st === "current" ? <span className="sr-only"> (in progress)</span> : st === "upcoming" ? <span className="sr-only"> (upcoming)</span> : null}
              </p>
              {it.body ? <div className="mt-0.5 text-ui text-ink-2">{it.body}</div> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/* Gantt chart                                                         */
/* ------------------------------------------------------------------ */

export interface GanttTask {
  id: string;
  name: string;
  /** Start day index (0-based) within the range. */
  start: number;
  /** Length in days. */
  length: number;
  /** 0–1 done. */
  progress?: number;
  owner?: string;
  tone?: "ink" | "sage" | "clay";
}

/** Simple Gantt: one row per task, day columns, week labels, a today line. */
export function GanttChart({ tasks, days, dayLabels, today, label, className }: { tasks: GanttTask[]; days: number; dayLabels: (i: number) => string | null; today?: number; label: string; className?: string }) {
  const pct = (n: number) => `${Math.round((n / days) * 10000) / 100}%`;
  const fill = { ink: "bg-ink", sage: "bg-brand-700", clay: "bg-chart-4" };
  return (
    <div className={cn("relative overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--card-shadow)]", className)}>
      <div role="table" aria-label={label} className="min-w-[640px]">
        <div role="row" className="grid grid-cols-[180px_minmax(0,1fr)] border-b border-line bg-surface-2">
          <span role="columnheader" className="px-4 py-2 text-xs font-medium text-ink-3">
            Task
          </span>
          <span role="columnheader" className="relative h-8">
            <span className="sr-only">Schedule</span>
            {Array.from({ length: days }, (_, i) => {
              const l = dayLabels(i);
              return l ? (
                <span key={i} aria-hidden="true" className="absolute top-2 border-l border-line-strong pl-1 text-2xs text-ink-3" style={{ left: pct(i) }}>
                  {l}
                </span>
              ) : null;
            })}
          </span>
        </div>
        {tasks.map((t) => {
          const done = Math.round((t.progress ?? 0) * 100);
          return (
            <div role="row" key={t.id} className="grid grid-cols-[180px_minmax(0,1fr)] border-b border-line last:border-b-0">
              <span role="rowheader" className="flex items-center gap-2 truncate px-4 py-2.5 text-ui font-medium">
                {t.owner ? <Avatar name={t.owner} size="sm" /> : null}
                <span className="truncate">{t.name}</span>
              </span>
              <span role="cell" className="relative h-11">
                {Array.from({ length: days }, (_, i) =>
                  dayLabels(i) ? <span key={i} aria-hidden="true" className="absolute inset-y-0 w-px bg-line" style={{ left: pct(i) }} /> : null,
                )}
                {today !== undefined ? <span aria-hidden="true" className="absolute inset-y-0 z-[1] w-0.5 bg-red-800/70" style={{ left: pct(today + 0.5) }} /> : null}
                <span
                  className="absolute top-1/2 h-5 -translate-y-1/2 overflow-hidden rounded-[3px] bg-surface-3"
                  style={{ left: pct(t.start), width: pct(t.length) }}
                  title={`${t.name}: ${t.length} days, ${done}% done`}
                >
                  <span className={cn("block h-full", fill[t.tone ?? "sage"])} style={{ width: `${done}%` }} />
                </span>
                <span className="sr-only">
                  Starts {dayLabels(t.start) ?? `day ${t.start + 1}`}, {t.length} days, {done}% done
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tree view                                                           */
/* ------------------------------------------------------------------ */

export interface TreeNode {
  id: string;
  label: string;
  meta?: string;
  children?: TreeNode[];
}

/**
 * WAI-ARIA tree. ↑ ↓ move, → opens or goes to the first child, ← closes or goes
 * to the parent, Home / End jump, Enter / Space selects. One tab stop.
 */
export function TreeView({ nodes, label, defaultExpanded = [], selected, onSelect, className }: { nodes: TreeNode[]; label: string; defaultExpanded?: string[]; selected?: string | null; onSelect?: (id: string) => void; className?: string }) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(defaultExpanded));
  const [active, setActive] = useState<string>(selected ?? nodes[0]?.id ?? "");
  const root = useRef<HTMLUListElement>(null);

  // Flatten the visible nodes in order, with parent links.
  const visible: { node: TreeNode; parent: string | null; level: number }[] = [];
  const walk = (list: TreeNode[], parent: string | null, level: number) =>
    list.forEach((n) => {
      visible.push({ node: n, parent, level });
      if (n.children && open.has(n.id)) walk(n.children, n.id, level + 1);
    });
  walk(nodes, null, 1);

  const focus = (id: string) => {
    setActive(id);
    requestAnimationFrame(() => root.current?.querySelector<HTMLElement>(`[data-tree-id="${id}"]`)?.focus());
  };
  const toggle = (id: string, to?: boolean) =>
    setOpen((s) => {
      const n = new Set(s);
      if (to ?? !n.has(id)) n.add(id);
      else n.delete(id);
      return n;
    });

  const onKey = (e: KeyboardEvent<HTMLLIElement>, id: string) => {
    e.stopPropagation();
    const i = visible.findIndex((v) => v.node.id === id);
    const cur = visible[i];
    const hasKids = !!cur.node.children?.length;
    const isOpen = open.has(id);
    switch (e.key) {
      case "ArrowDown":
        if (visible[i + 1]) focus(visible[i + 1].node.id);
        break;
      case "ArrowUp":
        if (visible[i - 1]) focus(visible[i - 1].node.id);
        break;
      case "ArrowRight":
        if (hasKids && !isOpen) toggle(id, true);
        else if (hasKids) focus(cur.node.children![0].id);
        break;
      case "ArrowLeft":
        if (hasKids && isOpen) toggle(id, false);
        else if (cur.parent) focus(cur.parent);
        break;
      case "Home":
        focus(visible[0].node.id);
        break;
      case "End":
        focus(visible[visible.length - 1].node.id);
        break;
      case "Enter":
      case " ":
        onSelect?.(id);
        if (hasKids && e.key === "Enter") toggle(id);
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  const tabId = visible.some((v) => v.node.id === active) ? active : visible[0]?.node.id;

  const render = (list: TreeNode[], level: number): ReactNode =>
    list.map((n, idx) => {
      const hasKids = !!n.children?.length;
      const isOpen = open.has(n.id);
      const isSel = n.id === selected;
      return (
        <li
          key={n.id}
          role="treeitem"
          data-tree-id={n.id}
          aria-level={level}
          aria-setsize={list.length}
          aria-posinset={idx + 1}
          aria-expanded={hasKids ? isOpen : undefined}
          aria-selected={isSel}
          tabIndex={n.id === tabId ? 0 : -1}
          onKeyDown={(e) => onKey(e, n.id)}
          onFocus={(e) => {
            if (e.target === e.currentTarget) setActive(n.id);
          }}
          onClick={(e) => {
            e.stopPropagation();
            setActive(n.id);
            onSelect?.(n.id);
            if (hasKids) toggle(n.id);
          }}
          className="outline-none [&:focus-visible>div]:ring-2 [&:focus-visible>div]:ring-inset [&:focus-visible>div]:ring-[var(--focus-ring)]"
        >
          <div
            className={cn("flex h-8 cursor-pointer items-center gap-1.5 rounded-[var(--radius-control)] pr-2 text-ui hover:bg-surface-2", isSel && "bg-surface-2 font-medium")}
            style={{ paddingLeft: `${(level - 1) * 16 + 6}px` }}
          >
            <ChevronRight aria-hidden="true" className={cn("size-3.5 shrink-0 text-ink-3 transition-transform motion-reduce:transition-none", !hasKids && "invisible", isOpen && "rotate-90")} />
            {hasKids ? <Folder aria-hidden="true" className="size-4 shrink-0 text-ink-2" /> : <FileText aria-hidden="true" className="size-4 shrink-0 text-ink-3" />}
            <span className="min-w-0 flex-1 truncate">{n.label}</span>
            {n.meta ? <span className="text-2xs tabular-nums text-ink-3">{n.meta}</span> : null}
          </div>
          {hasKids && isOpen ? (
            <ul role="group" className="flex flex-col">
              {render(n.children!, level + 1)}
            </ul>
          ) : null}
        </li>
      );
    });

  return (
    <ul ref={root} role="tree" aria-label={label} className={cn("flex flex-col rounded-[var(--radius-card)] border border-line bg-surface p-1.5 shadow-[var(--card-shadow)]", className)}>
      {render(nodes, 1)}
    </ul>
  );
}
