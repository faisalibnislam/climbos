"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import {
  BookOpenCheck,
  Clock,
  CalendarCheck,
  ChartLine,
  ChevronDown,
  CircleCheck,
  Compass,
  ExternalLink,
  FlaskConical,
  Gem,
  Globe,
  Hand,
  History,
  Hourglass,
  Info,
  Lightbulb,
  ListChecks,
  Lock,
  Megaphone,
  Pause,
  Scale,
  ShieldAlert,
  Target,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  UsersRound,
  Wallet,
  Workflow,
  type LucideIcon,
} from "@/components/icons";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Badge, Callout, Card, CardContent, DataTable, EmptyState, IconTile, Skeleton, Switch, toast, type Tone } from "@/components/ui";
import { ExperimentOutcome } from "./ExperimentOutcome";
import { HorizontalBarChart } from "@/components/ds/charts";
import { cn } from "@/lib/utils";
import { microsToCreditsLabel, minorToDisplay, relativeTime } from "../money";
import { microsToCredits } from "../../../../shared/economics/credits";
import type { KnowledgeReferenceSet } from "../../../../shared/knowledge/retrieve";
import { runStatusPresentation } from "../../../../shared/progress";
import { ErrorCallout, PERMISSION_WHO, RoleName, useNow } from "../content/shared";
import { ROLE_META } from "../roles";
import { approvedToast } from "./PlanActions";
import { FeedbackButton } from "./Feedback";
import { ProseBullets, toBullets } from "@/components/app/ProseBullets";
import { Highlight, KeyTakeaways } from "@/components/ds/content";

export type PlanView = FunctionReturnType<typeof api.workspace.plan>;
export type Strategy = NonNullable<PlanView["strategy"]>;
export type Insights = NonNullable<PlanView["insights"]>;

/* ---------------- Shared building blocks (used across the plan pages) ---------------- */

/**
 * A plan section: icon + Reckless title (+ optional short meta on the right), then the content
 * in a white card. `bare` leaves the content on the ground (for grids of cards).
 */
export function PlanSection({
  id,
  title,
  intro,
  children,
  icon,
  meta,
  bare = false,
  navLabel,
}: {
  id: string;
  title: string;
  /** One short line (six words or fewer). */
  intro?: ReactNode;
  children: ReactNode;
  icon?: LucideIcon;
  /** Small facts on the right of the header, e.g. a count or a total. */
  meta?: ReactNode;
  bare?: boolean;
  /** Shorter label for the page's jump-to-section bar. */
  navLabel?: string;
}) {
  return (
    <section aria-labelledby={id} data-nav-label={navLabel} className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {icon ? <IconTile icon={icon} tone="brand" size="sm" /> : null}
        <div className="min-w-0 flex-1">
          <h2 id={id} className="heading-section">
            {title}
          </h2>
          {intro ? <div className="text-ui text-ink-3">{intro}</div> : null}
        </div>
        {meta ? <div className="flex flex-wrap items-center gap-1.5">{meta}</div> : null}
      </div>
      {bare ? (
        children
      ) : (
        <Card>
          <CardContent className="flex flex-col gap-4">{children}</CardContent>
        </Card>
      )}
    </section>
  );
}

const CLAMP = { 1: "line-clamp-1", 2: "line-clamp-2", 3: "line-clamp-3", 4: "line-clamp-4" } as const;

/**
 * Long AI text, clamped to a few lines with a More/Less toggle that only shows when the text
 * overflows. The full text stays in the DOM, so screen readers read all of it.
 */
export function Clamp({
  children,
  lines = 1,
  className,
  expanded = false,
  toggle = true,
}: {
  children: ReactNode;
  lines?: keyof typeof CLAMP;
  className?: string;
  /** Opened from outside (e.g. a card-level "Details" or "Expand all"). */
  expanded?: boolean;
  /** Own More/Less button. Turn off when a parent control expands it. */
  toggle?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [own, setOwn] = useState(false);
  const [overflow, setOverflow] = useState(false);
  const open = expanded || own;
  useEffect(() => {
    const el = ref.current;
    if (!el || open || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setOverflow(el.scrollHeight > el.clientHeight + 1));
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);
  return (
    <div className={cn("min-w-0", className)}>
      <div ref={ref} className={cn("break-words", !open && CLAMP[lines])}>
        {children}
      </div>
      {toggle && !expanded && (overflow || own) ? (
        <button
          type="button"
          aria-expanded={own}
          onClick={() => setOwn((o) => !o)}
          className="inline-flex min-h-6 items-center text-xs font-medium text-brand-800 hover:underline"
        >
          {own ? "Less" : "More"}
        </button>
      ) : null}
    </div>
  );
}

/** "Expand all" for a card whose rows are clamped without their own toggles. */
export function ExpandAll({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button type="button" aria-expanded={open} onClick={onToggle} className="inline-flex min-h-6 items-center gap-1 text-xs font-medium normal-case tracking-normal text-brand-800 hover:underline">
      <ChevronDown aria-hidden className={cn("size-3.5 transition-transform", open && "rotate-180")} />
      {open ? "Collapse" : "Expand all"}
    </button>
  );
}

/** Small label with an icon, used for field names inside cards. */
export function FieldLabel({ icon: Icon, children, className }: { icon?: LucideIcon; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium text-ink-3", className)}>
      {Icon ? <Icon aria-hidden className="size-3.5 shrink-0" /> : null}
      {children}
    </span>
  );
}

/** Disclosure button: "Details" with a chevron. */
export function DetailsToggle({ open, onToggle, label = "Details", controls }: { open: boolean; onToggle: () => void; label?: string; controls?: string }) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={open ? controls : undefined}
      onClick={onToggle}
      className="inline-flex min-h-8 items-center gap-1 rounded-[var(--radius-control)] px-1 text-ui font-medium text-ink-2 hover:text-ink"
    >
      <ChevronDown aria-hidden className={cn("size-4 transition-transform duration-[var(--dur-base)]", open && "rotate-180")} />
      {open ? "Hide" : label}
    </button>
  );
}

const URL_RE = /https?:\/\/[^\s)\];,]+/g;

