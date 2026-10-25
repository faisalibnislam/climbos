import { Badge } from "@/components/ui";

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

export function actionCardStatusLabel(status: ActionCardStatusValue, externalEffect: boolean): string {
  return status === "done" && externalEffect ? "Ready for review" : LABELS[status];
}

export function ActionCardStatus({ status, externalEffect }: { status: ActionCardStatusValue; externalEffect: boolean }) {
  const readyForReview = status === "done" && externalEffect;
  return (
    <span className="inline-flex items-center gap-2">
      <Badge tone={TONES[status]}>{actionCardStatusLabel(status, externalEffect)}</Badge>
      {readyForReview ? <span className="sr-only">Nothing has gone live.</span> : null}
    </span>
  );
}

export function actionCardStatusExplanation(status: ActionCardStatusValue, externalEffect: boolean): string | null {
  return status === "done" && externalEffect ? "Prepared for review. Nothing has gone live." : null;
}
