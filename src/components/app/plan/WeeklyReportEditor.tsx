"use client";

import { useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button, DatePicker, Field, Input, toast } from "@/components/ui";
import { errorMessage } from "@/components/app/errors";
import type { PlayModel } from "../../../../shared/agents/economics";
import { decimalToMinor } from "../../../../shared/integrations/currency";
import { formatMinorMoney, isKnownCurrency, minorToMajor } from "../../../../shared/economics/currency";

type WeekData = FunctionReturnType<typeof api.playResults.weekForPlay>;
type Props = { slug: string; strategyId: Id<"strategies">; playName: string; model: PlayModel; canEdit: boolean; onClose: () => void };
const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const monday = (ms: number) => { const d = new Date(ms); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - (d.getUTCDay() + 6) % 7); };

export function WeeklyReportEditor(props: Props) {
  const [openedAt] = useState(() => Date.now());
  const [date, setDate] = useState(() => isoDate(monday(Date.now())));
  const [reload, setReload] = useState(0);
  const [saving, setSaving] = useState(false);
  const time = Date.parse(`${date}T00:00:00Z`);
  const week = Number.isFinite(time) ? monday(time) : null;
  const data = useQuery(api.playResults.weekForPlay, week === null ? "skip" : { slug: props.slug, strategyId: props.strategyId, playName: props.playName, weekStart: week });
  return <div className="flex flex-col gap-3">
    <Field label="Week containing (UTC)" hint="Choose a date in the week you want to report or review. Weeks start Monday at 00:00 UTC.">
      <DatePicker value={date} min={data ? isoDate(data.minWeek) : undefined} max={isoDate(openedAt)} disabled={saving} onChange={setDate} />
    </Field>
    {week === null ? <p role="alert">Choose a valid reporting date.</p> : <p className="text-xs text-ink-2">Week beginning {isoDate(week)} · UTC</p>}
    {week !== null && !data ? <p role="status">Loading saved report…</p> : null}
    {data?.issue ? <p role="alert" className="text-xs text-red-800">{data.issue}</p> : null}
    {week !== null && data && !data.issue ? <WeeklyReportForm key={`${week}:${reload}`} {...props} data={data} week={week} onSaving={setSaving} onReload={() => setReload(n => n + 1)} /> : <Button variant="ghost" onClick={props.onClose}>Cancel</Button>}
  </div>;
}

