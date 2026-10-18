"use client";

import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Button, Callout, ConfirmDialog, DateTimePicker, Field, Spinner, toast } from "@/components/ui";
import { formatDateTime } from "../../money";
import { ErrorCallout, PERMISSION_WHO, browserTimeZone, channelLabel } from "../shared";
import { ExportPackPanel } from "./ExportPack";
import { hasValidApproval } from "./ApprovalPanel";
import type { ArtifactView } from "./model";

/** Read the clock in event handlers. */
const currentTime = () => Date.now();

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** ms → "YYYY-MM-DDTHH:mm" in the browser's local time (for datetime-local). */
function toLocalInput(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultWhen(now: number): string {
  const q = 15 * 60_000;
  return toLocalInput(Math.ceil((now + 60 * 60_000) / q) * q);
}

function destinationText(artifact: ArtifactView): string {
  const ch = channelLabel(artifact.channel);
  const label = artifact.publishTarget?.accountLabel;
  return label ? `${label} on ${ch}` : ch;
}

function ScheduleForm({ slug, artifact, now, reschedule }: { slug: string; artifact: ArtifactView; now: number; reschedule?: boolean }) {
  const schedule = useMutation(api.content.schedule);
  const [value, setValue] = useState(() => (artifact.scheduledFor ? toLocalInput(artifact.scheduledFor) : defaultWhen(now)));
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [confirming, setConfirming] = useState(false);
  const tz = browserTimeZone();
  const when = value ? new Date(value).getTime() : NaN;

  const check = (t: number) => {
    if (!value || Number.isNaN(when)) return "Pick a date and time.";
    if (when < t + 60_000) return "Pick a time at least a minute from now.";
    if (when > t + 90 * 86_400_000) return "Pick a time within the next 90 days.";
    return null;
  };

  return (
    <form
      className="flex flex-col gap-3"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const problem = check(currentTime());
        setFieldError(problem);
        if (!problem) setConfirming(true);
      }}
    >
      <Field label={reschedule ? "Change the time" : "Schedule for"} hint={`In your time zone: ${tz}.`} error={fieldError ?? undefined}>
        <DateTimePicker value={value} min={toLocalInput(now + 2 * 60_000)} max={toLocalInput(now + 90 * 86_400_000)} onChange={setValue} />
      </Field>
      <Button type="submit" variant={reschedule ? "secondary" : "primary"}>
        {reschedule ? "Reschedule" : "Schedule"}
      </Button>
      {error ? <ErrorCallout error={error} /> : null}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Schedule this post?"
        description={`ClimbOS will send version ${artifact.current?.version ?? 1} to ${destinationText(artifact)} on ${Number.isNaN(when) ? "" : formatDateTime(when)} (${tz}). Until ${channelLabel(artifact.channel)} accepts it, it shows as “Scheduled in ClimbOS”, not “Accepted by platform”.${artifact.isDemo ? " Demo workspace: publishing is simulated." : ""}`}
        confirmLabel={`Schedule for ${Number.isNaN(when) ? "" : formatDateTime(when)}`}
        onConfirm={async () => {
          setError(null);
          try {
            await schedule({ slug, artifactId: artifact.id, when });
            toast({ tone: "success", title: "Scheduled in ClimbOS.", description: "It isn't on the platform until the platform accepts it." });
          } catch (e) {
            setError(e);
          }
        }}
      />
    </form>
  );
}

function PublishNowButton({ slug, artifact }: { slug: string; artifact: ArtifactView }) {
  const publishNow = useMutation(api.content.publishNow);
  const [error, setError] = useState<unknown>(null);
  const ch = channelLabel(artifact.channel);
  return (
    <div className="flex flex-col gap-2">
      <ConfirmDialog
        trigger={<Button variant="secondary">Publish now</Button>}
        title={`Publish to ${ch} now?`}
        description={`ClimbOS sends this exact approved version (version ${artifact.current?.version ?? 1}) to ${destinationText(artifact)} right away. It shows as “Accepted by platform” only after ${ch} confirms. If we can't confirm, we mark it “Outcome uncertain” and won't retry on our own.${artifact.isDemo ? " Demo workspace: publishing is simulated — nothing is really posted." : ""}`}
        confirmLabel={`Publish to ${ch} now`}
        onConfirm={async () => {
          setError(null);
          try {
            await publishNow({ slug, artifactId: artifact.id });
          } catch (e) {
            setError(e);
          }
        }}
      />
      {error ? <ErrorCallout error={error} /> : null}
    </div>
  );
}

function UnscheduleButton({ slug, artifact }: { slug: string; artifact: ArtifactView }) {
  const unschedule = useMutation(api.content.unschedule);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="ghost"
        loading={busy}
        loadingText="Unscheduling…"
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await unschedule({ slug, artifactId: artifact.id });
            toast({ tone: "success", title: "Unscheduled. It stays approved." });
          } catch (e) {
            setError(e);
          } finally {
            setBusy(false);
          }
        }}
      >
        Unschedule
      </Button>
      {error ? <ErrorCallout error={error} /> : null}
    </div>
  );
}

