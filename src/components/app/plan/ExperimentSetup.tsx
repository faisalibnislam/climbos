"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { Button, Field, Input, Textarea, toast } from "@/components/ui";
import { errorMessage } from "../errors";
import { formatMoney, majorToMinor, minorToMajor } from "@shared/economics/currency";

type Experiment = FunctionReturnType<typeof api.workspace.plan>["experiments"][number];

/** Defining a test never starts it or grants permission to spend. */
export function ExperimentSetup({ slug, e, canEdit }: { slug: string; e: Experiment; canEdit: boolean }) {
  const save = useMutation(api.playResults.preregisterExperiment);
  const logChange = useMutation(api.playResults.logExperimentDeviation);
  const [busy, setBusy] = useState(false);
  const [versions, setVersions] = useState(e.variants?.map((variant) => variant.description) ?? ["", ""]);
  const [owner, setOwner] = useState(e.decisionOwner ?? "");
  const [currency, setCurrency] = useState(e.plannedCost?.currency ?? e.currency ?? "");
  const [cash, setCash] = useState(e.plannedCost ? String(minorToMajor(e.plannedCost.cashMinor, e.plannedCost.currency)) : "");
  const [hours, setHours] = useState(e.plannedCost ? String(e.plannedCost.ownerHours) : "");
  const [basis, setBasis] = useState(e.plannedCost?.basis ?? "");
  const [change, setChange] = useState("");
  const submit = async () => {
    const amount = Number(cash), time = Number(hours);
    if (!cash.trim() || !hours.trim() || !Number.isFinite(amount) || amount < 0 || !Number.isFinite(time) || time < 0 || time > 400 || !/^[A-Z]{3}$/.test(currency)) {
      toast({ tone: "danger", title: "Set a cash and time limit", description: "Enter a valid currency and amounts, including zero if no money or time is needed." });
      return;
    }
    if (versions.some((version) => !version.trim()) || !owner.trim() || !basis.trim()) {
      toast({ tone: "danger", title: "Finish the test setup", description: "Describe each version, who decides, and where your estimate comes from." });
      return;
    }
    setBusy(true);
    try {
      await save({ slug, experimentId: e.id, variants: versions.map((description, index) => ({ key: String.fromCharCode(65 + index), description })), decisionOwner: owner, plannedCost: { cashMinor: majorToMinor(amount, currency), currency, ownerHours: time, basis } });
      toast({ tone: "success", title: "Test setup saved", description: "The test is still proposed. Nothing has started or been spent." });
    } catch (error) { toast({ tone: "danger", title: errorMessage(error) }); }
    finally { setBusy(false); }
  };
  return (
    <details className="border-t border-line pt-2.5">
      <summary className="min-h-9 cursor-pointer text-sm font-medium">{e.status === "proposed" ? "Set up this test" : "Original setup and changes"}</summary>
      <div className="mt-3 flex flex-col gap-3 text-sm">
        {e.variants?.length ? <div><p className="font-medium">Saved versions</p><ul className="mt-1 list-disc pl-5 text-ink-2">{e.variants.map((variant) => <li key={variant.key}>{variant.key}: {variant.description}</li>)}</ul></div> : <p className="text-ink-3">No versions were saved before this test.</p>}
        {e.decisionOwner ? <p>Decision owner: {e.decisionOwner}</p> : null}
        {e.plannedCost ? <p>Planned limit: {formatMoney(minorToMajor(e.plannedCost.cashMinor, e.plannedCost.currency), e.plannedCost.currency)} and {e.plannedCost.ownerHours} hours. Basis: {e.plannedCost.basis}</p> : null}
        {canEdit && e.status === "proposed" ? <>
          <p className="text-ink-2">Describe what you will compare before starting. Saving this setup does not start the test or approve spending.</p>
          {versions.map((version, index) => <Field key={index} label={`Version ${index + 1}`} hint={index === 0 ? "The current experience or comparison." : undefined}><Textarea value={version} maxLength={240} disabled={busy} onChange={(event) => setVersions((current) => current.map((value, i) => i === index ? event.target.value : value))} /></Field>)}
          <div className="flex flex-wrap gap-2">
            {versions.length < 4 ? <Button className="min-h-11" variant="secondary" disabled={busy} onClick={() => setVersions((current) => [...current, ""])}>Add another version</Button> : null}
            {versions.length > 2 ? <Button className="min-h-11" variant="ghost" disabled={busy} onClick={() => setVersions((current) => current.slice(0, -1))}>Remove last version</Button> : null}
          </div>
          <Field label="Who decides what to do next?"><Input value={owner} maxLength={120} disabled={busy} onChange={(event) => setOwner(event.target.value)} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Cash limit"><Input type="number" min={0} step="any" value={cash} disabled={busy} onChange={(event) => setCash(event.target.value)} /></Field>
            <Field label="Currency" hint="Three letters, for example USD."><Input value={currency} maxLength={3} disabled={busy} onChange={(event) => setCurrency(event.target.value.toUpperCase())} /></Field>
            <Field label="Your total hours" hint="For this test, not each week."><Input type="number" min={0} max={400} step="any" value={hours} disabled={busy} onChange={(event) => setHours(event.target.value)} /></Field>
          </div>
          <Field label="Where does this estimate come from?"><Textarea value={basis} maxLength={240} disabled={busy} onChange={(event) => setBasis(event.target.value)} /></Field>
          <Button className="min-h-11 self-start" disabled={busy} onClick={() => void submit()}>{busy ? "Saving…" : "Save test setup"}</Button>
        </> : null}
        {e.deviations.length ? <div><p className="font-medium">Changes recorded after starting</p><ol className="mt-1 list-decimal pl-5 text-ink-2">{e.deviations.map((item, index) => <li key={index}>{item.note}</li>)}</ol></div> : null}
        {canEdit && e.status !== "proposed" ? <>
          <p className="text-ink-2">The original setup is locked. Keep a record of any changes instead.</p>
          <Field label="What changed from the plan?"><Textarea value={change} maxLength={500} disabled={busy} onChange={(event) => setChange(event.target.value)} /></Field>
          <Button className="min-h-11 self-start" disabled={busy || change.trim().length < 4} onClick={async () => {
            setBusy(true);
            try { await logChange({ slug, experimentId: e.id, note: change }); setChange(""); toast({ tone: "success", title: "Change recorded" }); }
            catch (error) { toast({ tone: "danger", title: errorMessage(error) }); }
            finally { setBusy(false); }
          }}>Record this change</Button>
        </> : null}
      </div>
    </details>
  );
}