/** Pulls links out of AI text so they show as domain chips instead of raw URLs. */
export function splitLinks(text: string): { text: string; urls: string[] } {
  const urls = Array.from(new Set((text.match(URL_RE) ?? []).map((u) => u.replace(/[.,:]+$/, ""))));
  if (!urls.length) return { text, urls };
  const clean = text
    .replace(URL_RE, "")
    .replace(/\(\s*[;,]?\s*\)/g, "")
    .replace(/\s+and\s*([.;,])/g, "$1")
    .replace(/:\s*(and\s*)?([.;])/g, "$2")
    .replace(/\s+([.,;])/g, "$1")
    .replace(/([.;,]){2,}/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
  return { text: clean, urls };
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** A link shown as its domain. */
export function LinkChip({ url, label }: { url: string; label?: string }) {
  const host = hostOf(url);
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      title={url}
      className="inline-flex h-6 min-w-0 max-w-full items-center gap-1 rounded-[var(--radius-badge)] border border-line bg-surface px-1.5 text-xs text-ink-2 hover:border-line-strong hover:text-ink"
    >
      <Globe aria-hidden className="size-3 shrink-0 text-ink-3" />
      <span className="truncate">{label ?? host}</span>
      <ExternalLink aria-hidden className="size-3 shrink-0 text-ink-3" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

type SourceRef = { kind: "fact"; factId: string } | { kind: "web"; url: string; title?: string };
type FactLite = { id: string; statement: string };

/** What a channel or audience rests on: confirmed facts and pages the research read (Book 14 §5). */
function SourceChips({ refs, facts }: { refs?: SourceRef[]; facts: FactLite[] }) {
  if (!refs?.length) return null;
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1.5" aria-label="Sources">
      {refs.map((r) => {
        if (r.kind === "web") return <LinkChip key={r.url} url={r.url} label={r.title ? r.title.slice(0, 40) : undefined} />;
        const f = facts.find((x) => x.id === r.factId);
        return (
          <span key={r.factId} title={f?.statement ?? "Confirmed fact"} className="inline-flex h-6 min-w-0 max-w-[16rem] items-center gap-1 rounded-[var(--radius-badge)] border border-line bg-surface px-1.5 text-xs text-ink-2">
            <BookOpenCheck aria-hidden className="size-3 shrink-0 text-brand-700" />
            <span className="truncate">{f ? f.statement : "Confirmed fact"}</span>
          </span>
        );
      })}
    </span>
  );
}

/** AI text with its links pulled out into chips. */
function LinkedText({ text, lines = 1, className }: { text: string; lines?: keyof typeof CLAMP; className?: string }) {
  const s = splitLinks(text);
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      {s.text ? <Clamp lines={lines}>{s.text}</Clamp> : null}
      {s.urls.length ? (
        <div className="flex flex-wrap gap-1.5">
          {s.urls.map((u) => (
            <LinkChip key={u} url={u} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** AI prose as bullets, with its links pulled out into domain chips. */
export function LinkedBullets({ text, max = 3 }: { text: string; max?: number }) {
  const s = splitLinks(text);
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <ProseBullets text={s.text} max={max} />
      {s.urls.length ? (
        <div className="flex flex-wrap gap-1.5">
          {s.urls.map((u) => (
            <LinkChip key={u} url={u} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function BulletList({ items, empty, icon: Icon, iconClass }: { items: string[]; empty?: string; icon?: LucideIcon; iconClass?: string }) {
  if (items.length === 0) return empty ? <p className="text-ui text-ink-3">{empty}</p> : null;
  return (
    <ul className="flex flex-col gap-1.5 text-ui text-ink">
      {items.map((i) => (
        <li key={i} className="flex min-w-0 items-start gap-2">
          {Icon ? <Icon aria-hidden className={cn("mt-0.5 size-3.5 shrink-0 text-ink-3", iconClass)} /> : <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-brand-600" />}
          <LinkedText text={i} className="flex-1" />
        </li>
      ))}
    </ul>
  );
}

/** Parse "YYYY-MM-DD" as a local date for display. */
export function formatPlanDate(s: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return s;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function planDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

/* ---------------- Short version & audiences ---------------- */

export function ShortVersion({ strategy }: { strategy: Strategy }) {
  const points = toBullets(splitLinks(strategy.summary).text);
  return (
    <PlanSection id="short-heading" title="The short version" icon={Compass}>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-2">
          <KeyTakeaways items={points.slice(0, 3).map((b, i) => <Highlight key={i} text={b} />)} />
          {points.length > 3 ? <ProseBullets text={`${points.slice(3).join(". ")}.`} max={0} /> : null}
        </div>
        <div className="flex flex-col gap-1.5 rounded-[var(--radius-card)] bg-brand-50 p-3">
          <FieldLabel icon={Gem}>How you stand out</FieldLabel>
          <LinkedBullets text={strategy.positioning} max={2} />
        </div>
      </div>
    </PlanSection>
  );
}

/** Tints for persona cards, cycled. */
const PERSONA: { tile: Tone; rail: string }[] = [
  { tile: "brand", rail: "bg-chart-1" },
  { tile: "blue", rail: "bg-chart-3" },
  { tile: "orange", rail: "bg-chart-4" },
  { tile: "amber", rail: "bg-chart-5" },
];

function PersonaCard({ name, hypothesis, evidence, sources, facts, i }: { name: string; hypothesis: string; evidence: string; sources?: SourceRef[]; facts: FactLite[]; i: number }) {
  const [open, setOpen] = useState(false);
  const p = PERSONA[i % PERSONA.length];
  const ev = splitLinks(evidence);
  const panel = useId();
  return (
    <li className="relative flex min-w-0 flex-col gap-2.5 overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface p-4 pl-5 shadow-[var(--card-shadow)]">
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1", p.rail)} />
      <div className="flex items-center gap-2.5">
        <IconTile icon={UsersRound} tone={p.tile} size="sm" />
        <h3 className="heading-card min-w-0">{name}</h3>
      </div>
      <Clamp lines={2} className="text-ui text-ink">
        {hypothesis}
      </Clamp>
      <div className="mt-auto flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={open ? panel : undefined}
          onClick={() => setOpen((o) => !o)}
          className="inline-flex h-6 items-center gap-1 rounded-[var(--radius-badge)] bg-surface-2 px-1.5 text-xs font-medium text-ink-2 hover:bg-surface-3 hover:text-ink"
        >
          <BookOpenCheck aria-hidden className="size-3" /> Evidence
          <ChevronDown aria-hidden className={cn("size-3 transition-transform", open && "rotate-180")} />
        </button>
        {ev.urls.map((u) => (
          <LinkChip key={u} url={u} />
        ))}
        <SourceChips refs={sources?.filter((r) => r.kind === "fact" || !ev.urls.includes(r.url))} facts={facts} />
      </div>
      {open ? (
        <p id={panel} className="text-xs text-ink-2">
          {ev.text || evidence}
        </p>
      ) : null}
    </li>
  );
}

export function Audiences({ strategy, facts = [] }: { strategy: Strategy; facts?: FactLite[] }) {
  return (
    <PlanSection id="audiences-heading" title="Who to reach" icon={UsersRound} bare meta={strategy.audiences.length ? <Badge>{`${strategy.audiences.length} audiences`}</Badge> : null}>
      {strategy.audiences.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-ui text-ink-3">No audiences yet.</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {strategy.audiences.map((a, i) => (
            <PersonaCard key={a.name} name={a.name} hypothesis={a.hypothesis} evidence={a.evidence} sources={(a as { sources?: SourceRef[] }).sources} facts={facts} i={i} />
          ))}
        </ul>
      )}
    </PlanSection>
  );
}

/* ---------------- Channels ---------------- */

const CHANNEL_STATUS: Record<string, { label: string; tone: Tone; icon: LucideIcon }> = {
  proposed: { label: "Proposed", tone: "amber", icon: Hourglass },
  active: { label: "Active", tone: "green", icon: CircleCheck },
  parked: { label: "Parked", tone: "neutral", icon: Pause },
};

function ChannelToggle({ slug, strategyId, channelKey, status, name, approved }: { slug: string; strategyId: Id<"strategies">; channelKey: string; status: string; name: string; approved: boolean }) {
  const setStatus = useMutation(api.workspace.setChannelStatus);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  return (
    <div className="flex flex-col gap-2">
      <Switch
        label={`Work on ${name}`}
        description={
          pending
            ? "Saving…"
            : status === "proposed"
              ? "Turn on now, or approve the plan."
              : status === "parked" && approved
                ? "Turn on to start drafts (uses credits)."
                : "Turn off to park. Nothing new starts."
        }
        checked={status === "active"}
        disabled={pending}
        onCheckedChange={async (on) => {
          setPending(true);
          setError(null);
          try {
            const work = await setStatus({ slug, strategyId, key: channelKey, status: on ? "active" : "parked" });
            if (on && work) toast({ ...approvedToast(work), title: `${name} is active.` });
            else toast({ tone: "success", title: on ? `${name} is active.` : `${name} is parked.` });
          } catch (e) {
            setError(e);
          } finally {
            setPending(false);
          }
        }}
      />
      {error ? <ErrorCallout error={error} /> : null}
    </div>
  );
}

function ChannelCard({ c, rank, slug, strategy, canEdit, editable, currency, facts }: { c: Strategy["channels"][number]; rank: number; slug: string; strategy: Strategy; canEdit: boolean; editable: boolean; currency: string; facts: FactLite[] }) {
  const [open, setOpen] = useState(false);
  const st = CHANNEL_STATUS[c.status] ?? { label: c.status, tone: "neutral" as Tone, icon: Info };
  const panel = useId();
  return (
    <li className="flex min-w-0 flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--card-shadow)]">
      <div className="flex flex-wrap items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-[var(--radius-control)] bg-sage-ink text-ui font-semibold text-white tabular-nums" aria-hidden>
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="heading-card">
            <span className="sr-only">Priority {rank}: </span>
            {c.name}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge tone={st.tone} icon={<st.icon />}>
              {st.label}
            </Badge>
          </div>
        </div>
        <dl className="flex w-full shrink-0 gap-4 pl-11 sm:w-auto sm:pl-0 sm:text-right">
          <div>
            <dt className="text-xs text-ink-3">AI / month</dt>
            <dd className="text-sm font-semibold tabular-nums text-ink">≤ {microsToCreditsLabel(c.monthlyCostMicros)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-3">Ads / month</dt>
            <dd className="text-sm font-semibold tabular-nums text-ink">{c.adSpendMinor > 0 ? `~${minorToDisplay(c.adSpendMinor, currency)}` : "None"}</dd>
          </div>
        </dl>
      </div>
      <ProseBullets text={c.why} max={1} tone="muted" />
      <SourceChips refs={(c as { sources?: SourceRef[] }).sources} facts={facts} />
      {c.capabilityNote ? (
        <p className="flex items-start gap-1.5 rounded-[var(--radius-control)] bg-blue-100 px-2 py-1.5 text-xs text-blue-800">
          <Info aria-hidden className="mt-px size-3.5 shrink-0" />
          <span className="min-w-0">{c.capabilityNote}</span>
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2">
        <span className="flex flex-wrap gap-1.5 text-xs text-ink-3">
          <span className="inline-flex items-center gap-1">
            <ListChecks aria-hidden className="size-3.5" /> {c.deliverables.length} deliverables
          </span>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1">
            <Lock aria-hidden className="size-3.5" /> {c.dependencies.length ? `${c.dependencies.length} needs first` : "Starts now"}
          </span>
        </span>
        <span className="flex items-center gap-1">
          {canEdit && strategy.status !== "superseded" ? <FeedbackButton slug={slug} strategyId={strategy.id} subjectKind="channel" subjectKey={c.key} subjectLabel={c.name} /> : null}
          <DetailsToggle open={open} onToggle={() => setOpen((o) => !o)} controls={panel} />
        </span>
      </div>
      {open ? (
        <div id={panel} className="grid gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <FieldLabel icon={ListChecks}>Team delivers</FieldLabel>
            <BulletList items={c.deliverables} empty="Nothing listed." icon={CircleCheck} iconClass="text-brand-700" />
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel icon={Lock}>Needs first</FieldLabel>
            <BulletList items={c.dependencies} empty="Nothing. Starts now." icon={Hourglass} iconClass="text-amber-800" />
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel icon={ChartLine}>Measured by</FieldLabel>
            <p className="text-ui text-ink">{c.measurement}</p>
          </div>
        </div>
      ) : null}
      {editable ? (
        <ChannelToggle slug={slug} strategyId={strategy.id} channelKey={c.key} status={c.status} name={c.name} approved={strategy.status === "approved"} />
      ) : !canEdit ? (
        <p className="text-xs text-ink-3">Turning channels on or off needs {PERMISSION_WHO.edit}.</p>
      ) : null}
    </li>
  );
}

export function Channels({ slug, strategy, canEdit, currency, facts = [] }: { slug: string; strategy: Strategy; canEdit: boolean; currency: string; facts?: FactLite[] }) {
  const channels = [...strategy.channels].sort((a, b) => a.priority - b.priority);
  const editable = canEdit && strategy.status !== "superseded";
  const credits = channels.reduce((t, c) => t + microsToCredits(c.monthlyCostMicros), 0);
  const ads = channels.reduce((t, c) => t + c.adSpendMinor, 0);
  return (
    <PlanSection
      id="channels-heading"
      title="Channels"
      icon={Megaphone}
      intro="Ad spend goes to the platform."
      bare
      meta={
        channels.length ? (
          <>
            <Badge icon={<Wallet />}>{`≤ ${credits.toLocaleString("en-US")} credits/mo`}</Badge>
            <Badge>{ads > 0 ? `~${minorToDisplay(ads, currency)} ads/mo` : "No ad spend"}</Badge>
          </>
        ) : null
      }
    >
      {channels.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-ui text-ink-3">No channels yet.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {channels.length > 1 ? (
            <Card>
              <CardContent className="flex flex-col gap-3">
                <p className="text-overline">AI cost per month, by priority</p>
                <HorizontalBarChart
                  label="AI cost per month for each channel, in priority order"
                  valueLabel="Credits a month (max)"
                  sort={false}
                  format={(n) => n.toLocaleString("en-US")}
                  unit=" cr"
                  items={channels.map((c, i) => ({
                    label: `${i + 1}. ${c.name}`,
                    value: microsToCredits(c.monthlyCostMicros),
                    meta: `${CHANNEL_STATUS[c.status]?.label ?? c.status}${c.adSpendMinor > 0 ? ` · ~${minorToDisplay(c.adSpendMinor, currency)} ads` : ""}`,
                  }))}
                />
              </CardContent>
            </Card>
          ) : null}
          <ol className="flex flex-col gap-3">
            {channels.map((c, i) => (
              <ChannelCard key={c.key} c={c} rank={i + 1} slug={slug} strategy={strategy} canEdit={canEdit} editable={editable} currency={currency} facts={facts} />
            ))}
          </ol>
        </>
      )}
    </PlanSection>
  );
}

/* ---------------- Experiments ---------------- */

const METHOD: Record<string, { short: string; long: string }> = {
  holdout: { short: "Holdout", long: "A group that doesn't see the change, for comparison" },
  ab_split: { short: "A/B split", long: "Two versions shown to similar people at the same time" },
  pre_post_observational: { short: "Before / after", long: "Before-and-after comparison (the weakest evidence)" },
  export_instructions: { short: "You run it", long: "A test you run yourself, with step-by-step instructions" },
};

const EXPERIMENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  proposed: { label: "Proposed", tone: "amber" },
  running: { label: "Running", tone: "blue" },
  stopped: { label: "Stopped", tone: "neutral" },
  concluded: { label: "Finished", tone: "green" },
};

function ExperimentCard({ e, slug, canEdit }: { e: PlanView["experiments"][number]; slug: string; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const st = EXPERIMENT_STATUS[e.status] ?? { label: e.status, tone: "neutral" as Tone };
  const m = METHOD[e.method];
  const panel = useId();
  return (
    <li className="flex min-w-0 flex-col gap-2.5 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--card-shadow)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="heading-card min-w-0">{e.name}</h3>
        <Badge tone={st.tone}>{st.label}</Badge>
      </div>
      <Clamp lines={1} className="text-ui text-ink-2">
        {e.hypothesis}
      </Clamp>
      <div className="flex flex-wrap gap-1.5">
        <Badge tone="blue" icon={<FlaskConical />}>
          {m?.short ?? e.method}
        </Badge>
        <Badge icon={<Clock />}>{`${e.durationDays} day${e.durationDays === 1 ? "" : "s"}`}</Badge>
        <Badge tone="brand" icon={<Target />}>
          {e.primaryMetric}
        </Badge>
      </div>
      <div className="flex justify-end border-t border-line pt-1">
        <DetailsToggle open={open} onToggle={() => setOpen((o) => !o)} controls={panel} />
      </div>
      {open ? (
        <dl id={panel} className="grid gap-3 text-ui md:grid-cols-2">
          <div>
            <dt>
              <FieldLabel icon={UsersRound}>Who takes part</FieldLabel>
            </dt>
            <dd className="text-ink">{e.population}</dd>
          </div>
          <div>
            <dt>
              <FieldLabel icon={FlaskConical}>Method</FieldLabel>
            </dt>
            <dd className="text-ink">{m?.long ?? e.method}</dd>
          </div>
          <div>
            <dt>
              <FieldLabel icon={ShieldAlert}>Safety limits</FieldLabel>
            </dt>
            <dd>
              <BulletList items={e.guardrails} empty="None listed." />
            </dd>
          </div>
          <div>
            <dt>
              <FieldLabel icon={Hand}>Stop when</FieldLabel>
            </dt>
            <dd className="text-ink">{e.stoppingRule}</dd>
          </div>
        </dl>
      ) : null}
      {canEdit || e.analyses.length ? <ExperimentOutcome slug={slug} e={e} canEdit={canEdit} /> : null}
    </li>
  );
}

export function Experiments({ experiments, slug, canEdit }: { experiments: PlanView["experiments"]; slug: string; canEdit: boolean }) {
  return (
    <PlanSection id="experiments-heading" title="Experiments" icon={FlaskConical} intro="Each has a control and stop rule." bare>
      {experiments.length === 0 ? (
        <Card>
          <EmptyState icon={<FlaskConical />} title="No experiments yet" body="Tests show up here with a comparison group, one number to watch and a stop rule." />
        </Card>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {experiments.map((e) => (
            <ExperimentCard key={e.id} e={e} slug={slug} canEdit={canEdit} />
          ))}
        </ul>
      )}
    </PlanSection>
  );
}

/* ---------------- Constraints, measurement, review ---------------- */

const VALUE_RE = /(\$\s?\d[\d,]*(?:\.\d+)?k?(?:\s?\/\s?(?:month|mo|week|wk|year|yr|hour|h))?|\d[\d,]*(?:\.\d+)?\s?(?:%|hours?\s?\/\s?(?:week|wk)|h\s?\/\s?(?:week|wk)|\/month|\/week))/i;

/** "Ad budget: $500/month from the brief…" → a labelled fact with its main number. */
function factOf(line: string): { label: string; value: string | null; rest: string } | null {
  const m = /^([A-Z][^:]{1,28}):\s*(.+)$/s.exec(line.trim());
  if (!m) return null;
  const value = VALUE_RE.exec(m[2])?.[1] ?? null;
  return { label: m[1], value: value ? value.replace(/\s*\/\s*/g, "/").replace(/\$\s+/, "$") : null, rest: m[2] };
}

const FACT_ICON: [RegExp, LucideIcon][] = [
  [/budget|spend|cost|credit/i, Wallet],
  [/hour|time/i, Clock],
  [/price|pricing|revenue/i, Scale],
];

export function PlanBasics({ strategy }: { strategy: Strategy }) {
  const facts = strategy.constraints.map((c) => ({ line: c, fact: factOf(c) }));
  const tiles = facts.filter((f) => f.fact);
  const rest = facts.filter((f) => !f.fact).map((f) => f.line);
  const measures = toBullets(strategy.measurementPlan);
  const [allMeasures, setAllMeasures] = useState(false);
  const now = useNow();
  const date = planDate(strategy.reviewDate);
  const days = date && now ? Math.ceil((date.getTime() - now) / 86_400_000) : null;
  return (
    <>
      <PlanSection id="constraints-heading" title="Constraints" icon={Lock} intro="Limits the team works within.">
        {strategy.constraints.length === 0 ? <p className="text-ui text-ink-3">None listed.</p> : null}
        {tiles.length ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tiles.map(({ line, fact }) => {
              const Icon = FACT_ICON.find(([re]) => re.test(fact!.label))?.[1] ?? Info;
              return (
                <li key={line} className="flex min-w-0 flex-col gap-1 rounded-[var(--radius-card)] bg-surface-2 p-3">
                  <FieldLabel icon={Icon}>{fact!.label}</FieldLabel>
                  {fact!.value ? <span className="text-xl font-semibold tabular-nums text-ink">{fact!.value}</span> : null}
                  <LinkedText text={fact!.rest} className="text-xs text-ink-2" />
                </li>
              );
            })}
          </ul>
        ) : null}
        {rest.length ? <BulletList items={rest} icon={TriangleAlert} iconClass="text-amber-800" /> : null}
      </PlanSection>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <PlanSection
          id="measure-heading"
          title="How we'll measure"
          icon={ChartLine}
          meta={measures.length > 1 ? <ExpandAll open={allMeasures} onToggle={() => setAllMeasures((v) => !v)} /> : null}
        >
          {measures.length ? (
            <ul className="flex flex-col divide-y divide-line">
              {measures.map((s, i) => (
                <li key={i} className="flex min-w-0 items-start gap-2.5 py-2 first:pt-0 last:pb-0">
                  <span aria-hidden className="mt-px grid size-5 shrink-0 place-items-center rounded-[var(--radius-badge)] bg-brand-100 text-2xs font-semibold text-brand-900 tabular-nums">
                    {i + 1}
                  </span>
                  <Clamp lines={1} toggle={false} expanded={allMeasures} className="flex-1 text-ui text-ink">
                    {s}
                  </Clamp>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ui text-ink-3">Not set yet.</p>
          )}
        </PlanSection>
        <PlanSection id="review-date-heading" title="Next review" icon={CalendarCheck}>
          <div className="flex items-center gap-4">
            <time dateTime={strategy.reviewDate} className="flex w-16 shrink-0 flex-col overflow-hidden rounded-[var(--radius-card)] border border-line text-center">
              <span className="bg-sage-ink py-0.5 text-2xs font-semibold uppercase text-white">{date ? date.toLocaleDateString("en-US", { month: "short" }) : "Date"}</span>
              <span className="py-1 text-kpi font-semibold tabular-nums text-ink">{date ? date.getDate() : "—"}</span>
            </time>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-ui font-medium text-ink">{formatPlanDate(strategy.reviewDate)}</span>
              {days !== null ? <Badge tone={days < 0 ? "amber" : "brand"}>{days < 0 ? `${-days} days overdue` : days === 0 ? "Today" : `In ${days} days`}</Badge> : null}
              <span className="text-xs text-ink-3">Results vs plan. Changes need your approval.</span>
            </div>
          </div>
        </PlanSection>
      </div>
    </>
  );
}

/* ---------------- Business insights ---------------- */

const CONFIDENCE_TONE: Record<string, Tone> = { high: "green", medium: "amber", low: "red" };
const EFFORT_TONE: Record<string, Tone> = { low: "green", small: "green", medium: "amber", high: "red", large: "red" };

const SWOT: { key: keyof Insights["swot"]; label: string; icon: LucideIcon; box: string; ink: string }[] = [
  { key: "strengths", label: "Strengths", icon: TrendingUp, box: "bg-green-100", ink: "text-green-800" },
  { key: "weaknesses", label: "Weaknesses", icon: TrendingDown, box: "bg-red-100", ink: "text-red-800" },
  { key: "opportunities", label: "Opportunities", icon: Lightbulb, box: "bg-blue-100", ink: "text-blue-800" },
  { key: "threats", label: "Threats", icon: TriangleAlert, box: "bg-amber-100", ink: "text-amber-800" },
];
const SWOT_DIMENSION: Record<keyof Insights["swot"], "strength" | "weakness" | "opportunity" | "threat"> = {
  strengths: "strength", weaknesses: "weakness", opportunities: "opportunity", threats: "threat",
};
const SWOT_BASIS: Record<string, string> = {
  owner_report: "Owner reported",
  source_claim: "Public source claim",
  measured: "Measured result",
  research: "Public research",
  inference: "ClimbOS inference",
};

function swotEvidenceOf(insights: Insights, dimension: keyof Insights["swot"], finding: string) {
  return insights.swotEvidence?.find((item) => item.dimension === SWOT_DIMENSION[dimension] && item.finding === finding);
}

function swotReference(ref: string, index: number) {
  if (/^https?:\/\//i.test(ref)) {
    try {
      const url = new URL(ref);
      if (url.protocol === "https:" || url.protocol === "http:") return <LinkChip key={`${ref}-${index}`} url={url.href} label="Source" />;
    } catch {
      // Invalid model-produced references stay visible as unlinked evidence labels.
    }
  }
  return <Badge key={`${ref}-${index}`}>{/^fact:\d+$/i.test(ref) ? "Business fact" : "Evidence reference"}</Badge>;
}

const SWOT_MOVE_LABEL: Record<NonNullable<Insights["swotMoves"]>[number]["kind"], string> = {
  strength_opportunity: "Use a strength to pursue an opportunity",
  weakness_opportunity: "Address a weakness to pursue an opportunity",
  strength_threat: "Use a strength to respond to a threat",
  weakness_threat: "Reduce a weakness exposed to a threat",
};

const COMMERCIAL_STATUS_LABEL: Record<NonNullable<Insights["commercialAssessment"]>["status"], string> = {
  evidence_supports_testing: "Evidence supports a small test",
  mixed_evidence: "Some evidence, some uncertainty",
  insufficient_business_specific_evidence: "More business evidence is needed",
};

function swotMovePair(insights: Insights, move: NonNullable<Insights["swotMoves"]>[number]) {
  const first = move.kind.startsWith("strength_") ? insights.swot.strengths : insights.swot.weaknesses;
  const second = move.kind.endsWith("_opportunity") ? insights.swot.opportunities : insights.swot.threats;
  const firstFinding = first[move.firstIndex];
  const secondFinding = second[move.secondIndex];
  return firstFinding && secondFinding ? { firstFinding, secondFinding } : null;
}

function SubHead({ icon: Icon, children, meta }: { icon: LucideIcon; children: ReactNode; meta?: ReactNode }) {
  return (
    <div className="mb-2.5 flex flex-wrap items-center gap-2">
      <Icon aria-hidden className="size-4 text-brand-800" />
      <h3 className="heading-card">{children}</h3>
      {meta}
    </div>
  );
}

export function BusinessInsights({ insights }: { insights: Insights | null }) {
  const now = useNow();
  if (!insights) {
    return (
      <PlanSection id="insights-heading" title="Business insights" icon={Lightbulb} bare>
        <Card>
          <EmptyState icon={<Lightbulb />} title="No insights yet" body="They appear after your team researches your business." />
        </Card>
      </PlanSection>
    );
  }
  return (
    <PlanSection
      id="insights-heading"
      title="Business insights"
      icon={Lightbulb}
      intro={`Researched${now ? ` ${relativeTime(insights.generatedAt, now)}` : ""}. Check anything odd.`}
    >
      <div className="flex flex-col gap-7">
        <div>
          <SubHead icon={UsersRound}>Your audiences</SubHead>
          <ul className="grid gap-3 md:grid-cols-2">
            {insights.audiences.map((a, i) => (
              <li key={a.name} className="flex min-w-0 items-start gap-3 rounded-[var(--radius-card)] border border-line p-3">
                <IconTile icon={UsersRound} tone={PERSONA[i % PERSONA.length].tile} size="sm" />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-ui font-semibold text-ink">{a.name}</span>
                    <Badge tone={CONFIDENCE_TONE[a.confidence.toLowerCase()] ?? "neutral"}>{`${a.confidence.charAt(0).toUpperCase()}${a.confidence.slice(1)} confidence`}</Badge>
                  </span>
                  <Clamp lines={2} className="text-ui text-ink-2">
                    {a.description}
                  </Clamp>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {insights.commercialAssessment ? (
          <div>
            <SubHead icon={ShieldAlert} meta={<Badge tone={insights.commercialAssessment.status === "evidence_supports_testing" ? "green" : insights.commercialAssessment.status === "mixed_evidence" ? "amber" : "neutral"}>{COMMERCIAL_STATUS_LABEL[insights.commercialAssessment.status]}</Badge>}>
              What we know about sales and what to check next
            </SubHead>
            <Callout tone="info" title="A validation guide, not a viability verdict">
              These findings separate business-specific evidence from owner reports, public research, website claims, and hypotheses. A small or selected sample does not establish a whole market.
            </Callout>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <Card>
                <CardContent className="flex flex-col gap-3 p-4">
                  <h4 className="text-ui font-semibold text-ink">What the evidence says</h4>
                  {insights.commercialAssessment.evidence.length ? (
                    <ul className="flex flex-col gap-3">
                      {insights.commercialAssessment.evidence.map((item, index) => (
                        <li key={`${item.dimension}-${index}`} className="flex flex-col gap-1.5 border-b border-line pb-3 last:border-0 last:pb-0">
                          <span className="flex flex-wrap items-center gap-2"><Badge>{item.dimension.replaceAll("_", " ")}</Badge><Badge tone={item.basis === "measured" ? "green" : item.basis === "inference" ? "amber" : "neutral"}>{item.basis.replaceAll("_", " ")}</Badge></span>
                          <p className="text-ui text-ink">{item.finding}</p>
                          <p className="text-sm text-ink-3">Limit: {item.limitation}</p>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-ui text-ink-3">No business-specific commercial evidence was supplied. The gaps below are hypotheses to validate.</p>}
                  {insights.commercialAssessment.unknowns.length ? <div><p className="text-sm font-semibold text-ink-2">Still unknown</p><ul className="mt-1 list-inside list-disc text-sm text-ink-2">{insights.commercialAssessment.unknowns.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul></div> : null}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex flex-col gap-3 p-4">
                  <h4 className="text-ui font-semibold text-ink">Smallest useful validation test</h4>
                  <p className="text-ui text-ink-2"><span className="font-semibold text-ink">Question: </span>{insights.commercialAssessment.nextTest.question}</p>
                  <p className="text-ui text-ink-2"><span className="font-semibold text-ink">Try: </span>{insights.commercialAssessment.nextTest.smallestTest}</p>
                  <p className="text-ui text-ink-2"><span className="font-semibold text-ink">Look for: </span>{insights.commercialAssessment.nextTest.successSignal}</p>
                  <p className="text-ui text-ink-2"><span className="font-semibold text-ink">Decide in advance: </span>{insights.commercialAssessment.nextTest.decisionRule}</p>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : null}

        <div>
          <SubHead icon={Target} meta={<Badge>{String(insights.competitors.length)}</Badge>}>
            Competitors
          </SubHead>
          {insights.competitors.length === 0 ? (
            <p className="text-ui text-ink-3">None found yet.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line rounded-[var(--radius-card)] border border-line">
              {insights.competitors.map((c) => (
                <li key={c.name} className="flex min-w-0 flex-col gap-2 p-3">
                  <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-4">
                    <span className="text-ui font-semibold text-ink sm:w-40 sm:shrink-0">{c.name}</span>
                    <Clamp lines={1} className="flex-1 text-ui text-ink-2">
                      {c.note}
                    </Clamp>
                    <span className="flex shrink-0 flex-wrap gap-1.5">
                      {c.url ? <LinkChip url={c.url} label="Website" /> : null}
                      {c.sourceUrl ? <LinkChip url={c.sourceUrl} label="Source" /> : <Badge tone="amber" icon={<TriangleAlert />}>No source: confirm</Badge>}
                    </span>
                  </div>
                  {c.comparison?.length ? (
                    <details className="rounded-[var(--radius-control)] border border-line px-3 py-2">
                      <summary className="min-h-8 cursor-pointer py-1 text-xs font-medium text-ink-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800">
                        Compare the evidence ({c.comparison.length})
                      </summary>
                      <div className="mt-2 flex flex-col gap-3">
                        {c.comparison.map((item, index) => (
                          <div key={`${item.dimension}-${item.sourceUrl}-${index}`} className="grid min-w-0 gap-1 border-t border-line pt-2 text-xs sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-x-3">
                            <span className="font-medium capitalize text-ink-2">{item.dimension.replaceAll("_", " ")}</span>
                            <div className="min-w-0 space-y-1.5">
                              <p className="text-ink"><span className="font-medium">Their page says: </span>{item.finding}</p>
                              <p className="text-ink-2"><span className="font-medium">Why it may matter here: </span>{item.implication}</p>
                              <LinkChip url={item.sourceUrl} label="Evidence page" />
                            </div>
                          </div>
                        ))}
                        <p className="text-xs text-ink-3">A competitor&apos;s page reports its own claims. These differences do not show why customers choose them.</p>
                      </div>
                    </details>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex flex-col gap-1.5 rounded-[var(--radius-card)] bg-brand-50 p-3">
            <FieldLabel icon={Gem}>Positioning</FieldLabel>
            <LinkedBullets text={insights.positioning} max={2} />
          </div>
          <div className="flex flex-col gap-1.5 rounded-[var(--radius-card)] bg-cream-soft p-3">
            <FieldLabel icon={Scale}>Pricing notes</FieldLabel>
            <LinkedBullets text={insights.pricingNotes} max={2} />
          </div>
        </div>

        <div>
          <SubHead icon={Compass}>What helps, what gets in the way, and what to watch</SubHead>
          <p className="mb-3 max-w-[70ch] text-sm text-ink-3">A quick view of what is working inside the business and what may change outside it. Items without direct support are labeled as ideas to check.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {SWOT.map((s) => (
              <div key={s.key} className={cn("flex min-w-0 flex-col gap-2 rounded-[var(--radius-card)] p-3", s.box)}>
                <h4 className={cn("flex items-center gap-1.5 text-ui font-semibold", s.ink)}>
                  <s.icon aria-hidden className="size-4" />
                  {s.label}
                  <span className="font-medium tabular-nums">· {insights.swot[s.key].length}</span>
                </h4>
                {insights.swot[s.key].length === 0 ? (
                  <p className="text-ui text-ink-2">None noted.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {insights.swot[s.key].map((it) => (
                      <li key={it} className="flex min-w-0 items-start gap-2 text-ui text-ink">
                        <span aria-hidden className={cn("mt-[7px] size-1.5 shrink-0 rounded-full bg-current", s.ink)} />
                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                          <Clamp lines={2}>{it}</Clamp>
                          <details className="text-xs text-ink-2">
                            <summary className="min-h-6 cursor-pointer font-medium text-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800">Evidence and why it matters</summary>
                            {(() => {
                              const evidence = swotEvidenceOf(insights, s.key, it);
                              if (!evidence) return <p className="mt-1 text-ink-3">No supporting evidence is saved for this item. Treat it as an idea to check, not a confirmed fact.</p>;
                              return (
                                <div className="mt-1 flex flex-col gap-1.5">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <Badge tone={evidence.basis === "measured" ? "green" : evidence.basis === "inference" ? "amber" : "neutral"}>{SWOT_BASIS[evidence.basis] ?? "Evidence basis not labeled"}</Badge>
                                    <Badge tone={CONFIDENCE_TONE[evidence.confidence] ?? "neutral"}>{`${evidence.confidence} confidence`}</Badge>
                                  </div>
                                  <p><span className="font-semibold">Why it may matter: </span>{evidence.strategicImplication}</p>
                                  {evidence.evidenceRefs.length ? <div className="flex flex-wrap gap-1.5">{evidence.evidenceRefs.map(swotReference)}</div> : <p className="text-ink-3">No direct source is linked, so check this before relying on it.</p>}
                                </div>
                              );
                            })()}
                          </details>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>

        {insights.swotMoves?.length ? (
          <details className="rounded-[var(--radius-card)] border border-line bg-surface p-3">
            <summary className="min-h-8 cursor-pointer text-ui font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800">
              Possible next steps ({insights.swotMoves.length})
            </summary>
            <p className="mb-3 text-sm text-ink-3">These suggestions connect findings above. They are not proven advantages; check the small test before acting.</p>
            <ol className="flex flex-col gap-3">
              {insights.swotMoves.map((move, index) => {
                const pair = swotMovePair(insights, move);
                if (!pair) return null;
                return (
                  <li key={`${move.kind}-${index}`} className="rounded-[var(--radius-card)] border border-line bg-surface-2 p-3">
                    <Badge>{SWOT_MOVE_LABEL[move.kind]}</Badge>
                    <p className="mt-1 text-sm text-ink-3">Based on: {pair.firstFinding} · {pair.secondFinding}</p>
                    <p className="mt-2 text-ui text-ink">{move.move}</p>
                    <p className="mt-1 text-sm text-ink-2"><span className="font-semibold">Small first test: </span>{move.firstTest}</p>
                    <p className="mt-1 text-sm text-ink-2"><span className="font-semibold">Measure: </span>{move.measure}</p>
                  </li>
                );
              })}
            </ol>
          </details>
        ) : null}

        <div>
          <SubHead icon={Workflow}>Customer journey</SubHead>
          {insights.journey.length === 0 ? (
            <p className="text-ui text-ink-3">Not mapped yet.</p>
          ) : (
            <>
              <ol className="flex flex-col gap-2 sm:hidden">
                {insights.journey.map((j, i) => (
                  <li key={j.stage} className="flex flex-col gap-1.5 rounded-[var(--radius-card)] border border-line p-3">
                    <span className="flex items-center gap-2 text-ui font-semibold text-ink">
                      <span aria-hidden className="grid size-5 place-items-center rounded-[var(--radius-badge)] bg-brand-100 text-2xs text-brand-900">
                        {i + 1}
                      </span>
                      {j.stage}
                    </span>
                    <Clamp lines={2} className="text-ui text-ink-2">
                      <span className="font-medium text-ink">Seen: </span>
                      {j.observation}
                    </Clamp>
                    <Clamp lines={2} className="text-ui text-green-800">
                      <span className="font-medium">Opportunity: </span>
                      {j.opportunity}
                    </Clamp>
                  </li>
                ))}
              </ol>
              <div className="hidden sm:block">
                <DataTable
                  caption="Customer journey: what we see at each stage and the opportunity"
                  hideCaption
                  rows={insights.journey}
                  rowKey={(r) => r.stage}
                  columns={[
                    { key: "stage", header: "Stage", rowHeader: true, cell: (r) => <span className="font-medium">{r.stage}</span> },
                    { key: "observation", header: "What we see", cell: (r) => <Clamp lines={2}>{r.observation}</Clamp> },
                    { key: "opportunity", header: "Opportunity", cell: (r) => <Clamp lines={2}>{r.opportunity}</Clamp> },
                  ]}
                />
              </div>
            </>
          )}
        </div>

        <div>
          <SubHead icon={Lightbulb}>Top opportunities</SubHead>
          {insights.opportunities.length === 0 ? (
            <p className="text-ui text-ink-3">None yet.</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {insights.opportunities.map((o, i) => (
                <li key={o.title} className="flex min-w-0 items-start gap-3 rounded-[var(--radius-card)] border border-line p-3">
                  <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-[var(--radius-control)] bg-sage-ink text-xs font-semibold text-white tabular-nums">
                    {i + 1}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-ui font-semibold text-ink">{o.title}</span>
                      <Badge tone={EFFORT_TONE[o.effort.toLowerCase()] ?? "neutral"}>{`Effort: ${o.effort}`}</Badge>
                    </span>
                    <Clamp lines={1} className="text-ui text-ink-2">
                      {o.why}
                    </Clamp>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </PlanSection>
  );
}

/* ---------------- Sources ---------------- */

export function Sources({ sources, web = [], researchEvidence = [], websiteUrl, knowledge }: { sources: PlanView["sources"]; web?: { url: string; title?: string }[]; researchEvidence?: { agentId: string; notes: string; sources: { url: string; title?: string; pageReportedDates?: { kind: "published" | "updated"; date: string; source: "json_ld" | "meta" }[] }[]; retrievedAt?: number; truncated: boolean }[]; websiteUrl?: string; knowledge?: KnowledgeReferenceSet }) {
  const businessHost = websiteUrl ? hostOf(websiteUrl) : null;
  return (
    <PlanSection
      id="sources-heading"
      title="Sources"
      icon={BookOpenCheck}
      meta={
        <>
          <Badge>{`${sources.length} facts`}</Badge>
          {web.length ? <Badge>{`${web.length} pages`}</Badge> : null}
        </>
      }
    >
      {sources.length === 0 ? (
        <p className="text-ui text-ink-3">No facts linked to this plan.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {sources.map((s) => (
            <li key={s.id} className="flex min-w-0 flex-col gap-1.5 py-2 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:gap-3">
              <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:max-w-48">
                <Badge tone="brand" className="capitalize">{s.category}</Badge>
                <Badge>{s.provenance === "owner_supplied" ? "From your team" : s.provenance === "researched" ? "From research" : "Demo example"}</Badge>
                <Badge tone={s.reviewState === "confirmed" || s.reviewState === "edited" ? "green" : s.reviewState === "rejected" ? "red" : "amber"}>
                  {s.reviewState === "confirmed" ? "Confirmed" : s.reviewState === "edited" ? "Edited by your team" : s.reviewState === "rejected" ? "Rejected" : "Needs review"}
                </Badge>
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <LinkedText text={s.statement} className="text-ui text-ink" />
                <p className="text-xs text-ink-3">
                  {s.confidence} confidence{s.verifiedAt ? ` · last checked ${new Date(s.verifiedAt).toISOString().slice(0, 10)}` : " · check date unavailable"}
                </p>
                {s.sources.length || s.sourceDetailsUnavailableCount || s.additionalSourceCount ? (
                  <details className="text-xs">
                    <summary className="min-h-6 cursor-pointer font-medium text-link">View source details</summary>
                    <ul className="mt-2 flex flex-col gap-2">
                      {s.sources.map((source) => (
                        <li key={source.id} className="rounded-[var(--radius-control)] border border-line bg-surface px-2.5 py-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge>{source.kind === "website" ? "Website" : source.kind === "search" ? "Public research" : source.kind === "owner_text" ? "Your note" : source.kind === "owner_upload" ? "Your file" : "Demo source"}</Badge>
                            <Badge>{source.status === "ok" ? `Read ${new Date(source.fetchedAt).toISOString().slice(0, 10)}` : source.status === "blocked_by_robots" ? "Page access blocked" : source.status === "failed" ? "Page could not be read" : "Not read"}</Badge>
                          </div>
                          {source.url ? <p className="mt-1.5"><LinkChip url={source.url} label={source.title ? `${source.title} · ${hostOf(source.url)}` : undefined} /></p> : source.title ? <p className="mt-1.5 text-ink-2">{source.title}</p> : null}
                          {source.excerpt ? <p className="mt-1.5 whitespace-pre-wrap break-words leading-relaxed text-ink-2">Saved excerpt: {source.excerpt}</p> : null}
                          {source.excerptExpired ? <p className="mt-1.5 text-ink-3">The saved page excerpt is no longer retained. The link opens the current page, which may have changed.</p> : null}
                        </li>
                      ))}
                      {s.sourceDetailsUnavailableCount ? <li className="text-ink-3">Some linked source details are unavailable.</li> : null}
                      {s.additionalSourceCount ? <li className="text-ink-3">{s.additionalSourceCount} more source(s) are not shown here.</li> : null}
                    </ul>
                  </details>
                ) : <p className="text-xs text-ink-3">No supporting page or file was saved with this fact.</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {researchEvidence.length ? (
        <details className="border-t border-line pt-3">
          <summary className="cursor-pointer text-sm font-medium text-ink">Research notes and assessment</summary>
          <p className="mt-2 text-xs text-ink-3">These notes were written by AI from the listed sources. Source relevance and reliability are model assessments, not independent verification. Check important claims; dates or methods are shown only when the research recorded them.</p>
          <ul className="mt-2 flex flex-col divide-y divide-line">
            {researchEvidence.map((entry) => (
              <li key={entry.agentId} className="flex flex-col gap-2 py-3 first:pt-1 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-ink">{entry.agentId === "growth_plays" ? "Growth options research" : entry.agentId === "growth_strategy" ? "Plan research" : "Other research"}</span>
                  {entry.retrievedAt !== undefined ? <Badge>Retrieved {new Date(entry.retrievedAt).toISOString().slice(0, 10)}</Badge> : <Badge tone="amber">Retrieval date unavailable</Badge>}
                  {entry.truncated ? <Badge tone="amber">Notes shortened</Badge> : null}
                </div>
                <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-ink-2">{entry.notes}</p>
                {entry.sources.length ? <ul className="flex flex-col gap-2">{entry.sources.map((source) => <li key={source.url} className="flex flex-col items-start gap-1"><LinkChip url={source.url} label={source.title ? `${source.title} · ${hostOf(source.url)}` : undefined} />{source.pageReportedDates?.length ? <p className="text-xs text-ink-3">Page-reported {(["published", "updated"] as const).flatMap((kind) => { const dates = [...new Set(source.pageReportedDates?.filter((item) => item.kind === kind).map((item) => item.date) ?? [])]; return dates.length ? [`${kind}: ${dates.join(", ")}`] : []; }).join(" · ")} · page metadata, not independently verified</p> : null}</li>)}</ul> : <p className="text-xs text-ink-3">No source links were saved with these notes.</p>}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {web.length ? (
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          <FieldLabel icon={Globe}>Pages read</FieldLabel>
          <p className="text-xs text-ink-3">A page on your website shows what your business publishes. Other pages are references; a different website does not by itself make a source independent or prove its claims.</p>
          <ul className="flex flex-wrap gap-1.5">
            {web.map((w) => (
              <li key={w.url} className="flex min-w-0 max-w-full flex-col items-start gap-1">
                <LinkChip url={w.url} label={w.title ? `${w.title} · ${hostOf(w.url)}` : undefined} />
                <Badge tone={businessHost && hostOf(w.url) === businessHost ? "amber" : "neutral"}>
                  {businessHost
                    ? hostOf(w.url) === businessHost ? "Your website · published claim" : "Other website · independence unverified"
                    : "Site relationship unknown · independence unverified"}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {knowledge?.records.length ? (
        <div className="flex flex-col gap-3 border-t border-line pt-3">
          <div>
            <FieldLabel icon={BookOpenCheck}>Reference guidance used</FieldLabel>
            <p className="mt-1 text-xs text-ink-3">
              These curated references helped shape the plan. They are not evidence about your business, and proposed scenarios are unvalidated hypotheses.
            </p>
            <p className="mt-1 text-xs text-ink-3">{knowledge.edition} · research cutoff {knowledge.researchCutoff}</p>
          </div>
          <ul className="flex flex-col divide-y divide-line">
            {knowledge.records.map((record) => (
              <li key={record.id} className="flex flex-col gap-1.5 py-2 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={record.kind === "industry_playbook" || record.kind === "scenario" ? "amber" : "neutral"}>
                    {record.kind === "industry_playbook" || record.kind === "scenario" ? "Proposed hypothesis" : "Reference guidance"}
                  </Badge>
                  {record.businessType ? <Badge>{record.businessType}</Badge> : null}
                  {record.industry ? <Badge>{record.industry}</Badge> : null}
                </div>
                <p className="text-sm font-medium text-ink">{record.heading}</p>
                <p className="text-xs text-ink-3">{record.path} · reference checksum {record.sha256.slice(0, 12)}</p>
                {record.sources.length ? (
                  <ul className="flex flex-col gap-1 text-xs">
                    {record.sources.map((source) => (
                      <li key={source.registryId} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <a href={source.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                          {source.title}
                        </a>
                        <span className="text-ink-3">Checked {source.retrievedAt} · {source.freshness.status}</span>
                        {source.claims[0]?.scope ? <span className="text-ink-3">Scope: {source.claims[0].scope}</span> : null}
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-xs text-ink-3">Curated library reference; no external source was attached.</p>}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </PlanSection>
  );
}

/* ---------------- Recent work ---------------- */

export function RecentWork({ slug }: { slug: string }) {
  const runs = useQuery(api.workspace.runs, { slug });
  const now = useNow();
  return (
    <PlanSection id="recent-heading" title="Recent work" icon={History}>
      {runs === undefined ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : runs.length === 0 ? (
        <p className="text-ui text-ink-3">No work yet. Jobs show here with their cost.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {runs.slice(0, 12).map((r) => {
            const finished = ["verified", "failed", "canceled", "uncertain"].includes(r.status);
            const runStatus = runStatusPresentation(r.status);
            return (
              <li key={r.id} className="flex min-w-0 flex-col gap-1 py-2.5 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-ui font-medium text-ink">{r.title}</span>
                  <span className="flex flex-wrap gap-1.5">
                    {r.isFixture ? <Badge tone="violet">Demo</Badge> : null}
                    <Badge tone={runStatus.tone}>{runStatus.label}</Badge>
                  </span>
                </div>
                <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-3">
                  <span className="flex flex-wrap gap-x-2">
                    {r.roles.map((role) => (
                      <RoleName key={role} role={role} className={ROLE_META[role] ? "" : "capitalize"} />
                    ))}
                  </span>
                  <span className="tabular-nums">{finished ? `${microsToCreditsLabel(r.actualMicros)} of ≤ ${microsToCreditsLabel(r.estimateMicros)}` : `≤ ${microsToCreditsLabel(r.estimateMicros)} reserved`}</span>
                  {now ? <span>{relativeTime(r.createdAt, now)}</span> : null}
                </span>
                {r.userMessage ? (
                  <Callout tone={r.status === "failed" ? "danger" : "info"} live="none" className="mt-1 py-2">
                    {r.userMessage}
                  </Callout>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </PlanSection>
  );
}
