"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { ExternalLink } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Badge, Callout, Card, CardContent, DataTable, Skeleton, Switch, buttonClasses, toast, type Tone } from "@/components/ui";
import { microsToDisplay, minorToDisplay, relativeTime } from "../money";
import { RUN_STATUS_LABEL, RUN_STATUS_TONE } from "../content/RunProgress";
import { ErrorCallout, PERMISSION_WHO, RoleName, useNow } from "../content/shared";
import { ROLE_META } from "../roles";

export type PlanView = FunctionReturnType<typeof api.workspace.plan>;
export type Strategy = NonNullable<PlanView["strategy"]>;
export type Insights = NonNullable<PlanView["insights"]>;

export function PlanSection({ id, title, intro, children }: { id: string; title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 id={id} className="heading-section">
              {title}
            </h2>
            {intro ? <div className="max-w-3xl text-sm text-ink-3">{intro}</div> : null}
          </div>
          {children}
        </CardContent>
      </Card>
    </section>
  );
}

function Prose({ text }: { text: string }) {
  return <p className="max-w-3xl whitespace-pre-line text-sm text-ink">{text}</p>;
}

function BulletList({ items, empty }: { items: string[]; empty?: string }) {
  if (items.length === 0) return empty ? <p className="text-ink-3">{empty}</p> : null;
  return (
    <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-ink-2">
      {items.map((i) => (
        <li key={i}>{i}</li>
      ))}
    </ul>
  );
}

