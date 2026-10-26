"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Badge, Button, toast } from "@/components/ui";
import { errorMessage } from "@/components/app/errors";
import { formatDateTime } from "@/components/app/money";

/** Real desktop and mobile captures of one saved draft version (ClimbOS-hosted, not the customer's site). */
export function DraftRenders({ slug, pageId, version, canEdit, disabledReason }: { slug: string; pageId: Id<"landingPages">; version: number; canEdit: boolean; disabledReason?: string }) {
  const renders = useQuery(api.landingRenders.list, { slug, id: pageId });
  const request = useMutation(api.landingRenders.request);
  const [busy, setBusy] = useState(false);
  const latest = renders?.[0];
  return (
    <section className="rounded-[var(--radius-card)] border border-line bg-surface-2/60 p-4" aria-label="Captured views of this draft">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="heading-card">Check the changed page</h3>
          <p className="mt-1 text-sm text-ink-2">Capture this saved draft on desktop (1440 px) and mobile (390 px). These show the ClimbOS-hosted draft, not your current website, and nothing is published.</p>
        </div>
        {canEdit ? <Button size="sm" variant="secondary" loading={busy} disabled={busy || Boolean(disabledReason) || latest?.status === "pending"} onClick={async () => {
          setBusy(true);
          try {
            await request({ slug, id: pageId, expectedVersion: version });
            toast({ tone: "success", title: "Capturing desktop and mobile views" });
          } catch (e) {
            toast({ tone: "danger", title: errorMessage(e) });
          } finally {
            setBusy(false);
          }
        }}>Capture version {version}</Button> : null}
      </div>
      {disabledReason ? <p className="mt-2 text-xs text-ink-3">{disabledReason}</p> : null}
      {latest ? (
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
            <Badge tone={latest.status === "captured" ? "green" : latest.status === "pending" ? "blue" : "amber"}>{latest.status === "captured" ? "Captured" : latest.status === "pending" ? "Capturing…" : "Capture didn't finish"}</Badge>
            <span>Draft version {latest.version}{latest.capturedAt ? ` · ${formatDateTime(latest.capturedAt)}` : ""}</span>
            {latest.version !== version ? <Badge tone="amber">Older than the current version {version}</Badge> : null}
          </div>
          {latest.shots.length ? (
            <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
              {latest.shots.map((shot) => shot.url ? (
                <figure key={shot.view} className="overflow-hidden rounded-lg border border-line bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element -- private, short-lived storage URL */}
                  <img src={shot.url} alt={`${shot.view} capture of landing draft version ${latest.version}`} width={shot.width} height={shot.height} className="h-auto w-full" />
                  <figcaption className="px-2 py-1 text-xs text-ink-3">{shot.view === "desktop" ? "Desktop" : "Mobile"} · {shot.width}×{shot.height}</figcaption>
                </figure>
              ) : null)}
            </div>
          ) : null}
          <p className="text-xs text-ink-3">A capture shows the layout only. Check readability, tap targets and the form yourself before approving.</p>
        </div>
      ) : null}
    </section>
  );
}
