"use client";

/*
 * Dashboard customisation and freshness: WIDGETS catalog, WidgetBoard
 * (edit mode: drag to reorder, move buttons, hide/show), WidgetLibrary (+
 * dialog), DashboardShare (ShareDialog + scheduled digest), RefreshIndicator
 * (live steps while refreshing) and LastUpdated (ticking relative time).
 */
import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Check, Clock, Eye, EyeOff, GripVertical, LayoutGrid, Plus, RefreshCw, Search, Share2, Star, TriangleAlert } from "@/components/icons";
import { Badge, BarList, Button, Dialog, DialogContent, ProgressRing, Select, SocialIcon, Sparkline, Switch } from "@/components/ui";
import { cn } from "@/lib/utils";
import { ShareDialog, type SharePerson } from "../collaboration/share";

/* ------------------------------------------------------------------ */
/* Catalog                                                             */
/* ------------------------------------------------------------------ */

export interface WidgetDef {
  id: string;
  title: string;
  description: string;
  category: "Growth" | "Content" | "Account";
  /** Columns spanned on wide screens. */
  span: 1 | 2;
  render: () => ReactNode;
}

function Big({ value, label, trend }: { value: string; label: string; trend?: number[] }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        <p className="text-3xl font-semibold leading-8 tracking-[-0.02em] tabular-nums">{value}</p>
        <p className="text-xs text-ink-3">{label}</p>
      </div>
      {trend ? <Sparkline values={trend} height={28} className="max-w-24" /> : null}
    </div>
  );
}

export const WIDGETS: WidgetDef[] = [
  { id: "leads", title: "New leads", description: "Leads found or captured this period.", category: "Growth", span: 1, render: () => <Big value="128" label="Up 12% vs last 30 days" trend={[8, 10, 9, 12, 14, 13, 17, 19, 18, 22]} /> },
  {
    id: "calls",
    title: "Booked calls",
    description: "Calls booked against your monthly goal.",
    category: "Growth",
    span: 1,
    render: () => (
      <div className="flex items-center gap-4">
        <ProgressRing value={14 / 20} size={56} label="Booked calls goal" />
        <div>
          <p className="text-3xl font-semibold leading-8 tabular-nums">14</p>
          <p className="text-xs text-ink-3">of 20 this month</p>
        </div>
      </div>
    ),
  },
  { id: "reach", title: "Reach", description: "People who saw your posts and ads.", category: "Content", span: 1, render: () => <Big value="18.2k" label="Up 6% vs last 30 days" trend={[12, 11, 13, 14, 13, 15, 16, 15, 17, 18]} /> },
  {
    id: "credits",
    title: "Credits",
    description: "Shared balance and this month’s burn.",
    category: "Account",
    span: 1,
    render: () => (
      <div className="flex flex-col gap-2">
        <p className="text-3xl font-semibold leading-8 tabular-nums">1,840</p>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
          <div className="h-full w-[62%] rounded-full bg-ink" />
        </div>
        <p className="text-xs text-ink-3">1,860 of 3,000 plan credits used · resets 1 Nov</p>
      </div>
    ),
  },
  {
    id: "channels",
    title: "Top channels",
    description: "Where leads came from.",
    category: "Growth",
    span: 2,
    render: () => (
      <BarList
        bare
        title="Top channels"
        valueLabel="Leads"
        items={[
          { label: "Instagram", value: 46, icon: <SocialIcon network="instagram" size="sm" /> },
          { label: "Google Business", value: 38, icon: <SocialIcon network="google" size="sm" /> },
          { label: "Cold email", value: 27, icon: <SocialIcon network="email" size="sm" /> },
          { label: "Facebook", value: 17, icon: <SocialIcon network="facebook" size="sm" /> },
        ]}
      />
    ),
  },
  {
    id: "reviews",
    title: "Reviews",
    description: "Google rating and new reviews.",
    category: "Content",
    span: 1,
    render: () => (
      <div className="flex items-center gap-3">
        <Star aria-hidden className="size-7 fill-sun text-ink" />
        <div>
          <p className="text-3xl font-semibold leading-8 tabular-nums">4.8</p>
          <p className="text-xs text-ink-3">212 reviews · 9 new</p>
        </div>
      </div>
    ),
  },
  { id: "inbox", title: "Inbox", description: "Replies waiting for you.", category: "Content", span: 1, render: () => <Big value="5" label="Unread replies · 2 from leads" /> },
  { id: "posts", title: "Posts published", description: "Posts that went out this period.", category: "Content", span: 1, render: () => <Big value="23" label="On 4 channels" trend={[2, 3, 2, 4, 3, 3, 4, 2]} /> },
];

