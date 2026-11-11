"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui";
import { PreparedWork } from "./PreparedWork";

export function PreparedDraftLibrary({ slug }: { slug: string }) {
  const data = useQuery(api.planDrafts.list, { slug });
  const [selected, setSelected] = useState<Id<"strategies"> | null>(null);
  const plan = useQuery(api.workspace.plan, selected ? { slug, strategyId: selected } : "skip");
  if (!data) return <p role="status">Opening your drafts…</p>;
  return <section className="space-y-5" aria-label="Prepared drafts by goal">
    <p className="text-sm text-ink-2">Your drafts stay here, even when you change goals or leave a conversation.</p>
    {!data.rows.length ? <p className="rounded-xl border border-line bg-surface p-5 text-sm">No prepared drafts yet. Ask for help on Home or build a recommendation for your goal.</p> : <ul className="divide-y divide-line rounded-xl border border-line bg-surface">{data.rows.map(row => <li key={row.strategyId} className="flex flex-wrap items-center justify-between gap-3 p-4"><div className="min-w-0 flex-1"><h2 className="break-words font-medium">{row.goal}</h2><ul className="mt-1 space-y-1 text-sm text-ink-2">{row.work.map(w => <li key={w.index}>{w.title}{w.edited ? " · Your saved edit" : " · AI draft"}</li>)}</ul></div><Button size="sm" variant={selected === row.strategyId ? "primary" : "secondary"} aria-pressed={selected === row.strategyId} onClick={() => setSelected(row.strategyId)}>Review drafts</Button></li>)}</ul>}
    {data.limited ? <p className="text-xs text-ink-3">Showing recent prepared work and up to 100 recent saved edits. Older plans remain in plan history.</p> : null}
    {selected ? plan?.strategy?.id === selected ? <PreparedWork key={selected} work={plan.strategy.expert?.preparedWork} slug={slug} strategyId={selected} openFirst /> : <p role="status">Opening this plan’s drafts…</p> : null}
  </section>;
}
