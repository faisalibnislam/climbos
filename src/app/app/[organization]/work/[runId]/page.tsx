"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { ArrowRight, CircleCheck, CircleDashed, CircleX, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { BackLink, Badge, Button, Callout, Card, CardContent, CardHeader, CardTitle, NetworkLabel, StatusPill } from "@/components/ui";
import { OutputView } from "@/components/app/OutputView";
import { RoleAvatar } from "@/components/app/RoleAvatar";
import { microsToDisplay, relativeTime } from "@/components/app/money";
import { roleTitle } from "@/components/app/roles";
import { LoadingBlock, PageHeader } from "@/components/app/results/QueryBoundary";

const ACTIVE = new Set(["cost_reserved", "preparing", "executing"]);

/** Work receipt: what one job was asked to do, who did it, every step, its cost and what it produced. */
export default function WorkPage() {
  const { organization: slug, runId } = useParams<{ organization: string; runId: string }>();
  const run = useQuery(api.workspace.runDetail, { slug, runId: runId as Id<"workflowRuns"> });
  if (run === undefined) return <LoadingBlock label="Loading this job" lines={4} />;
  const active = ACTIVE.has(run.status);
  const isPlan = run.kind === "strategy";
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-3">
        <BackLink href={`/app/${slug}/today`}>Back to Today</BackLink>
        <PageHeader
          eyebrow={`Started ${relativeTime(run.createdAt)}`}
          title={run.title}
          intro={run.brief ? `You asked: ${run.brief.slice(0, 220)}${run.brief.length > 220 ? "…" : ""}` : undefined}
          actions={
            isPlan && run.status === "verified" ? (
              <Button asChild>
                <Link href={`/app/${slug}/plan`}>
                  Review the plan <ArrowRight aria-hidden />
                </Link>
              </Button>
            ) : undefined
          }
        />
      </div>

      {run.isFixture ? <StatusPill status="demo" /> : null}
      {run.status === "failed" && run.userMessage ? <Callout tone="danger" title="This job didn't finish">{run.userMessage}</Callout> : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        <div className="flex min-w-0 flex-col gap-6">
          {active ? (
            <Card>
              <CardContent className="flex items-center gap-3">
                <Loader2 aria-hidden className="size-5 animate-spin text-brand-800" />
                <div>
                  <p className="heading-card">Your team is on it</p>
                  <p className="text-ui text-ink-3">This page updates by itself as each step finishes.</p>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {run.artifacts.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">
                  {run.artifacts.length} draft{run.artifacts.length === 1 ? "" : "s"} ready for you
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 pt-3">
                <ul className="divide-y divide-line border-t border-line">
                  {run.artifacts.map((a) => (
                    <li key={a.id}>
                      <Link href={`/app/${slug}/content/${a.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-2">
                        <NetworkLabel network={a.channel} className="w-28 shrink-0 text-ui text-ink-3" />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{a.title}</span>
                        <Badge tone={a.status === "in_review" ? "amber" : a.status === "published" ? "green" : "neutral"}>{a.status === "in_review" ? "Needs your OK" : a.status.replace("_", " ")}</Badge>
                        <ArrowRight aria-hidden className="size-4 text-ink-3" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          {run.output && typeof run.output === "object" && !isPlan && run.artifacts.length === 0 ? (
            <Card>
              <CardContent>
                <OutputView value={run.output} />
              </CardContent>
            </Card>
          ) : null}
        </div>

        <aside className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle as="h2">Who worked on it</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 pt-3">
              {run.roles.map((r) => (
                <span key={r} className="flex items-center gap-2 text-ui text-ink-2">
                  <RoleAvatar role={r} size="xs" /> {roleTitle(r)}
                </span>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle as="h2">Steps</CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              <ol className="flex flex-col gap-2">
                {run.steps.map((s, i) => (
                  <li key={i} className="flex items-center gap-2 text-ui">
                    {s.status === "succeeded" ? (
                      <CircleCheck aria-hidden className="size-4 text-brand-800" />
                    ) : s.status === "running" ? (
                      <Loader2 aria-hidden className="size-4 animate-spin text-brand-800" />
                    ) : s.status === "failed" ? (
                      <CircleX aria-hidden className="size-4 text-red-800" />
                    ) : (
                      <CircleDashed aria-hidden className="size-4 text-ink-3" />
                    )}
                    <span className={s.status === "succeeded" || s.status === "running" ? "text-ink" : "text-ink-3"}>{s.label}</span>
                    <span className="sr-only">({s.status})</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col gap-1 text-ui">
              <span className="flex justify-between">
                <span className="text-ink-3">AI capacity used</span>
                <span className="font-medium tabular-nums">{microsToDisplay(run.actualMicros)}</span>
              </span>
              <span className="flex justify-between">
                <span className="text-ink-3">Most it could use</span>
                <span className="tabular-nums text-ink-2">{microsToDisplay(run.estimateMicros)}</span>
              </span>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
