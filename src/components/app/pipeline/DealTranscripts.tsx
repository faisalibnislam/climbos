"use client";

import { useEffect, useState } from "react";
import { useConvex, useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button, Checkbox, ConfirmDialog, DatePicker, Field, Input, Textarea, toast } from "@/components/ui";
import { errorMessage } from "@/components/app/errors";
import { TRANSCRIPT_LIMIT, TRANSCRIPT_TEXT_LIMIT, TRANSCRIPT_PAGE_SIZE } from "@shared/growth/dealTranscripts";

export function DealTranscripts({ slug, id }: { slug: string; id: Id<"deals"> }) {
  const [open, setOpen] = useState(false);
  const data = useQuery(api.crm.transcripts, open ? { slug, id } : "skip");
  const remove = useMutation(api.crm.removeTranscript);
  const [adding, setAdding] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [removing, setRemoving] = useState<{ index: number; revision: number; title: string } | null>(null);
  return <details className="rounded-lg border border-line p-3" open={open} onToggle={e => setOpen(e.currentTarget.open)}>
    <summary className="cursor-pointer text-sm font-medium">Conversation transcripts</summary>
    <p className="mt-2 text-xs text-ink-2">Import a transcript you have permission to use. Review and remove personal or confidential details that are unnecessary. Speaker labels are enough. Audio recording and automatic transcription are not connected.</p>
    {!data ? <p className="mt-2 text-sm">Loading transcripts…</p> : <div className="mt-3 space-y-3">
      {!data.items.length ? <p className="text-sm text-ink-2">No transcript imported. Conversation evidence stays unknown.</p> : data.items.map(item => <section key={item.index} className="space-y-2 rounded-lg bg-surface-2 p-3" aria-label={item.title}>
        <h3 className="text-sm font-medium break-words">{item.title}</h3>
        <p className="text-xs text-ink-2 break-words">Owner-supplied text · {item.sourceLabel} · Conversation date: {item.occurredOn ?? "Unknown"} · {item.characters.toLocaleString()} characters</p>
        <div className="flex flex-wrap gap-2"><Button size="sm" variant="ghost" onClick={() => setSelected(selected === item.index ? null : item.index)}>{selected === item.index ? "Close text" : "Read transcript"}</Button>
          {data.canEdit ? <Button size="sm" variant="ghost" onClick={() => setRemoving({ index: item.index, revision: data.revision, title: item.title })}>Remove transcript</Button> : null}</div>
        {selected === item.index ? <TranscriptText key={`${data.version}:${item.index}`} slug={slug} id={id} index={item.index} version={data.version} /> : null}
      </section>)}
      {data.canEdit && adding === null && data.items.length < TRANSCRIPT_LIMIT ? <Button size="sm" variant="secondary" onClick={() => setAdding(data.revision)}>Import transcript</Button> : null}
      {adding !== null ? <TranscriptForm slug={slug} id={id} revision={adding} changed={data.revision !== adding} onClose={() => setAdding(null)} /> : null}
      <p className="text-xs text-ink-2">Up to six transcripts, 16,000 characters each. Imported text is not independently verified. Use Review next step to prepare an editable question; saving does not contact anyone or run AI. Remove a transcript here when it is no longer needed. Deleting this deal also deletes its transcripts.</p>
    </div>}
    <ConfirmDialog open={removing !== null} onOpenChange={value => { if (!value) setRemoving(null); }} title="Remove this transcript?" description={`“${removing?.title ?? ""}” will be removed from this deal. Its text cannot be restored here.`} confirmLabel="Remove transcript" confirmDisabled={!data || data.revision !== removing?.revision} onConfirm={async () => { if (!removing) return; try { await remove({ slug, id, index: removing.index, expectedRevision: removing.revision }); setSelected(null); } catch (e) { toast({ tone: "danger", title: errorMessage(e) }); } }} />
  </details>;
}

