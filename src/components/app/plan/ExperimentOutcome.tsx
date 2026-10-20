"use client";

import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { CircleAlert, CircleCheck, CircleDashed, ClipboardPen, Scale, type LucideIcon } from "@/components/icons";
import { useState } from "react";
import { Badge, Button, Checkbox, DatePicker, Field, Input, Segmented, Select, toast, type Tone } from "@/components/ui";
import { errorMessage } from "@/components/app/errors";
import { inferenceOf, isRedefined, type Inference, type OutcomeDesign, type OutcomeInput, type OutcomeResult, type OutcomeSource } from "../../../../shared/growth/experimentOutcome";

export type Analysis = OutcomeInput & { n: number; inference: Inference; redefined: boolean; reviewedAt: number };

export const INFERENCE: Record<Inference, { label: string; tone: Tone; icon: LucideIcon }> = {
  incremental: { label: "Incremental", tone: "green", icon: Scale },
  observed: { label: "Observed only", tone: "blue", icon: CircleDashed },
  attributed: { label: "Platform-attributed", tone: "amber", icon: CircleDashed },
  not_run: { label: "Not run", tone: "neutral", icon: CircleAlert },
};

const RESULT: Record<OutcomeResult, { label: string; tone: Tone }> = {
  met: { label: "Met", tone: "green" },
  missed: { label: "Missed", tone: "red" },
  unclear: { label: "Unclear", tone: "neutral" },
};

const SOURCES: { value: OutcomeSource; label: string }[] = [
  { value: "owner_report", label: "My own count" },
  { value: "integration", label: "Connected tool" },
  { value: "platform_report", label: "Platform report" },
];

const DESIGNS: { value: OutcomeDesign; label: string }[] = [
  { value: "none", label: "No comparison" },
  { value: "before_after", label: "Before / after" },
  { value: "holdout", label: "Holdout group" },
  { value: "randomized", label: "Random split" },
];

const DESIGN_OF_METHOD: Record<string, OutcomeDesign> = { holdout: "holdout", ab_split: "randomized", pre_post_observational: "before_after", export_instructions: "none" };

type Exp = { id: Id<"experiments">; method: string; primaryMetric: string; stoppingRule: string; analyses: Analysis[] };

const num = (s: string) => (s.trim() === "" ? undefined : Number(s));
const str = (n?: number) => (n === undefined ? "" : String(n));

/** Latest outcome of a test, with what it can claim, and the owner's form to record one (Book 14 §14). */
export function ExperimentOutcome({ slug, e, canEdit }: { slug: string; e: Exp; canEdit: boolean }) {
  const record = useMutation(api.playResults.recordExperimentOutcome);
  const latest = e.analyses.at(-1);
  const [open, setOpen] = useState(false);
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
    windowStart: latest?.windowStart ?? "",
    windowEnd: latest?.windowEnd ?? "",
    result: latest?.result ?? ("unclear" as OutcomeResult),
    stopRuleHit: latest?.stopRuleHit ?? false,
    metric: latest?.metric ?? e.primaryMetric,
    successRule: latest?.successRule ?? e.stoppingRule,
    note: latest?.note ?? "",
  });
  const [f, setF] = useState(init);
  const set = <K extends keyof typeof f>(k: K, val: (typeof f)[K]) => setF((x) => ({ ...x, [k]: val }));
  const comparative = f.design === "holdout" || f.design === "randomized";
  const counts = {
    eligible: num(f.eligible),
    exposed: num(f.exposed),
    conversions: num(f.conversions),
    controlSize: comparative ? num(f.controlSize) : undefined,
    controlConversions: comparative ? num(f.controlConversions) : undefined,
  };
  const preview = inferenceOf({ ...f, ...counts });
  const redefines = Boolean(latest) && (f.metric.trim() !== latest!.metric || f.successRule.trim() !== latest!.successRule);

  const submit = async () => {
    setBusy(true);
    try {
      const r = await record({
        slug,
        experimentId: e.id,
        executed: f.executed,
        source: f.source,
        design: f.design,
        ...(f.executed ? counts : {}),
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

  const inf = latest ? INFERENCE[latest.inference] : null;
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
          {latest.executed ? <OutcomeNumbers a={latest} /> : null}
        </div>
      ) : null}
      {canEdit && !open ? (
        <Button
          size="sm"
          variant="ghost"
          className="self-start"
          onClick={() => {
            setF(init());
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
                <Field label="Design">
                  <Select options={DESIGNS} value={f.design} onValueChange={(v) => set("design", v as OutcomeDesign)} disabled={busy} />
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <NumField label="Eligible" value={f.eligible} onChange={(v) => set("eligible", v)} disabled={busy} />
                <NumField label="Exposed" value={f.exposed} onChange={(v) => set("exposed", v)} disabled={busy} />
                <NumField label="Converted" value={f.conversions} onChange={(v) => set("conversions", v)} disabled={busy} />
                {comparative ? (
                  <>
                    <NumField label="Comparison group" value={f.controlSize} onChange={(v) => set("controlSize", v)} disabled={busy} />
                    <NumField label="Comparison converted" value={f.controlConversions} onChange={(v) => set("controlConversions", v)} disabled={busy} />
                  </>
                ) : null}
              </div>
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
              Counts as
              <Badge tone={INFERENCE[preview].tone}>{INFERENCE[preview].label}</Badge>
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NumField({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled: boolean }) {
  return (
    <Field label={label}>
      <Input inputMode="numeric" value={value} onChange={(ev) => onChange(ev.target.value.replace(/[^\d]/g, ""))} disabled={disabled} />
    </Field>
  );
}

const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;

/** Counts in one line; the comparison only when the design has one. */
function OutcomeNumbers({ a }: { a: Analysis }) {
  const parts: string[] = [];
  if (a.exposed !== undefined) parts.push(`${a.conversions ?? "?"}/${a.exposed} exposed${a.exposed && a.conversions !== undefined ? ` (${pct(a.conversions / a.exposed)})` : ""}`);
  if (a.inference === "incremental" && a.controlSize) parts.push(`${a.controlConversions ?? "?"}/${a.controlSize} comparison${a.controlConversions !== undefined ? ` (${pct(a.controlConversions / a.controlSize)})` : ""}`);
  if (a.eligible !== undefined) parts.push(`${a.eligible} eligible`);
  if (a.windowStart && a.windowEnd) parts.push(`${a.windowStart} → ${a.windowEnd}`);
  if (!parts.length) return null;
  return (
    <p className="flex items-center gap-1.5 text-xs tabular-nums text-ink-2">
      <CircleCheck aria-hidden className="size-3.5 text-ink-3" />
      {parts.join(" · ")}
    </p>
  );
}
