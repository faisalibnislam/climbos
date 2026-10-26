"use client";

import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useState } from "react";
import { Check } from "@/components/icons";
import { Button, Input, toast } from "@/components/ui";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/components/app/errors";
import type { OwnerEconomics } from "../../../../shared/agents/economics";
import { GeneratePlanButton } from "./PlanActions";

type Unsure = "revenue" | "margin" | "churn";
type Funnel = { periodDays: number; visitors?: number; leads?: number; activated?: number; newCustomers?: number };

const MONEY: { key: Unsure; field: "revenuePerCustomerMonthUsd" | "grossMargin" | "monthlyChurn"; question: string; help: string; suffix: (currency: string) => string; toInput: (v: number) => string; fromInput: (s: string) => number; ok: (n: number) => boolean }[] = [
  { key: "revenue", field: "revenuePerCustomerMonthUsd", question: "How much does one customer pay you in a typical month?", help: "If people buy once, use a typical order.", suffix: (c) => `${c} / month`, toInput: (v) => String(Math.round(v * 100) / 100), fromInput: Number, ok: (n) => n > 0 && n <= 1_000_000 },
  { key: "margin", field: "grossMargin", question: "Of that, roughly what share do you keep after the cost of delivering it?", help: "Your profit share before rent and salaries.", suffix: () => "%", toInput: (v) => String(Math.round(v * 100)), fromInput: (s) => Number(s) / 100, ok: (n) => n > 0 && n <= 1 },
  { key: "churn", field: "monthlyChurn", question: "Out of 100 customers, about how many stop buying each month?", help: "Enter 0 to 95.", suffix: () => "of 100", toInput: (v) => String(Math.round(v * 1000) / 10), fromInput: (s) => Number(s) / 100, ok: (n) => n >= 0.001 && n <= 0.95 },
];

const FUNNEL: { key: "visitors" | "leads" | "activated" | "newCustomers"; label: string }[] = [
  { key: "visitors", label: "People who visited" },
  { key: "leads", label: "Signed up or asked" },
  { key: "activated", label: "Tried it or got first value" },
  { key: "newCustomers", label: "Became paying customers" },
];

/**
 * Every number ClimbOS can use to sharpen a plan, asked in plain words in one place. "Not sure" never invents
 * a figure: the plan uses a clearly labelled assumption instead. Saving offers a refresh; it never starts one.
 */
export function HelpClimbOS({
  slug,
  canEdit,
  currency,
  unitEconomics,
  funnel,
  unknowns = [],
  needed,
  refresh,
  noCustomersYet = false,
  customerData = null,
}: {
  slug: string;
  canEdit: boolean;
  currency: string;
  unitEconomics: OwnerEconomics | null;
  funnel: Funnel | null;
  unknowns?: string[];
  /** This plan can't go ahead until the customer numbers are answered (or marked "not sure"). */
  needed: boolean;
  refresh: { nextVersion: number; estimateMicros: number; onStarted: (runId: Id<"workflowRuns">) => void; building: boolean } | null;
  /** No customers yet (just launched or not launched): only a planned price is asked. */
  noCustomersYet?: boolean;
  customerData?: { status: "no_customers_yet" | "no_data_yet"; plannedPriceMonth?: number; priceUndecided?: boolean } | null;
}) {
  if (noCustomersYet) return <NewBusinessNumbers slug={slug} canEdit={canEdit} currency={currency} customerData={customerData} refresh={refresh} needed={needed} />;
  return <CustomerNumbers {...{ slug, canEdit, currency, unitEconomics, funnel, unknowns, needed, refresh, customerData }} />;
}

/** A plan refresh offer shown once new answers are saved; it never starts on its own. */
function RefreshOffer({ slug, refresh }: { slug: string; refresh: NonNullable<Parameters<typeof HelpClimbOS>[0]["refresh"]> }) {
  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-control)] bg-brand-50 p-3">
      <p className="text-sm font-medium text-ink">Saved. Refresh the plan to use this.</p>
      <GeneratePlanButton slug={slug} mode="refresh" nextVersion={refresh.nextVersion} estimateMicros={refresh.estimateMicros} onStarted={refresh.onStarted} building={refresh.building} />
    </div>
  );
}

