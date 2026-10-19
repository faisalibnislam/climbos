"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Ban, Bot, ChevronDown, CircleCheck, Clock, Hand, Hourglass, ShieldAlert, Sparkles, Store, UserRound, Wallet, type LucideIcon } from "@/components/icons"
import { useState } from "react";
import { Badge, Callout, ChoiceChips, EmptyState, IconTile, Select, Skeleton, toast } from "@/components/ui";
import { errorMessage } from "@/components/app/errors";
import { climbTarget } from "@/components/climb/context";
import { cn } from "@/lib/utils";

type View = NonNullable<ReturnType<typeof useQuery<typeof api.acquisition.view>>>;
type Row = View["channels"][number];

const EXEC_ICON = { auto: Bot, partial: Hand, human: UserRound } as const;
const LEARN = { days: "Learns in days", weeks: "Learns in weeks", months: "Learns in months" } as const;

const GROUPS = [
  { key: "plan", label: "In the plan", bar: "bg-chart-1" },
  { key: "later", label: "Later", bar: "bg-chart-3" },
  { key: "notNow", label: "Not now", bar: "bg-chart-5" },
  { key: "ineligible", label: "Not a fit", bar: "bg-chart-6" },
] as const;

/** How the channel library splits for this business: one stacked bar with counts. */
function SplitStrip({ counts }: { counts: Record<(typeof GROUPS)[number]["key"], number> }) {
  const total = Math.max(1, GROUPS.reduce((t, g) => t + counts[g.key], 0));
  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--card-shadow)]">
      <p className="text-overline">{total} channels checked</p>
      <div role="img" aria-label={GROUPS.map((g) => `${g.label}: ${counts[g.key]}`).join(", ")} className="flex h-3 overflow-hidden rounded-full bg-surface-3">
        {GROUPS.map((g) => (counts[g.key] ? <span key={g.key} aria-hidden className={cn("h-full border-r-2 border-surface last:border-r-0", g.bar)} style={{ width: `${(counts[g.key] / total) * 100}%` }} /> : null))}
      </div>
      <ul aria-hidden className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
        {GROUPS.map((g) => (
          <li key={g.key} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2 rounded-[1.5px]", g.bar)} />
            {g.label} <span className="font-semibold tabular-nums text-ink">{counts[g.key]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

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
          From business type and budget only. Refresh the plan for research-backed scores.
        </Callout>
      ) : null}
      <SplitStrip counts={{ plan: plan.length, later: later.length, notNow: notNow.length, ineligible: ineligible.length }} />
      <Group title="In the plan" icon={CircleCheck} rows={plan} labels={data.factorLabels} rankStart={1} highlight />
      <Group title="Later" icon={Hourglass} hint="Add once the first ones work." rows={later} labels={data.factorLabels} rankStart={plan.length + 1} />
      <Collapsible title={`Not now (${notNow.length})`}>
        <Group rows={notNow} labels={data.factorLabels} rankStart={plan.length + later.length + 1} />
      </Collapsible>
      <Collapsible title={`Not a fit (${ineligible.length})`}>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ineligible.map((c) => (
            <li key={c.id} className="flex min-w-0 items-start gap-2 rounded-[var(--radius-control)] bg-surface-2 px-2.5 py-1.5 text-ui">
              <Ban aria-hidden className="mt-0.5 size-3.5 shrink-0 text-ink-3" />
              <span className="min-w-0">
                <span className="font-medium text-ink">{c.name}</span> <span className="text-ink-3">· {c.why}</span>
              </span>
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
    <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--card-shadow)]" aria-labelledby="profile-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <IconTile icon={Store} tone="brand" size="sm" />
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
        </div>
        <div className="flex flex-col items-start gap-1 rounded-[var(--radius-card)] bg-cream-soft px-3 py-2 sm:items-end">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-3">
            <Wallet aria-hidden className="size-3.5" /> Budget
          </span>
          <span className="text-xl font-semibold tabular-nums text-ink">${data.budget.usd.toLocaleString()}/mo</span>
          <span className="text-xs text-ink-2">{data.budget.approach}</span>
        </div>
      </div>
      {data.summary.length ? (
        <ul className="mt-3 flex flex-col gap-1.5 text-ui text-ink">
          {data.summary.map((s) => (
            <li key={s} className="flex gap-2">
              <span aria-hidden className="mt-[0.55em] size-1.5 shrink-0 bg-brand-700" />
              <span className="min-w-0">{s}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {data.types.some((t) => t.regulated) ? (
        <p className="mt-3 flex items-start gap-1.5 rounded-[var(--radius-control)] bg-amber-100 px-2.5 py-1.5 text-xs text-amber-800">
          <ShieldAlert aria-hidden className="mt-px size-3.5 shrink-0" />
          {data.types.find((t) => t.regulated)?.regulated}
        </p>
      ) : null}
      {data.canEdit && ask.length ? (
        <div className="mt-4 flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface-2 p-3">
          <p className="text-ui font-medium text-ink">Confirm to sharpen the ranking</p>
          {ask.map((d) => (
            <div key={d.key} className="flex flex-col gap-1.5">
              <span className="text-xs text-ink-3">
                {d.label}
                {d.value ? ` · guess: ${d.valueLabel}` : ""}
              </span>
              <ChoiceChips aria-label={d.label} size="md" value={d.source === "owner" ? (d.value ?? undefined) : undefined} onValueChange={(v) => save(d.key, v)} options={d.options} />
            </div>
          ))}
        </div>
      ) : null}
      <button type="button" className="mt-3 inline-flex min-h-6 items-center gap-1 text-xs font-medium text-brand-800 hover:underline" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
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

function Group({ title, icon, hint, rows, labels, rankStart, highlight }: { title?: string; icon?: LucideIcon; hint?: string; rows: Row[]; labels: View["factorLabels"]; rankStart: number; highlight?: boolean }) {
  if (!rows.length) return null;
  return (
    <section aria-label={title}>
      {title ? (
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
          {icon ? <IconTile icon={icon} tone={highlight ? "brand" : "blue"} size="sm" /> : null}
          <div className="min-w-0 flex-1">
            <h2 className="heading-section">{title}</h2>
            {hint ? <p className="text-ui text-ink-3">{hint}</p> : null}
          </div>
          <Badge>{`${rows.length} channels`}</Badge>
        </div>
      ) : null}
      <ol className={cn("divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border bg-surface shadow-[var(--card-shadow)]", highlight ? "border-brand-300" : "border-line")}>
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
          {r.why ? <span className={cn("mt-0.5 block text-ui text-ink-2", !open && "line-clamp-1")}>{r.why}</span> : null}
          <span className="mt-1.5 flex flex-wrap gap-1.5">
            <Badge icon={<Exec />}>{r.execLabel}</Badge>
            <Badge tone={r.learn === "days" ? "green" : r.learn === "weeks" ? "blue" : "amber"} icon={<Clock />}>
              {LEARN[r.learn as keyof typeof LEARN]}
            </Badge>
            {r.minMonthly ? <Badge icon={<Wallet />}>{`From $${r.minMonthly}/mo`}</Badge> : null}
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
              <p className="flex items-start gap-1 rounded-[var(--radius-control)] bg-amber-100 px-2 py-1 text-amber-800">
                <ShieldAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                {r.caution}
              </p>
            ) : null}
            {r.limits.map((l) => (
              <p key={l.kind} className={cn("flex items-start gap-1", l.verdict === "setup" ? "text-ink-3" : "text-amber-800")}>
                <ShieldAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                {l.reason}
              </p>
            ))}
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
        <span className={cn("block h-full rounded-full", score >= 70 ? "bg-green-500" : score >= 55 ? "bg-amber-500" : "bg-chart-6")} style={{ width: `${score}%` }} />
      </span>
      <span className="w-7 text-right text-ui font-semibold tabular-nums text-ink">
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
