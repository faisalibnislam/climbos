"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { CalendarCheck, Check, ChevronDown, Copy, Download, ExternalLink, Loader2, Mail, Search, Sparkles, Target, X } from "lucide-react";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { FUNNEL_STAGES, STAGE_LABEL, mergeEmail, prospectScore, prospectsCsv, type ProspectStage } from "../../../../../shared/outbound";
import {
  Badge,
  Button,
  Callout,
  Checkbox,
  ChoiceChips,
  Dialog,
  DialogContent,
  DialogFooter,
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
} from "@/components/ui";
import { errorMessage } from "@/components/app/errors";
import { LoadingBlock, PageHeader } from "@/components/app/results/QueryBoundary";
import { RetryRunIfPossible, RunProgress } from "@/components/app/content/RunProgress";
import { climbTarget } from "@/components/climb/context";
import { cn } from "@/lib/utils";

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
  const data = useQuery(api.outbound.get, { slug });
  const [startOpen, setStartOpen] = useState(false);

  if (data === undefined) return <LoadingBlock label="Loading your prospects" />;
  const c = data.campaign;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        section="outbound"
        title="Find customers"
        intro="We find companies that need you, write the emails and book the calls. Nothing is sent without you."
        actions={
          c && c.status !== "researching" && data.canEdit ? (
            <Button variant="secondary" onClick={() => setStartOpen(true)}>
              <Search aria-hidden /> Find more
            </Button>
          ) : null
        }
      />
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
          {c.run?.message ?? "Nothing was charged beyond what was used."}{" "}
          <Button size="sm" variant="secondary" className="ml-2" onClick={() => setStartOpen(true)}>
            Start over
          </Button>
          {c.run ? <RetryRunIfPossible slug={slug} runId={c.run.id} className="mt-3" /> : null}
        </Callout>
      ) : (
        <Campaign slug={slug} data={data} />
      )}
      <Dialog open={startOpen} onOpenChange={setStartOpen}>
        <DialogContent title="Find more customers" description="A new search. Companies already in your list are skipped.">
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
        <div className="mt-4">{canEdit ? <StartForm slug={slug} businessType={businessType} /> : <p className="text-sm text-ink-3">Ask an owner or admin to start a search.</p>}</div>
      </div>
      <ol className="flex flex-col gap-3" aria-label="How it works">
        {[
          { icon: Search, title: "Find", body: "Real companies, each with a source you can check." },
          { icon: Mail, title: "Write", body: "A short sequence and a personal first line for each." },
          { icon: CalendarCheck, title: "Book", body: "Your own booking page. Calls land in your calendar." },
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
          await start({ slug, who: whoMode === "pick" ? who : "", where: whereMode === "pick" ? where : "", count: Number(count) });
          toast({ tone: "success", title: "Your team is on it", description: "About 10–15 minutes. You can leave this page." });
          onDone?.();
        } catch (err) {
          toast({ tone: "danger", title: errorMessage(err) });
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-ui font-medium text-ink">Who</legend>
        <RadioCards
          columns={2}
          value={whoMode}
          onValueChange={(v) => setWhoMode(v as "auto" | "pick")}
          options={[
            { value: "auto", title: "We find the customer", description: "From your plan and website." },
            { value: "pick", title: "Select your customer", description: "Pick an idea or describe them." },
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
            { value: "auto", title: "We find the area", description: "Where you already sell." },
            { value: "pick", title: "Select your area", description: "A city, region or country." },
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
          <Sparkles aria-hidden /> Find customers
        </Button>
        <span className="text-xs text-ink-3">Uses AI allowance. Nothing is sent.</span>
      </div>
    </form>
  );
}

function Researching() {
  return (
    <section className="flex items-start gap-4 rounded-xl border border-line bg-surface p-5" aria-live="polite">
      <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-800"><Loader2 className="size-5 animate-spin" /></span>
      <div>
        <h2 className="heading-card">Your team is researching</h2>
        <p className="mt-0.5 text-sm text-ink-3">Finding companies, checking each one on its own website, then writing the emails. Usually 3–6 minutes. You can leave this page.</p>
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
          <section className="rounded-xl border border-line bg-surface p-5" {...climbTarget("icp", c.id, c.icp.summary)}>
            <p className="text-overline">Ideal customer</p>
            <p className="mt-1 text-sm font-medium text-ink">{c.icp.summary}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {c.icp.mustHaves.slice(0, 4).map((m) => (
                <Badge key={m} tone="brand">
                  {m}
                </Badge>
              ))}
              {c.icp.triggers.slice(0, 3).map((t) => (
                <Badge key={t} tone="amber">
                  {t}
                </Badge>
              ))}
            </div>
            <p className="mt-2 text-xs text-ink-3">Contact: {c.icp.decisionMaker}</p>
          </section>
        ) : null}
        <Tabs defaultValue="people">
          <TabsList>
            <TabsTrigger value="people">People ({data.prospects.length})</TabsTrigger>
            <TabsTrigger value="emails">Emails ({c.sequence.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="people">
            <ProspectList slug={slug} prospects={data.prospects} counts={counts} canEdit={data.canEdit} excluded={c.excluded} />
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
          description="Everyone your team has found so far."
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

function ProspectList({ slug, prospects, counts, canEdit, excluded }: { slug: string; prospects: Prospect[]; counts: Record<string, number>; canEdit: boolean; excluded: { company: string; reason: string }[] }) {
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
        <EmptyState icon={<Target aria-hidden />} title={view === "suggested" ? "All reviewed" : "Nobody here yet"} body={view === "suggested" ? "Approved people are ready to email." : "Change the filter to see more."} />
      ) : (
        <div className="rounded-xl border border-line bg-surface">
          <div className="flex min-h-12 flex-wrap items-center gap-3 border-b border-line px-4 py-2">
            {canEdit ? (
              <Checkbox
                label={picked.length ? `${picked.length} selected` : "Select all"}
                checked={allPicked ? true : picked.length ? "indeterminate" : false}
                onCheckedChange={() => setPicked(allPicked ? [] : shown.map((p) => p.id))}
              />
            ) : null}
            {canEdit && picked.length > 0 ? (
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
                  {canEdit ? (
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
                    <p className="mt-0.5 text-sm text-ink-2">{p.why}</p>
                    {p.trigger ? (
                      <p className="mt-1 text-xs">
                        <Badge tone="amber">Why now</Badge> <span className="text-ink-3">{p.trigger}</span>
                      </p>
                    ) : null}
                    <button type="button" className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-brand-800 hover:underline" aria-expanded={open === p.id} onClick={() => setOpen(open === p.id ? null : p.id)}>
                      <ChevronDown aria-hidden className={cn("size-3.5 transition-transform", open === p.id && "rotate-180")} /> Evidence and first line
                    </button>
                    {open === p.id ? <ProspectDetail slug={slug} p={p} canEdit={canEdit} /> : null}
                  </div>
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
          <ul className="mt-2 list-disc pl-5">
            {excluded.map((e) => (
              <li key={e.company}>
                {e.company}: {e.reason}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function ProspectDetail({ slug, p, canEdit }: { slug: string; p: Prospect; canEdit: boolean }) {
  const save = useMutation(api.outbound.updateFirstLine);
  const [line, setLine] = useState(p.firstLine);
  return (
    <div className="mt-2 flex flex-col gap-3 rounded-lg border border-line bg-surface-2 p-3">
      <ul className="flex flex-col gap-1.5">
        {p.evidence.map((e) => (
          <li key={e.url} className="text-xs text-ink-2">
            “{e.observation}”{" "}
            <a href={e.url} target="_blank" rel="noopener noreferrer" className="text-link">
              source<span className="sr-only"> for {p.company} (opens in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
      <p className="text-xs text-ink-3">
        Contact: <span className="text-ink-2">{p.contact}</span>
        {p.publicEmail ? (
          <>
            {" "}
            · <span className="text-ink-2">{p.publicEmail}</span> (published on their site)
          </>
        ) : null}
      </p>
      {p.check ? (
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-3">
          <span>{p.check.siteLive ? "✓ Website live" : "Website didn't load"}</span>
          {p.check.emailSource ? <span>✓ Email found on {new URL(p.check.emailSource).pathname === "/" ? "their homepage" : new URL(p.check.emailSource).pathname}</span> : <span>No email published</span>}
          {p.check.mxOk === true ? <span>✓ Domain receives email</span> : p.check.mxOk === false ? <span>Domain can&apos;t receive email</span> : null}
        </p>
      ) : null}
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
              <li key={n}>{n}</li>
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
                <Field label="Email" hint={i === 0 ? "{{firstLine}} is replaced by each person's first line." : undefined}>
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
                {i === 0 && sample ? <p className="mt-2 text-xs text-ink-3">Preview for {sample.company}.</p> : null}
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
      <p className="mt-0.5 text-sm text-ink-3">Sending from your own mailbox is coming soon. For now, export and send from your email.</p>
      <div className="mt-4 flex flex-col gap-2">
        <Button onClick={download} disabled={!approved.length}>
          <Download aria-hidden /> Export {approved.length || ""} approved (CSV)
        </Button>
        {data.page ? (
          <Button
            variant="secondary"
            onClick={async () => {
              await navigator.clipboard.writeText(bookingUrl(data.page!.slug));
              toast({ tone: "success", title: "Booking link copied" });
            }}
          >
            <Copy aria-hidden /> Copy booking link
          </Button>
        ) : null}
      </div>
      {!approved.length ? <p className="mt-2 text-xs text-ink-3">Approve people first.</p> : null}
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
      <p className="mt-2 text-xs text-ink-3">
        {page.durationMin} min · {DAY_OPTIONS.filter((d) => page.days.includes(d.value)).map((d) => d.label).join(", ")} · {String(page.startHour).padStart(2, "0")}:00–{String(page.endHour).padStart(2, "0")}:00 ({page.timezone})
      </p>
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
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-ink-3">None yet.</p>
      )}
      <Dialog open={edit} onOpenChange={setEdit}>
        <DialogContent title="Booking page" description="When people can book a call with you.">
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
