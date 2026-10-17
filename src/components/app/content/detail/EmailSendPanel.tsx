"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, Callout, ConfirmDialog, Field, Input, Select, Skeleton, Spinner, toast } from "@/components/ui";
import { ErrorCallout, PERMISSION_WHO } from "../shared";
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
  const audience = useQuery(api.marketing.audience, { slug });
  const loadProviderSegments = useAction(api.marketing.providerSegments);
  const approveSend = useMutation(api.marketing.approveSend);
  const [providerSegments, setProviderSegments] = useState<ProviderSegment[] | null>(null);
  const [segError, setSegError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [emailIndex, setEmailIndex] = useState("0");
  const [segment, setSegment] = useState("");
  const [providerSegmentId, setProviderSegmentId] = useState("");
  const [from, setFrom] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [sent, setSent] = useState<{ recipients: number; subject: string } | null>(null);

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
      <p className="text-[0.95rem] text-ink-2">
        {artifact.status === "draft" || artifact.status === "in_review"
          ? "Approve the email text first. Then you can send it through your own email provider."
          : "Sending is available while the email is approved."}
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
    <p className="text-[0.95rem] leading-relaxed text-ink-2">
      Sends through your own email provider. Only the {chosen ? chosen.sendable.toLocaleString("en-US") : "N"} people with a recorded opt-in will get it;
      unsubscribes, bounces and complaints are always excluded. Every email includes an unsubscribe link. Your provider bills you directly.
    </p>
  );

  if (!providerConnected) {
    return (
      <div className="flex flex-col gap-3">
        {intro}
        <Callout tone="info" title="Connect your email provider to send">
          Connect your own Resend account in <Link href={`/app/${slug}/connections`}>Connections</Link> to send. ClimbOS doesn&apos;t send marketing email from its own
          servers.
        </Callout>
      </div>
    );
  }
  if (sendable.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        {intro}
        <Callout tone="info" title="No one can be emailed yet">
          Import contacts with their opt-in in <Link href={`/app/${slug}/connections`}>Connections → Your customer or lead list</Link>. Only people who agreed to
          hear from you can be emailed.
        </Callout>
      </div>
    );
  }
  if (emails.length === 0) {
    return <Callout tone="warning">We couldn&apos;t find any emails with a “Subject:” line in this draft. Edit it so each email starts with “Subject: …”.</Callout>;
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
    if (!chosen) e.segment = "Choose who should get it.";
    if (!providerSegmentId) e.provider = "Choose the matching list in your Resend account.";
    if (!/^[^<>]*<?[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}>?$/i.test(from.trim())) e.from = "Enter a sender like “Your Name <hello@yourdomain.com>”.";
    setFieldErrors(e);
    return Object.keys(e).length === 0;
  };

  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (validate()) setConfirming(true);
      }}
    >
      {intro}
      <p className="text-sm text-ink-3">{audience.note}</p>

      <Field label="Which email?">
        <Select
          value={emailIndex}
          onValueChange={setEmailIndex}
          options={emails.map((m, i) => ({ value: String(i), label: `Email ${i + 1}: ${m.subject}` }))}
        />
      </Field>
      {email ? (
        <details className="rounded-[12px] border border-line bg-surface-2 p-3 text-[0.95rem]">
          <summary className="min-h-11 cursor-pointer content-center font-medium text-ink">Read email {Number(emailIndex) + 1}</summary>
          <p className="mt-2 font-semibold text-ink">Subject: {email.subject}</p>
          <p className="mt-2 whitespace-pre-wrap break-words leading-relaxed text-ink-2">{email.text}</p>
        </details>
      ) : null}

      <Field label="Who gets it" hint="Only groups with at least one opted-in person are listed." error={fieldErrors.segment}>
        <Select
          value={segment}
          onValueChange={setSegment}
          placeholder="Choose a group…"
          options={sendable.map((s) => ({
            value: s.segment,
            label: `${s.segment} — ${s.sendable.toLocaleString("en-US")} opted in${s.total > s.sendable ? ` (of ${s.total.toLocaleString("en-US")})` : ""}`,
          }))}
        />
      </Field>
      {chosen && chosen.total > chosen.sendable ? (
        <p className="-mt-2 text-sm text-ink-3">
          {(chosen.total - chosen.sendable).toLocaleString("en-US")} won&apos;t get it: {chosen.suppressed.toLocaleString("en-US")} unsubscribed, bounced or complained, and the
          rest have no recorded opt-in.
        </p>
      ) : null}

      <Field label="List in your Resend account" hint="The audience in your own Resend account to send through." error={fieldErrors.provider}>
        {providerSegments === null && !segError ? (
          <span className="flex min-h-11 items-center gap-2 text-sm text-ink-3">
            <Spinner /> Loading your Resend lists…
          </span>
        ) : (
          <Select
            value={providerSegmentId}
            onValueChange={setProviderSegmentId}
            placeholder={providerSegments?.length ? "Choose a list…" : "No lists found in Resend"}
            disabled={!providerSegments?.length}
            options={(providerSegments ?? []).map((p) => ({ value: p.id, label: p.name }))}
          />
        )}
      </Field>
      {segError ? <ErrorCallout error={segError} onRetry={() => setReloadKey((k) => k + 1)} /> : null}

      <Field label="Sender" hint="Must be an address on a domain verified in your own Resend account." error={fieldErrors.from}>
        <Input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="Your Name <hello@yourdomain.com>" autoComplete="off" />
      </Field>

      <Button type="submit" className="self-start">
        Review and send
      </Button>
      {error ? <ErrorCallout error={error} /> : null}
      {sent ? (
        <Callout tone="info" live="status" title="Sending…">
          “{sent.subject}” is going to {sent.recipients.toLocaleString("en-US")} opted-in {sent.recipients === 1 ? "person" : "people"}. We&apos;ll show the provider&apos;s
          confirmation under “What happened”.
        </Callout>
      ) : null}

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Send to ${chosen?.sendable.toLocaleString("en-US") ?? 0} people?`}
        description={`“${email?.subject ?? ""}” goes to the ${chosen?.sendable.toLocaleString("en-US") ?? 0} opted-in people in “${segment}”${providerName ? ` through your Resend list “${providerName}”` : ""}, from ${from.trim()}. Unsubscribes, bounces and complaints are excluded and every email has an unsubscribe link. This can't be unsent. Your provider bills you directly; it also counts toward your monthly marketing-send allowance in ClimbOS.${artifact.isDemo ? " Demo workspace: sending is simulated." : ""}`}
        confirmLabel={`Send to ${chosen?.sendable.toLocaleString("en-US") ?? 0} people`}
        onConfirm={async () => {
          setError(null);
          try {
            const res = await approveSend({ slug, artifactId: artifact.id, emailIndex: Number(emailIndex), segment, providerSegmentId, from: from.trim() });
            setSent({ recipients: res.recipients, subject: email?.subject ?? "" });
            toast({ tone: "info", title: "Send approved.", description: "We'll show the provider's confirmation when it arrives." });
          } catch (e) {
            setError(e);
          }
        }}
      />
    </form>
  );
}
