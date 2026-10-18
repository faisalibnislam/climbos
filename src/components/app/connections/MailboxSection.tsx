"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Mail } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { ConnectMailbox } from "../outbound/MailboxSending";

/** Your mailbox: sends outbound emails from your own address; reads only replies and bounces. */
export function MailboxSection({ slug }: { slug: string }) {
  const m = useQuery(api.outboundSending.mailbox, { slug });
  const disconnect = useMutation(api.connections.disconnect);
  if (!m || m.isDemo) return null;
  return (
    <section aria-labelledby="mailbox-heading" className="flex flex-col gap-3">
      <div>
        <h2 id="mailbox-heading" className="heading-section">
          Your mailbox
        </h2>
        <p className="mt-0.5 text-sm text-ink-3">Send Find-customers emails from your own address. ClimbOS reads only replies and bounces, to stop sequences.</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4">
        <span className="flex items-center gap-2 text-ui text-ink">
          <Mail aria-hidden className="size-4 text-brand-800" /> {m.connected ? m.label : "Not connected"} {m.connected ? <Badge tone="green">Connected</Badge> : null}
        </span>
        {m.canManage ? (
          m.connected ? (
            <Button variant="secondary" size="sm" onClick={() => disconnect({ slug, provider: "email_mailbox" })}>
              Disconnect
            </Button>
          ) : (
            <ConnectMailbox slug={slug} label="Connect" />
          )
        ) : null}
      </div>
    </section>
  );
}
