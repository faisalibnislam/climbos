"use client";

import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { ChartLine, CircleAlert, CircleCheck, ClipboardPen, Clock, type LucideIcon } from "@/components/icons"
import { useState } from "react";
import { Badge, Button, Field, Input, toast, type Tone } from "@/components/ui";
import { errorMessage } from "@/components/app/errors";
import type { PlayModel } from "../../../../shared/agents/economics";
import { costCheck, type CostCheck, type PlayActuals, type RetentionActuals } from "../../../../shared/growth/actuals";
import { formatMoney, majorToMinor, minorToMajor } from "../../../../shared/economics/currency";
import { diagnoseShortfall, type Shortfall } from "../../../../shared/growth/diagnostics";
import { cn } from "@/lib/utils";

const STATUS: Record<PlayActuals["status"], { label: string; tone: Tone; icon: LucideIcon }> = {
  ahead: { label: "Ahead of plan", tone: "green", icon: CircleCheck },
  on_track: { label: "On track", tone: "blue", icon: CircleCheck },
  behind: { label: "Behind: check stop rule", tone: "red", icon: CircleAlert },
  too_early: { label: "Too early to tell", tone: "neutral", icon: Clock },
  incomplete_log: { label: "Weekly log incomplete", tone: "neutral", icon: Clock },
};

const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;

/** Why a play is behind, checked in order (ran? measured? reach? which step?), with one next step. */
function ShortfallNote({ s }: { s: Shortfall }) {
  const failed = s.checks.find((c) => c.status === "fail");
  return (
    <div className="flex flex-col gap-1 rounded-[var(--radius-control)] bg-red-100 px-2 py-1.5 text-xs text-red-800">
      <p className="font-semibold">{s.next}</p>
      {failed ? <p>{failed.detail}</p> : null}
      {!s.moreSpendJustified ? <p className="text-red-800/80">Don&apos;t raise spend until this is fixed.</p> : null}
    </div>
  );
}
const r1 = (x: number) => (x >= 10 ? Math.round(x) : Math.round(x * 10) / 10);

/** Logged cash cost per customer against what a customer is worth (computed; owner time excluded). */
export function CostPerCustomerLine({ check: c, currency }: { check: CostCheck; currency?: string }) {
  const m = (n: number) => formatMoney(Math.round(n * 100) / 100, currency);
  if (c.status === "no_spend") return null;
  const cost = c.cashCostPerCustomerUsd === null ? "no customers logged yet" : m(c.cashCostPerCustomerUsd);
  const versus = c.affordableUsd === null ? "what a customer is worth is unknown until price, margin and churn are known" : `a customer is worth ${m(c.affordableUsd)} within the payback window`;
  return (
    <p className={cn("text-xs", c.status === "above" || c.status === "no_customers" ? "font-medium text-red-800" : "text-ink-2")}>
      Cash cost per customer: {cost} · {versus}. Logged spend ÷ new customers; your time isn&apos;t included.
    </p>
  );
}

/** Owner-reported repeat-customer outcomes stay separate from acquisition and from causal claims. */
export function RetentionResultsSummary({ retention }: { retention?: RetentionActuals }) {
  if (!retention?.weeksReported) return <p className="text-xs text-ink-3">No repeat-customer outcomes recorded yet.</p>;
  const moneyRows = (rows: { currency: string; weeksReported: number; netRevenueMinor?: number; contributionMinor?: number }[], amount: "netRevenueMinor" | "contributionMinor") => rows
    .map((row) => `${formatMoney(minorToMajor(row[amount]!, row.currency), row.currency)} · ${row.weeksReported} week${row.weeksReported === 1 ? "" : "s"}`)
    .join("; ") || "Not reported";
  return (
    <div className="rounded-[var(--radius-control)] bg-surface-2 px-2.5 py-2 text-xs text-ink-2">
      <p className="font-semibold text-ink">Existing-customer results · owner reported</p>
      <p className="mt-1">Repeat customers: {retention.repeatCustomerWeeksReported ? `${retention.repeatCustomerWeeks} customer-weeks across ${retention.repeatCustomerWeeksReported} reported week${retention.repeatCustomerWeeksReported === 1 ? "" : "s"}` : "Not reported"}</p>
      <p>Net retained revenue: {moneyRows(retention.revenueByCurrency, "netRevenueMinor")}</p>
      <p>Retained contribution: {moneyRows(retention.contributionByCurrency, "contributionMinor")}</p>
      <p className="mt-1 text-ink-3">Customer-weeks can count the same person again in a later week. These results are associated with this play; they do not prove it caused the change. Only reported weeks are included.</p>
    </div>
  );
}