/** Brand-new businesses: no customer figures exist, so only the planned price is asked (or "not decided yet"). */
function NewBusinessNumbers({ slug, canEdit, currency, customerData, refresh, needed }: { slug: string; canEdit: boolean; currency: string; customerData: Parameters<typeof HelpClimbOS>[0]["customerData"]; refresh: Parameters<typeof HelpClimbOS>[0]["refresh"]; needed: boolean }) {
  const setCustomerData = useMutation(api.workspace.setCustomerData);
  const [price, setPrice] = useState(customerData?.plannedPriceMonth !== undefined ? String(customerData.plannedPriceMonth) : "");
  const [undecided, setUndecided] = useState(Boolean(customerData?.priceUndecided));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const save = async (status: "no_customers_yet" | null) => {
    const n = Number(price.replace(/,/g, ""));
    if (status && !undecided && price.trim() && !(Number.isFinite(n) && n > 0)) return toast({ tone: "danger", title: "Check the planned price." });
    setBusy(true);
    try {
      await setCustomerData(status === null ? { slug, status: null } : { slug, status, ...(undecided || !price.trim() ? { plannedPriceMonth: null, priceUndecided: undecided } : { plannedPriceMonth: n }) });
      setSaved(true);
      toast({ tone: "success", title: status === null ? "Got it: you have customers" : "Saved" });
    } catch (e) {
      toast({ tone: "danger", title: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <section aria-labelledby="help-climbos-heading" className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-[var(--card-p)]">
      <div>
        <h3 id="help-climbos-heading" className="heading-card">No customers yet, so ClimbOS only needs your planned price</h3>
        <p className="mt-1 text-sm text-ink-3">
          A new business has no customer revenue, margin or churn to report, so ClimbOS won&apos;t ask for them. It uses clearly labelled estimates and focuses the plan on getting your first customers.{needed ? " Save, then refresh the plan." : ""}
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="flex flex-col gap-1">
          <span className="text-ui font-medium text-ink">What do you plan to charge each customer per month?</span>
          <span className="text-xs text-ink-3">If people will buy once, use a typical order. You can change it later.</span>
          <span className="flex items-center gap-2">
            <Input inputMode="decimal" className="max-w-40" value={price} disabled={undecided || !canEdit || busy} onChange={(e) => setPrice(e.target.value)} />
            <span className="text-xs text-ink-3">{currency} / month</span>
          </span>
        </label>
        <button
          type="button"
          aria-pressed={undecided}
          disabled={!canEdit || busy}
          onClick={() => setUndecided((u) => !u)}
          className={cn("inline-flex h-8 items-center gap-1 rounded-full border px-3 text-xs transition-colors", undecided ? "border-brand-800 bg-brand-50 text-ink" : "border-line-strong text-ink-2 hover:border-ink-3")}
        >
          {undecided ? <Check className="size-3.5" aria-hidden /> : null}
          Not decided yet
        </button>
      </div>
      {canEdit ? (
        saved && refresh ? <RefreshOffer slug={slug} refresh={refresh} /> : (
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => save("no_customers_yet")} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
            {customerData?.status === "no_customers_yet" ? (
              <Button variant="ghost" onClick={() => save(null)} disabled={busy}>We have customers now</Button>
            ) : null}
          </div>
        )
      ) : null}
    </section>
  );
}

function CustomerNumbers({
  slug,
  canEdit,
  currency,
  unitEconomics,
  funnel,
  unknowns = [],
  needed,
  refresh,
  customerData,
}: {
  slug: string;
  canEdit: boolean;
  currency: string;
  unitEconomics: OwnerEconomics | null;
  funnel: Funnel | null;
  unknowns?: string[];
  needed: boolean;
  refresh: Parameters<typeof HelpClimbOS>[0]["refresh"];
  customerData?: Parameters<typeof HelpClimbOS>[0]["customerData"];
}) {
  const setCustomerData = useMutation(api.workspace.setCustomerData);
  const saveEconomics = useMutation(api.workspace.setUnitEconomics);
  const saveFunnel = useMutation(api.workspace.setFunnel);
  const [money, setMoney] = useState<Record<string, string>>(() => Object.fromEntries(MONEY.map((m) => [m.key, unitEconomics?.[m.field] !== undefined ? m.toInput(unitEconomics[m.field]!) : ""])));
  const [unsure, setUnsure] = useState<Set<Unsure>>(() => new Set(unitEconomics?.unsure ?? []));
  const [hours, setHours] = useState(unitEconomics?.ownerHoursPerWeek !== undefined ? String(unitEconomics.ownerHoursPerWeek) : "");
  const [counts, setCounts] = useState<Record<string, string>>(() => Object.fromEntries(FUNNEL.map((f) => [f.key, funnel?.[f.key] !== undefined ? String(funnel[f.key]) : ""])));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const askHours = unknowns.some((u) => /hours/i.test(u)) || unitEconomics?.ownerHoursPerWeek !== undefined;
  const noEmailList = unknowns.some((u) => /email/i.test(u));
  const answered = MONEY.filter((m) => money[m.key]?.trim() || unsure.has(m.key)).length;

  const toggleUnsure = (k: Unsure) =>
    setUnsure((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else {
        next.add(k);
        setMoney((m) => ({ ...m, [k]: "" }));
      }
      return next;
    });

  const submit = async () => {
    const econ: Record<string, number> = {};
    for (const m of MONEY) {
      const t = money[m.key]?.trim().replace(/,/g, "");
      if (!t || unsure.has(m.key)) continue;
      const n = m.fromInput(t);
      if (!Number.isFinite(n) || !m.ok(n)) return toast({ tone: "danger", title: `Check: ${m.question}` });
      econ[m.field] = n;
    }
    if (hours.trim()) {
      const h = Number(hours);
      if (!Number.isFinite(h) || h < 0 || h > 80) return toast({ tone: "danger", title: "Hours a week should be 0 to 80." });
      econ.ownerHoursPerWeek = h;
    }
    const funnelArgs: Record<string, number> = {};
    for (const f of FUNNEL) {
      const t = counts[f.key]?.trim().replace(/,/g, "");
      if (!t) continue;
      const n = Number(t);
      if (!Number.isInteger(n) || n < 0) return toast({ tone: "danger", title: `Use a whole number for "${f.label}".` });
      funnelArgs[f.key] = n;
    }
    const unsureList = [...unsure];
    if (!Object.keys(econ).length && !unsureList.length && !Object.keys(funnelArgs).length) return toast({ tone: "info", title: "Nothing to save yet." });
    setBusy(true);
    try {
      if (Object.keys(econ).length || unsureList.length) await saveEconomics({ slug, ...econ, ...(unsureList.length ? { unsure: unsureList } : {}) });
      if (Object.keys(funnelArgs).length) await saveFunnel({ slug, periodDays: 30, ...funnelArgs });
      setSaved(true);
      toast({ tone: "success", title: "Saved" });
    } catch (e) {
      toast({ tone: "danger", title: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="help-climbos-heading" className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-[var(--card-p)]">
      <div>
        <h3 id="help-climbos-heading" className="heading-card">{needed ? "ClimbOS needs 3 numbers to check this plan" : "Help ClimbOS with a few numbers"}</h3>
        <p className="mt-1 text-sm text-ink-3">
          {needed
            ? "Without them it can't tell whether a play makes or loses money. Rough answers are fine. Not sure? Tap it and ClimbOS uses a cautious estimate it labels as an estimate."
            : "All optional. Each one makes the plan's numbers more accurate. Not sure? Tap it and ClimbOS labels its estimate."}
        </p>
      </div>

      {canEdit && !saved ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label="If you can't answer these">
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await setCustomerData({ slug, status: "no_customers_yet" });
                toast({ tone: "success", title: "Got it: no customers yet" });
              } catch (e) {
                toast({ tone: "danger", title: errorMessage(e) });
              } finally {
                setBusy(false);
              }
            }}
          >
            We&apos;ve just launched, no customers yet
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await setCustomerData({ slug, status: "no_data_yet" });
                setUnsure(new Set(["revenue", "margin", "churn"]));
                setMoney({ revenue: "", margin: "", churn: "" });
                setSaved(true);
                toast({ tone: "success", title: "Saved: ClimbOS will use labelled estimates" });
              } catch (e) {
                toast({ tone: "danger", title: errorMessage(e) });
              } finally {
                setBusy(false);
              }
            }}
          >
            I don&apos;t have this data yet
          </Button>
        </div>
      ) : null}
      {customerData?.status === "no_data_yet" ? (
        <p className="text-xs text-ink-3">You said you don&apos;t have these numbers yet, so the plan uses labelled estimates. Connecting your billing (for example Stripe) or analytics later lets ClimbOS measure them for you.</p>
      ) : null}

      <fieldset className="flex flex-col gap-3" disabled={!canEdit || busy}>
        <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-3">What one customer is worth{needed ? ` · ${answered} of 3 answered` : ""}</legend>
        {MONEY.map((m) => {
          const isUnsure = unsure.has(m.key);
          return (
            <div key={m.key} className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
              <label className="flex flex-col gap-1">
                <span className="text-ui font-medium text-ink">{m.question}</span>
                <span className="text-xs text-ink-3">{m.help}</span>
                <span className="flex items-center gap-2">
                  <Input inputMode="decimal" className="max-w-40" value={money[m.key] ?? ""} placeholder={isUnsure ? "Estimate" : ""} disabled={isUnsure || !canEdit || busy} onChange={(e) => setMoney((v) => ({ ...v, [m.key]: e.target.value }))} />
                  <span className="text-xs text-ink-3">{m.suffix(currency)}</span>
                </span>
              </label>
              <button
                type="button"
                aria-pressed={isUnsure}
                onClick={() => toggleUnsure(m.key)}
                className={cn("inline-flex h-8 items-center gap-1 rounded-full border px-3 text-xs transition-colors", isUnsure ? "border-brand-800 bg-brand-50 text-ink" : "border-line-strong text-ink-2 hover:border-ink-3")}
              >
                {isUnsure ? <Check className="size-3.5" aria-hidden /> : null}
                Not sure, estimate it
              </button>
            </div>
          );
        })}
      </fieldset>

      {askHours ? (
        <label className="flex flex-col gap-1">
          <span className="text-ui font-medium text-ink">How many hours a week can you give to growth work?</span>
          <span className="text-xs text-ink-3">Keeps the plan to work you actually have time for.</span>
          <span className="flex items-center gap-2">
            <Input inputMode="decimal" className="max-w-40" value={hours} disabled={!canEdit || busy} onChange={(e) => setHours(e.target.value)} />
            <span className="text-xs text-ink-3">hours / week</span>
          </span>
        </label>
      ) : null}

      <details className="rounded-[var(--radius-control)] border border-line px-3 py-2" open={!needed && Boolean(funnel)}>
        <summary className="cursor-pointer text-ui font-medium text-ink">Optional: your last 30 days</summary>
        <p className="mt-2 text-xs text-ink-3">Counts from the last month. ClimbOS compares each step with the one before to find where most people drop off, and aims the plan at that step.</p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {FUNNEL.map((f) => (
            <label key={f.key} className="flex flex-col gap-1">
              <span className="text-xs font-medium text-ink">{f.label}</span>
              <Input inputMode="numeric" value={counts[f.key] ?? ""} placeholder="Unknown" disabled={!canEdit || busy} onChange={(e) => setCounts((c) => ({ ...c, [f.key]: e.target.value }))} />
            </label>
          ))}
        </div>
      </details>

      {noEmailList ? <p className="text-xs text-ink-3">No email list in ClimbOS yet, so the plan won&apos;t rely on email. Add contacts under Customers whenever you&apos;re ready.</p> : null}

      {canEdit ? (
        saved && refresh ? <RefreshOffer slug={slug} refresh={refresh} /> : (
          <div>
            <Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Save numbers"}</Button>
          </div>
        )
      ) : null}
    </section>
  );
}
