"use client";

import Link from "next/link";
import { fixWhere, QUALITY_LABEL, type QualityFix, type QualityState } from "../../../../shared/agents/quality";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { ClipboardList, Magic, RefreshCw } from "@/components/icons";
import { useState, type ReactNode } from "react";
import { Button, Callout, Card, CardContent, ConfirmDialog, Field, IconTile, Select, Textarea, toast } from "@/components/ui";
import { RUN_FINISHED, RunProgress, useTicker } from "../content/RunProgress";
import { progressOfRun, runStatusPresentation } from "../../../../shared/progress";
import { ErrorCallout, PERMISSION_WHO } from "../content/shared";
import { useCostDisplay } from "../useCostDisplay";
import { AiModePicker, useAiMode } from "../AiModePicker";
import { ModelPicker, useChosenModelEstimate, useModelChoice } from "../ModelPicker";

/** "Build my plan" / "Refresh plan": confirm with the capacity note, then start the strategy job. */
export function GeneratePlanButton({
  slug,
  mode,
  nextVersion,
  estimateMicros,
  onStarted,
  building = false,
}: {
  slug: string;
  mode: "build" | "refresh";
  nextVersion?: number;
  /** Max cost of the plan job (µUSD). */
  estimateMicros: number;
  onStarted: (runId: Id<"workflowRuns">) => void;
  /** A plan job is already running: one at a time. */
  building?: boolean;
}) {
  const generate = useMutation(api.orgs.generatePlan);
  const fmt = useCostDisplay();
  const [error, setError] = useState<unknown>(null);
  const [creativeRange, setCreativeRange] = useState<"balanced" | "conventional" | "surprising" | "ambitious">("balanced");
  const ai = useAiMode(slug);
  const modelChoice = useModelChoice();
  const chosenMax = useChosenModelEstimate("strategy", ai.mode, modelChoice.model);
  const build = mode === "build";
  const max = chosenMax ?? ai.data?.estimates.strategy[ai.mode] ?? estimateMicros;
  const cost = `Up to ${fmt.upTo(max)}; unused credits return.`;
  if (building) {
    return (
      <Button variant={build ? "primary" : "secondary"} size={build ? "lg" : "md"} disabled>
        <RefreshCw aria-hidden className="animate-spin" /> Building your plan…
      </Button>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <ConfirmDialog
        trigger={
          <Button variant={build ? "primary" : "secondary"} size={build ? "lg" : "md"}>
            {build ? <Magic aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
            {build ? "Build my plan" : "Refresh plan"}
          </Button>
        }
        title={build ? "Build your growth plan?" : "Refresh your growth plan?"}
        description={
          build
            ? `Drafted from your goal and facts. ${cost} Nothing is posted or spent until you approve.`
            : `Drafts version ${nextVersion ?? "next"} from your latest goal and facts. ${cost} The current plan guides the team until you approve it.`
        }
        confirmLabel={build ? "Build my plan" : "Draft a new version"}
        onConfirm={async () => {
          setError(null);
          try {
            const res = await generate({ slug, aiMode: ai.mode, creativeRange, model: modelChoice.model });
            onStarted(res.runId);
          } catch (e) {
            setError(e);
          }
        }}
      >
        <AiModePicker slug={slug} kind="strategy" value={ai.mode} onChange={ai.setMode} />
        <ModelPicker kind="strategy" aiMode={ai.mode} value={modelChoice.model} onChange={modelChoice.setModel} />
        <Field label="Creative strategy range"><Select value={creativeRange} onValueChange={(value) => setCreativeRange(value as typeof creativeRange)} options={[{ value: "balanced", label: "Balanced" }, { value: "conventional", label: "More conventional" }, { value: "surprising", label: "More surprising" }, { value: "ambitious", label: "More ambitious" }]} /></Field>
      </ConfirmDialog>
      <p className="text-xs tabular-nums text-ink-3">≤ {fmt.upTo(max)}</p>
      {error ? <ErrorCallout error={error} /> : null}
    </div>
  );
}

/** Short live state of a plan job for the version picker: "34%" while running, then its outcome. */
export function useStrategyRunState(slug: string, runId: Id<"workflowRuns"> | null): { label: string; finished: boolean; succeeded: boolean } | null {
  const run = useQuery(api.content.runStatus, runId ? { slug, runId } : "skip");
  const now = useTicker(2000);
  if (!run) return null;
  if (RUN_FINISHED.has(run.status)) return { label: runStatusPresentation(run.status).label, finished: true, succeeded: run.status === "verified" || run.status === "needs_approval" };
  if (!now) return { label: "Starting", finished: false, succeeded: false };
  const progress = progressOfRun(run.steps.filter((x) => x.kind !== "compute"), run.planned, now, false);
  return { label: `${progress.percent}%`, finished: false, succeeded: false };
}

/** Live progress of the plan job started here, or one already running (from the plan query). */
export function StrategyRunWatcher({
  slug,
  startedRunId,
  activeRunId,
  onDismiss,
}: {
  slug: string;
  startedRunId: Id<"workflowRuns"> | null;
  activeRunId: Id<"workflowRuns"> | null;
  onDismiss: () => void;
}) {
  const runId = startedRunId ?? activeRunId;
  const run = useQuery(api.content.runStatus, runId ? { slug, runId } : "skip");
  if (!runId) return null;
  const finished = run ? RUN_FINISHED.has(run.status) : false;
  return (
    <Card className="border-brand-200">
      <CardContent className="flex flex-col gap-4">
        <RunProgress slug={slug} runId={runId} headingLevel="h2" done={<p className="text-sm text-ink-2">New plan below. Review, then approve.</p>} />
        {finished && startedRunId ? (
          <Button variant="ghost" className="self-start" onClick={onDismiss}>
            Hide progress
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

type PlanWork = { started: string[]; waiting: { title: string; reason: string }[]; covered: string[]; busy: boolean } | null;

/** What approving started, in a line or two. */
export function approvedToast(work: PlanWork): { tone: "success" | "info"; title: string; description?: string } {
  if (!work || (!work.started.length && !work.waiting.length)) {
    return { tone: "success", title: "Plan approved.", description: work?.covered.length ? "Your first drafts are already on the way." : undefined };
  }
  const lines = [
    work.started.length ? `Started: ${work.started.join("; ")}.` : "",
    work.waiting.length ? `Waiting: ${work.waiting.map((w) => `${w.title} (${w.reason.toLowerCase()})`).join("; ")}.` : "",
  ].filter(Boolean);
  return { tone: work.started.length ? "success" : "info", title: work.started.length ? "Plan approved. Drafts are on the way." : "Plan approved.", description: lines.join(" ") };
}

/** Prominent review card for a plan waiting for approval. */
export function PlanReviewCard({ slug, strategyId, version, canApprove, onDecided, staleReason, quality, help }: { slug: string; strategyId: Id<"strategies">; version: number; canApprove: boolean; onDecided?: () => void; staleReason?: string; quality?: { state: QualityState; reasons: string[]; fixes?: QualityFix[]; unknowns?: string[]; conflicts?: string[] } | null; /** Inline "Help ClimbOS" panel shown when missing numbers block or weaken the plan. */ help?: ReactNode }) {
  const blocked = quality?.state === "failed" || Boolean(staleReason);
  const decide = useMutation(api.workspace.decidePlan);
  const [note, setNote] = useState("");
  const [error, setError] = useState<unknown>(null);
  const run = async (decision: "approve" | "reject") => {
    setError(null);
    try {
      const work = await decide({ slug, strategyId, decision, note: decision === "reject" && note.trim() ? note.trim() : undefined });
      toast(decision === "approve" ? approvedToast(work) : { tone: "success", title: "Plan sent back." });
      setNote("");
      onDecided?.();
    } catch (e) {
      setError(e);
    }
  };
  return (
    <section aria-labelledby="review-heading" className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-amber-500/40 bg-amber-100 p-[var(--card-p)]">
      <div className="flex items-start gap-3">
        <IconTile icon={ClipboardList} tone="amber" size="sm" className="bg-surface" />
        <div className="min-w-0 flex-1">
          <h2 id="review-heading" className="heading-section">
            Review plan v{version}
          </h2>
          <ul className="mt-1.5 flex flex-wrap gap-1.5 text-xs text-amber-800">
            <li className="rounded-[var(--radius-badge)] bg-surface px-2 py-0.5">Starts drafts for active channels</li>
            <li className="rounded-[var(--radius-badge)] bg-surface px-2 py-0.5">Each post, email, ad still needs approval</li>
            <li className="rounded-[var(--radius-badge)] bg-surface px-2 py-0.5">Spends no money</li>
          </ul>
        </div>
      </div>
      {(quality && quality.state !== "passed") || staleReason ? (
        <Callout tone={blocked ? "danger" : "warning"} live="none" title={staleReason ? "Refresh this plan before approval" : QUALITY_LABEL[quality!.state]} className={cn(!blocked && "bg-surface")}>
          {staleReason ? <p>The following changed after this version was prepared: {staleReason}. Draft a fresh version before approving or starting work.</p> : null}
          {quality?.reasons.length ? (
            <ul className="flex flex-col gap-1">
              {quality.reasons.map((r) => (
                <li key={r} className="flex min-w-0 items-start gap-2">
                  <span aria-hidden className={cn("mt-[0.6em] size-1.5 shrink-0", blocked ? "bg-red-800" : "bg-amber-800")} />
                  <span className="min-w-0">{r}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {blocked && quality?.fixes?.length ? (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-semibold text-red-800">Technical details</summary>
              <ul className="mt-1 flex flex-col gap-1 text-sm">
                {quality.fixes.map((f) => (
                  <li key={`${f.rule}|${f.path ?? ""}|${f.message}`} className="min-w-0">
                    <span className="font-medium">{fixWhere(f.path)}:</span> {f.message}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          {blocked ? (
            staleReason ? <p className="mt-1.5 font-medium text-red-800">Refresh the plan before approving it. The current version remains available for review.</p> : (
              <p className="mt-1.5 font-medium text-red-800">
                {help ? "Answer the questions below, then refresh the plan. Or send it back." : "Refresh the plan for a new version, or send it back."}
              </p>
            )
          ) : null}
        </Callout>
      ) : null}
      {quality?.conflicts?.length ? (
        <p className="text-sm text-amber-800">
          <span className="font-semibold">Facts disagree:</span> {quality.conflicts.join(" · ")}. Settle them in{" "}
          <Link href={`/app/${slug}/settings/facts`} className="underline">
            Business facts
          </Link>
          .
        </p>
      ) : null}
      {help ?? (quality?.unknowns?.length ? (
        <p className="text-sm text-amber-800">
          <span className="font-semibold">Unknown:</span> {quality.unknowns.join(" · ")}. The plan stays within what&apos;s known.
        </p>
      ) : null)}
      {canApprove ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <ConfirmDialog
            trigger={<Button disabled={blocked}>Approve plan</Button>}
            title={`Approve plan version ${version}?`}
            description="Proposed channels go active and drafts start. Any earlier plan is superseded. Nothing is posted, sent or spent without its own approval."
            confirmLabel="Approve plan"
            onConfirm={() => run("approve")}
          />
          <ConfirmDialog
            trigger={<Button variant="secondary">Send back</Button>}
            title="Send this plan back?"
            description="It goes back to draft; no work starts. Refresh the plan for a new version."
            confirmLabel="Send plan back"
            onConfirm={() => run("reject")}
          >
            <Field label="What should change?" optional>
              <Textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} rows={3} maxLength={500} />
            </Field>
          </ConfirmDialog>
        </div>
      ) : (
        <p className="text-sm font-medium text-ink">Waiting for {PERMISSION_WHO.approve} to approve it.</p>
      )}
      {error ? <ErrorCallout error={error} /> : null}
    </section>
  );
}
