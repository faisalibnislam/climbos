"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { planTimeline, timelineProgress, type TimelinePhase, type TimelineTask } from "@shared/agents/planTimeline";
import { Button, Callout, Skeleton } from "@/components/ui";
import { errorMessage } from "../errors";
import { StepWork } from "./StepWork";

export function PlanTimeline({ slug, strategyId, phases, checklist, hasPreparedWork, onOpenWork, onAsk, canEdit }: {
  slug: string; strategyId: Id<"strategies">; phases: TimelinePhase[]; checklist: string[]; hasPreparedWork: boolean;
  onOpenWork: () => void; onAsk: (message: string) => void; canEdit: boolean;
}) {
  const saved = useQuery(api.planProgress.view, { slug, strategyId });
  const aiWork = useQuery(api.stepWork.forStrategy, { slug, strategyId });
  const save = useMutation(api.planProgress.save);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const steps = planTimeline({ phases, weekOneChecklist: checklist });
  if (!steps.length) return <Callout title="This saved plan has no steps yet">Ask AI to turn the recommendation into useful steps. Your existing work stays saved.<Button className="mt-3" variant="secondary" onClick={() => onAsk("Turn my saved plan into clear steps. What should we do first?")}>Ask AI to help</Button></Callout>;
  if (!saved) return <Skeleton className="h-60" />;
  const progress = timelineProgress(steps, saved.rows);
  const current = steps[progress.current];
  const openKey = expanded ?? current?.key ?? steps.at(-1)!.key;
  async function toggle(task: TimelineTask, completed: boolean) {
    if (busy || !saved?.canEdit || !canEdit) return;
    const previous = saved.rows.find(row => row.taskKey === task.key);
    setBusy(task.key); setError(null);
    try { await save({ slug, strategyId, taskKey: task.key, expectedText: task.text, expectedRevision: previous?.revision ?? 0, completed }); setExpanded(null); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(null); }
  }
  const selected = steps.find(step => step.key === openKey) ?? current ?? steps.at(-1)!;
  const index = steps.indexOf(selected);
  const count = selected.tasks.filter(progress.isDone).length;
  return <section aria-label="Your plan timeline" className="plan-journey">
    <aside className="plan-step-nav" aria-label="Plan steps">
      <div className="mb-5 space-y-3"><div className="flex items-center justify-between gap-2 text-sm"><span className="font-medium">Your steps</span><span className="text-ink-3" aria-live="polite">{progress.completed} of {steps.length} done</span></div><progress aria-label="Plan steps completed" value={progress.completed} max={steps.length} className="h-1.5 w-full accent-brand-800" /></div>
      <ol className="plan-step-list">{steps.map((step, i) => {
        const prepared = aiWork?.find(work => work.stepKey === step.key);
        const done = progress.done[i];
        return <li key={step.key}><button type="button" className="plan-step-link" aria-current={selected.key === step.key ? "step" : undefined} aria-controls="selected-plan-step" onClick={() => setExpanded(step.key)}>
          <span className="plan-step-number" aria-hidden="true">{done ? "✓" : i + 1}</span><span className="min-w-0"><span className="block font-medium">{step.title}</span><span className="mt-1 block text-xs text-ink-3">{done ? "Done" : prepared?.status === "ready" ? "Work prepared" : prepared?.status === "working" ? "AI is working" : prepared?.status === "needs_input" ? "One answer needed" : progress.current === i ? "Start here" : "Coming next"}</span></span>
        </button></li>;
      })}</ol>
    </aside>
    <article id="selected-plan-step" className="plan-work-surface">
      <header className="plan-work-heading"><p className="mb-3 text-xs font-medium uppercase tracking-widest text-brand-800">Step {index + 1} of {steps.length}</p><h2 className="text-2xl font-semibold tracking-tight">{selected.title}</h2><p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-2">{selected.description}</p></header>
      <div className="plan-work-body space-y-5">
        {error ? <Callout tone="danger">{error}</Callout> : null}
        <StepWork key={selected.key} slug={slug} strategyId={strategyId} stepKey={selected.key} canEdit={canEdit} />
        <div className="flex flex-wrap items-center gap-2">{index === 0 && hasPreparedWork ? <Button size="sm" variant="secondary" onClick={onOpenWork}>See earlier drafts</Button> : null}<Button size="sm" variant="link" onClick={() => onAsk(`Help me with step ${index + 1}: ${selected.title}.`)}>Discuss this step</Button></div>
        <details className="step-support"><summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm font-medium"><span>Track this step</span><span className="text-xs font-normal text-ink-3">{count} of {selected.tasks.length} done</span></summary><ul className="space-y-2 pt-3">{selected.tasks.map(task => <li key={task.key}><label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg bg-surface-2 p-3 text-sm"><input type="checkbox" checked={progress.isDone(task)} disabled={Boolean(busy) || !saved.canEdit || !canEdit} onChange={event => void toggle(task, event.target.checked)} className="mt-0.5 size-4 shrink-0 accent-brand-800" /><span className={`break-words ${progress.isDone(task) ? "text-ink-3 line-through" : ""}`}>{task.text}</span></label></li>)}</ul><p className="mt-3 text-xs text-ink-3">Mark work your team has done. Opening a draft does not publish it or mark it done.</p></details>
        <details className="step-support text-sm"><summary className="min-h-11 cursor-pointer font-medium">Timing and what happens next</summary><div className="space-y-2 pt-3 text-ink-2"><p>Suggested timing: days {selected.days.replace(/^days?\s*/i, "")}. We’ll adapt as we learn.</p>{selected.startingPoint ? <p>{selected.startingPoint}</p> : null}{selected.check ? <p>{selected.check}</p> : null}{selected.next ? <p>{selected.next}</p> : null}</div></details>
        {!current ? <Button variant="secondary" onClick={() => onAsk("We’ve finished the tasks. Help me check what happened and choose what to do next.")}>Choose what’s next</Button> : null}
      </div>
    </article>
  </section>;
}
