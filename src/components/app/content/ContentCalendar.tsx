"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { ChevronLeft, ChevronRight } from "@/components/icons"
import Link from "next/link";
import { useState } from "react";
import { Badge, Button, Callout, IconButton, Skeleton, SocialIcon } from "@/components/ui";
import { cn } from "@/lib/utils";
import { Segmented } from "@/components/ui/segmented";
import { ArtifactStatus, SectionBoundary, channelLabel, useNow } from "./shared";
import { localDate, zonedTime } from "../../../../shared/autopilot";

type View = "day" | "week" | "month";

const DAY_MS = 86_400_000;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const AUTOPILOT_STATUS: Record<string, { label: string; tone: "neutral" | "green" | "amber" | "red" | "blue" | "violet" }> = {
  planned: { label: "Planned", tone: "neutral" },
  drafting: { label: "Drafting", tone: "blue" },
  needs_approval: { label: "Needs review", tone: "amber" },
  scheduled: { label: "Scheduled", tone: "blue" },
  ready_to_post: { label: "Ready to post", tone: "violet" },
  published: { label: "Published", tone: "green" },
  failed: { label: "Didn't finish", tone: "red" },
};

/** Dates in this component are encoded at UTC noon so calendar arithmetic stays DST-safe. */
function dateKey(d: Date): string {
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

function dateKeyAt(utcMs: number, timeZone: string): string {
  const d = localDate(utcMs, timeZone);
  return `${d.year}-${d.month0}-${d.day}`;
}

function calendarDate(utcMs: number, timeZone: string): Date {
  const d = localDate(utcMs, timeZone);
  return new Date(Date.UTC(d.year, d.month0, d.day, 12));
}

function startOfWeek(d: Date): Date {
  const dow = (d.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow, 12));
}

function addDays(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n, 12));
}

function midnight(d: Date, timeZone: string): number {
  return zonedTime(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, timeZone);
}

function formatDate(d: Date, options: Intl.DateTimeFormatOptions): string {
  return d.toLocaleDateString("en-US", { ...options, timeZone: "UTC" });
}

function visibleRange(anchor: Date, view: View, timeZone: string): { days: Date[]; from: number; to: number; title: string } {
  if (view === "day") {
    const next = addDays(anchor, 1);
    return {
      days: [anchor],
      from: midnight(anchor, timeZone),
      to: midnight(next, timeZone),
      title: formatDate(anchor, { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
    };
  }
  if (view === "week") {
    const start = startOfWeek(anchor);
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    const end = days[6];
    const fmt = (d: Date) => formatDate(d, { month: "short", day: "numeric" });
    return {
      days,
      from: midnight(start, timeZone),
      to: midnight(addDays(start, 7), timeZone),
      title: `${fmt(start)} – ${fmt(end)}, ${end.getUTCFullYear()}`,
    };
  }
  const first = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1, 12));
  const last = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0, 12));
  const start = startOfWeek(first);
  const endExclusive = addDays(startOfWeek(last), 7);
  const count = Math.round((endExclusive.getTime() - start.getTime()) / DAY_MS);
  const days = Array.from({ length: count }, (_, i) => addDays(start, i));
  return {
    days,
    from: midnight(start, timeZone),
    to: midnight(endExclusive, timeZone),
    title: formatDate(first, { month: "long", year: "numeric" }),
  };
}

export function ContentCalendar({ slug }: { slug: string }) {
  const now = useNow();
  const timeZone = useQuery(api.content.calendarTimezone, { slug });
  if (now === null || timeZone === undefined) return <Skeleton className="h-80 w-full" />;
  return <CalendarInner slug={slug} now={now} timeZone={timeZone} />;
}

/** A scheduled date can open its daily agenda from both touch and desktop views. */
export function CalendarDaySelect({ day, onSelect }: { day: Date; onSelect: (day: Date) => void }) {
  const fullDate = formatDate(day, { weekday: "long", month: "long", day: "numeric" });
  return (
    <button
      type="button"
      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm text-ink hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 md:min-h-8 md:min-w-8"
      aria-label={`View ${fullDate}`}
      onClick={() => onSelect(day)}
    >
      <span className="md:hidden">{fullDate}</span>
      <span className="hidden md:inline" aria-hidden="true">{day.getUTCDate()}</span>
    </button>
  );
}

function CalendarInner({ slug, now, timeZone }: { slug: string; now: number; timeZone: string }) {
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState(() => calendarDate(now, timeZone));
  const range = visibleRange(anchor, view, timeZone);
  const todayKey = dateKey(calendarDate(now, timeZone));

  const shift = (dir: -1 | 1) => {
    setAnchor((a) => view === "day"
      ? addDays(a, dir)
      : view === "week"
        ? addDays(a, 7 * dir)
        : new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + dir, 1, 12)));
  };

  return (
    <section aria-labelledby="calendar-heading" className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <IconButton variant="secondary" aria-label={`Previous ${view}`} icon={<ChevronLeft />} onClick={() => shift(-1)} />
          <h2 id="calendar-heading" className="heading-section min-w-0 flex-1 text-center sm:min-w-56" aria-live="polite">
            {range.title}
          </h2>
          <IconButton variant="secondary" aria-label={`Next ${view}`} icon={<ChevronRight />} onClick={() => shift(1)} />
          <Button variant="ghost" onClick={() => setAnchor(calendarDate(now, timeZone))}>Today</Button>
        </div>
        <Segmented<View>
          label="Calendar view"
          value={view}
          onChange={setView}
          options={[
            { value: "day", label: "Day" },
            { value: "week", label: "Week" },
            { value: "month", label: "Month" },
          ]}
          className="self-start sm:self-auto"
        />
      </div>
      <p className="text-xs text-ink-3">Times shown in {timeZone}</p>
      <SectionBoundary label="the calendar" key={`${range.from}-${range.to}`}>
        <CalendarGrid
          slug={slug}
          days={range.days}
          from={range.from}
          to={range.to}
          todayKey={todayKey}
          view={view}
          anchorMonth={anchor.getUTCMonth()}
          timeZone={timeZone}
          onSelectDay={(day) => { setAnchor(day); setView("day"); }}
        />
      </SectionBoundary>
    </section>
  );
}

