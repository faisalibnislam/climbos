"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Ban, Bot, ChevronDown, CircleCheck, Clock, Hand, Hourglass, ShieldAlert, Sparkles, Store, UserRound, Wallet, type LucideIcon } from "@/components/icons"
import { useState } from "react";
import { Badge, Button, Callout, ChoiceChips, EmptyState, IconTile, Input, Skeleton, toast } from "@/components/ui";
import { formatMoney } from "../../../../shared/economics/currency";
import { errorMessage } from "@/components/app/errors";
import { climbTarget } from "@/components/climb/context";
import { cn } from "@/lib/utils";
import { CHANNEL_JOB_LABEL, channelJob, generalChannelGuidance, recommendationGuidance } from "@shared/acquisition/recommendationGroups";

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

const TYPE_GROUPS = [
  { key: "software", label: "Software & digital" },
  { key: "commerce", label: "Products & commerce" },
  { key: "services", label: "Services & organizations" },
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
type SortKey = "recommended" | "priority" | "easiest" | "hardest";
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "recommended", label: "Recommended" },
  { value: "priority", label: "Priority" },
  { value: "easiest", label: "Easiest (ClimbOS does most)" },
  { value: "hardest", label: "Hardest (most hands-on)" },
];
const EFFORT: Record<string, number> = { auto: 0, partial: 1, human: 2 };
const LEARN_SPEED: Record<string, number> = { days: 0, weeks: 1, months: 2 };

/** Re-order a list without changing each channel's ClimbOS rank (shown as its number). */
function sortRows(rows: Row[], sort: SortKey): Row[] {
  if (sort === "recommended") return rows;
  const effort = (r: Row) => (EFFORT[r.exec] ?? 1) * 10 + (LEARN_SPEED[r.learn] ?? 1);
  return [...rows].sort((a, b) => sort === "priority" ? b.score - a.score : sort === "easiest" ? effort(a) - effort(b) || b.score - a.score : effort(b) - effort(a) || b.score - a.score);
}

