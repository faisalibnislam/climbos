"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Button, Callout, Field, Input, Select } from "@/components/ui";
import { CUSTOMER_PROGRESS_LABELS, type CustomerProgressRule } from "@shared/growth/customerProgress";
import { MAX_JOURNEY_CONTACTS, MAX_JOURNEY_STEPS } from "@shared/growth/customerJourneys";
import { ErrorCallout } from "./content/shared";
import { CustomerProgressDialog } from "./connections/CustomerProgressDialog";

export function CustomerJourneys({ slug }: { slug: string }) {
  const data = useQuery(api.customerJourneys.list, { slug });
  const setStatus = useMutation(api.customerJourneys.setStatus);
  const refresh = useMutation(api.customerJourneys.refresh);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const act = async (work: () => Promise<unknown>) => {
    setError(null); setBusy(true);
    try { await work(); } catch (e) { setError(e); } finally { setBusy(false); }
  };
  if (!data) return <p role="status">Loading follow-ups…</p>;
  return <section className="space-y-5" aria-label="Customer follow-ups">
    <div className="space-y-2"><h2 className="heading-section">Customer follow-ups</h2>
      <p className="text-sm text-ink-2">Keep track of who may need the next helpful email. Uses dated owner reports; it does not observe live product activity. Every email still needs your approval and an exactly matching Resend list.</p>
      <p className="text-xs text-ink-3">Checks active follow-ups about every 15 minutes. Waiting days are elapsed 24-hour periods, not a scheduled delivery time.</p>
    </div>
    {data.canManage ? <div className="flex flex-wrap gap-3"><Button variant="secondary" onClick={() => setAdding(!adding)}>{adding ? "Close new follow-up" : "New follow-up"}</Button><CustomerProgressDialog slug={slug} /></div> : <p className="text-sm text-ink-2">An owner or admin can configure follow-ups.</p>}
    {adding && data.canManage ? <JourneyForm slug={slug} onSaved={() => setAdding(false)} /> : null}
    {error ? <ErrorCallout error={error} /> : null}
    {!data.items.length ? <p className="rounded-xl border border-line p-5 text-sm">No saved follow-ups. Prepare an email draft and record customer progress, then choose a group and waiting time.</p> : null}
    {data.omitted ? <Callout tone="warning">Showing the first 20 saved follow-ups. Additional history needs review; this list is incomplete.</Callout> : null}
    {data.items.map(journey => <article key={journey._id} className="space-y-3 rounded-xl border border-line bg-surface p-4" aria-label={journey.name}>
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="heading-card break-words">{journey.name}</h3><span className="text-sm capitalize">{journey.status}</span></div>
      <p className="text-sm text-ink-2">{journey.segment} · {journey.rule.scope} · {CUSTOMER_PROGRESS_LABELS[journey.rule.state]}</p>
      <p className="text-sm">{journey.rule.criterion}. Observations no older than {journey.rule.maxAgeDays} UTC calendar days.</p>
      <p className="text-sm text-ink-2">{journey.counts.active} tracking · {journey.counts.held} waiting for evidence · {journey.counts.exited} exited · {journey.counts.completed} finished</p>
      {journey.limited ? <Callout tone="warning">Contact history exceeds the supported limit. These counts are incomplete; check this journey before proceeding.</Callout> : null}
      {journey.checkError ? <Callout tone="warning">{journey.checkError}</Callout> : null}
      <ol className="space-y-2">{journey.steps.map((step, i) => <li key={i} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line p-3">
        <div className="min-w-0 flex-1"><p className="break-words text-sm font-medium">{i + 1}. {step.title}</p><p className="text-xs text-ink-3">Wait {step.delayDays} day{step.delayDays === 1 ? "" : "s"} after {i === 0 ? "enrollment" : "the provider accepts the previous email"}. {journey.due[i]} due for eligibility review.</p></div>
        {journey.status === "active" && !journey.checkError ? <Link className="text-link inline-flex min-h-11 items-center" href={`/app/${slug}/content/${step.artifactId}?journey=${journey._id}&step=${i}`}>Review step {i + 1}</Link> : <Link className="text-link inline-flex min-h-11 items-center" href={`/app/${slug}/content/${step.artifactId}`}>Open email</Link>}
      </li>)}</ol>
      <details className="text-sm text-ink-2"><summary className="min-h-11 cursor-pointer content-center">How this follow-up works</summary><p>Unknown or old reports hold the next step. Changed progress, leaving the group or withdrawn email permission exits the customer. Finished and exited customers do not restart. Pausing stops new tracking and step approvals; it cannot recall an email already dispatched. Email acceptance is not proof of delivery, reading or customer progress.</p><p className="mt-2">Saved email versions and rules stay fixed. If you edit a draft, create a new follow-up for that version. Up to {MAX_JOURNEY_CONTACTS} contacts per group and retained journey history, 5 steps and 20 saved follow-ups per workspace.</p><p className="mt-2">Last complete check: {journey.checkedAt ? `${new Date(journey.checkedAt).toISOString().replace("T", " ").slice(0, 19)} UTC` : "Not checked yet"}.</p></details>
      {data.canManage && journey.status !== "archived" ? <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={busy} onClick={() => void act(() => setStatus({ slug, journeyId: journey._id, revision: journey.revision, status: journey.status === "active" ? "paused" : "active" }))}>{journey.status === "active" ? "Pause tracking" : journey.status === "paused" ? "Resume tracking" : "Start tracking"}</Button>
        {journey.status === "active" ? <Button variant="secondary" disabled={busy} onClick={() => void act(() => refresh({ slug, journeyId: journey._id }))}>Check audience now</Button> : null}
        {journey.status !== "active" ? <Button variant="ghost" disabled={busy} onClick={() => void act(() => setStatus({ slug, journeyId: journey._id, revision: journey.revision, status: "archived" }))}>Archive follow-up</Button> : null}
      </div> : null}
    </article>)}
  </section>;
}

