"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Bot, ChevronDown, Clock, Hand, ShieldAlert, Sparkles, UserRound, Wallet } from "@/components/icons"
import { useState } from "react";
import { Badge, Callout, ChoiceChips, EmptyState, Select, Skeleton, toast } from "@/components/ui";
import { errorMessage } from "@/components/app/errors";
import { climbTarget } from "@/components/climb/context";
import { cn } from "@/lib/utils";

type View = NonNullable<ReturnType<typeof useQuery<typeof api.acquisition.view>>>;
type Row = View["channels"][number];

const EXEC_ICON = { auto: Bot, partial: Hand, human: UserRound } as const;
const LEARN = { days: "Learns in days", weeks: "Learns in weeks", months: "Learns in months" } as const;

/**
 * Acquisition Intelligence: which channels fit this business, ranked with the
 * reasons. Confirming a detail re-ranks instantly (no AI run).
 */
export function ChannelScorecard({ slug }: { slug: string }) {
  const data = useQuery(api.acquisition.view, { slug });
  if (data === undefined) return <Skeleton className="h-64" />;
  if (data === null) return <EmptyState icon={<Sparkles aria-hidden />} title="Set your goal first" body="Channels are ranked for your goal and budget." />;
  const plan = data.channels.filter((c) => c.status === "primary" || c.status === "in_plan");
  const later = data.channels.filter((c) => c.status === "later");
  const notNow = data.channels.filter((c) => c.status === "not_now");
  const ineligible = data.channels.filter((c) => c.status === "ineligible");
  return (
    <div className="flex flex-col gap-6">
      <Profile slug={slug} data={data} />
      {!data.scored ? (
        <Callout tone="info" title="Rough ranking">
          These scores come from your business type and budget only. Refresh the plan to score them with research.
        </Callout>
      ) : null}
      <Group title="In the plan" rows={plan} labels={data.factorLabels} rankStart={1} highlight />
      <Group title="Later" hint="Good fits to add once the first channels show results." rows={later} labels={data.factorLabels} rankStart={plan.length + 1} />
      <Collapsible title={`Not now (${notNow.length})`}>
        <Group rows={notNow} labels={data.factorLabels} rankStart={plan.length + later.length + 1} />
      </Collapsible>
      <Collapsible title={`Not a fit (${ineligible.length})`}>
        <ul className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          {ineligible.map((c) => (
            <li key={c.id} className="text-ink-3">
              <span className="text-ink-2">{c.name}</span>: {c.why}
            </li>
          ))}
        </ul>
      </Collapsible>
    </div>
  );
}

