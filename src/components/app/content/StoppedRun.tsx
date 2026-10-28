"use client";

import Link from "next/link";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useState } from "react";
import { Badge, Button, Callout, buttonClasses, toast } from "@/components/ui";
import { Magic, RefreshCw } from "@/components/icons";
import { useClimbMaybe } from "@/components/climb/context";
import { can } from "@shared/policy";
import { runMessage, runStatusPresentation } from "../../../../shared/progress";
import { errorMessage } from "../errors";
import { useCostDisplay } from "../useCostDisplay";
import { useWorkspaceMember } from "./shared";

/** A job row as the run lists return it; stopped runs carry the extra fields. */
export type StoppedRunRow = {
  id: Id<"workflowRuns">;
  kind?: string;
  title: string;
  estimateMicros?: number;
  status: string;
  userMessage: string | null;
  replaced?: boolean;
  canRetry?: boolean;
  retryMicros?: number;
};

const STOPPED = new Set(["failed", "canceled", "uncertain"]);

/** The status badge for a job row: a failure newer work already replaced reads as grey, not red. */
export function RunRowBadge({ run }: { run: Pick<StoppedRunRow, "status" | "replaced"> }) {
  if (run.status === "failed" && run.replaced) return <Badge tone="neutral">Replaced by newer work</Badge>;
  const s = runStatusPresentation(run.status);
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

/**
 * What to do about a job that stopped: why, in plain words, and buttons to try again, see the
 * steps, dismiss it, or ask Climb. Replaced failures show nothing; other runs show their note.
 */
export function StoppedRunNotice({ slug, run, className }: { slug: string; run: StoppedRunRow; className?: string }) {
  const member = useWorkspaceMember(slug);
  const climb = useClimbMaybe();
  const fmt = useCostDisplay();
  const retry = useMutation(api.workspace.retryRun);
  const dismiss = useMutation(api.workspace.dismissRun);
  const startResearch = useMutation(api.orgs.startResearch);
  const generatePlan = useMutation(api.orgs.generatePlan);
  const [busy, setBusy] = useState<"retry" | "restart" | "dismiss" | null>(null);
  const message = runMessage(run.userMessage);
  if (!STOPPED.has(run.status)) {
    return message ? (
      <Callout tone="info" live="none" className={className}>
        {message}
      </Callout>
    ) : null;
  }
  if (run.replaced) return null;
  const canEdit = Boolean(member?.role && can(member.role, "edit"));
  // Jobs that can't continue but can start over from here with saved inputs.
  const restartable = !run.canRetry && run.status === "failed" && (run.kind === "onboarding_research" || run.kind === "strategy");
  const act = async (kind: "retry" | "restart" | "dismiss") => {
    setBusy(kind);
    try {
      if (kind === "retry") {
        await retry({ slug, runId: run.id });
        toast({ tone: "success", title: `Trying again: ${run.title}`, description: "Finished steps are kept." });
      } else if (kind === "restart") {
        if (run.kind === "onboarding_research") await startResearch({ slug });
        else await generatePlan({ slug });
        toast({ tone: "success", title: `Started again: ${run.title}` });
      } else {
        await dismiss({ slug, runId: run.id });
      }
    } catch (e) {
      toast({ tone: "danger", title: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  };
  return (
    <Callout
      tone={run.status === "failed" ? "danger" : "warning"}
      live="none"
      className={className}
      action={
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            {canEdit && run.canRetry ? (
              <Button size="sm" loading={busy === "retry"} loadingText="Starting…" onClick={() => act("retry")}>
                <RefreshCw aria-hidden /> Try again
              </Button>
            ) : canEdit && restartable ? (
              <Button size="sm" loading={busy === "restart"} loadingText="Starting…" onClick={() => act("restart")}>
                <RefreshCw aria-hidden /> Start again
              </Button>
            ) : null}
            <Link href={`/app/${slug}/work/${run.id}`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
              See what happened
            </Link>
            {climb ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  climb.addSelection({ type: "run", id: run.id, label: `Stopped job: ${run.title}` });
                  climb.setDraft(`Why didn't "${run.title}" finish, and what should I do?`);
                  climb.setOpen(true);
                }}
              >
                <Magic aria-hidden /> Ask Climb
              </Button>
            ) : null}
            {canEdit ? (
              <Button size="sm" variant="ghost" loading={busy === "dismiss"} onClick={() => act("dismiss")}>
                Dismiss
              </Button>
            ) : null}
          </div>
          {canEdit && run.canRetry && run.retryMicros ? <span className="text-xs text-ink-3">Reserves up to {fmt.upTo(run.retryMicros)}; finished steps kept, unused credits return.</span> : null}
          {canEdit && restartable ? <span className="text-xs text-ink-3">Starts over with your saved details{run.estimateMicros ? `, up to ${fmt.upTo(run.estimateMicros)}` : ""}. Unused credits return.</span> : null}
          {canEdit && !run.canRetry && !restartable && run.status === "failed" ? <span className="text-xs text-ink-3">Can&apos;t resume. Start it again from its original page.</span> : null}
        </div>
      }
    >
      {message ?? "This job stopped before it finished."}
    </Callout>
  );
}
