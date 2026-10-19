"use client";

/*
 * Signal cards. Every card is a white panel (Card primitive): hairline border,
 * 5px corners, soft card shadow, density-aware padding. Titles use the card
 * heading (Reckless); everything else is Hanken.
 */
import { useId, useRef, useState, type DragEvent, type KeyboardEvent, type ReactNode } from "react";
import { ArrowRight, Bell, Check, ChevronDown, ChevronLeft, ChevronRight, Clock, GripVertical, X } from "@/components/icons";
import { Avatar, Badge, Button, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, EmptyState, IconButton, type Tone } from "@/components/ui";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

/** Square icon tile used at the top of cards. */
export function CardIcon({ children, tone = "plain", className }: { children: ReactNode; tone?: "plain" | "lime" | "ink"; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-[var(--radius-control)] [&_svg]:size-4",
        tone === "lime" ? "bg-lime text-ink" : tone === "ink" ? "bg-ink text-white" : "border border-line bg-surface text-ink-2 shadow-[var(--card-shadow)]",
        className,
      )}
    >
      {children}
    </span>
  );
}

const focusRing = "outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-1";

/* ------------------------------------------------------------------ */
/* Standard content card                                               */
/* ------------------------------------------------------------------ */

export interface ContentCardProps {
  eyebrow?: string;
  title: string;
  children: ReactNode;
  media?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** Title, short body and an optional single action. The default card. */
export function ContentCard({ eyebrow, title, children, media, action, className }: ContentCardProps) {
  return (
    <Card className={cn("flex flex-col overflow-hidden", className)}>
      {media ? <div className="border-b border-line">{media}</div> : null}
      <CardContent className="flex flex-1 flex-col gap-2">
        {eyebrow ? <p className="text-overline">{eyebrow}</p> : null}
        <CardTitle>{title}</CardTitle>
        <div className="text-sm text-ink-2">{children}</div>
        {action ? <div className="mt-auto pt-2">{action}</div> : null}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Summary card                                                        */
/* ------------------------------------------------------------------ */

export interface SummaryCardProps {
  title: string;
  sub?: string;
  items: { label: string; value: string; note?: string }[];
  /** 0–1 progress toward a goal, shown as a bar under the stats. */
  progress?: { label: string; value: number };
  footer?: ReactNode;
  className?: string;
}

/** A handful of related numbers with one line of context. */
export function SummaryCard({ title, sub, items, progress, footer, className }: SummaryCardProps) {
  const pct = progress ? Math.round(Math.max(0, Math.min(1, progress.value)) * 100) : 0;
  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {sub ? <CardDescription>{sub}</CardDescription> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          {items.map((it) => (
            <div key={it.label} className="flex flex-col gap-0.5">
              <dt className="text-xs text-ink-3">{it.label}</dt>
              <dd className="text-xl font-semibold tabular-nums tracking-[-0.01em]">{it.value}</dd>
              {it.note ? <dd className="text-2xs text-ink-3">{it.note}</dd> : null}
            </div>
          ))}
        </dl>
        {progress ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs text-ink-2">
              <span>{progress.label}</span>
              <span className="tabular-nums">{pct}%</span>
            </div>
            <div role="progressbar" aria-label={progress.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="h-1.5 overflow-hidden rounded-full bg-surface-3">
              <div className="h-full bg-ink" style={{ width: `${pct}%` }} />
            </div>
          </div>
        ) : null}
      </CardContent>
      {footer ? <CardFooter className="mt-auto">{footer}</CardFooter> : null}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Activity card                                                       */
/* ------------------------------------------------------------------ */

export interface ActivityItem {
  id: string;
  who: string;
  what: ReactNode;
  when: string;
  icon?: ReactNode;
}

/** Compact recent-activity list inside a card. */
export function ActivityCard({ title = "Recent activity", items, action, className }: { title?: string; items: ActivityItem[]; action?: ReactNode; className?: string }) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col">
          {items.map((it, i) => (
            <li key={it.id} className="relative flex gap-3 pb-4 last:pb-0">
              {i < items.length - 1 ? <span aria-hidden="true" className="absolute left-3 top-7 h-[calc(100%-1.75rem)] w-px bg-line-strong" /> : null}
              {it.icon ? (
                <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-2 [&_svg]:size-3.5">
                  {it.icon}
                </span>
              ) : (
                <Avatar name={it.who} size="sm" />
              )}
              <div className="min-w-0 flex-1 text-ui">
                <p className="text-ink-2">
                  <span className="font-medium text-ink">{it.who}</span> {it.what}
                </p>
                <p className="text-xs text-ink-3">{it.when}</p>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Profile card                                                        */
/* ------------------------------------------------------------------ */

export interface ProfileCardProps {
  name: string;
  role: string;
  meta?: string;
  stats?: { label: string; value: string }[];
  actions?: ReactNode;
  online?: boolean;
  className?: string;
}

/** A person: avatar, role, a few numbers and actions. */
export function ProfileCard({ name, role, meta, stats, actions, online, className }: ProfileCardProps) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="relative">
            <Avatar name={name} size="lg" />
            {online !== undefined ? (
              <span className={cn("absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-surface", online ? "bg-green-500" : "bg-surface-3")} aria-hidden="true" />
            ) : null}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{name}</p>
            <p className="truncate text-ui text-ink-3">
              {role}
              {online !== undefined ? <span className="sr-only">{online ? ", online" : ", offline"}</span> : null}
            </p>
          </div>
        </div>
        {meta ? <p className="text-ui text-ink-2">{meta}</p> : null}
        {stats ? (
          <dl className="grid grid-cols-3 divide-x divide-line rounded-[var(--radius-control)] bg-surface-2 py-2 text-center">
            {stats.map((s) => (
              <div key={s.label} className="flex flex-col-reverse">
                <dt className="text-2xs text-ink-3">{s.label}</dt>
                <dd className="text-sm font-semibold tabular-nums">{s.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {actions ? <div className="flex gap-2 [&>*]:flex-1">{actions}</div> : null}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Project card                                                        */
/* ------------------------------------------------------------------ */

export interface ProjectCardProps {
  name: string;
  description?: string;
  status: { label: string; tone: Tone };
  progress: number;
  due: string;
  people: string[];
  className?: string;
  onOpen?: () => void;
}

/** A campaign or project: status, progress, owners and due date. */
export function ProjectCard({ name, description, status, progress, due, people, className, onOpen }: ProjectCardProps) {
  const pct = Math.round(Math.max(0, Math.min(1, progress)) * 100);
  return (
    <Card className={cn("group relative flex flex-col transition-shadow hover:shadow-[var(--shadow)]", className)}>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="heading-card">
            <button type="button" onClick={onOpen} className={cn("text-left after:absolute after:inset-0 after:rounded-[var(--radius-card)]", focusRing)}>
              {name}
            </button>
          </h3>
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
        {description ? <p className="line-clamp-2 text-ui text-ink-2">{description}</p> : null}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-xs text-ink-3">
            <span>Progress</span>
            <span className="tabular-nums text-ink-2">{pct}%</span>
          </div>
          <div role="progressbar" aria-label={`${name} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="h-1.5 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full bg-brand-700" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="flex items-center justify-between pt-1">
          <span className="flex -space-x-1.5" aria-label={`Owners: ${people.join(", ")}`} role="img">
            {people.slice(0, 3).map((p) => (
              <Avatar key={p} name={p} size="sm" className="ring-2 ring-surface" />
            ))}
            {people.length > 3 ? <span className="grid size-6 place-items-center rounded-full bg-surface-2 text-2xs font-medium ring-2 ring-surface">+{people.length - 3}</span> : null}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-ink-3">
            <Clock aria-hidden="true" className="size-3.5" /> {due}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Task card                                                           */
/* ------------------------------------------------------------------ */

export interface TaskCardProps {
  title: string;
  due?: string;
  assignee?: string;
  priority?: "low" | "medium" | "high";
  done: boolean;
  onDoneChange: (done: boolean) => void;
  tags?: string[];
  className?: string;
}

const PRIORITY: Record<NonNullable<TaskCardProps["priority"]>, { label: string; tone: Tone }> = {
  low: { label: "Low", tone: "neutral" },
  medium: { label: "Medium", tone: "amber" },
  high: { label: "High", tone: "red" },
};

/** One to-do with a completion checkbox. */
export function TaskCard({ title, due, assignee, priority, done, onDoneChange, tags, className }: TaskCardProps) {
  const id = useId();
  return (
    <Card className={cn("flex items-start gap-3 p-[var(--card-p)] py-3", done && "bg-surface-2", className)}>
      <input
        id={id}
        type="checkbox"
        checked={done}
        onChange={(e) => onDoneChange(e.target.checked)}
        className="peer sr-only"
      />
      <label
        htmlFor={id}
        className="mt-0.5 grid size-5 shrink-0 cursor-pointer place-items-center rounded-full border-[1.5px] border-control text-white transition-colors hover:border-brand-700 peer-checked:border-brand-800 peer-checked:bg-brand-800 peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--focus-ring)] peer-focus-visible:ring-offset-1"
      >
        <Check aria-hidden="true" className={cn("size-3", !done && "invisible")} strokeWidth={3} />
        <span className="sr-only">Mark “{title}” done</span>
      </label>
      <div className="min-w-0 flex-1">
        <p className={cn("text-ui font-medium", done && "text-ink-3 line-through")}>{title}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {priority ? <Badge tone={PRIORITY[priority].tone}>{PRIORITY[priority].label}</Badge> : null}
          {tags?.map((t) => (
            <Badge key={t}>{t}</Badge>
          ))}
          {due ? (
            <span className="inline-flex items-center gap-1 text-xs text-ink-3">
              <Clock aria-hidden="true" className="size-3" /> {due}
            </span>
          ) : null}
        </div>
      </div>
      {assignee ? <Avatar name={assignee} size="sm" /> : null}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Pricing card                                                        */
/* ------------------------------------------------------------------ */

export interface PricingCardProps {
  name: string;
  price: string;
  period?: string;
  blurb: string;
  features: string[];
  cta: string;
  featured?: boolean;
  current?: boolean;
  onSelect?: () => void;
  className?: string;
}

/** One plan. `featured` gets the ink frame and the lime CTA (one per screen). */
export function PricingCard({ name, price, period = "/ month", blurb, features, cta, featured, current, onSelect, className }: PricingCardProps) {
  return (
    <Card className={cn("relative flex flex-col", featured && "border-ink ring-1 ring-ink", className)}>
      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{name}</h3>
          {featured ? <Badge tone="brand">Most popular</Badge> : null}
          {current ? <Badge tone="green">Current plan</Badge> : null}
        </div>
        <p className="flex items-baseline gap-1">
          <span className="text-[32px] font-semibold leading-none tracking-[-0.02em] tabular-nums">{price}</span>
          <span className="text-ui text-ink-3">{period}</span>
        </p>
        <p className="text-ui text-ink-2">{blurb}</p>
        <ul className="flex flex-col gap-2 text-ui">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2">
              <Check aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-brand-800" strokeWidth={2.5} />
              {f}
            </li>
          ))}
        </ul>
        <div className="mt-auto pt-2">
          {featured ? (
            <button
              type="button"
              onClick={onSelect}
              className={cn("inline-flex h-[var(--h-lg)] w-full items-center justify-center gap-1 rounded-[var(--radius-cta)] bg-lime text-sm font-medium text-ink hover:brightness-95", focusRing)}
            >
              {cta} <ArrowRight aria-hidden="true" className="size-4" />
            </button>
          ) : (
            <Button variant="secondary" size="lg" className="w-full" onClick={onSelect} disabled={current}>
              {current ? "Your plan" : cta}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Integration card                                                    */
/* ------------------------------------------------------------------ */

export interface IntegrationCardProps {
  logo: ReactNode;
  name: string;
  description: string;
  connected: boolean;
  onToggle: () => void;
  meta?: string;
  className?: string;
}

/** A third-party connection with a connect / disconnect action. */
export function IntegrationCard({ logo, name, description, connected, onToggle, meta, className }: IntegrationCardProps) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <CardContent className="flex flex-1 flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <span className="grid size-10 place-items-center rounded-[var(--radius-control)] border border-line bg-surface shadow-[var(--card-shadow)]">{logo}</span>
          {connected ? (
            <Badge tone="green" icon={<Check />}>
              Connected
            </Badge>
          ) : null}
        </div>
        <div>
          <h3 className="text-sm font-semibold">{name}</h3>
          <p className="mt-0.5 text-ui text-ink-2">{description}</p>
        </div>
        {meta ? <p className="text-xs text-ink-3">{meta}</p> : null}
      </CardContent>
      <CardFooter className="justify-between">
        <span className="text-xs text-ink-3">{connected ? "Syncing hourly" : "Not connected"}</span>
        <Button size="sm" variant={connected ? "ghost" : "primary"} onClick={onToggle} aria-label={`${connected ? "Disconnect" : "Connect"} ${name}`}>
          {connected ? "Disconnect" : "Connect"}
        </Button>
      </CardFooter>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Feature card                                                        */
/* ------------------------------------------------------------------ */

/** Marketing / onboarding feature: icon, title, one sentence. `tone="cream"` for the feature surface. */
export function FeatureCard({ icon, title, children, tone = "white", className }: { icon: ReactNode; title: string; children: ReactNode; tone?: "white" | "cream"; className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-[var(--radius-card)] p-[var(--card-p)]",
        tone === "cream" ? "bg-cream" : "border border-line bg-surface shadow-[var(--card-shadow)]",
        className,
      )}
    >
      <CardIcon tone={tone === "cream" ? "ink" : "plain"}>{icon}</CardIcon>
      <h3 className="heading-card">{title}</h3>
      <p className="text-ui text-ink-2">{children}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Notification card                                                   */
/* ------------------------------------------------------------------ */

export interface NotificationCardProps {
  title: string;
  body: string;
  time: string;
  unread?: boolean;
  icon?: ReactNode;
  action?: ReactNode;
  onDismiss?: () => void;
  className?: string;
}

/** One notification: unread marker, body, time, optional action and dismiss. */
export function NotificationCard({ title, body, time, unread, icon, action, onDismiss, className }: NotificationCardProps) {
  return (
    <Card className={cn("relative flex gap-3 p-[var(--card-p)] py-3.5", unread && "bg-brand-50", className)}>
      <CardIcon>{icon ?? <Bell />}</CardIcon>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 pr-6 text-ui font-semibold">
          {unread ? (
            <>
              <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-brand-800" />
              <span className="sr-only">Unread: </span>
            </>
          ) : null}
          {title}
        </p>
        <p className="mt-0.5 text-ui text-ink-2">{body}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className="text-xs text-ink-3">{time}</span>
          {action}
        </div>
      </div>
      {onDismiss ? (
        <IconButton aria-label={`Dismiss: ${title}`} icon={<X />} size="sm" className="absolute right-2 top-2" onClick={onDismiss} tooltip={false} />
      ) : null}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Status card                                                         */
/* ------------------------------------------------------------------ */

export type ServiceState = "operational" | "degraded" | "down" | "paused";

const SERVICE: Record<ServiceState, { label: string; dot: string; tone: Tone }> = {
  operational: { label: "Operational", dot: "bg-green-500", tone: "green" },
  degraded: { label: "Degraded", dot: "bg-amber-500", tone: "amber" },
  down: { label: "Down", dot: "bg-red-500", tone: "red" },
  paused: { label: "Paused", dot: "bg-surface-3 ring-1 ring-line-strong", tone: "neutral" },
};

/** Health of a channel or system: state, last check and a 30-day strip. */
export function StatusCard({ name, state, checked, history, className }: { name: string; state: ServiceState; checked: string; history: ServiceState[]; className?: string }) {
  const s = SERVICE[state];
  const up = history.filter((h) => h === "operational").length;
  return (
    <Card className={cn("flex flex-col gap-3 p-[var(--card-p)]", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-ui font-semibold">
          <span aria-hidden="true" className={cn("size-2 rounded-full", s.dot)} />
          {name}
        </p>
        <Badge tone={s.tone}>{s.label}</Badge>
      </div>
      <div className="flex h-6 gap-[2px]" role="img" aria-label={`${up} of ${history.length} days operational`}>
        {history.map((h, i) => (
          <span key={i} className={cn("flex-1 rounded-[1px]", SERVICE[h].dot)} />
        ))}
      </div>
      <div className="flex justify-between text-xs text-ink-3">
        <span>{history.length} days ago</span>
        <span>Checked {checked}</span>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Empty-state card                                                    */
/* ------------------------------------------------------------------ */

/** EmptyState primitive framed as a card slot (dashed). */
export function EmptyStateCard(props: { icon?: ReactNode; title: string; body?: string; action?: ReactNode; className?: string }) {
  return <EmptyState {...props} className={cn("rounded-[var(--radius-card)] py-8", props.className)} />;
}

/* ------------------------------------------------------------------ */
/* Expandable card                                                     */
/* ------------------------------------------------------------------ */

/** Summary always visible; details open below. */
export function ExpandableCard({ title, summary, children, defaultOpen = false, className }: { title: string; summary?: ReactNode; children: ReactNode; defaultOpen?: boolean; className?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <Card className={cn("overflow-hidden", className)}>
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((o) => !o)}
          className={cn("flex w-full items-center gap-3 p-[var(--card-p)] text-left hover:bg-surface-2", focusRing, "focus-visible:ring-inset focus-visible:ring-offset-0")}
        >
          <span className="min-w-0 flex-1">
            <span className="heading-card block">{title}</span>
            {summary ? <span className="mt-0.5 block text-ui text-ink-3">{summary}</span> : null}
          </span>
          <ChevronDown aria-hidden="true" className={cn("size-4 shrink-0 text-ink-3 transition-transform motion-reduce:transition-none", open && "rotate-180")} />
        </button>
      </h3>
      <div id={id} hidden={!open} className="border-t border-line p-[var(--card-p)] text-ui text-ink-2">
        {children}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Selectable cards                                                    */
/* ------------------------------------------------------------------ */

export interface SelectableOption {
  value: string;
  title: string;
  description?: string;
  icon?: ReactNode;
}

/** Card-sized checkboxes (multiple) or radios (single). Real inputs underneath. */
export function SelectableCards({
  legend,
  options,
  value,
  onChange,
  multiple = true,
  columns = 3,
  className,
}: {
  legend: string;
  options: SelectableOption[];
  value: string[];
  onChange: (v: string[]) => void;
  multiple?: boolean;
  columns?: 2 | 3 | 4;
  className?: string;
}) {
  const name = useId();
  const cols = columns === 2 ? "sm:grid-cols-2" : columns === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3";
  return (
    <fieldset className={className}>
      <legend className="mb-2 text-ui font-medium">{legend}</legend>
      <div className={cn("grid gap-3", cols)}>
        {options.map((o) => {
          const checked = value.includes(o.value);
          return (
            <label
              key={o.value}
              className={cn(
                "relative flex cursor-pointer gap-3 rounded-[var(--radius-card)] border bg-surface p-[var(--card-p)] py-4 shadow-[var(--card-shadow)] transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--focus-ring)]",
                checked ? "border-ink ring-1 ring-ink" : "border-line hover:border-line-strong",
              )}
            >
              <input
                type={multiple ? "checkbox" : "radio"}
                name={name}
                value={o.value}
                checked={checked}
                onChange={(e) => {
                  if (!multiple) onChange([o.value]);
                  else onChange(e.target.checked ? [...value, o.value] : value.filter((v) => v !== o.value));
                }}
                className="sr-only"
              />
              {o.icon ? <CardIcon tone={checked ? "ink" : "plain"}>{o.icon}</CardIcon> : null}
              <span className="min-w-0 flex-1 pr-5">
                <span className="block text-ui font-semibold">{o.title}</span>
                {o.description ? <span className="mt-0.5 block text-xs text-ink-3">{o.description}</span> : null}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "absolute right-3 top-3 grid size-4 place-items-center border-[1.5px] text-white",
                  multiple ? "rounded-[3px]" : "rounded-full",
                  checked ? "border-ink bg-ink" : "border-control",
                )}
              >
                {checked ? <Check className="size-2.5" strokeWidth={3} /> : null}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/* ------------------------------------------------------------------ */
/* Draggable cards                                                     */
/* ------------------------------------------------------------------ */

export interface DraggableItem {
  id: string;
  title: string;
  meta?: string;
}

/**
 * Reorderable stack of cards. Drag by the handle (HTML5 drag and drop) or focus
 * the handle and use ↑ / ↓. Changes are announced.
 */
export function DraggableCardList({ items, onReorder, label, className }: { items: DraggableItem[]; onReorder: (items: DraggableItem[]) => void; label: string; className?: string }) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const handles = useRef(new Map<string, HTMLButtonElement>());

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    onReorder(next);
    setAnnounce(`${it.title} moved to position ${to + 1} of ${items.length}`);
    return it.id;
  };

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const to = e.key === "ArrowUp" ? i - 1 : e.key === "ArrowDown" ? i + 1 : null;
    if (to === null) return;
    e.preventDefault();
    const id = move(i, to);
    if (id) requestAnimationFrame(() => handles.current.get(id)?.focus());
  };

  const onDrop = (e: DragEvent, targetId: string) => {
    e.preventDefault();
    const from = items.findIndex((x) => x.id === dragId);
    const to = items.findIndex((x) => x.id === targetId);
    if (from >= 0 && to >= 0) move(from, to);
    setDragId(null);
    setOverId(null);
  };

  return (
    <div className={className}>
      <ul aria-label={label} className="flex flex-col gap-2">
        {items.map((it, i) => (
          <li
            key={it.id}
            onDragOver={(e) => {
              e.preventDefault();
              if (overId !== it.id) setOverId(it.id);
            }}
            onDragLeave={() => setOverId((o) => (o === it.id ? null : o))}
            onDrop={(e) => onDrop(e, it.id)}
            className={cn(
              "flex items-center gap-3 rounded-[var(--radius-card)] border bg-surface px-3 py-2.5 shadow-[var(--card-shadow)] transition-[box-shadow,opacity] motion-reduce:transition-none",
              dragId === it.id ? "opacity-50" : "",
              overId === it.id && dragId !== it.id ? "border-brand-700 border-dashed bg-brand-50" : "border-line",
            )}
          >
            <button
              ref={(n) => {
                if (n) handles.current.set(it.id, n);
                else handles.current.delete(it.id);
              }}
              type="button"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", it.id);
                setDragId(it.id);
              }}
              onDragEnd={() => {
                setDragId(null);
                setOverId(null);
              }}
              onKeyDown={(e) => onKey(e, i)}
              aria-label={`Reorder ${it.title}, position ${i + 1} of ${items.length}. Use up and down arrows.`}
              className={cn("grid size-7 cursor-grab place-items-center rounded-[var(--radius-control)] text-ink-3 hover:bg-surface-2 hover:text-ink active:cursor-grabbing", focusRing)}
            >
              <GripVertical aria-hidden="true" className="size-4" />
            </button>
            <span className="tabular-nums text-xs text-ink-3">{i + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-ui font-medium">{it.title}</span>
              {it.meta ? <span className="block truncate text-xs text-ink-3">{it.meta}</span> : null}
            </span>
          </li>
        ))}
      </ul>
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Card grid                                                           */
/* ------------------------------------------------------------------ */

/** Responsive card grid: 1 column on phones, then `min` px tracks that fill the row. */
export function CardGrid({ children, min = 220, className }: { children: ReactNode; min?: number; className?: string }) {
  return (
    <div className={cn("grid gap-3", className)} style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(${min}px, 100%), 1fr))` }}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Card carousel                                                       */
/* ------------------------------------------------------------------ */

/** Horizontal scroll-snap row with previous / next buttons. Swipe, scroll or use the buttons. */
export function CardCarousel({ label, children, itemWidth = 260, className }: { label: string; children: ReactNode[]; itemWidth?: number; className?: string }) {
  const track = useRef<HTMLUListElement>(null);
  const [edge, setEdge] = useState<{ start: boolean; end: boolean }>({ start: true, end: false });

  const update = () => {
    const el = track.current;
    if (!el) return;
    setEdge({ start: el.scrollLeft <= 2, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 });
  };
  const step = (dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * (itemWidth + 12), behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <section aria-roledescription="carousel" aria-label={label} className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-ui font-medium">{label}</p>
        <div className="flex gap-1">
          <IconButton aria-label="Previous" icon={<ChevronLeft />} variant="secondary" size="sm" onClick={() => step(-1)} disabled={edge.start} tooltip={false} />
          <IconButton aria-label="Next" icon={<ChevronRight />} variant="secondary" size="sm" onClick={() => step(1)} disabled={edge.end} tooltip={false} />
        </div>
      </div>
      <ul ref={track} onScroll={update} className="relative -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-1 px-1 pb-2 [scrollbar-width:thin]">
        {children.map((c, i) => (
          <li key={i} aria-roledescription="slide" aria-label={`${i + 1} of ${children.length}`} className="shrink-0 snap-start" style={{ width: `min(${itemWidth}px, 80vw)` }}>
            {c}
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Card with header and footer                                         */
/* ------------------------------------------------------------------ */

/** Header (title, description, actions) / body / footer, divided by hairlines. */
export function FramedCard({ title, description, actions, footer, children, className }: { title: string; description?: string; actions?: ReactNode; footer?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-[var(--card-p)] py-3.5">
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {actions ? <div className="flex items-center gap-1.5">{actions}</div> : null}
      </div>
      <div className="flex-1 p-[var(--card-p)]">{children}</div>
      {footer ? <CardFooter className="justify-end bg-surface-2/60 px-[var(--card-p)]">{footer}</CardFooter> : null}
    </Card>
  );
}
