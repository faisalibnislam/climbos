"use client";

import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { CircleHelp, Target } from "@/components/icons"
import { useState } from "react";
import { Button, Callout, Card, CardContent, ChoiceChips, Input, Tooltip, toast } from "@/components/ui";
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

type ActivationKind = "value" | "habit" | "setup" | "unknown";
type SignupKind = "free_plan" | "trial_no_card" | "trial_card" | "unknown";
type Funnel = { periodDays: number; visitors?: number; leads?: number; activated?: number; newCustomers?: number; activationKind?: ActivationKind; signupKind?: SignupKind };
/** Software only: picks the conversion reference (free plans and trials convert very differently). */
const SIGNUP_KINDS = [
  { value: "free_plan", label: "Free plan" },
  { value: "trial_no_card", label: "Trial, no card" },
  { value: "trial_card", label: "Trial with card" },
  { value: "unknown", label: "Not software / not sure" },
];
const ACTIVATION_KINDS = [
  { value: "value", label: "Got the result" },
  { value: "setup", label: "Finished setup" },
  { value: "unknown", label: "Not sure" },
];
const FUNNEL_FIELDS: { key: "visitors" | "leads" | "activated" | "newCustomers"; label: string }[] = [
  { key: "visitors", label: "Visitors" },
  { key: "leads", label: "Signups or leads" },
  { key: "activated", label: "Got first value" },
  { key: "newCustomers", label: "New paying customers" },
];

/** The owner's last 30 days: the plan's diagnosis finds the weakest link from these (none are required). */
export function FunnelNumbers({ slug, funnel, canEdit }: { slug: string; funnel: Funnel | null; canEdit: boolean }) {
  const save = useMutation(api.workspace.setFunnel);
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(FUNNEL_FIELDS.map((f) => [f.key, funnel?.[f.key] !== undefined ? String(funnel[f.key]) : ""])));
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<ActivationKind>(funnel?.activationKind ?? "value");
  const [signup, setSignup] = useState<SignupKind>(funnel?.signupKind ?? "unknown");
  const submit = async () => {
    const args: Record<string, number> = {};
    for (const f of FUNNEL_FIELDS) {
      const t = vals[f.key]?.trim();
      if (!t) continue;
      const n = Number(t.replace(/,/g, ""));
      if (!Number.isInteger(n) || n < 0) return toast({ tone: "danger", title: `Check: ${f.label}` });
      args[f.key] = n;
    }
    setBusy(true);
    try {
      await save({ slug, periodDays: 30, ...args, ...(args.activated !== undefined ? { activationKind: kind } : {}), ...(args.leads !== undefined ? { signupKind: signup } : {}) });
      toast({ tone: "success", title: "Numbers saved. Refresh the plan to use them." });
    } catch (e) {
      toast({ tone: "danger", title: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Target className="size-4 shrink-0 text-brand-700" aria-hidden />
          <h2 className="heading-card">Your last 30 days</h2>
          <span className="text-xs text-ink-3">Finds your weakest link</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {FUNNEL_FIELDS.map((f) => (
            <div key={f.key} className="flex flex-col gap-1.5">
              <label htmlFor={`funnel-${f.key}`} className="truncate text-ui font-medium text-ink">
                {f.label}
              </label>
              <Input id={`funnel-${f.key}`} inputMode="numeric" disabled={!canEdit || busy} placeholder="Unknown" value={vals[f.key] ?? ""} onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))} />
            </div>
          ))}
        </div>
        {vals.activated?.trim() ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-ink-2">&quot;Got first value&quot; counts people who…</span>
            <ChoiceChips aria-label="What was counted as first value" options={ACTIVATION_KINDS} value={kind} onValueChange={(v) => setKind(v as ActivationKind)} disabled={!canEdit || busy} />
          </div>
        ) : null}
        {vals.leads?.trim() ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-ink-2">A signup is…</span>
            <ChoiceChips aria-label="What a signup is" options={SIGNUP_KINDS} value={signup} onValueChange={(v) => setSignup(v as SignupKind)} disabled={!canEdit || busy} />
          </div>
        ) : null}
        {canEdit ? (
          <div>
            <Button size="sm" onClick={submit} disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
