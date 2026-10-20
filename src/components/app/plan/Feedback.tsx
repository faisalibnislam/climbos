"use client";

import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { MessageSquarePlus } from "@/components/icons";
import { useState } from "react";
import { Button, ChoiceChips, Input, Popover, PopoverContent, PopoverTrigger, toast } from "@/components/ui";
import { errorMessage } from "@/components/app/errors";

type Reason = "wrong_fact" | "too_expensive" | "cannot_implement" | "already_tried" | "done" | "not_relevant";

const REASONS: { value: Reason; label: string }[] = [
  { value: "done", label: "Done" },
  { value: "already_tried", label: "Already tried" },
  { value: "too_expensive", label: "Too expensive" },
  { value: "cannot_implement", label: "Can't do it" },
  { value: "wrong_fact", label: "Wrong fact" },
  { value: "not_relevant", label: "Not relevant" },
];

/** What the note asks for, per reason. */
const NOTE: Record<Reason, { label: string; required: boolean }> = {
  done: { label: "What happened?", required: true },
  already_tried: { label: "What you tried and the result", required: true },
  too_expensive: { label: "What would you spend? (optional)", required: false },
  cannot_implement: { label: "What's in the way? (optional)", required: false },
  wrong_fact: { label: "What's actually true? (optional)", required: false },
  not_relevant: { label: "Why? (optional)", required: false },
};

/**
 * Specific feedback on one part of a plan (cycle 2): each reason updates its
 * own record and reaches the next plan, instead of a generic thumbs-down.
 */
export function FeedbackButton({ slug, strategyId, subjectKind, subjectKey, subjectLabel }: { slug: string; strategyId: Id<"strategies">; subjectKind: "play" | "channel" | "fact" | "plan"; subjectKey: string; subjectLabel: string }) {
  const give = useMutation(api.feedback.give);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<Reason | "">("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const need = reason ? NOTE[reason] : null;
  const submit = async () => {
    if (!reason) return;
    setBusy(true);
    try {
      await give({ slug, strategyId, subjectKind, subjectKey, subjectLabel, reason, note: note.trim() || undefined });
      toast({ tone: "success", title: "Thanks. The next plan will use this." });
      setOpen(false);
      setReason("");
      setNote("");
    } catch (e) {
      toast({ tone: "danger", title: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost" aria-label={`Feedback on ${subjectLabel}`}>
          <MessageSquarePlus aria-hidden className="size-4" /> Feedback
        </Button>
      </PopoverTrigger>
      <PopoverContent className="flex w-80 flex-col gap-3">
        <ChoiceChips aria-label="What's the feedback?" options={REASONS} value={reason} onValueChange={(v) => setReason(v as Reason)} />
        {need ? (
          <label className="flex flex-col gap-1 text-xs text-ink-2">
            {need.label}
            <Input value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} maxLength={500} />
          </label>
        ) : null}
        <Button size="sm" onClick={submit} disabled={!reason || busy || Boolean(need?.required && !note.trim())}>
          {busy ? "Saving…" : "Send"}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
