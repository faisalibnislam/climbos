"use client";

import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { useId, useState } from "react";
import { Button, Callout, Input, toast } from "@/components/ui";
import { errorMessage } from "@/components/app/errors";
import { formatMoney } from "../../../../shared/economics/currency";
import type { GrowthCashScenario, GrowthCashTiming } from "../../../../shared/agents/economics";

export type GrowthCashTimingView = GrowthCashTiming & { selected: string[]; currency: string; reserveCurrencyMismatch: boolean; ownerInputsUpdatedAt: number | null };

const MISSING_LABEL: Record<GrowthCashTiming["missing"][number], string> = {
  payment_lag: "how many days a new customer takes to pay",
  customer_value: "revenue per customer and margin",
  churn: "how many customers you lose each month",
  reserve: "the cash you have set aside for growth",
};

const money = (n: number, currency: string) => formatMoney(Math.round(n * 100) / 100, currency);

function Scenario({ title, s, currency, hasReserve }: { title: string; s: GrowthCashScenario; currency: string; hasReserve: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-[var(--radius-card)] border border-line bg-surface p-3">
      <h4 className="text-xs font-medium text-ink-3">{title}</h4>
      <p className="text-ui font-semibold tabular-nums text-ink">{s.lowestWeek === 0 ? "Never below zero" : `Lowest point ${money(s.lowestBalanceUsd, currency)} in week ${s.lowestWeek}`}</p>
      <p className="text-xs text-ink-3">
        {s.lowestWeek === 0 ? "Customer income keeps up with costs." : s.recoveredWeek !== null ? `Back to zero by week ${s.recoveredWeek}.` : "Not back to zero within this period."}
        {` Ends at ${money(s.endBalanceUsd, currency)}.`}
      </p>
      {s.lowestWeek !== 0 ? (
        <p className="text-xs font-medium text-ink-2">
          {!hasReserve ? "Add your growth reserve below to compare." : s.reserveCovers ? "Your reserve covers this." : `Your reserve is short by ${money(s.shortfallUsd ?? 0, currency)}.`}
        </p>
      ) : null}
    </div>
  );
}

/** When the selected plays' cash goes out and modeled customer contribution comes back (computed in code, owner inputs labelled). */
export function GrowthCashTimingPanel({ data, slug, canEdit }: { data: GrowthCashTimingView; slug: string; canEdit: boolean }) {
  const save = useMutation(api.workspace.setGrowthCashTiming);
  const [reserve, setReserve] = useState("");
  const [lag, setLag] = useState("");
  const [busy, setBusy] = useState(false);
  const id = useId();
  const c = data.currency;
  const untimed = data.missing.filter((m) => m !== "reserve");
  const submit = async (clear = false) => {
    const args: { reserve?: number | null; paymentLagDays?: number | null } = {};
    if (clear) Object.assign(args, { reserve: null, paymentLagDays: null });
    else {
      if (reserve.trim()) {
        const n = Number(reserve.replace(/,/g, ""));
        if (!Number.isFinite(n) || n < 0) return toast({ tone: "danger", title: "Check the growth cash reserve." });
        args.reserve = n;
      }
      if (lag.trim()) {
        const n = Number(lag);
        if (!Number.isInteger(n) || n < 0 || n > 365) return toast({ tone: "danger", title: "Payment delay must be 0–365 whole days." });
        args.paymentLagDays = n;
      }
      if (args.reserve === undefined && args.paymentLagDays === undefined) return;
    }
    setBusy(true);
    try {
      await save({ slug, ...args });
      setReserve("");
      setLag("");
      toast({ tone: "success", title: clear ? "Cash timing inputs cleared" : "Cash timing updated" });
    } catch (e) {
      toast({ tone: "danger", title: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <section aria-label="Growth cash timing" className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-surface-2 p-3">
      <div>
        <h3 className="text-sm font-semibold text-ink">When growth cash goes out and comes back</h3>
        <p className="mt-1 text-xs text-ink-3">
          For {data.selected.join(" + ")} over {data.horizonWeeks} weeks. Costs start in week 1; customer income (revenue × margin) starts after your payment delay.
        </p>
      </div>
      <dl className="grid gap-2 text-sm sm:grid-cols-3">
        <div><dt className="text-xs text-ink-3">Growth cash out</dt><dd className="font-semibold tabular-nums text-ink">{money(data.weeklyCashOutUsd, c)}/week{data.setupCashUsd > 0 ? ` + ${money(data.setupCashUsd, c)} setup` : ""} · {money(data.cashOutOverPeriodUsd, c)} total</dd></div>
        <div><dt className="text-xs text-ink-3">Growth reserve</dt><dd className="font-semibold tabular-nums text-ink">{data.reserveUsd === null ? "Unknown · not assumed" : `${money(data.reserveUsd, c)} · you reported`}</dd></div>
        <div><dt className="text-xs text-ink-3">Days until a new customer pays</dt><dd className="font-semibold tabular-nums text-ink">{data.paymentLagDays === null ? "Unknown · not assumed" : `${data.paymentLagDays} days · you reported`}</dd></div>
      </dl>
      {data.reserveCurrencyMismatch ? <Callout tone="warning" title="Saved reserve is in another currency">It isn&apos;t converted. Enter it again in {c}.</Callout> : null}
      {data.mostLikely && data.lowCase ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <Scenario title="At the most-likely rates" s={data.mostLikely} currency={c} hasReserve={data.reserveUsd !== null} />
          <Scenario title="If customers come in at the low end (P10)" s={data.lowCase} currency={c} hasReserve={data.reserveUsd !== null} />
        </div>
      ) : (
        <Callout tone="info" title="Customer payments aren't timed yet">
          Needs {untimed.map((m) => MISSING_LABEL[m]).join(", ")}. Costs before anyone pays: {money(data.cashOutOverPeriodUsd, c)}.
        </Callout>
      )}
      {data.unconfirmedEconomics.length && data.mostLikely ? <p className="text-xs text-ink-3">Uses {data.unconfirmedEconomics.join(", ")} you haven&apos;t confirmed. Confirm under Sharpen this plan.</p> : null}
      <p className="text-xs text-ink-3">An estimate of growth costs only — not a bank balance or cash-flow forecast. Leaves out refunds, taxes, and existing bills.</p>
      {canEdit ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-ink" htmlFor={`${id}-reserve`}>
            Cash set aside for growth ({c})
            <Input id={`${id}-reserve`} inputMode="decimal" placeholder={data.reserveUsd === null ? "Unknown" : String(Math.round(data.reserveUsd * 100) / 100)} value={reserve} onChange={(e) => setReserve(e.target.value)} disabled={busy} className="w-44" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-ink" htmlFor={`${id}-lag`}>
            Days until a new customer pays
            <Input id={`${id}-lag`} inputMode="numeric" placeholder={data.paymentLagDays === null ? "Unknown" : String(data.paymentLagDays)} value={lag} onChange={(e) => setLag(e.target.value)} disabled={busy} className="w-44" />
          </label>
          <Button size="sm" onClick={() => submit()} disabled={busy || (!reserve.trim() && !lag.trim())}>{busy ? "Saving…" : "Update"}</Button>
          {data.ownerInputsUpdatedAt !== null ? <Button size="sm" variant="ghost" onClick={() => submit(true)} disabled={busy}>Clear saved values</Button> : null}
        </div>
      ) : null}
    </section>
  );
}
