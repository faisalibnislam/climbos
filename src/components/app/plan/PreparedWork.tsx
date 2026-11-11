"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "@convex/_generated/dataModel";
import { api } from "@convex/_generated/api";
import { hasUnfinishedDestination, PreparedWorkSchema, type PreparedWork as Work } from "@shared/agents/preparedWork";
import { Button, Callout, Textarea, toast } from "@/components/ui";
import { errorMessage } from "../errors";

/** A private draft editor. Saving never edits the approved plan or grants publishing permission. */
export function PreparedWork({ work, slug, strategyId, openFirst = false }: { work: unknown; slug?: string; strategyId?: Id<"strategies">; openFirst?: boolean }) {
  if (!slug || !strategyId) return <ReadOnlyWork work={work} />;
  return <ConnectedWork work={work} slug={slug} strategyId={strategyId} openFirst={openFirst} />;
}

function ReadOnlyWork({ work }: { work: unknown }) {
  const parsed = PreparedWorkSchema.array().max(3).safeParse(work);
  if (!parsed.success || !parsed.data.length) return null;
  return <section aria-label="AI has prepared"><h2 className="heading-section">AI has prepared</h2>{parsed.data.map((item, index) => <details key={index} className="rounded-xl border border-line bg-surface p-4"><summary className="min-h-11 cursor-pointer font-medium">{item.title} · Draft</summary><p className="my-3 whitespace-pre-wrap text-sm">{item.draft}</p><ul>{item.checksBeforeUse.map(check => <li key={check}>{check}</li>)}</ul><p className="text-xs text-ink-3">Prepared text only. It has not been sent, published or added to your website.</p></details>)}</section>;
}

function ConnectedWork({ work, slug, strategyId, openFirst }: { work: unknown; slug: string; strategyId: Id<"strategies">; openFirst: boolean }) {
  const saved = useQuery(api.planDrafts.forStrategy, { slug, strategyId });
  const parsed = PreparedWorkSchema.array().max(3).safeParse(work);
  if (!parsed.success || !parsed.data.length) return null;
  return <section id="prepared-work" tabIndex={-1} aria-labelledby="prepared-work-heading" className="scroll-mt-20 space-y-3">
    <div><h2 id="prepared-work-heading" className="heading-section">Your prepared drafts</h2><p className="mt-1 text-sm text-ink-2">Useful work you can review and change. Nothing has been shared.</p></div>
    {parsed.data.map((item, index) => <Draft key={`${strategyId ?? "preview"}:${index}`} item={item} index={index} slug={slug} strategyId={strategyId} saved={saved?.edits.find(e => e.index === index)} canEdit={Boolean(saved?.canEdit)} loading={Boolean(slug && strategyId && !saved)} open={openFirst && index === 0} />)}
  </section>;
}

function Draft({ item, index, slug, strategyId, saved, canEdit, loading, open }: { item: Work; index: number; slug?: string; strategyId?: Id<"strategies">; saved?: { body: string; revision: number }; canEdit: boolean; loading: boolean; open: boolean }) {
  const save = useMutation(api.planDrafts.save);
  const [base, setBase] = useState({ body: saved?.body ?? item.draft, revision: saved?.revision ?? 0 });
  const [text, setText] = useState(base.body);
  const [busy, setBusy] = useState(false);
  const dirty = text !== base.body;
  const current = saved?.revision ?? 0;
  if (!dirty && current > base.revision) {
    const next = { body: saved?.body ?? item.draft, revision: current };
    setBase(next); setText(next.body);
  }
  const conflict = dirty && current > base.revision;
  return <details open={open || undefined} className="rounded-xl border border-line bg-surface p-4">
    <summary className="min-h-11 cursor-pointer font-medium">{item.title} <span className="text-xs font-normal text-ink-3">· Private draft{saved ? " · Saved" : ""}</span></summary>
    {hasUnfinishedDestination(text) ? <Callout className="mt-3" title="This earlier draft has an unfinished link">Use the newer step work when available, or finish the link before sharing.</Callout> : null}
    <p className="mt-2 break-words text-xs text-ink-3">For: {item.target}</p>
    {slug && strategyId ? <div className="mt-3 space-y-3">
      <Textarea aria-label={`Edit ${item.title}`} rows={8} value={text} maxLength={20_000} disabled={busy || loading || !canEdit} onChange={e => setText(e.target.value)} />
      {conflict ? <Callout tone="warning" title="A newer draft was saved">Your unsaved text is still here. <details className="mt-2"><summary className="cursor-pointer">Compare with the newer draft</summary><p className="mt-2 whitespace-pre-wrap">{saved?.body}</p></details><Button variant="secondary" size="sm" className="mt-2" onClick={() => setBase({ body: saved?.body ?? item.draft, revision: current })}>Keep my text and use the newer revision</Button></Callout> : null}
      {canEdit ? <div className="flex flex-wrap gap-2"><Button size="sm" loading={busy} disabled={loading || !text.trim() || conflict} onClick={async () => { setBusy(true); try { const result = await save({ slug, strategyId, index, expectedRevision: base.revision, body: text }); setBase({ body: text, revision: result.revision }); toast({ tone: "success", title: "Draft saved. Nothing shared." }); } catch (error) { toast({ tone: "danger", title: errorMessage(error) }); } finally { setBusy(false); } }}>Save draft</Button><Button variant="secondary" size="sm" onClick={async () => { try { await navigator.clipboard.writeText(text); toast({ tone: "success", title: "Draft copied" }); } catch { toast({ tone: "info", title: "Select the text and copy it directly." }); } }}>Copy text</Button></div> : null}
      {loading ? <p role="status" className="text-sm text-ink-3">Opening saved edits…</p> : null}
    </div> : <div className="my-3 select-text whitespace-pre-wrap break-words rounded-lg bg-surface-2 p-4 text-sm text-ink">{item.draft}</div>}
    {item.checksBeforeUse.length ? <details className="mt-3 text-sm"><summary className="min-h-9 cursor-pointer font-medium">Check before sharing</summary><ul className="mt-1 list-disc pl-5 text-ink-2">{item.checksBeforeUse.map((check, i) => <li key={i}>{check}</li>)}</ul></details> : null}
    <p className="mt-3 text-xs text-ink-3">Not sent, published, or added to your website. Connecting an account and reviewing its exact destination is a separate step.</p>
  </details>;
}
