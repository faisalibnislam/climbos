"use client";
import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { ProductFunnelMetric } from "@shared/growth/productFunnels";
import { Button, Callout, Field, Input, Select, Table, TableFrame, TBody, Td, Th, THead, Tr } from "@/components/ui";
import { ErrorCallout } from "./content/shared";

type Source = { id: Id<"productTrackingSources">; name: string; scope: string; mappings: { event: string; criterion: string }[] };
function metricText(m: ProductFunnelMetric) { return m.rate === null ? m.pending ? `Not mature yet · ${m.pending} pending` : "No eligible observations" : `${m.observed} of ${m.eligible} (${(m.rate * 100).toFixed(1)}%) · ${m.pending} pending`; }
export function ProductFunnels({ slug, sources }: { slug: string; sources: Source[] }) {
  const data = useQuery(api.productFunnels.list, { slug }), remove = useMutation(api.productFunnels.remove);
  const [adding, setAdding] = useState(false), [error, setError] = useState<unknown>(null), [busy, setBusy] = useState(false);
  if (!data) return <p role="status">Loading product measurements…</p>;
  return <section className="space-y-3" aria-label="Product measurements">
    <h3 className="heading-card">From first use to repeat value</h3>
    <p className="text-sm text-ink-2">Choose the events that mean entry, first value and repeat value for this product. We count observed sequences for people or explicitly identified accounts, keeping unfinished windows separate.</p>
    {data.canCreate && sources.length ? <Button variant="secondary" size="sm" onClick={() => setAdding(!adding)}>{adding ? "Close measurement setup" : "Define a measurement"}</Button> : null}
    {adding ? <MeasurementForm slug={slug} sources={sources} done={() => setAdding(false)} /> : null}
    {error ? <ErrorCallout error={error} /> : null}
    {!data.rows.length ? <p className="text-sm text-ink-2">No measurement defined. Product activity and retention rates remain unknown.</p> : data.rows.map(({ id, assessment: a }) => <article key={id} className="space-y-3 rounded-xl border border-line p-4">
      <h4 className="font-medium">{a.definition.name}</h4>
      <p className="text-sm text-ink-2">{a.definition.entity === "account" ? "Accounts supplied by your server" : "Existing contact identities"} · {a.from}–{a.through} UTC · {a.definition.scope}</p>
      {a.issue ? <Callout tone="warning" title="Measurement needs review">{a.issue}</Callout> : <>
        <p className="text-sm">{a.entered} recorded entrants. First value: {metricText(a.activation)}. Repeat value: {metricText(a.returnUse)}.</p>
        {a.rows.length ? <TableFrame><Table><caption className="sr-only">Product event cohorts by first recorded entry date</caption><THead><Tr><Th>Entry date (UTC)</Th><Th>Entrants</Th><Th>First value</Th><Th>Repeat value</Th></Tr></THead><TBody>{a.rows.map(r => <Tr key={r.cohort}><Td>{r.cohort}</Td><Td>{r.entered}</Td><Td>{metricText(r.activation)}</Td><Td>{metricText(r.returnUse)}</Td></Tr>)}</TBody></Table></TableFrame> : null}
      </>}
      <details className="text-sm"><summary className="cursor-pointer font-medium">Definitions and limitations</summary>
        <p className="mt-2">Entry: {a.definition.entryEvent}. First value: {a.definition.activationEvent} strictly after entry, within {a.definition.activationDays} elapsed days. Repeat value: {a.definition.returnEvent} after first value, from day {a.definition.returnStartDay} inclusive to day {a.definition.returnEndDay} exclusive after entry.</p>
        <p>We allow another {a.lateArrivalDays} days for delayed events before including a person or account in a mature denominator. First entry means first recorded in the loaded period, not necessarily first-ever signup. Coverage outside recorded events is unknown; zero means no matching event recorded, not verified churn or failure. These figures do not establish revenue or a campaign’s effect.</p>
        <p>{a.excludedContacts} contacts and {a.excludedEvents} events were excluded for unavailable or disputed evidence. Manual corrections and future-event choices remain authoritative. Account reports require explicit account identifiers on every relevant event.</p>
      </details>
      {data.canManage ? <Button variant="ghost" size="sm" disabled={busy} onClick={async () => { setBusy(true); setError(null); try { await remove({ slug, id }); } catch (e) { setError(e); } finally { setBusy(false); } }}>Remove definition {a.definition.name}</Button> : null}
    </article>)}
  </section>;
}