function CalendarGrid({
  slug,
  days,
  from,
  to,
  todayKey,
  view,
  anchorMonth,
  timeZone,
  onSelectDay,
}: {
  slug: string;
  days: Date[];
  from: number;
  to: number;
  todayKey: string;
  view: View;
  anchorMonth: number;
  timeZone: string;
  onSelectDay: (day: Date) => void;
}) {
  const result = useQuery(api.content.calendar, { slug, from, to });
  const items = result?.items;
  const byDay = new Map<string, NonNullable<typeof items>>();
  for (const it of items ?? []) {
    const k = dateKeyAt(it.scheduledFor, timeZone);
    const list = byDay.get(k) ?? [];
    list.push(it);
    byDay.set(k, list);
  }
  for (const list of byDay.values()) list.sort((a, b) => a.scheduledFor - b.scheduledFor);
  const total = items?.length ?? 0;

  return (
    <div aria-busy={items === undefined}>
      <p className="sr-only" role="status">
        {items === undefined ? "Loading calendar…" : `${total} item${total === 1 ? "" : "s"} in this ${view}.`}
      </p>
      {result?.limitsReached && (result.limitsReached.scheduledPosts || result.limitsReached.autopilotSlots) ? (
        <CalendarLimitNotice limitsReached={result.limitsReached} />
      ) : null}
      {items !== undefined && total === 0 ? (
        <Callout tone="info" className="mb-4">Nothing scheduled this {view}.</Callout>
      ) : null}
      {view !== "day" ? (
        <div aria-hidden="true" className="hidden grid-cols-7 gap-px md:grid">
          {WEEKDAYS.map((d) => <div key={d} className="px-3 pb-2 text-xs font-medium text-ink-3">{d}</div>)}
        </div>
      ) : null}
      <ol className={cn(
        "flex flex-col gap-2 md:rounded-xl md:border md:border-line md:bg-line",
        view === "day" ? "md:gap-0" : "md:grid md:grid-cols-7 md:gap-px md:overflow-hidden",
      )}>
        {days.map((d) => {
          const k = dateKey(d);
          const list = byDay.get(k) ?? [];
          const isToday = k === todayKey;
          const outside = view === "month" && d.getUTCMonth() !== anchorMonth;
          const fullDate = formatDate(d, { weekday: "long", month: "long", day: "numeric" });
          return (
            <li
              key={k}
              className={cn(
                "flex min-w-0 flex-col gap-2 rounded-xl border border-line bg-surface p-3 md:rounded-none md:border-0",
                view === "month" ? "md:min-h-28" : view === "day" ? "md:min-h-96" : "md:min-h-56",
                list.length === 0 && !isToday && "hidden md:flex",
                outside && "md:bg-surface-2",
                isToday && "border-brand-700 ring-2 ring-inset ring-brand-700 md:border-0",
              )}
              aria-current={isToday ? "date" : undefined}
            >
              <h3 className="heading-card flex flex-wrap items-center gap-2">
                {view === "day" ? <span>{fullDate}</span> : null}
                {view !== "day" ? (
                  <CalendarDaySelect day={d} onSelect={onSelectDay} />
                ) : null}
                {isToday ? <Badge tone="green">Today</Badge> : null}
              </h3>
              {items === undefined ? (
                <Skeleton className="h-8 w-full" />
              ) : list.length === 0 ? (
                <p className="text-xs text-ink-3 md:sr-only">Nothing scheduled.</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {list.map((it) => {
                    const href = it.artifactId ? `/app/${slug}/content/${it.artifactId}` : `/app/${slug}/autopilot`;
                    return (
                      <li key={`${it.id}`}>
                        <Link
                          href={href}
                          aria-label={`${it.title}, ${channelLabel(it.channel)}, ${new Date(it.scheduledFor).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone })}, ${it.status}${it.autopilot ? ", Autopilot" : ""}`}
                          className="flex flex-col gap-1 rounded-lg border border-line bg-surface-2 p-2 text-ui transition-colors hover:border-brand-700"
                        >
                          <span className="flex items-center gap-1.5 text-xs text-ink-3">
                            <SocialIcon network={it.channel} size="xs" />
                            <span>{new Date(it.scheduledFor).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone })} · {channelLabel(it.channel)}</span>
                            {it.autopilot ? <span className="ml-auto">Auto</span> : null}
                          </span>
                          <span className="line-clamp-2 font-medium text-ink">{it.title}</span>
                          {it.artifactId ? <ArtifactStatus status={it.status} /> : <AutopilotStatus status={it.status} />}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function CalendarLimitNotice({ limitsReached }: { limitsReached: { scheduledPosts: boolean; autopilotSlots: boolean } }) {
  const sources = [
    limitsReached.scheduledPosts ? "scheduled posts" : null,
    limitsReached.autopilotSlots ? "Autopilot slots" : null,
  ].filter(Boolean);
  if (sources.length === 0) return null;
  return (
    <Callout tone="warning" role="status">
      This date range reached the 300-item limit for {sources.join(" and ")}. It may be incomplete; narrow the date range to check the remaining items.
    </Callout>
  );
}

function AutopilotStatus({ status }: { status: string }) {
  const meta = AUTOPILOT_STATUS[status] ?? { label: status, tone: "neutral" as const };
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}
