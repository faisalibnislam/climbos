"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@convex/_generated/api";
import { Badge, Button, Field, Select, Textarea, toast } from "@/components/ui";
import { errorMessage } from "../errors";
import { formatDateTime } from "../money";
import type { BrandPattern, BrandPatternState } from "../../../../shared/agents/brandConsistency";

type MapData = FunctionReturnType<typeof api.brand.consistency>;

export function BrandConsistencyPanel({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  return <details id="brand-consistency" className="mt-6 rounded-xl border border-line bg-surface p-4" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className="min-h-11 cursor-pointer font-semibold">Brand consistency map</summary>
    {open ? <ConsistencyMap key={slug} slug={slug} /> : null}
  </details>;
}

function ConsistencyMap({ slug }: { slug: string }) {
  const data = useQuery(api.brand.consistency, { slug });
  if (!data) return <p role="status">Loading saved brand context…</p>;
  return <div className="space-y-4 text-sm">
    <p>Compare saved patterns with approved brand rules. Variation can be intentional. Confirming a pattern acknowledges an observation; it does not make it a rule or authorize publishing.</p>
    <p className="text-xs text-ink-3">{data.scope}{data.limited ? " Some records or values are outside this sample or could not be inspected." : ""}</p>
    <section><h2 className="font-semibold">Owner-approved brand rules</h2>{data.rules ? <><p className="mt-1">Confirmed {formatDateTime(data.rules.confirmedAt)}. Colors: {data.rules.colors.join(", ") || "not specified"}.</p><p>Voice: {data.rules.voice || "not specified"}. Tone: {data.rules.toneWords.join(", ") || "not specified"}.</p><p>Avoid: {data.rules.doNots.join("; ") || "nothing specified"}.</p></> : <p>No currently confirmed brand rules. Review and save the brand kit above before treating its suggestions as requirements.</p>}</section>
    {!data.patterns.length ? <p>No usable published-page or saved-design values yet. The map will appear when those sources exist; external website styles are not guessed.</p> : data.patterns.map(pattern => {
      const history = data.decisions.filter(d => d.key === pattern.key);
      const latest = history[0];
      return <article key={pattern.key} className="space-y-3 rounded-lg border border-line p-3">
        <h2 className="font-semibold">{pattern.label}</h2>
        <p><strong>Observed in saved documents:</strong> {pattern.repeatedValues.length ? `Recurring values: ${pattern.repeatedValues.join(", ")}.` : "No recurring value across distinct sources in this sample."}</p>
        <p><strong>Possible inconsistency:</strong> {pattern.outsidePalette.length ? `Published page accents outside the confirmed palette: ${pattern.outsidePalette.join(", ")}. Check whether this is intentional.` : pattern.variation ? "Values differ across these sources. Check their purpose before deciding whether to align them." : "No differing values in this sample; this is not a complete brand review."}</p>
        <p className="text-xs text-ink-3">{pattern.limitation}</p>
        <PatternSources pattern={pattern} slug={slug} />
        {latest ? <p><Badge>{latest.current ? latest.state.replaceAll("_", " ") : "Needs fresh review"}</Badge> {latest.note || "No additional note."}{!latest.current ? " Source versions or brand rules differ from the reviewed snapshot. The earlier decision is not applied as current guidance." : ""}</p> : null}
        {data.canReview ? <details><summary className="min-h-9 cursor-pointer">Review this pattern</summary><PatternReview key={`${pattern.fingerprint}:${latest?.id ?? "new"}`} slug={slug} pattern={pattern} latest={latest} /></details> : <p className="text-xs text-ink-3">An owner or admin can confirm, correct, dismiss or record an intentional exception.</p>}
        {history.length ? <details><summary className="min-h-9 cursor-pointer">Recent review history ({history.length}, latest five)</summary><ol className="space-y-3">{history.map(d => <li key={d.id}><p>{formatDateTime(d.at)} · {d.state.replaceAll("_", " ")} · {d.current ? "matching snapshot" : "earlier snapshot"}</p><p>{d.note}</p><SavedSnapshot snapshot={d.snapshot} slug={slug} /></li>)}</ol></details> : null}
      </article>;
    })}
    {data.decisions.some(d => !data.patterns.some(p => p.key === d.key)) ? <details><summary className="min-h-9 cursor-pointer">Decisions whose sources are no longer in this map</summary>{data.decisions.filter(d => !data.patterns.some(p => p.key === d.key)).map(d => <div key={d.id}><p>{d.state.replaceAll("_", " ")} · {d.note} · needs fresh review</p><SavedSnapshot snapshot={d.snapshot} slug={slug} /></div>)}</details> : null}
  </div>;
}

function PatternSources({ pattern, slug }: { pattern: BrandPattern; slug: string }) {
  return <details><summary className="min-h-9 cursor-pointer">Inspect {pattern.observations.length} saved sources</summary><ul className="space-y-2">{pattern.observations.map(row => <li key={`${row.source.kind}:${row.source.id}`} className="break-words border-l border-line pl-3"><Link className="inline-flex min-h-9 items-center text-link underline" href={row.source.kind === "page" ? `/app/${encodeURIComponent(slug)}/pages?id=${row.source.id}` : `/studio/${encodeURIComponent(slug)}/${row.source.id}`}>{row.source.title}</Link><p className="text-xs text-ink-3">{row.source.version} · {row.source.approval === "published_version" ? "Published page snapshot" : "Saved design draft; not publishing approval"}</p><p>{row.values.join(", ")}</p></li>)}</ul><p className="mt-2 text-xs text-ink-3">Links open the current editor, which may differ from the reviewed snapshot. Saved observations and their version fingerprints remain in review history.</p></details>;
}

function SavedSnapshot({ snapshot, slug }: { snapshot: string; slug: string }) {
  let saved: { pattern?: BrandPattern; rules?: { colors?: unknown } } | null = null;
  try { saved = JSON.parse(snapshot); } catch { /* Older or damaged records stay unavailable. */ }
  const pattern = saved?.pattern;
  if (!pattern || !Array.isArray(pattern.observations) || !pattern.observations.every(row => row?.source && ["page", "design"].includes(row.source.kind) && [row.source.id, row.source.title, row.source.version].every(value => typeof value === "string") && Array.isArray(row.values) && row.values.every(value => typeof value === "string"))) return <p>Saved source details unavailable.</p>;
  const colors = Array.isArray(saved?.rules?.colors) ? saved.rules.colors.filter((c): c is string => typeof c === "string") : [];
  return <div><p className="text-xs text-ink-3">Palette at review: {colors.join(", ") || "unconfirmed or unspecified"}.</p><PatternSources pattern={pattern} slug={slug} /></div>;
}

function PatternReview({ slug, pattern, latest }: { slug: string; pattern: MapData["patterns"][number]; latest?: MapData["decisions"][number] }) {
  const save = useMutation(api.brand.reviewPattern);
  const [state, setState] = useState<BrandPatternState>("confirmed");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  return <form className="space-y-2" onSubmit={async event => { event.preventDefault(); setBusy(true); try { await save({ slug, key: pattern.key, fingerprint: pattern.fingerprint, expectedDecisionId: latest?.id, state, note }); toast({ tone: "success", title: "Pattern review saved" }); } catch (error) { toast({ tone: "danger", title: errorMessage(error) }); } finally { setBusy(false); } }}>
    <Field label="Your decision"><Select disabled={busy} value={state} onValueChange={value => setState(value as BrandPatternState)} options={[{ value: "confirmed", label: "Confirm the observed pattern" }, { value: "corrected", label: "Correct the interpretation" }, { value: "dismissed", label: "Dismiss as irrelevant" }, { value: "intentional_exception", label: "This is an intentional exception" }, ...(latest ? [{ value: "reopened", label: "Reopen for review" }] : [])]} /></Field>
    <Field label="Reason or correction" hint="Required for corrections and exceptions; applies only to these saved sources."><Textarea value={note} onChange={event => setNote(event.target.value)} maxLength={500} rows={2} disabled={busy} /></Field>
    <Button type="submit" variant="secondary" loading={busy} disabled={(state === "corrected" || state === "intentional_exception") && !note.trim()}>Save pattern review</Button>
  </form>;
}
