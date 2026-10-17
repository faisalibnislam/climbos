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
    <Callout tone="warning" title={`We couldn't confirm whether this was posted on ${ch}`}>
      <p>
        We couldn&apos;t confirm whether this was posted. Check {ch}, then tell us what you see. ClimbOS never re-sends automatically, so it can&apos;t post twice by
        accident.
      </p>
      {artifact.canApprove ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <ConfirmDialog
            trigger={<Button>It was posted</Button>}
            title="Mark as posted?"
            description={`You checked ${ch} and the post is there. We'll record it as posted, confirmed by you. Nothing is sent.`}
            confirmLabel="Yes, it was posted"
            onConfirm={() => run("posted")}
          />
          <ConfirmDialog
            trigger={<Button variant="secondary">It wasn&apos;t posted</Button>}
            title="Mark as not posted?"
            description={`You checked ${ch} and the post isn't there. We'll record that it didn't go out. Nothing is re-sent automatically — you can approve and publish it again deliberately.`}
            confirmLabel="It wasn't posted"
            onConfirm={() => run("not_posted")}
          />
        </div>
      ) : (
        <p className="mt-2">Recording what happened needs {PERMISSION_WHO.approve}.</p>
      )}
      {error ? <ErrorCallout error={error} className="mt-3" /> : null}
    </Callout>
  );
}
