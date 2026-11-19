"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { FunctionReturnType } from "convex/server";
import { Suspense, useEffect, useState } from "react";
import { Button, Callout, Checkbox, ConfirmDialog, DateTimePicker, Field, Input, Select, Skeleton, Spinner, toast } from "@/components/ui";
import { localEmailDeliveryTime } from "@shared/growth/emailSchedule";
import { CUSTOMER_PROGRESS_LABELS, type CustomerProgressRule } from "@shared/growth/customerProgress";
import { ErrorCallout, FactList, MessageText, NoteList, PERMISSION_WHO } from "../shared";
import { EmailSenderCheck } from "./EmailSenderCheck";
import { EmailRecipientReview } from "./EmailRecipientReview";
import type { ArtifactView } from "./model";

export interface ParsedEmail {
  subject: string;
  text: string;
}

/** Mirrors the backend: blocks separated by a "———" line, each with a "Subject: …" line. */
export function parseSequence(body: string, kind: string, headline: string | null, title: string): ParsedEmail[] {
  const emails = body
    .split(/\n\s*———\s*\n/)
    .map((block) => {
      const subject = block.match(/^Subject:\s*(.+)$/m)?.[1]?.trim() ?? "";
      const text = block
        .replace(/^Email \d+.*$/m, "")
        .replace(/^Subject:.*$/m, "")
        .replace(/^Preview:.*$/m, "")
        .trim();
      return { subject, text };
    })
    .filter((e) => e.subject && e.text);
  if (emails.length === 0 && kind === "email" && body.trim()) return [{ subject: headline ?? title, text: body.trim() }];
  return emails;
}

export function isEmailKind(kind: string): boolean {
  return kind === "email_sequence" || kind === "email";
}

type ProviderSegment = { id: string; name: string };

/** Send one approved email through the customer's own Resend account to opted-in contacts. */
export function EmailSendPanel({ slug, artifact }: { slug: string; artifact: ArtifactView }) {
  return <div className="flex flex-col gap-4"><ScheduledEmails slug={slug} artifact={artifact} /><EmailSendRecovery slug={slug} artifact={artifact} /><Suspense fallback={<p role="status">Opening email review…</p>}><EmailSendEntry slug={slug} artifact={artifact} /></Suspense></div>;
}

function deliveryLabel(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "long" }).format(timestamp);
}

function ScheduledEmails({ slug, artifact }: { slug: string; artifact: ArtifactView }) {
  const scheduled = useQuery(api.marketing.scheduledSends, { slug, artifactId: artifact.id });
  const cancel = useMutation(api.marketing.cancelScheduledSend);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  if (!scheduled?.items.length) return null;
  return <div className="flex flex-col gap-3">
    {scheduled.items.map(item => <Callout key={item.id} tone={item.invalidated ? "warning" : "info"} title={item.invalidated ? "Scheduled approval changed" : "Email scheduled"}>
      <p>{item.title}</p><p className="mt-2">{deliveryLabel(item.scheduledFor)}. Delivery window ends {deliveryLabel(item.windowEnd)}.</p>
      <p className="mt-2">{item.invalidated ? "This approval can no longer send. Cancel it to release the reserved allowance now." : "The current email, audience, consent and allowance will be checked again. Changes stop the send for a new review."}</p>
      {scheduled.canCancel ? <Button type="button" className="mt-3" disabled={busy} onClick={async () => { setBusy(true); setError(null); try { await cancel({ slug, approvalId: item.id }); toast({ tone: "success", title: "Scheduled email cancelled" }); } catch (e) { setError(e); } finally { setBusy(false); } }}>{busy ? "Cancelling…" : "Cancel scheduled email"}</Button> : null}
    </Callout>)}
    {scheduled.omitted ? <p>Showing 20 pending schedules. More are recorded in Activity.</p> : null}
    {error ? <ErrorCallout error={error} /> : null}
  </div>;
}

