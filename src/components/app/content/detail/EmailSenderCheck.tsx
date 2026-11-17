"use client";

import { useAction } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import { Button, Callout } from "@/components/ui";
import { ErrorCallout } from "../shared";
import { EMAIL_DOMAIN_SOURCE, EMAIL_READINESS_LIMITS, emailSenderDomain, type EmailSenderReadiness } from "../../../../../shared/growth/emailReadiness";

export function EmailSenderReadinessNote({ report }: { report: EmailSenderReadiness }) {
  return <Callout tone={report.state === "verified" ? "info" : "warning"} title={report.state === "verified" ? "Domain setup reported verified" : report.state === "setup_required" ? "Sender setup needs attention" : "Sender setup is still unknown"}>
    <p>{report.message}</p>
    <p className="mt-2 text-sm">Checked {new Date(report.checkedAt).toISOString().replace("T", " ").slice(0, 19)} UTC for {report.domain}. This is a saved observation; status may have changed.</p>
    <p className="mt-2 text-sm">{EMAIL_READINESS_LIMITS}</p>
    <a className="mt-2 inline-block underline" href={EMAIL_DOMAIN_SOURCE} target="_blank" rel="noreferrer">Resend domain guidance</a>
  </Callout>;
}

export function EmailSenderCheck({ slug, from, report }: { slug: string; from: string; report: EmailSenderReadiness | null }) {
  const check = useAction(api.marketing.checkSender);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const domain = emailSenderDomain(from);
  return <div className="flex flex-col gap-2">
    <Button type="button" className="self-start" disabled={!domain || busy} onClick={async () => {
      setBusy(true); setError(null);
      try { await check({ slug, from }); } catch (e) { setError(e); } finally { setBusy(false); }
    }}>{busy ? "Checking sender…" : "Check sender setup"}</Button>
    <p className="text-sm text-ink-3">Reads your domain status. No email is sent and no DNS settings are changed.</p>
    {report && report.domain === domain ? <EmailSenderReadinessNote report={report} /> : <p className="text-sm text-ink-3">Sender setup has not been checked for this address. You can also inspect the domain in your Resend account.</p>}
    {error ? <ErrorCallout error={error} /> : null}
  </div>;
}
