"use client";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Button, Field, Input, Select, Textarea, toast } from "@/components/ui";
import { PLATFORM_PREPARATION, PlatformPreparationSchema, type PlatformKind, type PlatformPreparation as Draft } from "@shared/acquisition/platformPreparation";
import { errorMessage } from "../errors";
const empty: Draft = { audience: "", evidence: "", destination: "", accountControl: "unknown", eligibility: "unknown", name: "", description: "", makerComment: "", measurement: "" };
export function PlatformPreparation({ slug, kind }: { slug: string; kind: PlatformKind }) {
  const [open, setOpen] = useState(false);
  const data = useQuery(api.platformPreparations.latest, open ? { slug, kind } : "skip");
  return <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)} className="text-sm"><summary className="min-h-11 cursor-pointer font-medium text-link">Prepare {PLATFORM_PREPARATION[kind].name}</summary>{open && data ? <PreparationForm key={data.version} slug={slug} kind={kind} initial={data.draft ?? empty} version={data.version} canEdit={data.canEdit} history={data.history} hasOlder={data.hasOlder} /> : open ? <p>Loading saved preparation…</p> : null}</details>;
}
function PreparationForm({ slug, kind, initial, version, canEdit, history, hasOlder }: { slug: string; kind: PlatformKind; initial: Draft; version: number; canEdit: boolean; history: { version: number; createdAt: number; draft: Draft }[]; hasOlder: boolean }) {
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const save = useMutation(api.platformPreparations.save);
  const policy = PLATFORM_PREPARATION[kind];
  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const parsed = PlatformPreparationSchema.safeParse(draft);
  return <div className="mt-2 flex flex-col gap-3 rounded-lg border border-line p-3">
    <p>{policy.purpose}</p>
    <p className="text-xs text-ink-3">Preparation only · saved v{version}. Confirmed below means reported by you, not independently verified.</p>
    <Field label="Who should this reach?"><Textarea disabled={!canEdit} rows={2} maxLength={600} value={draft.audience} onChange={(e) => update("audience", e.target.value)} /></Field>
    <Field label="Why would these people use this platform?" hint={policy.evidenceHint}><Textarea disabled={!canEdit} rows={3} maxLength={1200} value={draft.evidence} onChange={(e) => update("evidence", e.target.value)} /></Field>
    <Field label="Can this business use this platform?"><Select disabled={!canEdit} value={draft.eligibility} onValueChange={(value) => update("eligibility", value as Draft["eligibility"])} options={[{ value: "unknown", label: "Still checking eligibility" }, { value: "confirmed", label: "I checked the current requirements" }, { value: "ineligible", label: "It does not qualify" }]} /></Field>
    <Field label="Account control" hint={policy.control}><Select disabled={!canEdit} value={draft.accountControl} onValueChange={(value) => update("accountControl", value as Draft["accountControl"])} options={[{ value: "unknown", label: "Not confirmed" }, { value: "confirmed", label: "I confirm authorized control" }]} /></Field>
    <Field label={kind === "product_hunt" ? "Product URL" : "Exact profile URL or intended business website"}><Input disabled={!canEdit} type="url" maxLength={1000} value={draft.destination} onChange={(e) => update("destination", e.target.value)} placeholder="https://…" /></Field>
    <Field label={kind === "product_hunt" ? "Product name and short tagline" : "Public business or product name"}><Input disabled={!canEdit} maxLength={160} value={draft.name} onChange={(e) => update("name", e.target.value)} /></Field>
    <Field label="What should a customer understand?" hint="Explain one real job, who it helps and the evidence behind the claim. Leave unsupported promises out."><Textarea disabled={!canEdit} rows={4} maxLength={2400} value={draft.description} onChange={(e) => update("description", e.target.value)} /></Field>
    {kind === "product_hunt" ? <Field label="Maker comment" hint="Why you made it, one useful demonstration, what is new and the feedback you want."><Textarea disabled={!canEdit} rows={4} maxLength={2400} value={draft.makerComment} onChange={(e) => update("makerComment", e.target.value)} /></Field> : null}
    <Field label="What would make this worthwhile?" hint="Choose useful feedback or qualified visits, activation and paid outcomes if measured. Record the review period, your time limit and when you would stop. Votes, impressions and ratings do not establish sales."><Textarea disabled={!canEdit} rows={3} maxLength={1000} value={draft.measurement} onChange={(e) => update("measurement", e.target.value)} /></Field>
    <p className="text-xs text-ink-3">{policy.boundary} <a href={policy.source} target="_blank" rel="noreferrer noopener" className="text-link underline">Official guidance</a> · checked 9 November 2026; recheck before acting.</p>
    {draft.eligibility !== "confirmed" || draft.accountControl !== "confirmed" ? <p role="status">Keep this as research until eligibility and authorized account control are confirmed.</p> : null}
    {canEdit ? <Button variant="secondary" loading={busy} disabled={!parsed.success} onClick={async () => { setBusy(true); try { await save({ slug, kind, expectedVersion: version, draft: JSON.stringify(draft) }); toast({ tone: "success", title: "Preparation saved", description: "Nothing was sent or published." }); } catch (error) { toast({ tone: "danger", title: errorMessage(error) }); } finally { setBusy(false); } }}>Save preparation</Button> : null}
    <Button variant="ghost" disabled={!version} onClick={async () => { try { await navigator.clipboard.writeText(`${policy.name} · saved v${version}\nAudience: ${initial.audience}\nEvidence: ${initial.evidence}\nEligibility: ${initial.eligibility}; account control: ${initial.accountControl}\nDestination: ${initial.destination}\n${initial.name}\n${initial.description}\n${initial.makerComment}\nMeasure: ${initial.measurement}\n${policy.boundary}`); toast({ tone: "success", title: "Saved version copied", description: "Review it in the destination before any manual action." }); } catch { toast({ tone: "danger", title: "Clipboard unavailable" }); } }}>Copy saved version</Button>
    {history.length ? <details><summary className="min-h-9 cursor-pointer">Saved versions</summary><ul>{history.map((h) => <li key={h.version}><details><summary className="min-h-9 cursor-pointer">v{h.version} · {new Date(h.createdAt).toLocaleString()}</summary><p>{h.draft.name}</p><p>{h.draft.description}</p><p>{h.draft.makerComment}</p><p>Audience: {h.draft.audience}</p><p>Evidence: {h.draft.evidence}</p><p>Destination: {h.draft.destination}</p><p>Eligibility: {h.draft.eligibility} · account control: {h.draft.accountControl}</p><p>Measurement: {h.draft.measurement}</p></details></li>)}</ul>{hasOlder ? <p>Earlier versions are retained; showing the latest ten.</p> : null}</details> : null}
  </div>;
}