/** Plan vs actual for one play, and a weekly log (spec §28). */
export function PlayResults({ slug, strategyId, playName, model, actuals, retention, currency, canEdit, affordableCacUsd = null }: { slug: string; strategyId: Id<"strategies">; playName: string; model: PlayModel; actuals?: PlayActuals; retention?: RetentionActuals; currency?: string | null; canEdit: boolean; affordableCacUsd?: number | null }) {
  const log = useMutation(api.playResults.log);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [vals, setVals] = useState<Record<string, string>>({});
  const fields = [{ key: "reach", label: "Reached" }, ...model.steps.map((s, i) => ({ key: `s${i}`, label: s.name })), { key: "spend", label: `Spent${currency ? ` (${currency})` : ""}` }, { key: "hours", label: "Your hours" }];
  const st = actuals ? STATUS[actuals.status] : null;
  const submit = async () => {
    const n = (k: string) => Number(vals[k] || 0);
    const optionalCount = vals.repeatCustomers?.trim() ? Number(vals.repeatCustomers) : undefined;
    const optionalMoney = (key: "retainedRevenue" | "retainedContribution") => {
      const value = vals[key]?.trim();
      if (!value) return undefined;
      if (!currency) throw new Error("Set the business currency before entering retention amounts.");
      const amount = Number(value);
      if (!Number.isFinite(amount)) throw new Error("Enter a valid retention amount or leave it blank.");
      return majorToMinor(amount, currency);
    };
    setBusy(true);
    try {
      const retainedRevenueMinor = optionalMoney("retainedRevenue");
      const retainedContributionMinor = optionalMoney("retainedContribution");
      await log({ slug, strategyId, playName, reach: n("reach"), steps: model.steps.map((_, i) => n(`s${i}`)), spendUsd: n("spend"), ownerHours: n("hours"), ...(optionalCount !== undefined ? { repeatCustomers: optionalCount } : {}), ...(retainedRevenueMinor !== undefined ? { retainedRevenueMinor } : {}), ...(retainedContributionMinor !== undefined ? { retainedContributionMinor } : {}) });
      setVals({});
      setOpen(false);
      toast({ tone: "success", title: "Results saved" });
    } catch (e) {
      toast({ tone: "danger", title: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-line p-3">
      <p className="text-overline flex items-center gap-1.5">
        <ChartLine aria-hidden className="size-3.5" /> Plan vs actual
      </p>
      {actuals ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-baseline gap-1.5">
              <span className="text-xl font-semibold tabular-nums text-ink">{actuals.customers}</span>
              <span className="text-ui text-ink-2">
                customer{actuals.customers === 1 ? "" : "s"} · {actuals.unloggedWeeks > 0 ? `${actuals.weeks} of ${actuals.weeksSinceStart} weeks logged` : `week ${actuals.weeks}`}
              </span>
              <span className="text-xs tabular-nums text-ink-3">plan ≈{r1(actuals.expectedByNow.p50)}</span>
            </p>
            {st ? (
              <Badge tone={st.tone} icon={<st.icon />}>
                {st.label}
              </Badge>
            ) : null}
          </div>
          {actuals.unloggedWeeks > 0 ? <p className="text-xs text-ink-2">Only logged weeks are included. Missing weeks are unknown, not zero; fill them in before judging the full period.</p> : null}
          <CostPerCustomerLine check={costCheck(actuals, affordableCacUsd)} currency={currency ?? undefined} />
          {actuals.status === "behind" ? <ShortfallNote s={diagnoseShortfall(actuals, {}, { affordableCacUsd, currency: currency ?? undefined })} /> : null}
          <ul className="flex flex-col gap-1.5 text-xs">
            {actuals.steps
              .filter((s) => s.trials > 0)
              .map((s) => {
                const rate = s.successes / s.trials;
                const max = Math.max(rate, s.planned, 0.0001) * 1.15;
                return (
                  <li key={s.name} className="flex flex-col gap-1">
                    <span className="flex justify-between gap-2 tabular-nums">
                      <span className="truncate text-ink-2">{s.name}</span>
                      <span className="shrink-0 text-ink-3">
                        <span className={cn("font-semibold", rate >= s.planned ? "text-green-800" : "text-red-800")}>{pct(rate)}</span> vs {pct(s.planned)} · {s.successes}/{s.trials}
                      </span>
                    </span>
                    <span
                      role="img"
                      aria-label={`${s.name}: ${pct(rate)} actual vs ${pct(s.planned)} planned`}
                      className="relative h-1.5 overflow-hidden rounded-full bg-surface-3"
                    >
                      <span className={cn("absolute inset-y-0 left-0 rounded-full", rate >= s.planned ? "bg-green-500" : "bg-red-500")} style={{ width: `${(rate / max) * 100}%` }} />
                      <span aria-hidden className="absolute inset-y-0 w-0.5 bg-ink" style={{ left: `${(s.planned / max) * 100}%` }} />
                    </span>
                  </li>
                );
              })}
          </ul>
        </>
      ) : (
        <p className="text-xs text-ink-3">No results yet. Log weekly to compare.</p>
      )}
      <RetentionResultsSummary retention={retention} />
      {canEdit && !open ? (
        <Button size="sm" variant="ghost" className="self-start" onClick={() => setOpen(true)}>
          <ClipboardPen aria-hidden /> Log this week
        </Button>
      ) : null}
      {open ? (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            {fields.map((f) => (
              <Field key={f.key} label={f.label}>
                <Input inputMode="decimal" value={vals[f.key] ?? ""} onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))} disabled={busy} />
              </Field>
            ))}
          </div>
          <fieldset className="flex flex-col gap-2 rounded-[var(--radius-control)] border border-line p-2.5">
            <legend className="px-1 text-xs font-semibold text-ink">Optional results from existing customers</legend>
            <p className="text-xs text-ink-3">Leave a value blank when you did not track it. Repeat customers are a weekly count, not unique people across the plan.</p>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Repeat customers this week">
                <Input inputMode="numeric" value={vals.repeatCustomers ?? ""} onChange={(e) => setVals((v) => ({ ...v, repeatCustomers: e.target.value }))} disabled={busy} />
              </Field>
              <Field label={`Net retained revenue${currency ? ` (${currency})` : ""}`} hint={currency ? "Net receipts from existing customers this week." : "Set the business currency in settings to report money."}>
                <Input inputMode="decimal" value={vals.retainedRevenue ?? ""} onChange={(e) => setVals((v) => ({ ...v, retainedRevenue: e.target.value }))} disabled={busy || !currency} />
              </Field>
              <Field label={`Retained contribution${currency ? ` (${currency})` : ""}`} hint="After variable delivery costs; negative amounts are allowed.">
                <Input inputMode="decimal" value={vals.retainedContribution ?? ""} onChange={(e) => setVals((v) => ({ ...v, retainedContribution: e.target.value }))} disabled={busy || !currency} />
              </Field>
            </div>
            <p className="text-xs text-ink-3">When correcting this week, blank optional fields clear earlier values for that week.</p>
          </fieldset>
          <div className="flex gap-2">
            <Button size="sm" onClick={submit} disabled={busy || !vals.reach}>
              {busy ? "Saving…" : "Save"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
