"use client";

import { useConvex, useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@convex/_generated/api";
import { useState, type FormEvent } from "react";
import { CUSTOMER_PROGRESS_LABELS, CUSTOMER_PROGRESS_STATES, type CustomerProgressObservation, type CustomerProgressState } from "@shared/growth/customerProgress";
import { Button, Callout, DatePicker, Dialog, DialogContent, DialogTrigger, Field, Input, Select, Textarea, toast } from "@/components/ui";
import { errorMessage } from "../errors";

type Contact = NonNullable<FunctionReturnType<typeof api.marketing.contactProgress>>;

export function CustomerProgressDialog({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button variant="secondary" size="sm">Customer progress</Button></DialogTrigger>
    <DialogContent title="Customer progress" description="Record what you know about one uploaded contact, for a particular product or journey." className="max-w-2xl">
      {open ? <ProgressLookup slug={slug} /> : null}
    </DialogContent>
  </Dialog>;
}

function ProgressLookup({ slug }: { slug: string }) {
  const convex = useConvex();
  const [email, setEmail] = useState("");
  const [contact, setContact] = useState<Contact | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function lookup(e: FormEvent) {
    e.preventDefault(); setBusy(true); setContact(null); setError(null);
    try {
      const found = await convex.query(api.marketing.contactProgress, { slug, email });
      setContact(found);
      if (!found) setError("No unique active contact matches. Upload or check this contact first.");
    } catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  }
  return <div className="flex flex-col gap-4">
    <p className="text-sm text-ink-2">These are dated owner observations, not live product tracking. Missing progress stays unknown. Email permission is checked separately.</p>
    <form onSubmit={lookup} className="flex items-end gap-2">
      <Field label="Contact email" className="min-w-0 flex-1"><Input type="email" required value={email} disabled={busy} onChange={e => { setEmail(e.target.value); setContact(null); }} /></Field>
      <Button type="submit" loading={busy}>Look up</Button>
    </form>
    {error ? <Callout tone="warning" title="Check this contact">{error}</Callout> : null}
    {contact ? <ProgressEditor key={contact.contactId} slug={slug} contact={contact} onSaved={saved => setContact(current => current?.contactId === saved.contactId ? saved : current)} /> : null}
  </div>;
}

function ProgressEditor({ slug, contact, onSaved }: { slug: string; contact: Contact; onSaved: (contact: Contact) => void }) {
  const record = useMutation(api.marketing.recordContactProgress);
  const [scope, setScope] = useState("");
  const [state, setState] = useState<CustomerProgressState>("unknown");
  const [criterion, setCriterion] = useState("");
  const [evidence, setEvidence] = useState("");
  const [observedOn, setObservedOn] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  function edit(r: CustomerProgressObservation) {
    setScope(r.scope); setState(r.state); setCriterion(r.criterion); setEvidence(r.evidence); setObservedOn(r.observedOn); setError(null);
  }
  async function save(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      const progress = await record({ slug, contactId: contact.contactId, expectedRevision: contact.progress.revision, scope, state, criterion, evidence, observedOn });
      onSaved({ ...contact, progress });
      toast({ tone: "success", title: "Progress observation saved" });
    } catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  }
  return <div className="flex flex-col gap-4">
    <h3 className="heading-card">{contact.name}</h3>
    {contact.progress.current.length ? <ul className="flex flex-col gap-2">{contact.progress.current.map(r => <li key={r.scope} className="rounded-lg border border-line p-3 text-sm">
      <p className="font-medium">{r.scope}: {CUSTOMER_PROGRESS_LABELS[r.state]}</p><p className="text-ink-2">Owner-reported as of {r.observedOn}. {r.criterion}</p><p>{r.evidence}</p>
      {contact.canEdit ? <Button size="sm" variant="ghost" disabled={busy} onClick={() => edit(r)}>Update {r.scope}</Button> : null}
    </li>)}</ul> : <p className="text-sm text-ink-2">No progress observations yet. A segment name does not establish customer progress.</p>}
    {contact.canEdit ? <form onSubmit={save} className="flex flex-col gap-3">
      <Field label="Product or journey" hint="Use the same name to update that scope; a different product can have a different state."><Input required maxLength={80} value={scope} onChange={e => setScope(e.target.value)} /></Field>
      <Field label="Reported progress"><Select value={state} onValueChange={v => setState(v as CustomerProgressState)} options={CUSTOMER_PROGRESS_STATES.map(value => ({ value, label: CUSTOMER_PROGRESS_LABELS[value] }))} /></Field>
      <Field label="What this state means" hint="For example, first value might mean completing a real export, not just signing up."><Textarea required maxLength={300} value={criterion} onChange={e => setCriterion(e.target.value)} /></Field>
      <Field label="What you observed" hint="Give the evidence or reason for uncertainty. Do not include sensitive personal information."><Textarea required maxLength={500} value={evidence} onChange={e => setEvidence(e.target.value)} /></Field>
      <Field label="Observation date" hint="Use a calendar date no later than today in UTC. This is not a scheduled action."><DatePicker value={observedOn} onChange={setObservedOn} max={new Date().toISOString().slice(0, 10)} disabled={busy} /></Field>
      {error ? <Callout tone="danger" title="Could not save">{error}</Callout> : null}
      <Button type="submit" loading={busy} disabled={!observedOn}>Save observation</Button>
      <p className="text-xs text-ink-3">Saving records an owner report. It does not change consent, enroll anyone or send a message. Correct an uncertain report by saving Unknown for the same scope.</p>
    </form> : <p className="text-sm text-ink-2">A workspace member who can manage connections can record or correct observations.</p>}
    {contact.progress.history.length ? <details className="text-sm"><summary className="cursor-pointer font-medium">Observation history</summary>
      <p className="mt-2 text-ink-2">Showing the latest {contact.progress.history.length} of {contact.progress.revision} saved observations. Latest observations for each scope are retained separately. Earlier history may be omitted.</p>
      <ol className="mt-2 flex flex-col gap-2">{[...contact.progress.history].reverse().map(r => <li key={r.revision} className="border-t border-line pt-2"><p>Revision {r.revision} · {r.scope} · {CUSTOMER_PROGRESS_LABELS[r.state]} · as of {r.observedOn}</p><p>{r.criterion} — {r.evidence}</p></li>)}</ol>
    </details> : null}
  </div>;
}
