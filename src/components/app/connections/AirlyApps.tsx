"use client";

import { useAction, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Unplug } from "@/components/icons"
import { useState } from "react";
import { relativeTime } from "../money";
import { errorMessage } from "../errors";
import { KeyValueList } from "@/components/ds/data/display";
import { Badge, Button, Callout, Card, CardContent, Field, Input, Select, toast } from "@/components/ui";

type App = NonNullable<ReturnType<typeof useQuery<typeof api.airly.overview>>>[number];

/** Your other Airly apps: Formkit and Meetrao feed leads in; Taskeni and Folevi receive plans and to-dos. */
export function AirlyApps({ slug, canManage }: { slug: string; canManage: boolean }) {
  const apps = useQuery(api.airly.overview, { slug });
  if (!apps) return null;
  return (
    <section aria-labelledby="airly-heading" className="flex flex-col gap-3">
      <div>
        <h2 id="airly-heading" className="heading-section">
          Airly apps
        </h2>
        <p className="text-sm text-ink-3">One token per app.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {apps.map((a) => (
          <AppCard key={a.app} slug={slug} a={a} canManage={canManage} />
        ))}
      </div>
    </section>
  );
}

function AppCard({ slug, a, canManage }: { slug: string; a: App; canManage: boolean }) {
  const connect = useAction(api.airlyActions.connect);
  const disconnect = useAction(api.airlyActions.disconnect);
  const options = useAction(api.airlyActions.options);
  const choose = useAction(api.airlyActions.choose);
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState("");
  const [base, setBase] = useState("");
  const [busy, setBusy] = useState(false);
  const [choices, setChoices] = useState<{ id: string; name: string }[] | null>(null);
  const pick = a.app === "taskeni" ? "board" : a.app === "folevi" ? "place" : null;
  return (
    <Card>
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium text-ink">{a.name}</p>
          {a.link ? <Badge tone={a.link.status === "connected" ? "green" : "red"}>{a.link.status === "connected" ? "Connected" : "Needs attention"}</Badge> : <Badge tone="neutral">Not connected</Badge>}
        </div>
        <p className="text-sm text-ink-3">{a.what}</p>
        {a.link ? (
          <>
            <KeyValueList
              variant="inline"
              items={[
                ...(a.link.label ? [{ k: "Account", v: a.link.label }] : []),
                ...(a.link.lastSyncAt ? [{ k: "Synced", v: relativeTime(a.link.lastSyncAt) }] : []),
                ...(a.link.imported ? [{ k: "Imported", v: String(a.link.imported) }] : []),
              ]}
            />
            {a.link.error ? <Callout tone="danger" live="none">{a.link.error}</Callout> : null}
            {pick && canManage ? (
              choices ? (
                <Field label={pick === "board" ? "Board for new tasks" : "Where notes go"}>
                  <Select options={choices.map((c) => ({ value: c.id, label: c.name }))} value={a.link.settings[pick] ?? choices[0]?.id ?? ""} onValueChange={(v) => choose({ slug, app: a.app, value: v }).then(() => toast({ tone: "success", title: "Saved" }), (e) => toast({ tone: "danger", title: errorMessage(e) }))} />
                </Field>
              ) : (
                <Button size="sm" variant="ghost" className="self-start" onClick={() => options({ slug, app: a.app }).then(setChoices, (e) => toast({ tone: "danger", title: errorMessage(e) }))}>
                  Choose {pick === "board" ? "board" : "place"}
                </Button>
              )
            ) : null}
            {canManage ? (
              <Button size="sm" variant="ghost" className="self-start" onClick={() => disconnect({ slug, app: a.app }).then(() => toast({ tone: "success", title: `${a.name} disconnected` }))}>
                <Unplug aria-hidden /> Disconnect
              </Button>
            ) : null}
          </>
        ) : canManage ? (
          open ? (
            <div className="flex flex-col gap-2">
              <Field label="Token" hint={a.tokenHelp}>
                <Input value={token} type="password" autoComplete="off" onChange={(e) => setToken(e.target.value)} />
              </Field>
              {a.needsBase ? (
                <Field label="API base" hint="Ends with /api/v1">
                  <Input value={base} placeholder="https://….convex.site/api/v1" onChange={(e) => setBase(e.target.value)} />
                </Field>
              ) : null}
              <Button
                size="sm"
                className="self-start"
                loading={busy}
                disabled={token.trim().length < 8}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const r = await connect({ slug, app: a.app, token, base: base || undefined });
                    toast({ tone: r.ok ? "success" : "danger", title: r.message });
                    if (r.ok) {
                      setToken("");
                      setOpen(false);
                    }
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Connect
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="secondary" className="self-start" aria-label={`Connect ${a.name}`} onClick={() => setOpen(true)}>
              Connect
            </Button>
          )
        ) : null}
      </CardContent>
    </Card>
  );
}

/** On the plan: send the to-dos to Taskeni or save the plan to Folevi, when connected. */
export function PlanToAirly({ slug }: { slug: string }) {
  const apps = useQuery(api.airly.overview, { slug });
  const toTaskeni = useAction(api.airlyActions.sendPlanToTaskeni);
  const toFolevi = useAction(api.airlyActions.savePlanToFolevi);
  const [busy, setBusy] = useState<string | null>(null);
  const taskeni = apps?.find((x) => x.app === "taskeni")?.link;
  const folevi = apps?.find((x) => x.app === "folevi")?.link;
  if (!taskeni && !folevi) return null;
  const run = async (key: string, fn: () => Promise<{ url: string | null; created?: number }>, ok: (r: { url: string | null; created?: number }) => string) => {
    setBusy(key);
    try {
      const r = await fn();
      toast({ tone: "success", title: ok(r), description: r.url ?? undefined });
    } catch (e) {
      toast({ tone: "danger", title: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="flex flex-wrap gap-2">
      {taskeni ? (
        <Button size="sm" variant="secondary" loading={busy === "t"} onClick={() => run("t", () => toTaskeni({ slug }), (r) => `Sent ${r.created ?? 0} to-dos to Taskeni`)}>
          Send to Taskeni
        </Button>
      ) : null}
      {folevi ? (
        <Button size="sm" variant="secondary" loading={busy === "f"} onClick={() => run("f", () => toFolevi({ slug }), () => "Saved to Folevi")}>
          Save to Folevi
        </Button>
      ) : null}
    </div>
  );
}
