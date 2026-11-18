"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button, DatePicker, Field, Input, Select, Textarea, toast } from "@/components/ui";
import { errorMessage } from "@/components/app/errors";
import { QUALIFICATION_LABELS, QUALIFICATION_QUESTIONS, QUALIFICATION_TOPICS, type QualificationTopic } from "@shared/growth/dealQualification";

const STATES = [{ value: "unknown", label: "Unknown" }, { value: "reported", label: "Reported" }, { value: "conflicting", label: "Conflicting reports" }, { value: "outdated", label: "Needs a fresh check" }] as const;
type Report = NonNullable<ReturnType<typeof useQuery<typeof api.crm.qualification>>>["current"][number];

export function DealQualification({ slug, id }: { slug: string; id: Id<"deals"> }) {
  const [open, setOpen] = useState(false);
  const data = useQuery(api.crm.qualification, open ? { slug, id } : "skip");
  const [editing, setEditing] = useState<{ topic: QualificationTopic; revision: number; report?: Report } | null>(null);
  return <details className="rounded-lg border border-line p-3" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className="cursor-pointer text-sm font-medium">Buying context</summary>
    <p className="mt-2 text-xs text-ink-2">Record only what helps the next decision. These are dated owner reports, not verified buyer intent or permission to contact. Leave irrelevant or unanswered topics unknown.</p>
    {!data ? <p className="mt-2 text-sm text-ink-2">Loading buying context…</p> : <div className="mt-3 space-y-3">
      {QUALIFICATION_TOPICS.map(topic => {
        const report = data.current.find(r => r.topic === topic);
        return <section key={topic} aria-label={QUALIFICATION_LABELS[topic]} className="space-y-1">
          <h3 className="text-sm font-medium">{QUALIFICATION_LABELS[topic]}</h3>
          <p className="text-xs text-ink-2">{STATES.find(s => s.value === report?.state)?.label ?? "Unknown"}</p>
          {report ? <><p className="whitespace-pre-wrap break-words text-sm">{report.statement}</p><p className="break-words text-xs text-ink-2">Owner report · observed {report.observedOn} · {report.sourceLabel}</p></> : <p className="text-xs text-ink-2">No observation recorded.</p>}
          {data.canEdit && !editing ? <Button size="sm" variant="ghost" onClick={() => setEditing({ topic, revision: data.revision, report })}>{report ? "Update" : "Add observation"}</Button> : null}
          {editing?.topic === topic ? <QualificationForm key={`${topic}:${editing.revision}`} slug={slug} id={id} topic={topic} revision={editing.revision} report={editing.report} changed={data.revision !== editing.revision} onClose={() => setEditing(null)} /> : null}
        </section>;
      })}
      {data.history.length ? <details><summary className="cursor-pointer text-xs">Observation history ({data.history.length} of {data.revision})</summary><p className="mt-2 text-xs text-ink-2">The most recent 20 reports are retained. Earlier reports may be omitted; each topic’s latest report stays available above.</p><ul className="mt-2 space-y-2">{[...data.history].reverse().map(r => <li key={r.revision} className="break-words text-xs text-ink-2">#{r.revision} · {QUALIFICATION_LABELS[r.topic]} · {STATES.find(s => s.value === r.state)?.label} · observed {r.observedOn}; recorded {new Date(r.recordedAt).toISOString()}<br />{r.statement}<br />Source described by owner: {r.sourceLabel}</li>)}</ul></details> : null}
      <p className="text-xs text-ink-2">Saving a report does not change the deal’s stage, send a message or approve any action. Use Review next step to prepare a question for Climb AI.</p>
    </div>}
  </details>;
}

function QualificationForm({ slug, id, topic, revision, report, changed, onClose }: { slug: string; id: Id<"deals">; topic: QualificationTopic; revision: number; report?: Report; changed: boolean; onClose: () => void }) {
  const save = useMutation(api.crm.recordQualification);
  const [state, setState] = useState<Report["state"]>(report?.state ?? "unknown");
  const [statement, setStatement] = useState(report?.statement ?? "");
  const [sourceLabel, setSourceLabel] = useState(report?.sourceLabel ?? "");
  const [observedOn, setObservedOn] = useState(report?.observedOn ?? "");
  const [saving, setSaving] = useState(false);
  return <div className="space-y-2 rounded-lg bg-surface-2 p-2">
    <p className="text-xs text-ink-2">{QUALIFICATION_QUESTIONS[topic]}</p>
    <Field label="Evidence state"><Select value={state} options={[...STATES]} onValueChange={value => setState(value as Report["state"])} disabled={saving} /></Field>
    <Field label="What is known or needs checking?"><Textarea value={statement} maxLength={240} rows={2} onChange={e => setStatement(e.target.value)} disabled={saving} /></Field>
    <Field label="Where did this come from?" hint="Describe the conversation, document or reason for uncertainty. A source description is not independent verification."><Input value={sourceLabel} maxLength={160} onChange={e => setSourceLabel(e.target.value)} disabled={saving} /></Field>
    <Field label="Observation date" hint="When this was observed, not a proposed closing date. No future dates (UTC)."><DatePicker value={observedOn} onChange={setObservedOn} max={new Date().toISOString().slice(0, 10)} disabled={saving} /></Field>
    {changed ? <p role="alert" className="text-sm text-ink-2">Buying context changed while you were editing. Your draft is kept here. Cancel and review the latest reports before editing again.</p> : null}
    <div className="flex flex-wrap gap-2"><Button size="sm" disabled={saving || changed || statement.trim().length < 3 || sourceLabel.trim().length < 3 || !observedOn} onClick={async () => {
      setSaving(true);
      try { await save({ slug, id, expectedRevision: revision, topic, state, statement, sourceLabel, observedOn }); toast({ tone: "success", title: "Observation saved" }); onClose(); }
      catch (error) { toast({ tone: "danger", title: errorMessage(error) }); }
      finally { setSaving(false); }
    }}>Save observation</Button><Button size="sm" variant="ghost" disabled={saving} onClick={onClose}>Cancel</Button></div>
  </div>;
}
