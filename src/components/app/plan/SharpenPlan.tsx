"use client";

import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { CircleHelp, Target } from "@/components/icons"
import { useState } from "react";
import { Button, Callout, Card, CardContent, ChoiceChips, Input, Tooltip, toast } from "@/components/ui";
import { errorMessage } from "@/components/app/errors";
import type { OwnerEconomics, OwnerQuestion } from "../../../../shared/agents/economics";
import { calculateSegmentEconomics } from "../../../../shared/agents/segmentEconomics";
import { formatMoney } from "../../../../shared/economics/currency";

/** Shares are typed as percentages; money as plain amounts. */
const UNIT: Record<OwnerQuestion["unit"], { suffix: string; toInput: (v: number) => string; fromInput: (s: string) => number }> = {
  usd_month: { suffix: "$ / month", toInput: (v) => String(Math.round(v * 100) / 100), fromInput: Number },
  usd_hour: { suffix: "$ / hour", toInput: (v) => String(Math.round(v)), fromInput: Number },
  hours_week: { suffix: "hours / week", toInput: (v) => String(Math.round(v * 10) / 10), fromInput: Number },
  share: { suffix: "%", toInput: (v) => String(Math.round(v * 100)), fromInput: (s) => Number(s) / 100 },
  share_month: { suffix: "% / month", toInput: (v) => String(Math.round(v * 1000) / 10), fromInput: (s) => Number(s) / 100 },
  count_month: { suffix: "/ month", toInput: (v) => String(Math.round(v)), fromInput: Number },
};

/** "$125/hour", "34%": a value in its unit, for hint text. */
const hint = (u: OwnerQuestion["unit"], v: string) => ({ usd_month: `$${v}/month`, usd_hour: `$${v}/hour`, hours_week: `${v} h/week`, share: `${v}%`, share_month: `${v}%/month`, count_month: `${v}/month` })[u];

/** Inputs that accept a range ("3–6"). */
const RANGE_KEY: Record<string, "revenue" | "margin" | "churn" | undefined> = { revenuePerCustomerMonthUsd: "revenue", grossMargin: "margin", monthlyChurn: "churn" };

/** Short labels; the full question stays available to screen readers and in the tooltip. */
const SHORT: Record<string, string> = {
  revenuePerCustomerMonthUsd: "Revenue per customer",
  grossMargin: "Margin after delivery",
  monthlyChurn: "Customers lost / month",
  ownerHourUsd: "Your hour is worth",
  ownerHoursPerWeek: "Your hours / week",
  newCustomersPerMonth: "New customers you can take",
  monthlyGrowthCashUsd: "Cash available for growth each month",
};

