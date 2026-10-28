"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button, toast } from "@/components/ui";
import { errorMessage } from "@/components/app/errors";

type Feedback = { id: Id<"strategyExplorationFeedback">; mode: string; optionTitle: string; decision: string; testState: string; outcomeNote: string | null; createdAt: number; retired: boolean; used: boolean };
type PlanNote = { strategyId: Id<"strategies">; version: number; note: string; createdAt: number; retired: boolean; used: boolean };
export type LearningSourcesView = { canEdit: boolean; maxAgeDays: number; feedback: Feedback[]; planNotes: PlanNote[] };

const state = (row: { retired: boolean; used: boolean }) => (row.retired ? "Retired" : row.used ? "Used in new plans" : "Expired");
const day = (ms: number) => new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** The owner's strategy feedback and send-back notes that guide new plans, with retire and restore controls. */
export function StrategyLearningList({ data, onFeedback, onPlanNote }: { data: LearningSourcesView; onFeedback?: (id: Feedback["id"], retired: boolean) => void; onPlanNote?: (id: PlanNote["strategyId"], retired: boolean) => void }) {
  if (!data.feedback.length && !data.planNotes.length) return null;
  const toggle = (retired: boolean, onClick?: () => void) => data.canEdit && onClick ? <Button size="sm" variant="ghost" onClick={onClick}>{retired ? "Use again" : "Stop using"}</Button> : null;
  return (
    <details className="rounded-[var(--radius-card)] border border-line bg-surface p-3 text-sm">
      <summary className="cursor-pointer font-medium text-ink">What new plans learn from your feedback ({data.feedback.filter((f) => f.used).length + data.planNotes.filter((n) => n.used).length} in use)</summary>
      <ul className="mt-2 flex flex-col gap-2">
        {data.feedback.map((f) => (
          <li key={f.id} className="flex flex-wrap items-start justify-between gap-2 border-t border-line pt-2">
            <span className="min-w-0 flex-1 text-ink-2"><span className="text-ink">{f.mode} option “{f.optionTitle}”</span>: you {f.decision}{f.outcomeNote ? ` · ${f.outcomeNote}` : ""} <span className="text-xs text-ink-3">· {day(f.createdAt)} · {state(f)}</span></span>
            {toggle(f.retired, onFeedback ? () => onFeedback(f.id, !f.retired) : undefined)}
          </li>
        ))}
        {data.planNotes.map((n) => (
          <li key={n.strategyId} className="flex flex-wrap items-start justify-between gap-2 border-t border-line pt-2">
            <span className="min-w-0 flex-1 text-ink-2"><span className="text-ink">Plan v{n.version} sent back</span>: “{n.note}” <span className="text-xs text-ink-3">· {day(n.createdAt)} · {state(n)}</span></span>
            {toggle(n.retired, onPlanNote ? () => onPlanNote(n.strategyId, !n.retired) : undefined)}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-ink-3">Your preferences, not proof of results. Items older than {data.maxAgeDays} days stop guiding plans automatically.</p>
    </details>
  );
}

export function StrategyLearningSources({ slug }: { slug: string }) {
  const data = useQuery(api.creativeStrategy.learningSources, { slug });
  const setFeedback = useMutation(api.creativeStrategy.setFeedbackRetired);
  const setNote = useMutation(api.creativeStrategy.setPlanNoteRetired);
  const done = (p: Promise<unknown>, retired: boolean) => p.then(() => toast({ tone: "success", title: retired ? "Stopped using it in new plans" : "Using it again" }), (e) => toast({ tone: "danger", title: errorMessage(e) }));
  return data ? <StrategyLearningList data={data} onFeedback={(feedbackId, retired) => void done(setFeedback({ slug, feedbackId, retired }), retired)} onPlanNote={(strategyId, retired) => void done(setNote({ slug, strategyId, retired }), retired)} /> : null;
}