function WeeklyReportForm({ data, week, onReload, onSaving, ...props }: Props & { data: WeekData; week: number; onReload: () => void; onSaving: (saving: boolean) => void }) {
  const log = useMutation(api.playResults.log);
  // Keep the version seen when editing began. Reactive updates must not silently rebase a draft.
  const [initial] = useState(data);
  const [openedAt] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const old = initial.row;
  const savedCurrencies = [...new Set([old?.spendCurrency, old?.retentionCurrency].filter((c): c is string => !!c))];
  const currency = savedCurrencies.length === 1 && isKnownCurrency(savedCurrencies[0]) ? savedCurrencies[0] : initial.currency;
  const [vals, setVals] = useState<Record<string, string>>(() => old ? {
    reach: String(old.reach), ...Object.fromEntries(old.steps.map((n, i) => [`s${i}`, String(n)])),
    spend: old.spendUsd === 0 || old.spendCurrency === currency ? String(old.spendUsd) : "", hours: String(old.ownerHours),
    repeatCustomers: old.repeatCustomers === undefined ? "" : String(old.repeatCustomers),
    retainedRevenue: old.retainedRevenueMinor !== undefined && old.retentionCurrency === currency ? String(minorToMajor(old.retainedRevenueMinor, currency)) : "",
    retainedContribution: old.retainedContributionMinor !== undefined && old.retentionCurrency === currency ? String(minorToMajor(old.retainedContributionMinor, currency)) : "",
  } : {});
  const changed = data.row?.id !== old?.id || data.row?.revision !== old?.revision;
  const currencyChanged = data.currency !== initial.currency;
  const invalidWeek = week < data.minWeek || week > monday(openedAt);
  const fields = [{ key: "reach", label: "Reached" }, ...props.model.steps.map((s, i) => ({ key: `s${i}`, label: s.name })), { key: "spend", label: `Spent${currency ? ` (${currency})` : ""}` }, { key: "hours", label: "Your hours" }];
  const submit = async () => {
    setBusy(true);
    onSaving(true);
    try {
      if (changed || currencyChanged) throw new Error("The report or business currency changed. Reload the saved report before editing.");
      const n = (key: string) => { if (!vals[key]?.trim() || !Number.isFinite(Number(vals[key]))) throw new Error("Enter each reported value. Use 0 only for a recorded zero."); return Number(vals[key]); };
      const money = (key: string) => { if (!vals[key]?.trim()) return undefined; if (!currency) throw new Error("Confirm the business currency first."); const parsed = decimalToMinor(vals[key], currency); if (!parsed.ok) throw new Error(parsed.error); return parsed.minor; };
      await log({ slug: props.slug, strategyId: props.strategyId, playName: props.playName, weekStart: week,
        expectedResultId: old?.id, expectedRevision: old?.revision ?? 0, expectedWorkspaceCurrency: initial.currency,
        reach: n("reach"), steps: props.model.steps.map((_, i) => n(`s${i}`)), spendUsd: n("spend"), currency: currency ?? undefined, ownerHours: n("hours"),
        repeatCustomers: vals.repeatCustomers?.trim() ? n("repeatCustomers") : undefined,
        retainedRevenueMinor: money("retainedRevenue"), retainedContributionMinor: money("retainedContribution"),
      });
      toast({ tone: "success", title: "Results saved" });
      props.onClose();
    } catch (e) { toast({ tone: "danger", title: errorMessage(e) }); } finally { setBusy(false); onSaving(false); }
  };
  return <div className="flex flex-col gap-2">
    <p className="text-xs text-ink-2">{old ? "Saved owner report. Corrections preserve previous versions; they are not additional results." : "No report saved for this week. Missing values are unknown, not zero."}</p>
    {invalidWeek ? <p role="alert" className="text-xs text-red-800">Choose a week from the plan&apos;s creation through the current week.</p> : null}
    {changed || currencyChanged ? <div role="alert" className="text-xs text-red-800"><p>{currencyChanged ? "The business currency changed." : "This weekly report changed in another edit."} Your unsaved values have not been applied.</p><Button variant="secondary" onClick={onReload}>Reload saved report</Button></div> : null}
    {old && ((old.spendUsd > 0 && old.spendCurrency !== currency) || ((old.retainedRevenueMinor !== undefined || old.retainedContributionMinor !== undefined) && old.retentionCurrency !== currency)) ? <p className="text-xs text-ink-2">Some original money units are unknown or conflicting. Those amounts are not prefilled. Check the original record and explicitly confirm the amounts and currency before correcting.</p> : null}
    {currency && currency !== initial.currency ? <p className="text-xs text-ink-2">This report retains {currency}. Current business settings use {initial.currency ?? "an unknown currency"}; no conversion is performed.</p> : null}
    <div className="grid grid-cols-2 gap-2">{fields.map(f => <Field key={f.key} label={f.label}><Input inputMode="decimal" value={vals[f.key] ?? ""} onChange={e => setVals(v => ({ ...v, [f.key]: e.target.value }))} disabled={busy || !props.canEdit} /></Field>)}</div>
    <fieldset className="flex flex-col gap-2 rounded-[var(--radius-control)] border border-line p-2.5">
      <legend className="px-1 text-xs font-semibold text-ink">Existing customers (optional)</legend>
      <p className="text-xs text-ink-3">Leave blank if you didn&apos;t track it. Clearing a saved optional value removes it from the current report; its earlier version stays in history.</p>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Repeat customers this week"><Input inputMode="numeric" value={vals.repeatCustomers ?? ""} onChange={e => setVals(v => ({ ...v, repeatCustomers: e.target.value }))} disabled={busy || !props.canEdit} /></Field>
        <Field label={`Net retained revenue${currency ? ` (${currency})` : ""}`}><Input inputMode="decimal" value={vals.retainedRevenue ?? ""} onChange={e => setVals(v => ({ ...v, retainedRevenue: e.target.value }))} disabled={busy || !props.canEdit || !currency} /></Field>
        <Field label={`Retained contribution${currency ? ` (${currency})` : ""}`} hint="After delivery costs. Can be negative."><Input inputMode="decimal" value={vals.retainedContribution ?? ""} onChange={e => setVals(v => ({ ...v, retainedContribution: e.target.value }))} disabled={busy || !props.canEdit || !currency} /></Field>
      </div>
    </fieldset>
    <div className="flex gap-2">{props.canEdit ? <Button size="sm" onClick={submit} disabled={busy || changed || currencyChanged || invalidWeek || fields.some(f => !vals[f.key]?.trim())}>{busy ? "Saving…" : "Save"}</Button> : null}<Button size="sm" variant="ghost" onClick={props.onClose} disabled={busy}>Cancel</Button></div>
    {data.row ? <WeeklyHistory slug={props.slug} resultId={data.row.id} /> : null}
  </div>;
}

