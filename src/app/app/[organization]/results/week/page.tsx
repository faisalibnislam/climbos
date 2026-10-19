"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, CircleDashed, ListChecks, Users } from "@/components/icons"
import { useParams } from "next/navigation";
import { useState } from "react";
import { LoadingBlock, PageHeader } from "@/components/app/results/QueryBoundary";
import { Button, Card, CardContent } from "@/components/ui";
import { cn } from "@/lib/utils";
import { ClientReportCard } from "@/components/app/results/ClientReportCard";
import { Prose } from "@/components/ds/content";
import { Highlight, StatBlocks } from "@/components/ds/content";

const fmt = (ms: number) => new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** Weekly CEO report: outcomes first, then what needs you next week. */
export default function WeekReportPage() {
  const { organization: slug } = useParams<{ organization: string }>();
  const [weeksAgo, setWeeksAgo] = useState(0);
  const r = useQuery(api.reports.weekly, { slug, weeksAgo });
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader
        section="results"
        title={weeksAgo === 0 ? "This week" : weeksAgo === 1 ? "Last week" : `${weeksAgo} weeks ago`}
        intro={r ? `${fmt(r.weekStart)}–${fmt(r.weekEnd - 1)}` : undefined}
        actions={
          <div className="flex gap-1">
            <Button size="sm" variant="secondary" aria-label="Earlier week" disabled={weeksAgo >= 12} onClick={() => setWeeksAgo((w) => w + 1)}>
              <ChevronLeft aria-hidden />
            </Button>
            <Button size="sm" variant="secondary" aria-label="Later week" disabled={weeksAgo === 0} onClick={() => setWeeksAgo((w) => Math.max(0, w - 1))}>
              <ChevronRight aria-hidden />
            </Button>
          </div>
        }
      />
      {r === undefined ? (
        <LoadingBlock label="Loading report…" lines={4} />
      ) : (
        <>
          <p className="heading-section">{r.headline}</p>
          {r.lines.length ? (
            <StatBlocks
              stats={r.lines.map((l) => {
                const good = (l.change ?? 0) > 0 === (l.key !== "creditsUsed");
                return {
                  label: l.label,
                  value: l.value.toLocaleString("en-US"),
                  hint: l.change ? (
                    <span className={cn("inline-flex items-center gap-0.5 font-medium tabular-nums", good ? "text-brand-800" : "text-red-800")}>
                      {l.change > 0 ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />}
                      <span className="sr-only">{l.change > 0 ? "Up" : "Down"} </span>
                      {Math.abs(l.change).toLocaleString("en-US")}
                    </span>
                  ) : undefined,
                };
              })}
            />
          ) : null}
          {r.next.length ? (
            <Card>
              <CardContent className="flex flex-col gap-3">
                <h2 className="heading-card flex items-center gap-2">
                  <ListChecks aria-hidden className="size-4 text-brand-800" /> {weeksAgo === 0 ? "Needs you" : "Next up"}
                </h2>
                <ul className="flex flex-col gap-1.5 text-sm text-ink">
                  {r.next.map((n) => (
                    <li key={n} className="flex gap-2">
                      <CircleDashed aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-3" />
                      <span className="min-w-0">
                        <Highlight text={n} />
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
          {r.competitors?.length ? (
            <Card>
              <CardContent className="flex flex-col gap-3">
                <h2 className="heading-card flex items-center gap-2">
                  <Users aria-hidden className="size-4 text-brand-800" /> Competitors
                </h2>
                <ul className="flex flex-col divide-y divide-line">
                  {r.competitors.map((c, i) => (
                    <li key={i} className="flex flex-col gap-1 py-2.5 first:pt-0 last:pb-0">
                      <span className="text-sm font-medium text-ink">{c.name}</span>
                      <Prose text={c.summary} max={2} tone="muted" className="text-sm" />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
      <ClientReportCard slug={slug} />
    </div>
  );
}
