"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import Link from "next/link";
import { useState } from "react";
import { Button, Callout, ConfirmDialog, Spinner, toast } from "@/components/ui";
import { ErrorCallout } from "../shared";
import type { ArtifactView } from "./model";

export function WordPressDraftPanel({ slug, artifact, canCreate }: { slug: string; artifact: ArtifactView; canCreate: boolean }) {
  const drafts = useQuery(api.wordpressDrafts.forArtifact, { slug, artifactId: artifact.id });
  const createDraft = useMutation(api.wordpressDrafts.createDraft);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const latest = drafts?.[0];
  const connected = Boolean(artifact.wordpressConnection);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const result = await createDraft({ slug, artifactId: artifact.id });
      if (result.status === "uncertain") toast({ tone: "info", title: "Check WordPress before retrying", description: result.summary });
      else toast({ tone: "success", title: result.status === "verified" ? "WordPress draft verified" : "WordPress draft request started", description: result.summary });
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
      <div>
        <h3 className="text-sm font-semibold text-ink">WordPress draft</h3>
        <p className="mt-1 text-sm text-ink-2">A private draft of this approved article. Never published by ClimbOS.</p>
      </div>

      {!connected ? (
        <Callout tone="info" title="Connect WordPress first">
          <Link className="underline" href={`/app/${slug}/connections`}>Open Connections</Link> to connect it.
        </Callout>
      ) : null}

      {latest?.status === "pending" ? (
        <p role="status" className="inline-flex items-center gap-2 text-sm text-ink-2"><Spinner /> Sending to WordPress and checking the draft…</p>
      ) : null}
      {latest?.status === "verified" ? (
        <Callout tone="success" title="Draft saved and checked">
          <p>{latest.summary}</p>
          {latest.editUrl ? <Link className="mt-2 inline-block underline" href={latest.editUrl} target="_blank" rel="noreferrer">Open draft in WordPress</Link> : null}
        </Callout>
      ) : null}
      {latest?.status === "failed" ? <Callout tone="warning" title="WordPress did not create the draft">{latest.summary}</Callout> : null}
      {latest?.status === "uncertain" ? (
        <Callout tone="warning" title="WordPress may have created a draft">
          <p>{latest.summary} Check WordPress before retrying.</p>
          {latest.editUrl ? <Link className="mt-2 inline-block underline" href={latest.editUrl} target="_blank" rel="noreferrer">Check this draft in WordPress</Link> : null}
        </Callout>
      ) : null}

      {connected && canCreate && latest?.status !== "pending" && latest?.status !== "uncertain" ? (
        <ConfirmDialog
          trigger={<Button variant="primary" disabled={busy} loading={busy} loadingText="Requesting draft…">{latest?.status === "failed" ? "Try again" : "Create WordPress draft"}</Button>}
          title="Create a private WordPress draft?"
          description={`Sends ${artifact.current?.version ? `v${artifact.current.version}` : "the approved version"} to ${artifact.wordpressConnection?.accountLabel ?? "your site"} as a draft. Not published.`}
          confirmLabel="Create private draft"
          onConfirm={submit}
        >
          {artifact.current?.headline ? <p className="text-sm text-ink-2">Article: {artifact.current.headline}</p> : null}
        </ConfirmDialog>
      ) : null}
      {connected && !canCreate && !latest ? <p className="text-sm text-ink-3">Approve the current version first.</p> : null}
      {error ? <ErrorCallout error={error} /> : null}
    </section>
  );
}
