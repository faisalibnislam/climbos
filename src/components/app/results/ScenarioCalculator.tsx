"use client";

import { compareScenarios, simulateFunnel, type FunnelInput, type FunnelResult } from "@shared/forecasting";
import { useMemo, useState } from "react";
import { SlidersHorizontal } from "@/components/icons";
import { Callout, Field, Input, Select, Table, TableFrame, TBody, Td, Th, THead, Tr } from "@/components/ui";
import { formatNumber } from "@/lib/utils";
import { formatPercent } from "./format";
import { Definition, ValueKind } from "./Provenance";

interface ScenarioFields {
  visits: string;
  signupPct: string;
  paidPct: string;
  arpu: string;
  churnPct: string;
  lagDays: string;
}

type FieldKey = keyof ScenarioFields;

const DEFAULT_A: ScenarioFields = { visits: "10000", signupPct: "5", paidPct: "8", arpu: "25", churnPct: "3", lagDays: "14" };
const DEFAULT_B: ScenarioFields = { visits: "10000", signupPct: "6", paidPct: "8", arpu: "25", churnPct: "3", lagDays: "14" };

function num(s: string): number {
  return s.trim() === "" ? NaN : Number(s);
}

function toInput(f: ScenarioFields, horizonDays: number): { input: FunnelInput | null; errors: Partial<Record<FieldKey, string>> } {
  const errors: Partial<Record<FieldKey, string>> = {};
  const visits = num(f.visits);
  const signup = num(f.signupPct);
  const paid = num(f.paidPct);
  const arpu = num(f.arpu);
  const churn = num(f.churnPct);
  const lag = num(f.lagDays);
  if (!Number.isFinite(visits) || visits < 0) errors.visits = "Enter 0 or more.";
  else if (visits > 100_000_000) errors.visits = "Over 100 million: check it.";
  if (!Number.isFinite(signup) || signup < 0 || signup > 100) errors.signupPct = "Enter 0–100.";
  if (!Number.isFinite(paid) || paid < 0 || paid > 100) errors.paidPct = "Enter 0–100.";
  if (!Number.isFinite(arpu) || arpu < 0) errors.arpu = "Enter 0 or more.";
  if (!Number.isFinite(churn) || churn < 0 || churn >= 100) errors.churnPct = "Enter 0 to under 100.";
  if (!Number.isFinite(lag) || lag < 0 || lag > 365) errors.lagDays = "Enter 0–365.";
  if (Object.keys(errors).length) return { input: null, errors };
  return {
    input: {
      visits,
      signupRate: signup / 100,
      paidRate: paid / 100,
      arpu,
      monthlyChurn: churn / 100,
      lagDays: Math.round(lag),
      horizonDays,
    },
    errors,
  };
}

function run(f: ScenarioFields, horizonDays: number): { result: FunnelResult | null; errors: Partial<Record<FieldKey, string>> } {
  const { input, errors } = toInput(f, horizonDays);
  if (!input) return { result: null, errors };
  try {
    return { result: simulateFunnel(input), errors };
  } catch {
    return { result: null, errors: { visits: "These numbers don't work together. Check them." } };
  }
}

function ScenarioInputs({
  name,
  fields,
  errors,
  onChange,
  currency,
}: {
  name: string;
  fields: ScenarioFields;
  errors: Partial<Record<FieldKey, string>>;
  onChange: (k: FieldKey, v: string) => void;
  currency: string;
}) {
  const input = (k: FieldKey, props: { step?: string; min?: string; max?: string; suffix?: string }) => (
    <Input
      type="number"
      inputMode="decimal"
      step={props.step ?? "any"}
      min={props.min ?? "0"}
      max={props.max}
      value={fields[k]}
      onChange={(e) => onChange(k, e.target.value)}
    />
  );
  return (
    <fieldset className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5">
      <legend className="heading-card px-1">{name}</legend>
      <Field label="Visits per month" error={errors.visits}>
        {input("visits", { step: "1" })}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Visit → sign-up (%)" error={errors.signupPct}>
          {input("signupPct", { max: "100" })}
        </Field>
        <Field label="Sign-up → paid (%)" error={errors.paidPct}>
          {input("paidPct", { max: "100" })}
        </Field>
      </div>
      <Field label={`Revenue per customer / month (${currency})`} error={errors.arpu}>
        {input("arpu", {})}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Monthly churn (%)" error={errors.churnPct}>
          {input("churnPct", { max: "99.99" })}
        </Field>
        <Field label="Days to first payment" error={errors.lagDays}>
          {input("lagDays", { step: "1", max: "365" })}
        </Field>
      </div>
    </fieldset>
  );
}

