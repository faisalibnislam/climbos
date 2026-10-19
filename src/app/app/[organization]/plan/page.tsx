"use client";

import { Discussion } from "@/components/app/Discussion";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Compass, Target } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Badge, Button, Callout, Card, CardContent, EmptyState, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger, buttonClasses, type Tone } from "@/components/ui";
import { ChannelScorecard } from "@/components/app/plan/ChannelScorecard";
import { formatDateTime } from "@/components/app/money";
import { GeneratePlanButton, PlanReviewCard, StrategyRunWatcher } from "@/components/app/plan/PlanActions";
import { PlanToAirly } from "@/components/app/connections/AirlyApps";
import type { Economics } from "../../../../../shared/agents/economics";
import { SharpenPlan } from "@/components/app/plan/SharpenPlan";
import type { QualityState } from "../../../../../shared/agents/quality";
import { ExecutionPlan, GrowthPlays, NorthStar, type ExpertView, type PlayView } from "@/components/app/plan/ExpertPlan";
import { Audiences, BusinessInsights, Channels, Experiments, PlanBasics, RecentWork, ShortVersion, Sources, type PlanView } from "@/components/app/plan/PlanSections";
import { RetryRunIfPossible, RUN_FINISHED } from "@/components/app/content/RunProgress";
import { PageHeader } from "@/components/app/results/QueryBoundary";
import { PERMISSION_WHO, SectionBoundary, majorToDisplay, useNow } from "@/components/app/content/shared";

const STRATEGY_STATUS: Record<string, { label: string; tone: Tone }> = {
  draft: { label: "Sent back — draft", tone: "neutral" },
  needs_approval: { label: "Needs your approval", tone: "amber" },
  approved: { label: "Approved", tone: "green" },
  superseded: { label: "Superseded", tone: "neutral" },
};

export default function PlanPage() {
  const { organization: slug } = useParams<{ organization: string }>();
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <SectionBoundary pageHeading="Your growth plan" label="your plan">
        <PlanScreen slug={slug} />
      </SectionBoundary>
    </div>
  );
}

