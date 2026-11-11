"use client";

import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useState } from "react";
import { Button, Callout, Field, Textarea, toast } from "@/components/ui";
import { CYCLE_LENGTHS, cycleProgress, type CycleLength } from "@shared/agents/planningCycles";
import { useNow } from "../content/shared";
import { errorMessage } from "../errors";
import type { Id } from "@convex/_generated/dataModel";
import type { ExpertView } from "./ExpertPlan";

export function CycleControls({ slug, goalStatement }: { slug: string; goalStatement?: string }) {
  const data = useQuery(api.planningCycles.view, { slug });
  const change = useMutation(api.planningCycles.changeLength);
  const [busy, setBusy] = useState(false);
  const now = useNow();
  const [review, setReview] = useState(false);
  if (!data?.goal) return null;
  const goal = data.goal;
  const progress = cycleProgress(goal.startedAt, goal.lengthDays, now ?? goal.startedAt);
  return <section aria-label="Plan length and progress" className="space-y-3 rounded-xl border border-line bg-surface p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0 flex-1"><h2 className="font-semibold">Your next {goal.lengthDays} days</h2>{goalStatement ? <p className="line-clamp-1 text-sm text-ink-2" title={goalStatement}>{goalStatement}</p> : null}<p className="text-sm text-ink-2">{progress.reviewDue ? "Let’s check what happened and choose the next step" : `Day ${progress.day} of ${goal.lengthDays}`} · Your bigger goal carries forward.</p></div>
      <fieldset disabled={!data.canEdit || busy} className="flex gap-1"><legend className="sr-only">Plan length</legend>
        {CYCLE_LENGTHS.map((days) => <Button key={days} size="sm" variant={goal.lengthDays === days ? "primary" : "secondary"} aria-pressed={goal.lengthDays === days} onClick={async () => {
          if (days === goal.lengthDays) return;
          setBusy(true);
          try { await change({ slug, expectedGoalId: goal.id, lengthDays: days }); toast({ tone: "success", title: `Changed to ${days} days. Update the plan to fit these dates.` }); }
          catch (error) { toast({ tone: "danger", title: errorMessage(error) }); } finally { setBusy(false); }
        }}>{days} days</Button>)}
      </fieldset>
    </div>
    {data.canEdit ? <Button size="sm" variant="link" onClick={() => setReview(!review)} aria-expanded={review}>{review ? "Close" : "Tell us how it went"}</Button> : null}
    {review ? <CycleReview key={goal.id} slug={slug} goalId={goal.id} length={CYCLE_LENGTHS.includes(goal.lengthDays as CycleLength) ? goal.lengthDays as CycleLength : 14} onDone={() => setReview(false)} /> : null}
  </section>;
}

