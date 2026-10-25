"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { ExternalLink, Eye, Plus, RefreshCw, Trash2 } from "@/components/icons"
import { useParams } from "next/navigation";
import { useState } from "react";
import { errorMessage } from "@/components/app/errors";
import { relativeTime } from "@/components/app/money";
import { Scannable, toBullets } from "@/components/ds/content";
import { LoadingBlock, PageHeader } from "@/components/app/results/QueryBoundary";
import { Button, Callout, Card, CardContent, EmptyState, Input, toast } from "@/components/ui";

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
        title="Similar businesses"
        intro={`${data.watches.length} of ${data.limit} · checked Mondays`}
        actions={
          data.watches.length ? (
            <Button size="sm" variant="secondary" loading={busy === "check"} onClick={() => run("check", () => checkNow({ slug }), "Checking now")}>
              <RefreshCw aria-hidden /> Check
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
                    <p className="truncate text-xs text-ink-3">{w.url.replace(/^https?:\/\//, "")}</p>
                    <p className={w.lastError ? "text-xs text-red-800" : "text-xs text-ink-3"}>{w.lastError ? `Couldn't read: ${w.lastError}` : w.lastCheckedAt ? `Checked ${relativeTime(w.lastCheckedAt)}` : "Reading…"}</p>
                  </div>
                  <Button size="sm" variant="ghost" aria-label={`Stop watching ${w.name}`} onClick={() => run("rm", () => remove({ slug, id: w.id }))}>
                    <Trash2 aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
          {data.suggested.length && !full ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-ink-2">Similar businesses found in your research</p>
              {data.suggested.map((s) => (
                <div key={s.url} className="rounded-lg border border-line bg-surface-2 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">{s.name}</p>
                      <p className="text-xs text-ink-3">{s.kind === "direct" ? "Listed as a direct competitor in business research; customer overlap has not been confirmed." : "Competitor type is not recorded in this research; review the source before adding it."}</p>
                    </div>
                    <Button size="sm" variant="secondary" loading={busy === s.url} onClick={() => run(s.url, () => add({ slug, name: s.name, url: s.url }), `Watching ${s.name}`)}>
                      <Plus aria-hidden /> Add to watch list
                    </Button>
                  </div>
                  {s.comparison?.length ? (
                    <details className="mt-2 rounded-[var(--radius-control)] border border-line px-3 py-2">
                      <summary className="min-h-8 cursor-pointer py-1 text-xs font-medium text-ink-2">Why it may be relevant</summary>
                      <div className="mt-2 flex flex-col gap-2">
                        {s.comparison.map((item, index) => (
                          <div key={`${item.dimension}-${item.sourceUrl}-${index}`} className="grid min-w-0 gap-1 border-t border-line pt-2 text-xs sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-x-3">
                            <span className="font-medium capitalize text-ink-2">{item.dimension.replaceAll("_", " ")}</span>
                            <div className="min-w-0 space-y-1.5">
                              <p className="break-words text-ink"><span className="font-medium">Research summary: </span>{item.finding}</p>
                              <p className="break-words text-ink-2"><span className="font-medium">Possible relevance: </span>{item.implication}</p>
                              <a className="inline-flex max-w-full break-all font-medium text-brand underline underline-offset-2" href={item.sourceUrl} target="_blank" rel="noopener noreferrer">Open source page</a>
                            </div>
                          </div>
                        ))}
                        <p className="text-xs text-ink-3">These page claims do not prove that customers choose this business or that the comparison fits your market.</p>
                      </div>
                    </details>
                  ) : <p className="mt-2 text-xs text-ink-3">No comparison detail was recorded. <a className="font-medium text-brand underline underline-offset-2" href={s.sourceUrl} target="_blank" rel="noopener noreferrer">Review the research source</a> before adding it.</p>}
                </div>
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
          {full && data.limit === 1 ? <p className="text-xs text-ink-3">Packages watch up to 5.</p> : null}
        </CardContent>
      </Card>
      {data.changes.length === 0 ? (
        <EmptyState icon={<Eye />} title="No changes yet" body="Price and offer changes show here." />
      ) : (
        <ul className="flex flex-col gap-3">
          {data.changes.map((c) => (
            <li key={c.id}>
              <Card>
                <CardContent className="flex flex-col gap-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="text-sm font-semibold text-ink">{c.name}</h2>
                    <span className="shrink-0 text-xs text-ink-3">{relativeTime(c.at)}</span>
                  </div>
                  {c.bullets.length || toBullets(c.summary).length < 2 ? <p className="max-w-[70ch] text-sm font-medium leading-relaxed text-ink">{c.summary}</p> : null}
                  {c.bullets.length ? (
                    <Scannable text={c.bullets.map((b) => `- ${b}`).join("\n")} shape="bullets" max={3} tone="muted" />
                  ) : toBullets(c.summary).length > 1 ? (
                    <Scannable text={c.summary} max={3} tone="muted" />
                  ) : null}
                  {c.soWhat ? <Callout tone="info">{c.soWhat}</Callout> : null}
                  <div className="rounded-lg border border-line bg-surface-2 p-3">
                    <p className="text-xs font-semibold text-ink">AI interpretation of observed page changes</p>
                    {c.sourceUrls.length ? (
                      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                        {c.sourceUrls.filter((url) => /^https?:\/\//i.test(url)).map((url) => (
                          <li key={url}>
                            <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 break-all text-xs font-medium text-brand underline underline-offset-2">
                              View source <ExternalLink aria-hidden className="size-3 shrink-0" />
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="mt-1 text-xs text-ink-3">No source page was saved for this change.</p>}
                    {c.evidence ? (
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {c.evidence.removed.length ? <div><p className="text-xs font-medium text-ink-2">Text no longer observed</p><ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-ink-3">{c.evidence.removed.slice(0, 3).map((line, i) => <li key={`${i}-${line}`}>{line}</li>)}</ul></div> : null}
                        {c.evidence.added.length ? <div><p className="text-xs font-medium text-ink-2">New text observed</p><ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-ink-3">{c.evidence.added.slice(0, 3).map((line, i) => <li key={`${i}-${line}`}>{line}</li>)}</ul></div> : null}
                      </div>
                    ) : null}
                  </div>
                  {c.suggestedAction ? (
                    <Callout tone="warning" title="Possible test idea · review before acting">
                      <p className="font-medium">{c.suggestedAction.action}</p>
                      {c.suggestedAction.evidenceQuote ? <blockquote className="mt-2 break-words border-l-2 border-line pl-3 text-xs text-ink-2"><span className="font-medium">Page change behind this idea:</span> “{c.suggestedAction.evidenceQuote}”</blockquote> : null}
                      <p className="mt-1">First step: {c.suggestedAction.firstStep}</p>
                      <p className="mt-1">Success signal: {c.suggestedAction.successMetric} · review after {c.suggestedAction.reviewAfterDays} days</p>
                      <p className="mt-1 text-xs">Caveat: {c.suggestedAction.caveat}</p>
                    </Callout>
                  ) : null}
                  <p className="text-xs text-ink-3">A changed competitor page is a market signal. It does not show why customers choose that competitor or prove a test will work for your business.</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
