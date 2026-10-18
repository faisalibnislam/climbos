"use client";

import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Target } from "lucide-react";
import { useState } from "react";
import { Button, Callout, Card, CardContent, Field, Input, toast } from "@/components/ui";
import { errorMessage } from "@/components/app/errors";
import type { OwnerQuestion } from "../../../../shared/agents/economics";

/** Shares are typed as percentages; money as plain amounts. */
const UNIT: Record<OwnerQuestion["unit"], { suffix: string; toInput: (v: number) => string; fromInput: (s: string) => number }> = {
  usd_month: { suffix: "$ / month", toInput: (v) => String(Math.round(v * 100) / 100), fromInput: Number },
  usd_hour: { suffix: "$ / hour", toInput: (v) => String(Math.round(v)), fromInput: Number },
  share: { suffix: "%", toInput: (v) => String(Math.round(v * 100)), fromInput: (s) => Number(s) / 100 },
  share_month: { suffix: "% / month", toInput: (v) => String(Math.round(v * 1000) / 10), fromInput: (s) => Number(s) / 100 },
};

/** Up to 3 questions whose answers would change the plan's verdicts; answers update every number at once. */
export function SharpenPlan({ slug, questions, canEdit, answersNewer }: { slug: string; questions: OwnerQuestion[]; canEdit: boolean; answersNewer: boolean }) {
  const save = useMutation(api.workspace.setUnitEconomics);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  if (!questions.length) {
    return answersNewer ? (
      <Callout tone="info" title="Numbers use your answers">
        Cost per customer and payback are updated. Refresh the plan to rewrite its text with them.
      </Callout>
    ) : null;
  }
  const filled = questions.filter((q) => vals[q.key]?.trim());
  const submit = async () => {
    const args: Record<string, number> = {};
    for (const q of filled) {
      const n = UNIT[q.unit].fromInput(vals[q.key]);
      if (!Number.isFinite(n) || n <= 0) return toast({ tone: "danger", title: `Check: ${q.question}` });
      args[q.key] = n;
    }
    setBusy(true);
    try {
      await save({ slug, ...args });
      setVals({});
      toast({ tone: "success", title: "Numbers updated" });
    } catch (e) {
      toast({ tone: "danger", title: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-start gap-2">
          <Target className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden />
          <div>
            <p className="font-medium text-ink">Sharpen this plan</p>
            <p className="text-sm text-ink-3">These numbers were assumed and could change which plays are worth it.</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {questions.map((q) => (
            <Field key={q.key} label={q.question} hint={`${q.why} Assumed: ${UNIT[q.unit].toInput(q.assumed)} ${UNIT[q.unit].suffix}.`}>
              <Input inputMode="decimal" disabled={!canEdit || busy} placeholder={UNIT[q.unit].toInput(q.assumed)} value={vals[q.key] ?? ""} onChange={(e) => setVals((v) => ({ ...v, [q.key]: e.target.value }))} />
            </Field>
          ))}
        </div>
        {canEdit ? (
          <div>
            <Button onClick={submit} disabled={!filled.length || busy}>
              {busy ? "Saving…" : "Update numbers"}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