function WeeklyHistory({ slug, resultId }: { slug: string; resultId: Id<"playResults"> }) {
  const [open, setOpen] = useState(false);
  const { results, status, loadMore } = usePaginatedQuery(api.playResults.weeklyHistoryPage, open ? { slug, resultId } : "skip", { initialNumItems: 10 });
  return <details onToggle={e => setOpen(e.currentTarget.open)}>
    <summary className="min-h-9 cursor-pointer text-sm text-link">Weekly report history</summary>
    {open ? <div className="flex flex-col gap-2 text-xs text-ink-2">
      <p>Saved versions of this week&apos;s owner report. Learning uses the current report only. Corrections made before history tracking cannot be recovered.</p>
      {status === "LoadingFirstPage" ? <p role="status">Loading history…</p> : null}
      {!results.length && status === "Exhausted" ? <p>No preserved revisions yet. This legacy report will be preserved on its next correction.</p> : null}
      {results.map(r => <div key={r.id} className="rounded-[var(--radius-control)] border border-line p-2">
        <p className="font-semibold">Revision {r.revision}{r.current ? " · Current" : ""} · {r.kind.replace(/_/g, " ")}</p>
        <p>{new Date(r.savedAt).toISOString()} · Reached {r.snapshot.reach} · {r.snapshot.ownerHours} hours</p>
        <p>{r.snapshot.steps.map((n, i) => `${r.snapshot.stepNames?.[i] ?? `Step ${i + 1} (original label unavailable)`}: ${n}`).join("; ")}</p>
        <p>Spent: {r.snapshot.spendUsd} {r.snapshot.spendCurrency ?? "(currency unknown)"}</p>
        <p>Repeat customers: {r.snapshot.repeatCustomers ?? "Not reported"}</p>
        <p>Retained revenue: {r.snapshot.retainedRevenueMinor !== undefined ? formatMinorMoney(r.snapshot.retainedRevenueMinor, r.snapshot.retentionCurrency) : "Not reported"}</p>
        <p>Retained contribution: {r.snapshot.retainedContributionMinor !== undefined ? formatMinorMoney(r.snapshot.retainedContributionMinor, r.snapshot.retentionCurrency) : "Not reported"}</p>
      </div>)}
      {status === "CanLoadMore" || status === "LoadingMore" ? <Button variant="secondary" disabled={status === "LoadingMore"} onClick={() => loadMore(10)}>Load older revisions</Button> : null}
    </div> : null}
  </details>;
}