function MeasurementForm({ slug, sources, done }: { slug: string; sources: Source[]; done: () => void }) {
  const create = useMutation(api.productFunnels.create);
  const [name, setName] = useState(""), [sourceId, setSource] = useState(""), [entity, setEntity] = useState<"person" | "account">("person");
  const [entry, setEntry] = useState(""), [activation, setActivation] = useState(""), [returnEvent, setReturn] = useState("");
  const [activationDays, setActivationDays] = useState(""), [returnStart, setReturnStart] = useState(""), [returnEnd, setReturnEnd] = useState(""), [lookback, setLookback] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState<unknown>(null);
  const source = sources.find(s => s.id === sourceId), options = source?.mappings.map(m => ({ value: m.event, label: `${m.event} — ${m.criterion}` })) ?? [];
  async function save(e: FormEvent) { e.preventDefault(); setError(null); setBusy(true); try { await create({ slug, sourceId: sourceId as Id<"productTrackingSources">, name, entity, entryEvent: entry, activationEvent: activation, returnEvent, activationDays: Number(activationDays), returnStartDay: Number(returnStart), returnEndDay: Number(returnEnd), lookbackDays: Number(lookback) }); done(); } catch (e) { setError(e); } finally { setBusy(false); } }
  return <form aria-label="Define product measurement" onSubmit={save} className="space-y-3 rounded-lg border border-line p-4">
    <Field label="Measurement name"><Input required maxLength={80} value={name} onChange={e => setName(e.target.value)} /></Field>
    <Field label="Measurement source"><Select value={sourceId} onValueChange={v => { setSource(v); setEntry(""); setActivation(""); setReturn(""); }} options={sources.map(s => ({ value: s.id, label: `${s.name} · ${s.scope}` }))} /></Field>
    <Field label="Count"><Select value={entity} onValueChange={v => setEntity(v as "person" | "account")} options={[{ value: "person", label: "People (existing contact IDs)" }, { value: "account", label: "Accounts (explicit server IDs)" }]} /></Field>
    <Field label="Entry event"><Select value={entry} onValueChange={setEntry} options={options} /></Field>
    <Field label="First value event"><Select value={activation} onValueChange={setActivation} options={options.filter(o => o.value !== entry)} /></Field>
    <Field label="Repeat value event"><Select value={returnEvent} onValueChange={setReturn} options={options.filter(o => o.value !== entry)} /></Field>
    <Field label="Days allowed to reach first value"><Input type="number" required min={1} max={21} step={1} value={activationDays} onChange={e => setActivationDays(e.target.value)} /></Field>
    <Field label="Repeat value window starts on day" hint="Measured from entry; must be at or after the first-value deadline."><Input type="number" required min={1} max={20} step={1} value={returnStart} onChange={e => setReturnStart(e.target.value)} /></Field>
    <Field label="Repeat value window ends before day"><Input type="number" required min={2} max={21} step={1} value={returnEnd} onChange={e => setReturnEnd(e.target.value)} /></Field>
    <Field label="UTC dates to include" hint="Include the repeat-value deadline plus at least seven late-arrival days; maximum 30 dates including today."><Input type="number" required min={9} max={30} step={1} value={lookback} onChange={e => setLookback(e.target.value)} /></Field>
    <p className="text-xs text-ink-3">Choose windows appropriate to your product; ClimbOS does not guess them. Saving defines a measurement only. It does not send, schedule, spend or change customer progress. Definitions are immutable; remove and recreate to change meaning.</p>
    {error ? <ErrorCallout error={error} /> : null}<Button type="submit" loading={busy} disabled={!sourceId || !entry || !activation || !returnEvent}>Save measurement</Button>
  </form>;
}
