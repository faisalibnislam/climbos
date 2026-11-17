"use client";

import { useAction, useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@convex/_generated/api";
import { useState, type FormEvent } from "react";
import { Button, Callout, Dialog, DialogContent, Field, Select, Textarea, toast } from "@/components/ui";
import { errorMessage } from "../errors";

type Receipt = FunctionReturnType<typeof api.reviews.overview>["recent"][number];
export function ReviewReceiptControls({ slug, receipt }: { slug: string; receipt: Receipt }) {
  const check = useAction(api.mailbox.checkReviewReceipt);
  const record = useMutation(api.reviews.recordReceiptObservation);
  const [reviewRevision, setReviewRevision] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<"sent" | "not_sent" | "unknown">("unknown");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function checkMailbox() {
    setBusy(true); setError(null);
    try {
      const result = await check({ slug, id: receipt.id, revision: receipt.recoveryRevision });
      toast({ tone: result.matched ? "success" : "info", title: result.message });
    } catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  }
  async function save(event: FormEvent) {
    event.preventDefault(); if (reviewRevision === null) return;
    setBusy(true); setError(null);
    try {
      await record({ slug, id: receipt.id, revision: reviewRevision, outcome, note });
      setReviewRevision(null); toast({ tone: "success", title: "Observation recorded. Nothing sent." });
    } catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  }
  return <div className="flex flex-col gap-2">
    <div className="flex flex-wrap gap-2">
      {receipt.canCheckMailbox ? <Button size="sm" variant="secondary" disabled={busy} onClick={checkMailbox}>Check original mailbox</Button> : null}
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setReviewRevision(receipt.recoveryRevision); setOutcome("unknown"); setNote(""); setError(null); }}>Record what I found</Button>
    </div>
    {error && reviewRevision === null ? <p role="alert" className="text-xs text-ink-2">{error}</p> : null}
    <Dialog open={reviewRevision !== null} onOpenChange={open => { if (!open && !busy) setReviewRevision(null); }}>
      <DialogContent title={`Invitation to ${receipt.name}`} description="Record your own observation of this exact invitation. This does not send or retry an email.">
        <form onSubmit={save} className="flex flex-col gap-4">
          <p className="text-sm text-ink-2">Check the original mailbox and message before deciding. Not finding a message alone does not prove it was never sent. Your report remains separate from mailbox evidence.</p>
          <div className="rounded-lg border border-line p-3 text-sm text-ink-2">
            <p className="break-words">To: {receipt.email}</p>
            {receipt.receiptPreview ? <><p className="break-words">From: {receipt.receiptPreview.sender}</p><p>Subject: {receipt.receiptPreview.subject}</p><details className="mt-2"><summary className="cursor-pointer">Original message</summary><pre className="mt-2 whitespace-pre-wrap break-words font-sans text-xs">{receipt.receiptPreview.text}</pre><p className="mt-2 break-all text-xs">Message ID: {receipt.receiptPreview.messageId}</p></details></> : <p>The original message snapshot is unavailable. Use your own mailbox records; do not assume the current template is what was sent.</p>}
            {receipt.attemptedAt !== null ? <p className="mt-2">Attempt started: {new Date(receipt.attemptedAt).toLocaleString()}</p> : null}
          </div>
          <Field label="What did you find?"><Select value={outcome} onValueChange={value => setOutcome(value as typeof outcome)} options={[{ value: "unknown", label: "Still unknown" }, { value: "sent", label: "I confirmed it was sent" }, { value: "not_sent", label: "I confirmed it was not sent" }]} /></Field>
          <Field label="What you checked" hint="Describe the evidence for this result. Avoid sensitive personal information."><Textarea required minLength={5} maxLength={500} value={note} disabled={busy} onChange={e => setNote(e.target.value)} /></Field>
          {outcome === "not_sent" ? <p className="text-sm text-ink-2">A new invitation will still require a fresh recipient preview and approval. This report does not queue one.</p> : null}
          {error ? <Callout tone="warning" title="Could not record">{error}</Callout> : null}
          <Button type="submit" loading={busy} disabled={note.trim().length < 5}>Save observation</Button>
        </form>
      </DialogContent>
    </Dialog>
  </div>;
}
