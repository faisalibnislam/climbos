"use client";

import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { ClipboardPen } from "lucide-react";
import { useState } from "react";
import { Badge, Button, Field, Input, toast, type Tone } from "@/components/ui";
import { errorMessage } from "@/components/app/errors";
import type { PlayModel } from "../../../../shared/agents/economics";
import type { PlayActuals } from "../../../../shared/growth/actuals";

const STATUS: Record<PlayActuals["status"], { label: string; tone: Tone }> = {
  ahead: { label: "Ahead of plan", tone: "green" },
  on_track: { label: "On track", tone: "neutral" },
  behind: { label: "Behind: check the kill rule", tone: "red" },
  too_early: { label: "Too early to tell", tone: "neutral" },
};

const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;
const r1 = (x: number) => (x >= 10 ? Math.round(x) : Math.round(x * 10) / 10);

/** Plan vs actual for one play, and a weekly log (spec §28). */
export function PlayResults({ slug, strategyId, playName, model, actuals, canEdit }: { slug: string; strategyId: Id<"strategies">; playName: string; model: PlayModel; actuals?: PlayActuals; canEdit: boolean }) {
  const log = useMutation(api.playResults.log);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [vals, setVals] = useState<Record<string, string>>({});
  const fields = [{ key: "reach", label: "Reached" }, ...model.steps.map((s, i) => ({ key: `s${i}`, label: s.name })), { key: "spend", label: "Spent ($)" }, { key: "hours", label: "Your hours" }];
  const submit = async () => {
    const n = (k: string) => Number(vals[k] || 0);
    setBusy(true);
    try {
      await log({ slug, strategyId, playName, reach: n("reach"), steps: model.steps.map((_, i) => n(`s${i}`)), spendUsd: n("spend"), ownerHours: n("hours") });
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
    <div className="flex flex-col gap-2 rounded-lg border border-line p-2.5">
      {actuals ? (
        <>
          <p className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-medium text-ink-2">
              Week {actuals.weeks}: {actuals.customers} customer{actuals.customers === 1 ? "" : "s"} <span className="font-normal text-ink-3">(plan ≈{r1(actuals.expectedByNow.p50)} by now)</span>
            </span>
            <Badge tone={STATUS[actuals.status].tone}>{STATUS[actuals.status].label}</Badge>
          </p>
          <ul className="flex flex-col gap-0.5 text-xs text-ink-3">
            {actuals.steps
              .filter((s) => s.trials > 0)
              .map((s) => (
                <li key={s.name} className="flex justify-between gap-2 tabular-nums">
                  <span className="truncate">{s.name}</span>
                  <span>
                    <span className="text-ink">{pct(s.successes / s.trials)}</span> vs {pct(s.planned)} planned · {s.successes}/{s.trials}
                  </span>
                </li>
              ))}
          </ul>
        </>
      ) : (
        <p className="text-xs text-ink-3">No results yet. Log each week to see plan vs actual.</p>
      )}
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
