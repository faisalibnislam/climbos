"use client";

import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useState, type FormEvent } from "react";
import { Button, Dialog, DialogClose, DialogContent, DialogFooter, Field, RadioCards, Textarea, toast } from "@/components/ui";
import { opsError } from "./opsShared";

/** Resolve an uncertain run after checking the provider by hand. The note is stored in the audit log. */
export function ResolveUncertainDialog({ run, onClose }: { run: { id: string; title: string } | null; onClose: () => void }) {
  const resolve = useMutation(api.ops.resolveUncertain);
  const [outcome, setOutcome] = useState<"verified" | "failed">("verified");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    if (busy) return;
    setNote("");
    setError(null);
    setOutcome("verified");
    onClose();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!run) return;
    if (note.trim().length < 5) {
      setError("Write what you checked (at least a few words).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await resolve({ runId: run.id as Id<"workflowRuns">, outcome, note: note.trim() });
      toast({ tone: "success", title: `Run marked ${outcome === "verified" ? "verified" : "failed"}` });
      setBusy(false);
      setNote("");
      onClose();
    } catch (err) {
      setError(opsError(err));
      setBusy(false);
    }
  }

  return (
    <Dialog open={run !== null} onOpenChange={(v) => (!v ? close() : undefined)}>
      {run ? (
        <DialogContent title="Resolve uncertain run" description={run.title}>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <RadioCards
              aria-label="Outcome"
              columns={2}
              value={outcome}
              onValueChange={(v) => setOutcome(v as "verified" | "failed")}
              options={[
                { value: "verified", title: "It went through", description: "The provider shows the action happened." },
                { value: "failed", title: "It didn't happen", description: "The provider has no record of it." },
              ]}
            />
            <Field label="What did you check?" hint="Stored in the audit log and shown to the customer as the run's outcome note." error={error ?? undefined}>
              <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
            </Field>
            <p aria-live="assertive" className="sr-only">
              {error ?? ""}
            </p>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="secondary" disabled={busy}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" variant={outcome === "failed" ? "danger" : "primary"} loading={busy}>
                {outcome === "verified" ? "Mark as verified" : "Mark as failed"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
