"use client";

import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { useState } from "react";
import { Button, Callout, ConfirmDialog, toast } from "@/components/ui";
import { ErrorCallout, PERMISSION_WHO, channelLabel } from "../shared";
import type { ArtifactView } from "./model";

/** Owner check after an "Outcome uncertain" result. ClimbOS never re-sends on its own. */
export function UncertainPanel({ slug, artifact }: { slug: string; artifact: ArtifactView }) {
  const resolve = useMutation(api.content.resolveUncertain);
  const [error, setError] = useState<unknown>(null);
  const ch = channelLabel(artifact.channel);

  const run = async (outcome: "posted" | "not_posted") => {
    setError(null);
    try {
      await resolve({ slug, artifactId: artifact.id, outcome });
      toast({ tone: "success", title: outcome === "posted" ? "Marked as posted." : "Marked as not posted." });
    } catch (e) {
      setError(e);
    }
  };

  return (
    <Callout tone="warning" title={`Not confirmed on ${ch}`}>
      <p>Check {ch}, then tell us. ClimbOS never re-sends on its own.</p>
      {artifact.canApprove ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <ConfirmDialog
            trigger={<Button>It was posted</Button>}
            title="Mark as posted?"
            description={`It's on ${ch}. Recorded as posted; nothing is sent.`}
            confirmLabel="Yes, it was posted"
            onConfirm={() => run("posted")}
          />
          <ConfirmDialog
            trigger={<Button variant="secondary">It wasn&apos;t posted</Button>}
            title="Mark as not posted?"
            description={`It's not on ${ch}. Nothing is re-sent; you can re-approve and publish.`}
            confirmLabel="It wasn't posted"
            onConfirm={() => run("not_posted")}
          />
        </div>
      ) : (
        <p className="mt-2">Needs {PERMISSION_WHO.approve}.</p>
      )}
      {error ? <ErrorCallout error={error} className="mt-3" /> : null}
    </Callout>
  );
}
