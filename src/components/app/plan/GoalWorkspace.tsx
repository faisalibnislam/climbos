"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { GoalTimingSchema, dayRange } from "@shared/agents/goalTiming";
import { PreparedWorkSchema } from "@shared/agents/preparedWork";
import { Badge, Button, Callout, Dialog, DialogContent, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui";
import { useClimb } from "@/components/climb/context";
import { PageHeader } from "../results/QueryBoundary";
import { GoalTabs } from "./GoalTabs";
import { GeneratePlanButton, StrategyRunWatcher } from "./PlanActions";
import { PastCycles } from "./PlanningCycles";
import { PreparedWork } from "./PreparedWork";
import { PlanTimeline } from "./PlanTimeline";
import { StepWorkLibrary } from "./StepWork";
import type { ExpertView } from "./ExpertPlan";
import { StrategyLearningSources } from "./StrategyLearningSources";
import { CampaignTimingSummary } from "./CampaignTimingSummary";
import { OfferAssessmentPanel } from "./OfferAssessmentPanel";
import { StrategicDirectionPanel } from "./StrategicDirection";

const StrategyExplorationPanel = dynamic(() => import("./ExpertPlan").then(module => module.StrategyExplorationPanel), { loading: () => <Skeleton className="h-64" /> });
const FocusedLearning = dynamic(() => import("./FocusedLearning").then(module => module.FocusedLearning), { loading: () => <Skeleton className="h-48" /> });

export function GoalWorkspace({ slug, details }: { slug: string; details: ReactNode }) {
  const goals = useQuery(api.goals.list, { slug });
  return <div className="plan-workspace mx-auto w-full max-w-6xl space-y-6">
    <PageHeader section="plan" title="Your plan" />
    <GoalTabs slug={slug} />
    {goals === undefined ? <Skeleton className="h-64" /> : <GoalPlan key={goals.selectedId ?? "no-goal"} slug={slug} selectedId={goals.selectedId} details={details} />}
  </div>;
}

function GoalPlan({ slug, selectedId, details }: { slug: string; selectedId: Id<"goals"> | null; details: ReactNode }) {
  const [viewId, setViewId] = useState<Id<"strategies"> | null>(null);
  const plan = useQuery(api.workspace.plan, { slug, ...(viewId ? { strategyId: viewId } : {}) });
  const climb = useClimb();
  const [review, setReview] = useState(false);
  const [tab, setTab] = useState("steps");
  const [timingOpen, setTimingOpen] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [startedRun, setStartedRun] = useState<Id<"workflowRuns"> | null>(null);
  useEffect(() => {
    const open = () => { if (window.location.hash === "#prepared-work") { setReview(true); setTab("work"); } };
    open(); window.addEventListener("hashchange", open); return () => window.removeEventListener("hashchange", open);
  }, []);
  useEffect(() => {
    if (!review) return;
    requestAnimationFrame(() => { const el = document.getElementById("plan-prepared-work"); el?.scrollIntoView({ block: "start", behavior: "smooth" }); el?.focus({ preventScroll: true }); });
  }, [review, plan?.strategy?.id]);
  if (!plan || (plan.goal?.id ?? null) !== selectedId) return <Skeleton className="h-64" />;
  const strategy = plan.strategy;
  const expert = strategy?.expert as ExpertView | null;
  const focus = expert?.focusedMove;
  const work = PreparedWorkSchema.array().safeParse(expert?.preparedWork);
  const prepared = work.success && work.data.length > 0;
  const timing = GoalTimingSchema.safeParse(expert?.timing);
  const running = plan.strategyRun && !["verified", "failed", "canceled", "uncertain", "needs_approval"].includes(plan.strategyRun.status);
  const ask = (text: string) => {
    climb.setDraft(climb.draft.trim() ? `${climb.draft.trimEnd()}\n${text}` : text);
    if (strategy) climb.addSelection({ type: "strategy", id: strategy.id, label: focus?.title ?? strategy.summary });
    climb.setOpen(true);
  };
  const needsRepair = strategy?.expert?.quality?.state === "failed" || strategy?.expert?.quality?.state === "provisional";
  const generate = <GeneratePlanButton slug={slug} mode={strategy ? "refresh" : "build"} estimateMicros={plan.planEstimateMicros} repair={needsRepair} building={Boolean(running)} onStarted={setStartedRun} />;
  return <div className="space-y-5">
    {startedRun || running ? <StrategyRunWatcher slug={slug} startedRunId={startedRun} activeRunId={running ? plan.strategyRun!.id : null} onDismiss={() => setStartedRun(null)} /> : null}
    {plan.otherVersion?.status === "needs_approval" && strategy?.status === "approved" ? <Callout tone="info" title="Your updated recommendation is ready" action={<Button size="sm" variant="secondary" onClick={() => { setReview(false); setViewId(plan.otherVersion!.id); }}>See the update</Button>}>Your existing work stays saved while you look at the update.</Callout> : null}
    {!selectedId ? <p className="text-ink-2">Add what you want to achieve. No business terms or plan length needed.</p> : !strategy ? <section className="space-y-4 rounded-xl border border-line bg-surface p-6"><h2 className="heading-section">Let AI work out a useful starting point.</h2><p className="max-w-prose text-sm text-ink-2">We’ll use your business research, recommend an approach, choose realistic timing, and prepare useful drafts. Your other goals stay saved.</p>{generate}</section> : <>
      {strategy.expert?.quality?.state === "failed" && !running ? <Callout tone="warning" title="AI found issues to fix">The drafts are available to inspect. This plan cannot start outside work until its checks pass. {generate}</Callout> : null}
      {strategy.expert?.quality?.state === "provisional" && !running ? <Callout tone="info" title="This draft can be better">AI can revise it using the latest research and prepared work. {generate}</Callout> : null}
      {plan.staleInputs.requiresRefresh ? <Callout tone="warning" title="Your information has changed">You can still read and edit the saved drafts. Update the recommendation before starting work based on the old information. {generate}</Callout> : null}
      <Tabs value={tab} onValueChange={value => { if (value !== "work") { setReview(false); if (window.location.hash === "#prepared-work") window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search); } setTab(value); }}>
        <TabsList aria-label="Plan views"><TabsTrigger value="steps">Next steps</TabsTrigger>{expert?.strategyExploration ? <TabsTrigger value="options">Strategy options</TabsTrigger> : null}<TabsTrigger value="work">Prepared work</TabsTrigger><TabsTrigger value="why">Why this plan</TabsTrigger><TabsTrigger value="research">Research</TabsTrigger></TabsList>
        <TabsContent value="steps" className="space-y-5">{running && needsRepair ? <p role="status" className="rounded-xl bg-surface p-6 text-sm">AI is correcting the plan. Your saved drafts stay available in Prepared work.</p> : <PlanTimeline key={strategy.id} slug={slug} strategyId={strategy.id} phases={expert?.phases ?? []} checklist={expert?.weekOneChecklist ?? []} hasPreparedWork={prepared} canEdit={plan.canEdit} onOpenWork={() => { setReview(true); setTab("work"); }} onAsk={ask} />}{focus ? <FocusedLearning key={strategy.id} title={focus.title} experiments={plan.experiments} slug={slug} canEdit={plan.canEdit} onAsk={ask} /> : null}</TabsContent>
        <TabsContent value="work" className="space-y-5"><div id="plan-prepared-work" tabIndex={-1} className="scroll-mt-20 space-y-5"><StepWorkLibrary slug={slug} strategyId={strategy.id} canEdit={plan.canEdit} />{prepared ? <PreparedWork key={strategy.id} work={expert?.preparedWork} slug={slug} strategyId={strategy.id} /> : <Callout title="No prepared drafts in this saved plan">Ask AI to help with a step, or update the plan to prepare useful work.<div className="mt-3">{generate}</div></Callout>}</div></TabsContent>
        {expert?.strategyExploration ? <TabsContent value="options"><StrategyExplorationPanel key={strategy.id} options={expert.strategyExploration} slug={slug} strategyId={strategy.id} canEdit={plan.canEdit} /><StrategyLearningSources slug={slug} /></TabsContent> : null}
        <TabsContent value="why" className="space-y-4">
      <section aria-labelledby="next-step-heading" className="space-y-4 rounded-xl border border-line bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><Badge>Why start here?</Badge>{timing.success ? <Button variant="link" size="sm" onClick={() => setTimingOpen(true)}>First review: {dayRange(timing.data.firstReview)}</Button> : <span className="text-xs text-ink-3">Timing will be judged with the next AI update</span>}</div>
        <h2 id="next-step-heading" className="heading-section">{focus?.title ?? expert?.strategicDirection?.winningApproach ?? strategy.summary}</h2>
        <p className="max-w-prose text-sm leading-relaxed text-ink-2">{focus?.why ?? strategy.summary}</p>
        {prepared ? <div className="space-y-2 border-t border-line pt-4"><p className="text-sm font-medium">AI has already prepared:</p><ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">{work.data.map(w => <li key={w.title}>{w.title}</li>)}</ul></div> : focus?.aiCanDo ? <p className="text-sm text-ink-2">AI can prepare: {focus.aiCanDo}</p> : null}
        <div className="flex flex-wrap items-center gap-2">{prepared ? <Button onClick={() => { setReview(true); setTab("work"); }}>Open prepared work</Button> : generate}<Button variant="secondary" onClick={() => ask("Talk me through this recommendation in simple words. Explain why it fits my goal, and the important assumptions. Do not start any work yet.")}>Talk it through</Button><Button variant="link" onClick={() => ask("Suggest a meaningfully different approach to this goal. Compare it with the current recommendation and explain what would make it a better choice. Keep useful existing drafts. Do not start or publish anything.")}>Try another idea</Button></div>
        <p className="text-xs text-ink-3">{prepared ? "Opens your prepared drafts. No extra AI charge. " : "AI prepares private work. "}You review anything that will be shared or published.</p>
      </section>
      {focus?.timingAssessment && focus.timingAssessment.decision !== "not_relevant" ? <CampaignTimingSummary timing={focus.timingAssessment} /> : null}
      {focus?.offerAssessment ? <OfferAssessmentPanel offer={focus.offerAssessment} /> : null}
      <details className="rounded-xl border border-line bg-surface p-4"><summary className="min-h-11 cursor-pointer font-medium">Where this could lead</summary><div className="mt-3 space-y-5">
        {timing.success ? <><p className="text-sm text-ink-2">{timing.data.reason}</p><p className="text-sm"><strong>Preparation:</strong> {dayRange(timing.data.preparation)}. <strong>First useful review:</strong> {dayRange(timing.data.firstReview)}.</p></> : <p className="text-sm text-ink-2">These dates come from an older saved plan. Its steps are preserved in Next steps. The next AI update will choose and explain timing for this goal.</p>}
        {expert?.strategicDirection ? <StrategicDirectionPanel direction={expert.strategicDirection} /> : null}
        {!timing.success && plan.canEdit ? generate : null}
        {timing.success ? <p className="text-sm text-ink-2"><strong>When we’ll check:</strong> {timing.data.reviewTrigger}<br />{timing.data.outcomeLag}</p> : null}
        <details><summary className="min-h-11 cursor-pointer text-sm font-medium">What happens after this?</summary><p className="py-2 text-sm text-ink-2">Keep what works, change what doesn’t, and judge the timing of the next step from what we learn. Your goals and work can continue year after year.</p></details>
      </div></details>
        </TabsContent>
        <TabsContent value="research" className="space-y-4">
      <section className="rounded-xl border border-line bg-surface p-4"><h2 className="heading-section">Research and past decisions</h2><div className="mt-3 space-y-4"><p className="text-sm text-ink-2">Check the evidence, compare saved plans, or open the detailed controls when you need them.</p><PastCycles slug={slug} /><Button variant="secondary" onClick={() => setAdvanced(!advanced)} aria-expanded={advanced}>{advanced ? "Close details" : "Open research and plan details"}</Button>{advanced ? details : null}</div></section>
        </TabsContent>
      </Tabs>
      <Dialog open={timingOpen} onOpenChange={setTimingOpen}><DialogContent title="Why this timing?">{timing.success ? <div className="space-y-3 text-sm"><p>{timing.data.reason}</p><ul className="list-disc space-y-1 pl-5 text-ink-2">{timing.data.assumptions.map(a => <li key={a}>{a}</li>)}</ul><p>{timing.data.outcomeLag}</p><p className="text-xs text-ink-3">An AI estimate, not a promised result. It changes when the work, evidence, resources, or deadline changes.</p><Button variant="secondary" onClick={() => { setTimingOpen(false); ask("Help me adjust the timing of this goal. Check the actual work, dependencies and available capacity first; ask me about a deadline only if it changes the approach."); }}>Talk about timing</Button></div> : null}</DialogContent></Dialog>
    </>}
  </div>;
}
