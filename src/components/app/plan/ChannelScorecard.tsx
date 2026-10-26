"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Ban, Bot, ChevronDown, CircleCheck, Clock, Hand, Hourglass, ShieldAlert, Sparkles, Store, UserRound, Wallet, type LucideIcon } from "@/components/icons"
import { useState } from "react";
import { Badge, Button, Callout, ChoiceChips, EmptyState, IconTile, Select, Skeleton, toast } from "@/components/ui";
import { errorMessage } from "@/components/app/errors";
import { climbTarget } from "@/components/climb/context";
import { cn } from "@/lib/utils";
import { CHANNEL_JOB_LABEL, channelJob, recommendationGuidance } from "@shared/acquisition/recommendationGroups";

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
      <p className="text-xs text-ink-3">Order is a relative fit guide based on audience, buying intent, budget, time, team capacity, competition, scalability, and measurement. These rule-guided signals are not probabilities of success.</p>
      <SplitStrip counts={{ plan: plan.length, later: later.length, notNow: notNow.length, ineligible: ineligible.length }} />
      <Group title="In the plan" icon={CircleCheck} rows={plan} labels={data.factorLabels} rankStart={1} highlight slug={slug} canEdit={data.canEdit} />
      <Group title="Later" icon={Hourglass} hint="Add once the first ones work." rows={later} labels={data.factorLabels} rankStart={plan.length + 1} slug={slug} canEdit={data.canEdit} />
      <Collapsible title={`Not now (${notNow.length})`}>
        <Group rows={notNow} labels={data.factorLabels} rankStart={plan.length + later.length + 1} slug={slug} canEdit={data.canEdit} />
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
            <p className="mt-1 text-xs text-ink-3">
              {data.typesSource === "owner" ? "Confirmed by your team" : "Suggested classification · confirm to affect channel eligibility"}
            </p>
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

function Group({ title, icon, hint, rows, labels, rankStart, highlight, slug, canEdit }: { title?: string; icon?: LucideIcon; hint?: string; rows: Row[]; labels: View["factorLabels"]; rankStart: number; highlight?: boolean; slug: string; canEdit: boolean }) {
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
          <ChannelRow key={r.id} r={r} rank={rankStart + i} labels={labels} slug={slug} canEdit={canEdit} />
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
            {recommendation ? <p><span className="text-ink-3">Purpose: </span>{r.purpose ?? recommendation.purpose}</p> : r.purpose ? <p><span className="text-ink-3">Intended job: </span>{r.purpose}</p> : null}
            {recommendation ? <p><span className="text-ink-3">Useful outcomes: </span>{r.measurementPlan ?? recommendation.measurement}</p> : r.measurementPlan ? <p><span className="text-ink-3">Measure: </span>{r.measurementPlan}</p> : null}
            {r.evidence ? (
              <p>
                <span className="text-ink-3">Evidence ({r.evidenceBasis ?? "basis unknown"} · confidence {r.evidenceConfidence ?? "unknown"}{r.evidenceDate ? ` · ${r.evidenceDate}` : " · date unknown"}): </span>
                {r.evidence}
              </p>
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
              <div className="mt-2 flex flex-wrap gap-2">
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