export function ChannelScorecard({ slug }: { slug: string }) {
  const data = useQuery(api.acquisition.view, { slug });
  const [sort, setSort] = useState<SortKey>("recommended");
  if (data === undefined) return <Skeleton className="h-64" />;
  if (data === null) return <EmptyState icon={<Sparkles aria-hidden />} title="Set your goal first" body="Channels are ranked for your goal and budget." />;
  const plan = data.channels.filter((c) => c.status === "primary" || c.status === "in_plan");
  const later = data.channels.filter((c) => c.status === "later");
  const notNow = data.channels.filter((c) => c.status === "not_now");
  const ineligible = data.channels.filter((c) => c.status === "ineligible");
  const rankOf = new Map([...plan, ...later, ...notNow].map((c, i) => [c.id, i + 1]));
  return (
    <div className="flex flex-col gap-6">
      <Profile slug={slug} data={data} />
      {!data.scored ? (
        <Callout tone="info" title="Rough ranking">
          From business type and budget only. Refresh the plan for research-backed scores.
        </Callout>
      ) : null}
      <p className="text-xs text-ink-3">Order is a relative fit guide based on audience, buying intent, budget, time, team capacity, competition, scalability, and measurement. These rule-guided signals are not probabilities of success.</p>
      <SplitStrip counts={{ plan: plan.length, later: later.length, notNow: notNow.length, ineligible: ineligible.length }} />
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-ui font-medium text-ink-2">Sort by</span>
        <ChoiceChips aria-label="Sort channels by" value={sort} onValueChange={(v) => setSort(v as SortKey)} options={SORT_OPTIONS} />
      </div>
      <Group title="In the plan" icon={CircleCheck} rows={sortRows(plan, sort)} rankOf={rankOf} labels={data.factorLabels} highlight slug={slug} canEdit={data.canEdit} />
      <Group title="Later" icon={Hourglass} hint="Add once the first ones work." rows={sortRows(later, sort)} rankOf={rankOf} labels={data.factorLabels} slug={slug} canEdit={data.canEdit} />
      <Collapsible title={`Not now (${notNow.length})`}>
        <Group rows={sortRows(notNow, sort)} rankOf={rankOf} labels={data.factorLabels} slug={slug} canEdit={data.canEdit} />
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
  const setTypes = useMutation(api.acquisition.setTypes);
  const [open, setOpen] = useState(false);
  const [editTypes, setEditTypes] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(data.types.map((t) => t.key));
  const [savingTypes, setSavingTypes] = useState(false);
  const approve = useMutation(api.acquisition.approveGuesses);
  const setBudget = useMutation(api.orgs.setAdBudget);
  const [editBudget, setEditBudget] = useState(false);
  const [budgetText, setBudgetText] = useState(String(data.budget.amount));
  const save = async (key: string, values: string[]) => {
    if (!values.length) return;
    try {
      await set({ slug, key, value: values[0], values });
    } catch (e) {
      toast({ tone: "danger", title: errorMessage(e) });
    }
  };
  // ClimbOS guesses every detail; guesses wait for the owner's OK (changing one counts as an answer).
  const guesses = data.dimensions.filter((d) => d.source === "inferred");
  const unknown = data.dimensions.filter((d) => !d.source);
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
            <p className="mt-1 text-xs text-ink-3">
              {data.typesSource === "owner" ? "Confirmed by your team" : "Suggested classification · confirm to affect channel eligibility"}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-start gap-1 rounded-[var(--radius-card)] bg-cream-soft px-3 py-2 sm:items-end">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-3">
            <Wallet aria-hidden className="size-3.5" /> Budget
          </span>
          {editBudget ? (
            <form
              className="flex items-center gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                const n = Number(budgetText.replace(/,/g, ""));
                if (!Number.isFinite(n) || n < 0) return toast({ tone: "danger", title: "Enter 0 or more (0 means no paid ads)." });
                try {
                  await setBudget({ slug, monthlyAdBudget: n });
                  setEditBudget(false);
                  toast({ tone: "success", title: "Budget updated. Refresh the plan to use it." });
                } catch (err) {
                  toast({ tone: "danger", title: errorMessage(err) });
                }
              }}
            >
              <Input aria-label={`Monthly ad budget (${data.budget.currency})`} inputMode="decimal" autoFocus className="h-8 w-28" value={budgetText} onChange={(e) => setBudgetText(e.target.value)} />
              <span className="text-xs text-ink-3">{data.budget.currency}/mo</span>
              <Button size="sm" type="submit">Save</Button>
              <Button size="sm" variant="ghost" type="button" onClick={() => setEditBudget(false)}>Cancel</Button>
            </form>
          ) : (
            <span className="flex items-center gap-2">
              <span className="text-xl font-semibold tabular-nums text-ink">{formatMoney(data.budget.amount, data.budget.currency)}/mo</span>
              {data.canSetBudget ? <Button size="sm" variant="ghost" onClick={() => { setBudgetText(String(data.budget.amount)); setEditBudget(true); }}>Change</Button> : null}
            </span>
          )}
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
      {data.canEdit ? (
        <div className="mt-4">
          {!editTypes ? (
            <Button size="sm" variant="secondary" onClick={() => { setSelectedTypes(data.types.map((t) => t.key)); setEditTypes(true); }}>
              {data.typesSource === "owner" ? "Edit business types" : "Confirm business types"}
            </Button>
          ) : (
            <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface-2 p-3">
              <div>
                <p className="text-ui font-medium text-ink">Which kinds of business describe you?</p>
                <p className="mt-1 text-xs text-ink-3">Choose 1–3. These choices can affect which channels ClimbOS marks eligible; inferred suggestions do not unlock restricted channels until confirmed.</p>
              </div>
              {TYPE_GROUPS.map((group) => (
                <fieldset key={group.key}>
                  <legend className="mb-1 text-xs font-semibold text-ink-2">{group.label}</legend>
                  <div className="grid gap-1 sm:grid-cols-2">
                    {data.availableTypes.filter((type) => type.category === group.key).map((type) => {
                      const checked = selectedTypes.includes(type.key);
                      return (
                        <label key={type.key} className="flex min-h-9 items-center gap-2 rounded-[var(--radius-control)] px-2 text-sm text-ink hover:bg-surface">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!checked && selectedTypes.length >= 3}
                            onChange={() => setSelectedTypes((current) => checked ? current.filter((key) => key !== type.key) : [...current, type.key])}
                            className="size-4 accent-brand-700"
                          />
                          <span>{type.label}</span>
                          {type.regulated ? <span className="text-xs text-amber-800">· regulated</span> : null}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  loading={savingTypes}
                  disabled={selectedTypes.length < 1 || selectedTypes.length > 3}
                  onClick={async () => {
                    setSavingTypes(true);
                    try {
                      await setTypes({ slug, types: selectedTypes });
                      setEditTypes(false);
                      toast({ tone: "success", title: "Business types confirmed.", description: "Channel eligibility has been recalculated using your choices." });
                    } catch (e) {
                      toast({ tone: "danger", title: errorMessage(e) });
                    } finally {
                      setSavingTypes(false);
                    }
                  }}
                >
                  Save confirmation
                </Button>
                <Button size="sm" variant="ghost" disabled={savingTypes} onClick={() => { setSelectedTypes(data.types.map((t) => t.key)); setEditTypes(false); }}>
                  Cancel
                </Button>
                <span className="text-xs text-ink-3">{selectedTypes.length}/3 selected</span>
              </div>
              {selectedTypes.some((key) => data.availableTypes.find((type) => type.key === key)?.regulated) ? (
                <Callout tone="warning" title="Additional review may apply">Some advertising, claims, referral, or privacy rules depend on your industry and jurisdiction. A category selection is not a compliance review.</Callout>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
      {data.canEdit ? <AlreadyUsing slug={slug} channels={data.channels} /> : null}
      {data.canEdit && guesses.length ? (
        <div className="mt-4 flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface-2 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-ui font-medium text-ink">Check ClimbOS&apos;s guesses</p>
              <p className="text-xs text-ink-3">Guessed from your website and research. Change any that are wrong, then approve. Approved answers sharpen the channel ranking.</p>
            </div>
            <Button
              size="sm"
              onClick={async () => {
                try {
                  const r = await approve({ slug });
                  toast({ tone: "success", title: `Approved ${r.approved} guess${r.approved === 1 ? "" : "es"}` });
                } catch (e) {
                  toast({ tone: "danger", title: errorMessage(e) });
                }
              }}
            >
              <CircleCheck aria-hidden /> Approve all guesses
            </Button>
          </div>
          {guesses.map((d) => <DimensionChoice key={d.key} d={d} canEdit={data.canEdit} onChange={(vals) => save(d.key, vals)} />)}
        </div>
      ) : null}
      {data.canEdit && unknown.length ? (
        <p className="mt-3 text-xs text-ink-3">ClimbOS couldn&apos;t guess {unknown.map((d) => d.label.toLowerCase()).join(", ")} yet. Open All details to answer, or refresh the plan for new guesses.</p>
      ) : null}
      <button type="button" className="mt-3 inline-flex min-h-6 items-center gap-1 text-xs font-medium text-brand-800 hover:underline" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <ChevronDown aria-hidden className={cn("size-3.5 transition-transform", open && "rotate-180")} /> All details
      </button>
      {open ? (
        <div className="mt-3 flex flex-col gap-3">
          {data.dimensions.map((d) => <DimensionChoice key={d.key} d={d} canEdit={data.canEdit} onChange={(vals) => save(d.key, vals)} />)}
        </div>
      ) : null}
    </section>
  );
}

function Group({ title, icon, hint, rows, labels, rankOf, highlight, slug, canEdit }: { title?: string; icon?: LucideIcon; hint?: string; rows: Row[]; labels: View["factorLabels"]; rankOf: Map<string, number>; highlight?: boolean; slug: string; canEdit: boolean }) {
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
          <ChannelRow key={r.id} r={r} rank={rankOf.get(r.id) ?? 0} labels={labels} slug={slug} canEdit={canEdit} />
        ))}
      </ol>
    </section>
  );
}

function ChannelRow({ r, rank, labels, slug, canEdit }: { r: Row; rank: number; labels: View["factorLabels"]; slug: string; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const savePreference = useMutation(api.acquisition.setChannelPreference);
  const Exec = EXEC_ICON[r.exec as keyof typeof EXEC_ICON] ?? Hand;
  const recommendation = recommendationGuidance(r.id);
  const general = generalChannelGuidance(r.id);
  const job = channelJob(r.id);
  return (
    <li {...climbTarget("channel", r.id, `${r.name}: priority ${rank}, ${r.statusLabel}`)}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2">
        <span className="mt-0.5 w-5 shrink-0 text-right text-xs tabular-nums text-ink-3">{rank}</span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium text-ink">{r.name}</span>
            <span className="text-xs text-ink-3">{r.family}</span>
            {recommendation ? <Badge tone="blue">{recommendation.label}</Badge> : null}
            {job ? <span className="text-xs text-ink-3">Job: {CHANNEL_JOB_LABEL[job]}</span> : null}
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
        <ChevronDown aria-hidden className={cn("mt-1 size-4 shrink-0 text-ink-3 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="grid grid-cols-1 gap-4 px-4 pb-4 pl-12 sm:grid-cols-2">
          <ul className="flex flex-col gap-1.5" aria-label={`${r.name} factor scores`}>
            {labels.map((f, i) => (
              <li key={f.key} aria-label={`${f.label}: ${factorLevel(r.factors[i])} signal`} className="grid grid-cols-[9.5rem_1fr_4.5rem] items-center gap-2 text-xs">
                <span className="text-ink-2">{f.label}</span>
                <span aria-hidden className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                  <span className="block h-full rounded-full bg-brand-700" style={{ width: `${r.factors[i]}%` }} />
                </span>
                <span className="text-right text-ink-2">{factorLevel(r.factors[i])}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-3 text-xs text-ink-2">
            <dl className="flex flex-col gap-2.5">
              {r.platform || r.tactic ? <Detail label="How">{[r.platform, r.tactic].filter(Boolean).join(" · ")}</Detail> : null}
              {r.audience ? <Detail label="Who">{r.audience}</Detail> : null}
              {recommendation ? <Detail label="Purpose">{r.purpose ?? recommendation.purpose}</Detail> : r.purpose ? <Detail label="Intended job">{r.purpose}</Detail> : null}
              {recommendation ? <Detail label="Useful outcomes">{r.measurementPlan ?? recommendation.measurement}</Detail> : r.measurementPlan ? <Detail label="How to measure">{r.measurementPlan}</Detail> : null}
            </dl>
            {!r.evidence && !r.purpose && !r.platform && !r.tactic && !recommendation && general ? (
              <div className="flex flex-col gap-2.5">
                <dl className="flex flex-col gap-2.5">
                  <Detail label="How (general)">{general.how}</Detail>
                  <Detail label="Who">Not assessed for your business yet.</Detail>
                  <Detail label="Intended job">{general.job}</Detail>
                  <Detail label="How to measure">{general.measure}</Detail>
                </dl>
                <div className="rounded-[var(--radius-control)] border border-dashed border-line px-3 py-2">
                  <span className="text-2xs font-semibold uppercase tracking-wide text-ink-3">Evidence</span>
                  <p className="mt-1 leading-relaxed text-ink-2">Not reviewed for your business yet. ClimbOS reviews a channel in depth when it becomes a candidate for your plan; the notes above are general, not evidence.</p>
                </div>
              </div>
            ) : null}
            {r.evidence ? (
              <div className="rounded-[var(--radius-control)] border border-line bg-surface-2 px-3 py-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-2xs font-semibold uppercase tracking-wide text-ink-3">Evidence</span>
                  <Badge tone="neutral">{r.evidenceBasis ?? "basis unknown"}</Badge>
                  <Badge tone={r.evidenceConfidence === "high" ? "green" : r.evidenceConfidence === "medium" ? "blue" : "amber"}>confidence {r.evidenceConfidence ?? "unknown"}</Badge>
                  <span className="text-ink-3">{r.evidenceDate ?? "date unknown"}</span>
                </div>
                <p className="mt-1 leading-relaxed text-ink-2">{r.evidence}</p>
              </div>
            ) : null}
            {r.sourceUrl ? <p><span className="text-ink-3">Source: </span><a href={r.sourceUrl} target="_blank" rel="noreferrer" className="break-all text-brand-800 underline">{r.sourceUrl}</a></p> : null}
            {r.communityRulesUrl ? <p><span className="text-ink-3">Community rules checked {r.communityRulesCheckedAt ?? "date unknown"}: </span><a href={r.communityRulesUrl} target="_blank" rel="noreferrer" className="break-all text-brand-800 underline">{r.communityRulesUrl}</a></p> : null}
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
            {canEdit ? (
              <div className="mt-1 flex flex-wrap gap-2 border-t border-line pt-3">
                <Button size="sm" variant={r.ownerPreference?.preference === "already_using" ? "primary" : "secondary"} aria-pressed={r.ownerPreference?.preference === "already_using"} onClick={async () => {
                  try {
                    const on = r.ownerPreference?.preference === "already_using";
                    await savePreference(on ? { slug, channelId: r.id, preference: "clear" } : { slug, channelId: r.id, preference: "already_using", rationale: "The owner already uses this channel." });
                    toast({ tone: "success", title: on ? "Unmarked" : "Marked as a channel you already use" });
                  } catch (error) { toast({ tone: "danger", title: errorMessage(error) }); }
                }}>{r.ownerPreference?.preference === "already_using" ? "✓ I already use this" : "I already use this"}</Button>
                {(["dismissed", "irrelevant"] as const).map((preference) => (
                  <Button key={preference} size="sm" variant={r.ownerPreference?.preference === preference ? "secondary" : "ghost"} onClick={async () => {
                    try {
                      await savePreference({ slug, channelId: r.id, preference, rationale: preference === "irrelevant" ? "Marked irrelevant by workspace owner" : "Dismissed by workspace owner" });
                      toast({ tone: "success", title: preference === "irrelevant" ? "Marked irrelevant" : "Recommendation dismissed", description: "This feedback is saved for future channel rankings." });
                    } catch (error) { toast({ tone: "danger", title: errorMessage(error) }); }
                  }}>{preference === "irrelevant" ? "Mark irrelevant" : "Dismiss recommendation"}</Button>
                ))}
                {r.ownerPreference && ["dismissed", "irrelevant"].includes(r.ownerPreference.preference) ? (
                  <Button size="sm" variant="ghost" onClick={async () => { await savePreference({ slug, channelId: r.id, preference: "clear" }); }}>Restore recommendation</Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </li>
  );
}

function factorLevel(value: number): "Strong" | "Mixed" | "Limited" {
  return value >= 70 ? "Strong" : value >= 45 ? "Mixed" : "Limited";
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

type DimensionView = View["dimensions"][number];

/** One business detail as chips: several can be ticked on multiple-choice details; guesses show pre-selected. */
function DimensionChoice({ d, canEdit, onChange }: { d: DimensionView; canEdit: boolean; onChange: (values: string[]) => void }) {
  const status = d.source === "owner" ? <Badge tone="green">You</Badge> : d.source === "inferred" ? <Badge tone="neutral">AI guess · {d.confidence}</Badge> : <Badge tone="neutral">Not guessed</Badge>;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
        {d.label}
        {d.multi ? <span>(pick all that apply)</span> : null}
        {status}
      </span>
      {d.multi ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label={d.label}>
          {d.options.map((o) => {
            const on = d.values.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                aria-pressed={on}
                disabled={!canEdit}
                onClick={() => onChange(on ? d.values.filter((x) => x !== o.value) : [...d.values, o.value])}
                className={cn("inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-ui font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50", on ? "border-brand-800 bg-brand-800 text-white" : "border-control bg-surface text-ink hover:bg-surface-2")}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      ) : (
        <ChoiceChips aria-label={d.label} size="md" value={d.value ?? ""} disabled={!canEdit} onValueChange={(v) => onChange([v])} options={d.options} />
      )}
    </div>
  );
}

/** One labelled line in a channel's details: a small caps label over readable body text. */
function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-2xs font-semibold uppercase tracking-wide text-ink-3">{label}</dt>
      <dd className="mt-0.5 text-ui leading-relaxed text-ink">{children}</dd>
    </div>
  );
}

/** Channel families where an owner commonly already has an account or list (asked up front, not discovered later). */
const EXISTING_FAMILIES = new Set(["Organic social", "Email", "Video & audio", "Local & location-based", "Marketplaces & directories", "Content", "Communities"]);

/** "Which of these do you already use?": ticked channels rank as existing assets to build on. */
function AlreadyUsing({ slug, channels }: { slug: string; channels: View["channels"] }) {
  const savePreference = useMutation(api.acquisition.setChannelPreference);
  const [busy, setBusy] = useState<string | null>(null);
  const options = channels.filter((c) => EXISTING_FAMILIES.has(c.family) && c.status !== "ineligible").slice(0, 18);
  if (!options.length) return null;
  return (
    <div className="mt-4 flex flex-col gap-2">
      <p className="text-ui font-medium text-ink">Which of these do you already use? <span className="text-xs font-normal text-ink-3">(pick all that apply)</span></p>
      <p className="text-xs text-ink-3">ClimbOS builds on channels you already have instead of suggesting them as new.</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Channels you already use">
        {options.map((c) => {
          const on = c.ownerPreference?.preference === "already_using";
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={on}
              disabled={busy === c.id}
              onClick={async () => {
                setBusy(c.id);
                try {
                  await savePreference(on ? { slug, channelId: c.id, preference: "clear" } : { slug, channelId: c.id, preference: "already_using", rationale: "The owner already uses this channel." });
                } catch (e) {
                  toast({ tone: "danger", title: errorMessage(e) });
                } finally {
                  setBusy(null);
                }
              }}
              className={cn("inline-flex h-8 items-center gap-1 rounded-full border px-3 text-xs font-medium transition-colors disabled:opacity-60", on ? "border-brand-800 bg-brand-800 text-white" : "border-control bg-surface text-ink hover:bg-surface-2")}
            >
              {on ? "✓ " : ""}{c.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
