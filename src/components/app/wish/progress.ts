export type WishCardProgressInput = {
  status: string;
  kind: string;
  externalEffect: boolean;
};

export type WishProgressKind = "reading" | "failed" | "working" | "ready_for_review" | "completed" | "skipped" | "next_step" | null;

export function wishProgressKind(cards: WishCardProgressInput[], thinking: boolean, failed: boolean): WishProgressKind {
  if (thinking) return "reading";
  if (failed) return "failed";
  if (cards.some((card) => card.status === "running")) return "working";
  const resolved = cards.length > 0 && cards.every((card) => ["done", "rejected"].includes(card.status) || card.kind === "note");
  if (resolved) {
    if (cards.every((card) => card.status === "rejected")) return "skipped";
    if (cards.some((card) => card.status === "done" && card.externalEffect)) return "ready_for_review";
    return "completed";
  }
  return cards.length ? "next_step" : null;
}

export const WISH_PROGRESS_LABELS: Record<Exclude<WishProgressKind, null>, string> = {
  reading: "Reading…",
  failed: "Couldn’t finish",
  working: "In progress",
  ready_for_review: "Ready for review",
  completed: "Completed",
  skipped: "Skipped",
  next_step: "Choose a next step",
};
