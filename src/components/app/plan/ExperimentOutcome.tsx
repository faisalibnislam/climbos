"use client";

import { useMutation, usePaginatedQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { CircleAlert, CircleCheck, CircleDashed, ClipboardPen, Scale, type LucideIcon } from "@/components/icons";
import { useState } from "react";
import { Badge, Button, Checkbox, DatePicker, Field, Input, Segmented, Select, toast, type Tone } from "@/components/ui";
import { formatDateTime } from "@/components/app/money";
import { errorMessage } from "@/components/app/errors";
import { inferenceOf, isRedefined, readingOf, readingText, measurementInputValue, measurementText, parseMeasurementValue, OUTCOME_SOURCE_LABEL, OUTCOME_REPORT_LIMIT, type Inference, type OutcomeAssignment, type OutcomeDesign, type OutcomeInput, type OutcomeResult, type OutcomeSource } from "../../../../shared/growth/experimentOutcome";

export type Analysis = OutcomeInput & { n: number; inference: Inference; redefined: boolean; reviewedAt: number };

export const INFERENCE: Record<Inference, { label: string; tone: Tone; icon: LucideIcon }> = {
  incremental: { label: "Reported random comparison", tone: "blue", icon: Scale },
  observed: { label: "Observed only", tone: "blue", icon: CircleDashed },
  attributed: { label: "Platform-attributed", tone: "amber", icon: CircleDashed },
  not_run: { label: "Not run", tone: "neutral", icon: CircleAlert },
};

const RESULT: Record<OutcomeResult, { label: string; tone: Tone }> = {
  met: { label: "Reported: met", tone: "green" },
  missed: { label: "Reported: missed", tone: "red" },
  unclear: { label: "Unclear", tone: "neutral" },
};

const SOURCES: { value: OutcomeSource; label: string }[] = [
  { value: "owner_report", label: "My own records" },
  { value: "integration", label: "Connected tool (entered by me)" },
  { value: "platform_report", label: "Platform report (entered by me)" },
];

const DESIGNS: { value: OutcomeDesign; label: string }[] = [
  { value: "none", label: "No comparison" },
  { value: "before_after", label: "Before / after" },
  { value: "holdout", label: "Holdout group" },
  { value: "randomized", label: "Random split" },
];

const ASSIGNMENTS: { value: OutcomeAssignment | "unknown"; label: string }[] = [
  { value: "unknown", label: "Unknown / not recorded" },
  { value: "random", label: "At random" },
  { value: "rule", label: "By a rule (e.g. inactive customers)" },
  { value: "owner_choice", label: "By hand" },
];
const DESIGN_OF_METHOD: Record<string, OutcomeDesign> = { holdout: "holdout", ab_split: "randomized", pre_post_observational: "before_after", export_instructions: "none" };

type Exp = { id: Id<"experiments">; method: string; primaryMetric: string; primaryMetricType?: string; currency?: string | null; stoppingRule: string; analyses: Analysis[]; outcomeRevision?: number };
const MEASUREMENTS = [{ value: "binary_rate", label: "Conversion counts (people)" }, { value: "count", label: "Count of the named outcome" }, { value: "continuous", label: "Time or other measured value" }, { value: "monetary", label: "Money" }, { value: "notes", label: "Notes only / value unknown" }];

const num = (s: string) => (s.trim() === "" ? undefined : Number(s));
const str = (n?: number) => (n === undefined ? "" : String(n));

/** Latest outcome of a test, with what it can claim, and the owner's form to record one (Book 14 §14). */
export function ExperimentOutcome({ slug, e, canEdit }: { slug: string; e: Exp; canEdit: boolean }) {
  const record = useMutation(api.playResults.recordExperimentOutcome);
  const latest = e.analyses.at(-1);
  const [open, setOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editRevision, setEditRevision] = useState(e.outcomeRevision ?? 0);
  const [busy, setBusy] = useState(false);
  const init = () => ({
    executed: latest?.executed ?? true,
    source: latest?.source ?? ("owner_report" as OutcomeSource),
    design: latest?.design ?? DESIGN_OF_METHOD[e.method] ?? "none",
    eligible: str(latest?.eligible),
    exposed: str(latest?.exposed),
    conversions: str(latest?.conversions),
    controlSize: str(latest?.controlSize),
    controlConversions: str(latest?.controlConversions),
    plannedSharePct: str(latest?.plannedSharePct),
    assignment: latest?.assignment ?? ("unknown" as OutcomeAssignment | "unknown"),
    windowStart: latest?.windowStart ?? "",
    windowEnd: latest?.windowEnd ?? "",
    result: latest?.result ?? ("unclear" as OutcomeResult),
    stopRuleHit: latest?.stopRuleHit ?? false,
    metric: latest?.metric ?? e.primaryMetric,
    successRule: latest?.successRule ?? e.stoppingRule,
    note: latest?.note ?? "",
    measurementType: latest?.measurement?.type ?? e.primaryMetricType ?? "binary_rate",
    measurementValue: measurementInputValue(latest?.measurement?.value, latest?.measurement?.type ?? "count", latest?.measurement?.currency),
    comparisonValue: measurementInputValue(latest?.measurement?.comparisonValue, latest?.measurement?.type ?? "count", latest?.measurement?.currency),
    measurementUnit: latest?.measurement?.unit ?? "",
    measurementCurrency: latest?.measurement?.currency ?? e.currency ?? "",
    measurementBasis: latest?.measurement?.basis ?? "",
    comparisonBasis: latest?.measurement?.comparisonBasis ?? "",
  });
  const [f, setF] = useState(init);
  const set = <K extends keyof typeof f>(k: K, val: (typeof f)[K]) => setF((x) => ({ ...x, [k]: val }));
  const comparative = f.design === "holdout" || f.design === "randomized";
  const counts = f.measurementType === "binary_rate" ? {
    eligible: num(f.eligible),
    exposed: num(f.exposed),
    conversions: num(f.conversions),
    controlSize: comparative ? num(f.controlSize) : undefined,
    controlConversions: comparative ? num(f.controlConversions) : undefined,
    plannedSharePct: comparative ? num(f.plannedSharePct) : undefined,
    assignment: comparative && f.assignment !== "unknown" ? f.assignment : undefined,
  } : {};
  const measurementType = f.measurementType === "count" || f.measurementType === "continuous" || f.measurementType === "monetary" ? f.measurementType : null;
  const preview = inferenceOf({ executed: f.executed, source: f.source, design: f.design, ...counts });
  const redefines = Boolean(latest) && (f.metric.trim() !== latest!.metric || f.successRule.trim() !== latest!.successRule);

  const submit = async () => {
    setBusy(true);
    try {
      const r = await record({
        slug,
        experimentId: e.id,
        expectedRevision: editRevision,
        executed: f.executed,
        source: f.source,
        design: f.design,
        ...(f.executed ? counts : {}),
        ...(f.executed && measurementType ? { measurement: {
          type: measurementType,
          value: parseMeasurementValue(f.measurementValue, measurementType, f.measurementCurrency),
          comparisonValue: parseMeasurementValue(f.comparisonValue, measurementType, f.measurementCurrency),
          unit: f.measurementUnit.trim(),
          ...(measurementType === "monetary" ? { currency: f.measurementCurrency.trim().toUpperCase() } : {}),
          basis: f.measurementBasis.trim(), comparisonBasis: f.comparisonBasis.trim(),
        } } : {}),
        windowStart: f.windowStart || undefined,
        windowEnd: f.windowEnd || undefined,
        metric: f.metric,
        successRule: f.successRule,
        result: f.executed ? f.result : "unclear",
        stopRuleHit: f.executed && f.stopRuleHit,
        note: f.note || undefined,
      });
      setOpen(false);
      toast({ tone: "success", title: r.newAnalysis && r.n > 1 ? `Saved as analysis ${r.n}` : "Outcome saved" });
    } catch (err) {
      toast({ tone: "danger", title: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const legacyMetricMismatch = Boolean(latest && !latest.measurement && e.primaryMetricType && e.primaryMetricType !== "binary_rate" && latest.metric.trim() === e.primaryMetric.trim() && (latest.conversions !== undefined || latest.controlConversions !== undefined));
  const inf = latest ? INFERENCE[legacyMetricMismatch && latest.executed ? "observed" : inferenceOf(latest)] : null;
  return (
    <div className="flex flex-col gap-2 border-t border-line pt-2.5">
      {latest && inf ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={inf.tone} icon={<inf.icon />}>
              {inf.label}
            </Badge>
            {latest.executed ? <Badge tone={RESULT[latest.result].tone}>{RESULT[latest.result].label}</Badge> : null}
            {latest.stopRuleHit ? <Badge tone="red">Stop rule hit</Badge> : null}
            {latest.redefined ? <Badge tone="amber">Changed definition</Badge> : null}
            {e.analyses.length > 1 ? <span className="text-xs text-ink-3">Analysis {latest.n}</span> : null}
          </div>
          {latest.executed ? legacyMetricMismatch ? <p className="text-xs text-ink-2">This older report used conversion counts for a different metric. Its metric value remains unknown; review the saved report before interpreting it.</p> : <OutcomeNumbers a={latest} /> : null}
        </div>
      ) : null}
      {latest ? <details onToggle={event => setHistoryOpen(event.currentTarget.open)}>
        <summary className="cursor-pointer text-xs text-ink-2">Outcome history</summary>
        {historyOpen ? <OutcomeHistory key={`${slug}:${e.id}`} slug={slug} e={e} /> : null}
      </details> : null}
      {canEdit && !open ? (
        <Button
          size="sm"
          variant="ghost"
          className="self-start"
          onClick={() => {
            setF(init());
            setEditRevision(e.outcomeRevision ?? 0);
            setOpen(true);
          }}
        >
          <ClipboardPen aria-hidden /> {latest ? "Update outcome" : "Record outcome"}
        </Button>
      ) : null}
      {open ? (
        <div className="flex flex-col gap-3">
          <Segmented
            label="Did the test run?"
            options={[
              { value: "yes", label: "Ran" },
              { value: "no", label: "Didn't run" },
            ]}
            value={f.executed ? "yes" : "no"}
            onChange={(v) => set("executed", v === "yes")}
          />
          {f.executed ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Source">
                  <Select options={SOURCES} value={f.source} onValueChange={(v) => set("source", v as OutcomeSource)} disabled={busy} />
                </Field>
                <Field label="Reported design">
                  <Select options={DESIGNS} value={f.design} onValueChange={v => setF(x => ({ ...x, design: v as OutcomeDesign, ...(v === "none" ? { comparisonValue: "", comparisonBasis: "" } : {}) }))} disabled={busy} />
                </Field>
              </div>
              <Field label="Measurement" hint="Use the planned metric. Changing type clears these measurement fields. Changed units or scope save a separate analysis, preserving the earlier result.">
                <Select options={MEASUREMENTS} value={f.measurementType} onValueChange={v => setF(x => ({ ...x, measurementType: v, measurementValue: "", comparisonValue: "", measurementUnit: "", measurementBasis: "", comparisonBasis: "" }))} disabled={busy} />
              </Field>
              {measurementType ? <>
                <Field label="Unit or amount meaning" hint={measurementType === "monetary" ? "For example, contribution after variable costs. Revenue is not profit." : "For example, qualified enquiries or minutes per request."}>
                  <Input value={f.measurementUnit} onChange={ev => set("measurementUnit", ev.target.value)} maxLength={80} disabled={busy} />
                </Field>
                {measurementType === "monetary" ? <Field label="Recorded currency" hint="Use the currency in these records. No currency conversion is performed.">
                  <Input value={f.measurementCurrency} onChange={ev => set("measurementCurrency", ev.target.value.toUpperCase())} maxLength={3} disabled={busy} placeholder="USD" />
                </Field> : null}
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Recorded value" optional hint="Blank means unknown; zero is a recorded zero."><Input inputMode="decimal" value={f.measurementValue} onChange={ev => set("measurementValue", ev.target.value)} disabled={busy} /></Field>
                  {f.design !== "none" ? <Field label="Comparison value" optional hint="Use actual records, not the plan's estimate."><Input inputMode="decimal" value={f.comparisonValue} onChange={ev => set("comparisonValue", ev.target.value)} disabled={busy} /></Field> : null}
                </div>
                <Field label="What the value covers" hint="Name the population and whether this is a total or average. For money, include the cost boundary."><Input value={f.measurementBasis} onChange={ev => set("measurementBasis", ev.target.value)} maxLength={400} disabled={busy} /></Field>
                {f.design !== "none" ? <Field label="What the comparison covers" optional hint="Include its period, population and calculation method; explain any differences or unknowns."><Input value={f.comparisonBasis} onChange={ev => set("comparisonBasis", ev.target.value)} maxLength={400} disabled={busy} /></Field> : null}
                <p className="text-xs text-ink-3">Values are saved as reported observations. ClimbOS does not infer an effect, significance or success from these aggregate values.</p>
              </> : null}
              {comparative && f.measurementType === "binary_rate" ? (
                <Field label="Comparison group chosen">
                  <Select options={ASSIGNMENTS} value={f.assignment} onValueChange={(v) => set("assignment", v as OutcomeAssignment | "unknown")} disabled={busy} />
                </Field>
              ) : null}
              {f.measurementType === "binary_rate" ? <div className="grid grid-cols-3 gap-2">
                <NumField label="Eligible" value={f.eligible} onChange={(v) => set("eligible", v)} disabled={busy} />
                <NumField label="Assigned to the change" value={f.exposed} onChange={(v) => set("exposed", v)} disabled={busy} />
                <NumField label="Converted" value={f.conversions} onChange={(v) => set("conversions", v)} disabled={busy} />
                {comparative ? (
                  <>
                    <NumField label="Comparison group" value={f.controlSize} onChange={(v) => set("controlSize", v)} disabled={busy} />
                    <NumField label="Comparison converted" value={f.controlConversions} onChange={(v) => set("controlConversions", v)} disabled={busy} />
                    <NumField decimal label="Planned % in new version" hint="Leave blank if unknown; use the original plan, not the observed split." value={f.plannedSharePct} onChange={(v) => set("plannedSharePct", v)} disabled={busy} />
                  </>
                ) : null}
              </div> : null}
              <div className="grid grid-cols-2 gap-2">
                <Field label="From">
                  <DatePicker value={f.windowStart} onChange={(v) => set("windowStart", v)} max={f.windowEnd || undefined} disabled={busy} />
                </Field>
                <Field label="To">
                  <DatePicker value={f.windowEnd} onChange={(v) => set("windowEnd", v)} min={f.windowStart || undefined} max={new Date().toISOString().slice(0, 10)} disabled={busy} />
                </Field>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Segmented
                  label="Result"
                  options={(["met", "missed", "unclear"] as const).map((r) => ({ value: r, label: RESULT[r].label }))}
                  value={f.result}
                  onChange={(v) => set("result", v)}
                />
                <Checkbox label="Stop rule hit" checked={f.stopRuleHit} onCheckedChange={(c) => set("stopRuleHit", c === true)} disabled={busy} />
              </div>
              <Field label="Metric" hint={isRedefined(f, e) ? "Differs from the original" : undefined}>
                <Input value={f.metric} onChange={(ev) => set("metric", ev.target.value)} maxLength={200} disabled={busy} />
              </Field>
              <Field label="Success rule" hint={redefines ? "Changed: saves a new analysis" : undefined}>
                <Input value={f.successRule} onChange={(ev) => set("successRule", ev.target.value)} maxLength={300} disabled={busy} />
              </Field>
            </>
          ) : null}
          <Field label="Note" optional>
            <Input value={f.note} onChange={(ev) => set("note", ev.target.value)} maxLength={500} disabled={busy} />
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={submit} disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <span className="ml-auto flex items-center gap-1.5 text-xs text-ink-3">
              Reported design
              <Badge tone={INFERENCE[preview].tone}>{INFERENCE[preview].label}</Badge>
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NumField({ label, hint, decimal = false, value, onChange, disabled }: { label: string; hint?: string; decimal?: boolean; value: string; onChange: (v: string) => void; disabled: boolean }) {
  return (
    <Field label={label} hint={hint}>
      <Input inputMode={decimal ? "decimal" : "numeric"} value={value} onChange={(ev) => { const next = ev.target.value; if (decimal ? /^\d*\.?\d*$/.test(next) : /^\d*$/.test(next)) onChange(next); }} disabled={disabled} />
    </Field>
  );
}

const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;

/** Counts in one line; the comparison only when the design has one. */
function OutcomeNumbers({ a }: { a: Analysis }) {
  if (a.measurement) return <div className="flex flex-col gap-1 text-xs text-ink-2">
    <p>{measurementText(a.measurement)}</p>
    <p>{a.windowStart && a.windowEnd ? `${a.windowStart} → ${a.windowEnd}` : "Observation window incomplete"}</p>
    <p className="text-ink-3">{OUTCOME_SOURCE_LABEL[a.source]}. {OUTCOME_REPORT_LIMIT}</p>
  </div>;
  const parts: string[] = [];
  if (a.exposed !== undefined) parts.push(`${a.conversions ?? "?"}/${a.exposed} exposed${a.exposed && a.conversions !== undefined ? ` (${pct(a.conversions / a.exposed)})` : ""}`);
  if ((a.design === "holdout" || a.design === "randomized") && a.controlSize) parts.push(`${a.controlConversions ?? "?"}/${a.controlSize} comparison${a.controlConversions !== undefined ? ` (${pct(a.controlConversions / a.controlSize)})` : ""}`);
  if (a.eligible !== undefined) parts.push(`${a.eligible} eligible`);
  if (a.windowStart && a.windowEnd) parts.push(`${a.windowStart} → ${a.windowEnd}`);
  if (!a.windowStart || !a.windowEnd) parts.push("Observation window incomplete");
  const reading = inferenceOf(a) === "incremental" ? readingText(readingOf(a)) : null;
  return (
    <div className="flex flex-col gap-0.5">
      <p className="flex items-center gap-1.5 text-xs tabular-nums text-ink-2">
        <CircleCheck aria-hidden className="size-3.5 text-ink-3" />
        {parts.join(" · ")}
      </p>
      {reading ? <p className="text-xs text-ink-2">{reading}</p> : null}
      <p className="text-xs text-ink-3">{OUTCOME_SOURCE_LABEL[a.source]}. {OUTCOME_REPORT_LIMIT}</p>
    </div>
  );
}

const HISTORY_FIELDS: Record<keyof OutcomeInput, string> = {
  executed: "Test run", source: "Reported source", design: "Reported design", eligible: "Eligible people",
  exposed: "Exposed people", conversions: "Conversions", controlSize: "Comparison group size",
  controlConversions: "Comparison conversions", plannedSharePct: "Planned allocation (%)", assignment: "Reported assignment",
  windowStart: "Window start", windowEnd: "Window end", metric: "Metric", successRule: "Success rule",
  result: "Reported result", stopRuleHit: "Stop rule hit", note: "Note", measurement: "Metric measurement",
};
const HISTORY_KIND = { recorded: "First report", correction: "Correction", reanalysis: "Changed definition", legacy_snapshot: "Earlier saved analysis" };

function OutcomeHistory({ slug, e }: { slug: string; e: Exp }) {
  const { results, status, loadMore } = usePaginatedQuery(api.playResults.outcomeHistoryPage, { slug, experimentId: e.id }, { initialNumItems: 10 });
  return <div className="mt-2 flex flex-col gap-3 text-xs text-ink-2">
    <p>Reports are entered by workspace members. Earlier versions are retained for review; future plans use the current report for each analysis.</p>
    {status === "LoadingFirstPage" ? <p role="status">Loading outcome history…</p> : null}
    {results.map(row => <OutcomeHistoryEntry key={row.id} a={row.analysis} title={`Revision ${row.revision} · ${HISTORY_KIND[row.kind]}${row.current ? " · Current" : ""}`} changedFields={row.changedFields} legacy={row.kind === "legacy_snapshot"} />)}
    {status !== "LoadingFirstPage" && !e.outcomeRevision ? <>
      <p>These are the earlier analyses still available. Corrections overwritten before history tracking cannot be recovered.</p>
      {[...e.analyses].reverse().map(a => <OutcomeHistoryEntry key={a.n} a={a} title={`Earlier saved analysis ${a.n}`} changedFields={[]} legacy />)}
    </> : null}
    {status === "CanLoadMore" || status === "LoadingMore" ? <Button size="sm" variant="ghost" disabled={status === "LoadingMore"} onClick={() => loadMore(10)}>Load older reports</Button> : null}
    {results.length ? <p>{results.length} saved reports shown{status === "Exhausted" ? "." : "; more may be available."}</p> : null}
  </div>;
}

function historyValue(a: Analysis, key: keyof OutcomeInput): string {
  const value = a[key];
  if (value === undefined || value === "") return "Not recorded";
  if (key === "measurement") return a.measurement ? measurementText(a.measurement) : "Not recorded";
  if (key === "source") return OUTCOME_SOURCE_LABEL[a.source];
  if (key === "design") return DESIGNS.find(item => item.value === a.design)?.label ?? "Unknown";
  if (key === "assignment") return ASSIGNMENTS.find(item => item.value === a.assignment)?.label ?? "Unknown";
  if (key === "result") return a.executed ? RESULT[a.result].label : "Not applicable — test not run";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

export function OutcomeHistoryEntry({ a, title, changedFields, legacy = false }: { a: Analysis; title: string; changedFields: string[]; legacy?: boolean }) {
  return <div className="flex flex-col gap-1 border-t border-line pt-2">
    <p className="font-medium">{title}</p>
    <p>Analysis {a.n} · Reported {formatDateTime(a.reviewedAt)} · {a.executed ? RESULT[a.result].label : "Not run"}</p>
    {legacy ? <p>Preserved from an earlier saved analysis. Earlier overwritten corrections are unavailable.</p> : null}
    {changedFields.length ? <p>Changed: {changedFields.map(key => HISTORY_FIELDS[key as keyof OutcomeInput] ?? key).join(", ")}.</p> : null}
    <details><summary className="cursor-pointer">Review this report</summary>
      <dl className="mt-2 flex flex-col gap-1">
        {(Object.keys(HISTORY_FIELDS) as (keyof OutcomeInput)[]).map(key => <div key={key}>
          <dt className="font-medium">{HISTORY_FIELDS[key]}</dt>
          <dd className="whitespace-pre-wrap break-words">{historyValue(a, key)}</dd>
        </div>)}
      </dl>
      <p className="mt-2">{OUTCOME_REPORT_LIMIT}</p>
    </details>
  </div>;
}
