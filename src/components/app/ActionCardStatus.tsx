import { Badge } from "@/components/ui";
import { actionNeedsOwnerReview } from "@/components/app/wish/progress";

type ActionCardStatusValue = "proposed" | "approved" | "running" | "done" | "failed" | "blocked" | "rejected";

const LABELS: Record<ActionCardStatusValue, string> = {
  proposed: "Suggested",
  approved: "Approved",
  running: "In progress",
  done: "Completed",
  failed: "Couldn’t finish",
  blocked: "Needs setup",
  rejected: "Skipped",
};

const TONES: Record<ActionCardStatusValue, "neutral" | "green" | "blue" | "red" | "amber"> = {
  proposed: "neutral",
  approved: "green",
  running: "blue",
  done: "green",
  failed: "red",
  blocked: "amber",
  rejected: "neutral",
};

export function actionCardStatusLabel(status: ActionCardStatusValue, externalEffect: boolean, kind?: string): string {
  return status === "done" && actionNeedsOwnerReview(kind, externalEffect) ? "Ready for review" : LABELS[status];
}

/** Setup suggestions open the relevant screen; they do not perform setup or change permissions. */
export function actionCardSetupHref(slug: string, kind: string): string | null {
  if (kind === "connect_account") return `/app/${slug}/connections`;
  if (kind === "set_up_autopilot") return `/app/${slug}/autopilot`;
  return null;
}

export function actionCardStartLabel(kind: string, externalEffect: boolean): string {
  if (kind === "note") return "Got it";
  if (kind === "connect_account") return "Connect account";
  if (kind === "set_up_autopilot") return "Review autopilot setup";
  return actionNeedsOwnerReview(kind, externalEffect) ? "Prepare it" : "Do it";
}

export function ActionCardStatus({ status, externalEffect, kind }: { status: ActionCardStatusValue; externalEffect: boolean; kind?: string }) {
  const readyForReview = status === "done" && actionNeedsOwnerReview(kind, externalEffect);
  return (
    <span className="inline-flex items-center gap-2">
      <Badge tone={TONES[status]}>{actionCardStatusLabel(status, externalEffect, kind)}</Badge>
      {readyForReview ? <span className="sr-only">Nothing has gone live.</span> : null}
    </span>
  );
}

export function actionCardStatusExplanation(status: ActionCardStatusValue, externalEffect: boolean, kind?: string): string | null {
  return status === "done" && actionNeedsOwnerReview(kind, externalEffect) ? "Prepared for review. Nothing has gone live." : null;
}
