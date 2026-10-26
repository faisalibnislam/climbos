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
import { Badge, Button, Card, CardContent, ColorPicker, ConfirmDialog, EmptyState, Field, Input, Select, Switch, Textarea, toast } from "@/components/ui";
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
      {open?.content ? <Editor key={open.id} slug={slug} page={open} content={open.content} businessName={data.businessName} website={data.website} badge={data.badge} canEdit={data.canEdit} canPublish={data.canPublish} onClose={() => setOpenId(null)} /> : null}
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

function Editor({ slug, page, content, businessName, website, badge, canEdit, canPublish, onClose }: { slug: string; page: Page; content: LandingContent; businessName: string; website: string | null; badge: boolean; canEdit: boolean; canPublish: boolean; onClose: () => void }) {
  const update = useMutation(api.landing.update);
  const saveMeasurementPlan = useMutation(api.landing.saveDesignMeasurementPlan);
  const setLive = useMutation(api.landing.setLive);
  const restoreVersion = useMutation(api.landing.restoreVersion);
  const history = useQuery(api.landing.history, { slug, id: page.id });
  const remove = useMutation(api.landing.remove);
  const [c, setC] = useState<LandingContent>(content);
  const [busy, setBusy] = useState<string | null>(null);
  const [measurementMetric, setMeasurementMetric] = useState(page.designMeasurementPlan?.metric ?? "");
  const [measurementMethod, setMeasurementMethod] = useState(page.designMeasurementPlan?.method ?? page.designCriticSource?.suggestedMeasurementPlan ?? "");
  const [baselineState, setBaselineState] = useState<"recorded" | "unknown">(page.designMeasurementPlan?.baseline.state ?? "unknown");
  const [baselineValue, setBaselineValue] = useState(page.designMeasurementPlan?.baseline.state === "recorded" ? page.designMeasurementPlan.baseline.value : "");
  const [baselineSource, setBaselineSource] = useState(page.designMeasurementPlan?.baseline.state === "recorded" ? page.designMeasurementPlan.baseline.source : "");
  const [baselineReason, setBaselineReason] = useState(page.designMeasurementPlan?.baseline.state === "unknown" ? page.designMeasurementPlan.baseline.reason : "");
  const [baselineCollectionPlan, setBaselineCollectionPlan] = useState(page.designMeasurementPlan?.baseline.state === "unknown" ? page.designMeasurementPlan.baseline.collectionPlan : "");
  const [measurementAudience, setMeasurementAudience] = useState(page.designMeasurementPlan?.audience ?? "");
  const [measurementGuardrail, setMeasurementGuardrail] = useState(page.designMeasurementPlan?.guardrail ?? "");
  const [observationDays, setObservationDays] = useState(page.designMeasurementPlan?.observationDays ? String(page.designMeasurementPlan.observationDays) : "");
  const [decisionRule, setDecisionRule] = useState(page.designMeasurementPlan?.decisionRule ?? "");
  const observationDaysValid = /^\d+$/.test(observationDays.trim()) && Number(observationDays) >= 1 && Number(observationDays) <= 365;
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
  const measurementPlanCurrent = page.designMeasurementPlan?.appliesToVersion === page.version;
  const hasUnsavedChanges = JSON.stringify({ ...c, steps: c.steps.filter((step) => step.trim()) }) !== JSON.stringify(content);
  const savedMeasurementPlan = page.designMeasurementPlan;
  const hasUnsavedMeasurementChanges = Boolean(savedMeasurementPlan && (
    measurementMetric.trim() !== savedMeasurementPlan.metric ||
    measurementMethod.trim() !== savedMeasurementPlan.method ||
    measurementAudience.trim() !== (savedMeasurementPlan.audience ?? "") ||
    measurementGuardrail.trim() !== (savedMeasurementPlan.guardrail ?? "") ||
    observationDays.trim() !== (savedMeasurementPlan.observationDays ? String(savedMeasurementPlan.observationDays) : "") ||
    decisionRule.trim() !== (savedMeasurementPlan.decisionRule ?? "") ||
    baselineState !== savedMeasurementPlan.baseline.state ||
    (baselineState === "recorded" && savedMeasurementPlan.baseline.state === "recorded" && (baselineValue.trim() !== savedMeasurementPlan.baseline.value || baselineSource.trim() !== savedMeasurementPlan.baseline.source)) ||
    (baselineState === "unknown" && savedMeasurementPlan.baseline.state === "unknown" && (baselineReason.trim() !== savedMeasurementPlan.baseline.reason || baselineCollectionPlan.trim() !== savedMeasurementPlan.baseline.collectionPlan))
  ));
  const canPublishCurrentVersion = (!page.designCriticSource || measurementPlanCurrent) && !hasUnsavedChanges && !hasUnsavedMeasurementChanges;
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
        <LandingDraftPreview name={businessName} color={page.color} content={c} website={website} badge={badge} />
        {page.designCriticSource ? <section className="rounded-[var(--radius-card)] border border-line bg-surface-2/60 p-4">
          <h3 className="heading-card">Measure this design change</h3>
          <p className="mt-1 text-sm text-ink-2">Choose what result to watch and how you will check it before publishing. ClimbOS can report this page&apos;s own views and leads, but those counts do not prove what caused a change.</p>
          {page.designCriticSource.suggestedMeasurementPlan ? <p className="mt-3 rounded-md bg-surface p-3 text-sm text-ink-2"><span className="font-medium text-ink">Design Critic suggestion; review before using: </span>{page.designCriticSource.suggestedMeasurementPlan}</p> : null}
          <fieldset disabled={!canEdit} className="mt-3 grid gap-3">
            <Field label="What result will you track?" hint="For example, qualified enquiries or completed bookings.">
              <Input value={measurementMetric} onChange={(event) => setMeasurementMetric(event.target.value.slice(0, 160))} maxLength={160} />
            </Field>
            <Field label="How will you measure it?" hint="Name the data source, comparison, and observation window where known.">
              <Textarea value={measurementMethod} onChange={(event) => setMeasurementMethod(event.target.value.slice(0, 600))} rows={3} autosize maxLength={600} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Who is it measured on?" hint="For example, visitors arriving from your Google profile."><Input value={measurementAudience} onChange={(event) => setMeasurementAudience(event.target.value.slice(0, 240))} maxLength={240} /></Field>
              <Field label="What must not get worse?" hint="A guardrail, such as refund requests or support calls."><Input value={measurementGuardrail} onChange={(event) => setMeasurementGuardrail(event.target.value.slice(0, 240))} maxLength={240} /></Field>
              <Field label="How many days will you watch it?" hint="1 to 365 days."><Input inputMode="numeric" value={observationDays} onChange={(event) => setObservationDays(event.target.value.replace(/\D/g, "").slice(0, 3))} /></Field>
              <Field label="What will you do with the result?" hint="When you will keep, change or roll back the page."><Input value={decisionRule} onChange={(event) => setDecisionRule(event.target.value.slice(0, 300))} maxLength={300} /></Field>
            </div>
            <Field label="Do you have a current baseline?" hint="A baseline is the current result before a change goes live.">
              <Select value={baselineState} onValueChange={(value) => setBaselineState(value as "recorded" | "unknown")} options={[{ value: "recorded", label: "Yes, I have a current result" }, { value: "unknown", label: "Not yet; keep it unknown" }]} />
            </Field>
            {baselineState === "recorded" ? <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Current result" hint="Include its unit and the period it covers."><Input value={baselineValue} onChange={(event) => setBaselineValue(event.target.value.slice(0, 240))} maxLength={240} /></Field>
              <Field label="Where did it come from?" hint="For example, an analytics report and date."><Input value={baselineSource} onChange={(event) => setBaselineSource(event.target.value.slice(0, 240))} maxLength={240} /></Field>
            </div> : <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Why is it unknown?"><Input value={baselineReason} onChange={(event) => setBaselineReason(event.target.value.slice(0, 240))} maxLength={240} /></Field>
              <Field label="How will you collect it?" hint="If no baseline is available, say what you will record and when."><Input value={baselineCollectionPlan} onChange={(event) => setBaselineCollectionPlan(event.target.value.slice(0, 300))} maxLength={300} /></Field>
            </div>}
            <div className="flex flex-wrap items-center gap-3">
              {canEdit ? <Button size="sm" variant="secondary" disabled={busy === "measurement" || !measurementMetric.trim() || !measurementMethod.trim() || !measurementAudience.trim() || !measurementGuardrail.trim() || !observationDaysValid || !decisionRule.trim() || (baselineState === "recorded" ? !baselineValue.trim() || !baselineSource.trim() : !baselineReason.trim() || !baselineCollectionPlan.trim())} loading={busy === "measurement"} onClick={() => run("measurement", () => saveMeasurementPlan({ slug, id: page.id, expectedVersion: page.version, metric: measurementMetric, method: measurementMethod, audience: measurementAudience, guardrail: measurementGuardrail, observationDays: Number(observationDays), decisionRule, baseline: baselineState === "recorded" ? { state: "recorded", value: baselineValue, source: baselineSource } : { state: "unknown", reason: baselineReason, collectionPlan: baselineCollectionPlan } }), "Measurement plan saved for this page version")}>Save measurement plan</Button> : null}
              {measurementPlanCurrent ? <Badge tone="green">Saved for version {page.version}</Badge> : <Badge tone="amber">Needs saving for version {page.version}</Badge>}
            </div>
            {page.designCriticSource && !measurementPlanCurrent ? <p className="text-xs text-amber-900">Publishing is blocked until a measurement plan is saved for this exact page version.{!canEdit ? " Ask an owner, admin, or editor to save it." : ""}</p> : null}
          </fieldset>
        </section> : null}
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
                    {revision.designMeasurementPlan ? <span className="mt-1 block text-xs text-ink-3">Measure: {revision.designMeasurementPlan.metric} · baseline {revision.designMeasurementPlan.baseline.state === "recorded" ? "recorded" : "unknown"}</span> : null}
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
          {hasUnsavedChanges && canPublish ? <p className="w-full text-xs text-amber-900">Save your edits before reviewing or publishing them. The publish action applies only to the saved version.</p> : null}
          {hasUnsavedMeasurementChanges && canPublish ? <p className="w-full text-xs text-amber-900">Save your measurement-plan edits before reviewing or publishing them.</p> : null}
          {canEdit ? (
            <Button loading={busy === "save"} onClick={() => run("save", () => update({ slug, id: page.id, content: { ...c, steps: c.steps.filter((s) => s.trim()) } }), "Saved")}>
              Save
            </Button>
          ) : null}
          {canPublish && page.status !== "live" ? (
            <ConfirmDialog
              trigger={<Button variant="secondary" disabled={busy === "live" || !page.content || !canPublishCurrentVersion}>Publish version {page.version}</Button>}
              title={`Publish landing page version ${page.version}?`}
              description={`This approval applies to the exact saved version shown above${page.designCriticSource ? ` and its measurement plan for “${page.designMeasurementPlan?.metric}” (baseline ${page.designMeasurementPlan?.baseline.state ?? "not recorded"})` : ""}. Later edits remain drafts until reviewed and published separately.`}
              confirmLabel={`Publish version ${page.version}`}
              onConfirm={() => run("live", () => setLive({ slug, id: page.id, live: true, expectedVersion: page.version }), `Version ${page.version} is live`)}
            />
          ) : null}
          {canPublish && page.status === "live" && page.hasUnpublishedChanges ? (
            <ConfirmDialog
              trigger={<Button variant="secondary" disabled={busy === "live" || !canPublishCurrentVersion}>Publish draft version {page.version}</Button>}
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
