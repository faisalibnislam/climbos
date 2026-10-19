"use client";

import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { useState } from "react";
import { Badge, Button, ConfirmDialog, Field, Input, toast } from "@/components/ui";
import { StatBlocks } from "@/components/ds/content";
import { microsToUsd } from "../money";
import { opsError, OpsSection, type Dashboard } from "./opsShared";

/** Global emergency stop and the anonymous-preview budget. Each change is confirmed and audited. */
export function FleetControls({ fleet }: { fleet: Dashboard["fleet"] }) {
  const setFleetStop = useMutation(api.ops.setFleetStop);
  const setPreviewBudget = useMutation(api.ops.setPreviewBudget);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [stopOpen, setStopOpen] = useState(false);
  const [budget, setBudget] = useState(String(fleet.previewDailyBudgetMicros / 1_000_000));
  const [budgetError, setBudgetError] = useState<string | null>(null);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const budgetNum = Number(budget);

  return (
    <OpsSection id="controls" title="Fleet controls">
      <div className="flex flex-col gap-3 rounded-xl border border-line p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="heading-card">Emergency stop</h3>
          <Badge tone={fleet.emergencyStop ? "red" : "green"}>{fleet.emergencyStop ? "Active — all customer work stopped" : "Off — running normally"}</Badge>
        </div>
        {fleet.emergencyStop ? (
          <>
            <p className="text-ui text-ink-2">Reason: {fleet.stopReason ?? "none recorded"}</p>
            <div>
              <ConfirmDialog
                title="Resume the fleet?"
                description="Scheduled and queued customer work starts again straight away."
                confirmLabel="Resume all customer work"
                onConfirm={async () => {
                  try {
                    await setFleetStop({ active: false });
                    toast({ tone: "success", title: "Fleet resumed" });
                  } catch (err) {
                    toast({ tone: "danger", title: "Couldn't resume", description: opsError(err) });
                  }
                }}
                trigger={<Button>Resume fleet</Button>}
              >
                <p className="text-sm text-ink-2">Each workspace&apos;s own pause and approval rules still apply.</p>
              </ConfirmDialog>
            </div>
          </>
        ) : (
          <form
            className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              if (reason.trim().length < 5) {
                setReasonError("Give a short reason — it's shown in the audit log.");
                return;
              }
              setReasonError(null);
              setStopOpen(true);
            }}
          >
            <Field label="Reason for stopping" error={reasonError ?? undefined}>
              <Input value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
            </Field>
            <Button type="submit" variant="danger">
              Stop all customer work
            </Button>
          </form>
        )}
        <ConfirmDialog
          open={stopOpen}
          onOpenChange={setStopOpen}
          tone="danger"
          title="Stop all customer work?"
          description="Every workspace stops immediately."
          confirmLabel="Stop all customer work"
          onConfirm={async () => {
            try {
              await setFleetStop({ active: true, reason: reason.trim() });
              toast({ tone: "success", title: "Fleet stopped" });
              setReason("");
            } catch (err) {
              toast({ tone: "danger", title: "Couldn't stop the fleet", description: opsError(err) });
            }
          }}
        >
          <dl className="grid gap-2 text-sm">
            <div>
              <dt className="font-medium text-ink">Stops</dt>
              <dd className="text-ink-2">Publishing, ad changes, emails and AI runs</dd>
            </div>
            <div>
              <dt className="font-medium text-red-800">Can&apos;t be recalled</dt>
              <dd className="text-ink-2">Runs already sent to a provider</dd>
            </div>
            <div>
              <dt className="font-medium text-ink">Customers see</dt>
              <dd className="text-ink-2">A paused notice</dd>
            </div>
          </dl>
        </ConfirmDialog>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-line p-4">
        <h3 className="heading-card">Preview budget</h3>
        <p className="text-ui text-ink-2">Daily spend cap for anonymous website previews.</p>
        <StatBlocks className="max-w-sm" stats={[{ label: "Current cap", value: `${microsToUsd(fleet.previewDailyBudgetMicros)} / day`, tone: fleet.previewDailyBudgetMicros === 0 ? "warn" : "default", hint: fleet.previewDailyBudgetMicros === 0 ? "Previews off" : undefined }]} />
        <form
          className="grid gap-3 sm:grid-cols-[14rem_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            if (budget.trim() === "" || !Number.isFinite(budgetNum) || budgetNum < 0 || budgetNum > 500) {
              setBudgetError("Enter between $0 and $500.");
              return;
            }
            setBudgetError(null);
            setBudgetOpen(true);
          }}
        >
          <Field label="New daily budget (USD)" error={budgetError ?? undefined}>
            <Input type="number" inputMode="decimal" min="0" max="500" step="0.5" value={budget} onChange={(e) => setBudget(e.target.value)} />
          </Field>
          <Button type="submit" variant="secondary">
            Update budget
          </Button>
        </form>
        <ConfirmDialog
          open={budgetOpen}
          onOpenChange={setBudgetOpen}
          title={`Set the preview budget to $${Number.isFinite(budgetNum) ? budgetNum : 0} per day?`}
          description={budgetNum === 0 ? "A $0 budget turns previews off until you raise it." : "Previews stop for the day once this much has been spent."}
          confirmLabel="Update preview budget"
          onConfirm={async () => {
            try {
              await setPreviewBudget({ usd: budgetNum });
              toast({ tone: "success", title: "Preview budget updated" });
            } catch (err) {
              toast({ tone: "danger", title: "Couldn't update the budget", description: opsError(err) });
            }
          }}
        />
      </div>
    </OpsSection>
  );
}
