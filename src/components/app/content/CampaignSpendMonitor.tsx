"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@convex/_generated/dataModel";
import { api } from "@convex/_generated/api";
import { useState } from "react";
import { Button, Callout, ConfirmDialog, toast } from "@/components/ui";
import { errorMessage } from "@/components/app/errors";
import { minorToDisplay } from "../money";

type Monitor = FunctionReturnType<typeof api.adMonitoring.view>;
const LABELS: Record<Monitor["status"], string> = {
  disabled: "Off", waiting: "Waiting for a check", checking: "Checking reported spend",
  below_limit: "Below the approved total", needs_review: "Needs attention", pause_pending: "Pause result pending",
  paused: "Pause confirmed", uncertain: "Pause not confirmed",
};
function localTime(ms: number) { return new Date(ms).toLocaleString(); }

export function CampaignSpendMonitor({ slug, campaignId }: { slug: string; campaignId: Id<"campaigns"> }) {
  const data = useQuery(api.adMonitoring.view, { slug, campaignId });
  if (!data) return <p className="text-sm text-ink-3">Loading spend monitor…</p>;
  // A changed account, campaign, content version or policy closes any old confirmation.
  return <MonitorControls key={data.termsHash} slug={slug} campaignId={campaignId} data={data} />;
}
function MonitorControls({ slug, campaignId, data }: { slug: string; campaignId: Id<"campaigns">; data: Monitor }) {
  const configure = useMutation(api.adMonitoring.configure);
  const reconcile = useAction(api.adMonitoring.reconcilePause);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const total = data.thresholdMinor === null ? "Amount needs review" : minorToDisplay(data.thresholdMinor, data.currency);
  const unresolved = data.pending || data.status === "uncertain";
  const enabled = data.status !== "disabled" && data.status !== "paused" && !data.approvalProblem;
  async function run(task: () => Promise<unknown>) {
    setError(null); setBusy(true);
    try { await task(); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  return (
    <section aria-label="Campaign spend monitor" className="flex flex-col gap-3 rounded-lg border border-line bg-surface-2 p-4">
      <p className="text-sm font-semibold text-ink">Spend-limit pause · {LABELS[data.status]}</p>
      <p className="text-sm text-ink-2">With your approval, ClimbOS can request a pause when platform-reported spend since {data.startDate ?? "the confirmed start date"} reaches {total}.</p>
      <p className="text-xs text-ink-3">Provider reports and pauses can be delayed. Spend can exceed this amount. This is not a guaranteed billing cap or a conversion-tracking check.</p>
      {data.isDemo ? <p className="text-sm text-ink-2">Demo only: no live spend reads or real pauses.</p> : null}
      <div aria-live="polite" className="text-sm text-ink-2">
        {data.message ? <p>{data.message}</p> : null}
        {data.checkedAt ? <p>Last check: {localTime(data.checkedAt)} (your browser time). Reported spend: {data.spendMinor === null ? "Unknown" : minorToDisplay(data.spendMinor, data.currency)}.</p> : null}
        {data.spendMinor !== null && data.windowStart ? <p>Report window: {data.windowStart}–{data.windowEnd}, including the partial day. Ad account timezone: {data.timeZone}.</p> : null}
        {enabled && data.nextAt ? <p>Next check due: {localTime(data.nextAt)}. Queue and provider delays may apply.</p> : null}
        {enabled && data.expiresAt ? <p>Approval expires: {localTime(data.expiresAt)}. Review and approve again to continue after expiry.</p> : null}
      </div>
      {data.approvalProblem && !unresolved ? <Callout tone="warning" title="Review monitor approval">{data.approvalProblem}</Callout> : null}
      {!enabled && data.reason && !unresolved && data.status !== "paused" ? <p className="text-sm text-ink-2">{data.reason}</p> : null}
      {unresolved ? <p className="text-sm text-ink-2">Check the ad platform. After five minutes, use Check pause result to read its status without sending another pause request.</p> : null}
      {data.canApprove ? <div className="flex flex-wrap gap-2">
        {!enabled && !unresolved && !data.reason ? <ConfirmDialog
          title="Approve spend-limit pause?"
          description={`Authorize one pause attempt at ${total} of reported spend. Delayed reporting or execution can allow spending above this amount.`}
          confirmLabel="Approve spend monitor"
          confirmDisabled={busy}
          trigger={<Button variant="secondary" size="sm" disabled={busy}>Review spend monitor</Button>}
          onConfirm={() => run(() => configure({ slug, campaignId, enabled: true, expectedTermsHash: data.termsHash }))}
        >
          <dl className="space-y-2 break-words text-sm text-ink-2">
            <div><dt className="font-medium">Exact destination</dt><dd>Account {data.accountId} · Campaign {data.campaignExternalId}</dd></div>
            <div><dt className="font-medium">Spend counted</dt><dd>From {data.startDate}, including today in the ad account timezone. Maximum reporting window: 90 days.</dd></div>
            <div><dt className="font-medium">Checks and expiry</dt><dd>Checks are due every 15 minutes; queues may delay them. Approval lasts {data.durationHours} hours. Changed terms require renewed approval.</dd></div>
            <div><dt className="font-medium">Action allowed</dt><dd>Pause this campaign only. No restart, budget increase or tracking-loss diagnosis. Unreadable reports cannot establish spend; an unconfirmed pause is not retried automatically.</dd></div>
          </dl>
        </ConfirmDialog> : null}
        {data.status !== "disabled" && data.status !== "paused" && !unresolved ? <Button variant="secondary" size="sm" disabled={busy} onClick={() => run(() => configure({ slug, campaignId, enabled: false }))}>Stop monitoring</Button> : null}
        {data.canReconcile ? <Button variant="secondary" size="sm" disabled={busy} onClick={() => run(async () => {
          const result = await reconcile({ slug, campaignId });
          toast({ tone: result.paused ? "success" : "info", title: result.paused ? "Campaign pause confirmed" : "Pause still unconfirmed. Check the ad platform." });
        })}>Check pause result</Button> : null}
      </div> : <p className="text-xs text-ink-3">An owner, admin or reviewer must approve or stop this monitor.</p>}
      {error ? <Callout tone="danger" title="Monitor not changed">{error}</Callout> : null}
    </section>
  );
}
