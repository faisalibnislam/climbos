"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button, toast } from "@/components/ui";
import { errorMessage } from "@/components/app/errors";

type Reason = "included" | "retired" | "expired" | "invalid_date" | "superseded" | "unverified" | "context_limit";
type Feedback = { id: Id<"strategyExplorationFeedback">; mode: string; optionTitle: string; decision: string; testState: string; outcomeNote: string | null; createdAt: number; retired: boolean; used: boolean; reason?: Reason };
type PlanNote = { strategyId: Id<"strategies">; version: number; note: string; createdAt: number | null; retired: boolean; used: boolean; reason?: Reason };
export type LearningSourcesView = { canEdit: boolean; maxAgeDays: number; limited?: boolean; feedback: Feedback[]; planNotes: PlanNote[] };

const reasonLabels: Record<Reason, string> = { included: "Included for the next plan", retired: "Retired", expired: "Expired", invalid_date: "Report date unavailable or invalid", superseded: "Replaced by a newer report", unverified: "Original option could not be verified", context_limit: "Outside the current learning sample" };
const state = (row: { retired: boolean; used: boolean; reason?: Reason }) => row.reason ? reasonLabels[row.reason] : (row.retired ? "Retired" : row.used ? reasonLabels.included : "Expired");
const day = (ms: number | null) => ms === null || !Number.isFinite(ms) ? "Date unknown" : new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** The owner's strategy feedback and send-back notes that guide new plans, with retire and restore controls. */
export function StrategyLearningList({ data, onFeedback, onPlanNote }: { data: LearningSourcesView; onFeedback?: (id: Feedback["id"], retired: boolean) => void; onPlanNote?: (id: PlanNote["strategyId"], retired: boolean) => void }) {
  if (!data.feedback.length && !data.planNotes.length) return null;
  const toggle = (retired: boolean, onClick?: () => void) => data.canEdit && onClick ? <Button size="sm" variant="ghost" onClick={onClick}>{retired ? "Use again" : "Stop using"}</Button> : null;
  return (
    <details className="rounded-[var(--radius-card)] border border-line bg-surface p-3 text-sm">
      <summary className="cursor-pointer font-medium text-ink">What new plans learn from your feedback ({data.feedback.filter((f) => f.used).length + data.planNotes.filter((n) => n.used).length} included)</summary>
      <ul className="mt-2 flex flex-col gap-2">
        {data.feedback.map((f) => (
          <li key={f.id} className="flex flex-wrap items-start justify-between gap-2 border-t border-line pt-2">
            <span className="min-w-0 flex-1 text-ink-2"><span className="text-ink">{f.mode} option “{f.optionTitle}”</span>: you {f.decision}{f.outcomeNote ? ` · ${f.outcomeNote}` : ""} <span className="text-xs text-ink-3">· {day(f.createdAt)} · {state(f)}</span></span>
            {f.reason !== "superseded" ? toggle(f.retired, onFeedback ? () => onFeedback(f.id, !f.retired) : undefined) : null}
          </li>
        ))}
        {data.planNotes.map((n) => (
          <li key={n.strategyId} className="flex flex-wrap items-start justify-between gap-2 border-t border-line pt-2">
            <span className="min-w-0 flex-1 text-ink-2"><span className="text-ink">Plan v{n.version} sent back</span>: “{n.note}” <span className="text-xs text-ink-3">· {day(n.createdAt)} · {state(n)}</span></span>
            {toggle(n.retired, onPlanNote ? () => onPlanNote(n.strategyId, !n.retired) : undefined)}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-ink-3">This is the current selection for future plans, not a record of what earlier plans used. Only the latest report per option is considered. Your preferences are not proof of results. Items older than {data.maxAgeDays} days stop guiding plans automatically. Selection is limited to 80 recent feedback reports, 40 strategy rejections and the available context space.{data.limited ? " Older records are outside this sample." : ""}</p>
    </details>
  );
}

export function StrategyLearningSources({ slug }: { slug: string }) {
  const data = useQuery(api.creativeStrategy.learningSources, { slug });
  const setFeedback = useMutation(api.creativeStrategy.setFeedbackRetired);
  const setNote = useMutation(api.creativeStrategy.setPlanNoteRetired);
  const done = (p: Promise<unknown>, retired: boolean) => p.then(() => toast({ tone: "success", title: retired ? "Stopped using it in new plans" : "Restored for consideration in new plans" }), (e) => toast({ tone: "danger", title: errorMessage(e) }));
  return data ? <StrategyLearningList data={data} onFeedback={(feedbackId, retired) => void done(setFeedback({ slug, feedbackId, retired }), retired)} onPlanNote={(strategyId, retired) => void done(setNote({ slug, strategyId, retired }), retired)} /> : null;
}