function JourneyForm({ slug, onSaved }: { slug: string; onSaved: () => void }) {
  const audience = useQuery(api.marketing.audience, { slug });
  const drafts = useQuery(api.customerJourneys.draftOptions, { slug });
  const create = useMutation(api.customerJourneys.create);
  const [name, setName] = useState("");
  const [segment, setSegment] = useState("");
  const [group, setGroup] = useState<(Omit<CustomerProgressRule, "maxAgeDays"> & { key: string }) | null>(null);
  const [age, setAge] = useState("");
  const [steps, setSteps] = useState([{ key: 0, draft: "", delay: "" }]);
  const [nextKey, setNextKey] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const preview = useQuery(api.marketing.emailAudiencePreview, segment ? { slug, segment, includeProgressOptions: true } : "skip");
  const options = drafts?.options ?? [];
  const selectedDraft = (key: string) => options.find(d => `${d.artifactVersionId}:${d.emailIndex}` === key);
  const ready = name.trim() && segment && group && age.trim() && Number.isInteger(Number(age)) && Number(age) >= 1 && Number(age) <= 365 && steps.every(s => s.draft !== "" && selectedDraft(s.draft) && s.delay.trim() && Number.isInteger(Number(s.delay)) && Number(s.delay) >= 0 && Number(s.delay) <= 365);
  return <form className="space-y-4 rounded-xl border border-line bg-surface p-4" aria-label="New customer follow-up" onSubmit={async event => {
    event.preventDefault(); if (!ready || !group) return;
    setBusy(true); setError(null);
    try {
      await create({ slug, name, segment, rule: { scope: group.scope, state: group.state, criterion: group.criterion, maxAgeDays: Number(age) }, steps: steps.map(s => { const d = selectedDraft(s.draft)!; return { artifactId: d.artifactId, artifactVersionId: d.artifactVersionId, emailIndex: d.emailIndex, delayDays: Number(s.delay) }; }) });
      onSaved();
    } catch (e) { setError(e); } finally { setBusy(false); }
  }}>
    <Field label="Follow-up name"><Input value={name} maxLength={120} onChange={e => setName(e.target.value)} /></Field>
    <Field label="Customer group"><Select value={segment} onValueChange={s => { setSegment(s); setGroup(null); }} placeholder="Choose a group…" options={(audience?.segments ?? []).map(s => ({ value: s.segment, label: s.segment }))} /></Field>
    <Field label="Progress to follow"><Select value={group?.key ?? ""} placeholder="Choose a reported group…" onValueChange={key => setGroup(preview?.progressOptions.find(p => p.key === key) ?? null)} options={(preview?.progressOptions ?? []).map(g => ({ value: g.key, label: `${g.scope} · ${CUSTOMER_PROGRESS_LABELS[g.state]} · ${g.criterion}` }))} /></Field>
    {segment && preview && !preview.progressOptions.length ? <p className="text-sm text-ink-2">No usable progress reports for opted-in contacts in this group. Use “Customer progress” above to record an observation first.</p> : null}
    {preview?.omittedGroups ? <p className="text-xs text-ink-3">Only 30 reported groups are shown. Narrow the contact group to see the others.</p> : null}
    <Field label="Oldest acceptable observation (days)" hint="Choose 1–365 UTC calendar days. Unknown progress never qualifies."><Input type="number" min={1} max={365} value={age} onChange={e => setAge(e.target.value)} /></Field>
    {steps.map((step, i) => <fieldset key={step.key} className="space-y-3 rounded-lg border border-line p-3"><legend className="px-1 text-sm font-medium">Step {i + 1}</legend>
      <Field label={`Email for step ${i + 1}`}><Select value={step.draft} onValueChange={draft => setSteps(current => current.map(s => s.key === step.key ? { ...s, draft } : s))} placeholder="Choose an existing email…" options={options.map(d => ({ value: `${d.artifactVersionId}:${d.emailIndex}`, label: d.title }))} /></Field>
      <Field label={`Wait before step ${i + 1} (days)`} hint={i === 0 ? "Elapsed days after enrollment. Zero makes it ready for review immediately." : "Elapsed days after the provider accepts the previous email. No automatic sending."}><Input type="number" min={0} max={365} value={step.delay} onChange={e => setSteps(current => current.map(s => s.key === step.key ? { ...s, delay: e.target.value } : s))} /></Field>
      {steps.length > 1 ? <Button variant="ghost" type="button" onClick={() => setSteps(current => current.filter(s => s.key !== step.key))}>Remove step {i + 1}</Button> : null}
    </fieldset>)}
    {!options.length ? <p className="text-sm text-ink-2">Prepare an email in <Link href={`/app/${slug}/content`} className="text-link">Your content</Link> first. Its content must be approved before any send.</p> : null}
    {drafts?.limited ? <p className="text-xs text-ink-3">Email choices come from the 100 most recently updated drafts. Open and save an older draft to make it available.</p> : null}
    <p className="text-sm text-ink-2">Saving does not start tracking or approve any email. Review the saved rules, then start tracking. The saved rules and email versions cannot be edited in place.</p>
    <div className="flex flex-wrap gap-2">{steps.length < MAX_JOURNEY_STEPS ? <Button type="button" variant="secondary" onClick={() => { setSteps(current => [...current, { key: nextKey, draft: "", delay: "" }]); setNextKey(n => n + 1); }}>Add step</Button> : null}<Button type="submit" disabled={!ready || busy}>{busy ? "Saving…" : "Save follow-up"}</Button></div>
    {error ? <ErrorCallout error={error} /> : null}
  </form>;
}