function CycleReview({ slug, goalId, length, onDone }: { slug: string; goalId: Id<"goals">; length: CycleLength; onDone: () => void }) {
  const save = useMutation(api.planningCycles.continueCycle);
  const [outcome, setOutcome] = useState("");
  const [details, setDetails] = useState("");
  const [editing, setEditing] = useState(false);
  const [days, setDays] = useState<CycleLength>(length);
  const [busy, setBusy] = useState(false);
  const options = [{ id: "continue", label: "Keep building on this direction", summary: "Owner wants to continue this direction; impact has not been independently verified.", carry: "Review the previous approach against current evidence and choose the smallest useful next step." }, { id: "change", label: "Try a different approach", summary: "Owner wants to change the approach; the reason needs review before choosing the next recommendation.", carry: "Reconsider the previous recommendation and propose a different test grounded in current evidence." }, { id: "unknown", label: "I’m not sure yet", summary: "Results have not been reviewed. No growth outcome is claimed.", carry: "Check available results first. If evidence is missing, carry measurement forward and avoid scaling." }];
  return <form className="space-y-4 border-t border-line pt-4" onSubmit={async (event) => {
    event.preventDefault(); const selected = options.find((option) => option.id === outcome); if (!selected) return;
    setBusy(true); try {
      await save({ slug, expectedGoalId: goalId, lengthDays: days, summary: selected.summary, carryForward: selected.carry, evidenceBasis: outcome === "unknown" ? "unknown" : "owner_reported", evidenceNote: details.trim() || "No outcome measurements supplied in this review. Owner preference only." });
      toast({ tone: "success", title: "Saved. Update your plan for the next step." }); onDone();
    } catch (error) { toast({ tone: "danger", title: errorMessage(error) }); } finally { setBusy(false); }
  }}>
    <fieldset disabled={busy} className="space-y-2"><legend className="mb-2 font-medium">What should happen next?</legend>{options.map((option) => <label key={option.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-line p-3 text-sm"><input type="radio" name="cycle-outcome" value={option.id} checked={outcome === option.id} onChange={() => setOutcome(option.id)} required />{option.label}</label>)}</fieldset>
    <Button type="button" size="sm" variant="link" aria-expanded={editing} onClick={() => setEditing(!editing)}>Add a result or explain why (optional)</Button>
    {editing ? <Field label="Anything we should carry forward?" hint="If you add numbers, include their source and dates."><Textarea maxLength={1600} value={details} onChange={(event) => setDetails(event.target.value)} /></Field> : null}
    <fieldset disabled={busy} className="flex flex-wrap gap-3"><legend className="mb-2 text-sm font-medium">How long should we work on the next step?</legend>{CYCLE_LENGTHS.map((value) => <label key={value} className="flex min-h-11 items-center gap-2 text-sm"><input type="radio" name="next-length" checked={days === value} onChange={() => setDays(value)} />{value} days</label>)}</fieldset>
    <p className="text-sm text-ink-2">Your goal and budget stay the same. Your answers help AI choose the next step. An updated plan is checked before use.</p>
    <Button type="submit" disabled={!outcome || busy} loading={busy}>Save and move forward</Button>
  </form>;
}

export function CycleMilestones({ expert }: { expert: ExpertView | null }) {
  if (!expert?.phases.length) return <Callout tone="info" title="Your next steps will appear here">Build or update your plan to see the next few steps.</Callout>;
  return <section aria-labelledby="milestones-heading"><h2 id="milestones-heading" className="heading-section mb-3">What happens next</h2><ol className="divide-y divide-line rounded-xl border border-line bg-surface">{expert.phases.map((phase, index) => <li key={`${index}-${phase.name}`}><details className="p-3 text-sm"><summary className="min-h-9 cursor-pointer font-medium"><span className="mr-3 text-xs font-normal text-ink-3">Days {phase.days.replace(/^days?\s*/i, "")}</span>{phase.name}</summary><p className="mt-2 text-ink-2">{phase.focus}</p><dl className="space-y-2 py-2">{[["First step", phase.firstAction], ["How we check", phase.howToCheck], ["What happens next", phase.decisionRule]].map(([label, value]) => value ? <div key={label}><dt className="font-medium">{label}</dt><dd className="text-ink-2">{value}</dd></div> : null)}</dl></details></li>)}</ol><p className="mt-2 text-xs text-ink-3">Proposed steps. Results are checked separately.</p></section>;
}

export function PastCycles({ slug }: { slug: string }) {
  const { results, status, loadMore } = usePaginatedQuery(api.planningCycles.history, { slug }, { initialNumItems: 12 });
  return <section aria-labelledby="past-cycles-heading" className="space-y-3"><h2 id="past-cycles-heading" className="heading-section">Keep learning, year after year</h2><p className="text-sm text-ink-2">Your earlier answers help AI decide what to keep, change or stop. A change of dates is recorded too.</p>{status === "LoadingFirstPage" ? <p role="status">Loading earlier plans…</p> : !results.length ? <p className="rounded-xl border border-line p-4 text-sm">Your first plan is underway. What you learn will appear here as you continue.</p> : results.map((cycle) => <article key={cycle.id} className="rounded-xl border border-line bg-surface p-4"><p className="text-xs text-ink-3">{new Date(cycle.closedAt ?? cycle.startedAt).toLocaleDateString()} · {cycle.lengthDays} days · {cycle.closure === "length_changed" ? "Length changed" : cycle.review ? "Reviewed" : "Earlier goal"}</p><h3 className="mt-1 font-medium">{cycle.statement}</h3>{cycle.review ? <details className="mt-2 text-sm"><summary className="min-h-9 cursor-pointer text-link">What we learned</summary><p>{cycle.review.summary}</p><p className="mt-2">Next: {cycle.review.carryForward}</p><p className="mt-2 text-ink-3">Owner-recorded · {cycle.review.evidenceBasis.replaceAll("_", " ")}: {cycle.review.evidenceNote}</p></details> : null}</article>)}{status === "CanLoadMore" ? <Button variant="secondary" onClick={() => loadMore(12)}>Earlier plans</Button> : null}</section>;
}
