"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import type { ReactNode } from "react";
import { Badge, Callout, Skeleton, StepList, type StepItem, type StepStatus } from "@/components/ui";
import { microsToDisplay } from "../money";
import { roleTitle } from "../roles";

export type RunStatusView = FunctionReturnType<typeof api.content.runStatus>;

export const RUN_STATUS_LABEL: Record<string, string> = {
  proposed: "Queued",
  cost_reserved: "Getting ready",
  preparing: "Working on it",
  needs_approval: "Waiting for approval",
  approved: "Approved",
  scheduled: "Scheduled",
  executing: "Working on it",
  verified: "Done",
  failed: "Didn't finish",
  uncertain: "Outcome uncertain",
  paused: "Paused",
  canceled: "Canceled",
};

export const RUN_STATUS_TONE: Record<string, "neutral" | "green" | "amber" | "red" | "blue" | "violet"> = {
  proposed: "neutral",
  cost_reserved: "blue",
  preparing: "blue",
  needs_approval: "amber",
  approved: "green",
  scheduled: "blue",
  executing: "blue",
  verified: "green",
  failed: "red",
  uncertain: "amber",
  paused: "amber",
  canceled: "neutral",
};

/** Statuses after which a run won't change on its own. */
export const RUN_FINISHED = new Set(["verified", "failed", "canceled", "uncertain", "needs_approval"]);

function stepStatus(s: string): StepStatus {
  if (s === "running") return "running";
  if (s === "succeeded" || s === "skipped") return "done";
  if (s === "failed" || s === "uncertain") return "failed";
  return "pending";
}

export function runSteps(run: RunStatusView): StepItem[] {
  return run.steps.map((s, i) => ({
    key: `${i}-${s.label}`,
    label: s.label,
    status: stepStatus(s.status),
    detail: [s.role ? roleTitle(s.role) : null, s.status === "skipped" ? "Skipped" : null, s.status === "uncertain" ? "Outcome uncertain" : null]
      .filter(Boolean)
      .join(" · ") || undefined,
  }));
}

/**
 * Live progress for an AI job. Re-renders as Convex pushes updates; a
 * polite live region announces the overall status (not every step).
 */
export function RunProgress({
  slug,
  runId,
  done,
  headingLevel: H = "h3",
}: {
  slug: string;
  runId: Id<"workflowRuns">;
  /** Extra content once the run finished successfully (e.g. a link to the drafts). */
  done?: ReactNode;
  headingLevel?: "h2" | "h3" | "h4";
}) {
  const run = useQuery(api.content.runStatus, { slug, runId });
  if (run === undefined) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-1/2" />
        <span className="sr-only" role="status">
          Loading progress…
        </span>
      </div>
    );
  }
  const label = RUN_STATUS_LABEL[run.status] ?? run.status;
  const running = run.steps.find((s) => s.status === "running");
  const finished = RUN_FINISHED.has(run.status);
  const announce = finished ? `${run.title}: ${label}.` : `${run.title}: ${label}${running ? ` — ${running.label}` : ""}.`;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <H className="font-semibold text-ink">{run.title}</H>
        <span className="flex flex-wrap gap-2">
          {run.isFixture ? <Badge tone="violet">Demo: simulated</Badge> : null}
          <Badge tone={RUN_STATUS_TONE[run.status] ?? "neutral"}>{label}</Badge>
        </span>
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>
      {run.steps.length > 0 ? <StepList steps={runSteps(run)} /> : <p className="text-sm text-ink-3">Getting the team ready…</p>}
      <p className="text-sm text-ink-3">
        {finished
          ? `Used ${microsToDisplay(run.actualMicros)} of up to ${microsToDisplay(run.estimateMicros)} reserved from your AI capacity.`
          : `Up to ${microsToDisplay(run.estimateMicros)} of AI capacity is reserved for this. Anything unused is returned.`}
      </p>
      {run.status === "verified" || run.status === "needs_approval" ? done : null}
      {run.status === "failed" || run.status === "canceled" || run.status === "uncertain" ? (
        <Callout tone={run.status === "failed" ? "danger" : "warning"} live="none" title={label}>
          {run.userMessage ?? (run.status === "canceled" ? "This job was canceled before it finished." : "The team couldn't finish this. Unused capacity was returned.")}
        </Callout>
      ) : run.userMessage && run.status !== "verified" ? (
        <p className="text-sm text-ink-2">{run.userMessage}</p>
      ) : null}
    </div>
  );
}
