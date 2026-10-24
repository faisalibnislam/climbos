"use client";

import { Discussion } from "@/components/app/Discussion";
import { RoleExplainer } from "@/components/app/RoleExplainer";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { ArrowRight } from "@/components/icons"
import Link from "next/link";
import { useParams } from "next/navigation";
import { BackLink, Badge, Button, Card, CardContent, CardHeader, CardTitle, NetworkLabel, StatusPill } from "@/components/ui";
import { OutputView } from "@/components/app/OutputView";
import { ConversionAuditView } from "@/components/app/ConversionAuditView";
import { relativeTime } from "@/components/app/money";
import { RunProgress } from "@/components/app/content/RunProgress";
import { ClampText } from "@/components/app/results/ClampText";
import { LoadingBlock, PageHeader } from "@/components/app/results/QueryBoundary";

/** Work receipt: what one job was asked to do, who did it, every step, its cost and what it produced. */
export default function WorkPage() {
  const { organization: slug, runId } = useParams<{ organization: string; runId: string }>();
  const run = useQuery(api.workspace.runDetail, { slug, runId: runId as Id<"workflowRuns"> });
  if (run === undefined) return <LoadingBlock label="Loading job" lines={4} />;
  const isPlan = run.kind === "strategy";
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-3">
        <BackLink href={`/app/${slug}/today`}>Today</BackLink>
        <PageHeader
          eyebrow={`Started ${relativeTime(run.createdAt)}`}
          title={run.title}
          intro={run.brief ? <ClampText inline>{run.brief}</ClampText> : undefined}
          actions={
            isPlan && run.status === "verified" ? (
              <Button asChild>
                <Link href={`/app/${slug}/plan`}>
                  Review plan <ArrowRight aria-hidden />
                </Link>
              </Button>
            ) : undefined
          }
        />
      </div>

      {run.isFixture ? <StatusPill status="demo" /> : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        <div className="flex min-w-0 flex-col gap-6">
          {/* Live while running; afterwards a receipt of every step, its timing and what it found. */}
          <Card>
            <CardContent>
              <RunProgress slug={slug} runId={run.id as Id<"workflowRuns">} headingLevel="h2" />
            </CardContent>
          </Card>

          {run.artifacts.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2" className="flex items-center gap-2">
                  Drafts <Badge tone="neutral">{run.artifacts.length}</Badge>
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
                {run.kind === "conversion_audit" ? <ConversionAuditView value={run.output} slug={slug} /> : <OutputView value={run.output} />}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <aside className="flex flex-col gap-4">
          <Card>
            <CardContent>
              <Discussion slug={slug} subjectType="run" subjectId={run.id} title={run.title} href={`/app/${slug}/work/${run.id}`} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle as="h2">Team</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1 pt-3">
              {run.roles.map((r) => (
                <RoleExplainer key={r} role={r} />
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