/** What happens after approval: schedule / publish (connected) or export pack (not connected). */
export function PublishPanel({ slug, artifact, now }: { slug: string; artifact: ArtifactView; now: number | null }) {
  const ch = channelLabel(artifact.channel);
  const target = artifact.publishTarget;
  // Copilot mode: never publishes directly; the owner uses the export pack.
  const direct = Boolean(target?.connected) && !artifact.copilot;
  const valid = hasValidApproval(artifact, now);
  const s = artifact.status;

  let statusLine: ReactNode;
  if (s === "draft" || s === "in_review") statusLine = "Approve this first. Nothing can be scheduled, published or exported before that.";
  else if (s === "approved") statusLine = valid ? (direct ? `Approved and ready. Schedule it or publish it now.` : "Approved and ready to post yourself.") : (artifact.approvalProblem ?? "The approval expired. Approve it again first.");
  else if (s === "scheduled") statusLine = `Scheduled in ClimbOS for ${artifact.scheduledFor && now ? formatDateTime(artifact.scheduledFor) : "…"}. It isn't on ${ch} yet — it shows “Accepted by platform” once ${ch} confirms.`;
  else if (s === "publishing")
    statusLine = (
      <span className="inline-flex items-center gap-2">
        <Spinner /> Sending to {ch} now… This page updates when {ch} answers.
      </span>
    );
  else if (s === "published") statusLine = `Accepted by ${ch}. See the receipt below.`;
  else if (s === "failed") statusLine = `Didn't go out — ${ch} didn't accept it and nothing was posted. See what happened below. To try again, approve it again.`;
  else if (s === "uncertain") statusLine = `Outcome uncertain: we couldn't confirm whether ${ch} posted it. Check ${ch} directly. ClimbOS won't repeat it until it's checked.`;
  else if (s === "exported") statusLine = "Exported for manual posting. ClimbOS can't confirm whether it was posted.";
  else if (s === "archived") statusLine = "Archived. Nothing will be sent.";

  const showDirectControls = direct && artifact.canApprove && now !== null && ((s === "approved" && valid) || s === "scheduled");
  const showExport = !direct && ["approved", "exported"].includes(s);

  return (
    <div className="flex flex-col gap-4">
      <p role="status" aria-live="polite" className="text-sm text-ink-2">
        {statusLine}
      </p>

      {artifact.lastPublishError && ["approved", "in_review", "draft", "failed"].includes(s) ? (
        <Callout tone="warning" title="Last attempt wasn't posted">
          {artifact.lastPublishError.message}
        </Callout>
      ) : null}

      {artifact.isDemo && direct ? (
        <p className="text-sm text-violet-800">Demo workspace: publishing is simulated. Receipts say “Demo: simulated acceptance”.</p>
      ) : null}

      {artifact.copilot ? (
        <Callout tone="info" title="Copilot mode: you post it">
          <p>
            Copy it from the export pack below and post it yourself. To let ClimbOS post approved items, choose Review in <Link href={`/app/${slug}/settings/policies`}>Settings → Policies</Link>.
          </p>
        </Callout>
      ) : target && !direct ? (
        <Callout tone="info" title={`${ch} isn't connected — use the export pack`}>
          <p>
            Connect {ch} to let ClimbOS publish for you, or copy the text below and post it yourself.{" "}
            <Link href={`/app/${slug}/connections`}>Go to Connections</Link>
          </p>
        </Callout>
      ) : null}
      {!target && ["approved", "exported"].includes(s) ? (
        <Callout tone="info" title={`ClimbOS can't post to ${ch} directly`}>
          Copy it from the export pack below and post it yourself.
        </Callout>
      ) : null}

      {showDirectControls && now !== null ? (
        <div className="flex flex-col gap-4">
          {target?.isFixture ? <p className="text-sm text-ink-3">Connected account: {target.accountLabel ?? ch} (demo connection).</p> : target?.accountLabel ? <p className="text-sm text-ink-3">Connected account: {target.accountLabel}</p> : null}
          <ScheduleForm key={artifact.scheduledFor ?? "new"} slug={slug} artifact={artifact} now={now} reschedule={s === "scheduled"} />
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <PublishNowButton slug={slug} artifact={artifact} />
            {s === "scheduled" && artifact.canEdit ? <UnscheduleButton slug={slug} artifact={artifact} /> : null}
          </div>
        </div>
      ) : null}
      {direct && !artifact.canApprove && (s === "approved" || s === "scheduled") ? (
        <p className="text-sm text-ink-2">Scheduling and publishing need {PERMISSION_WHO.approve}.</p>
      ) : null}

      {showExport ? <ExportPackPanel slug={slug} artifact={artifact} /> : null}
    </div>
  );
}