function money(n: number, currency: string, signed = false): string {
  let s: string;
  try {
    s = new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: Math.abs(n) >= 1000 ? 0 : 2, signDisplay: signed ? "exceptZero" : "auto" }).format(n);
  } catch {
    s = `${signed && n > 0 ? "+" : ""}${n.toFixed(2)} ${currency}`;
  }
  return s;
}

function count(n: number, signed = false): string {
  const rounded = Math.round(n * 10) / 10;
  const s = Number.isInteger(rounded) ? formatNumber(Math.abs(rounded)) : Math.abs(rounded).toFixed(1);
  if (!signed || rounded === 0) return rounded < 0 ? `−${s}` : s;
  return `${rounded > 0 ? "+" : "−"}${s}`;
}

export function ScenarioCalculator({ currency }: { currency: string }) {
  const [a, setA] = useState<ScenarioFields>(DEFAULT_A);
  const [b, setB] = useState<ScenarioFields>(DEFAULT_B);
  const [horizon, setHorizon] = useState("90");
  const horizonDays = Number(horizon);
  const ra = useMemo(() => run(a, horizonDays), [a, horizonDays]);
  const rb = useMemo(() => run(b, horizonDays), [b, horizonDays]);
  const cmp = ra.result && rb.result ? compareScenarios(ra.result, rb.result) : null;

  const rows: { label: string; get: (r: FunnelResult) => string }[] = [
    { label: "New paying customers", get: (r) => count(r.expectedNewPayingAccounts) },
    { label: "New monthly revenue", get: (r) => money(r.newCohortMrrAtMaturation, currency) },
    { label: `Monthly revenue at day ${horizonDays} (after churn)`, get: (r) => money(r.expectedMrrAtHorizon, currency) },
  ];

  return (
    <section aria-labelledby="scenario-heading" className="flex flex-col gap-4">
      <h2 id="scenario-heading" className="heading-section flex flex-wrap items-center gap-2">
        <SlidersHorizontal aria-hidden="true" className="size-4 shrink-0 text-brand-800" /> Scenario calculator <ValueKind kind="assumption" />
      </h2>

      <div className="max-w-xs">
        <Field label="Horizon">
          <Select
            value={horizon}
            onValueChange={setHorizon}
            options={[
              { value: "30", label: "30 days" },
              { value: "90", label: "90 days" },
              { value: "180", label: "180 days" },
              { value: "365", label: "1 year" },
            ]}
          />
        </Field>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ScenarioInputs name="Scenario A" fields={a} errors={ra.errors} onChange={(k, v) => setA((s) => ({ ...s, [k]: v }))} currency={currency} />
        <ScenarioInputs name="Scenario B" fields={b} errors={rb.errors} onChange={(k, v) => setB((s) => ({ ...s, [k]: v }))} currency={currency} />
      </div>

      <div aria-live="polite" className="flex flex-col gap-3">
        <TableFrame>
          <Table>
            <caption className="heading-card px-4 pb-1 pt-3 text-left">Results ({currency})</caption>
            <THead>
              <tr>
                <Th>Result</Th>
                <Th numeric>Scenario A</Th>
                <Th numeric>Scenario B</Th>
                <Th numeric>B − A</Th>
              </tr>
            </THead>
            <TBody>
              {rows.map((row, i) => (
                <Tr key={row.label}>
                  <th scope="row" className="h-11 px-4 py-2 text-left align-middle font-medium text-ink">
                    {row.label}
                  </th>
                  <Td numeric>{ra.result ? row.get(ra.result) : "Check inputs"}</Td>
                  <Td numeric>{rb.result ? row.get(rb.result) : "Check inputs"}</Td>
                  <Td numeric className="font-medium">
                    {cmp
                      ? i === 0
                        ? count(cmp.deltaNewPayingAccounts, true)
                        : i === 1
                          ? money(cmp.deltaNewCohortMrrAtMaturation, currency, true)
                          : money(cmp.deltaExpectedMrrAtHorizon, currency, true)
                      : "—"}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableFrame>
        {cmp ? (
          <p className="text-sm text-ink-2">
            {cmp.relativeMrrChange === null
              ? "A has no new revenue, so no % change."
              : `B: ${formatPercent(Math.abs(cmp.relativeMrrChange))} ${cmp.relativeMrrChange >= 0 ? "more" : "less"} new monthly revenue than A.`}
          </p>
        ) : null}
        <Callout tone="info" title="Your assumptions, not a prediction" />
        {ra.result ? (
          <Definition summary="How this is calculated">
            <ul className="list-disc space-y-1 pl-5">
              <li>Customers = visits × sign-up % × paid %.</li>
              <li>New monthly revenue = customers × revenue per customer.</li>
              <li>At day N = new monthly revenue × (1 − churn) per month after conversion.</li>
              <li>All visits convert as one group after the set days.</li>
            </ul>
          </Definition>
        ) : null}
      </div>
    </section>
  );
}
