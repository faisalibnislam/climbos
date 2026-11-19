"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { CUSTOMER_PROGRESS_LABELS, CUSTOMER_PROGRESS_STATES, type CustomerProgressState } from "@shared/growth/customerProgress";
import { PRODUCT_EVENT_OUTCOMES } from "@shared/growth/productTracking";
import { Button, Callout, Field, Input, Select, Textarea } from "@/components/ui";
import { ErrorCallout } from "./content/shared";
import { CustomerProgressDialog } from "./connections/CustomerProgressDialog";

export function ProductTracking({ slug }: { slug: string }) {
  const data = useQuery(api.productTracking.list, { slug });
  const revoke = useMutation(api.productTracking.revoke), rotate = useMutation(api.productTracking.rotate);
  const [adding, setAdding] = useState(false), [token, setToken] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState<unknown>(null);
  async function act(work: () => Promise<void>) { setError(null); setBusy(true); setToken(""); try { await work(); } catch (e) { setError(e); } finally { setBusy(false); } }
  if (!data) return <p role="status">Loading product tracking…</p>;
  return <section className="space-y-5" aria-label="Product tracking">
    <div className="space-y-2"><h2 className="heading-section">Product tracking</h2>
      <p className="text-sm text-ink-2">Connect meaningful product events to customer progress. You define what each event means. Missing activity stays unknown, and your manual corrections take precedence.</p>
      <p className="text-sm text-ink-2">Your developer must send events from your product’s server for contacts already uploaded here. Tracking does not create contacts, grant email permission, or send messages.</p>
    </div>
    <div className="flex flex-wrap gap-2">{data.canCreate ? <Button variant="secondary" onClick={() => setAdding(!adding)}>{adding ? "Close new source" : "Connect product events"}</Button> : null}<CustomerProgressDialog slug={slug} /></div>
    {adding && data.canCreate ? <NewSource slug={slug} onCreated={key => { setToken(key); setAdding(false); }} /> : null}
    {token && data.canManage ? <Callout title="Save your server key now" tone="warning">
      <p>Shown once. Keep it on your server, never in a browser, mobile app, public repository or chat. It can only report events for this source.</p>
      <Field label="New product tracking key"><Input readOnly type="password" value={token} onFocus={e => e.target.select()} /></Field>
      <Button size="sm" variant="secondary" onClick={async () => { try { await navigator.clipboard.writeText(token); } catch (e) { setError(e); } }}>Copy server key</Button>
      <Button size="sm" variant="ghost" onClick={() => setToken("")}>I saved the key</Button>
    </Callout> : null}
    {error ? <ErrorCallout error={error} /> : null}
    {!data.sources.length ? <p className="text-sm text-ink-2">No product event source connected. Current activity is unknown.</p> : <div className="space-y-3">{data.sources.map(s => <article key={s.id} className="space-y-2 rounded-xl border border-line p-4">
      <h3 className="heading-card">{s.name} · {s.scope}</h3>
      <p className="text-sm text-ink-2">{s.revoked ? "Revoked" : s.receivingAllowed ? "Ready to receive" : "Receiving paused — check key expiry, workspace status or key owner access"}. {s.lastReceivedAt ? `Last recorded receipt: ${new Date(s.lastReceivedAt).toLocaleString()}.` : "No events received yet."} This is not a coverage or health guarantee.</p>
      <ul className="space-y-1 text-sm">{s.mappings.map(m => <li key={m.event} className="break-words">{m.event} → {CUSTOMER_PROGRESS_LABELS[m.state]}: {m.criterion}</li>)}</ul>
      {data.canManage && !s.revoked ? <details><summary className="cursor-pointer text-sm font-medium">Manage server access</summary><div className="mt-2 space-y-2"><p className="text-sm text-ink-2">Key {s.prefix}… expires {new Date(s.expiresAt).toLocaleDateString()}. Replacing it immediately disables the old key. Revoking is permanent; saved observations remain dated history.</p><div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" disabled={busy} onClick={() => act(async () => setToken((await rotate({ slug, sourceId: s.id })).token))}>Replace key for {s.name}</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => act(async () => { await revoke({ slug, sourceId: s.id }); })}>Revoke {s.name}</Button></div></div></details> : null}
    </article>)}</div>}
    <details className="space-y-2 text-sm"><summary className="cursor-pointer font-medium">Setup instructions and limits</summary>
      <p>Use HTTPS and POST JSON to the endpoint below, with Authorization: Bearer followed by your server key. This is a write-only connection, separate from agent access.</p>
      <Field label="Product event endpoint"><Input readOnly value={data.endpoint ?? "Endpoint not configured"} /></Field>
      <p>Send exactly eventId (a stable unique ID), email (the existing contact), event (one of your names), and occurredAt (an ISO timestamp with timezone). Never send sensitive details or extra properties. Use the same ID and payload when retrying; a changed payload returns a conflict.</p>
      <p>Events must be no more than 7 days old and not in the future. Times are normalized to UTC. An older event cannot replace newer progress; conflicting milestones at the same instant make progress unknown. Manual reports for the same product always win, including Unknown.</p>
      <p>Up to 20 saved sources, one unrevoked source per product, 8 milestone mappings per source, 120 requests per minute per key, 4 KB per request and 1,000 event receipts per workspace. Receipts are removed after 30 days by daily cleanup. Latest progress and the latest 20 revisions per contact remain until the contact is deleted. Full storage pauses new receipts; it does not silently discard them.</p>
      <p>Definitions cannot be edited in place. Revoke the source and create a replacement to change their meaning. Existing history retains its original definition. No browser tracker, account merging, inactivity detection, retention rates or revenue attribution is inferred.</p>
    </details>
    <div className="space-y-2"><h3 className="heading-card">Recent receipts</h3><p className="text-xs text-ink-3">{data.retainedReceipts} / {data.receiptLimit} stored receipts. These are reports received, not unique customers, revenue or a complete activity history.</p>
      {data.recent.length ? <ul className="space-y-2 text-sm">{data.recent.map(r => <li key={r.id} className="break-words rounded-lg border border-line p-3"><p>{r.source} · {r.event} · {PRODUCT_EVENT_OUTCOMES[r.outcome]}</p><p className="text-ink-2">Reported occurrence: {new Date(r.occurredAt).toISOString()} · received: {new Date(r.receivedAt).toISOString()}</p></li>)}</ul> : <p className="text-sm text-ink-2">No retained receipts. This does not mean nobody used your product.</p>}
    </div>
  </section>;
}

function NewSource({ slug, onCreated }: { slug: string; onCreated: (token: string) => void }) {
  const create = useMutation(api.productTracking.create);
  const [name, setName] = useState(""), [scope, setScope] = useState("");
  const [mappings, setMappings] = useState([{ event: "", state: "" as CustomerProgressState | "", criterion: "" }]);
  const [busy, setBusy] = useState(false), [error, setError] = useState<unknown>(null);
  async function save(e: FormEvent) {
    e.preventDefault(); if (mappings.some(m => !m.state)) return;
    setError(null); setBusy(true);
    try { const result = await create({ slug, name, scope, mappings: mappings.map(m => ({ ...m, state: m.state as CustomerProgressState })) }); onCreated(result.token); } catch (e) { setError(e); } finally { setBusy(false); }
  }
  return <form aria-label="Connect product events" onSubmit={save} className="space-y-4 rounded-xl border border-line p-4">
    <Field label="Source name"><Input required maxLength={80} value={name} onChange={e => setName(e.target.value)} /></Field>
    <Field label="Product or journey" hint="Use a distinct scope. Existing manual observations in this scope will not be overwritten."><Input required maxLength={80} value={scope} onChange={e => setScope(e.target.value)} /></Field>
    {mappings.map((m, i) => <fieldset key={i} className="space-y-3 rounded-lg border border-line p-3"><legend className="px-1 text-sm font-medium">Milestone {i + 1}</legend>
      <Field label={`Event name ${i + 1}`} hint="Use the exact event name your developer sends."><Input required maxLength={80} pattern="[a-zA-Z][a-zA-Z0-9_.:\-]*" value={m.event} onChange={e => setMappings(mappings.map((r, n) => n === i ? { ...r, event: e.target.value } : r))} /></Field>
      <Field label={`Progress meaning ${i + 1}`}><Select value={m.state} placeholder="Choose the observed progress" onValueChange={v => setMappings(mappings.map((r, n) => n === i ? { ...r, state: v as CustomerProgressState } : r))} options={CUSTOMER_PROGRESS_STATES.map(value => ({ value, label: CUSTOMER_PROGRESS_LABELS[value] }))} /></Field>
      <Field label={`Definition ${i + 1}`} hint="Describe the observed outcome. A signup or email click alone need not mean first value."><Textarea required maxLength={300} value={m.criterion} onChange={e => setMappings(mappings.map((r, n) => n === i ? { ...r, criterion: e.target.value } : r))} /></Field>
      {mappings.length > 1 ? <Button type="button" size="sm" variant="ghost" onClick={() => setMappings(mappings.filter((_, n) => n !== i))}>Remove milestone {i + 1}</Button> : null}
    </fieldset>)}
    {mappings.length < 8 ? <Button type="button" variant="secondary" size="sm" onClick={() => setMappings([...mappings, { event: "", state: "", criterion: "" }])}>Add milestone</Button> : null}
    {error ? <ErrorCallout error={error} /> : null}
    <p className="text-xs text-ink-3">Creating this source records your definitions and generates a server key valid for one year. Your developer must connect it before events arrive. Follow-up enrollment still requires an enabled journey, and every email needs review and approval.</p>
    <Button type="submit" loading={busy} disabled={mappings.some(m => !m.state)}>Create source and server key</Button>
  </form>;
}
