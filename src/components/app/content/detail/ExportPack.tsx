"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Check, Copy, Download, TriangleAlert } from "@/components/icons"
import { useState } from "react";
import { Badge, Button, Callout, ConfirmDialog, Skeleton, SocialIcon, buttonClasses, toast } from "@/components/ui";
import { ErrorCallout, MessageText } from "../shared";
import type { ArtifactView } from "./model";

function CopyButton({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <span className="inline-flex flex-col gap-1">
      <Button
        variant="secondary"
        size="md"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setState("copied");
            setTimeout(() => setState("idle"), 2500);
          } catch {
            setState("failed");
          }
        }}
      >
        {state === "copied" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        {state === "copied" ? "Copied" : label}
      </Button>
      <span role="status" className="sr-only">
        {state === "copied" ? `${label}: copied to clipboard.` : ""}
      </span>
      {state === "failed" ? <span className="text-ui font-medium text-red-800">Couldn&apos;t copy. Copy manually.</span> : null}
    </span>
  );
}

function safeFileName(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "export";
}

/** Copy-ready text per platform, CSV download, and "Mark as exported". */
export function ExportPackPanel({ slug, artifact }: { slug: string; artifact: ArtifactView }) {
  const data = useQuery(api.content.exportPack, { slug, artifactId: artifact.id });
  const markExported = useMutation(api.content.markExported);
  const [error, setError] = useState<unknown>(null);

  if (data === undefined) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (data === null) return <p className="text-sm text-ink-3">Nothing to export yet.</p>;

  const download = () => {
    const blob = new Blob([data.csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeFileName(artifact.title)}-export.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <section aria-labelledby="export-heading" className="flex flex-col gap-4">
      <h3 id="export-heading" className="heading-card">
        Export pack
      </h3>
      <MessageText text={data.pack.notice} className="text-sm text-ink-2" />
      {data.badge ? <p className="text-xs text-ink-3">Includes “{data.badge}” on free plan.</p> : null}
      <ul className="flex flex-col gap-4">
        {data.pack.items.map((it) => (
          <li key={it.platform} className="flex flex-col gap-2 rounded-lg border border-line bg-surface-2 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
                <SocialIcon network={it.platform} size="sm" />
                {it.platformLabel}
              </span>
              <Badge tone={it.withinLimit ? "green" : "red"} icon={it.withinLimit ? <Check /> : <TriangleAlert />}>
                {it.charCount.toLocaleString("en-US")} / {it.limit.toLocaleString("en-US")} {it.withinLimit ? "" : " · too long"}
              </Badge>
            </div>
            {it.title ? <p className="text-sm font-medium text-ink">Title: {it.title}</p> : null}
            <p className="max-h-60 overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-line bg-surface p-3 text-sm text-ink">{it.text}</p>
            {it.altText ? <p className="break-words text-sm text-ink-2">Alt text: {it.altText}</p> : null}
            {it.warnings.length > 0 ? (
              <ul className="flex flex-col gap-1 text-sm text-amber-800">
                {it.warnings.map((w) => (
                  <li key={w} className="flex gap-1.5">
                    <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                    {w}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <CopyButton text={it.text} label={`Copy ${it.platformLabel} text`} />
              {it.altText ? <CopyButton text={it.altText} label="Copy alt text" /> : null}
              {it.mediaUrls.map((u, i) => (
                <a key={u} href={u} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: "link", className: "h-9! text-ui" })}>
                  Open image{it.mediaUrls.length > 1 ? ` ${i + 1}` : ""} (AI)
                </a>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button variant="secondary" onClick={download}>
          <Download aria-hidden="true" /> Download CSV
        </Button>
        {artifact.canEdit && artifact.status !== "exported" ? (
          <ConfirmDialog
            trigger={<Button>Mark as exported</Button>}
            title="Mark as exported?"
            description="Records that you'll post it yourself. ClimbOS can't confirm it was posted."
            confirmLabel="Mark as exported"
            onConfirm={async () => {
              setError(null);
              try {
                await markExported({ slug, artifactId: artifact.id });
                toast({ tone: "success", title: "Marked as exported." });
              } catch (e) {
                setError(e);
              }
            }}
          />
        ) : null}
      </div>
      {artifact.status === "exported" ? (
        <Callout tone="info">Marked as exported.</Callout>
      ) : null}
      {error ? <ErrorCallout error={error} /> : null}
    </section>
  );
}