type JourneyReview = Extract<FunctionReturnType<typeof api.customerJourneys.stepReview>, { ready: true }>;
function EmailSendEntry({ slug, artifact }: { slug: string; artifact: ArtifactView }) {
  const params = useSearchParams();
  const hasJourney = params.has("journey"), journey = params.get("journey") ?? "", rawStep = params.get("step") ?? "";
  const validStep = /^\d+$/.test(rawStep) && Number.isSafeInteger(Number(rawStep));
  const review = useQuery(api.customerJourneys.stepReview, hasJourney && validStep ? { slug, journey, stepIndex: Number(rawStep), artifactId: artifact.id } : "skip");
  if (hasJourney) {
    if (!validStep || review?.ready === false) return <Callout tone="warning" title="Review this follow-up first">{review?.ready === false ? review.message : "This step link is incomplete."} <Link className="text-link" href={`/app/${slug}/customers`}>Open Customers → Follow-ups</Link></Callout>;
    if (!review) return <p role="status">Checking the saved follow-up…</p>;
    return <EmailSendForm key={`${review.ref.journeyId}:${review.ref.revision}:${review.ref.stepIndex}`} slug={slug} artifact={artifact} journey={review} />;
  }
  return <EmailSendForm key={artifact.id} slug={slug} artifact={artifact} />;
}

export function EmailSendRecovery({ slug, artifact }: { slug: string; artifact: ArtifactView }) {
  const unresolved = useQuery(api.marketing.unresolvedSends, { slug, artifactId: artifact.id });
  const check = useAction(api.marketing.checkSendResult);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  if (!unresolved?.items.length) return null;
  return <div className="flex flex-col gap-3">
    {unresolved.items.map(attempt => <Callout key={attempt.id} tone="warning" title="Check an earlier email send">
      <p className="break-words">{attempt.title}</p>
      <p className="mt-2">{attempt.message}</p>
      <p className="mt-2 text-sm">This checks the original approved version, even if this draft has changed. It never sends another email. Allow five minutes after the attempt starts.</p>
      {attempt.canCheck ? <Button type="button" className="mt-3" disabled={busy} onClick={async () => {
        setBusy(true); setError(null);
        try { const result = await check({ slug, artifactId: artifact.id, approvalId: attempt.id }); toast({ tone: result.confirmed ? "success" : "info", title: result.confirmed ? "Provider send confirmed" : "Result still unknown", description: result.message }); }
        catch (e) { setError(e); }
        finally { setBusy(false); }
      }}>{busy ? "Checking…" : "Check provider result"}</Button> : <p className="mt-2 text-sm">{attempt.resolving ? "Provider result confirmed. Updating the original contact history and allowance…" : "Automatic checking needs dispatch evidence and approval permission. If unavailable, inspect the original Resend account; do not resend while unresolved."}</p>}
    </Callout>)}
    {unresolved.omitted ? <p className="text-sm text-ink-2">Showing ten unresolved attempts. More are retained in Activity.</p> : null}
    {error ? <ErrorCallout error={error} /> : null}
  </div>;
}

