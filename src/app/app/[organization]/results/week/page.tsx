"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { LoadingBlock, PageHeader } from "@/components/app/results/QueryBoundary";
import { Button, Card, CardContent } from "@/components/ui";
import { cn } from "@/lib/utils";
import { ClientReportCard } from "@/components/app/results/ClientReportCard";

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
        intro={r ? `${fmt(r.weekStart)}–${fmt(r.weekEnd - 1)}. Emailed every Monday.` : undefined}
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
        <LoadingBlock label="Loading the report…" lines={4} />
      ) : (
        <>
          <p className="heading-section">{r.headline}</p>
          {r.lines.length ? (
            <ul className="grid gap-3 sm:grid-cols-3">
              {r.lines.map((l) => (
                <li key={l.key}>
                  <Card className="h-full">
                    <CardContent className="flex flex-col gap-1">
                      <span className="text-xs text-ink-3">{l.label}</span>
                      <span className="flex items-baseline gap-2">
                        <span className="text-2xl font-semibold tabular-nums text-ink">{l.value.toLocaleString("en-US")}</span>
                        {l.change ? (
                          <span className={cn("inline-flex items-center text-xs font-medium", l.change > 0 === (l.key !== "creditsUsed") ? "text-brand-800" : "text-red-800")}>
                            {l.change > 0 ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />}
                            {Math.abs(l.change).toLocaleString("en-US")}
                          </span>
                        ) : null}
                      </span>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          ) : null}
          {r.competitors?.length ? (
            <Card>
              <CardContent className="flex flex-col gap-2">
                <p className="heading-card">Competitors</p>
                <ul className="space-y-1 text-sm text-ink-2">
                  {r.competitors.map((c, i) => (
                    <li key={i}>
                      <span className="font-medium text-ink">{c.name}:</span> {c.summary}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
          {r.next.length ? (
            <Card>
              <CardContent className="flex flex-col gap-2">
                <p className="heading-card">{weeksAgo === 0 ? "Needs you" : "Next up"}</p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">
                  {r.next.map((n) => (
                    <li key={n}>{n}</li>
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
