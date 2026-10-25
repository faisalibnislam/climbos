"use client";

import { AbTestPanel } from "@/components/app/AbTestPanel";
import { MailboxSending } from "@/components/app/outbound/MailboxSending";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { CalendarCheck, Check, ChevronDown, Copy, Download, ExternalLink, Loader2, Magic, Mail, MoreHorizontal, Search, Target, X } from "@/components/icons";
import { useParams, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { FUNNEL_STAGES, PROSPECT_STAGES, STAGE_LABEL, mergeEmail, prospectScore, prospectsCsv, type ProspectStage } from "../../../../../shared/outbound";
import {
  Badge,
  Button,
  Callout,
  Checkbox,
  ChoiceChips,
  ConfirmDialog,
  DatePicker,
  Dialog,
  DialogContent,
  DialogFooter,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  EmptyState,
  Field,
  FilterChip,
  FunnelChart,
  IconTile,
  Input,
  ProgressRing,
  RadioCards,
  Select,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Tooltip,
  toast,
  Segmented,
} from "@/components/ui";
import { errorMessage } from "@/components/app/errors";
import { minorToDisplay } from "@/components/app/money";
import { LoadingBlock, PageHeader } from "@/components/app/results/QueryBoundary";
import { LeadScoreCheck } from "@/components/app/outbound/LeadScoreCheck";
import { RetryRunIfPossible, RunProgress } from "@/components/app/content/RunProgress";
import { climbTarget } from "@/components/climb/context";
import { cn } from "@/lib/utils";
import { Highlight, Scannable, toBullets } from "@/components/ds/content";
import { majorToMinor } from "../../../../../shared/economics/currency";

type Data = NonNullable<ReturnType<typeof useQuery<typeof api.outbound.get>>>;
type Prospect = Data["prospects"][number];
type View = "suggested" | "approved" | "skipped" | "all";

const WHO_IDEAS: Record<string, string[]> = {
  saas: ["Agencies that set this up for clients", "Startups hiring their first marketer", "Teams switching from a big competitor"],
  ecommerce: ["Independent shops that could stock us", "Corporate gifting buyers", "Creators in our niche"],
  physical_products: ["Independent shops that could stock us", "Corporate gifting buyers", "Event and venue buyers"],
  services: ["Offices and businesses near us", "Property managers", "Event planners"],
};

/**
 * "Drop your website link. Our AI finds the people who need your product,
 * writes the emails and books the calls." Owners tick who to contact; nothing
 * is sent from here.
 */
export default function OutboundPage() {
  const { organization: slug } = useParams<{ organization: string }>();
  // A play's target list links here with ?campaign= (S6).
  const campaignId = useSearchParams().get("campaign") as Id<"outboundCampaigns"> | null;
  const data = useQuery(api.outbound.get, campaignId ? { slug, campaignId } : { slug });
  const [startOpen, setStartOpen] = useState(false);

  if (data === undefined) return <LoadingBlock label="Loading your prospects" />;
  const c = data.campaign;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        section="outbound"
        title="Find customers"
        actions={
          c && c.status !== "researching" && data.canEdit ? (
            <Button variant="secondary" onClick={() => setStartOpen(true)}>
              <Search aria-hidden /> Find more
            </Button>
          ) : null
        }
      />
      {c ? <LeadScoreCheck slug={slug} /> : null}
      {!c ? (
        <StartPanel slug={slug} businessType={data.businessType} canEdit={data.canEdit} />
      ) : c.status === "researching" ? (
        c.run ? (
          <section className="rounded-xl border border-line bg-surface p-5">
            <RunProgress slug={slug} runId={c.run.id as Id<"workflowRuns">} headingLevel="h2" />
          </section>
        ) : (
          <Researching />
        )
      ) : c.status === "failed" ? (
        <Callout tone="danger" title="This search didn't finish">
          {c.run?.message && toBullets(c.run.message).length > 1 ? <Scannable text={c.run.message} tone="muted" /> : <p>{c.run?.message ?? "Nothing was charged beyond what was used."}</p>}
          <Button size="sm" variant="secondary" className="mt-3" onClick={() => setStartOpen(true)}>
            Start over
          </Button>
          {c.run ? <RetryRunIfPossible slug={slug} runId={c.run.id} className="mt-3" /> : null}
        </Callout>
      ) : (
        <Campaign slug={slug} data={data} />
      )}
      <Dialog open={startOpen} onOpenChange={setStartOpen}>
        <DialogContent title="Find more customers" description="Skips companies already listed.">
          <StartForm slug={slug} businessType={data.businessType} onDone={() => setStartOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- Start ---------------- */

function StartPanel({ slug, businessType, canEdit }: { slug: string; businessType: string | null; canEdit: boolean }) {
  return (
    <section className="grid grid-cols-1 gap-6 rounded-xl border border-line bg-surface p-5 sm:p-6 lg:grid-cols-[1.2fr_1fr]">
      <div>
        <h2 className="heading-section">Who should we find?</h2>
        <div className="mt-4">{canEdit ? <StartForm slug={slug} businessType={businessType} /> : <p className="text-sm text-ink-3">Ask an admin to start.</p>}</div>
      </div>
      <ol className="flex flex-col gap-3" aria-label="How it works">
        {[
          { icon: Search, title: "Find", body: "Real, sourced companies" },
          { icon: Mail, title: "Write", body: "Personal emails" },
          { icon: CalendarCheck, title: "Book", body: "Calls in your calendar" },
        ].map((s, i) => (
          <li key={s.title} className="flex items-start gap-3 rounded-lg border border-line bg-surface-2 p-3">
            <IconTile icon={s.icon} tone={i === 2 ? "green" : "brand"} size="sm" />
            <p className="text-sm text-ink-3">
              <span className="font-medium text-ink">
                {i + 1}. {s.title}.
              </span>{" "}
              {s.body}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function StartForm({ slug, businessType, onDone }: { slug: string; businessType: string | null; onDone?: () => void }) {
  const start = useMutation(api.outbound.start);
  const [kind, setKind] = useState<"customers" | "creators">("customers");
  const [whoMode, setWhoMode] = useState<"auto" | "pick">("auto");
  const [whereMode, setWhereMode] = useState<"auto" | "pick">("auto");
  const [who, setWho] = useState("");
  const [where, setWhere] = useState("");
  const [count, setCount] = useState("15");
  const [busy, setBusy] = useState(false);
  const ideas = WHO_IDEAS[businessType ?? ""] ?? WHO_IDEAS.services;
  const missing = (whoMode === "pick" && !who.trim()) || (whereMode === "pick" && !where.trim());
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (missing) return;
        setBusy(true);
        try {
          const r = await start({ slug, kind, who: whoMode === "pick" ? who : "", where: whereMode === "pick" ? where : "", count: Number(count) });
          toast({ tone: "success", title: "Searching · ~10–15 min", description: r.pausedSending ? "Last search's sending paused." : undefined });
          onDone?.();
        } catch (err) {
          toast({ tone: "danger", title: errorMessage(err) });
        } finally {
          setBusy(false);
        }
      }}
    >
      <Segmented
        label="Find"
        options={[
          { value: "customers", label: "Customers" },
          { value: "creators", label: "Creators & influencers" },
        ]}
        value={kind}
        onChange={(v) => setKind(v as "customers" | "creators")}
      />
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-ui font-medium text-ink">{kind === "creators" ? "Whose audience" : "Who"}</legend>
        <RadioCards
          columns={2}
          value={whoMode}
          onValueChange={(v) => setWhoMode(v as "auto" | "pick")}
          options={[
            { value: "auto", title: "Auto", description: "From your plan" },
            { value: "pick", title: "Choose" },
          ]}
        />
        {whoMode === "pick" ? (
          <>
            <Input aria-label="Your customer" autoFocus value={who} onChange={(e) => setWho(e.target.value)} placeholder="e.g. Dental clinics with 2–10 dentists" maxLength={300} />
            <div className="flex flex-wrap gap-2">
              {ideas.map((i) => (
                <FilterChip key={i} pressed={who === i} onPressedChange={() => setWho(who === i ? "" : i)}>
                  {i}
                </FilterChip>
              ))}
            </div>
          </>
        ) : null}
      </fieldset>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-ui font-medium text-ink">Where</legend>
        <RadioCards
          columns={2}
          value={whereMode}
          onValueChange={(v) => setWhereMode(v as "auto" | "pick")}
          options={[
            { value: "auto", title: "Auto", description: "Where you sell" },
            { value: "pick", title: "Choose" },
          ]}
        />
        {whereMode === "pick" ? <Input aria-label="Your area" autoFocus value={where} onChange={(e) => setWhere(e.target.value)} placeholder="e.g. Greater Manchester" maxLength={120} /> : null}
      </fieldset>
      <div>
        <p className="mb-2 text-ui font-medium text-ink" aria-hidden>
          How many
        </p>
        <ChoiceChips
          aria-label="How many"
          value={count}
          onValueChange={setCount}
          options={[
            { value: "10", label: "10" },
            { value: "15", label: "15" },
            { value: "25", label: "25" },
          ]}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={busy} disabled={missing}>
          <Magic aria-hidden /> Find customers
        </Button>
        <span className="text-xs text-ink-3">Uses AI allowance · Nothing sent</span>
      </div>
    </form>
  );
}

function Researching() {
  return (
    <section className="flex items-start gap-4 rounded-xl border border-line bg-surface p-5" aria-live="polite">
      <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-800"><Loader2 className="size-5 animate-spin" /></span>
      <div>
        <h2 className="heading-card">Researching</h2>
        <p className="mt-0.5 text-sm text-ink-3">~3–6 min. Safe to leave.</p>
      </div>
    </section>
  );
}

/* ---------------- Campaign ---------------- */

function Campaign({ slug, data }: { slug: string; data: Data }) {
  const c = data.campaign!;
  const counts = useMemo(() => {
    const m: Record<string, number> = { suggested: 0, approved: 0, skipped: 0 };
    for (const p of data.prospects) m[p.stage] = (m[p.stage] ?? 0) + 1;
    return m;
  }, [data.prospects]);
  const reached = (s: ProspectStage) => FUNNEL_STAGES.slice(FUNNEL_STAGES.indexOf(s)).reduce((n, k) => n + (data.funnel[k] ?? 0), 0);
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
      <div className="flex min-w-0 flex-col gap-6">
        {c.icp ? (
          <section aria-labelledby="icp-h" className="rounded-xl border border-line bg-surface p-5" {...climbTarget("icp", c.id, c.icp.summary)}>
            <div className="flex items-center gap-2">
              <IconTile icon={Target} tone="brand" size="sm" />
              <h2 id="icp-h" className="text-overline">
                Ideal customer
              </h2>
            </div>
            <p className="mt-2 max-w-[70ch] text-sm font-medium leading-relaxed text-ink">{c.icp.summary}</p>
            <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
              {c.icp.mustHaves.length ? (
                <>
                  <dt className="pt-0.5 text-xs font-medium text-ink-3">Must have</dt>
                  <dd className="flex flex-wrap gap-1.5">
                    {c.icp.mustHaves.slice(0, 4).map((m) => (
                      <Badge key={m} tone="brand">
                        {m}
                      </Badge>
                    ))}
                  </dd>
                </>
              ) : null}
              {c.icp.triggers.length ? (
                <>
                  <dt className="pt-0.5 text-xs font-medium text-ink-3">Why now</dt>
                  <dd className="flex flex-wrap gap-1.5">
                    {c.icp.triggers.slice(0, 3).map((t) => (
                      <Badge key={t} tone="amber">
                        {t}
                      </Badge>
                    ))}
                  </dd>
                </>
              ) : null}
              <dt className="text-xs font-medium text-ink-3">Contact</dt>
              <dd className="text-ink-2">{c.icp.decisionMaker}</dd>
            </dl>
          </section>
        ) : null}
        <Tabs defaultValue="people">
          <TabsList>
            <TabsTrigger value="people">People ({data.prospects.length})</TabsTrigger>
            <TabsTrigger value="emails">Emails ({c.sequence.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="people">
            <ProspectList slug={slug} prospects={data.prospects} counts={counts} canEdit={data.canEdit} canApprove={data.canApprove} excluded={c.excluded} campaignId={c.id} creatorMode={c.kind === "creators"} currency={data.currency} />
          </TabsContent>
          <TabsContent value="emails">
            <Sequence slug={slug} campaignId={c.id} sequence={c.sequence} notes={c.ownerNotes} sample={data.prospects.find((p) => p.stage === "approved") ?? data.prospects[0]} canEdit={data.canEdit} />
          </TabsContent>
        </Tabs>
      </div>
      <aside className="flex min-w-0 flex-col gap-6">
        <SendPanel data={data} />
        <FunnelChart
          title="Pipeline"
          headingLevel="h2"
          steps={[
            { label: "Found", value: reached("suggested") },
            { label: "Approved", value: reached("approved") },
            { label: "Emailed", value: reached("contacted") },
            { label: "Replied", value: reached("replied") },
            { label: "Call booked", value: reached("booked") },
          ]}
        />
        <BookingCard slug={slug} data={data} />
      </aside>
    </div>
  );
}

/** Who may move a prospect to a stage: approving/skipping is an approval; the rest are pipeline edits. */
function canMoveTo(stage: ProspectStage, canEdit: boolean, canApprove: boolean): boolean {
  return stage === "approved" || stage === "skipped" ? canApprove : canEdit;
}

function ProspectList({ slug, prospects, counts, canEdit, canApprove, excluded, campaignId, creatorMode, currency }: { slug: string; prospects: Prospect[]; counts: Record<string, number>; canEdit: boolean; canApprove: boolean; excluded: { company: string; reason: string }[]; campaignId: string; creatorMode: boolean; currency: string | null }) {
  const setStage = useMutation(api.outbound.setStage);
  const [view, setView] = useState<View>(counts.suggested ? "suggested" : "all");
  const [picked, setPicked] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const shown = prospects.filter((p) => view === "all" || p.stage === view);
  const allPicked = shown.length > 0 && shown.every((p) => picked.includes(p.id));
  const move = async (ids: string[], stage: ProspectStage) => {
    try {
      await setStage({ slug, prospectIds: ids as Id<"prospects">[], stage });
      setPicked((x) => x.filter((id) => !ids.includes(id)));
      toast({ tone: "success", title: `${ids.length} ${stage === "approved" ? "approved" : stage === "skipped" ? "skipped" : "updated"}` });
    } catch (e) {
      toast({ tone: "danger", title: errorMessage(e) });
    }
  };
  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {(["suggested", "approved", "skipped", "all"] as View[]).map((v) => (
          <FilterChip key={v} pressed={view === v} onPressedChange={() => setView(v)} count={v === "all" ? prospects.length : counts[v] ?? 0}>
            {v === "all" ? "All" : STAGE_LABEL[v]}
          </FilterChip>
        ))}
      </div>
      {shown.length === 0 ? (
        <EmptyState icon={<Target aria-hidden />} title={view === "suggested" ? "All reviewed" : "Nobody here yet"} body={view === "suggested" ? "Approved ones are ready to email." : "Try another filter."} />
      ) : (
        <div className="rounded-xl border border-line bg-surface">
          <div className="flex min-h-12 flex-wrap items-center gap-3 border-b border-line px-4 py-2">
            {canApprove ? (
              <Checkbox
                label={picked.length ? `${picked.length} selected` : "Select all"}
                checked={allPicked ? true : picked.length ? "indeterminate" : false}
                onCheckedChange={() => setPicked(allPicked ? [] : shown.map((p) => p.id))}
              />
            ) : null}
            {canApprove && picked.length > 0 ? (
              <div className="ml-auto flex gap-2">
                <Button size="sm" onClick={() => move(picked, "approved")}>
                  <Check aria-hidden /> Approve
                </Button>
                <Button size="sm" variant="secondary" onClick={() => move(picked, "skipped")}>
                  <X aria-hidden /> Skip
                </Button>
              </div>
            ) : null}
          </div>
          <ul className="divide-y divide-line">
            {shown.map((p) => (
              <li key={p.id} {...climbTarget("prospect", p.id, `${p.company}: ${p.why}`)}>
                <div className="flex items-start gap-3 px-4 py-3">
                  {canApprove ? (
                    <Checkbox
                      aria-label={`Select ${p.company}`}
                      checked={picked.includes(p.id)}
                      onCheckedChange={(v) => setPicked((x) => (v ? [...x, p.id] : x.filter((id) => id !== p.id)))}
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <a href={p.website} target="_blank" rel="noopener noreferrer" className="text-link font-medium">
                        {p.company}
                        <ExternalLink aria-hidden className="ml-1 inline size-3" />
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                      <span className="text-xs text-ink-3">
                        {p.location}
                        {p.sizeBand && p.sizeBand !== "unknown" ? ` · ${p.sizeBand} people` : ""}
                      </span>
                      {p.stage !== "suggested" ? <Badge tone={p.stage === "skipped" ? "neutral" : p.stage === "booked" ? "green" : "brand"}>{STAGE_LABEL[p.stage]}</Badge> : null}
                    </div>
                    {open !== p.id ? (
                      <dl className="mt-1 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-2 gap-y-0.5 text-sm">
                        <dt className="text-xs font-medium leading-5 text-ink-3">Why</dt>
                        <dd className="line-clamp-1 text-ink-2">{toBullets(p.why)[0] ?? p.why}</dd>
                        {p.trigger ? (
                          <>
                            <dt className="text-xs font-medium leading-5 text-amber-800">Now</dt>
                            <dd className="line-clamp-1 text-ink-3">{p.trigger}</dd>
                          </>
                        ) : null}
                      </dl>
                    ) : null}
                    <button type="button" className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-brand-800 hover:underline" aria-expanded={open === p.id} onClick={() => setOpen(open === p.id ? null : p.id)}>
                      <ChevronDown aria-hidden className={cn("size-3.5 transition-transform", open === p.id && "rotate-180")} /> {open === p.id ? "Less" : "Details"}
                    </button>
                    {open === p.id ? <ProspectDetail slug={slug} p={p} canEdit={canEdit} campaignId={campaignId} creatorMode={creatorMode} currency={currency} /> : null}
                  </div>
                  {canEdit || canApprove ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost" aria-label={`Change stage for ${p.company}`}>
                          <MoreHorizontal aria-hidden />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuLabel>Move to</DropdownMenuLabel>
                        {PROSPECT_STAGES.filter((st) => st !== p.stage && canMoveTo(st, canEdit, canApprove)).map((st) => (
                          <DropdownMenuItem key={st} onSelect={() => move([p.id], st)}>
                            {STAGE_LABEL[st]}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                  <Tooltip content={`Score ${prospectScore(p)}: fit ${p.fit}, timing ${p.timing}`}>
                    <span tabIndex={0} className="rounded-full">
                      <ProgressRing value={prospectScore(p) / 100} size={36} label={`${p.company} score`}>
                        <span className="text-2xs font-semibold tabular-nums text-ink">{prospectScore(p)}</span>
                      </ProgressRing>
                    </span>
                  </Tooltip>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {excluded.length ? (
        <details className="text-sm text-ink-3">
          <summary className="cursor-pointer font-medium text-ink-2">Left out ({excluded.length})</summary>
          <dl className="mt-2 grid gap-x-4 gap-y-1.5 sm:grid-cols-[minmax(7rem,max-content)_1fr]">
            {excluded.map((e) => (
              <div key={e.company} className="contents">
                <dt className="font-medium text-ink-2">{e.company}</dt>
                <dd className="-mt-1 sm:mt-0">{e.reason}</dd>
              </div>
            ))}
          </dl>
        </details>
      ) : null}
    </div>
  );
}

function ProspectDetail({ slug, p, canEdit, campaignId, creatorMode, currency }: { slug: string; p: Prospect; canEdit: boolean; campaignId: string; creatorMode: boolean; currency: string | null }) {
  const save = useMutation(api.outbound.updateFirstLine);
  const [line, setLine] = useState(p.firstLine);
  return (
    <div className="mt-2 flex flex-col gap-4 rounded-lg border border-line bg-surface-2 p-3">
      <div>
        <h3 className="text-overline mb-1.5 text-ink-2">Why this lead</h3>
        <Scannable text={p.why} max={3} />
      </div>
      {p.trigger ? (
        <div>
          <h3 className="text-overline mb-1.5 text-amber-800">Why now</h3>
          <p className="max-w-[70ch] text-sm leading-relaxed text-ink">
            <Highlight text={p.trigger} />
          </p>
        </div>
      ) : null}
      {p.evidence.length ? (
        <div>
          <h3 className="text-overline mb-1.5 text-ink-2">Evidence</h3>
          <ul className="flex flex-col gap-1.5">
            {p.evidence.map((e) => (
              <li key={e.url} className="flex gap-2 text-xs leading-relaxed text-ink-2">
                <span aria-hidden className="mt-[0.55em] size-1.5 shrink-0 bg-brand-700" />
                <span className="min-w-0">
                  “{e.observation}”{" "}
                  <a href={e.url} target="_blank" rel="noopener noreferrer" className="text-link">
                    source<span className="sr-only"> for {p.company} (opens in a new tab)</span>
                  </a>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {creatorMode && p.creatorMetricAnomalies?.length ? (
        <section aria-label="Creator metric checks" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
          <h3 className="font-semibold text-amber-950">Verify displayed post counters</h3>
          <ul className="mt-2 flex flex-col gap-3">
            {p.creatorMetricAnomalies.map((anomaly, index) => (
              <li key={`${anomaly.sampleUrl}-${index}`} className="text-amber-950">
                <p>{anomaly.uncertainty}</p>
                <p className="mt-1 text-xs">Observed {new Date(anomaly.observedAt).toISOString().slice(0, 10)}: {anomaly.interactions.map((item) => `${item.metric} ${item.value}`).join(", ")} vs. views {anomaly.views}.</p>
                <a href={anomaly.sampleUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex text-xs font-medium underline">Check the cited post</a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {creatorMode ? <CreatorCollaborationPanel slug={slug} prospectId={p.id} campaignId={campaignId} currency={currency} canEdit={canEdit} /> : null}
      <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
        <dt className="text-ink-3">Contact</dt>
        <dd className="text-ink-2">{p.contact}</dd>
        {p.publicEmail ? (
          <>
            <dt className="text-ink-3">Email</dt>
            <dd className="break-all text-ink-2">{p.publicEmail}</dd>
          </>
        ) : null}
        {p.check ? (
          <>
            <dt className="text-ink-3">Checks</dt>
            <dd>
              <ul className="flex flex-wrap gap-x-3 gap-y-1">
                <li className={p.check.siteLive ? "text-green-800" : "text-red-800"}>{p.check.siteLive ? "✓ Site live" : "Site down"}</li>
                {p.check.emailSource ? <li className="text-green-800">✓ Email on {new URL(p.check.emailSource).pathname === "/" ? "homepage" : new URL(p.check.emailSource).pathname}</li> : <li className="text-ink-3">No public email</li>}
                {p.check.mxOk === true ? <li className="text-green-800">✓ Receives email</li> : p.check.mxOk === false ? <li className="text-red-800">Can&apos;t receive email</li> : null}
              </ul>
            </dd>
          </>
        ) : null}
      </dl>
      <Field label="First line">
        <Textarea value={line} onChange={(e) => setLine(e.target.value)} rows={2} disabled={!canEdit} maxLength={400} />
      </Field>
      {canEdit && line !== p.firstLine ? (
        <div>
          <Button
            size="sm"
            onClick={async () => {
              try {
                await save({ slug, prospectId: p.id as Id<"prospects">, firstLine: line });
                toast({ tone: "success", title: "Saved" });
              } catch (e) {
                toast({ tone: "danger", title: errorMessage(e) });
              }
            }}
          >
            Save
          </Button>
        </div>
      ) : null}
    </div>
  );
}

const CREATOR_STATUSES = [
  ["discussion_started", "Discussion started"], ["interested", "Interested"], ["negotiating", "Negotiating"], ["agreed", "Agreed"],
  ["content_published", "Content published"], ["completed", "Completed"], ["declined", "Declined"], ["cancelled", "Cancelled"],
] as const;
const CREATOR_FORMATS = [["paid", "Paid"], ["gifted", "Gifted"], ["affiliate", "Affiliate"], ["co_created", "Co-created"], ["event", "Event"], ["other", "Other"]] as const;

function CreatorCollaborationPanel({ slug, prospectId, campaignId, currency, canEdit }: { slug: string; prospectId: string; campaignId: string; currency: string | null; canEdit: boolean }) {
  const reports = useQuery(api.outbound.creatorCollaborationHistory, { slug, prospectId: prospectId as Id<"prospects"> });
  const record = useMutation(api.outbound.recordCreatorCollaboration);
  const [status, setStatus] = useState<(typeof CREATOR_STATUSES)[number][0]>("discussion_started");
  const [format, setFormat] = useState("not_recorded");
  const [agreed, setAgreed] = useState("");
  const [actualCost, setActualCost] = useState("");
  const [publishedUrl, setPublishedUrl] = useState("");
  const [hasMetric, setHasMetric] = useState(false);
  const [metricName, setMetricName] = useState("");
  const [metricKind, setMetricKind] = useState<"count" | "rate" | "amount">("count");
  const [metricValue, setMetricValue] = useState("");
  const [metricUnit, setMetricUnit] = useState("");
  const [denominator, setDenominator] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [metricSourceUrl, setMetricSourceUrl] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const boundary = (date: string, end: boolean) => {
    const value = new Date(`${date}T${end ? "23:59:59.999" : "00:00:00"}`).getTime();
    return end ? Math.min(value, Date.now()) : value;
  };
  const submit = async () => {
    setBusy(true);
    try {
      const metric = hasMetric ? {
        name: metricName.trim(), kind: metricKind,
        value: metricKind === "rate" ? Number(metricValue) / 100 : Number(metricValue),
        unit: metricUnit.trim() || (metricKind === "amount" ? currency ?? "" : metricKind === "rate" ? "%" : "count"),
        ...(denominator.trim() ? { denominator: Number(denominator) } : {}),
        periodStartAt: boundary(periodStart, false), periodEndAt: boundary(periodEnd, true),
        ...(metricSourceUrl.trim() ? { sourceUrl: metricSourceUrl.trim() } : {}),
      } : undefined;
      await record({
        slug, prospectId: prospectId as Id<"prospects">, campaignId: campaignId as Id<"outboundCampaigns">, status,
        ...(format !== "not_recorded" ? { format: format as (typeof CREATOR_FORMATS)[number][0] } : {}),
        ...(agreed.trim() && currency ? { agreedValueMinor: majorToMinor(Number(agreed), currency) } : {}),
        ...(actualCost.trim() && currency ? { actualCostMinor: majorToMinor(Number(actualCost), currency) } : {}),
        ...(publishedUrl.trim() ? { publishedUrl: publishedUrl.trim() } : {}), ...(metric ? { metric } : {}), ...(note.trim() ? { note: note.trim() } : {}),
      });
      setNote("");
      toast({ tone: "success", title: "Collaboration report added", description: "Saved as owner-reported history; it does not verify performance." });
    } catch (e) {
      toast({ tone: "danger", title: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };
  const amount = (minor: number | null) => minor === null ? null : minorToDisplay(minor, currency ?? "USD");
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3" aria-label="Creator collaboration reports">
      <div className="flex items-center justify-between gap-2">
        <div><h3 className="text-sm font-semibold text-ink">Collaboration history</h3><p className="text-xs text-ink-3">Owner-reported, not independently verified</p></div>
        {canEdit ? <Button size="sm" variant="secondary" onClick={() => setOpen((v) => !v)} aria-expanded={open}>{open ? "Close report" : "Add report"}</Button> : null}
      </div>
      {open ? (
        <div className="flex flex-col gap-3 rounded-md bg-surface-2 p-3">
          <Field label="Status"><Select value={status} onValueChange={(v) => setStatus(v as typeof status)} options={CREATOR_STATUSES.map(([value, label]) => ({ value, label }))} /></Field>
          <Field label="Collaboration format"><Select value={format} onValueChange={setFormat} options={[{ value: "not_recorded", label: "Not recorded" }, ...CREATOR_FORMATS.map(([value, label]) => ({ value, label }))]} /></Field>
          {currency ? <div className="grid gap-3 sm:grid-cols-2"><Field label={`Agreed value (${currency})`}><Input inputMode="decimal" value={agreed} onChange={(e) => setAgreed(e.target.value.replace(/[^\d.]/g, ""))} placeholder="Optional" /></Field><Field label={`Actual cost (${currency})`}><Input inputMode="decimal" value={actualCost} onChange={(e) => setActualCost(e.target.value.replace(/[^\d.]/g, ""))} placeholder="Optional" /></Field></div> : <Callout tone="info">Set your business currency to record collaboration value or cost.</Callout>}
          <Field label="Published content URL"><Input inputMode="url" value={publishedUrl} onChange={(e) => setPublishedUrl(e.target.value)} placeholder="https://…" /></Field>
          <Checkbox checked={hasMetric} onCheckedChange={(v) => setHasMetric(v === true)} label="Add an outcome metric" description="Record what you observed, its period, and denominator when relevant." />
          {hasMetric ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Metric name"><Input value={metricName} onChange={(e) => setMetricName(e.target.value)} placeholder="e.g. link clicks" maxLength={100} /></Field>
              <Field label="Metric type"><Select value={metricKind} onValueChange={(v) => setMetricKind(v as typeof metricKind)} options={[{ value: "count", label: "Count" }, { value: "rate", label: "Rate (%)" }, { value: "amount", label: "Money", disabled: !currency }]} /></Field>
              <Field label={metricKind === "rate" ? "Rate (%)" : "Observed value"} hint={metricKind === "rate" ? "Enter 0–100; include its denominator." : undefined}><Input inputMode="decimal" value={metricValue} onChange={(e) => setMetricValue(e.target.value.replace(/[^\d.]/g, ""))} /></Field>
              <Field label="Unit"><Input value={metricUnit} onChange={(e) => setMetricUnit(e.target.value)} placeholder={metricKind === "amount" ? currency ?? "Set currency first" : metricKind === "rate" ? "%" : "e.g. clicks"} maxLength={40} /></Field>
              <Field label="Denominator (required for rates)"><Input inputMode="numeric" value={denominator} onChange={(e) => setDenominator(e.target.value.replace(/\D/g, ""))} placeholder="e.g. impressions" /></Field>
              <Field label="Period from"><DatePicker value={periodStart} onChange={(v) => setPeriodStart(v ?? "")} max={periodEnd || new Date().toISOString().slice(0, 10)} /></Field>
              <Field label="Period through"><DatePicker value={periodEnd} onChange={(v) => setPeriodEnd(v ?? "")} min={periodStart || undefined} max={new Date().toISOString().slice(0, 10)} /></Field>
              <Field label="Metric source URL"><Input inputMode="url" value={metricSourceUrl} onChange={(e) => setMetricSourceUrl(e.target.value)} placeholder="Optional" /></Field>
            </div>
          ) : null}
          <Field label="Note"><Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} placeholder="Optional context" /></Field>
          <div><Button size="sm" loading={busy} onClick={submit} disabled={hasMetric && (!metricName.trim() || !metricValue.trim() || !periodStart || !periodEnd || (metricKind === "rate" && !denominator.trim()) || (metricKind === "amount" && !currency))}>Add to history</Button></div>
        </div>
      ) : null}
      {reports === undefined ? <p className="text-xs text-ink-3">Loading reports…</p> : reports.length === 0 ? <p className="text-xs text-ink-3">No collaboration reports yet.</p> : (
        <ol className="flex flex-col divide-y divide-line">
          {reports.map((report) => (
            <li key={report.id} className="flex flex-col gap-1 py-2 text-xs">
              <div className="flex flex-wrap items-center gap-1.5"><Badge tone={report.status === "completed" || report.status === "content_published" ? "green" : "neutral"}>{report.status.replaceAll("_", " ")}</Badge>{report.format ? <Badge>{report.format.replaceAll("_", " ")}</Badge> : null}<span className="text-ink-3">{new Date(report.createdAt).toLocaleDateString()}</span></div>
              {report.agreedValueMinor !== null || report.actualCostMinor !== null ? <p className="text-ink-2">Agreed {amount(report.agreedValueMinor) ?? "—"} · actual cost {amount(report.actualCostMinor) ?? "—"} · {report.currency ?? currency ?? "currency not set"}</p> : null}
              {report.publishedUrl ? <a href={report.publishedUrl} target="_blank" rel="noopener noreferrer" className="break-all text-link">Published content</a> : null}
              {report.metric ? <p className="text-ink-2">{report.metric.name}: {report.metric.kind === "rate" ? `${(report.metric.value * 100).toFixed(1)}% of ${report.metric.denominator}` : `${report.metric.value} ${report.metric.unit}`} · {new Date(report.metric.periodStartAt).toLocaleDateString()}–{new Date(report.metric.periodEndAt).toLocaleDateString()}</p> : null}
              {report.note ? <p className="text-ink-3">{report.note}</p> : null}<p className="text-ink-3">{report.basisLabel}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Sequence({ slug, campaignId, sequence, notes, sample, canEdit }: { slug: string; campaignId: string; sequence: Data["campaign"] extends infer C ? (C extends { sequence: infer S } ? S : never) : never; notes: string[]; sample?: Prospect; canEdit: boolean }) {
  const save = useMutation(api.outbound.updateStep);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState({ subject: "", body: "" });
  return (
    <div className="mt-4 flex flex-col gap-4">
      {notes.length ? (
        <Callout tone="info" title="Before you send">
          <ul className="list-disc pl-5">
            {notes.map((n) => (
              <li key={n}>
                <Highlight text={n} />
              </li>
            ))}
          </ul>
        </Callout>
      ) : null}
      <ol className="flex flex-col gap-3">
        {sequence.map((s, i) => (
          <li key={i} className="rounded-xl border border-line bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-overline">
                {i === 0 ? "First email" : `Follow-up ${i}`} · day {s.day}
              </p>
              {canEdit && editing !== i ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditing(i);
                    setDraft({ subject: s.subject, body: s.body });
                  }}
                >
                  Edit
                </Button>
              ) : null}
            </div>
            {editing === i ? (
              <div className="mt-2 flex flex-col gap-3">
                <Field label="Subject">
                  <Input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} maxLength={120} />
                </Field>
                <Field label="Email" hint={i === 0 ? "{{firstLine}} = their first line" : undefined}>
                  <Textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={6} maxLength={2000} />
                </Field>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={async () => {
                      try {
                        await save({ slug, campaignId: campaignId as Id<"outboundCampaigns">, index: i, ...draft });
                        setEditing(null);
                      } catch (e) {
                        toast({ tone: "danger", title: errorMessage(e) });
                      }
                    }}
                  >
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="mt-1 font-medium text-ink">{s.subject}</p>
                <p className="mt-1 whitespace-pre-line text-sm text-ink-2">{i === 0 && sample ? mergeEmail(s.body, sample.firstLine) : s.body}</p>
                {i === 0 && sample ? <p className="mt-2 text-xs text-ink-3">Preview: {sample.company}</p> : null}
              </>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ---------------- Send + book ---------------- */

function bookingUrl(pageSlug: string): string {
  return `${typeof window === "undefined" ? "https://climbos.app" : window.location.origin}/book/${pageSlug}`;
}

function SendPanel({ data }: { data: Data }) {
  const approved = data.prospects.filter((p) => p.stage === "approved");
  const download = () => {
    const csv = prospectsCsv(approved.map((p) => ({ ...p, publicEmail: p.publicEmail ?? undefined })), data.campaign?.sequence ?? []);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "climbos-prospects.csv";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="heading-card">Send</h2>
      <div className="mt-2">
        <MailboxSending
          slug={data.slug}
          campaignId={data.campaign!.id as Id<"outboundCampaigns">}
          approvedWithEmail={approved.filter((p) => p.publicEmail).length}
          defaultCompany={data.businessName ?? ""}
          bookingUrl={data.page?.live ? bookingUrl(data.page.slug) : undefined}
        />
      </div>
      {data.campaign?.sequence[0] && data.campaign.kind !== "creators" ? (
        <div className="mt-4">
          <AbTestPanel slug={data.slug} kind="email_subject" targetId={data.campaign.id as Id<"outboundCampaigns">} current={data.campaign.sequence[0].subject} canApprove={data.canApprove} />
        </div>
      ) : null}
      {data.canExport ? (
        <>
          <Button className="mt-4 w-full" onClick={download} disabled={!approved.length}>
            <Download aria-hidden /> Export {approved.length || ""} approved
          </Button>
        </>
      ) : null}
      <div className="mt-2 flex flex-col gap-2">
        {data.page?.live ? (
          <Button
            variant="secondary"
            onClick={async () => {
              await navigator.clipboard.writeText(bookingUrl(data.page!.slug));
              toast({ tone: "success", title: "Booking link copied" });
            }}
          >
            <Copy aria-hidden /> Booking link
          </Button>
        ) : null}
      </div>
      {!approved.length && data.canExport ? <p className="mt-2 text-xs text-ink-3">Approve people first.</p> : null}
    </section>
  );
}

const DAY_OPTIONS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 7, label: "Sun" },
];

function BookingCard({ slug, data }: { slug: string; data: Data }) {
  const save = useMutation(api.outbound.saveBookingPage);
  const cancel = useMutation(api.outbound.cancelBooking);
  const page = data.page;
  const [edit, setEdit] = useState(false);
  if (!page) return null;
  const hours = Array.from({ length: 24 }, (_, h) => ({ value: String(h), label: `${String(h).padStart(2, "0")}:00` }));
  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="heading-card">Booking page</h2>
          <a href={`/book/${page.slug}`} target="_blank" rel="noopener noreferrer" className="text-link block truncate text-sm">
            /book/{page.slug}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>
        {data.canEdit ? (
          <Button size="sm" variant="ghost" onClick={() => setEdit(true)}>
            Edit
          </Button>
        ) : null}
      </div>
      {!page.live ? <p className="mt-2 text-xs text-amber-800">{page.active ? "Off · needs a package" : "Off · turn on in Edit"}</p> : null}
      <dl className="mt-3 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
        <dt className="text-ink-3">Length</dt>
        <dd className="font-medium tabular-nums text-ink">{page.durationMin} min</dd>
        <dt className="text-ink-3">Days</dt>
        <dd className="text-ink">{DAY_OPTIONS.filter((d) => page.days.includes(d.value)).map((d) => d.label).join(", ")}</dd>
        <dt className="text-ink-3">Hours</dt>
        <dd className="tabular-nums text-ink">
          {String(page.startHour).padStart(2, "0")}:00–{String(page.endHour).padStart(2, "0")}:00 <span className="text-ink-3">({page.timezone})</span>
        </dd>
      </dl>
      <h3 className="mt-4 text-overline">Upcoming calls</h3>
      {data.bookings.length ? (
        <ul className="mt-2 flex flex-col gap-2">
          {data.bookings.map((b) => (
            <li key={b.id} className="flex items-center gap-2 text-sm">
              <CalendarCheck aria-hidden className="size-4 shrink-0 text-brand-800" />
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium text-ink">{b.name}</span>
                {b.company ? <span className="text-ink-3"> · {b.company}</span> : null}
              </span>
              <span className="shrink-0 text-xs text-ink-3">{new Date(b.startAt).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}</span>
              {data.canEdit && b.upcoming ? (
                <ConfirmDialog
                  title={`Cancel the call with ${b.name}?`}
                  description="They get an email to rebook."
                  confirmLabel="Cancel call"
                  cancelLabel="Keep it"
                  tone="danger"
                  onConfirm={async () => {
                    try {
                      await cancel({ slug, bookingId: b.id as Id<"bookings"> });
                      toast({ tone: "success", title: "Call cancelled" });
                    } catch (e) {
                      toast({ tone: "danger", title: errorMessage(e) });
                    }
                  }}
                  trigger={
                    <Button size="sm" variant="ghost" aria-label={`Cancel the call with ${b.name}`}>
                      <X aria-hidden />
                    </Button>
                  }
                />
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-ink-3">None yet.</p>
      )}
      <Dialog open={edit} onOpenChange={setEdit}>
        <DialogContent title="Booking page">
          <BookingForm
            initial={page}
            onSave={async (v) => {
              try {
                await save({ slug, ...v });
                setEdit(false);
              } catch (e) {
                toast({ tone: "danger", title: errorMessage(e) });
              }
            }}
            hours={hours}
          />
        </DialogContent>
      </Dialog>
    </section>
  );
}

function BookingForm({
  initial,
  onSave,
  hours,
}: {
  initial: NonNullable<Data["page"]>;
  onSave: (v: { title: string; durationMin: number; days: number[]; startHour: number; endHour: number; active: boolean }) => Promise<void>;
  hours: { value: string; label: string }[];
}) {
  const [v, setV] = useState({ title: initial.title, durationMin: initial.durationMin, days: initial.days, startHour: initial.startHour, endHour: initial.endHour, active: initial.active });
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        await onSave(v);
      }}
    >
      <Field label="Title">
        <Input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} maxLength={80} />
      </Field>
      <div>
        <p className="mb-2 text-ui font-medium text-ink" aria-hidden>
          Length
        </p>
        <ChoiceChips aria-label="Length" value={String(v.durationMin)} onValueChange={(d) => setV({ ...v, durationMin: Number(d) })} options={[15, 20, 30, 45, 60].map((m) => ({ value: String(m), label: `${m} min` }))} />
      </div>
      <fieldset>
        <legend className="mb-2 text-ui font-medium text-ink">Days</legend>
        <div className="flex flex-wrap gap-2">
          {DAY_OPTIONS.map((d) => (
            <FilterChip key={d.value} pressed={v.days.includes(d.value)} onPressedChange={() => setV({ ...v, days: v.days.includes(d.value) ? v.days.filter((x) => x !== d.value) : [...v.days, d.value] })}>
              {d.label}
            </FilterChip>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <Field label="From">
          <Select value={String(v.startHour)} onValueChange={(h) => setV({ ...v, startHour: Number(h) })} options={hours} />
        </Field>
        <Field label="Until">
          <Select value={String(v.endHour)} onValueChange={(h) => setV({ ...v, endHour: Number(h) })} options={[...hours.slice(1), { value: "24", label: "24:00" }]} />
        </Field>
      </div>
      <Checkbox label="Page is live" checked={v.active} onCheckedChange={(c) => setV({ ...v, active: c === true })} />
      <DialogFooter>
        <Button type="submit" disabled={!v.days.length}>
          Save
        </Button>
      </DialogFooter>
    </form>
  );
}
