"use client";

/*
 * Dashboard panels: WelcomeHeader, DateRangeSelector, KpiOverview,
 * GoalTracking, UpcomingTasks, PendingApprovals, QuickActions,
 * Recommendations, InsightsPanel, AlertsPanel and Announcements.
 * Built on the Signal Panel / Kpi pieces.
 */
import { Popover as RPopover } from "radix-ui";
import { useState, type ReactNode } from "react";
import {
  ArrowRight,
  Check,
  CircleAlert,
  CircleCheck,
  Info,
  Megaphone,
  Plus,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  X,
  type LucideIcon,
} from "@/components/icons";
import { Badge, Button, Checkbox, DatePicker, EmptyState, Kbd, Popover, PopoverContent, Segmented, SocialIcon, Sparkline, Switch, toast } from "@/components/ui";
import { cn, formatNumber, plural } from "@/lib/utils";
import { Kpi, Panel, RANGES } from "@/app/design-system/v2/_kit/signal";

/* ------------------------------------------------------------------ */
/* Welcome header                                                      */
/* ------------------------------------------------------------------ */

export interface WelcomeHeaderProps {
  greeting: string;
  name: string;
  /** One or two sentences in ClimbOS's voice. */
  summary: ReactNode;
  date: string;
  actions?: ReactNode;
}

/** Greeting, today's date and ClimbOS's summary of what changed and what needs you. */
export function WelcomeHeader({ greeting, name, summary, date, actions }: WelcomeHeaderProps) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <p className="text-overline">{date}</p>
        <h2 className="heading-page">
          {greeting}, {name}
        </h2>
        <p className="text-voice mt-1 text-ink-2">{summary}</p>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Date range selector                                                 */
/* ------------------------------------------------------------------ */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmt = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const DAYS: Record<string, number> = { "7d": 7, "30d": 30, "3m": 91, "6m": 182, "1y": 365 };

export interface DateRange {
  preset: string;
  from: string;
  to: string;
  compare: boolean;
}