function Profile({ slug, data }: { slug: string; data: View }) {
  const set = useMutation(api.acquisition.setDimension);
  const [open, setOpen] = useState(false);
  const save = async (key: string, value: string) => {
    try {
      await set({ slug, key, value });
    } catch (e) {
      toast({ tone: "danger", title: errorMessage(e) });
    }
  };
  const ask = data.dimensions.filter((d) => data.toConfirm.includes(d.key as never));
  return (
    <section className="rounded-xl border border-line bg-surface p-5" aria-labelledby="profile-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="profile-heading" className="heading-section">
            Your business
          </h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {data.types.map((t) => (
              <Badge key={t.key} tone="brand">
                {t.label}
              </Badge>
            ))}
          </div>
        </div>
        <p className="flex items-center gap-1.5 text-sm text-ink-2">
          <Wallet aria-hidden className="size-4 text-ink-3" />${data.budget.usd.toLocaleString()}/month · {data.budget.approach}
        </p>
      </div>
      {data.summary.length ? (
        <ul className="mt-3 list-disc pl-5 text-sm text-ink-2">
          {data.summary.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      ) : null}
      {data.types.some((t) => t.regulated) ? (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-ink-3">
          <ShieldAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          {data.types.find((t) => t.regulated)?.regulated}
        </p>
      ) : null}
      {data.canEdit && ask.length ? (
        <div className="mt-4 flex flex-col gap-3 rounded-lg border border-line bg-surface-2 p-3">
          <p className="text-ui font-medium text-ink">Confirm a few details to sharpen the ranking</p>
          {ask.map((d) => (
            <div key={d.key} className="flex flex-col gap-1.5">
              <span className="text-xs text-ink-3">
                {d.label}
                {d.value ? ` · our guess: ${d.valueLabel}` : ""}
              </span>
              <ChoiceChips aria-label={d.label} size="md" value={d.source === "owner" ? (d.value ?? undefined) : undefined} onValueChange={(v) => save(d.key, v)} options={d.options} />
            </div>
          ))}
        </div>
      ) : null}
      <button type="button" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand-800 hover:underline" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <ChevronDown aria-hidden className={cn("size-3.5 transition-transform", open && "rotate-180")} /> All details
      </button>
      {open ? (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.dimensions.map((d) => (
            <div key={d.key} className="flex flex-col gap-1">
              <span className="flex items-center gap-1.5 text-xs text-ink-3">
                {d.label}
                {d.source ? <Badge tone={d.source === "owner" ? "green" : "neutral"}>{d.source === "owner" ? "You" : `AI guess · ${d.confidence}`}</Badge> : null}
              </span>
              <Select aria-label={d.label} value={d.value ?? undefined} placeholder="Not set" disabled={!data.canEdit} onValueChange={(v) => save(d.key, v)} options={d.options} className="h-8" />
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function Group({ title, hint, rows, labels, rankStart, highlight }: { title?: string; hint?: string; rows: Row[]; labels: View["factorLabels"]; rankStart: number; highlight?: boolean }) {
  if (!rows.length) return null;
  return (
    <section aria-label={title}>
      {title ? (
        <div className="mb-2">
          <h2 className="heading-section">{title}</h2>
          {hint ? <p className="text-sm text-ink-3">{hint}</p> : null}
        </div>
      ) : null}
      <ol className={cn("divide-y divide-line rounded-xl border bg-surface", highlight ? "border-brand-200" : "border-line")}>
        {rows.map((r, i) => (
          <ChannelRow key={r.id} r={r} rank={rankStart + i} labels={labels} />
        ))}
      </ol>
    </section>
  );
}

function ChannelRow({ r, rank, labels }: { r: Row; rank: number; labels: View["factorLabels"] }) {
  const [open, setOpen] = useState(false);
  const Exec = EXEC_ICON[r.exec as keyof typeof EXEC_ICON] ?? Hand;
  return (
    <li {...climbTarget("channel", r.id, `${r.name}: ${r.score}/100, ${r.statusLabel}`)}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2">
        <span className="mt-0.5 w-5 shrink-0 text-right text-xs tabular-nums text-ink-3">{rank}</span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium text-ink">{r.name}</span>
            <span className="text-xs text-ink-3">{r.family}</span>
            {r.status === "primary" ? <Badge tone="brand">Primary</Badge> : null}
          </span>
          {r.why ? <span className="mt-0.5 block text-sm text-ink-2">{r.why}</span> : null}
          <span className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-3">
            <span className="inline-flex items-center gap-1">
              <Exec aria-hidden className="size-3.5" />
              {r.execLabel}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock aria-hidden className="size-3.5" />
              {LEARN[r.learn as keyof typeof LEARN]}
            </span>
            {r.minMonthly ? (
              <span className="inline-flex items-center gap-1">
                <Wallet aria-hidden className="size-3.5" />
                from ${r.minMonthly}/mo
              </span>
            ) : null}
          </span>
        </span>
        <ScoreBar score={r.score} />
        <ChevronDown aria-hidden className={cn("mt-1 size-4 shrink-0 text-ink-3 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="grid grid-cols-1 gap-4 px-4 pb-4 pl-12 sm:grid-cols-2">
          <ul className="flex flex-col gap-1.5" aria-label={`${r.name} factor scores`}>
            {labels.map((f, i) => (
              <li key={f.key} className="grid grid-cols-[9.5rem_1fr_2rem] items-center gap-2 text-xs">
                <span className="text-ink-2">{f.label}</span>
                <span aria-hidden className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                  <span className="block h-full rounded-full bg-brand-700" style={{ width: `${r.factors[i]}%` }} />
                </span>
                <span className="text-right tabular-nums text-ink-2">{r.factors[i]}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-1.5 text-xs text-ink-2">
            {r.platform || r.tactic ? (
              <p>
                <span className="text-ink-3">How: </span>
                {[r.platform, r.tactic].filter(Boolean).join(" · ")}
              </p>
            ) : null}
            {r.audience ? (
              <p>
                <span className="text-ink-3">Who: </span>
                {r.audience}
              </p>
            ) : null}
            {r.evidence ? (
              <p>
                <span className="text-ink-3">Evidence: </span>
                {r.evidence}
              </p>
            ) : null}
            {r.caution ? (
              <p className="flex items-start gap-1 text-amber-800">
                <ShieldAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                {r.caution}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </li>
  );
}

function ScoreBar({ score }: { score: number }) {
  return (
    <span className="mt-0.5 flex w-24 shrink-0 items-center gap-2">
      <span aria-hidden className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
        <span className={cn("block h-full rounded-full", score >= 70 ? "bg-brand-800" : score >= 55 ? "bg-brand-600" : "bg-ink-3")} style={{ width: `${score}%` }} />
      </span>
      <span className="w-6 text-right text-ui font-semibold tabular-nums text-ink">
        {score}
        <span className="sr-only"> out of 100</span>
      </span>
    </span>
  );
}

function Collapsible({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section>
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1.5 text-ui font-medium text-ink-2 hover:text-ink">
        <ChevronDown aria-hidden className={cn("size-4 transition-transform", open && "rotate-180")} />
        {title}
      </button>
      {open ? <div className="mt-3">{children}</div> : null}
    </section>
  );
}
