"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { RefreshCw, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button, Card, CardContent, ConfirmDialog, Field, Textarea, toast } from "@/components/ui";
import { RUN_FINISHED, RunProgress } from "../content/RunProgress";
import { ErrorCallout, PERMISSION_WHO } from "../content/shared";
import { microsToDisplay } from "../money";

/** "Build my plan" / "Refresh plan": confirm with the capacity note, then start the strategy job. */
export function GeneratePlanButton({
  slug,
  mode,
  nextVersion,
  estimateMicros,
  onStarted,
}: {
  slug: string;
  mode: "build" | "refresh";
  nextVersion?: number;
  /** Max cost of the plan job (µUSD). */
  estimateMicros: number;
  onStarted: (runId: Id<"workflowRuns">) => void;
}) {
  const generate = useMutation(api.orgs.generatePlan);
  const [error, setError] = useState<unknown>(null);
  const build = mode === "build";
  const cost = `Uses up to ${microsToDisplay(estimateMicros)} of this month's AI capacity; anything unused is returned.`;
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
            const res = await generate({ slug });
            onStarted(res.runId);
          } catch (e) {
            setError(e);
          }
        }}
      />
      <p className="text-sm text-ink-3">Up to {microsToDisplay(estimateMicros)} of AI capacity</p>
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
    <Card className="border-green-200">
      <CardContent className="flex flex-col gap-4">
        <RunProgress slug={slug} runId={runId} headingLevel="h2" done={<p className="text-[0.95rem] text-ink-2">Your new plan is below. Review it and approve it when you&apos;re happy.</p>} />
        {finished && startedRunId ? (
          <Button variant="ghost" className="self-start" onClick={onDismiss}>
            Hide progress
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Prominent review card for a plan waiting for approval. */
export function PlanReviewCard({ slug, strategyId, version, canApprove }: { slug: string; strategyId: Id<"strategies">; version: number; canApprove: boolean }) {
  const decide = useMutation(api.workspace.decidePlan);
  const [note, setNote] = useState("");
  const [error, setError] = useState<unknown>(null);
  const run = async (decision: "approve" | "reject") => {
    setError(null);
    try {
      await decide({ slug, strategyId, decision, note: decision === "reject" && note.trim() ? note.trim() : undefined });
      toast({ tone: "success", title: decision === "approve" ? "Plan approved." : "Plan sent back." });
      setNote("");
    } catch (e) {
      setError(e);
    }
  };
  return (
    <section aria-labelledby="review-heading" className="rounded-[var(--radius-lg)] border-2 border-amber-800/40 bg-amber-100 p-5 sm:p-6">
      <h2 id="review-heading" className="text-xl font-semibold text-ink">
        Review your plan (version {version})
      </h2>
      <p className="mt-2 max-w-3xl leading-relaxed text-ink-2">
        Approving lets your team start drafting content for the active channels below. Every post, email and ad still needs its own approval before it goes
        anywhere, and approving the plan spends no money.
      </p>
      {canApprove ? (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <ConfirmDialog
            trigger={<Button>Approve plan</Button>}
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
        <p className="mt-3 font-medium text-ink">Waiting for {PERMISSION_WHO.approve} to approve it.</p>
      )}
      {error ? <ErrorCallout error={error} className="mt-4" /> : null}
    </section>
  );
}
