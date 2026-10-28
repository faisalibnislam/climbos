"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Copy, Send, Trash2, Webhook } from "@/components/icons"
import { useParams } from "next/navigation";
import { useState } from "react";
import { errorMessage } from "@/components/app/errors";
import { relativeTime } from "@/components/app/money";
import { LoadingBlock, QueryBoundary } from "@/components/app/results/QueryBoundary";
import { SettingsHeader } from "@/components/app/settings/SettingsNav";
import { Badge, Button, Callout, Card, CardContent, Checkbox, Field, Input, Switch, toast } from "@/components/ui";

/** Webhooks: send ClimbOS events to Zapier, Make or your own server. */
/** Query errors (e.g. a role without access) show the shared error state, not a crash. */
export default function WebhooksPage() {
  return (
    <QueryBoundary>
      <Webhooks />
    </QueryBoundary>
  );
}

function Webhooks() {
  const { organization: slug } = useParams<{ organization: string }>();
  const data = useQuery(api.webhooks.list, { slug });
  const create = useMutation(api.webhooks.create);
  const setActive = useMutation(api.webhooks.setActive);
  const remove = useMutation(api.webhooks.remove);
  const test = useMutation(api.webhooks.test);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<Set<string>>(new Set(["lead.created", "deal.won", "booking.created"]));
  const [secret, setSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (data === undefined) return <LoadingBlock label="Loading webhooks" lines={3} />;
  const run = (fn: () => Promise<unknown>, ok?: string) => fn().then(() => ok && toast({ tone: "success", title: ok }), (e) => toast({ tone: "danger", title: errorMessage(e) }));
  return (
    <div className="flex flex-col gap-6">
      <SettingsHeader title="Webhooks" intro="To Zapier, Make or your server" />
      <Callout tone="info" title="Approval events don't publish">
        An approved draft event sends the exact approved version. It doesn&apos;t publish or authorize publishing. Long drafts are marked incomplete; use the export pack for full text.
      </Callout>
      {secret ? (
        <Callout tone="info" title="Copy signing secret now">
          <span className="flex flex-wrap items-center gap-2">
            <code className="rounded bg-surface-2 px-2 py-0.5 text-xs">{secret}</code>
            <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(secret).then(() => toast({ tone: "success", title: "Copied" }), () => undefined)}>
              <Copy aria-hidden /> Copy
            </Button>
          </span>
          <span className="mt-1 block text-xs font-medium">Shown once.</span>
          <dl className="mt-2 grid gap-x-3 gap-y-1 text-xs sm:grid-cols-[max-content_1fr]">
            <dt className="font-medium">Headers</dt>
            <dd>
              <code>X-ClimbOS-Timestamp</code>, <code>X-ClimbOS-Signature</code>
            </dd>
            <dt className="font-medium">Signature</dt>
            <dd>v1 = HMAC-SHA256 of “timestamp.body”</dd>
          </dl>
        </Callout>
      ) : null}
      <Card>
        <CardContent className="flex flex-col gap-3">
          <Field label="Endpoint URL" hint="Zapier: Catch Hook · Make: Custom webhook">
            <Input value={url} placeholder="https://hooks.zapier.com/hooks/catch/…" onChange={(e) => setUrl(e.target.value)} />
          </Field>
          <div className="grid gap-2 sm:grid-cols-2">
            {data.events.map((e) => (
              <Checkbox
                key={e.key}
                label={e.key}
                description={e.label}
                checked={events.has(e.key)}
                onCheckedChange={(on) => {
                  const next = new Set(events);
                  if (on) next.add(e.key);
                  else next.delete(e.key);
                  setEvents(next);
                }}
              />
            ))}
          </div>
          <Button
            className="self-start"
            loading={busy}
            disabled={!url.trim() || events.size === 0}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await create({ slug, url, events: [...events] });
                setSecret(r.secret);
                setUrl("");
              } catch (e) {
                toast({ tone: "danger", title: errorMessage(e) });
              } finally {
                setBusy(false);
              }
            }}
          >
            <Webhook aria-hidden /> Add webhook
          </Button>
        </CardContent>
      </Card>
      {data.endpoints.map((e) => (
        <Card key={e.id}>
          <CardContent className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="truncate text-sm font-medium text-ink">{e.url}</p>
              <div className="flex items-center gap-2">
                <Switch label="On" checked={e.active} onCheckedChange={(on) => run(() => setActive({ slug, id: e.id, active: on }))} />
                <Button size="sm" variant="secondary" onClick={() => run(() => test({ slug, id: e.id }), "Test sent")}>
                  <Send aria-hidden /> Test
                </Button>
                <Button size="sm" variant="ghost" aria-label="Delete webhook" onClick={() => run(() => remove({ slug, id: e.id }), "Webhook deleted")}>
                  <Trash2 aria-hidden />
                </Button>
              </div>
            </div>
            <ul className="flex flex-wrap gap-1" aria-label="Events sent">
              {e.events.map((ev) => (
                <li key={ev}>
                  <Badge tone="neutral">{ev}</Badge>
                </li>
              ))}
            </ul>
            {!e.active && e.failures >= 20 ? (
              <Callout tone="danger" live="none" title="Off after 20 failures in a row">
                Fix it, then switch on.
              </Callout>
            ) : null}
            {e.recent.length ? (
              <ul className="flex flex-col gap-1 text-xs text-ink-3">
                {e.recent.map((d) => (
                  <li key={d.id} className="flex items-center gap-2">
                    <Badge tone={d.status === "delivered" ? "green" : d.status === "failed" ? "red" : "blue"}>{d.status === "delivered" ? `Delivered${d.code ? ` · ${d.code}` : ""}` : d.status === "failed" ? `Failed${d.code ? ` · ${d.code}` : ""}` : "Retrying"}</Badge>
                    {d.event} · {relativeTime(d.at)}
                  </li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
