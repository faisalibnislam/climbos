"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Badge, Button, Textarea, toast } from "@/components/ui";
import { errorMessage } from "@/components/app/errors";

/** Recording attendance is separate from any communication with the guest. */
export function BookingOutcome({ slug, inboxId }: { slug: string; inboxId: Id<"communityMessages"> }) {
  const b = useQuery(api.bookings.forInbox, { slug, inboxId });
  const setOutcome = useMutation(api.bookings.setOutcome);
  const [busy, setBusy] = useState(false);
  if (!b || b.status === "cancelled" || !b.past) return null;
  const record = async (outcome: "attended" | "no_show") => {
    setBusy(true);
    try {
      await setOutcome({ slug, bookingId: b.id, outcome });
      toast({ tone: "success", title: outcome === "no_show" ? "No-show recorded. Nothing sent." : "Attendance recorded. Nothing sent." });
    } catch (error) { toast({ tone: "danger", title: errorMessage(error) }); }
    finally { setBusy(false); }
  };
  return <div className="w-full space-y-3">
    <div className="flex flex-wrap items-center gap-2">
      {b.outcome ? <Badge tone={b.outcome === "attended" ? "green" : "orange"}>{b.outcome === "attended" ? "Showed up" : "No-show recorded"}</Badge> : null}
      {b.outcome !== "attended" ? <Button size="sm" variant="secondary" disabled={busy} onClick={() => record("attended")}>{b.outcome ? "Correct to attended" : "Showed up"}</Button> : null}
      {b.outcome !== "no_show" ? <Button size="sm" variant="ghost" disabled={busy} onClick={() => record("no_show")}>{b.outcome ? "Correct to no-show" : "No-show"}</Button> : null}
    </div>
    <p className="text-xs text-ink-2">Records your observation only. No email is sent.</p>
    {b.followUpStatus === "historical_unverified" ? <p className="text-sm text-ink-2">An older follow-up record exists, but sending was not verified. Check your email history before contacting this guest again.</p> : null}
    {b.followUpDraft ? <BookingFollowUpDraft key={b.id} draft={b.followUpDraft} /> : null}
  </div>;
}

function BookingFollowUpDraft({ draft }: { draft: { subject: string; text: string } }) {
  const [base, setBase] = useState(draft);
  const [text, setText] = useState(`Subject: ${draft.subject}\n\n${draft.text}`);
  const changed = draft.subject !== base.subject || draft.text !== base.text;
  return <details className="w-full rounded-lg border border-line p-3">
    <summary className="cursor-pointer text-sm font-medium text-ink">Review a follow-up draft</summary>
    <div className="mt-3 space-y-3">
      <p className="text-xs text-ink-2">Edit and copy for manual use in your email app. Verify the guest and message there. ClimbOS does not send this draft; edits stay in this view.</p>
      {changed ? <div className="space-y-2"><p className="text-sm text-ink-2">Booking details changed. Your edits remain here; reload the suggested text before copying.</p><Button size="sm" variant="secondary" onClick={() => { setBase(draft); setText(`Subject: ${draft.subject}\n\n${draft.text}`); }}>Reload suggested text</Button></div> : null}
      <Textarea aria-label="Booking follow-up draft" value={text} onChange={event => setText(event.target.value)} rows={6} />
      <Button size="sm" variant="secondary" disabled={changed || !text.trim()} onClick={async () => {
        try { await navigator.clipboard.writeText(text); toast({ tone: "success", title: "Draft copied. Nothing sent." }); }
        catch { toast({ tone: "info", title: "Select the text and copy it directly." }); }
      }}>Copy draft</Button>
    </div>
  </details>;
}