function TranscriptText({ slug, id, index, version }: { slug: string; id: Id<"deals">; index: number; version: string }) {
  const [offset, setOffset] = useState(0);
  const convex = useConvex();
  const [data, setData] = useState<NonNullable<ReturnType<typeof useQuery<typeof api.crm.transcripts>>> | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    convex.query(api.crm.transcripts, { slug, id, transcriptIndex: index, offset, expectedVersion: version }).then(result => { if (!cancelled) setData(result); }).catch(e => { if (!cancelled) setError(errorMessage(e)); });
    return () => { cancelled = true; };
  }, [convex, slug, id, index, offset, version]);
  const page = data?.page;
  const move = (next: number) => { setData(null); setError(""); setOffset(next); };
  return <div className="space-y-2">
    {page ? <><p className="text-xs text-ink-2">Characters {page.start + 1}–{page.end}. {page.nextOffset === null ? "End of this transcript." : "More text follows."}</p><p className="whitespace-pre-wrap break-words text-sm">{page.text}</p>
      <div className="flex gap-2"><Button size="sm" variant="ghost" disabled={offset === 0} onClick={() => move(Math.max(0, offset - TRANSCRIPT_PAGE_SIZE))}>Previous text</Button><Button size="sm" variant="ghost" disabled={page.nextOffset === null} onClick={() => move(page.nextOffset!)}>Next text</Button></div></> : error ? <p role="alert">{error} Close and reopen the text to review the current version.</p> : <p role="status">Loading transcript text…</p>}
  </div>;
}

function TranscriptForm({ slug, id, revision, changed, onClose }: { slug: string; id: Id<"deals">; revision: number; changed: boolean; onClose: () => void }) {
  const save = useMutation(api.crm.addTranscript);
  const [title, setTitle] = useState(""), [sourceLabel, setSourceLabel] = useState(""), [text, setText] = useState(""), [occurredOn, setOccurredOn] = useState("");
  const [permissionConfirmed, setPermissionConfirmed] = useState(false), [permissionBasis, setPermissionBasis] = useState("");
  const [busy, setBusy] = useState(false);
  return <section aria-label="Import conversation transcript" className="space-y-3 rounded-lg border border-line p-3">
    <Field label="Transcript title"><Input value={title} maxLength={100} onChange={e => setTitle(e.target.value)} disabled={busy} /></Field>
    <Field label="Transcript source" hint="Describe how this text was prepared; a source label is not verification."><Input value={sourceLabel} maxLength={200} onChange={e => setSourceLabel(e.target.value)} disabled={busy} /></Field>
    <Field label="Import a text file (optional)" hint="UTF-8 .txt only, up to 64 KB. Review the text below before saving."><Input type="file" accept=".txt,text/plain" disabled={busy} onChange={async e => {
      const file = e.target.files?.[0]; e.target.value = ""; if (!file) return;
      try { if (!file.name.toLowerCase().endsWith(".txt") || file.size > 64_000) throw new Error("Choose a plain .txt file up to 64 KB."); const value = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer()); if (value.length > TRANSCRIPT_TEXT_LIMIT) throw new Error("Use up to 16,000 characters. Split at a clear conversation boundary and label each part."); setText(value); } catch (error) { toast({ tone: "danger", title: errorMessage(error) }); }
    }} /></Field>
    <Field label="Reviewed transcript text" hint={`${text.length.toLocaleString()} of 16,000 characters. Keep speaker labels and meaningful context; do not replace missing words with guesses.`}><Textarea value={text} maxLength={TRANSCRIPT_TEXT_LIMIT} rows={7} disabled={busy} onChange={e => setText(e.target.value)} /></Field>
    <Field label="Conversation date (optional)" hint="Leave blank when unknown. This is separate from the import date."><DatePicker value={occurredOn} onChange={setOccurredOn} max={new Date().toISOString().slice(0, 10)} disabled={busy} /></Field>
    <Checkbox label="I have permission to store and use this transcript for business analysis" checked={permissionConfirmed} onCheckedChange={v => setPermissionConfirmed(v === true)} disabled={busy} />
    <Field label="Permission basis" hint="Describe the permission or authorization you checked. ClimbOS does not independently verify it."><Input value={permissionBasis} maxLength={300} onChange={e => setPermissionBasis(e.target.value)} disabled={busy} /></Field>
    {changed ? <p role="alert" className="text-sm">The transcript list changed. Your draft is preserved; cancel and review the current list before saving.</p> : null}
    <div className="flex flex-wrap gap-2"><Button size="sm" disabled={busy || changed || !permissionConfirmed || title.trim().length < 3 || sourceLabel.trim().length < 3 || text.trim().length < 20 || permissionBasis.trim().length < 10} onClick={async () => { setBusy(true); try { await save({ slug, id, expectedRevision: revision, title, sourceLabel, text, permissionConfirmed, permissionBasis, ...(occurredOn ? { occurredOn } : {}) }); toast({ tone: "success", title: "Transcript saved for review" }); onClose(); } catch (e) { toast({ tone: "danger", title: errorMessage(e) }); } finally { setBusy(false); } }}>Save transcript</Button><Button size="sm" variant="ghost" disabled={busy} onClick={onClose}>Cancel import</Button></div>
  </section>;
}
