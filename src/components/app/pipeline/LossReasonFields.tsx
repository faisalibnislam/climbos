"use client";

import type { Id } from "@convex/_generated/dataModel";
import { useState } from "react";
import { Field, Input, Select } from "@/components/ui";
import { LOSS_REASONS, LOSS_REASON_LABEL, type LossReason } from "@shared/growth/pipeline";

/** Why a lost deal didn't go ahead: optional, owner-recorded, and used by the next plan as owner-reported evidence. */
export function LossReasonFields({ slug, d, save }: { slug: string; d: { id: Id<"deals">; lostReason: LossReason | null; lostReasonNote: string | null }; save: (patch: { slug: string; id: Id<"deals">; lostReason?: LossReason | null; lostReasonNote?: string | null }) => unknown }) {
  const [note, setNote] = useState(d.lostReasonNote ?? "");
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Field label="Why didn't it go ahead?" hint="Optional. Leave it blank if you don't know.">
        <Select options={[{ value: "", label: "Not recorded" }, ...LOSS_REASONS.map((reason) => ({ value: reason, label: LOSS_REASON_LABEL[reason] }))]} value={d.lostReason ?? ""} onValueChange={(v) => save({ slug, id: d.id, lostReason: v ? (v as LossReason) : null })} />
      </Field>
      <Field label="What they said (optional)">
        <Input value={note} maxLength={240} placeholder="Went with a cheaper local option" onChange={(e) => setNote(e.target.value)} onBlur={() => { if (note !== (d.lostReasonNote ?? "")) void save({ slug, id: d.id, lostReasonNote: note.trim() || null }); }} />
      </Field>
    </div>
  );
}