/** Up to 3 questions whose answers would change the plan's verdicts; answers update every number at once. */
export function SharpenPlan({ slug, questions, canEdit, answersNewer, currency = "USD", segmentEconomics = [] }: { slug: string; questions: OwnerQuestion[]; canEdit: boolean; answersNewer: boolean; currency?: string; segmentEconomics?: OwnerEconomics["segmentEconomics"] }) {
  const save = useMutation(api.workspace.setUnitEconomics);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  if (!questions.length) {
    return <>
      {answersNewer ? <Callout tone="info" title="Numbers use your answers">Refresh the plan to update its text.</Callout> : null}
      <SegmentEconomicsEditor slug={slug} canEdit={canEdit} currency={currency} saved={segmentEconomics} />
    </>;
  }
  const filled = questions.filter((q) => vals[q.key]?.trim());
  const submit = async () => {
    const args: Record<string, number> = {};
    const ranges: Record<string, { low: number; high: number }> = {};
    for (const q of filled) {
      // "3–6" is a range (Hubbard: a range you're 90% sure of beats a guessed point); its midpoint is the value.
      const m = vals[q.key].trim().match(/^([\d.,]+)\s*(?:-|–|to)\s*([\d.,]+)$/i);
      const rk = RANGE_KEY[q.key];
      if (m && rk) {
        const lo = UNIT[q.unit].fromInput(m[1].replace(/,/g, ""));
        const hi = UNIT[q.unit].fromInput(m[2].replace(/,/g, ""));
        if (!(Number.isFinite(lo) && Number.isFinite(hi) && lo > 0 && hi > lo)) return toast({ tone: "danger", title: `Check the range: ${q.question}` });
        ranges[rk] = { low: lo, high: hi };
        args[q.key] = (lo + hi) / 2;
        continue;
      }
      const n = UNIT[q.unit].fromInput(vals[q.key]);
      if (!Number.isFinite(n) || (q.key === "monthlyGrowthCashUsd" ? n < 0 : n <= 0)) return toast({ tone: "danger", title: `Check: ${q.question}` });
      args[q.key] = n;
    }
    setBusy(true);
    try {
      await save({ slug, ...args, ...(Object.keys(ranges).length ? { ranges } : {}) });
      setVals({});
      toast({ tone: "success", title: "Numbers updated" });
    } catch (e) {
      toast({ tone: "danger", title: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Target className="size-4 shrink-0 text-brand-700" aria-hidden />
          <h2 className="heading-card">Sharpen this plan</h2>
          <span className="text-xs text-ink-3">Plan inputs</span>
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
                  <Input id={id} inputMode="decimal" disabled={!canEdit || busy} placeholder={q.assumed === undefined ? "Unknown" : unit.toInput(q.assumed)} value={vals[q.key] ?? ""} onChange={(e) => setVals((v) => ({ ...v, [q.key]: e.target.value }))} className="pr-24" />
                  <span aria-hidden className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-ink-3">{q.key === "monthlyGrowthCashUsd" ? `${currency} / month` : unit.suffix}</span>
                </div>
                <p className="text-xs text-ink-3">
                  {q.switchValue !== undefined ? `Matters if it's ${q.switchDirection === "le" ? "above" : "below"} ${hint(q.unit, unit.toInput(q.switchValue))}` : q.ownerReported && q.assumed !== undefined ? `Saved owner input ${unit.toInput(q.assumed)} · update if it changed` : q.assumed === undefined ? "Owner input needed · not assumed" : `Assumed ${unit.toInput(q.assumed)}`}
                  {RANGE_KEY[q.key] ? " · a range like 3–6 is fine" : ""}
                </p>
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
      <SegmentEconomicsEditor slug={slug} canEdit={canEdit} currency={currency} saved={segmentEconomics} />
    </div>
  );
}

type SegmentRow = NonNullable<OwnerEconomics["segmentEconomics"]>[number];
type SegmentDraft = { segment: string; currency: string; periodDays: string; customers: string; netRevenue: string; variableCosts: string; costBoundary: string; unknownCosts: string; strategicValueNote: string };
const emptySegment = (currency: string): SegmentDraft => ({ segment: "", currency, periodDays: "30", customers: "", netRevenue: "", variableCosts: "", costBoundary: "", unknownCosts: "", strategicValueNote: "" });
const toDraft = (row: SegmentRow): SegmentDraft => ({ segment: row.segment, currency: row.currency, periodDays: String(row.periodDays), customers: String(row.customers), netRevenue: String(row.netRevenue), variableCosts: String(row.variableCosts), costBoundary: row.costBoundary, unknownCosts: row.unknownCosts?.join(", ") ?? "", strategicValueNote: row.strategicValueNote ?? "" });

function SegmentEconomicsEditor({ slug, canEdit, currency, saved = [] }: { slug: string; canEdit: boolean; currency: string; saved?: OwnerEconomics["segmentEconomics"] }) {
  const save = useMutation(api.workspace.setUnitEconomics);
  const [rows, setRows] = useState<SegmentDraft[]>(() => saved.map(toDraft));
  const [busy, setBusy] = useState(false);
  const update = (index: number, key: keyof SegmentDraft, value: string) => setRows((current) => current.map((row, i) => i === index ? { ...row, [key]: value } : row));
  const saveRows = async () => {
    const parsed: SegmentRow[] = [];
    for (const row of rows) {
      const item: SegmentRow = {
        segment: row.segment.trim(),
        currency: row.currency.trim().toUpperCase(),
        periodDays: Number(row.periodDays),
        customers: Number(row.customers),
        netRevenue: Number(row.netRevenue),
        variableCosts: Number(row.variableCosts),
        costBoundary: row.costBoundary.trim(),
        unknownCosts: row.unknownCosts.split(",").map((value) => value.trim()).filter(Boolean),
        ...(row.strategicValueNote.trim() ? { strategicValueNote: row.strategicValueNote.trim() } : {}),
      };
      if (!item.segment || !Number.isFinite(item.periodDays) || !Number.isFinite(item.customers) || !Number.isFinite(item.netRevenue) || !Number.isFinite(item.variableCosts) || !item.costBoundary) return toast({ tone: "danger", title: "Complete each segment’s name, period, customer count, revenue, costs, and cost boundary." });
      parsed.push(item);
    }
    setBusy(true);
    try {
      await save({ slug, segmentEconomics: parsed });
      toast({ tone: "success", title: parsed.length ? "Segment economics saved" : "Segment economics cleared" });
    } catch (error) {
      toast({ tone: "danger", title: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div>
          <h2 className="heading-card">Compare customer groups</h2>
          <p className="mt-1 text-xs text-ink-3">Optional owner-reported totals. Enter net revenue after discounts and refunds, plus variable costs for the same period. ClimbOS does not match billing records to customer groups. Name costs you could not include.</p>
        </div>
        {rows.map((row, index) => {
          const customers = Number(row.customers);
          const revenue = Number(row.netRevenue);
          const costs = Number(row.variableCosts);
          const p = row.segment.trim() && Number.isFinite(customers) && customers > 0 && Number.isFinite(revenue) && Number.isFinite(costs)
            ? calculateSegmentEconomics([{ segment: row.segment, currency: row.currency || currency, periodDays: Math.max(1, Number(row.periodDays) || 1), customers, netRevenue: revenue, variableCosts: costs, costBoundary: row.costBoundary || "Draft boundary", unknownCosts: row.unknownCosts.split(",").map((value) => value.trim()).filter(Boolean) }], currency)[0]
            : undefined;
          return (
            <div key={index} className="grid gap-2 rounded-[var(--radius-card)] border border-line p-3 sm:grid-cols-2 lg:grid-cols-4">
              {([["segment", "Customer group"], ["currency", "Currency (ISO code)"], ["periodDays", "Period (days)"], ["customers", "Customers in group"], ["netRevenue", `Net revenue (${row.currency || currency})`], ["variableCosts", `Variable costs (${row.currency || currency})`], ["costBoundary", "Costs included"], ["unknownCosts", "Unknown costs (comma-separated)"], ["strategicValueNote", "Strategic value to consider"]] as const).map(([key, label]) => <label key={key} className="flex flex-col gap-1 text-xs text-ink-2">{label}<Input disabled={!canEdit || busy} value={row[key]} placeholder={key === "segment" ? "e.g. Solo customers" : key === "currency" ? currency : key === "costBoundary" ? "e.g. materials, payment fees, service time" : key === "unknownCosts" ? "Leave blank if none known" : undefined} inputMode={key === "costBoundary" || key === "unknownCosts" || key === "strategicValueNote" || key === "segment" || key === "currency" ? "text" : "decimal"} onChange={(event) => update(index, key, event.target.value)} /></label>)}
              {p ? <p className="text-xs text-ink-2 sm:col-span-2 lg:col-span-4">Owner-reported comparison: {formatMoney(p.contributionAfterListedCosts, p.currency)} contribution after listed costs · {formatMoney(p.contributionPerCustomer, p.currency)} per customer{p.contributionMargin === null ? " · margin unavailable" : ` · ${Math.round(p.contributionMargin * 1000) / 10}% of net revenue`}{p.completeCostCoverage ? " · stated cost coverage complete" : ` · incomplete costs: ${p.unknownCosts.join(", ")}`}. This is not net profit.</p> : null}
              {canEdit ? <div className="sm:col-span-2 lg:col-span-4"><Button size="sm" onClick={() => setRows((current) => current.filter((_, i) => i !== index))} disabled={busy}>Remove group</Button></div> : null}
            </div>
          );
        })}
        <p className="text-xs text-ink-3">A lower contribution group is a signal to investigate—not an automatic reason to stop serving it. The comparison does not measure retention, acquisition cost, or long-term strategic value.</p>
        {canEdit ? <div className="flex gap-2"><Button size="sm" onClick={() => setRows((current) => current.length < 8 ? [...current, emptySegment(currency)] : current)} disabled={busy || rows.length >= 8}>Add group</Button><Button size="sm" onClick={saveRows} disabled={busy}>{busy ? "Saving…" : "Save segment comparison"}</Button></div> : null}
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
