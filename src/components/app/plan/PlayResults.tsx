"use client";

import type { Id } from "@convex/_generated/dataModel";
import { ChartLine, CircleAlert, CircleCheck, ClipboardPen, Clock, type LucideIcon } from "@/components/icons"
import { useState } from "react";
import { Badge, Button, type Tone } from "@/components/ui";
import type { PlayModel } from "../../../../shared/agents/economics";
import { costCheck, type CostCheck, type PlayActuals, type RetentionActuals } from "../../../../shared/growth/actuals";
import { formatMinorMoney, majorToMinor } from "../../../../shared/economics/currency";
import { diagnoseShortfall, needsShortfallReview, type Shortfall } from "../../../../shared/growth/diagnostics";
import { WeeklyReportEditor } from "./WeeklyReportEditor";
import { cn } from "@/lib/utils";

const STATUS: Record<PlayActuals["status"], { label: string; tone: Tone; icon: LucideIcon }> = {
  above_scenario: { label: "Above scenario range", tone: "blue", icon: CircleCheck },
  within_scenario: { label: "Within scenario range", tone: "blue", icon: CircleCheck },
  below_scenario: { label: "Below scenario range", tone: "neutral", icon: CircleAlert },
  too_early: { label: "Too early to tell", tone: "neutral", icon: Clock },
  incomplete_log: { label: "Weekly log incomplete", tone: "neutral", icon: Clock },
  partial_week: { label: "Current week still open", tone: "neutral", icon: Clock },
  forecast_unknown: { label: "Plan comparison unavailable", tone: "neutral", icon: Clock },
};

const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;

/** Why a play is behind, checked in order (ran? measured? reach? which step?), with one next step. */
function ShortfallNote({ s }: { s: Shortfall }) {
  const failed = s.checks.find((c) => c.status === "fail") ?? s.checks.find(c => c.status === "unknown");
  return (
    <div className="flex flex-col gap-1 rounded-[var(--radius-control)] bg-surface-2 px-2 py-1.5 text-xs text-ink-2">
      <p className="font-semibold">Next check: {s.next}</p>
      {failed ? <p>{failed.detail}</p> : null}
      {!s.moreSpendJustified ? <p>These observations do not justify increasing spend yet.</p> : null}
    </div>
  );
}
const r1 = (x: number) => (x >= 10 ? Math.round(x) : Math.round(x * 10) / 10);

/** Logged cash cost per customer against what a customer is worth (computed; owner time excluded). */
export function CostPerCustomerLine({ check: c, currency }: { check: CostCheck; currency?: string }) {
  const m = (n: number) => formatMinorMoney(majorToMinor(n, currency), currency);
  if (c.status === "no_spend") return null;
  if (c.status === "spend_unknown") return <p className="text-xs text-ink-2">Cash cost per customer is unavailable until the original spending and currency are confirmed.</p>;
  const cost = c.cashCostPerCustomerUsd === null ? "no customers logged yet" : m(c.cashCostPerCustomerUsd);
  const versus = c.affordableUsd === null ? "what a customer is worth is unknown until price, margin and churn are known" : `a customer is worth ${m(c.affordableUsd)} within the payback window`;
  return (
    <p className={cn("text-xs", c.status === "above" || c.status === "no_customers" ? "font-medium text-red-800" : "text-ink-2")}>
      Cash cost per customer: {cost} · {versus}; your time isn&apos;t included.
    </p>
  );
}

/** Owner-reported repeat-customer outcomes stay separate from acquisition and from causal claims. */
export function RetentionResultsSummary({ retention }: { retention?: RetentionActuals }) {
  if (!retention?.weeksReported) return <p className="text-xs text-ink-3">No repeat-customer outcomes recorded yet.</p>;
  const moneyRows = (rows: { currency: string; weeksReported: number; netRevenueMinor?: number; contributionMinor?: number }[], amount: "netRevenueMinor" | "contributionMinor") => rows
    .map((row) => `${formatMinorMoney(row[amount]!, row.currency)} · ${row.weeksReported} week${row.weeksReported === 1 ? "" : "s"}`)
    .join("; ") || "Not reported";
  return (
    <div className="rounded-[var(--radius-control)] bg-surface-2 px-2.5 py-2 text-xs text-ink-2">
      <p className="font-semibold text-ink">Existing-customer results · owner reported</p>
      <p className="mt-1">Repeat customers: {retention.repeatCustomerWeeksReported ? `${retention.repeatCustomerWeeks} customer-weeks across ${retention.repeatCustomerWeeksReported} reported week${retention.repeatCustomerWeeksReported === 1 ? "" : "s"}` : "Not reported"}</p>
      <p>Net retained revenue: {moneyRows(retention.revenueByCurrency, "netRevenueMinor")}</p>
      <p>Retained contribution: {moneyRows(retention.contributionByCurrency, "contributionMinor")}</p>
      <p className="mt-1 text-ink-3">Linked to this play, but they do not prove it caused the change. Only reported weeks count.</p>
    </div>
  );
}

