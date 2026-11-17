"use client";

import { Button } from "@/components/ui";
import { useClimb } from "@/components/climb/context";

const REVIEW_REQUEST = "Review this customer's saved notes, needs, objections and next step. Explain what is supported, conflicting or unknown, then suggest the most useful next question, draft, wait or stop. Do not contact anyone or change the deal.";

export function DealReviewButton({ id, name, onPrepared }: { id: string; name: string; onPrepared: () => void }) {
  const climb = useClimb();
  const draft = climb.draft.trim() ? `${climb.draft.trimEnd()}\n${REVIEW_REQUEST}` : REVIEW_REQUEST;
  const tooLong = draft.length > 4000;
  return <div className="space-y-1.5">
    <Button variant="secondary" size="sm" disabled={tooLong} onClick={() => {
      climb.setDraft(draft);
      climb.addSelection({ type: "deal", id, label: name });
      onPrepared();
      climb.setOpen(true);
    }}>Review next step</Button>
    <p className="text-xs text-ink-3">{tooLong ? "Your unsent question is nearly full. Shorten it before adding this review." : "Prepares an editable question using saved notes. Nothing is submitted or sent yet."}</p>
  </div>;
}
