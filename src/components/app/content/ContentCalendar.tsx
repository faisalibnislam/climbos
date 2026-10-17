"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge, Button, Callout, IconButton, Skeleton, SocialIcon } from "@/components/ui";
import { cn } from "@/lib/utils";
import { Segmented } from "@/components/ui/segmented";
import { ArtifactStatus, SectionBoundary, browserTimeZone, channelLabel, useNow } from "./shared";

type View = "week" | "month";

const DAY_MS = 86_400_000;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Monday-based start of week. */
function startOfWeek(d: Date): Date {
  const s = startOfDay(d);
  const dow = (s.getDay() + 6) % 7;
  return new Date(s.getFullYear(), s.getMonth(), s.getDate() - dow);
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Visible days for a view: one week, or the full weeks covering a month (≤ 42 days). */
function visibleRange(anchor: Date, view: View): { days: Date[]; from: number; to: number; title: string } {
  if (view === "week") {
    const start = startOfWeek(anchor);
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    const end = days[6];
    const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return { days, from: start.getTime(), to: addDays(start, 7).getTime(), title: `${fmt(start)} – ${fmt(end)}, ${end.getFullYear()}` };
  }
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const start = startOfWeek(first);
  const endExclusive = addDays(startOfWeek(last), 7);
  const count = Math.round((endExclusive.getTime() - start.getTime()) / DAY_MS);
  const days = Array.from({ length: count }, (_, i) => addDays(start, i));
  return {
    days,
    from: start.getTime(),
    to: endExclusive.getTime(),
    title: first.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
  };
}

export function ContentCalendar({ slug }: { slug: string }) {
  const now = useNow();
  if (now === null) {
    return <Skeleton className="h-80 w-full" />;
  }
  return <CalendarInner slug={slug} now={now} />;
}

function CalendarInner({ slug, now }: { slug: string; now: number }) {
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState(() => startOfDay(new Date(now)));
  const range = visibleRange(anchor, view);
  const todayKey = dayKey(new Date(now));

  const shift = (dir: -1 | 1) => {
    setAnchor((a) => (view === "week" ? addDays(a, 7 * dir) : new Date(a.getFullYear(), a.getMonth() + dir, 1)));
  };

  return (
    <section aria-labelledby="calendar-heading" className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <IconButton variant="secondary" aria-label={view === "week" ? "Previous week" : "Previous month"} icon={<ChevronLeft />} onClick={() => shift(-1)} />
          <h2 id="calendar-heading" className="heading-section min-w-0 flex-1 text-center sm:min-w-56" aria-live="polite">
            {range.title}
          </h2>
          <IconButton variant="secondary" aria-label={view === "week" ? "Next week" : "Next month"} icon={<ChevronRight />} onClick={() => shift(1)} />
          <Button variant="ghost" onClick={() => setAnchor(startOfDay(new Date(now)))}>
            Today
          </Button>
        </div>
        <Segmented<View>
          label="Calendar view"
          value={view}
          onChange={setView}
          options={[
            { value: "week", label: "Week" },
            { value: "month", label: "Month" },
          ]}
          className="self-start sm:self-auto"
        />
      </div>
      <p className="text-sm text-ink-3">
        Times are shown in your time zone ({browserTimeZone()}). “Scheduled in ClimbOS” means ClimbOS will send it then; it isn&apos;t on the platform until the
        platform accepts it.
      </p>
      <SectionBoundary label="the calendar" key={`${range.from}-${range.to}`}>
        <CalendarGrid slug={slug} days={range.days} from={range.from} to={range.to} todayKey={todayKey} view={view} anchorMonth={anchor.getMonth()} />
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
}: {
  slug: string;
  days: Date[];
  from: number;
  to: number;
  todayKey: string;
  view: View;
  anchorMonth: number;
}) {
  const items = useQuery(api.content.calendar, { slug, from, to });
  const byDay = new Map<string, NonNullable<typeof items>>();
  for (const it of items ?? []) {
    const k = dayKey(new Date(it.scheduledFor));
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
      {items !== undefined && total === 0 ? (
        <Callout tone="info" className="mb-4">
          Nothing is scheduled in this {view}. Approved content you schedule shows up here.
        </Callout>
      ) : null}
      <div aria-hidden="true" className="hidden grid-cols-7 gap-px md:grid">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-3 pb-2 text-xs font-medium text-ink-3">
            {d}
          </div>
        ))}
      </div>
      <ol className="flex flex-col gap-2 md:grid md:grid-cols-7 md:gap-px md:overflow-hidden md:rounded-xl md:border md:border-line md:bg-line">
        {days.map((d) => {
          const k = dayKey(d);
          const list = byDay.get(k) ?? [];
          const isToday = k === todayKey;
          const outside = view === "month" && d.getMonth() !== anchorMonth;
          const fullDate = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
          return (
            <li
              key={k}
              className={cn(
                "flex min-w-0 flex-col gap-2 rounded-xl border border-line bg-surface p-3 md:rounded-none md:border-0",
                view === "month" ? "md:min-h-28" : "md:min-h-56",
                list.length === 0 && !isToday && "hidden md:flex",
                outside && "md:bg-surface-2",
                isToday && "border-brand-700 ring-2 ring-inset ring-brand-700 md:border-0",
              )}
              aria-current={isToday ? "date" : undefined}
            >
              <h3 className="heading-card flex flex-wrap items-center gap-2">
                <span className="md:hidden">{fullDate}</span>
                <span className={cn("hidden md:inline", outside ? "text-ink-3" : "text-ink")}>
                  <span className="sr-only">{fullDate}</span>
                  <span aria-hidden="true">{d.getDate()}</span>
                </span>
                {isToday ? <Badge tone="green">Today</Badge> : null}
              </h3>
              {items === undefined ? (
                <Skeleton className="h-8 w-full" />
              ) : list.length === 0 ? (
                <p className="text-xs text-ink-3 md:sr-only">Nothing scheduled.</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {list.map((it) => {
                    return (
                      <li key={it.id}>
                        <Link
                          href={`/app/${slug}/content/${it.id}`}
                          className="flex flex-col gap-1 rounded-lg border border-line bg-surface-2 p-2 text-ui transition-colors hover:border-brand-700"
                        >
                          <span className="flex items-center gap-1.5 text-xs text-ink-3">
                            <SocialIcon network={it.channel} size="xs" />
                            <span>
                              {new Date(it.scheduledFor).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} · {channelLabel(it.channel)}
                            </span>
                          </span>
                          <span className="line-clamp-2 font-medium text-ink">{it.title}</span>
                          <ArtifactStatus status={it.status} />
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