function EmailSendForm({ slug, artifact, journey }: { slug: string; artifact: ArtifactView; journey?: JourneyReview }) {
  const audience = useQuery(api.marketing.audience, { slug });
  const loadProviderSegments = useAction(api.marketing.providerSegments);
  const approveSend = useMutation(api.marketing.approveSend);
  const [providerSegments, setProviderSegments] = useState<ProviderSegment[] | null>(null);
  const [segError, setSegError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [emailIndex, setEmailIndex] = useState(String(journey?.emailIndex ?? 0));
  const [segment, setSegment] = useState(journey?.segment ?? "");
  const [limitByProgress, setLimitByProgress] = useState(Boolean(journey));
  const [progressGroup, setProgressGroup] = useState<(Omit<CustomerProgressRule, "maxAgeDays"> & { key: string }) | null>(journey ? { ...journey.rule, key: JSON.stringify([journey.rule.scope, journey.rule.state, journey.rule.criterion]) } : null);
  const [observationAge, setObservationAge] = useState(journey ? String(journey.rule.maxAgeDays) : "");
  const maxAgeDays = Number(observationAge);
  const lifecycleRule: CustomerProgressRule | undefined = limitByProgress && progressGroup && Number.isInteger(maxAgeDays) && maxAgeDays >= 1 && maxAgeDays <= 365
    ? { scope: progressGroup.scope, state: progressGroup.state, criterion: progressGroup.criterion, maxAgeDays } : undefined;
  const audiencePreview = useQuery(api.marketing.emailAudiencePreview, segment ? { slug, segment, ...(lifecycleRule ? { lifecycleRule } : {}), includeProgressOptions: limitByProgress, ...(journey ? { journeyStep: journey.ref } : {}) } : "skip");
  const frequency = audiencePreview?.frequency;
  const progressReady = !limitByProgress || Boolean(lifecycleRule && audiencePreview?.rule && lifecycleRule.scope === audiencePreview.rule.scope && lifecycleRule.state === audiencePreview.rule.state && lifecycleRule.criterion === audiencePreview.rule.criterion && lifecycleRule.maxAgeDays === audiencePreview.rule.maxAgeDays);
  const reportedGroups = audiencePreview?.progressOptions ?? [];
  const selectableGroups = progressGroup && !reportedGroups.some(group => group.key === progressGroup.key) ? [...reportedGroups, { ...progressGroup, contacts: 0 }] : reportedGroups;
  const [approvedAudience, setApprovedAudience] = useState<{ rule?: CustomerProgressRule; hash: string; count: number; scheduledFor?: number } | null>(null);
  const [deliveryMode, setDeliveryMode] = useState("now");
  const [deliveryTime, setDeliveryTime] = useState("");
  const scheduledFor = deliveryMode === "later" ? localEmailDeliveryTime(deliveryTime) : undefined;
  const [providerSegmentId, setProviderSegmentId] = useState("");
  const [from, setFrom] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [sent, setSent] = useState<{ recipients: number; subject: string; scheduledFor: number | null } | null>(null);

  const providerConnected = audience?.providerConnected ?? false;

  useEffect(() => {
    if (!providerConnected) return;
    let cancelled = false;
    loadProviderSegments({ slug })
      .then((rows) => {
        if (!cancelled) {
          setProviderSegments(rows);
          setSegError(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setSegError(e);
      });
    return () => {
      cancelled = true;
    };
  }, [providerConnected, loadProviderSegments, slug, reloadKey]);

  if (artifact.status !== "approved") {
    return (
      <p className="text-sm text-ink-2">
        {artifact.status === "draft" || artifact.status === "in_review"
          ? "Approve the email first."
          : "Only approved emails can be sent."}
      </p>
    );
  }
  if (audience === undefined) return <Skeleton className="h-40 w-full" />;

  const cur = artifact.current;
  const emails = cur ? parseSequence(cur.body, artifact.kind, cur.headline, artifact.title) : [];
  const sendable = audience.segments.filter((s) => s.sendable > 0);
  const chosen = sendable.find((s) => s.segment === segment);
  const email = emails[Number(emailIndex)];
  const providerName = providerSegments?.find((p) => p.id === providerSegmentId)?.name;

  const intro = (
    <p className="text-sm text-ink-2">Opted-in contacts only, via your own provider.</p>
  );

  if (!providerConnected) {
    return (
      <div className="flex flex-col gap-3">
        {intro}
        <Callout tone="info" title="Connect your email provider">
          Add Resend in <Link href={`/app/${slug}/connections`}>Connections</Link>.
        </Callout>
      </div>
    );
  }
  if (sendable.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        {intro}
        <Callout tone="info" title="No opted-in contacts">
          Import them in <Link href={`/app/${slug}/connections`}>Connections</Link>.
        </Callout>
      </div>
    );
  }
  if (emails.length === 0) {
    return <Callout tone="warning">No “Subject:” lines found. Start each email with “Subject: …”.</Callout>;
  }
  if (!artifact.canApprove) {
    return (
      <div className="flex flex-col gap-3">
        {intro}
        <p className="text-sm text-ink-2">Sending needs {PERMISSION_WHO.approve}.</p>
      </div>
    );
  }

  const validate = () => {
    const e: Record<string, string> = {};
    if (!chosen) e.segment = "Choose a group.";
    if (!providerSegmentId) e.provider = "Choose a Resend list.";
    if (deliveryMode === "later" && (scheduledFor == null || scheduledFor < Date.now() + 60_000 || scheduledFor > Date.now() + 23 * 3_600_000)) e.delivery = "Choose a valid local time at least one minute ahead and within 23 hours.";
    if (!/^[^<>]*<?[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}>?$/i.test(from.trim())) e.from = "Use “Name <hello@yourdomain.com>”.";
    setFieldErrors(e);
    return Object.keys(e).length === 0;
  };

  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (audiencePreview && progressReady && audiencePreview.eligible > 0 && !frequency?.message && validate()) {
          setApprovedAudience({ rule: lifecycleRule, hash: audiencePreview.previewHash, count: audiencePreview.eligible, ...(scheduledFor != null ? { scheduledFor } : {}) });
          setConfirming(true);
        }
      }}
    >
      {intro}
      {journey ? <Callout tone="info" title={`Follow-up: ${journey.name}`}>Step {journey.ref.stepIndex + 1} uses its saved email and audience rules. Only contacts due for this step can qualify. This review does not approve later steps.</Callout> : null}
      <MessageText text={audience.note} className="text-sm text-ink-3" />

      <Field label="Which email?">
        <Select
          disabled={Boolean(journey)}
          value={emailIndex}
          onValueChange={setEmailIndex}
          options={emails.map((m, i) => ({ value: String(i), label: `Email ${i + 1}: ${m.subject}` }))}
        />
      </Field>
      {email ? (
        <details className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm">
          <summary className="min-h-8 cursor-pointer content-center text-ui font-medium text-ink">Read email {Number(emailIndex) + 1}</summary>
          <p className="mt-2 font-semibold text-ink">Subject: {email.subject}</p>
          <p className="mt-2 whitespace-pre-wrap break-words text-ink-2">{email.text}</p>
        </details>
      ) : null}

      <Field label="Who gets it" error={fieldErrors.segment}>
        <Select
          disabled={Boolean(journey)}
          value={segment}
          onValueChange={value => { setSegment(value); setProgressGroup(null); }}
          placeholder="Choose a group…"
          options={sendable.map((s) => ({
            value: s.segment,
            label: `${s.segment} — ${s.sendable.toLocaleString("en-US")} opted in${s.total > s.sendable ? ` (of ${s.total.toLocaleString("en-US")})` : ""}`,
          }))}
        />
      </Field>
      {segment ? <div className="flex flex-col gap-3 rounded-lg border border-line p-3">
        <Checkbox disabled={Boolean(journey)} label="Limit this email by customer progress" checked={limitByProgress} onCheckedChange={checked => setLimitByProgress(checked === true)} />
        {limitByProgress ? <>
          <p className="text-sm text-ink-2">Use dated progress reports to match this email to a particular stage. This does not establish live activity or replace email permission.</p>
          <Field label="Reported customer group"><Select disabled={Boolean(journey)} value={progressGroup?.key ?? ""} placeholder="Choose a reported group…" onValueChange={key => {
            const group = audiencePreview?.progressOptions.find(option => option.key === key);
            if (group) setProgressGroup({ key, scope: group.scope, state: group.state, criterion: group.criterion });
          }} options={selectableGroups.map(group => ({ value: group.key, label: `${group.scope} · ${CUSTOMER_PROGRESS_LABELS[group.state]} · ${group.criterion.length > 90 ? `${group.criterion.slice(0, 90)}…` : group.criterion}` }))} /></Field>
          {audiencePreview && !audiencePreview.progressOptions.length ? <p className="text-sm text-ink-2">No usable groups in this opted-in audience. Record customer progress in Connections first; unknown progress does not qualify.</p> : null}
          {audiencePreview?.omittedGroups ? <p className="text-xs text-ink-3">Showing 30 groups; {audiencePreview.omittedGroups} more are not shown. Choose a narrower contact segment to review them.</p> : null}
          {progressGroup ? <p className="text-sm text-ink-2">Selected definition: {progressGroup.criterion}</p> : null}
          <Field label="Oldest acceptable observation (days)" hint="Choose 1–365. Age uses UTC calendar dates; a report exactly this many days old qualifies. No age is assumed."><Input disabled={Boolean(journey)} type="number" min={1} max={365} step={1} value={observationAge} onChange={event => setObservationAge(event.target.value)} /></Field>
          {audiencePreview?.rule && progressReady ? <Callout tone="info" title={`${audiencePreview.eligible} of ${audiencePreview.total} opted-in contacts qualify`}>
            Excluded: {audiencePreview.excluded.different_progress} with different progress or a different definition; {audiencePreview.excluded.outdated} with outdated reports; {audiencePreview.excluded.unknown} with missing, unknown or conflicting evidence. {journey ? `${audiencePreview.excluded.not_due} are not due for this follow-up step. ` : ""}Checked on {audiencePreview.observedOnUtc} (UTC).
          </Callout> : <p className="text-sm text-ink-2">Choose the group and observation age to preview recipients.</p>}
          <p className="text-xs text-ink-3">Rechecked before approval and sending. Changed evidence stops this send for a fresh review. Use a provider list that matches the filtered audience exactly; ClimbOS does not remove extra provider contacts automatically.</p>
        </> : null}
      </div> : null}
      {audience.canReviewRecipients && audiencePreview && progressReady ? <EmailRecipientReview review={{ slug, segment, previewHash: audiencePreview.previewHash, ...(lifecycleRule ? { lifecycleRule } : {}), ...(journey ? { journeyStep: journey.ref } : {}) }} /> : null}
      {frequency?.message ? <Callout tone="warning" title="Your contact limit will hold this send">{frequency.message}</Callout> : null}
      {chosen && chosen.total > chosen.sendable ? (
        <p className="-mt-2 text-sm text-ink-3">
          {(chosen.total - chosen.sendable).toLocaleString("en-US")} excluded: {chosen.suppressed.toLocaleString("en-US")} unsubscribed/bounced, rest no opt-in.
        </p>
      ) : null}

      <Field label="Resend list" error={fieldErrors.provider}>
        {providerSegments === null && !segError ? (
          <span className="flex h-9 items-center gap-2 text-ui text-ink-3">
            <Spinner /> Loading lists…
          </span>
        ) : (
          <Select
            value={providerSegmentId}
            onValueChange={setProviderSegmentId}
            placeholder={providerSegments?.length ? "Choose a list…" : "No Resend lists"}
            disabled={!providerSegments?.length}
            options={(providerSegments ?? []).map((p) => ({ value: p.id, label: p.name }))}
          />
        )}
      </Field>
      {segError ? <ErrorCallout error={segError} onRetry={() => setReloadKey((k) => k + 1)} /> : null}

      <Field label="Sender" hint="Use a domain you have verified in Resend." error={fieldErrors.from}>
        <Input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="Your Name <hello@yourdomain.com>" autoComplete="off" />
      </Field>

      <EmailSenderCheck key={`${slug}:${from}`} slug={slug} from={from} report={audience.senderReadiness} />

      <Field label="Delivery"><Select value={deliveryMode} onValueChange={setDeliveryMode} options={[{ value: "now", label: "Send after approval" }, { value: "later", label: "Choose a delivery time" }]} /></Field>
      {deliveryMode === "later" ? <Field label="Delivery time" error={fieldErrors.delivery} hint={`Your timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}. Choose within 23 hours. This exact email has a one-hour delivery window and must fit your current allowance period.`}>
        <DateTimePicker value={deliveryTime} onChange={setDeliveryTime} />
      </Field> : null}

      <Button type="submit" className="self-start" disabled={!audiencePreview || !progressReady || audiencePreview.eligible === 0 || Boolean(frequency?.message)}>
        {deliveryMode === "later" ? "Review scheduled delivery" : "Send"}
      </Button>
      {error ? <ErrorCallout error={error} /> : null}
      {sent && sent.scheduledFor === null ? (
        <Callout tone="info" live="status" title="Sending…">
          “{sent.subject}” → {sent.recipients.toLocaleString("en-US")} {sent.recipients === 1 ? "person" : "people"}. Confirmation shows under Activity.
        </Callout>
      ) : null}

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`${approvedAudience?.scheduledFor !== undefined ? "Schedule delivery" : "Send"} to ${approvedAudience?.count.toLocaleString("en-US") ?? 0} ${approvedAudience?.count === 1 ? "person" : "people"}?`}
        description={approvedAudience?.scheduledFor !== undefined ? "You can cancel before delivery starts. No later email or new recipient is approved." : "Can't be unsent."}
        confirmLabel={approvedAudience?.scheduledFor !== undefined ? "Approve scheduled delivery" : `Send to ${approvedAudience?.count.toLocaleString("en-US") ?? 0} ${approvedAudience?.count === 1 ? "person" : "people"}`}
        confirmDisabled={!approvedAudience || approvedAudience.hash !== audiencePreview?.previewHash || approvedAudience.scheduledFor !== scheduledFor || Boolean(frequency?.message)}
        onConfirm={async () => {
          setError(null);
          try {
            const res = await approveSend({ slug, artifactId: artifact.id, emailIndex: Number(emailIndex), segment, providerSegmentId, from: from.trim(), ...(journey ? { journeyStep: journey.ref } : {}), ...(approvedAudience?.rule ? { lifecycleRule: approvedAudience.rule } : {}), ...(approvedAudience ? { audiencePreviewHash: approvedAudience.hash, ...(approvedAudience.scheduledFor !== undefined ? { scheduledFor: approvedAudience.scheduledFor } : {}) } : {}) });
            setSent({ recipients: res.recipients, subject: email?.subject ?? "", scheduledFor: res.scheduledFor });
            toast({ tone: "info", title: res.scheduledFor === null ? "Send approved." : "Delivery scheduled." });
          } catch (e) {
            setError(e);
          }
        }}
      >
        <FactList
          items={[
            { term: "Email", detail: `“${email?.subject ?? ""}”` },
            { term: "To", detail: `Opted-in people in “${segment}”` },
            ...(approvedAudience?.rule ? [{ term: "Progress rule", detail: `${approvedAudience.rule.scope} · ${CUSTOMER_PROGRESS_LABELS[approvedAudience.rule.state]} · ${approvedAudience.rule.criterion}. Owner observations no older than ${approvedAudience.rule.maxAgeDays} UTC calendar days.` }] : []),
            ...(providerName ? [{ term: "Via", detail: `“${providerName}”` }] : []),
            { term: "From", detail: from.trim() },
            ...(approvedAudience?.scheduledFor !== undefined ? [{ term: "Delivery", detail: `${deliveryLabel(approvedAudience.scheduledFor)}. Window ends one hour later. Audience and permission checked again before sending.` }] : []),
          ]}
        />
        {approvedAudience && approvedAudience.hash !== audiencePreview?.previewHash ? <Callout tone="warning">The recipient evidence changed. Close this confirmation and review the updated audience.</Callout> : null}
        <NoteList
          className="mt-3"
          items={["Includes an unsubscribe link", "Your provider bills you", "Counts toward your send allowance", ...(artifact.isDemo ? ["Demo: simulated"] : [])]}
        />
      </ConfirmDialog>
    </form>
  );
}
