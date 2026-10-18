"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Mail, Pause, Play } from "lucide-react";
import { useState } from "react";
import { MAILBOX_PRESETS, type MailboxPreset } from "@shared/outbound/sending";
import { Badge, Button, Callout, Dialog, DialogContent, DialogFooter, DialogTrigger, Field, Input, Select, toast } from "@/components/ui";
import { errorMessage } from "../errors";
import { relativeTime } from "../money";

/** Connect the owner's mailbox (app password; SMTP to send, IMAP to see replies). */
export function ConnectMailbox({ slug, label = "Connect your mailbox" }: { slug: string; label?: string }) {
  const connect = useAction(api.mailbox.connect);
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState<MailboxPreset>("gmail");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [smtpHost, setSmtpHost] = useState("");
  const [imapHost, setImapHost] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const p = MAILBOX_PRESETS[preset];
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Mail aria-hidden /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent title="Connect your mailbox" description="Emails go out from your own address, a few at a time. ClimbOS reads only replies and bounces to stop sequences.">
        <div className="flex flex-col gap-4">
          <Field label="Email provider">
            <Select value={preset} onValueChange={(v) => setPreset(v as MailboxPreset)} options={(Object.keys(MAILBOX_PRESETS) as MailboxPreset[]).map((k) => ({ value: k, label: MAILBOX_PRESETS[k].label }))} />
          </Field>
          <Field label="Email address">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@yourbusiness.com" autoComplete="email" />
          </Field>
          <Field label="App password" hint={p.help}>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" />
          </Field>
          {preset === "custom" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="SMTP server (port 587)">
                <Input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="smtp.example.com" />
              </Field>
              <Field label="IMAP server (port 993)">
                <Input value={imapHost} onChange={(e) => setImapHost(e.target.value)} placeholder="imap.example.com" />
              </Field>
            </div>
          ) : null}
          {error ? <Callout tone="danger">{error}</Callout> : null}
        </div>
        <DialogFooter>
          <Button
            loading={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                const r = await connect({ slug, preset, email, password, ...(preset === "custom" ? { smtpHost, imapHost } : {}) });
                if (r.ok) {
                  toast({ tone: "success", title: r.message });
                  setOpen(false);
                  setPassword("");
                } else setError(r.message);
              } catch (e) {
                setError(errorMessage(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Check and connect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const STATUS_TEXT: Record<string, string> = { sent: "Sent", failed: "Didn't send", bounced: "Bounced", canceled: "Stopped" };

/** Sending panel on Find customers: mailbox, sender details, start/pause and what went out. */
export function MailboxSending({ slug, campaignId, approvedWithEmail, defaultCompany, bookingUrl, canApprove }: { slug: string; campaignId: Id<"outboundCampaigns">; approvedWithEmail: number; defaultCompany: string; bookingUrl?: string; canApprove: boolean }) {
  const s = useQuery(api.outboundSending.status, { slug, campaignId });
  const start = useMutation(api.outboundSending.start);
  const pause = useMutation(api.outboundSending.setPaused);
  const [senderName, setSenderName] = useState("");
  const [company, setCompany] = useState(defaultCompany);
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  if (!s) return null;
  const sending = s.sending;
  return (
    <div className="flex flex-col gap-3">
      {!s.mailbox ? (
        <>
          <p className="text-sm text-ink-3">Send from your own address. Warm-up limits keep your mailbox healthy (10 a day at first, up to 50).</p>
          {canApprove ? <ConnectMailbox slug={slug} /> : null}
        </>
      ) : sending ? (
        <>
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <Badge tone={sending.status === "on" ? "green" : sending.status === "paused" ? "amber" : "neutral"}>{sending.status === "on" ? "Sending" : sending.status === "paused" ? "Paused" : "Done"}</Badge>
            <span className="text-ink-2">from {s.mailbox.label}</span>
          </p>
          {sending.status === "paused" && sending.pausedReason === "content_changed" ? (
            <p className="text-sm text-amber-800">The emails changed after you started sending. Check them, then resume to approve this version.</p>
          ) : null}
          <p className="text-sm text-ink-2">
            Today {s.sentToday}/{s.capToday} · sent {s.counts.sent} · waiting {s.counts.queued}
            {s.counts.bounced ? ` · bounced ${s.counts.bounced}` : ""}
          </p>
          {s.next && sending.status === "on" ? <p className="text-xs text-ink-3">Next email {relativeTime(s.next)}. Weekdays 8:00–17:00 your time.</p> : null}
          {canApprove && sending.status !== "done" ? (
            <Button size="sm" variant="secondary" className="self-start" onClick={() => pause({ slug, campaignId, paused: sending.status === "on" })}>
              {sending.status === "on" ? <Pause aria-hidden /> : <Play aria-hidden />} {sending.status === "on" ? "Pause" : "Resume"}
            </Button>
          ) : null}
          {s.recent.length ? (
            <ul className="flex flex-col gap-1 text-xs text-ink-3">
              {s.recent.slice(0, 6).map((r) => (
                <li key={r.id}>
                  {STATUS_TEXT[r.status] ?? r.status} · {r.to} · email {r.step + 1} · {relativeTime(r.at)}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : canApprove ? (
        <>
          <p className="text-sm text-ink-3">
            Ready to email {approvedWithEmail} approved {approvedWithEmail === 1 ? "person" : "people"} with a published address, from {s.mailbox.label}. Replies stop their sequence.
          </p>
          <Field label="Your name">
            <Input value={senderName} onChange={(e) => setSenderName(e.target.value)} />
          </Field>
          <Field label="Company">
            <Input value={company} onChange={(e) => setCompany(e.target.value)} />
          </Field>
          <Field label="Postal address" hint="Required by anti-spam laws; shown in the footer.">
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </Field>
          <Button
            loading={busy}
            disabled={!approvedWithEmail}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await start({ slug, campaignId, senderName, company, address, bookingUrl });
                toast({ tone: "success", title: `Sending to ${r.queued} ${r.queued === 1 ? "person" : "people"}`, description: "A few at a time, on weekdays." });
              } catch (e) {
                toast({ tone: "danger", title: errorMessage(e) });
              } finally {
                setBusy(false);
              }
            }}
          >
            Start sending
          </Button>
        </>
      ) : null}
    </div>
  );
}
