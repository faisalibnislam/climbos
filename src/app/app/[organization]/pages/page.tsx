"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { ExternalLink, FileText, Plus, RotateCcw, Trash2, X } from "@/components/icons"
import { useParams } from "next/navigation";
import { use, useState } from "react";
import { AbTestPanel } from "@/components/app/AbTestPanel";
import { BioEditor } from "@/components/app/BioEditor";
import { RunProgressCompact } from "@/components/app/content/RunProgress";
import { errorMessage } from "@/components/app/errors";
import { LandingDraftPreview } from "@/components/app/landing/LandingDraftPreview";
import { LoadingBlock, PageHeader } from "@/components/app/results/QueryBoundary";
import { Badge, Button, Card, CardContent, ColorPicker, ConfirmDialog, EmptyState, Field, Input, Switch, Textarea, toast } from "@/components/ui";
import { KeyValueList } from "@/components/ds/data/display";
import type { LandingContent } from "../../../../../shared/landing";

/** Landing pages: Climb AI writes the page, you edit and publish. Leads go to Pipeline and Inbox. */
export default function PagesPage({ searchParams }: { searchParams: Promise<{ brief?: string | string[]; designRunId?: string | string[]; designFindingIndex?: string | string[]; designDirectionId?: string | string[] }> }) {
  const { organization: slug } = useParams<{ organization: string }>();
  const params = use(searchParams);
  const requestedBrief = params.brief;
  const requestedRunId = params.designRunId;
  const requestedFindingIndex = params.designFindingIndex;
  const requestedDirectionId = params.designDirectionId;
  const data = useQuery(api.landing.list, { slug });
  const create = useMutation(api.landing.create);
  const retry = useMutation(api.landing.retry);
  const remove = useMutation(api.landing.remove);
  const [brief, setBrief] = useState(() => typeof requestedBrief === "string" ? requestedBrief.slice(0, 2400) : "");
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<Id<"landingPages"> | null>(null);
  if (data === undefined) return <LoadingBlock label="Loading pages…" lines={3} />;
  const open = data.pages.find((p) => p.id === openId) ?? null;
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <PageHeader section="pages" title="Landing pages" />
      {data.canEdit ? (
        <Card>
          <CardContent className="flex flex-col gap-3">
            {typeof requestedRunId === "string" && typeof requestedFindingIndex === "string" && typeof requestedDirectionId === "string" ? <p className="rounded-md bg-surface-2/70 p-3 text-sm text-ink-2">This new page draft will keep a link to the saved Design Critic finding and direction. It will not change the reviewed website.</p> : null}
            <Field label="What's the page for?">
              <Textarea value={brief} onChange={(e) => setBrief(e.target.value.slice(0, 2400))} rows={4} autosize placeholder="e.g. Free SEO audit for dentists" />
            </Field>
            <Button
              className="self-start"
              loading={busy}
              disabled={brief.trim().length < 4}
              onClick={async () => {
                setBusy(true);
                try {
                  const findingIndex = typeof requestedFindingIndex === "string" ? Number(requestedFindingIndex) : Number.NaN;
                  const hasDesignSource = typeof requestedRunId === "string" && typeof requestedDirectionId === "string" && Number.isSafeInteger(findingIndex) && findingIndex >= 0;
                  const id = await create({ slug, brief, ...(hasDesignSource ? { designCriticSource: { runId: requestedRunId as Id<"workflowRuns">, findingIndex, directionId: requestedDirectionId } } : {}) });
                  setBrief("");
                  setOpenId(id);
                } catch (e) {
                  toast({ tone: "danger", title: errorMessage(e) });
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Plus aria-hidden /> Write page
            </Button>
            <p className="text-xs text-ink-3">~2 credits · {data.liveLimit === 1 ? "Free: 1 live page" : `Up to ${data.liveLimit} live`}</p>
          </CardContent>
        </Card>
      ) : null}
      <BioEditor slug={slug} defaultTitle="" canEdit={data.canEdit} />
      {data.pages.length === 0 ? (
        <EmptyState icon={<FileText />} title="No pages yet" body="Describe an offer above." />
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
                  {p.designCriticSource ? <div className="rounded-md bg-surface-2/70 p-2 text-xs text-ink-2"><span className="font-medium text-ink">Design Critic source: </span>{p.designCriticSource.region || `Finding ${p.designCriticSource.findingIndex + 1}`} · {p.designCriticSource.directionName}{p.designCriticSource.sourceUrl ? <> · <a href={p.designCriticSource.sourceUrl} target="_blank" rel="noreferrer noopener" className="text-link">Open reviewed page</a></> : null}</div> : null}
                  {p.status === "drafting" && p.runId ? <RunProgressCompact slug={slug} runId={p.runId} /> : null}
                  <KeyValueList
                    variant="inline"
                    items={[
                      { k: "Views", v: p.views.toLocaleString("en-US") },
                      { k: "Leads", v: p.leads.toLocaleString("en-US") },
                      ...(p.views ? [{ k: "Convert", v: `${Math.round((p.leads / p.views) * 100)}%` }] : []),
                    ]}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    {p.content && (data.canEdit || data.canPublish) ? (
                      <Button size="sm" variant="secondary" onClick={() => setOpenId(p.id)}>
                        {data.canEdit ? "Edit" : "Publish"}
                      </Button>
                    ) : null}
                    {p.status === "failed" && data.canEdit ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => retry({ slug, id: p.id }).catch((e) => toast({ tone: "danger", title: errorMessage(e) }))}
                      >
                        <RotateCcw aria-hidden /> Try again
                      </Button>
                    ) : null}
                    {data.canEdit && p.status !== "drafting" ? <DeletePage page={p} onDelete={() => remove({ slug, id: p.id }).then(() => setOpenId((o) => (o === p.id ? null : o)))} /> : null}
                  </div>
                  {p.status === "failed" ? <p className="text-xs text-ink-3">Retry ≈ 2 credits</p> : null}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {open?.content ? <Editor key={open.id} slug={slug} page={open} content={open.content} canEdit={data.canEdit} canPublish={data.canPublish} onClose={() => setOpenId(null)} /> : null}
    </div>
  );
}

type Page = NonNullable<ReturnType<typeof useQuery<typeof api.landing.list>>>["pages"][number];

/** Delete with a confirmation: the link stops working and any running headline test ends. */
function DeletePage({ page, onDelete }: { page: Page; onDelete: () => Promise<unknown> }) {
  return (
    <ConfirmDialog
      trigger={
        <Button size="sm" variant="ghost" className="text-red-800">
          <Trash2 aria-hidden /> Delete
        </Button>
      }
      title="Delete this page?"
      description={`${page.status === "live" ? "Link stops working. " : ""}Headline tests end. Leads stay.`}
      confirmLabel="Delete"
      tone="danger"
      onConfirm={async () => {
        try {
          await onDelete();
          toast({ tone: "success", title: "Page deleted" });
        } catch (e) {
          toast({ tone: "danger", title: errorMessage(e) });
        }
      }}
    />
  );
}

function Editor({ slug, page, content, canEdit, canPublish, onClose }: { slug: string; page: Page; content: LandingContent; canEdit: boolean; canPublish: boolean; onClose: () => void }) {
  const update = useMutation(api.landing.update);
  const setLive = useMutation(api.landing.setLive);
  const restoreVersion = useMutation(api.landing.restoreVersion);
  const history = useQuery(api.landing.history, { slug, id: page.id });
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
          <h2 className="heading-card">Edit page</h2>
          <div className="flex items-center gap-2">
            {canEdit ? <ColorPicker label="Page colour" value={page.color} onChange={(hex) => run("color", () => update({ slug, id: page.id, color: hex }))} /> : null}
            <Button size="sm" variant="ghost" aria-label="Close editor" onClick={onClose}>
              <X aria-hidden />
            </Button>
          </div>
        </div>
        <fieldset disabled={!canEdit} className="flex flex-col gap-4">
          <Field label="Headline">
            <Input value={c.headline} onChange={(e) => setC({ ...c, headline: e.target.value })} />
          </Field>
          <Field label="Subhead">
            <Textarea value={c.subhead} onChange={(e) => setC({ ...c, subhead: e.target.value })} rows={2} autosize />
          </Field>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-ui font-medium text-ink">Benefits</legend>
            {c.benefits.map((b, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                <Input aria-label={`Benefit ${i + 1} title`} value={b.title} onChange={(e) => setC({ ...c, benefits: c.benefits.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} />
                <Input aria-label={`Benefit ${i + 1} text`} value={b.text} onChange={(e) => setC({ ...c, benefits: c.benefits.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} />
              </div>
            ))}
          </fieldset>
          <Field label="Steps" hint="One per line.">
            <Textarea value={lines(c.steps)} onChange={(e) => setC({ ...c, steps: e.target.value.split("\n") })} rows={3} autosize />
          </Field>
          <Field label="Proof or promise" hint="Real facts only.">
            <Textarea value={c.proof} onChange={(e) => setC({ ...c, proof: e.target.value })} rows={2} autosize />
          </Field>
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1.5 text-ui font-medium text-ink">FAQ</legend>
            {c.faq.map((q, i) => (
              <div key={i} className="grid gap-2">
                <Input aria-label={`Question ${i + 1}`} value={q.q} onChange={(e) => setC({ ...c, faq: c.faq.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)) })} />
                <Textarea aria-label={`Answer ${i + 1}`} value={q.a} onChange={(e) => setC({ ...c, faq: c.faq.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)) })} rows={2} autosize />
              </div>
            ))}
          </fieldset>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Button">
              <Input value={c.ctaLabel} onChange={(e) => setC({ ...c, ctaLabel: e.target.value })} />
            </Field>
            <Field label="Form intro">
              <Input value={c.formIntro} onChange={(e) => setC({ ...c, formIntro: e.target.value })} />
            </Field>
          </div>
        </fieldset>
        <LandingDraftPreview name={page.title} color={page.color} content={c} />
        {history?.length ? (
          <details className="rounded-[var(--radius-card)] border border-line bg-surface-2 p-3">
            <summary className="cursor-pointer text-sm font-medium text-ink">Version history ({history.length})</summary>
            <ul className="mt-3 flex flex-col gap-2">
              {history.map((revision) => (
                <li key={revision.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-control)] bg-surface p-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="font-medium text-ink">Version {revision.version}</span>
                    <span className="text-ink-3"> · {revision.kind} · {new Date(revision.createdAt).toLocaleString()}</span>
                    {revision.version === page.version ? <Badge className="ml-2" tone="brand">Current draft</Badge> : null}
                    {revision.isPublished ? <Badge className="ml-2" tone="green">Published</Badge> : null}
                  </span>
                  {canEdit && revision.version !== page.version ? (
                    <Button size="sm" variant="secondary" disabled={busy === "restore"} onClick={() => run("restore", async () => {
                      await restoreVersion({ slug, id: page.id, version: revision.version });
                    }, `Restored as a new draft version`)}>
                      Restore as draft
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        {page.status === "live" ? <AbTestPanel slug={slug} kind="landing" targetId={page.id} current={content.headline} canApprove={canPublish && !page.hasUnpublishedChanges} /> : null}
        <div className="flex flex-wrap items-center gap-3">
          {canEdit ? (
            <Button loading={busy === "save"} onClick={() => run("save", () => update({ slug, id: page.id, content: { ...c, steps: c.steps.filter((s) => s.trim()) } }), "Saved")}>
              Save
            </Button>
          ) : null}
          {canPublish && page.status !== "live" ? (
            <ConfirmDialog
              trigger={<Button variant="secondary" disabled={busy === "live" || !page.content}>Publish version {page.version}</Button>}
              title={`Publish landing page version ${page.version}?`}
              description="This approval applies to the exact saved version shown above. Later edits remain drafts until reviewed and published separately."
              confirmLabel={`Publish version ${page.version}`}
              onConfirm={() => run("live", () => setLive({ slug, id: page.id, live: true, expectedVersion: page.version }), `Version ${page.version} is live`)}
            />
          ) : null}
          {canPublish && page.status === "live" && page.hasUnpublishedChanges ? (
            <ConfirmDialog
              trigger={<Button variant="secondary" disabled={busy === "live"}>Publish draft version {page.version}</Button>}
              title={`Publish landing page version ${page.version}?`}
              description={`This replaces public version ${page.publishedVersion} with the exact saved draft version ${page.version}.`}
              confirmLabel={`Publish version ${page.version}`}
              onConfirm={() => run("live", () => setLive({ slug, id: page.id, live: true, expectedVersion: page.version }), `Version ${page.version} is live`)}
            />
          ) : null}
          {canPublish && page.status === "live" ? <Switch label="Live" checked disabled={busy === "live"} onCheckedChange={(on) => { if (!on) void run("live", () => setLive({ slug, id: page.id, live: false }), "Page is offline"); }} /> : null}
          {page.status === "live" ? (
            <a href={page.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-brand-800 underline-offset-2 hover:underline">
              {page.url.replace(/^https?:\/\//, "")} <ExternalLink className="size-3.5" aria-hidden />
            </a>
          ) : null}
          {canEdit ? (
            <span className="ml-auto">
              <DeletePage
                page={page}
                onDelete={async () => {
                  await remove({ slug, id: page.id });
                  onClose();
                }}
              />
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
