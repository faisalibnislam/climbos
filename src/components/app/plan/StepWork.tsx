"use client";
import { separateDraftNotes } from "@shared/agents/stepWork";
import { useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button, Callout, Textarea, buttonClasses, toast } from "@/components/ui";
import { useCostDisplay } from "../useCostDisplay";
import { errorMessage } from "../errors";

export function StepWorkLibrary({ slug, strategyId, canEdit }: { slug: string; strategyId: Id<"strategies">; canEdit: boolean }) {
  const rows = useQuery(api.stepWork.forStrategy, { slug, strategyId });
  if (!rows?.length) return null;
  return <section className="space-y-4" aria-label="Work from your steps"><h2 className="heading-section">Work from your steps</h2>{rows.map(row => <div key={row.stepKey} className="space-y-2"><h3 className="text-sm font-medium">{row.title}</h3><StepWork slug={slug} strategyId={strategyId} stepKey={row.stepKey} canEdit={canEdit} /></div>)}</section>;
}

export function StepWork({ slug, strategyId, stepKey, canEdit, initialWorkId }: { slug: string; strategyId: Id<"strategies">; stepKey: string; canEdit: boolean; initialWorkId?: Id<"planStepWork"> }) {
  const [selectedWorkId, setSelectedWorkId] = useState(initialWorkId);
  const data = useQuery(api.stepWork.view, { slug, strategyId, stepKey, ...(selectedWorkId ? { workId: selectedWorkId } : {}) });
  const quote = useQuery(api.stepWork.quote, canEdit ? { slug } : "skip");
  const canPrepare = canEdit && quote?.canPrepare === true;
  const start = useMutation(api.stepWork.start);
  const cost = useCostDisplay();
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState(""), [other, setOther] = useState(false);
  const pending = useRef(false);
  const request = useRef<{ answer: string; key: string } | null>(null);
  async function prepare(reply = "", refresh = false) {
    if (pending.current || !canPrepare) return;
    pending.current = true; setBusy(true); setError(null);
    const key = request.current?.answer === reply ? request.current.key : crypto.randomUUID();
    request.current = { answer: reply, key };
    try { await start({ slug, strategyId, stepKey, requestKey: key, ...(reply.trim() ? { answer: reply.trim() } : {}), ...(refresh ? { refresh: true } : {}) }); request.current = null; setSelectedWorkId(undefined); setAnswer(""); setOther(false); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { pending.current = false; setBusy(false); }
  }
  const working = data?.status === "working";
  const question = data?.result?.ownerQuestion;
  if (selectedWorkId && data === null) return <Callout title="This saved work is unavailable">It may have been removed or belong to a different workspace. Open the plan to choose available work.</Callout>;
  return <div className="ai-step-work space-y-4" aria-label="AI work for this step">
    {quote?.canPrepare === false ? <Callout title="Explore saved work in the demo">{quote.reason}<Link className={buttonClasses({ variant: "secondary", size: "sm", className: "mt-2" })} href="/sign-in?switch=1&next=/onboarding">Use my own business</Link></Callout> : null}
    {selectedWorkId && data?.historical ? <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2 text-xs"><span>Earlier saved work</span><Button size="sm" variant="link" onClick={() => setSelectedWorkId(undefined)}>Back to latest work</Button></div> : null}
    {data === undefined ? <p role="status" className="text-sm text-ink-3">Checking saved work…</p> : working ? <p role="status" className="text-sm">{data.phase ?? "AI is preparing this step…"}</p> : !data || data.status === "failed" ? <>
      {data?.error ? <p className="text-sm text-ink-2">{data.error}</p> : quote?.canPrepare === false ? null : <p className="text-sm text-ink-2">AI will research and prepare what it can for this step.</p>}
      {canEdit && quote?.canPrepare !== false && !data?.historical ? <div className="flex flex-wrap items-center gap-3"><Button className="step-primary-action" loading={busy} disabled={!canPrepare} onClick={() => void prepare()}>{data ? "Try preparing again" : "Make it happen"}</Button><span className="text-xs text-ink-3">{quote ? `Up to ${cost.upTo(quote.maxCostMicros)}. Unused credits return.` : "Checking cost…"}</span></div> : !canEdit ? <p className="text-xs text-ink-3">An editor can start AI preparation.</p> : null}
    </> : <>
      <p className="text-sm">{data.result?.summary}</p>
      {data.result?.limitations?.length ? <Callout title="Some parts need checking">The drafts are saved. Check these notes before sharing.<details className="mt-2"><summary className="min-h-8 cursor-pointer">See what needs checking</summary><ul className="list-disc space-y-1 pl-4">{data.result.limitations.map(note => <li key={note}>{note}</li>)}</ul></details></Callout> : null}
      {data.stale && canEdit && !data.historical ? <Callout title="Your information has changed">The saved work is still here. Check it against your latest details.{canPrepare ? <><Button className="mt-2" size="sm" disabled={!canPrepare} loading={busy} onClick={() => void prepare()}>Prepare updated work</Button><p className="mt-2 text-xs">{quote ? `Up to ${cost.upTo(quote.maxCostMicros)}; unused credits return.` : "Checking cost…"}</p></> : null}</Callout> : null}
      {data.result?.drafts.map((original, index) => { const draft = separateDraftNotes(original); return <StepDraft key={`${data.id}:${index}`} slug={slug} workId={data.id} index={index} title={draft.title} body={data.edits.find(edit => edit.index === index)?.body ?? draft.body} revision={data.draftRevision} notes={draft.notes} canEdit={data.canEdit} />; })}
      {question && !data.stale && !data.historical ? <form className="space-y-3 rounded-lg bg-surface-2 p-3" onSubmit={event => { event.preventDefault(); if (answer.trim()) void prepare(answer); }}><p className="text-sm font-medium">{question.text}</p>
        <fieldset disabled={busy} className="space-y-2"><legend className="sr-only">Your answer</legend>{question.choices.map(choice => <label key={choice} className="flex min-h-11 items-center gap-2 text-sm"><input type="radio" name={`step-answer-${stepKey}`} checked={!other && answer === choice} onChange={() => { setOther(false); setAnswer(choice); }} />{choice}</label>)}{question.choices.length ? <label className="flex min-h-11 items-center gap-2 text-sm"><input type="radio" name={`step-answer-${stepKey}`} checked={other} onChange={() => { setOther(true); setAnswer(""); }} />Something else</label> : null}</fieldset>
        {other || !question.choices.length ? <Textarea aria-label="Your answer" maxLength={2000} value={answer} onChange={event => setAnswer(event.target.value)} disabled={busy} rows={2} /> : null}
        {canPrepare ? <div className="flex flex-wrap items-center gap-2"><Button size="sm" type="submit" disabled={!answer.trim() || !canPrepare} loading={busy}>Continue preparing</Button><Button size="sm" variant="link" type="button" disabled={busy || !canPrepare} onClick={() => void prepare("I’m not sure. Use what you can verify and leave the rest unknown.")}>I’m not sure</Button></div> : null}
        <p className="text-xs text-ink-3">{quote?.canPrepare ? `Up to ${cost.upTo(quote.maxCostMicros)} to continue. ` : ""}Your answer supplies context, not publishing permission.</p>
      </form> : null}
      {data.result?.ownerTasks.length ? <details className="text-sm"><summary className="min-h-9 cursor-pointer">What still needs you</summary><ul className="list-disc space-y-1 pl-5 text-ink-2">{data.result.ownerTasks.map(task => <li key={task}>{task}</li>)}</ul></details> : null}
      {data.sources.length ? <details className="text-xs text-ink-3"><summary className="min-h-9 cursor-pointer">Research and sources</summary><ul className="space-y-2">{data.sources.map(source => <li key={source.url}><a className="underline" href={source.url} target="_blank" rel="noopener noreferrer">{source.title ?? source.url}</a>{source.status !== "ok" ? " — couldn’t read" : ""}</li>)}</ul></details> : null}
      <p className="text-xs text-ink-3">Private prepared work. Nothing sent, published or marked done.</p>
      {canPrepare && !data.historical ? <details className="text-xs text-ink-3"><summary className="min-h-9 cursor-pointer">Improve this work</summary><Button size="sm" variant="secondary" disabled={!canPrepare} loading={busy} onClick={() => void prepare("", true)}>Let AI review and improve</Button><p className="mt-2">{quote ? `Up to ${cost.upTo(quote.maxCostMicros)}; unused credits return.` : "Checking cost…"} Saved edits stay available.</p></details> : null}
    </>}
    {data?.previousId ? <Button size="sm" variant="link" onClick={() => setSelectedWorkId(data.previousId)}>Open earlier saved work</Button> : null}
    {error ? <Callout tone="danger">{error}</Callout> : null}
  </div>;
}

function StepDraft({ slug, workId, index, title, body, notes, revision, canEdit }: { slug: string; workId: Id<"planStepWork">; index: number; title: string; body: string; notes?: string; revision: number; canEdit: boolean }) {
  const save = useMutation(api.stepWork.saveDraft);
  const [base, setBase] = useState({ body, revision }), [text, setText] = useState(body), [busy, setBusy] = useState(false);
  const dirty = text !== base.body;
  if (!dirty && body !== base.body) { setBase({ body, revision }); setText(body); }
  const conflict = dirty && revision > base.revision && body !== base.body;
  return <details className="rounded-lg bg-surface-2 p-3"><summary className="min-h-9 cursor-pointer text-sm font-medium">{title} · Private draft</summary><div className="mt-3 space-y-3"><Textarea aria-label={`Edit ${title}`} value={text} rows={10} maxLength={20000} disabled={!canEdit || busy} onChange={event => setText(event.target.value)} />
    {notes ? <details className="text-xs text-ink-3"><summary className="min-h-8 cursor-pointer">Preparation notes</summary><p className="whitespace-pre-wrap">{notes}</p></details> : null}
    {conflict ? <Callout title="A newer edit is saved">Your text is still here. Copy it before replacing it.<details className="mt-2"><summary className="cursor-pointer">See the saved version</summary><p className="whitespace-pre-wrap">{body}</p></details><Button variant="secondary" size="sm" className="mt-2" onClick={() => { setBase({ body, revision }); setText(body); }}>Use saved version</Button></Callout> : null}
    <div className="flex flex-wrap gap-2">{canEdit ? <Button size="sm" disabled={!text.trim() || conflict} loading={busy} onClick={async () => { setBusy(true); try { const saved = await save({ slug, workId, index, expectedRevision: revision, body: text }); setBase({ body: text, revision: saved.revision }); toast({ tone: "success", title: "Draft saved. Nothing shared." }); } catch (cause) { toast({ tone: "danger", title: errorMessage(cause) }); } finally { setBusy(false); } }}>Save draft</Button> : null}<Button size="sm" variant="secondary" onClick={async () => { try { await navigator.clipboard.writeText(text); toast({ tone: "success", title: "Draft copied" }); } catch { toast({ tone: "info", title: "Select the text and copy it directly." }); } }}>Copy text</Button></div></div></details>;
}
