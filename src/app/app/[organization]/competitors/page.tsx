"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Eye, Plus, RefreshCw, Trash2 } from "@/components/icons"
import { useParams } from "next/navigation";
import { useState } from "react";
import { errorMessage } from "@/components/app/errors";
import { relativeTime } from "@/components/app/money";
import { LoadingBlock, PageHeader } from "@/components/app/results/QueryBoundary";
import { Button, Card, CardContent, EmptyState, Input, toast } from "@/components/ui";

/** Competitor watch: their sites, checked weekly; only real changes reach you. */
export default function CompetitorsPage() {
  const { organization: slug } = useParams<{ organization: string }>();
  const data = useQuery(api.competitors.overview, { slug });
  const add = useMutation(api.competitors.add);
  const remove = useMutation(api.competitors.remove);
  const checkNow = useMutation(api.competitors.checkNow);
  const [f, setF] = useState({ name: "", url: "" });
  const [busy, setBusy] = useState<string | null>(null);
  async function run(key: string, fn: () => Promise<unknown>, ok?: string) {
    setBusy(key);
    try {
      await fn();
      if (ok) toast({ tone: "success", title: ok });
    } catch (e) {
      toast({ tone: "danger", title: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  }
  if (data === undefined) return <LoadingBlock label="Loading competitors…" lines={4} />;
  const full = data.watches.filter((w) => w.active).length >= data.limit;
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader
        section="competitors"
        title="Competitors"
        intro={`We read their homepage and pricing every Monday and tell you only what really changed (prices, offers, new features). Watching ${data.watches.length} of ${data.limit}.`}
        actions={
          data.watches.length ? (
            <Button size="sm" variant="secondary" loading={busy === "check"} onClick={() => run("check", () => checkNow({ slug }), "Checking now")}>
              <RefreshCw aria-hidden /> Check now
            </Button>
          ) : null
        }
      />
      <Card>
        <CardContent className="flex flex-col gap-3">
          {data.watches.length ? (
            <ul className="flex flex-col divide-y divide-line">
              {data.watches.map((w) => (
                <li key={w.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{w.name}</p>
                    <p className="truncate text-xs text-ink-3">
                      {w.url.replace(/^https?:\/\//, "")} · {w.lastError ? `Couldn't read: ${w.lastError}` : w.lastCheckedAt ? `Checked ${relativeTime(w.lastCheckedAt)}` : "First read in progress"}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" aria-label={`Stop watching ${w.name}`} onClick={() => run("rm", () => remove({ slug, id: w.id }))}>
                    <Trash2 aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
          {data.suggested.length && !full ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-ink-3">From your research:</span>
              {data.suggested.map((s) => (
                <Button key={s.url} size="sm" variant="secondary" loading={busy === s.url} onClick={() => run(s.url, () => add({ slug, name: s.name, url: s.url }), `Watching ${s.name}`)}>
                  <Plus aria-hidden /> {s.name}
                </Button>
              ))}
            </div>
          ) : null}
          <form
            className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              void run("add", async () => {
                await add({ slug, name: f.name, url: f.url });
                setF({ name: "", url: "" });
              }, "Watching");
            }}
          >
            <Input value={f.name} placeholder="Name" aria-label="Competitor name" onChange={(e) => setF({ ...f, name: e.target.value })} />
            <Input value={f.url} placeholder="competitor.com" aria-label="Competitor website" onChange={(e) => setF({ ...f, url: e.target.value })} />
            <Button type="submit" loading={busy === "add"} disabled={full || f.url.trim().length < 4}>
              <Eye aria-hidden /> Watch
            </Button>
          </form>
          {full && data.limit === 1 ? <p className="text-xs text-ink-3">Packages watch up to 5 competitors.</p> : null}
        </CardContent>
      </Card>
      {data.changes.length === 0 ? (
        <EmptyState icon={<Eye />} title="No changes yet" body="The first read sets a baseline. You'll hear from us when prices, offers or features change." />
      ) : (
        <ul className="flex flex-col gap-3">
          {data.changes.map((c) => (
            <li key={c.id}>
              <Card>
                <CardContent className="flex flex-col gap-2">
                  <p className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-ink">{c.name}</span>
                    <span className="text-xs text-ink-3">{relativeTime(c.at)}</span>
                  </p>
                  <p className="text-sm text-ink-2">{c.summary}</p>
                  {c.bullets.length ? (
                    <ul className="list-disc space-y-0.5 pl-5 text-sm text-ink-2">
                      {c.bullets.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  ) : null}
                  {c.soWhat ? <p className="rounded-lg bg-brand-50 p-2 text-sm text-brand-900">{c.soWhat}</p> : null}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