/** Parse "YYYY-MM-DD" as a local date for display. */
export function formatPlanDate(s: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return s;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

/* ---------------- Short version & audiences ---------------- */

export function ShortVersion({ strategy }: { strategy: Strategy }) {
  return (
    <PlanSection id="short-heading" title="The short version">
      <Prose text={strategy.summary} />
      <div>
        <h3 className="heading-card mb-1">How you stand out</h3>
        <Prose text={strategy.positioning} />
      </div>
    </PlanSection>
  );
}

export function Audiences({ strategy }: { strategy: Strategy }) {
  return (
    <PlanSection id="audiences-heading" title="Who to reach">
      {strategy.audiences.length === 0 ? (
        <p className="text-ink-3">No audiences in this plan yet.</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {strategy.audiences.map((a) => (
            <li key={a.name} className="flex flex-col gap-2 rounded-xl border border-line bg-surface-2 p-4">
              <h3 className="heading-card">{a.name}</h3>
              <p className="text-sm text-ink-2">
                <span className="font-medium text-ink">What we think: </span>
                {a.hypothesis}
              </p>
              <p className="text-sm text-ink-2">
                <span className="font-medium text-ink">Why we think so: </span>
                {a.evidence}
              </p>
            </li>
          ))}
        </ul>
      )}
    </PlanSection>
  );
}

/* ---------------- Channels ---------------- */

const CHANNEL_STATUS: Record<string, { label: string; tone: Tone }> = {
  proposed: { label: "Proposed", tone: "amber" },
  active: { label: "Active — the team works on this", tone: "green" },
  parked: { label: "Parked — on hold", tone: "neutral" },
};

function ChannelToggle({ slug, strategyId, channelKey, status, name }: { slug: string; strategyId: Id<"strategies">; channelKey: string; status: string; name: string }) {
  const setStatus = useMutation(api.workspace.setChannelStatus);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  return (
    <div className="flex flex-col gap-2">
      <Switch
        label={`Work on ${name}`}
        description={pending ? "Saving…" : status === "proposed" ? "Proposed. Turn on to make it active, or leave it until you approve the plan." : "Turn off to park it; the team stops new work here."}
        checked={status === "active"}
        disabled={pending}
        onCheckedChange={async (on) => {
          setPending(true);
          setError(null);
          try {
            await setStatus({ slug, strategyId, key: channelKey, status: on ? "active" : "parked" });
            toast({ tone: "success", title: on ? `${name} is active.` : `${name} is parked.` });
          } catch (e) {
            setError(e);
          } finally {
            setPending(false);
          }
        }}
      />
      {error ? <ErrorCallout error={error} /> : null}
    </div>
  );
}

export function Channels({ slug, strategy, canEdit, currency }: { slug: string; strategy: Strategy; canEdit: boolean; currency: string }) {
  const channels = [...strategy.channels].sort((a, b) => a.priority - b.priority);
  const editable = canEdit && strategy.status !== "superseded";
  return (
    <PlanSection
      id="channels-heading"
      title="Channels"
      intro="In priority order. AI costs come out of your monthly ClimbOS capacity; any ad spend is paid directly to the ad platform, not to ClimbOS."
    >
      {channels.length === 0 ? (
        <p className="text-ink-3">No channels in this plan yet.</p>
      ) : (
        <ol className="flex flex-col gap-4">
          {channels.map((c, i) => {
            const st = CHANNEL_STATUS[c.status] ?? { label: c.status, tone: "neutral" as Tone };
            return (
              <li key={c.key} className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-overline">Priority {i + 1}</span>
                    <h3 className="heading-card">{c.name}</h3>
                  </div>
                  <Badge tone={st.tone}>{st.label}</Badge>
                </div>
                <p className="text-sm text-ink">{c.why}</p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h4 className="mb-1 text-ui font-semibold text-ink">What the team delivers</h4>
                    <BulletList items={c.deliverables} empty="Nothing listed." />
                  </div>
                  <div>
                    <h4 className="mb-1 text-ui font-semibold text-ink">What it needs first</h4>
                    <BulletList items={c.dependencies} empty="Nothing — it can start right away." />
                  </div>
                  <div>
                    <h4 className="mb-1 text-ui font-semibold text-ink">How we&apos;ll measure it</h4>
                    <p className="text-sm text-ink-2">{c.measurement}</p>
                  </div>
                  <div>
                    <h4 className="mb-1 text-ui font-semibold text-ink">Expected monthly cost</h4>
                    <p className="text-sm text-ink-2">
                      Up to {microsToDisplay(c.monthlyCostMicros)} of AI capacity a month.
                      {c.adSpendMinor > 0 ? ` Plus about ${minorToDisplay(c.adSpendMinor, currency)} a month in ad spend, paid directly to the ad platform.` : " No ad spend."}
                    </p>
                  </div>
                </div>
                {c.capabilityNote ? (
                  <Callout tone="info" title="Good to know">
                    {c.capabilityNote}
                  </Callout>
                ) : null}
                {editable ? (
                  <ChannelToggle slug={slug} strategyId={strategy.id} channelKey={c.key} status={c.status} name={c.name} />
                ) : !canEdit ? (
                  <p className="text-sm text-ink-3">Turning channels on or off needs {PERMISSION_WHO.edit}.</p>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </PlanSection>
  );
}

/* ---------------- Experiments ---------------- */

const METHOD: Record<string, string> = {
  holdout: "Holdout: a group that doesn't see the change, for comparison",
  ab_split: "A/B split: two versions shown to similar people at the same time",
  pre_post_observational: "Before-and-after comparison (the weakest evidence)",
  export_instructions: "A test you run yourself, with step-by-step instructions",
};

const EXPERIMENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  proposed: { label: "Proposed", tone: "amber" },
  running: { label: "Running", tone: "blue" },
  stopped: { label: "Stopped", tone: "neutral" },
  concluded: { label: "Finished", tone: "green" },
};

export function Experiments({ experiments }: { experiments: PlanView["experiments"] }) {
  return (
    <PlanSection
      id="experiments-heading"
      title="Experiments"
      intro="Tests that check whether a change is linked to better results. A rise after a change isn't proof the change caused it — other things change too. That's why each test has a comparison, a main number to watch, safety limits and a rule for when to stop."
    >
      {experiments.length === 0 ? (
        <p className="text-ink-3">No experiments in this plan yet.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {experiments.map((e) => {
            const st = EXPERIMENT_STATUS[e.status] ?? { label: e.status, tone: "neutral" as Tone };
            return (
              <li key={e.id} className="flex flex-col gap-3 rounded-xl border border-line bg-surface-2 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="heading-card">{e.name}</h3>
                  <Badge tone={st.tone}>{st.label}</Badge>
                </div>
                <dl className="grid gap-3 text-sm md:grid-cols-2">
                  <div className="md:col-span-2">
                    <dt className="text-xs font-medium text-ink-3">What we&apos;re testing</dt>
                    <dd className="text-ink">{e.hypothesis}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-ink-3">Who takes part</dt>
                    <dd className="text-ink">{e.population}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-ink-3">How</dt>
                    <dd className="text-ink">{METHOD[e.method] ?? e.method}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-ink-3">Main number to watch</dt>
                    <dd className="text-ink">{e.primaryMetric}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-ink-3">How long</dt>
                    <dd className="text-ink">
                      {e.durationDays} day{e.durationDays === 1 ? "" : "s"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-ink-3">Safety limits</dt>
                    <dd>
                      <BulletList items={e.guardrails} empty="None listed." />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-ink-3">When we stop</dt>
                    <dd className="text-ink">{e.stoppingRule}</dd>
                  </div>
                </dl>
              </li>
            );
          })}
        </ul>
      )}
    </PlanSection>
  );
}

/* ---------------- Constraints, measurement, review ---------------- */

export function PlanBasics({ strategy }: { strategy: Strategy }) {
  return (
    <>
      <PlanSection id="constraints-heading" title="Constraints" intro="Limits the team works within.">
        <BulletList items={strategy.constraints} empty="No constraints listed." />
      </PlanSection>
      <PlanSection id="measure-heading" title="How we'll measure">
        <Prose text={strategy.measurementPlan} />
      </PlanSection>
      <PlanSection id="review-date-heading" title="Next review">
        <p className="text-sm text-ink">
          <time dateTime={strategy.reviewDate}>{formatPlanDate(strategy.reviewDate)}</time>. The team checks results against this plan and suggests changes. Nothing
          changes without your approval.
        </p>
      </PlanSection>
    </>
  );
}

/* ---------------- Business insights ---------------- */

const CONFIDENCE_TONE: Record<string, Tone> = { high: "green", medium: "amber", low: "neutral" };

export function BusinessInsights({ insights }: { insights: Insights | null }) {
  const now = useNow();
  if (!insights) {
    return (
      <PlanSection id="insights-heading" title="Business insights">
        <p className="text-ink-3">Insights appear after the team has researched your business.</p>
      </PlanSection>
    );
  }
  const swot: { key: keyof Insights["swot"]; label: string }[] = [
    { key: "strengths", label: "Strengths" },
    { key: "weaknesses", label: "Weaknesses" },
    { key: "opportunities", label: "Opportunities" },
    { key: "threats", label: "Threats" },
  ];
  return (
    <PlanSection
      id="insights-heading"
      title="Business insights"
      intro={
        <>
          What your AI team learned about your business and market{now ? `, ${relativeTime(insights.generatedAt, now)}` : ""}. Research can be wrong — check anything
          that looks off.
        </>
      }
    >
      <div className="flex flex-col gap-8">
        <div>
          <h3 className="heading-card mb-3">Your audiences</h3>
          <ul className="grid gap-3 md:grid-cols-2">
            {insights.audiences.map((a) => (
              <li key={a.name} className="flex flex-col gap-1.5 rounded-xl border border-line p-3">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-ink">{a.name}</span>
                  <Badge tone={CONFIDENCE_TONE[a.confidence.toLowerCase()] ?? "neutral"}>{`${a.confidence.charAt(0).toUpperCase()}${a.confidence.slice(1)} confidence`}</Badge>
                </span>
                <span className="text-sm text-ink-2">{a.description}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="heading-card mb-3">Competitors</h3>
          {insights.competitors.length === 0 ? (
            <p className="text-ink-3">No competitors found yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {insights.competitors.map((c) => (
                <li key={c.name} className="flex flex-col gap-1 rounded-xl border border-line p-3">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-ink">{c.name}</span>
                    {c.url ? (
                      <a href={c.url} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: "link" })}>
                        Website <ExternalLink aria-hidden="true" className="size-3.5" />
                        <span className="sr-only">(opens in a new tab)</span>
                      </a>
                    ) : null}
                  </span>
                  <span className="text-sm text-ink-2">{c.note}</span>
                  {c.sourceUrl ? (
                    <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: "link", className: "self-start" })}>
                      Source <ExternalLink aria-hidden="true" className="size-3.5" />
                      <span className="sr-only">(opens in a new tab)</span>
                    </a>
                  ) : (
                    <Badge tone="amber" className="self-start">
                      No source — owner should confirm
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="heading-card mb-2">Positioning</h3>
            <Prose text={insights.positioning} />
          </div>
          <div>
            <h3 className="heading-card mb-2">Pricing notes</h3>
            <Prose text={insights.pricingNotes} />
          </div>
        </div>

        <div>
          <h3 className="heading-card mb-3">Strengths, weaknesses, opportunities and threats</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {swot.map((s) => (
              <div key={s.key} className="rounded-xl border border-line bg-surface-2 p-3">
                <h4 className="mb-1.5 text-ui font-semibold text-ink">{s.label}</h4>
                <BulletList items={insights.swot[s.key]} empty="None noted." />
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="heading-card mb-3">Customer journey</h3>
          {insights.journey.length === 0 ? (
            <p className="text-ink-3">Not mapped yet.</p>
          ) : (
            <>
              <ol className="flex flex-col gap-3 sm:hidden">
                {insights.journey.map((j) => (
                  <li key={j.stage} className="rounded-xl border border-line p-3">
                    <h4 className="text-ui font-semibold text-ink">{j.stage}</h4>
                    <p className="mt-1 text-sm text-ink-2">
                      <span className="font-medium text-ink">What we see: </span>
                      {j.observation}
                    </p>
                    <p className="mt-1 text-sm text-ink-2">
                      <span className="font-medium text-ink">Opportunity: </span>
                      {j.opportunity}
                    </p>
                  </li>
                ))}
              </ol>
              <div className="hidden sm:block">
                <DataTable
                  caption="Customer journey: what we see at each stage and the opportunity"
                  hideCaption
                  rows={insights.journey}
                  rowKey={(r) => r.stage}
                  columns={[
                    { key: "stage", header: "Stage", rowHeader: true, cell: (r) => <span className="font-medium">{r.stage}</span> },
                    { key: "observation", header: "What we see", cell: (r) => r.observation },
                    { key: "opportunity", header: "Opportunity", cell: (r) => r.opportunity },
                  ]}
                />
              </div>
            </>
          )}
        </div>

        <div>
          <h3 className="heading-card mb-3">Top opportunities</h3>
          {insights.opportunities.length === 0 ? (
            <p className="text-ink-3">None yet.</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {insights.opportunities.map((o) => (
                <li key={o.title} className="flex flex-col gap-1 rounded-xl border border-line p-3">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-ink">{o.title}</span>
                    <Badge>{`Effort: ${o.effort}`}</Badge>
                  </span>
                  <span className="text-sm text-ink-2">{o.why}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </PlanSection>
  );
}

/* ---------------- Sources ---------------- */

export function Sources({ sources }: { sources: PlanView["sources"] }) {
  return (
    <PlanSection id="sources-heading" title="Sources" intro="Facts about your business this plan is based on.">
      {sources.length === 0 ? (
        <p className="text-ink-3">No facts were linked to this plan.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {sources.map((s) => (
            <li key={s.id} className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3">
              <Badge className="shrink-0 self-start capitalize">{s.category}</Badge>
              <span className="text-sm text-ink">{s.statement}</span>
            </li>
          ))}
        </ul>
      )}
    </PlanSection>
  );
}

/* ---------------- Recent work ---------------- */

export function RecentWork({ slug }: { slug: string }) {
  const runs = useQuery(api.workspace.runs, { slug });
  const now = useNow();
  return (
    <PlanSection id="recent-heading" title="Recent work by your team">
      {runs === undefined ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : runs.length === 0 ? (
        <p className="text-ink-3">No work yet. Jobs your team runs show up here with what they cost.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {runs.slice(0, 12).map((r) => {
            const finished = ["verified", "failed", "canceled", "uncertain"].includes(r.status);
            return (
              <li key={r.id} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-ink">{r.title}</span>
                  <span className="flex flex-wrap gap-2">
                    {r.isFixture ? <Badge tone="violet">Demo</Badge> : null}
                    <Badge tone={RUN_STATUS_TONE[r.status] ?? "neutral"}>{RUN_STATUS_LABEL[r.status] ?? r.status}</Badge>
                  </span>
                </div>
                <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-3">
                  <span className="flex flex-wrap gap-x-2">
                    {r.roles.map((role) => (
                      <RoleName key={role} role={role} className={ROLE_META[role] ? "" : "capitalize"} />
                    ))}
                  </span>
                  <span>
                    {finished ? `Used ${microsToDisplay(r.actualMicros)} of up to ${microsToDisplay(r.estimateMicros)}` : `Up to ${microsToDisplay(r.estimateMicros)} reserved`}
                  </span>
                  {now ? <span>{relativeTime(r.createdAt, now)}</span> : null}
                </span>
                {r.userMessage ? <span className="text-sm text-ink-2">{r.userMessage}</span> : null}
              </li>
            );
          })}
        </ul>
      )}
    </PlanSection>
  );
}