/** Plan vs actual for one play, and a weekly log (spec §28). */
export function PlayResults({ slug, strategyId, playName, model, actuals, retention, currency, issue, canEdit, stopRule, affordableCacUsd = null }: { slug: string; strategyId: Id<"strategies">; playName: string; model: PlayModel; actuals?: PlayActuals; issue?: string; retention?: RetentionActuals; currency?: string | null; canEdit: boolean; stopRule?: string; affordableCacUsd?: number | null }) {
  const [open, setOpen] = useState(false);
  const st = actuals ? STATUS[actuals.status] : null;
  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-line p-3">
      <p className="text-overline flex items-center gap-1.5">
        <ChartLine aria-hidden className="size-3.5" /> Plan vs actual
      </p>
      {issue ? <p role="alert" className="text-xs text-ink-2">Weekly summary unavailable. {issue}</p> : actuals && actuals.weeks > 0 ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-baseline gap-1.5">
              <span className="text-xl font-semibold tabular-nums text-ink">{actuals.customers}</span>
              <span className="text-ui text-ink-2">
                customer{actuals.customers === 1 ? "" : "s"} · {actuals.unloggedWeeks > 0 ? `${actuals.weeks} of ${actuals.weeksSinceStart} weeks logged` : `week ${actuals.weeks}`}
              </span>
              {actuals.expectedByNow ? <span className="text-xs tabular-nums text-ink-3">reference ≈{r1(actuals.expectedByNow.p50)}</span> : null}
            </p>
            {st ? (
              <Badge tone={st.tone} icon={<st.icon />}>
                {st.label}
              </Badge>
            ) : null}
          </div>
          {(actuals.unloggedWeeks > 0 || actuals.currentWeekIncluded) ? <p className="text-xs text-ink-3">Counts and cash cost cover only recorded weeks, including any provisional current-week report; they are not complete-period results.</p> : null}
          {actuals.comparisonNote ? <p className="text-xs text-ink-3">{actuals.comparisonNote}</p> : null}
          <CostPerCustomerLine check={costCheck(actuals, affordableCacUsd)} currency={currency ?? undefined} />
          {actuals.spendIssue ? <p className="text-xs text-ink-2">{actuals.spendIssue}</p> : null}
          {needsShortfallReview(actuals) ? <ShortfallNote s={diagnoseShortfall(actuals, { killIf: stopRule }, { affordableCacUsd, currency: currency ?? undefined })} /> : null}
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
      {actuals?.unloggedWeeks ? <p className="text-xs text-ink-2">{actuals.unloggedWeeks} reporting week{actuals.unloggedWeeks === 1 ? " is" : "s are"} missing. Missing weeks are unknown, not zero. Fill them in before judging.</p> : null}
      {actuals?.throughWeek !== undefined ? <p className="text-xs text-ink-3">UTC reporting window through week beginning {new Date(actuals.throughWeek).toISOString().slice(0, 10)}. {actuals.currentWeekIncluded ? "The current week is provisional." : "The current open week is excluded until reported."}</p> : null}
      {!!actuals?.weeks && actuals.comparisonIssue ? <p className="text-xs text-ink-2">{actuals.comparisonIssue}</p> : null}
      {!issue ? <RetentionResultsSummary retention={retention} /> : null}
      {!open ? (
        <Button size="sm" variant="ghost" className="self-start" onClick={() => setOpen(true)}>
          <ClipboardPen aria-hidden /> {canEdit ? "Log this week" : "Review weekly reports"}
        </Button>
      ) : <WeeklyReportEditor slug={slug} strategyId={strategyId} playName={playName} model={model} canEdit={canEdit} onClose={() => setOpen(false)} />}
    </div>
  );
}