export const widgetById = (id: string) => WIDGETS.find((w) => w.id === id);

/* ------------------------------------------------------------------ */
/* Board                                                               */
/* ------------------------------------------------------------------ */

export interface BoardItem {
  id: string;
  hidden?: boolean;
}

export interface WidgetBoardProps {
  items: BoardItem[];
  onChange: (items: BoardItem[]) => void;
  onAdd?: () => void;
}

/** Widget grid. Edit mode: drag (or ↑ ↓ buttons) to reorder, eye to hide; hidden ones wait in a tray. */
export function WidgetBoard({ items, onChange, onAdd }: WidgetBoardProps) {
  const [editing, setEditing] = useState(false);
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const visible = items.filter((i) => !i.hidden);
  const hidden = items.filter((i) => i.hidden);

  const move = (id: string, to: number) => {
    const list = items.filter((i) => i.id !== id);
    const target = visible.filter((i) => i.id !== id)[to];
    const at = target ? list.findIndex((i) => i.id === target.id) : list.length;
    const item = items.find((i) => i.id === id);
    if (!item) return;
    list.splice(at, 0, item);
    onChange(list);
    setMsg(`${widgetById(id)?.title} moved to position ${to + 1} of ${visible.length}`);
  };
  const setHidden = (id: string, h: boolean) => {
    onChange(items.map((i) => (i.id === id ? { ...i, hidden: h } : i)));
    setMsg(`${widgetById(id)?.title} ${h ? "hidden" : "shown"}`);
  };
  const onDrop = (e: DragEvent, id: string) => {
    e.preventDefault();
    if (drag && drag !== id) move(drag, visible.findIndex((v) => v.id === id));
    setDrag(null);
    setOver(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-3">{editing ? "Drag widgets, or use the arrows. Hidden widgets stay below." : `${visible.length} widgets`}</p>
        <div className="flex gap-2">
          {onAdd ? (
            <Button size="sm" variant="secondary" onClick={onAdd}>
              <Plus /> Add widget
            </Button>
          ) : null}
          <Button size="sm" variant={editing ? "primary" : "secondary"} onClick={() => setEditing(!editing)} aria-pressed={editing}>
            {editing ? <Check /> : <LayoutGrid />} {editing ? "Done" : "Customize"}
          </Button>
        </div>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Dashboard widgets">
        {visible.map((it, i) => {
          const w = widgetById(it.id);
          if (!w) return null;
          return (
            <li
              key={it.id}
              draggable={editing}
              onDragStart={(e) => {
                setDrag(it.id);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", it.id);
              }}
              onDragOver={(e) => {
                if (!drag) return;
                e.preventDefault();
                setOver(it.id);
              }}
              onDragLeave={() => setOver((o) => (o === it.id ? null : o))}
              onDrop={(e) => onDrop(e, it.id)}
              onDragEnd={() => {
                setDrag(null);
                setOver(null);
              }}
              className={cn(
                "flex flex-col gap-3 rounded-[var(--radius-card)] border bg-surface p-4 shadow-[var(--card-shadow)] transition-[opacity,box-shadow]",
                w.span === 2 && "sm:col-span-2",
                editing ? "cursor-grab border-dashed border-line-strong" : "border-line",
                drag === it.id && "opacity-40",
                over === it.id && drag !== it.id && "ring-2 ring-[var(--focus-ring)]",
              )}
            >
              <div className="flex items-center gap-2">
                {editing ? <GripVertical aria-hidden className="size-4 text-ink-3" /> : null}
                <h4 className="min-w-0 flex-1 truncate text-ui font-medium text-ink-2">{w.title}</h4>
                {editing ? (
                  <span className="flex gap-0.5">
                    <button type="button" aria-label={`Move ${w.title} earlier`} disabled={i === 0} onClick={() => move(it.id, i - 1)} className="grid size-7 place-items-center rounded-[var(--radius-control)] text-ink-3 hover:bg-surface-2 hover:text-ink disabled:opacity-30">
                      <ArrowUp aria-hidden className="size-3.5" />
                    </button>
                    <button type="button" aria-label={`Move ${w.title} later`} disabled={i === visible.length - 1} onClick={() => move(it.id, i + 1)} className="grid size-7 place-items-center rounded-[var(--radius-control)] text-ink-3 hover:bg-surface-2 hover:text-ink disabled:opacity-30">
                      <ArrowDown aria-hidden className="size-3.5" />
                    </button>
                    <button type="button" aria-label={`Hide ${w.title}`} onClick={() => setHidden(it.id, true)} className="grid size-7 place-items-center rounded-[var(--radius-control)] text-ink-3 hover:bg-surface-2 hover:text-ink">
                      <EyeOff aria-hidden className="size-3.5" />
                    </button>
                  </span>
                ) : null}
              </div>
              <div className={cn(editing && "pointer-events-none select-none")}>{w.render()}</div>
            </li>
          );
        })}
      </ul>
      {hidden.length ? (
        <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-card)] border border-dashed border-line-strong px-3 py-2">
          <span className="text-xs text-ink-3">Hidden</span>
          {hidden.map((h) => (
            <button key={h.id} type="button" onClick={() => setHidden(h.id, false)} className="inline-flex h-7 items-center gap-1.5 rounded-[var(--radius-badge)] bg-surface-2 px-2.5 text-xs text-ink-2 hover:bg-surface-3 hover:text-ink">
              <Eye aria-hidden className="size-3.5" /> {widgetById(h.id)?.title}
            </button>
          ))}
        </div>
      ) : null}
      <p aria-live="polite" className="sr-only">
        {msg}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Library                                                             */
/* ------------------------------------------------------------------ */

export interface WidgetLibraryProps {
  installed: string[];
  onAdd: (id: string) => void;
}

/** Catalog of widgets by category with search. Added ones say so. */
export function WidgetLibrary({ installed, onAdd }: WidgetLibraryProps) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<"All" | WidgetDef["category"]>("All");
  const list = WIDGETS.filter((w) => (cat === "All" || w.category === cat) && `${w.title} ${w.description}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-1 basis-48">
          <span className="sr-only">Search widgets</span>
          <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search widgets" className="h-[var(--h-sm)] w-full rounded-[var(--radius-field)] border border-control bg-surface pl-8 pr-2 text-ui placeholder:text-ink-3 focus-visible:border-brand-700 focus-visible:outline-2 focus-visible:outline-brand-600" />
        </label>
        <div role="group" aria-label="Category" className="flex gap-1">
          {(["All", "Growth", "Content", "Account"] as const).map((c) => (
            <button key={c} type="button" aria-pressed={cat === c} onClick={() => setCat(c)} className={cn("h-7 rounded-[var(--radius-badge)] px-2.5 text-xs font-medium", cat === c ? "bg-ink text-white" : "bg-surface-2 text-ink-2 hover:text-ink")}>
              {c}
            </button>
          ))}
        </div>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {list.map((w) => {
          const has = installed.includes(w.id);
          return (
            <li key={w.id} className="flex items-start gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-3">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-ui font-medium text-ink">
                  {w.title}
                  <Badge>{w.category}</Badge>
                </p>
                <p className="text-xs text-ink-3">{w.description}</p>
              </div>
              {has ? (
                <span className="inline-flex h-[var(--h-sm)] items-center gap-1 text-xs font-medium text-green-800">
                  <Check aria-hidden className="size-3.5" /> Added
                </span>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => onAdd(w.id)} aria-label={`Add ${w.title}`}>
                  <Plus /> Add
                </Button>
              )}
            </li>
          );
        })}
        {!list.length ? <li className="col-span-full py-6 text-center text-ui text-ink-3">No widgets match.</li> : null}
      </ul>
    </div>
  );
}

/** Library in a dialog, opened from the board's "Add widget". */
export function WidgetLibraryDialog({ open, onOpenChange, installed, onAdd }: WidgetLibraryProps & { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Add widgets" description="Pick what you want on your dashboard. Rearrange with Customize." className="max-w-2xl">
        <WidgetLibrary installed={installed} onAdd={onAdd} />
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Sharing                                                             */
/* ------------------------------------------------------------------ */

/** Share a dashboard: people, link, and a scheduled email snapshot. */
export function DashboardShare({ people, url }: { people: SharePerson[]; url: string }) {
  const [digest, setDigest] = useState(true);
  const [when, setWhen] = useState("mon");
  return (
    <ShareDialog
      itemName="Tartine Bakery dashboard"
      url={url}
      initialPeople={people}
      trigger={
        <Button variant="secondary">
          <Share2 /> Share dashboard
        </Button>
      }
      extra={
        <section aria-label="Email snapshot" className="flex flex-col gap-2 rounded-[var(--radius-card)] bg-surface-2 p-3">
          <Switch label="Email a snapshot" description="Everyone above gets a PDF of this dashboard." checked={digest} onCheckedChange={setDigest} />
          {digest ? (
            <Select
              aria-label="Snapshot schedule"
              value={when}
              onValueChange={setWhen}
              className="w-56"
              options={[
                { value: "mon", label: "Every Monday, 8:00" },
                { value: "daily", label: "Every weekday, 8:00" },
                { value: "month", label: "1st of the month" },
              ]}
            />
          ) : null}
        </section>
      }
    />
  );
}

/* ------------------------------------------------------------------ */
/* Freshness                                                           */
/* ------------------------------------------------------------------ */

export function relTime(s: number) {
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

/** "Updated 4 min ago", ticking every 15s. Turns amber when older than `staleAfter` seconds. Re-key to reset. */
export function LastUpdated({ secondsAgo, staleAfter = 3600, source, at }: { secondsAgo: number; staleAfter?: number; source?: string; at?: string }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setElapsed((e) => e + 15), 15000);
    return () => window.clearInterval(t);
  }, []);
  const s = secondsAgo + elapsed;
  const stale = s > staleAfter;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", stale ? "font-medium text-amber-800" : "text-ink-3")} title={at}>
      {stale ? <TriangleAlert aria-hidden className="size-3.5" /> : <Clock aria-hidden className="size-3.5" />}
      {source ? `${source} · ` : ""}
      {stale ? `Data may be stale · updated ${relTime(s)}` : `Updated ${relTime(s)}`}
    </span>
  );
}

const SOURCES = ["Instagram", "Facebook", "Google Business", "Google Ads", "Cold email"];

/** Refresh button with live progress: bar, current source, time left. Optional auto-refresh. */
export function RefreshIndicator({ onRefreshed }: { onRefreshed: () => void }) {
  const [step, setStep] = useState(-1);
  const [auto, setAuto] = useState("15");
  const timer = useRef<number | undefined>(undefined);
  const running = step >= 0;
  useEffect(() => () => window.clearInterval(timer.current), []);
  const start = () => {
    if (running) return;
    setStep(0);
    let n = 0;
    timer.current = window.setInterval(() => {
      n += 1;
      if (n >= SOURCES.length) {
        window.clearInterval(timer.current);
        setStep(-1);
        onRefreshed();
      } else setStep(n);
    }, 600);
  };
  const pct = running ? Math.round(((step + 0.5) / SOURCES.length) * 100) : 0;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={start} disabled={running} aria-busy={running || undefined}>
          <RefreshCw className={cn(running && "motion-safe:animate-spin")} /> {running ? "Refreshing…" : "Refresh"}
        </Button>
        <Select
          aria-label="Auto-refresh"
          value={auto}
          onValueChange={setAuto}
          className="h-[var(--h-sm)] w-40"
          options={[
            { value: "off", label: "Auto-refresh off" },
            { value: "5", label: "Every 5 min" },
            { value: "15", label: "Every 15 min" },
          ]}
        />
      </div>
      {running ? (
        <div className="flex flex-col gap-1" role="status">
          <div role="progressbar" aria-label="Refreshing data" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="h-1 w-full max-w-sm overflow-hidden rounded-full bg-surface-3">
            <div className="h-full rounded-full bg-ink transition-[width] duration-500" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-ink-3">
            {SOURCES[step]} ({step + 1} of {SOURCES.length}) · about {Math.max(1, Math.round((SOURCES.length - step) * 0.6))}s left
          </p>
        </div>
      ) : null}
    </div>
  );
}

