"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { ExternalLink, FileText, Plus, Trash2, X } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { AbTestPanel } from "@/components/app/AbTestPanel";
import { RunProgressCompact } from "@/components/app/content/RunProgress";
import { errorMessage } from "@/components/app/errors";
import { LoadingBlock, PageHeader } from "@/components/app/results/QueryBoundary";
import { Badge, Button, Card, CardContent, ColorPicker, EmptyState, Field, Input, Switch, Textarea, toast } from "@/components/ui";
import type { LandingContent } from "../../../../../shared/landing";

/** Landing pages: Climb AI writes the page, you edit and publish. Leads go to Pipeline and Inbox. */
export default function PagesPage() {
  const { organization: slug } = useParams<{ organization: string }>();
  const data = useQuery(api.landing.list, { slug });
  const create = useMutation(api.landing.create);
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<Id<"landingPages"> | null>(null);
  if (data === undefined) return <LoadingBlock label="Loading pages…" lines={3} />;
  const open = data.pages.find((p) => p.id === openId) ?? null;
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <PageHeader section="pages" title="Landing pages" intro="One focused page per offer, written from your business facts. Edit any line, publish, share the link. Form leads land in your Pipeline and Inbox." />
      <Card>
        <CardContent className="flex flex-col gap-3">
          <Field label="What's the page for?" hint="E.g. “Free 15-minute SEO audit for dentists” or “Autumn menu tasting night”.">
            <Textarea value={brief} onChange={(e) => setBrief(e.target.value.slice(0, 600))} rows={2} autosize />
          </Field>
          <Button
            className="self-start"
            loading={busy}
            disabled={brief.trim().length < 4}
            onClick={async () => {
              setBusy(true);
              try {
                const id = await create({ slug, brief });
                setBrief("");
                setOpenId(id);
              } catch (e) {
                toast({ tone: "danger", title: errorMessage(e) });
              } finally {
                setBusy(false);
              }
            }}
          >
            <Plus aria-hidden /> Write the page
          </Button>
          <p className="text-xs text-ink-3">About 2 credits. {data.liveLimit === 1 ? "Free: 1 live page." : `Up to ${data.liveLimit} live pages.`}</p>
        </CardContent>
      </Card>
      {data.pages.length === 0 ? (
        <EmptyState icon={<FileText />} title="No pages yet" body="Describe an offer above. Your team writes the page in about a minute." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {data.pages.map((p) => (
            <li key={p.id}>
              <Card className="h-full">
                <CardContent className="flex flex-col gap-2">
                  <p className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold text-ink">{p.content?.headline ?? p.title}</span>
                    <Badge tone={p.status === "live" ? "green" : p.status === "failed" ? "red" : p.status === "drafting" ? "blue" : "neutral"}>{p.status === "live" ? "Live" : p.status === "failed" ? "Didn't finish" : p.status === "drafting" ? "Writing" : "Draft"}</Badge>
                  </p>
                  {p.status === "drafting" && p.runId ? <RunProgressCompact slug={slug} runId={p.runId} /> : null}
                  <p className="text-xs text-ink-3">
                    {p.views} views · {p.leads} leads{p.views ? ` · ${Math.round((p.leads / p.views) * 100)}% convert` : ""}
                  </p>
                  {p.content ? (
                    <Button size="sm" variant="secondary" className="self-start" onClick={() => setOpenId(p.id)}>
                      Edit and publish
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {open?.content ? <Editor key={open.id} slug={slug} page={open} content={open.content} onClose={() => setOpenId(null)} /> : null}
    </div>
  );
}

type Page = NonNullable<ReturnType<typeof useQuery<typeof api.landing.list>>>["pages"][number];

function Editor({ slug, page, content, onClose }: { slug: string; page: Page; content: LandingContent; onClose: () => void }) {
  const update = useMutation(api.landing.update);
  const setLive = useMutation(api.landing.setLive);
  const remove = useMutation(api.landing.remove);
  const [c, setC] = useState<LandingContent>(content);
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
  const lines = (arr: string[]) => arr.join("\n");
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="heading-card">Edit page</p>
          <div className="flex items-center gap-2">
            <ColorPicker label="Page colour" value={page.color} onChange={(hex) => run("color", () => update({ slug, id: page.id, color: hex }))} />
            <Button size="sm" variant="ghost" aria-label="Close editor" onClick={onClose}>
              <X aria-hidden />
            </Button>
          </div>
        </div>
        <Field label="Headline">
          <Input value={c.headline} onChange={(e) => setC({ ...c, headline: e.target.value })} />
        </Field>
        <Field label="Subhead">
          <Textarea value={c.subhead} onChange={(e) => setC({ ...c, subhead: e.target.value })} rows={2} autosize />
        </Field>
        {c.benefits.map((b, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <Input aria-label={`Benefit ${i + 1} title`} value={b.title} onChange={(e) => setC({ ...c, benefits: c.benefits.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} />
            <Input aria-label={`Benefit ${i + 1} text`} value={b.text} onChange={(e) => setC({ ...c, benefits: c.benefits.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} />
          </div>
        ))}
        <Field label="Steps" hint="One per line.">
          <Textarea value={lines(c.steps)} onChange={(e) => setC({ ...c, steps: e.target.value.split("\n") })} rows={3} autosize />
        </Field>
        <Field label="Proof or promise" hint="Only real facts. No made-up reviews or numbers.">
          <Textarea value={c.proof} onChange={(e) => setC({ ...c, proof: e.target.value })} rows={2} autosize />
        </Field>
        {c.faq.map((q, i) => (
          <div key={i} className="grid gap-2">
            <Input aria-label={`Question ${i + 1}`} value={q.q} onChange={(e) => setC({ ...c, faq: c.faq.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)) })} />
            <Textarea aria-label={`Answer ${i + 1}`} value={q.a} onChange={(e) => setC({ ...c, faq: c.faq.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)) })} rows={2} autosize />
          </div>
        ))}
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Button">
            <Input value={c.ctaLabel} onChange={(e) => setC({ ...c, ctaLabel: e.target.value })} />
          </Field>
          <Field label="Form intro">
            <Input value={c.formIntro} onChange={(e) => setC({ ...c, formIntro: e.target.value })} />
          </Field>
        </div>
        {page.status === "live" ? <AbTestPanel slug={slug} kind="landing" targetId={page.id} current={content.headline} canEdit /> : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button loading={busy === "save"} onClick={() => run("save", () => update({ slug, id: page.id, content: { ...c, steps: c.steps.filter((s) => s.trim()) } }), "Saved")}>
            Save
          </Button>
          <Switch label="Live" checked={page.status === "live"} onCheckedChange={(on) => run("live", () => update({ slug, id: page.id, content: c }).then(() => setLive({ slug, id: page.id, live: on })), on ? "Page is live" : "Page is offline")} />
          {page.status === "live" ? (
            <a href={page.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-brand-800 underline-offset-2 hover:underline">
              {page.url.replace(/^https?:\/\//, "")} <ExternalLink className="size-3.5" aria-hidden />
            </a>
          ) : null}
          <Button variant="ghost" size="sm" className="ml-auto text-red-800" onClick={() => run("rm", async () => { await remove({ slug, id: page.id }); onClose(); })}>
            <Trash2 aria-hidden /> Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