/** Preset periods, a custom from–to popover, and compare-to-previous. States the exact dates. */
export function DateRangeSelector({ today, value, onChange }: { today: string; value: DateRange; onChange: (r: DateRange) => void }) {
  const [open, setOpen] = useState(false);
  const t = parse(today);
  const setPreset = (p: string) => {
    if (p === "Custom") {
      onChange({ ...value, preset: p });
      setOpen(true);
      return;
    }
    const from = new Date(t);
    from.setDate(t.getDate() - DAYS[p] + 1);
    onChange({ ...value, preset: p, from: iso(from), to: today });
  };
  const f = parse(value.from);
  const to = parse(value.to);
  const span = Math.round((to.getTime() - f.getTime()) / 86400000) + 1;
  const pTo = new Date(f);
  pTo.setDate(f.getDate() - 1);
  const pFrom = new Date(pTo);
  pFrom.setDate(pTo.getDate() - span + 1);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <RPopover.Anchor asChild>
            <span className="inline-flex max-w-full">
              <Segmented label="Date range" value={value.preset} onChange={setPreset} options={RANGES} />
            </span>
          </RPopover.Anchor>
          <PopoverContent className="w-80" align="start">
            <p className="mb-2 text-ui font-medium">Custom range</p>
            <div className="grid grid-cols-2 gap-2">
              <DatePicker aria-label="From" value={value.from} max={value.to} onChange={(v) => onChange({ ...value, preset: "Custom", from: v })} />
              <DatePicker aria-label="To" value={value.to} min={value.from} max={today} onChange={(v) => onChange({ ...value, preset: "Custom", to: v })} />
            </div>
            <Button size="sm" className="mt-3 w-full" onClick={() => setOpen(false)}>
              Apply
            </Button>
          </PopoverContent>
        </Popover>
        <Switch label="Compare" checked={value.compare} onCheckedChange={(c) => onChange({ ...value, compare: c })} showStateText={false} className="gap-2" />
      </div>
      <p className="text-xs text-ink-3" aria-live="polite">
        {fmt(f)} – {fmt(to)} {to.getFullYear()} · {plural(span, "day")}
        {value.compare ? ` · vs ${fmt(pFrom)} – ${fmt(pTo)}` : ""}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* KPI overview                                                        */
/* ------------------------------------------------------------------ */

export interface KpiItem {
  icon: ReactNode;
  value: string;
  label: string;
  delta: string;
  good: boolean;
  values: number[];
}

/** Four headline numbers with change and a mini trend. */
export function KpiOverview({ items }: { items: KpiItem[] }) {
  return (
    <section aria-label="Key numbers" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((k) => (
        <Kpi key={k.label} {...k} />
      ))}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Goals                                                               */
/* ------------------------------------------------------------------ */

export interface Goal {
  id: string;
  label: string;
  current: number;
  target: number;
  /** 0–1 share of the period gone, for the pace tick. */
  elapsed: number;
  unit?: string;
  due: string;
}

/** Goals with progress, an expected-pace tick and a written verdict (on track / behind / done). */
export function GoalTracking({ goals }: { goals: Goal[] }) {
  return (
    <Panel title="Goals" sub="This month" actions={<Button size="sm" variant="ghost"><Plus /> Add goal</Button>}>
      <ul className="mt-4 flex flex-col gap-4">
        {goals.map((g) => {
          const pct = Math.min(1, g.current / g.target);
          const done = g.current >= g.target;
          const onTrack = pct >= g.elapsed * 0.95;
          const verdict = done ? { t: "Done", tone: "green" as const } : onTrack ? { t: "On track", tone: "green" as const } : { t: "Behind", tone: "amber" as const };
          return (
            <li key={g.id} className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="flex items-center gap-2 text-ui font-medium text-ink">
                  <Target aria-hidden className="size-4 text-ink-3" />
                  {g.label}
                </span>
                <span className="flex items-center gap-2 text-ui tabular-nums text-ink-2">
                  {formatNumber(g.current)} / {formatNumber(g.target)}
                  {g.unit ? ` ${g.unit}` : ""}
                  <Badge tone={verdict.tone}>{verdict.t}</Badge>
                </span>
              </div>
              <div className="relative">
                <div role="progressbar" aria-label={g.label} aria-valuemin={0} aria-valuemax={g.target} aria-valuenow={g.current} className="h-2 overflow-hidden rounded-full bg-surface-3">
                  <div className={cn("h-full rounded-full", done ? "bg-lime" : onTrack ? "bg-ink" : "bg-amber-500")} style={{ width: `${pct * 100}%` }} />
                </div>
                {!done ? <span aria-hidden title="Expected by today" className="absolute -top-0.5 h-3 w-0.5 rounded-full bg-ink-3" style={{ left: `${g.elapsed * 100}%` }} /> : null}
              </div>
              <span className="text-xs text-ink-3">
                {done ? "Hit early." : onTrack ? `Due ${g.due}.` : `Due ${g.due}. Needs ${formatNumber(Math.ceil(g.target * g.elapsed - g.current))} more to be on pace.`}
              </span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Tasks                                                               */
/* ------------------------------------------------------------------ */

export interface Task {
  id: string;
  label: string;
  due: string;
  overdue?: boolean;
  done?: boolean;
}

/** Checklist of what's next. Done items sink and strike through; add inline. */
export function UpcomingTasks({ tasks, onChange }: { tasks: Task[]; onChange: (t: Task[]) => void }) {
  const [draft, setDraft] = useState("");
  const sorted = [...tasks].sort((a, b) => Number(!!a.done) - Number(!!b.done));
  const open = tasks.filter((t) => !t.done).length;
  return (
    <Panel title="Upcoming tasks" sub={`${open} open`}>
      <ul className="mt-3 flex flex-col">
        {sorted.map((t) => (
          <li key={t.id} className="flex items-center gap-2 border-t border-line first:border-t-0">
            <Checkbox
              checked={!!t.done}
              onCheckedChange={(c) => onChange(tasks.map((x) => (x.id === t.id ? { ...x, done: c === true } : x)))}
              label={<span className={cn(t.done && "text-ink-3 line-through")}>{t.label}</span>}
              className="min-w-0 flex-1"
            />
            <span className={cn("shrink-0 text-xs tabular-nums", t.overdue && !t.done ? "font-medium text-red-800" : "text-ink-3")}>{t.overdue && !t.done ? `Overdue · ${t.due}` : t.due}</span>
          </li>
        ))}
      </ul>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          onChange([...tasks, { id: `t${tasks.length + 1}-${draft.length}`, label: draft.trim(), due: "No date" }]);
          setDraft("");
        }}
      >
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a task" aria-label="New task" className="h-[var(--h-sm)] min-w-0 flex-1 rounded-[var(--radius-field)] border border-control bg-surface px-2.5 text-ui placeholder:text-ink-3 focus-visible:border-brand-700 focus-visible:outline-2 focus-visible:outline-brand-600" />
        <Button size="sm" variant="secondary" type="submit" disabled={!draft.trim()}>
          Add
        </Button>
      </form>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Approvals                                                           */
/* ------------------------------------------------------------------ */

export interface Approval {
  id: string;
  network: string;
  title: string;
  when: string;
  credits: number;
  by: string;
}

/** Work waiting for a yes. Approve one or all; reject is undoable from the toast. */
export function PendingApprovals({ items, onChange }: { items: Approval[]; onChange: (a: Approval[]) => void }) {
  const decide = (a: Approval, ok: boolean) => {
    onChange(items.filter((x) => x.id !== a.id));
    toast({ title: ok ? `Approved: ${a.title}` : `Sent back: ${a.title}`, description: ok ? `Publishes ${a.when}` : "The author gets your note.", tone: ok ? "success" : "info" });
  };
  return (
    <Panel
      title="Pending approvals"
      sub={items.length ? `${plural(items.length, "item")} waiting for you` : "Nothing waiting"}
      actions={
        items.length > 1 ? (
          <Button
            size="sm"
            onClick={() => {
              onChange([]);
              toast({ title: `Approved ${plural(items.length, "item")}`, tone: "success" });
            }}
          >
            <Check /> Approve all
          </Button>
        ) : null
      }
    >
      {items.length ? (
        <ul className="mt-3 flex flex-col">
          {items.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 border-t border-line py-3 first:border-t-0">
              <SocialIcon network={a.network} variant="tile" size="sm" />
              <div className="min-w-0 flex-1 basis-40">
                <p className="truncate text-ui font-medium text-ink">{a.title}</p>
                <p className="text-xs text-ink-3">
                  {a.when} · {a.by} · {a.credits} credits
                </p>
              </div>
              <div className="flex gap-1.5">
                <Button size="sm" variant="ghost" onClick={() => decide(a, false)}>
                  Reject
                </Button>
                <Button size="sm" onClick={() => decide(a, true)}>
                  Approve
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState className="mt-3 border-0 py-6" icon={<CircleCheck />} title="All caught up" body="New drafts land here when autopilot needs a yes." />
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Quick actions                                                       */
/* ------------------------------------------------------------------ */

export interface QuickAction {
  id: string;
  label: string;
  Icon: LucideIcon;
  shortcut?: string;
  onRun: () => void;
}

/** Shortcut tiles for the few things people start from the dashboard. */
export function QuickActions({ actions }: { actions: QuickAction[] }) {
  return (
    <nav aria-label="Quick actions" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {actions.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={a.onRun}
          aria-keyshortcuts={a.shortcut}
          className="group flex flex-col items-start gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-3.5 text-left shadow-[var(--card-shadow)] transition-colors hover:border-line-strong hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
        >
          <span className="flex w-full items-center justify-between">
            <span className="grid size-8 place-items-center rounded-[var(--radius-control)] bg-surface-2 text-ink group-hover:bg-surface">
              <a.Icon aria-hidden className="size-4" />
            </span>
            {a.shortcut ? <Kbd>{a.shortcut}</Kbd> : null}
          </span>
          <span className="text-ui font-medium text-ink">{a.label}</span>
        </button>
      ))}
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* Recommendations                                                     */
/* ------------------------------------------------------------------ */

export interface Recommendation {
  id: string;
  title: string;
  why: string;
  impact: string;
  credits: number;
}

/** ClimbOS's next best plays: why (in its voice), expected impact, credit cost, add or skip. */
export function Recommendations({ items }: { items: Recommendation[] }) {
  const [state, setState] = useState<Record<string, "added" | "skipped">>({});
  const live = items.filter((r) => state[r.id] !== "skipped");
  return (
    <Panel title="Recommended next" sub="From this week’s results" actions={<Badge tone="neutral" icon={<Sparkles />}>Expert</Badge>}>
      <ul className="mt-3 grid gap-3 md:grid-cols-2">
        {live.map((r) => {
          const added = state[r.id] === "added";
          return (
            <li key={r.id} className={cn("flex flex-col gap-2 rounded-[var(--radius-card)] border p-4", added ? "border-green-500/40 bg-green-100/30" : "border-line bg-surface-2/50")}>
              <p className="heading-card">{r.title}</p>
              <p className="text-voice text-ink-2">{r.why}</p>
              <p className="flex flex-wrap gap-x-3 text-xs text-ink-3">
                <span className="flex items-center gap-1">
                  <TrendingUp aria-hidden className="size-3.5" /> {r.impact}
                </span>
                <span>{r.credits} credits</span>
              </p>
              <div className="mt-1 flex gap-2">
                {added ? (
                  <Badge tone="green" icon={<Check />}>
                    Added to plan
                  </Badge>
                ) : (
                  <>
                    <Button size="sm" onClick={() => setState({ ...state, [r.id]: "added" })}>
                      Add to plan
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setState({ ...state, [r.id]: "skipped" })}>
                      Not now
                    </Button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {live.length < items.length ? (
        <Button size="sm" variant="link" className="mt-3" onClick={() => setState(Object.fromEntries(Object.entries(state).filter(([, v]) => v !== "skipped")))}>
          Show {items.length - live.length} skipped
        </Button>
      ) : null}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Insights                                                            */
/* ------------------------------------------------------------------ */

export interface Insight {
  id: string;
  text: string;
  kind: "working" | "not";
  trend: number[];
  metric: string;
}

/** What's working and what isn't, in plain sentences with a mini trend. */
export function InsightsPanel({ insights }: { insights: Insight[] }) {
  const [tab, setTab] = useState<"working" | "not">("working");
  const shown = insights.filter((i) => i.kind === tab);
  return (
    <Panel
      title="Insights"
      sub="Updated this morning"
      actions={<Segmented label="Insight type" value={tab} onChange={setTab} options={[{ value: "working", label: "Working" }, { value: "not", label: "Not working" }]} />}
    >
      <ul className="mt-3 flex flex-col">
        {shown.map((i) => (
          <li key={i.id} className="flex items-center gap-4 border-t border-line py-3 first:border-t-0">
            {i.kind === "working" ? <TrendingUp aria-hidden className="size-4 shrink-0 text-green-800" /> : <TrendingDown aria-hidden className="size-4 shrink-0 text-red-800" />}
            <p className="text-voice min-w-0 flex-1">{i.text}</p>
            <div className="hidden w-24 shrink-0 flex-col items-end sm:flex">
              <Sparkline values={i.trend} height={24} color={i.kind === "working" ? "var(--chart-1)" : "var(--red-500)"} />
              <span className="text-2xs tabular-nums text-ink-3">{i.metric}</span>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Alerts                                                              */
/* ------------------------------------------------------------------ */

export interface DashAlert {
  id: string;
  level: "critical" | "warning" | "info";
  title: string;
  body: string;
  time: string;
  action?: string;
}

const LEVEL: Record<DashAlert["level"], { Icon: LucideIcon; cls: string; word: string }> = {
  critical: { Icon: CircleAlert, cls: "text-red-800", word: "Critical" },
  warning: { Icon: TriangleAlert, cls: "text-amber-800", word: "Warning" },
  info: { Icon: Info, cls: "text-blue-800", word: "Info" },
};

/** Things that broke or need attention, most severe first. Dismissible; filter to action-needed. */
export function AlertsPanel({ alerts, onChange }: { alerts: DashAlert[]; onChange: (a: DashAlert[]) => void }) {
  const [onlyAction, setOnlyAction] = useState(false);
  const order = { critical: 0, warning: 1, info: 2 };
  const shown = [...alerts].filter((a) => !onlyAction || a.action).sort((a, b) => order[a.level] - order[b.level]);
  return (
    <Panel
      title="Alerts"
      sub={`${alerts.filter((a) => a.level === "critical").length} critical`}
      actions={<Switch label="Needs action" checked={onlyAction} onCheckedChange={setOnlyAction} showStateText={false} className="gap-2" />}
    >
      {shown.length ? (
        <ul className="mt-3 flex flex-col">
          {shown.map((a) => {
            const L = LEVEL[a.level];
            return (
              <li key={a.id} className="flex items-start gap-3 border-t border-line py-3 first:border-t-0">
                <L.Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", L.cls)} />
                <div className="min-w-0 flex-1">
                  <p className="text-ui font-medium text-ink">
                    <span className="sr-only">{L.word}: </span>
                    {a.title}
                  </p>
                  <p className="text-xs text-ink-3">
                    {a.body} · {a.time}
                  </p>
                  {a.action ? (
                    <Button size="sm" variant="secondary" className="mt-2">
                      {a.action}
                    </Button>
                  ) : null}
                </div>
                <button type="button" aria-label={`Dismiss ${a.title}`} onClick={() => onChange(alerts.filter((x) => x.id !== a.id))} className="grid size-7 shrink-0 place-items-center rounded-[var(--radius-control)] text-ink-3 hover:bg-surface-2 hover:text-ink">
                  <X aria-hidden className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 flex items-center gap-2 text-ui text-ink-3">
          <CircleCheck aria-hidden className="size-4 text-green-800" /> No alerts.
        </p>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Announcements                                                       */
/* ------------------------------------------------------------------ */

export interface Announcement {
  id: string;
  title: string;
  body: string;
  date: string;
  unread?: boolean;
  cta?: string;
}

/** Product news: a featured card you can dismiss, then a short list with unread dots. */
export function Announcements({ items, onChange }: { items: Announcement[]; onChange: (a: Announcement[]) => void }) {
  const [featured, ...rest] = items;
  const unread = items.filter((a) => a.unread).length;
  return (
    <div className="flex flex-col gap-3">
      {featured ? (
        <section className="relative flex flex-col gap-2 rounded-[var(--radius-card)] bg-cream p-[var(--card-p)]">
          <p className="text-overline flex items-center gap-1.5">
            <Megaphone aria-hidden className="size-3.5" /> New · {featured.date}
          </p>
          <h3 className="heading-card pr-8">{featured.title}</h3>
          <p className="max-w-xl text-ui text-ink-2">{featured.body}</p>
          {featured.cta ? (
            <Button size="sm" className="mt-1 self-start">
              {featured.cta} <ArrowRight />
            </Button>
          ) : null}
          <button type="button" aria-label="Dismiss announcement" onClick={() => onChange(rest)} className="absolute right-2 top-2 grid size-8 place-items-center rounded-[var(--radius-control)] text-ink-2 hover:bg-black/5">
            <X aria-hidden className="size-4" />
          </button>
        </section>
      ) : null}
      {rest.length ? (
        <Panel title="What’s new" sub={unread ? `${unread} unread` : "All read"} actions={unread ? <Button size="sm" variant="ghost" onClick={() => onChange(items.map((a) => ({ ...a, unread: false })))}>Mark all read</Button> : null}>
          <ul className="mt-2 flex flex-col">
            {rest.map((a) => (
              <li key={a.id}>
                <button type="button" onClick={() => onChange(items.map((x) => (x.id === a.id ? { ...x, unread: false } : x)))} className="flex w-full items-start gap-3 border-t border-line py-2.5 text-left hover:bg-surface-2/60">
                  <span aria-hidden className={cn("mt-1.5 size-2 shrink-0 rounded-full", a.unread ? "bg-ink" : "bg-transparent")} />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-ui", a.unread ? "font-semibold text-ink" : "text-ink-2")}>
                      {a.title}
                      {a.unread ? <span className="sr-only"> (unread)</span> : null}
                    </span>
                    <span className="block text-xs text-ink-3">{a.date}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
