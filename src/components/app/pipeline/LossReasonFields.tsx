"use client";

import type { Id } from "@convex/_generated/dataModel";
import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";
import { useState } from "react";
import { Button, Checkbox, Field, Input, toast } from "@/components/ui";
import { errorMessage } from "@/components/app/errors";
import { dealLossReasons, LOSS_REASONS, LOSS_REASON_LABEL, type LossReason } from "@shared/growth/pipeline";

type LossState = { reasons: LossReason[]; note: string | null; closedAt: number | null; stageSequence: number };
type Deal = { id: Id<"deals">; lostReason: LossReason | null; lostReasons?: LossReason[]; lostReasonNote: string | null; lostAt?: number | null; stageSequence?: number };
export function LossReasonFields({ slug, d, canEdit = true }: { slug: string; d: Deal; canEdit?: boolean }) {
  const current = { reasons: dealLossReasons(d), note: d.lostReasonNote, closedAt: d.lostAt ?? null, stageSequence: d.stageSequence ?? 0 };
  const [editing, setEditing] = useState<LossState | null>(null);
  return <section className="space-y-2 rounded-lg border border-line p-3" aria-label="Loss reasons">
    <h3 className="text-sm font-medium">Why didn’t it go ahead?</h3>
    <p className="text-xs text-ink-2">Optional owner reports. More than one reason can matter. Leave it blank if you don’t know; these reports do not prove what caused the loss.</p>
    <p className="text-sm">{current.reasons.length ? current.reasons.map(r => LOSS_REASON_LABEL[r]).join(" · ") : "No reasons recorded"}</p>
    {current.note ? <p className="break-words text-sm text-ink-2">Owner’s context: {current.note}</p> : null}
    {canEdit && editing ? <ReasonEditor slug={slug} id={d.id} initial={editing} changed={JSON.stringify(current) !== JSON.stringify(editing)} onClose={() => setEditing(null)} /> : canEdit ? <Button size="sm" variant="secondary" onClick={() => setEditing(current)}>Edit loss reasons</Button> : null}
  </section>;
}
function ReasonEditor({ slug, id, initial, changed, onClose }: { slug: string; id: Id<"deals">; initial: LossState; changed: boolean; onClose: () => void }) {
  const update = useMutation(api.crm.update);
  const [reasons, setReasons] = useState(initial.reasons);
  const [note, setNote] = useState(initial.note ?? "");
  const [saving, setSaving] = useState(false);
  return <div className="space-y-3">
    <fieldset disabled={saving}><legend className="text-sm font-medium">Reported reasons (choose any that apply)</legend>{LOSS_REASONS.map(reason => <Checkbox key={reason} label={LOSS_REASON_LABEL[reason]} checked={reasons.includes(reason)} onCheckedChange={checked => setReasons(current => checked === true ? [...current, reason] : current.filter(r => r !== reason))} />)}</fieldset>
    <Field label="Owner’s context (optional)"><Input value={note} maxLength={240} disabled={saving} onChange={event => setNote(event.target.value)} placeholder="What was reported, or what remains uncertain" /></Field>
    {changed ? <p role="alert" className="text-sm text-ink-2">This loss record changed. Your draft is kept here; cancel and review the latest record before editing again.</p> : null}
    <div className="flex flex-wrap gap-2"><Button size="sm" disabled={saving || changed} onClick={async () => {
      setSaving(true);
      try { await update({ slug, id, lostReasons: reasons, lostReasonNote: note.trim() || null, expectedLossState: initial }); onClose(); }
      catch (error) { toast({ tone: "danger", title: errorMessage(error) }); }
      finally { setSaving(false); }
    }}>Save loss reasons</Button><Button size="sm" variant="ghost" disabled={saving} onClick={onClose}>Cancel</Button></div>
  </div>;
}
