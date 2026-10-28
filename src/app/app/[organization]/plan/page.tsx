"use client";

import { Discussion } from "@/components/app/Discussion";
import { useQueries, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Compass, Target } from "@/components/icons"
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { Badge, Button, Callout, Card, CardContent, EmptyState, Skeleton, buttonClasses, type Tone } from "@/components/ui";
import { GeneratePlanButton, PlanReviewCard, StrategyRunWatcher, useStrategyRunState } from "@/components/app/plan/PlanActions";
import { PlanToConnectedApps } from "@/components/app/connections/ConnectedProducts";
import type { Economics } from "../../../../../shared/agents/economics";
import { formatMoney } from "../../../../../shared/economics/currency";
import type { KnowledgeReferenceSet } from "../../../../../shared/knowledge/retrieve";
import { SharpenPlan } from "@/components/app/plan/SharpenPlan";
import { HelpClimbOS } from "@/components/app/plan/HelpClimbOS";
import type { QualityFix, QualityState } from "../../../../../shared/agents/quality";
import type { Diagnosis } from "../../../../../shared/agents/diagnosis";
import { ExecutionPlan, GrowthPlays, NorthStar, type ExpertView, type PlayView } from "@/components/app/plan/ExpertPlan";
import { Audiences, BusinessInsights, Channels, Experiments, PlanBasics, RecentWork, ShortVersion, Sources, type PlanView } from "@/components/app/plan/PlanSections";
import { RetryRunIfPossible, RUN_FINISHED } from "@/components/app/content/RunProgress";
import { PageHeader } from "@/components/app/results/QueryBoundary";
import { PERMISSION_WHO, SectionBoundary, majorToDisplay } from "@/components/app/content/shared";
import { PlanJumpNav } from "@/components/app/plan/PlanJumpNav";
import { FollowerGrowth } from "@/components/app/followers/FollowerGrowth";
import { OlderVersionBar, PlanCompare, RestoreDialog, VersionPicker, usePlanVersions } from "@/components/app/plan/history/PlanHistory";

