"use client";

import { QUALITY_LABEL, type QualityState } from "../../../../shared/agents/quality";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { RefreshCw, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button, Card, CardContent, ConfirmDialog, Field, Textarea, toast } from "@/components/ui";
import { RUN_FINISHED, RunProgress } from "../content/RunProgress";
import { ErrorCallout, PERMISSION_WHO } from "../content/shared";
import { microsToCreditsLabel } from "../money";
import { AiModePicker, useAiMode } from "../AiModePicker";

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
  const [error, setError] = useState<unknown>(null);
  const ai = useAiMode(slug);
  const build = mode === "build";
  const max = ai.data?.estimates.strategy[ai.mode] ?? estimateMicros;
  const cost = `Uses up to ${microsToCreditsLabel(max)}; anything unused is returned.`;
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
            {build ? <Sparkles aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
            {build ? "Build my plan" : "Refresh plan"}
          </Button>
        }
        title={build ? "Build your growth plan?" : "Refresh your growth plan?"}
        description={
          build
            ? `Your AI CEO and AI CMO draft a plan from your goal and the facts about your business. ${cost} Nothing is posted or spent — you review the plan before any work starts.`
            : `Your AI CEO and AI CMO draft a new version${nextVersion ? ` (version ${nextVersion})` : ""} from your latest goal and facts. ${cost} Your current plan keeps guiding the team until you approve the new one; then the old one is marked superseded.`
        }
        confirmLabel={build ? "Build my plan" : "Draft a new version"}
        onConfirm={async () => {
          setError(null);
          try {
            const res = await generate({ slug, aiMode: ai.mode });
            onStarted(res.runId);
          } catch (e) {
            setError(e);
          }
        }}
      >
        <AiModePicker slug={slug} kind="strategy" value={ai.mode} onChange={ai.setMode} />
      </ConfirmDialog>
      <p className="text-xs text-ink-3">Up to {microsToCreditsLabel(max)}</p>
      {error ? <ErrorCallout error={error} /> : null}
    </div>
  );
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
        <RunProgress slug={slug} runId={runId} headingLevel="h2" done={<p className="text-sm text-ink-2">Your new plan is below. Review it and approve it when you&apos;re happy.</p>} />
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
export function PlanReviewCard({ slug, strategyId, version, canApprove, onDecided, quality }: { slug: string; strategyId: Id<"strategies">; version: number; canApprove: boolean; onDecided?: () => void; quality?: { state: QualityState; reasons: string[] } | null }) {
  const blocked = quality?.state === "failed";
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
    <section aria-labelledby="review-heading" className="rounded-xl border border-amber-500/30 bg-amber-100/60 p-5">
      <h2 id="review-heading" className="heading-section">
        Review your plan (version {version})
      </h2>
      <p className="mt-1 max-w-3xl text-sm text-ink-2">
        Approving lets your team start drafting content for the active channels below. Every post, email and ad still needs its own approval before it goes
        anywhere, and approving the plan spends no money.
      </p>
      {quality && quality.state !== "passed" ? (
        <div className={cn("mt-3 rounded-lg border p-3 text-sm", blocked ? "border-red-500/30 bg-red-100/60 text-red-900" : "border-line bg-surface text-ink-2")}>
          <p className="font-medium">{QUALITY_LABEL[quality.state]}</p>
          <ul className="mt-1 list-disc pl-5">
            {quality.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          {blocked ? <p className="mt-1">It can&apos;t start work. Refresh the plan, or send it back with what to change.</p> : null}
        </div>
      ) : null}
      {canApprove ? (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <ConfirmDialog
            trigger={<Button disabled={blocked}>Approve plan</Button>}
            title={`Approve plan version ${version}?`}
            description="Proposed channels become active and the team starts preparing drafts for them. Any earlier approved plan is marked superseded. Nothing is posted, sent or spent without a separate approval."
            confirmLabel="Approve plan"
            onConfirm={() => run("approve")}
          />
          <ConfirmDialog
            trigger={<Button variant="secondary">Send back</Button>}
            title="Send this plan back?"
            description="It goes back to draft and no work starts from it. You can refresh the plan to get a new version."
            confirmLabel="Send plan back"
            onConfirm={() => run("reject")}
          >
            <Field label="What should change?" optional>
              <Textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} rows={3} maxLength={500} />
            </Field>
          </ConfirmDialog>
        </div>
      ) : (
        <p className="mt-3 text-sm font-medium text-ink">Waiting for {PERMISSION_WHO.approve} to approve it.</p>
      )}
      {error ? <ErrorCallout error={error} className="mt-4" /> : null}
    </section>
  );
}
