"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, DatePicker, Field, Input, Select, toast } from "@/components/ui";
import { errorMessage } from "@/components/app/errors";

type MeasureType = "count" | "rate" | "currency" | "duration";

const dateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

function localMidnight(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).getTime();
}

function dateAfter(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day + 1).getTime();
}

export function RunOutcomeReport({ slug, runId }: { slug: string; runId: Id<"workflowRuns"> }) {
  const me = useQuery(api.orgs.me, {});
  const reports = useQuery(api.workspace.builtInAgentRunOutcomes, { slug, runId });
  const saveReport = useMutation(api.workspace.reportBuiltInAgentOutcome);
  const [metric, setMetric] = useState("");
  const [measureType, setMeasureType] = useState<MeasureType>("count");
  const [value, setValue] = useState("");
  const [denominator, setDenominator] = useState("");
  const [unit, setUnit] = useState("");
  const [cohort, setCohort] = useState("");
  const [periodStart, setPeriodStart] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 15);
    return dateInputValue(date);
  });
  const [periodEnd, setPeriodEnd] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return dateInputValue(date);
  });
  const [comparisonValue, setComparisonValue] = useState("");
  const [comparisonDenominator, setComparisonDenominator] = useState("");
  const [comparisonLabel, setComparisonLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [now] = useState(() => Date.now());
  const [latestCompletedDate] = useState(() => dateInputValue(new Date(Date.now() - 86_400_000)));

  if (reports === undefined || me === undefined) return null;
  const role = me?.orgs.find((org) => org.slug === slug)?.role;
  const canReport = role === "owner" || role === "admin" || role === "editor";
  const numericValue = Number(value);
  const numericDenominator = Number(denominator);
  const numericComparison = Number(comparisonValue);
  const numericComparisonDenominator = Number(comparisonDenominator);
  const hasComparison = comparisonValue.trim() !== "";
  const periodValid = Boolean(periodStart && periodEnd && periodStart <= periodEnd && localMidnight(periodStart) < dateAfter(periodEnd) && localMidnight(periodStart) < now && dateAfter(periodEnd) <= now && dateAfter(periodEnd) - localMidnight(periodStart) <= 366 * 86_400_000);
  const rateValid = measureType !== "rate" || (numericValue >= 0 && numericValue <= 100 && Number.isSafeInteger(numericDenominator) && numericDenominator > 0);
  const comparisonValid = !hasComparison || (Number.isFinite(numericComparison) && (measureType === "currency" || numericComparison >= 0) && (measureType !== "count" || Number.isSafeInteger(numericComparison)) && (measureType !== "rate" || (numericComparison <= 100 && Number.isSafeInteger(numericComparisonDenominator) && numericComparisonDenominator > 0)) && comparisonLabel.trim().length > 0);
  const validValue = value.trim() !== "" && Number.isFinite(numericValue) && (measureType === "currency" || numericValue >= 0) && (measureType !== "count" || Number.isSafeInteger(numericValue)) && rateValid;
  const needsUnit = measureType !== "rate";
  const canSave = Boolean(metric.trim() && cohort.trim() && validValue && (!needsUnit || unit.trim()) && periodValid && comparisonValid && !busy && canReport);

  async function save() {
    if (!canSave) return;
    setBusy(true);
    try {
      await saveReport({
        slug,
        runId,
        metric: metric.trim(),
        measureType,
        unit: measureType === "rate" ? "%" : unit.trim(),
        value: measureType === "rate" ? numericValue / 100 : numericValue,
        ...(measureType === "rate" ? { denominator: numericDenominator } : {}),
        ...(hasComparison ? {
          comparisonValue: measureType === "rate" ? numericComparison / 100 : numericComparison,
          ...(measureType === "rate" ? { comparisonDenominator: numericComparisonDenominator } : {}),
          comparisonLabel: comparisonLabel.trim(),
        } : {}),
        cohort: cohort.trim(),
        periodStart: localMidnight(periodStart),
        periodEnd: dateAfter(periodEnd),
      });
      toast({ tone: "success", title: "Outcome report saved", description: "Saved as your report for this specialist run." });
      setValue("");
      setDenominator("");
      setComparisonValue("");
      setComparisonDenominator("");
      setComparisonLabel("");
    } catch (error) {
      toast({ tone: "danger", title: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">What happened after this work?</CardTitle>
        <CardDescription>Optionally record a result you observed. This is your report; it does not prove this work caused the result.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {reports.length ? (
          <ul className="flex flex-col gap-2" aria-label="Your reported outcomes">
            {reports.map((report) => (
              <li key={`${report.metric}-${report.updatedAt}`} className="rounded-md bg-surface-2 p-3 text-sm">
                <p className="font-medium text-ink">{report.metric}: {report.measureType === "rate" ? `${(report.value * 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%${report.denominator ? ` (${report.denominator} counted)` : ""}` : `${report.value.toLocaleString()} ${report.unit}`}</p>
                <p className="mt-1 text-ink-2">{report.cohort} · {new Date(report.periodStart).toLocaleDateString()}–{new Date(report.periodEnd - 1).toLocaleDateString()} · Reported by you</p>
                {report.comparisonValue !== undefined ? <p className="mt-1 text-ink-2">Compared with {report.comparisonLabel}: {report.measureType === "rate" ? `${(report.comparisonValue * 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%${report.comparisonDenominator ? ` (${report.comparisonDenominator} counted)` : ""}` : `${report.comparisonValue.toLocaleString()} ${report.unit}`}</p> : null}
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-ink-2">No outcome has been reported for this run. It is fine to leave this blank when the result is unknown or was not measured.</p>}

        {canReport ? (
          <details className="group">
            <summary className="cursor-pointer text-sm font-medium text-brand-800 underline underline-offset-4">{reports.length ? "Add or update an outcome" : "Report an outcome"}</summary>
            <div className="mt-4 flex flex-col gap-3">
              <p className="text-sm text-ink-2">Use the same outcome name again to update your report for this run. Leave the comparison blank if you do not have one.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="What did you measure?" hint="For example, qualified enquiries or completed bookings."><Input value={metric} onChange={(event) => setMetric(event.target.value)} maxLength={100} /></Field>
                <Field label="Type of result"><Select value={measureType} onValueChange={(next) => setMeasureType(next as MeasureType)} options={[{ value: "count", label: "Number" }, { value: "rate", label: "Percentage" }, { value: "currency", label: "Money" }, { value: "duration", label: "Time" }]} /></Field>
                <Field label={measureType === "rate" ? "Percentage" : "Observed value"} hint={measureType === "rate" ? "Enter 0–100. ClimbOS stores this as a percentage." : undefined}>
                  <Input type="number" min={measureType === "currency" ? undefined : 0} max={measureType === "rate" ? 100 : undefined} step={measureType === "count" ? 1 : "any"} value={value} onChange={(event) => setValue(event.target.value)} />
                </Field>
                {measureType === "rate" ? <Field label="Number included" hint="How many people or items were counted."><Input type="number" min={1} step={1} value={denominator} onChange={(event) => setDenominator(event.target.value)} /></Field> : <Field label="Unit" hint="For example, leads, USD, BDT, or hours."><Input value={unit} onChange={(event) => setUnit(event.target.value)} maxLength={30} /></Field>}
                <Field label="Which group or work?" hint="Name the group this result came from."><Input value={cohort} onChange={(event) => setCohort(event.target.value)} maxLength={120} /></Field>
                <Field label="Compared with" optional hint="For example, the previous 2 weeks."><Input value={comparisonLabel} onChange={(event) => setComparisonLabel(event.target.value)} maxLength={80} /></Field>
                <Field label="Comparison result" optional><Input type="number" min={measureType === "currency" ? undefined : 0} max={measureType === "rate" ? 100 : undefined} step={measureType === "count" ? 1 : "any"} value={comparisonValue} onChange={(event) => setComparisonValue(event.target.value)} /></Field>
                {measureType === "rate" && hasComparison ? <Field label="Number in comparison" hint="How many people or items were counted in the comparison."><Input type="number" min={1} step={1} value={comparisonDenominator} onChange={(event) => setComparisonDenominator(event.target.value)} /></Field> : null}
                <Field label="Period started"><DatePicker value={periodStart} max={latestCompletedDate} onChange={setPeriodStart} /></Field>
                <Field label="Period ended" hint="Choose a completed period."><DatePicker value={periodEnd} min={periodStart || undefined} max={latestCompletedDate} onChange={setPeriodEnd} /></Field>
              </div>
              {!periodValid && periodStart && periodEnd ? <p className="text-sm text-danger-800" role="alert">Choose a completed period no longer than one year, with the start before the end.</p> : null}
              <div><Button size="sm" loading={busy} disabled={!canSave} onClick={() => void save()}>Save reported result</Button></div>
            </div>
          </details>
        ) : <p className="text-sm text-ink-3">Only workspace editors can add an outcome report.</p>}
      </CardContent>
    </Card>
  );
}
