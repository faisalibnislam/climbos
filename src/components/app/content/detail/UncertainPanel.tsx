"use client";

import { useAction, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { useState } from "react";
import { Button, Callout, ConfirmDialog, toast } from "@/components/ui";
import { ErrorCallout, PERMISSION_WHO, channelLabel, useNow } from "../shared";
import type { ArtifactView } from "./model";

/** Owner check after an "Outcome uncertain" result. ClimbOS never re-sends on its own. */
export function UncertainPanel({ slug, artifact }: { slug: string; artifact: ArtifactView }) {
  const resolve = useMutation(api.content.resolveUncertain);
  const checkResult = useAction(api.publish.checkResult);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const ch = channelLabel(artifact.channel);
  const recovery = artifact.recovery;
  const now = useNow();
  const waiting = now === null || Boolean(recovery && now < recovery.availableAt);
  const check = async () => {
    if (!recovery) return;
    setChecking(true); setError(null);
    try {
      const result = await checkResult({ slug, artifactId: artifact.id, receiptId: recovery.receiptId, versionId: recovery.versionId, approvalId: recovery.approvalId, approvalHash: recovery.approvalHash });
      toast({ tone: result === "verified" ? "success" : "info", title: result === "verified" ? "Confirmed on the original account." : "Still unconfirmed. Check the original account before recording an outcome." });
    } catch (e) { setError(e); } finally { setChecking(false); }
  };

  const run = async (outcome: "posted" | "not_posted") => {
    setError(null);
    if (!recovery) return;
    try {
      await resolve({ slug, artifactId: artifact.id, outcome, receiptId: recovery.receiptId, versionId: recovery.versionId, approvalId: recovery.approvalId, approvalHash: recovery.approvalHash });
      toast({ tone: "success", title: outcome === "posted" ? "Marked as posted." : "Marked as not posted." });
    } catch (e) {
      setError(e);
    }
  };

  return (
    <Callout tone="warning" title={`Not confirmed on ${ch}`}>
      <p>Check the original post on {ch}, then record what you found. Your answer is an owner report, not provider verification.</p>
      {recovery?.externalAccountId ? <p className="mt-2 break-all text-sm">Original account: {recovery.externalAccountId}</p> : null}
      {recovery?.legacy ? <p className="mt-2 text-sm">The original account identity was not saved. Verify the account used for this attempt before answering.</p> : null}
      {waiting && recovery ? <p className="mt-2 text-sm">The request may still be running. These controls become available five minutes after it started.</p> : null}
      {!recovery ? <p className="mt-2 text-sm">No matching unresolved attempt is available. Reload or ask support to inspect the publishing history.</p> : null}
      {artifact.canApprove && recovery?.canCheckProvider ? <Button variant="secondary" className="mt-3" loading={checking} disabled={waiting} onClick={check}>Check provider result</Button> : null}
      {artifact.canApprove && recovery ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <ConfirmDialog
            key={`${recovery.receiptId}:${recovery.approvalHash}:${recovery.versionId}:posted`}
            trigger={<Button disabled={waiting || checking}>It was posted</Button>}
            title="Mark as posted?"
            description={`It's on ${ch}. Recorded as posted; nothing is sent.`}
            confirmLabel="Yes, it was posted"
            onConfirm={() => run("posted")}
          />
          <ConfirmDialog
            key={`${recovery.receiptId}:${recovery.approvalHash}:${recovery.versionId}:not-posted`}
            trigger={<Button variant="secondary" disabled={waiting || checking}>It wasn&apos;t posted</Button>}
            title="Mark as not posted?"
            description={`It's not on ${ch}. Nothing is re-sent; you can re-approve and publish.`}
            confirmLabel="It wasn't posted"
            onConfirm={() => run("not_posted")}
          />
        </div>
      ) : !artifact.canApprove ? (
        <p className="mt-2">Needs {PERMISSION_WHO.approve}.</p>
      ) : null}
      {error ? <ErrorCallout error={error} className="mt-3" /> : null}
    </Callout>
  );
}
