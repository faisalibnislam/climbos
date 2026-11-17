"use client";

import { useState } from "react";
import { useConvex, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button, toast } from "@/components/ui";
import { errorMessage } from "@/components/app/errors";
import { DEAL_HISTORY_LABELS, DEAL_STAGE_LABELS } from "@shared/growth/dealHistory";

const recordedTime = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

type History = NonNullable<ReturnType<typeof useQuery<typeof api.crm.stageHistory>>>;
export function DealHistory({ slug, id }: { slug: string; id: Id<"deals"> }) {
  const [open, setOpen] = useState(false);
  const latest = useQuery(api.crm.stageHistory, open ? { slug, id } : "skip");
  const convex = useConvex();
  const [older, setOlder] = useState<History | null>(null);
  const [loading, setLoading] = useState(false);
  const data = older ?? latest;
  const changed = Boolean(older && latest && older.version !== latest.version);
  return <details className="rounded-lg border border-line p-3" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className="cursor-pointer text-sm font-medium">Stage history</summary>
    {!data ? <p className="mt-2 text-xs text-ink-2">Loading recorded changes…</p> : <div className="mt-2 space-y-3">
      <p className="text-xs text-ink-2">Recorded changes, not proof of buyer intent or payment. Times show when ClimbOS recorded each change (UTC).</p>
      {!data.fromCreation ? <p className="text-xs text-ink-2">Earlier history is unknown. Existing stages were not reconstructed.</p> : null}
      <p className="text-xs text-ink-2">Showing {data.events.length} of {data.retained} retained changes. {data.total > data.retained ? `${data.total - data.retained} earlier recorded changes are outside the 100-change history limit.` : ""}</p>
      {changed ? <p role="status" className="text-sm text-ink-2">This deal changed. This page is an earlier snapshot; return to the latest history before reading more.</p> : null}
      {data.events.length ? <ol className="space-y-3">{data.events.map(event => <li key={event.sequence} className="text-sm">
        <p>{event.from ? `${DEAL_STAGE_LABELS[event.from]} → ` : "Added as "}{DEAL_STAGE_LABELS[event.to]}</p>
        <p className="text-xs text-ink-2">#{event.sequence} · {DEAL_HISTORY_LABELS[event.source]} · {recordedTime.format(event.at)} UTC</p>
      </li>)}</ol> : <p className="text-sm text-ink-2">No stage changes have been recorded in this history.</p>}
      <div className="flex flex-wrap gap-2">
        {data.nextBefore !== null ? <Button size="sm" variant="secondary" disabled={loading || changed} onClick={async () => {
          setLoading(true);
          try { setOlder(await convex.query(api.crm.stageHistory, { slug, id, beforeEvent: data.nextBefore!, expectedVersion: data.version })); }
          catch (error) { toast({ tone: "danger", title: errorMessage(error) }); }
          finally { setLoading(false); }
        }}>Earlier changes</Button> : null}
        {older ? <Button size="sm" variant="ghost" disabled={loading} onClick={() => setOlder(null)}>Latest history</Button> : null}
      </div>
    </div>}
  </details>;
}