const STRATEGY_STATUS: Record<string, { label: string; tone: Tone }> = {
  draft: { label: "Sent back", tone: "red" },
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

function PlanImpactSummary({ impact }: { impact: NonNullable<PlanView["planImpact"]> }) {
  const formatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
  const changed = impact.plays.filter((play) =>
    play.before.p10 !== play.after.p10 || play.before.p50 !== play.after.p50 || play.before.p90 !== play.after.p90
      || Boolean(play.economicsBefore && play.economicsAfter && (play.economicsBefore.cacUsd !== play.economicsAfter.cacUsd || play.economicsBefore.paybackMonths !== play.economicsAfter.paybackMonths || play.economicsBefore.profitable !== play.economicsAfter.profitable)),
  );
  const portfolioChanged = impact.portfolio.before && impact.portfolio.after
    ? impact.portfolio.before.selected.join("\u0000") !== impact.portfolio.after.selected.join("\u0000")
      || impact.portfolio.before.customers !== impact.portfolio.after.customers
      || impact.portfolio.before.cashSpendUsdMonth !== impact.portfolio.after.cashSpendUsdMonth
    : false;
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div>
          <h2 className="heading-section">What changed in the modeled outlook</h2>
          <p className="mt-1 text-sm text-ink-2">The saved play models stay fixed while current unit economics and portfolio limits are recalculated. Changes to your funnel, research, business facts, brand, or tools need a full plan refresh and are not represented here. These are scenarios, not actual results or a refreshed recommendation.</p>
        </div>
        {changed.length ? (
          <div className="flex flex-col gap-2">
            {changed.map((play) => (
              <div key={play.id} className="grid gap-1 rounded-[var(--radius-control)] border border-line p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <p className="min-w-0 text-sm font-medium">{play.name}</p>
                <p className="text-xs tabular-nums text-ink-2">
                  P10 / P50 / P90 customers: {play.before.p10 === null ? "—" : formatter.format(play.before.p10)} / {play.before.p50 === null ? "—" : formatter.format(play.before.p50)} / {play.before.p90 === null ? "—" : formatter.format(play.before.p90)}
                  <span aria-hidden="true"> → </span>
                  {play.after.p10 === null ? "—" : formatter.format(play.after.p10)} / {play.after.p50 === null ? "—" : formatter.format(play.after.p50)} / {play.after.p90 === null ? "—" : formatter.format(play.after.p90)}
                  {play.economicsBefore && play.economicsAfter ? (
                    <span className="block mt-1">
                      CAC {play.economicsBefore.cacUsd === null ? "unknown" : formatMoney(play.economicsBefore.cacUsd, impact.currency)} → {play.economicsAfter.cacUsd === null ? "unknown" : formatMoney(play.economicsAfter.cacUsd, impact.currency)}
                      {" · "}payback {play.economicsBefore.paybackMonths === null ? "unknown" : `${formatter.format(play.economicsBefore.paybackMonths)} mo`} → {play.economicsAfter.paybackMonths === null ? "unknown" : `${formatter.format(play.economicsAfter.paybackMonths)} mo`}
                      {" · "}payback verdict {play.economicsBefore.profitable === null ? "unknown" : play.economicsBefore.profitable ? "within horizon" : "outside horizon"} → {play.economicsAfter.profitable === null ? "unknown" : play.economicsAfter.profitable ? "within horizon" : "outside horizon"}
                    </span>
                  ) : null}
                </p>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-ink-2">No play forecast changed in the fields this view can recalculate. Other changed inputs may affect the written recommendation after the plan is refreshed.</p>}
        {impact.portfolio.after ? (
          <div className="rounded-[var(--radius-control)] bg-surface-2 p-3 text-sm">
            <p className="font-medium">Portfolio choice</p>
            <p className="mt-1 text-ink-2">
              {impact.portfolio.before
                ? <>{portfolioChanged ? "Saved choice" : "Choice unchanged"}: {impact.portfolio.before.selected.join(" + ") || "No selected plays"} ({impact.portfolio.before.customers === null ? "customers unavailable" : `${formatter.format(impact.portfolio.before.customers)} modeled customers`}; {impact.portfolio.before.cashSpendUsdMonth === null ? "cash outlay unknown" : `${formatMoney(impact.portfolio.before.cashSpendUsdMonth, impact.currency)}/mo cash outlay`}) <span aria-hidden="true">→</span> {impact.portfolio.after.selected.join(" + ") || "No selected plays"} ({formatter.format(impact.portfolio.after.customers)} modeled customers; {formatMoney(impact.portfolio.after.cashSpendUsdMonth, impact.currency)}/mo cash outlay).</>
                : <>Saved portfolio comparison unavailable; current choice: {impact.portfolio.after.selected.join(" + ") || "No selected plays"} ({formatter.format(impact.portfolio.after.customers)} modeled customers; {formatMoney(impact.portfolio.after.cashSpendUsdMonth, impact.currency)}/mo cash outlay).</>}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

type PlanData = FunctionReturnType<typeof api.workspace.plan>;

function PlanScreen({ slug }: { slug: string }) {
  // Which version is on screen: the approved one by default, or a newer one being reviewed.
  const [viewId, setViewId] = useState<Id<"strategies"> | null>(null);
  // Versions kept subscribed once listed or opened, so switching between them is instant.
  const [warm, setWarm] = useState<Id<"strategies">[]>([]);
  const defaultPlan = useQuery(api.workspace.plan, { slug });
  const warmPlans = useQueries(useMemo(() => Object.fromEntries(warm.map((id) => [id, { query: api.workspace.plan, args: { slug, strategyId: id } }])), [warm, slug])) as Record<string, PlanData | Error | undefined>;
  const picked = viewId ? warmPlans[viewId] : defaultPlan;
  if (picked instanceof Error) throw picked;
  // A version still loading keeps the previous one on screen instead of a blank skeleton.
  const [lastShown, setLastShown] = useState<PlanData | undefined>(undefined);
  if (picked && picked !== lastShown) setLastShown(picked);
  const plan = picked ?? lastShown;
  const switching = !picked && Boolean(lastShown);
  const versions = usePlanVersions(slug);
  const [compare, setCompare] = useState<{ left: Id<"strategies">; right: Id<"strategies"> } | null>(null);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [startedRunId, setStartedRunId] = useState<Id<"workflowRuns"> | null>(null);
  // The version being written: shown in the picker, and as a full progress view when chosen.
  const [viewBuilding, setViewBuilding] = useState(false);
  const [buildBase, setBuildBase] = useState<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const warmUp = (ids: Id<"strategies">[]) => setWarm((w) => (ids.every((id) => w.includes(id)) ? w : [...w, ...ids.filter((id) => !w.includes(id))]));
  const showVersion = (id: Id<"strategies"> | null) => {
    if (id) warmUp([id]);
    setViewBuilding(false);
    setViewId(id);
  };
  const activeRunId = plan?.strategyRun && !RUN_FINISHED.has(plan.strategyRun.status) ? plan.strategyRun.id : null;
  const buildRunId = startedRunId ?? activeRunId;
  const buildState = useStrategyRunState(slug, buildRunId);
  const latestVersion = versions?.[0]?.version ?? null;
  // Remember which version the build starts from, so its number stays put and its result can be found.
  if (activeRunId && buildBase === null && latestVersion !== null) setBuildBase(latestVersion);
  // The build wrote its version: move from the progress view to it.
  if (viewBuilding && buildBase !== null && versions?.[0] && versions[0].version > buildBase) {
    setViewBuilding(false);
    setBuildBase(null);
    setViewId(versions[0].id);
    if (!warm.includes(versions[0].id)) setWarm([...warm, versions[0].id]);
  }
  if (!activeRunId && !viewBuilding && buildBase !== null) setBuildBase(null);
  const onStarted = (runId: Id<"workflowRuns">) => {
    setStartedRunId(runId);
    if (latestVersion !== null) {
      setBuildBase(latestVersion);
      setViewBuilding(true);
      setCompare(null);
    }
  };
  const buildingEntry = buildRunId && buildBase !== null && (activeRunId || viewBuilding) ? { version: buildBase + 1, progress: buildState?.label ?? "Starting" } : null;

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
  const savedBusinessWebsite = (s?.expert as { snapshot?: { businessProfile?: { website?: string | null } } } | null)?.snapshot?.businessProfile?.website ?? undefined;
  const status = s ? (STRATEGY_STATUS[s.status] ?? { label: s.status, tone: "neutral" as Tone }) : null;
  const other = plan.otherVersion;
  const building = Boolean(plan.strategyRun && !RUN_FINISHED.has(plan.strategyRun.status));
  const planQ = (s?.expert as { quality?: { state: QualityState; reasons: string[]; fixes?: QualityFix[]; unknowns?: string[]; conflicts?: string[] } } | null | undefined)?.quality ?? null;
  // Missing customer numbers (or a play model the numbers would fix) are answered inline, not on another page.
  const needsNumbers = Boolean(planQ && (planQ.state === "needs_input" || (planQ.state === "failed" && (planQ.fixes ?? []).some((f) => /^(economics|plays)/.test(f.path ?? "") || /revenue|margin|churn|customer is worth/i.test(f.message)))));
  const helpPanel = (needed: boolean) => (
    <HelpClimbOS
      slug={slug}
      canEdit={plan.canEdit}
      currency={plan.businessCurrency}
      unitEconomics={plan.unitEconomics}
      funnel={plan.funnel}
      unknowns={planQ?.unknowns ?? []}
      needed={needed}
      refresh={s ? { nextVersion: s.version + 1, estimateMicros: plan.planEstimateMicros, onStarted, building } : null}
      noCustomersYet={plan.noCustomersYet}
      customerData={plan.customerData}
    />
  );
  const reviewHelp = needsNumbers || planQ?.unknowns?.length ? helpPanel(needsNumbers) : undefined;
  // A refresh that stopped after the newest version was written (otherwise it vanishes after a reload).
  const run = plan.strategyRun;
  const refreshStopped = Boolean(s && run && ["failed", "canceled", "uncertain"].includes(run.status) && run.createdAt > (plan.latestVersionAt ?? 0) && run.id !== startedRunId);
  const latestV = versions?.[0] ?? null;
  const viewingV = s ? (versions?.find((v) => v.id === s.id) ?? null) : null;
  // An older version that isn't the one guiding the team: read-only, with compare and restore.
  const olderView = Boolean(viewingV && latestV && !viewingV.isLatest && !viewingV.inUse);
  const staleInputLabels = [
    ["ownerEconomics", "confirmed business numbers"],
    ["lifecycleStage", "business stage"],
    ["funnel", "funnel measurements"],
    ["goal", "goal or budget"],
    ["businessProfile", "business profile"],
    ["businessFacts", "confirmed business facts changed or due for review"],
    ["brandGuidance", "brand guidance"],
    ["capabilities", "connected tools"],
    ["businessResearch", "business and audience research"],
    ["marketChanges", "monitored competitor pages"],
    ["cashTiming", "growth cash reserve or payment delay"],
  ].filter(([key]) => Boolean(plan.staleInputs[key as keyof typeof plan.staleInputs])).map(([, label]) => label);
  const openCompare = () => {
    if (!versions || versions.length < 2 || !latestV) return;
    const left = viewingV && !viewingV.isLatest ? viewingV.id : versions[1].id;
    setCompare({ left, right: latestV.id });
  };
  const onRestored = (id: Id<"strategies">) => {
    setCompare(null);
    showVersion(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div ref={root} className="flex flex-col gap-6">
      <PageHeader
        section="plan"
        title="Your growth plan"
        intro={
          s && status ? (
            <span className="flex flex-wrap items-center gap-2">
              {versions && versions.length ? (
                <VersionPicker
                  versions={versions}
                  viewingId={s.id}
                  onView={(id) => {
                    setCompare(null);
                    showVersion(id);
                  }}
                  onCompare={openCompare}
                  slug={slug}
                  canEdit={plan.canEdit}
                  building={buildingEntry}
                  viewingBuilding={viewBuilding}
                  onViewBuilding={() => {
                    setCompare(null);
                    setViewBuilding(true);
                  }}
                  onOpen={() => warmUp(versions.slice(0, 8).map((v) => v.id))}
                />
              ) : (
                <span className="text-ink-2">Version {s.version}</span>
              )}
              {/* With several versions the picker carries the status. */}
              {(s.status === "needs_approval" || s.status === "draft") && (versions?.length ?? 0) <= 1 && !buildingEntry ? <Badge tone={status.tone}>{status.label}</Badge> : null}
              {switching ? (
                <span className="text-xs text-ink-3" role="status">
                  Loading version…
                </span>
              ) : null}
            </span>
          ) : null
        }
        actions={
          s && plan.canEdit ? (
            <div className="flex flex-wrap items-start gap-2">
              <PlanToConnectedApps slug={slug} />
              <GeneratePlanButton slug={slug} mode="refresh" nextVersion={s.version + 1} estimateMicros={plan.planEstimateMicros} onStarted={onStarted} building={building} />
            </div>
          ) : null
        }
      />

      <GoalCard goal={plan.goal} slug={slug} />
      {!viewBuilding ? <FollowerGrowth slug={slug} always={Boolean(plan.goal?.followers)} /> : null}

      {viewBuilding && buildRunId ? (
        <>
          <StrategyRunWatcher slug={slug} startedRunId={null} activeRunId={buildRunId} onDismiss={() => setViewBuilding(false)} />
          {s ? (
            <Button variant="secondary" className="self-start" onClick={() => setViewBuilding(false)}>
              Back to version {s.version}
            </Button>
          ) : null}
        </>
      ) : (
        <>

      {s && plan.staleInputs.requiresRefresh && !olderView ? (
        <Callout
          tone="warning"
          title="This plan uses older business inputs"
          action={plan.canEdit ? <GeneratePlanButton slug={slug} mode="refresh" nextVersion={s.version + 1} estimateMicros={plan.planEstimateMicros} onStarted={onStarted} building={building} /> : null}
        >
          These inputs changed or are due for review: {staleInputLabels.join(", ") || "important business inputs"}. The figures shown here recalculate from current numbers, while the written recommendations still reflect the saved plan. Refresh before approving or starting work.
        </Callout>
      ) : null}
      {s && plan.planImpact && !olderView ? <PlanImpactSummary impact={plan.planImpact} /> : null}

      <SectionBoundary label="plan progress">
        <StrategyRunWatcher
          slug={slug}
          startedRunId={startedRunId}
          activeRunId={activeRunId}
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

      {olderView && viewingV && latestV ? (
        <OlderVersionBar version={viewingV} latest={latestV} canEdit={plan.canEdit} onBack={() => showVersion(null)} onCompare={openCompare} onRestore={() => setRestoreOpen(true)} />
      ) : s && other && !compare ? (
        <Callout
          tone={other.status === "needs_approval" || s.status === "needs_approval" ? "warning" : "info"}
          title={
            s.status === "approved"
              ? other.status === "needs_approval"
                ? `v${other.version} is waiting for approval`
                : `v${other.version} was sent back`
              : `v${other.version} is in use until you approve this one`
          }
          action={
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => showVersion(s.status === "approved" ? other.id : null)}>
                See v{other.version}
              </Button>
              {versions && versions.length > 1 ? <Button size="sm" variant="secondary" onClick={openCompare}>Compare changes</Button> : null}
            </div>
          }
        />
      ) : null}

      {viewingV && latestV && !viewingV.isLatest ? (
        <RestoreDialog slug={slug} from={viewingV} latest={latestV} open={restoreOpen} onOpenChange={setRestoreOpen} onRestored={onRestored} />
      ) : null}

      {compare && versions ? (
        <PlanCompare
          key={`${compare.left}-${compare.right}`}
          slug={slug}
          versions={versions}
          initialLeft={compare.left}
          initialRight={compare.right}
          canEdit={plan.canEdit}
          onClose={() => setCompare(null)}
          onRestored={onRestored}
        />
      ) : null}

      <div className={compare ? "hidden" : "flex flex-col gap-6"}>
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
                  <GeneratePlanButton slug={slug} mode="build" estimateMicros={plan.planEstimateMicros} onStarted={onStarted} building={building} />
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
          {s.status === "needs_approval" && !olderView ? <PlanReviewCard slug={slug} strategyId={s.id} version={s.version} canApprove={plan.canApprove} onDecided={() => showVersion(null)} staleReason={plan.staleInputs.requiresRefresh ? staleInputLabels.join(", ") || "important business inputs changed" : undefined} quality={planQ} help={reviewHelp} /> : null}
          {s.status === "draft" ? (
            <Callout tone="warning" title="Sent back">
              {plan.canEdit ? "Refresh for a new version." : `Ask ${PERMISSION_WHO.edit} to refresh.`}
            </Callout>
          ) : null}
          <ShortVersion strategy={s} />
          {plan.noCustomersYet || plan.customerData?.status === "no_data_yet" ? (
            <Callout tone="info" title={plan.noCustomersYet ? "Estimates: no customer data yet" : "Estimates: no customer numbers yet"}>
              Money figures in this plan are labelled estimates, not your results. They update as real customer numbers come in.
            </Callout>
          ) : null}
          {s.expert ? <NorthStar expert={s.expert as ExpertView} slug={slug} /> : null}
          {s.expert?.plays?.length ? <SharpenPlan slug={slug} questions={plan.questions} canEdit={plan.canEdit} answersNewer={plan.answersNewerThanPlan} currency={plan.businessCurrency} segmentEconomics={plan.unitEconomics?.segmentEconomics} /> : null}
          {s.expert?.plays?.length && !(s.status === "needs_approval" && !olderView && reviewHelp) ? helpPanel(false) : null}
          {s.expert && (s.expert.plays?.length || (s.expert as ExpertView).strategyExploration) ? <GrowthPlays plays={(s.expert.plays ?? []) as PlayView[]} slug={slug} economics={(s.expert as { economics?: Economics }).economics} portfolioComparisons={(s.expert as ExpertView).portfolioComparisons} strategyExploration={(s.expert as ExpertView).strategyExploration} diagnosis={(s.expert as { constraintDiagnosis?: Diagnosis }).constraintDiagnosis ?? null} strategyId={s.status === "approved" ? s.id : undefined} planId={s.id} canEdit={plan.canEdit} focused={Boolean((s.expert as ExpertView).decision)} /> : null}
          {s.expert ? <ExecutionPlan expert={s.expert as ExpertView} /> : null}
          <Audiences strategy={s} facts={plan.sources} />
          <Channels slug={slug} strategy={s} canEdit={plan.canEdit} currency={plan.currency} facts={plan.sources} />
          <Experiments experiments={plan.experiments} slug={slug} canEdit={plan.canEdit} />
          <PlanBasics strategy={s} />
        </>
      )}

      <BusinessInsights insights={plan.insights} />
      {s ? <Sources sources={plan.sources} web={(s.expert as { webSources?: { url: string; title?: string }[] } | null)?.webSources ?? []} researchEvidence={plan.researchEvidence} websiteUrl={savedBusinessWebsite} knowledge={(s.expert as { snapshot?: { knowledgeReferences?: KnowledgeReferenceSet } } | null)?.snapshot?.knowledgeReferences} /> : null}
      {s ? <Discussion slug={slug} subjectType="strategy" subjectId={s.id} title={`Growth plan v${s.version}`} href={`/app/${slug}/plan`} /> : null}
      </div>

        </>
      )}

      <SectionBoundary label="recent work">
        <RecentWork slug={slug} />
      </SectionBoundary>
      <PlanJumpNav rootRef={root} />
    </div>
  );
}
