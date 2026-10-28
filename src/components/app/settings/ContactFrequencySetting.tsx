"use client";

import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { useState } from "react";
import { Button, Input, toast } from "@/components/ui";
import { errorMessage } from "@/components/app/errors";

/** Owner-set minimum gap between ClimbOS emails to one person; no limit unless the owner sets one. */
export function ContactFrequencySetting({ slug, days, canManage }: { slug: string; days: number | null; canManage: boolean }) {
  const save = useMutation(api.settings.setContactFrequency);
  const [value, setValue] = useState(days === null ? "" : String(days));
  const submit = (next: number | null) => save({ slug, days: next }).then(() => toast({ tone: "success", title: next === null ? "Contact limit removed" : "Contact limit saved" }), (e) => toast({ tone: "danger", title: errorMessage(e) }));
  return (
    <section aria-labelledby="frequency-heading" className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-5">
      <h2 id="frequency-heading" className="heading-section">Email limit per person</h2>
      <p className="text-sm text-ink-2">{days === null ? "No limit set." : `At most one email every ${days} days per person.`} Marketing sends wait if anyone was emailed or is in an outreach sequence within that time.</p>
      {canManage ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">Days between emails<Input value={value} inputMode="numeric" onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, ""))} className="w-32" /></label>
          <Button size="sm" onClick={() => void submit(Number(value))} disabled={!value}>Save limit</Button>
          {days !== null ? <Button size="sm" variant="ghost" onClick={() => void submit(null)}>Remove limit</Button> : null}
        </div>
      ) : null}
      <p className="text-xs text-ink-3">Review invitations don&apos;t count toward this yet.</p>
    </section>
  );
}
