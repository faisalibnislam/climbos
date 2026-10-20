"use client";

import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { CircleHelp, Target } from "@/components/icons"
import { useState } from "react";
import { Button, Callout, Card, CardContent, Input, Tooltip, toast } from "@/components/ui";
import { errorMessage } from "@/components/app/errors";
import type { OwnerQuestion } from "../../../../shared/agents/economics";

/** Shares are typed as percentages; money as plain amounts. */
const UNIT: Record<OwnerQuestion["unit"], { suffix: string; toInput: (v: number) => string; fromInput: (s: string) => number }> = {
  usd_month: { suffix: "$ / month", toInput: (v) => String(Math.round(v * 100) / 100), fromInput: Number },
  usd_hour: { suffix: "$ / hour", toInput: (v) => String(Math.round(v)), fromInput: Number },
  hours_week: { suffix: "hours / week", toInput: (v) => String(Math.round(v * 10) / 10), fromInput: Number },
  share: { suffix: "%", toInput: (v) => String(Math.round(v * 100)), fromInput: (s) => Number(s) / 100 },
  share_month: { suffix: "% / month", toInput: (v) => String(Math.round(v * 1000) / 10), fromInput: (s) => Number(s) / 100 },
  count_month: { suffix: "/ month", toInput: (v) => String(Math.round(v)), fromInput: Number },
};

/** Short labels; the full question stays available to screen readers and in the tooltip. */
const SHORT: Record<string, string> = {
  revenuePerCustomerMonthUsd: "Revenue per customer",
  grossMargin: "Margin after delivery",
  monthlyChurn: "Customers lost / month",
  ownerHourUsd: "Your hour is worth",
  ownerHoursPerWeek: "Your hours / week",
  newCustomersPerMonth: "New customers you can take",
};

/** Up to 3 questions whose answers would change the plan's verdicts; answers update every number at once. */
export function SharpenPlan({ slug, questions, canEdit, answersNewer }: { slug: string; questions: OwnerQuestion[]; canEdit: boolean; answersNewer: boolean }) {
  const save = useMutation(api.workspace.setUnitEconomics);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  if (!questions.length) {
    return answersNewer ? (
      <Callout tone="info" title="Numbers use your answers">
        Refresh the plan to update its text.
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
        <div className="flex items-center gap-2">
          <Target className="size-4 shrink-0 text-brand-700" aria-hidden />
          <h2 className="heading-card">Sharpen this plan</h2>
          <span className="text-xs text-ink-3">Assumed numbers</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {questions.map((q) => {
            const id = `sharpen-${q.key}`;
            const unit = UNIT[q.unit];
            return (
              <div key={q.key} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <label htmlFor={id} className="truncate text-ui font-medium text-ink">
                    {SHORT[q.key] ?? q.question}
                    <span className="sr-only"> ({q.question})</span>
                  </label>
                  <Tooltip content={`${q.question} ${q.why}`}>
                    <button type="button" aria-label={`Why: ${q.why}`} className="text-ink-3 hover:text-ink">
                      <CircleHelp aria-hidden className="size-3.5" />
                    </button>
                  </Tooltip>
                </div>
                <div className="relative">
                  <Input id={id} inputMode="decimal" disabled={!canEdit || busy} placeholder={unit.toInput(q.assumed)} value={vals[q.key] ?? ""} onChange={(e) => setVals((v) => ({ ...v, [q.key]: e.target.value }))} className="pr-24" />
                  <span aria-hidden className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-ink-3">{unit.suffix}</span>
                </div>
                <p className="text-xs text-ink-3">Assumed {unit.toInput(q.assumed)}</p>
              </div>
            );
          })}
        </div>
        {canEdit ? (
          <div>
            <Button size="sm" onClick={submit} disabled={!filled.length || busy}>
              {busy ? "Saving…" : "Update"}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