function GoalCard({ goal, slug }: { goal: PlanView["goal"]; slug: string }) {
  if (!goal) {
    return (
      <Callout
        tone="info"
        title="Set a goal first"
        action={
          <Link href={`/app/${slug}/settings/business`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
            Set your goal
          </Link>
        }
      >
        Your plan is built around one clear goal, like “20 more bookings a month”.
      </Callout>
    );
  }
  return (
    <section aria-labelledby="goal-heading">
      <Card className="bg-brand-50">
        <CardContent className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h2 id="goal-heading" className="text-overline flex items-center gap-1.5">
              <Target aria-hidden="true" className="size-3.5 text-brand-800" /> Your goal
            </h2>
            <Link href={`/app/${slug}/settings/business`} className={buttonClasses({ variant: "link", size: "sm" })}>
              Change
            </Link>
          </div>
          <p className="heading-section">{goal.statement}</p>
          <p className="text-sm text-ink-2">
            Over the next {goal.horizonDays} days ·{" "}
            {goal.monthlyAdBudget > 0 ? `Up to ${majorToDisplay(goal.monthlyAdBudget, goal.currency)} a month for ads, paid directly to the ad platforms` : "No ad budget"}
          </p>
        </CardContent>
      </Card>
    </section>
  );
}

function PlanScreen({ slug }: { slug: string }) {
  // Which version is on screen: the approved one by default, or a newer one being reviewed.
  const [viewId, setViewId] = useState<Id<"strategies"> | null>(null);
  const plan = useQuery(api.workspace.plan, viewId ? { slug, strategyId: viewId } : { slug });
  const now = useNow();
  const [startedRunId, setStartedRunId] = useState<Id<"workflowRuns"> | null>(null);

  if (plan === undefined) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        <PageHeader section="plan" title="Your growth plan" />
        <span className="sr-only" role="status">
          Loading your plan…
        </span>
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const s = plan.strategy;
  const status = s ? (STRATEGY_STATUS[s.status] ?? { label: s.status, tone: "neutral" as Tone }) : null;
  const other = plan.otherVersion;
  const building = Boolean(plan.strategyRun && !RUN_FINISHED.has(plan.strategyRun.status));
  // A refresh that stopped after the newest version was written (otherwise it vanishes after a reload).
  const run = plan.strategyRun;
  const refreshStopped = Boolean(s && run && ["failed", "canceled", "uncertain"].includes(run.status) && run.createdAt > (plan.latestVersionAt ?? 0) && run.id !== startedRunId);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        section="plan"
        title="Your growth plan"
        intro={
          s && status ? (
            <span className="flex flex-col gap-1">
              <span className="flex flex-wrap items-center gap-2 text-ink-2">
                <Badge tone={status.tone}>{status.label}</Badge>
                <span>
                  Version {s.version}
                  {now ? ` · created ${formatDateTime(s.createdAt)}` : ""}
                </span>
              </span>
              {s.version > 1 ? <span className="text-xs">Earlier versions are kept as superseded and no longer guide the team.</span> : null}
            </span>
          ) : (
            "Your AI CEO and CMO turn your goal into a plan: who to reach, which channels, what to test."
          )
        }
        actions={
          s && plan.canEdit ? (
            <div className="flex flex-wrap items-start gap-2">
              <PlanToAirly slug={slug} />
              <GeneratePlanButton slug={slug} mode="refresh" nextVersion={s.version + 1} estimateMicros={plan.planEstimateMicros} onStarted={setStartedRunId} building={building} />
            </div>
          ) : null
        }
      />

      <GoalCard goal={plan.goal} slug={slug} />

      <SectionBoundary label="plan progress">
        <StrategyRunWatcher
          slug={slug}
          startedRunId={startedRunId}
          activeRunId={plan.strategyRun && !RUN_FINISHED.has(plan.strategyRun.status) ? plan.strategyRun.id : null}
          onDismiss={() => setStartedRunId(null)}
        />
      </SectionBoundary>

      {refreshStopped && run ? (
        <Callout
          tone="danger"
          live="none"
          title="The last plan refresh didn't finish"
          action={
            <Link href={`/app/${slug}/work/${run.id}`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
              See what happened
            </Link>
          }
        >
          {run.userMessage ?? "Your current plan still guides the team."}
          {plan.canEdit ? <RetryRunIfPossible slug={slug} runId={run.id} className="mt-3" /> : null}
        </Callout>
      ) : null}

      {s && other ? (
        <Callout
          tone={other.status === "needs_approval" || s.status === "needs_approval" ? "warning" : "info"}
          title={
            s.status === "approved"
              ? other.status === "needs_approval"
                ? `Version ${other.version} is waiting for approval`
                : `Version ${other.version} was sent back`
              : `You're viewing version ${s.version}. Version ${other.version} (approved) still guides the team.`
          }
          action={
            <Button size="sm" variant="secondary" onClick={() => setViewId(s.status === "approved" ? other.id : null)}>
              {s.status === "approved" ? `See version ${other.version}` : "Back to the approved plan"}
            </Button>
          }
        >
          {s.status === "approved" ? "The approved plan below keeps guiding the team until a new version is approved." : "Approving this version replaces it."}
        </Callout>
      ) : null}

      <Tabs defaultValue="plan">
        <TabsList>
          <TabsTrigger value="plan">Plan</TabsTrigger>
          <TabsTrigger value="channels">Channels</TabsTrigger>
        </TabsList>
        <TabsContent value="channels" className="mt-5">
          <ChannelScorecard slug={slug} />
        </TabsContent>
        <TabsContent value="plan" className="mt-5 flex flex-col gap-6">
      {!s ? (
        <>
          {plan.strategyRun?.status === "failed" && plan.strategyRun.userMessage ? (
            <Callout tone="danger" live="none" title="The last attempt didn't finish">
              {plan.strategyRun.userMessage}
              {plan.canEdit ? <RetryRunIfPossible slug={slug} runId={plan.strategyRun.id} className="mt-3" /> : null}
            </Callout>
          ) : null}
          <EmptyState
            icon={<Compass />}
            headingLevel="h2"
            title="You don't have a plan yet"
            body="Your team drafts a plan from your goal and what it learned about your business. You review it before any work starts."
            action={
              plan.canEdit ? (
                plan.goal ? (
                  <GeneratePlanButton slug={slug} mode="build" estimateMicros={plan.planEstimateMicros} onStarted={setStartedRunId} building={building} />
                ) : (
                  <p className="text-sm text-ink-2">Set a goal first, then build your plan.</p>
                )
              ) : (
                <p className="text-sm text-ink-2">Building a plan needs {PERMISSION_WHO.edit}.</p>
              )
            }
          />
        </>
      ) : (
        <>
          {s.status === "needs_approval" ? <PlanReviewCard slug={slug} strategyId={s.id} version={s.version} canApprove={plan.canApprove} onDecided={() => setViewId(null)} quality={(s.expert as { quality?: { state: QualityState; reasons: string[] } } | null)?.quality ?? null} /> : null}
          {s.status === "draft" ? (
            <Callout tone="warning" title="This plan was sent back">
              No work starts from it. {plan.canEdit ? "Use “Refresh plan” to get a new version." : `Ask ${PERMISSION_WHO.edit} to refresh it.`}
            </Callout>
          ) : null}
          {s.status === "superseded" ? (
            <Callout tone="info" title="This version has been superseded">
              A newer approved plan guides the team now.
            </Callout>
          ) : null}
          <ShortVersion strategy={s} />
          {s.expert ? <NorthStar expert={s.expert as ExpertView} /> : null}
          {s.expert?.plays?.length ? <SharpenPlan slug={slug} questions={plan.questions} canEdit={plan.canEdit} answersNewer={plan.answersNewerThanPlan} /> : null}
          {s.expert?.plays?.length ? <GrowthPlays plays={s.expert.plays as PlayView[]} slug={slug} economics={(s.expert as { economics?: Economics }).economics} strategyId={s.status === "approved" ? s.id : undefined} planId={s.id} canEdit={plan.canEdit} focused={Boolean((s.expert as ExpertView).decision)} /> : null}
          {s.expert ? <ExecutionPlan expert={s.expert as ExpertView} /> : null}
          <Audiences strategy={s} />
          <Channels slug={slug} strategy={s} canEdit={plan.canEdit} currency={plan.currency} />
          <Experiments experiments={plan.experiments} />
          <PlanBasics strategy={s} />
        </>
      )}

      <BusinessInsights insights={plan.insights} />
      {s ? <Sources sources={plan.sources} web={(s.expert as { webSources?: { url: string; title?: string }[] } | null)?.webSources ?? []} /> : null}
      {s ? <Discussion slug={slug} subjectType="strategy" subjectId={s.id} title={`Growth plan v${s.version}`} href={`/app/${slug}/plan`} /> : null}
        </TabsContent>
      </Tabs>

      <SectionBoundary label="recent work">
        <RecentWork slug={slug} />
      </SectionBoundary>
    </div>
  );
}
